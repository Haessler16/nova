import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '00000000-0000-4000-8000-000000000002';
const RECEPTION_ID = '00000000-0000-4000-8000-000000000012';
const DEMO_EMAIL = 'reception@demo.nova.local';
const DEMO_PASSWORD = 'NovaDemo!2026';

type AuthMode = 'local-session' | 'dev-header' | 'disabled';

interface IncidentResponse {
  id: string;
}

async function authenticate(page: Page): Promise<AuthMode> {
  const response = await page.request.get(`${API_URL}/api/v1/auth/mode`);
  expect(response.ok(), 'la API debe exponer /api/v1/auth/mode').toBeTruthy();
  const { authMode } = (await response.json()) as { authMode: AuthMode };
  test.skip(authMode === 'disabled', 'La autenticación está deshabilitada en este entorno.');

  await page.goto('/login');

  if (authMode === 'local-session') {
    await page.locator('input[type="email"]').fill(DEMO_EMAIL);
    await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
  } else {
    await page.getByRole('button', { name: /Recepción Demo Centro/ }).click();
  }

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  return authMode;
}

async function requestHeaders(page: Page, authMode: AuthMode): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Organization-Id': ORGANIZATION_ID,
    'X-Property-Id': PROPERTY_ID,
  };
  if (authMode === 'local-session') {
    const cookies = await page.context().cookies(API_URL);
    const csrfCookie = cookies.find((cookie) => cookie.name === 'nova_csrf');
    expect(csrfCookie, 'el login local debe emitir la cookie nova_csrf').toBeTruthy();
    headers['X-CSRF-Token'] = decodeURIComponent(csrfCookie!.value);
  } else {
    headers['X-Dev-User-Id'] = RECEPTION_ID;
  }
  return headers;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

async function createIncident(
  page: Page,
  headers: Record<string, string>,
  suffix: string,
): Promise<{ id: string; title: string }> {
  const title = `Diálogo E2E ${suffix}`;
  const response = await page.request.post(`${API_URL}/api/v1/front-office/incidents`, {
    headers,
    data: {
      type: 'NOTE',
      severity: 'LOW',
      title,
      description: 'Incidencia sintética para probar el sistema de diálogos.',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const incident = (await response.json()) as IncidentResponse;
  return { id: incident.id, title };
}

async function openResolveDialog(page: Page, title: string) {
  await page.goto('/front-office');
  await page.getByRole('tab', { name: /Incidencias/ }).click();
  const card = page
    .locator('div')
    .filter({ has: page.getByText(title) })
    .filter({ has: page.getByRole('button', { name: 'Resolver' }) })
    .last();
  await expect(card.getByText(title)).toBeVisible({ timeout: 15_000 });
  await card.getByRole('button', { name: 'Resolver' }).click();
  return page.getByRole('dialog');
}

/**
 * Fase 6 de la Ficha 04: jerarquía y comportamiento consistentes de los
 * diálogos de decisión (información / atención / acción crítica).
 *
 * Requiere API + web en ejecución y el seed sintético aplicado.
 */
test('atención: foco en la acción segura y Escape descarta sin mutar', async ({ page }) => {
  await authenticate(page);
  await page.goto('/front-office');

  const trigger = page.getByRole('button', { name: 'No-show' }).first();
  await expect(trigger, 'el seed debe tener llegadas vencidas').toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('ATENCIÓN')).toBeVisible();
  await expect(dialog.getByText('Marcar no-show')).toBeVisible();
  await expect(dialog.getByText(/La reserva queda como no-show/)).toBeVisible();
  // The safe action owns the initial focus; confirm never steals it.
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('información: un único envío aunque se insista en el botón', async ({ page }) => {
  const authMode = await authenticate(page);
  const headers = await requestHeaders(page, authMode);
  const { title } = await createIncident(page, headers, uniqueSuffix());

  let resolveRequests = 0;
  await page.route('**/api/v1/front-office/incidents/*/resolve', async (route) => {
    resolveRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });

  const dialog = await openResolveDialog(page, title);
  await expect(dialog.getByText('INFORMACIÓN')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await dialog.getByLabel('Resolución').fill('Resuelta por la prueba de diálogos (E2E).');
  const confirm = dialog.getByRole('button', { name: 'Resolver' });
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(confirm).toBeDisabled();

  await expect(page.getByText('Incidencia resuelta')).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toBeHidden();
  expect(resolveRequests, 'el doble click no debe enviar dos mutaciones').toBe(1);
});

test('error del servidor: el diálogo queda abierto y explica el conflicto', async ({ page }) => {
  const authMode = await authenticate(page);
  const headers = await requestHeaders(page, authMode);
  const { title } = await createIncident(page, headers, uniqueSuffix());

  await page.route('**/api/v1/front-office/incidents/*/resolve', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'incident_conflict',
        message: 'La incidencia fue modificada por otro usuario.',
      }),
    });
  });

  const dialog = await openResolveDialog(page, title);
  await dialog.getByLabel('Resolución').fill('Intento que el servidor rechaza.');
  await dialog.getByRole('button', { name: 'Resolver' }).click();

  // The failure is rendered inside the dialog, which stays open and editable.
  await expect(dialog.getByText(/modificada por otro usuario/)).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Resolver' })).toBeEnabled();

  // Leaving with the draft still asks for confirmation before discarding it.
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click();
  await expect(dialog).toBeHidden();
});

test('cancelar con un motivo escrito pide confirmación de descarte', async ({ page }) => {
  await authenticate(page);
  await page.goto('/front-office');

  const trigger = page.getByRole('button', { name: 'No-show' }).first();
  await expect(trigger, 'el seed debe tener llegadas vencidas').toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const dialog = page.getByRole('dialog');
  const reason = dialog.getByLabel('Motivo');
  await reason.fill('El huésped no se presentó (prueba de descarte).');

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  const discard = page.getByRole('alertdialog');
  await expect(discard.getByText('¿Descartar lo escrito?')).toBeVisible();

  // "Seguir editando" keeps the typed text and the decision context.
  await discard.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(discard).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(reason).toHaveValue('El huésped no se presentó (prueba de descarte).');

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await discard.getByRole('button', { name: 'Descartar' }).click();
  await expect(dialog).toBeHidden();
  await expect(discard).toBeHidden();
});

test('descartar las notas de salida no envía el check-out y las limpia al reabrir', async ({
  page,
}) => {
  await authenticate(page);
  await page.goto('/front-office');
  await page.getByRole('tab', { name: /En casa/ }).click();

  const trigger = page.getByRole('button', { name: 'Check-out' }).first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const dialog = page.getByRole('dialog');
  const notes = dialog.getByLabel('Notas de salida');
  await notes.fill('Nota que se descarta antes de confirmar.');

  // The critical dialog blocks Escape, so the discard prompt comes from Cancelar.
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  const discard = page.getByRole('alertdialog');
  await expect(discard.getByText('¿Descartar lo escrito?')).toBeVisible();
  await discard.getByRole('button', { name: 'Descartar' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Check-out confirmado')).toBeHidden();

  // Reopening starts from a clean form: the reset between guests is untouched.
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Notas de salida')).toHaveValue('');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
});

test('acción crítica: Escape no descarta y el foco vuelve al origen', async ({ page }) => {
  await authenticate(page);
  await page.goto('/front-office');

  await page.getByRole('tab', { name: /En casa/ }).click();
  const trigger = page.getByRole('button', { name: 'Check-out' }).first();
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('ACCIÓN CRÍTICA')).toBeVisible();
  await expect(
    dialog.getByText('Cierra la cuenta y la estancia en una sola transacción'),
  ).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
