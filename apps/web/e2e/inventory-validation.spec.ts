import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const DEMO_PASSWORD = 'NovaDemo!2026';

interface DemoUser {
  buttonName: RegExp;
  email: string;
}

const RECEPTION: DemoUser = {
  buttonName: /Recepción Demo Centro/,
  email: 'reception@demo.nova.local',
};

// Only ORG_ADMIN has `inventory.manage` in the synthetic seed.
const ADMIN: DemoUser = {
  buttonName: /Admin Demo Aurora/,
  email: 'admin@demo.nova.local',
};

type AuthMode = 'local-session' | 'dev-header' | 'disabled';

/** Signs in through the UI and returns the active auth mode. */
async function authenticate(page: Page, user: DemoUser = RECEPTION): Promise<AuthMode> {
  const response = await page.request.get(`${API_URL}/api/v1/auth/mode`);
  expect(response.ok(), 'la API debe exponer /api/v1/auth/mode').toBeTruthy();
  const { authMode } = (await response.json()) as { authMode: AuthMode };
  test.skip(authMode === 'disabled', 'La autenticación está deshabilitada en este entorno.');

  await page.goto('/login');

  if (authMode === 'local-session') {
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[type="password"]').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
  } else {
    await page.getByRole('button', { name: user.buttonName }).click();
  }

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  return authMode;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

test('la reserva bloquea datos inválidos en el navegador', async ({ page }) => {
  await authenticate(page);

  await page.goto('/reservations');
  await page.getByRole('button', { name: 'Nueva reserva' }).click();

  const modal = page.getByRole('dialog');
  await expect(modal.getByText('Nueva reserva')).toBeVisible();

  // The room-type select is natively required; choose one so submit reaches the
  // client-side validation instead of the browser bubble.
  const roomType = modal.locator('select').first();
  await expect(roomType.locator('option').nth(1)).toBeAttached();
  await roomType.selectOption({ index: 1 });

  await modal.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(modal.getByText('Elegí o creá un huésped.')).toBeVisible();
  await expect(modal).toBeVisible();

  await modal.getByRole('button', { name: '+ Código, origen o notas' }).click();
  await modal.getByLabel('Código de reserva').fill('ab');
  await modal.getByRole('button', { name: 'Crear reserva' }).click();
  await expect(modal.getByText(/El código debe tener 4–32/)).toBeVisible();
});

test('valida y crea un tipo de habitación', async ({ page }) => {
  await authenticate(page, ADMIN);
  const suffix = uniqueSuffix();
  const code = `E2E_${suffix}`;

  await page.goto('/inventory/room-types');
  await page.getByRole('button', { name: 'Nuevo tipo' }).click();

  const modal = page.getByRole('dialog');
  await modal.locator('input').nth(0).fill(`E2E Tipo ${suffix}`);
  await modal.locator('input').nth(1).fill('código inválido');
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(modal.getByText(/El código debe tener 1–24/)).toBeVisible();

  await modal.locator('input').nth(1).fill(code);
  await modal.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Tipo de habitación creado')).toBeVisible();
  await expect(page.getByRole('cell', { name: code })).toBeVisible();
});

test('valida y crea una habitación, y gestiona un bloqueo', async ({ page }) => {
  await authenticate(page, ADMIN);
  const suffix = uniqueSuffix();
  const number = `9${suffix.slice(-6)}`;
  const reason = `Bloqueo E2E ${suffix}`;

  await page.goto('/inventory/rooms');
  await page.getByRole('button', { name: 'Nueva habitación' }).click();

  const createModal = page.getByRole('dialog');
  await createModal.locator('input').nth(0).fill('12 3');
  await createModal.getByRole('button', { name: 'Crear' }).click();
  await expect(createModal.getByText(/Hasta 32 letras/)).toBeVisible();

  await createModal.locator('input').nth(0).fill(number);
  const roomType = createModal.locator('select').first();
  await expect(roomType.locator('option').nth(1)).toBeAttached();
  await roomType.selectOption({ index: 1 });
  await createModal.getByRole('button', { name: 'Crear' }).click();
  await expect(page.getByText('Habitación creada')).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: number });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Detalle' }).click();

  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText(`Habitación ${number}`)).toBeVisible();

  const reasonInput = drawer.getByPlaceholder('Motivo (3–500)');
  await reasonInput.fill('ab');
  await drawer.getByRole('button', { name: 'Crear bloqueo' }).click();
  await expect(drawer.getByText(/El motivo debe tener al menos 3 caracteres/)).toBeVisible();

  await reasonInput.fill(reason);
  await drawer.getByRole('button', { name: 'Crear bloqueo' }).click();
  await expect(page.getByText('Bloqueo creado')).toBeVisible();
  await expect(drawer.getByText(reason)).toBeVisible();

  page.on('dialog', (dialog) => void dialog.accept('Liberado E2E'));
  await drawer.getByRole('button', { name: 'Liberar' }).first().click();
  await expect(page.getByText('Bloqueo liberado')).toBeVisible();
});
