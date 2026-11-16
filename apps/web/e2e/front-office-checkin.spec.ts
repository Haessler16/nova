import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '00000000-0000-4000-8000-000000000002';
const RECEPTION_ID = '00000000-0000-4000-8000-000000000012';
const ROOM_TYPE_STD_ID = '00000000-0000-4000-8000-000000000041';
const DEMO_EMAIL = 'reception@demo.nova.local';
const DEMO_PASSWORD = 'NovaDemo!2026';

type AuthMode = 'local-session' | 'dev-header' | 'disabled';

interface ReservationResponse {
  id: string;
  code: string;
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
    // Reuse the token issued at login: requesting /auth/csrf would rotate the
    // cookie and invalidate the token the web client keeps in memory.
    const cookies = await page.context().cookies(API_URL);
    const csrfCookie = cookies.find((cookie) => cookie.name === 'nova_csrf');
    expect(csrfCookie, 'el login local debe emitir la cookie nova_csrf').toBeTruthy();
    headers['X-CSRF-Token'] = decodeURIComponent(csrfCookie!.value);
  } else {
    headers['X-Dev-User-Id'] = RECEPTION_ID;
  }
  return headers;
}

function nextDay(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

/**
 * Fase 1 de la Ficha 04: buscador operativo en Front Desk (texto sin acentos,
 * conservado en query string) y check-in guiado con habitación revalidada por
 * el backend. Requiere API + web en ejecución y el seed sintético aplicado.
 */
test('busca por nombre sin acentos y completa el check-in guiado', async ({ page }) => {
  const authMode = await authenticate(page);
  const headers = await requestHeaders(page, authMode);
  const suffix = uniqueSuffix();

  const overviewResponse = await page.request.get(`${API_URL}/api/v1/front-office/overview`, {
    headers,
  });
  expect(overviewResponse.ok()).toBeTruthy();
  const overview = (await overviewResponse.json()) as { localDate: string };
  const checkInDate = overview.localDate;
  const checkOutDate = nextDay(checkInDate);

  const guestResponse = await page.request.post(`${API_URL}/api/v1/guests`, {
    headers,
    data: { fullName: `José E2E ${suffix}` },
  });
  expect(guestResponse.status(), await guestResponse.text()).toBe(201);
  const guest = (await guestResponse.json()) as { id: string };

  const reservationResponse = await page.request.post(`${API_URL}/api/v1/reservations`, {
    headers,
    data: {
      checkInDate,
      checkOutDate,
      adults: 1,
      children: 0,
      guestId: guest.id,
      roomTypeId: ROOM_TYPE_STD_ID,
      source: 'playwright-front-office',
    },
  });
  expect(reservationResponse.status(), await reservationResponse.text()).toBe(201);
  const reservation = (await reservationResponse.json()) as ReservationResponse;

  try {
    const query = `jose e2e ${suffix.toLowerCase()}`;
    await page.goto(`/front-office?q=${encodeURIComponent(query)}`);

    // The query string seeds the filters (reload-safe) and the backend folds
    // the accent: "José" matches "jose".
    await expect(page.getByPlaceholder('Ej.: José, DEMO-1104, 201')).toHaveValue(query);
    const row = page.locator('tr', { hasText: reservation.code });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByText(`José E2E ${suffix}`)).toBeVisible();
    await expect(row.getByText('Confirmada')).toBeVisible();

    await row.getByRole('button', { name: 'Check-in' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`Check-in — José E2E ${suffix}`)).toBeVisible();

    await dialog.getByRole('button', { name: 'Continuar' }).click();
    const eligibleRoom = dialog.locator('button:not([disabled])', { hasText: 'Elegir' }).first();
    await expect(eligibleRoom).toBeVisible({ timeout: 15_000 });
    await eligibleRoom.click();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await dialog.getByRole('button', { name: 'Continuar' }).click();
    await expect(dialog.getByText('Resumen final')).toBeVisible();

    await dialog.getByRole('button', { name: 'Confirmar check-in' }).click();
    await expect(page.getByText(/Check-in registrado para/)).toBeVisible({ timeout: 20_000 });
    await expect(dialog).toBeHidden();

    const inHouse = await page.request.get(`${API_URL}/api/v1/front-office/overview`, { headers });
    expect(inHouse.ok()).toBeTruthy();
    const board = (await inHouse.json()) as {
      inHouse: Array<{ id: string; reservation: { id: string } }>;
    };
    expect(board.inHouse.map((stay) => stay.reservation.id)).toContain(reservation.id);

    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByPlaceholder('Ej.: José, DEMO-1104, 201')).toHaveValue('');
    await expect(page).not.toHaveURL(/[?&]q=/);
  } finally {
    // Keep the test repeatable: release the stay and the room even on failure.
    const boardResponse = await page.request.get(`${API_URL}/api/v1/front-office/overview`, {
      headers,
    });
    if (boardResponse.ok()) {
      const board = (await boardResponse.json()) as {
        inHouse: Array<{ id: string; reservation: { id: string } }>;
      };
      const stay = board.inHouse.find((item) => item.reservation.id === reservation.id);
      if (stay !== undefined) {
        await page.request.post(`${API_URL}/api/v1/front-office/stays/${stay.id}/check-out`, {
          headers,
          data: { notes: 'Playwright cleanup' },
        });
      }
    }
  }
});
