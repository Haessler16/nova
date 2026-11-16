import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '00000000-0000-4000-8000-000000000002';
const RECEPTION_ID = '00000000-0000-4000-8000-000000000012';
const GUEST_ANA_ID = '00000000-0000-4000-8000-000000000061';
const ROOM_TYPE_STD_ID = '00000000-0000-4000-8000-000000000041';
const DEMO_EMAIL = 'reception@demo.nova.local';
const DEMO_PASSWORD = 'NovaDemo!2026';

type AuthMode = 'local-session' | 'dev-header' | 'disabled';

interface CreatedReservation {
  id: string;
  code: string;
}

function isoDateInDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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

async function createReservation(page: Page, authMode: AuthMode): Promise<CreatedReservation> {
  const suffix =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Organization-Id': ORGANIZATION_ID,
    'X-Property-Id': PROPERTY_ID,
  };
  if (authMode === 'local-session') {
    // Reuse the token issued at login: requesting /auth/csrf would rotate the
    // cookie and invalidate the token the web client keeps in memory.
    const cookies = await page.context().cookies(API_URL);
    const csrfCookie = cookies.find((cookie) => cookie.name === 'nova_csrf');
    expect(csrfCookie, 'el login local debe emitir la cookie nova_csrf').toBeTruthy();
    headers['X-CSRF-Token'] = decodeURIComponent(csrfCookie!.value);
  } else {
    headers['X-Dev-User-Id'] = RECEPTION_ID;
  }

  const response = await page.request.post(`${API_URL}/api/v1/reservations`, {
    headers,
    data: {
      checkInDate: isoDateInDays(200),
      checkOutDate: isoDateInDays(202),
      adults: 2,
      children: 1,
      guestId: GUEST_ANA_ID,
      roomTypeId: ROOM_TYPE_STD_ID,
      code: `UI${suffix}`,
      source: 'party-ui-e2e',
    },
  });

  const body = await response.text();
  expect(response.status(), body).toBe(201);
  return JSON.parse(body) as CreatedReservation;
}

async function openReservation(page: Page, code: string): Promise<void> {
  await page.goto('/reservations');
  const search = page.getByPlaceholder(/Código, huésped, habitación/);
  await expect(search).toBeVisible();
  await search.fill(code);
  await page.getByRole('button', { name: 'Buscar' }).click();

  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Detalle' }).click();
  await expect(page.getByTestId('reservation-party')).toBeVisible();
}

test('muestra el detalle real de la reserva y su fiesta', async ({ page }) => {
  const authMode = await authenticate(page);
  const reservation = await createReservation(page, authMode);

  await openReservation(page, reservation.code);

  await expect(page.getByText('Huéspedes de la reserva')).toBeVisible();
  await expect(page.getByText('Los menores se vinculan a un responsable')).toBeVisible();
  await expect(page.getByTestId('party-member').first()).toContainText('Ana');
  await expect(page.getByTestId('party-readiness')).toHaveText(/Fiesta (incompleta|completa)/);
  await expect(page.getByTestId('reservation-party')).toContainText('1 adulto');
});

test('da de alta un menor y refleja el bloqueo legal en el detalle', async ({ page }) => {
  const authMode = await authenticate(page);
  const reservation = await createReservation(page, authMode);
  const suffix = reservation.code.slice(2);
  const adultName = `E2E Adulto ${suffix}`;
  const minorName = `E2E Menor ${suffix}`;

  await openReservation(page, reservation.code);

  await page.getByTestId('add-adult').click();
  await page.getByTestId('party-full-name').fill(adultName);
  await page.getByTestId('party-birth-date').fill('1985-01-01');
  await page.getByTestId('party-submit').click();
  await expect(page.getByTestId('party-editor')).toBeHidden();
  await expect(page.getByTestId('party-member').filter({ hasText: adultName })).toBeVisible();

  await page.getByTestId('add-minor').click();
  await page.getByTestId('party-full-name').fill(minorName);
  await page.getByTestId('party-birth-date').fill('2014-05-10');
  const responsible = page.getByTestId('party-responsible');
  await expect(responsible).not.toHaveValue('');
  await page.getByTestId('party-submit').click();
  await expect(page.getByTestId('party-editor')).toBeHidden();

  const minorCard = page.getByTestId('party-member').filter({ hasText: minorName });
  await expect(minorCard).toBeVisible();
  await expect(minorCard).toContainText('Acompañado por el responsable');
  await expect(minorCard).toContainText('FNRH: incluida en la ficha del responsable');

  await minorCard.getByRole('button', { name: 'Editar' }).click();
  await page.getByTestId('party-supervision').selectOption('UNACCOMPANIED_WITHOUT_AUTHORIZATION');
  await page.getByTestId('party-submit').click();
  await expect(page.getByTestId('party-editor')).toBeHidden();

  await expect(page.getByTestId('party-readiness')).toHaveText('Bloqueo legal');
  await expect(minorCard).toContainText('Sin autorización registrada');
});
