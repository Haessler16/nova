# NOVA PMS — Design System & UI Implementation Guide

**Purpose:** This document is the visual and interaction source of truth for OpenCode when implementing NOVA PMS screens. Use it for the Dashboard first, then extend the same system consistently to future modules.

**Product:** NOVA PMS — Hotel Management  
**Initial product area:** Front Desk / Reception  
**UI stack:** Next.js + React + TypeScript + Chakra UI  
**Motion:** Framer Motion, used sparingly and purposefully  
**Language:** Keep UI copy easy to internationalize. The reference copy below is in English; structure strings so Portuguese and Spanish can be added without rewriting components.

---

## 1. Design direction

NOVA should feel like a modern, calm, premium hotel operations platform: clear at a glance, fast for reception staff, and approachable for new employees.

The visual direction is **Sky & Mint**, with restrained **Electric Lime** accents:

- Very light blue-gray application canvas.
- Deep navy / dark blue sidebar for navigation and product identity.
- White cards and content surfaces.
- Sky blue as the primary action and focus color.
- Mint green as the secondary/status accent.
- Electric lime only for small highlights, positive signals, or selected micro-details.
- Inter typography, generous spacing, soft corners, and subtle shadows.
- A clean, bright interface; avoid heavy glassmorphism, excessive transparency, gradients everywhere, or a dark dashboard.

The UI should look polished without sacrificing information density. Receptionists need to scan operational information quickly.

## 2. Design tokens

Create centralized theme tokens (prefer Chakra UI theme configuration or semantic tokens). Do not scatter raw hex values, spacing values, radii, or shadows throughout components.

Suggested starting palette; treat these as implementation defaults and keep them centralized so they can be tuned:

| Token           | Suggested value | Use                                  |
| --------------- | --------------: | ------------------------------------ |
| `canvas`        |       `#F3F7FB` | Main page background                 |
| `surface`       |       `#FFFFFF` | Cards, panels, tables                |
| `sidebar`       |       `#102A43` | Main navigation                      |
| `sidebarHover`  |       `#1B3B5A` | Hover / active navigation background |
| `textPrimary`   |       `#172B4D` | Main text                            |
| `textSecondary` |       `#62748A` | Secondary labels                     |
| `border`        |       `#E3EAF2` | Dividers and outlines                |
| `sky`           |       `#39A7E8` | Primary actions, links, focus        |
| `skySoft`       |       `#E8F5FD` | Selected / informational backgrounds |
| `mint`          |       `#48C9A5` | Secondary accent, positive status    |
| `mintSoft`      |       `#E8F8F2` | Positive status backgrounds          |
| `lime`          |       `#C7F36B` | Rare highlight accent                |
| `warning`       |       `#F2B84B` | Warnings / attention                 |
| `danger`        |       `#E46B72` | Errors / critical states             |

Use accessible text contrast. Do not use lime as a background behind small text. Status must never be communicated by color alone; pair color with a label or icon.

### Typography

- Primary font: **Inter** (with a sensible system sans-serif fallback).
- Page title: 24–28 px, semibold.
- Section title: 16–18 px, semibold.
- Card metric: 28–32 px, semibold/bold.
- Body: 14–15 px.
- Supporting metadata: 12–13 px.
- Use consistent line heights and avoid overly small text for operational data.

### Shape, spacing, elevation

- Card radius: 12–16 px.
- Input / button radius: 8–10 px.
- Sidebar active item: rounded 8–10 px.
- Use a consistent 4 px spacing scale (4, 8, 12, 16, 20, 24, 32).
- Cards should have a subtle border and very soft shadow; avoid strong floating shadows.
- Prefer whitespace and alignment over decorative separators.

## 3. Global application shell

Build a reusable application shell rather than designing each page independently.

### Sidebar

- Fixed or sticky left navigation on desktop.
- Deep navy background.
- NOVA PMS wordmark at the top.
- Property / hotel selector near the brand or top of navigation.
- Clear active navigation state using a lighter navy surface and a small sky-blue indicator.
- Icons should be consistent (Lucide icons are acceptable).
- Navigation labels should remain visible on desktop; a collapsed mode may be added later.
- User profile / account controls near the bottom.

Suggested initial navigation:

1. Dashboard
2. Front Desk
3. Reservations
4. Room Rack
5. Guests
6. Cashier
7. Reports
8. Settings

Do not expose unfinished modules as functional links. Use disabled or clearly marked “coming later” states only if the product requires them.

### Main content area

- Light blue-gray canvas.
- Top bar with page title/context, current property if not already in sidebar, date/operational context, notifications, and user menu.
- Main content uses a centered fluid layout with consistent horizontal padding.
- On desktop, keep a clear grid and avoid excessively wide text blocks.
- On smaller screens, collapse sidebar into a navigation drawer and stack cards without horizontal overflow.

### Shared component patterns

Create reusable components for:

- `AppShell`, `Sidebar`, `Topbar`, `PageHeader`
- `MetricCard`, `StatusBadge`, `SectionCard`
- `DataTable`, `EmptyState`, `LoadingState`, `ErrorState`
- `SearchInput`, `FilterBar`, `DateRangeControl`
- `QuickActionButton`, `AlertItem`
- `GuestAvatar` (initials fallback; do not require guest photos)

Every interactive component needs hover, focus, active, disabled, loading, and error states where applicable.

## 4. Screen 01 — Dashboard

This is the first screen to implement and the visual reference for the rest of the product.

### Purpose

Give the front-desk employee an immediate operational overview: occupancy, arrivals, departures, available rooms, quick access to frequent actions, today's arrivals, and issues that need attention.

### Header content

Product/context label:

> NOVA PMS HOTEL MANAGEMENT (Online)

Greeting:

> Good morning! Saturday, November 7, 2026 (Front Desk)

Implementation note: the date and greeting must be dynamic, localized, and based on the property's configured timezone. The example date above is reference copy only, not a hard-coded date. “Online” should be a real connection-status indicator, not a permanent decorative label. Include Online / Offline / Syncing / Connection issue states.

### Layout hierarchy

1. Global application shell (sidebar + top bar).
2. Page heading and greeting.
3. Four KPI cards in one row on wide desktop; responsive grid on smaller screens.
4. Quick Actions section.
5. Main lower area with Today’s Arrivals as the primary wider panel and Operational Alerts as a narrower panel.
6. Optional “view all” links should navigate to the relevant real module.

### KPI cards

Display these four metrics:

| Metric          | Reference value | Supporting treatment                           |
| --------------- | --------------: | ---------------------------------------------- |
| Occupancy       |             86% | Include a small positive `+5%` trend indicator |
| Arrivals        |              24 | Label as arrivals today                        |
| Departures      |              18 | Label as departures today                      |
| Available rooms |              12 | Label as currently available                   |

Design:

- White cards, soft border/shadow, rounded corners.
- Small muted label, large prominent value, small icon or subtle accent.
- Use sky, mint, and neutral tones; do not make every card a different saturated color.
- Trend indicators must have clear context (e.g. compared with yesterday or previous period). If no comparison data exists, do not imply a real trend; keep the reference `+5%` as mock/demo data only.

### Quick Actions

Show these five actions:

- Front desk
- New reservation
- Check-in
- Room Rack
- Cashier

Design:

- Visually distinct, compact action tiles or buttons.
- Clear icon + label.
- Primary actions should be easy to reach with mouse and keyboard.
- Each action must navigate to an implemented flow or open a real modal/drawer. Do not leave dead buttons.
- “New reservation” may open a reservation creation flow; “Check-in” should open a guest/reservation lookup or the appropriate check-in flow.

### Today’s Arrivals

Section title:

> Today’s arrivals (24 guests)

The panel should present a compact, scannable list or table of today's expected arrivals. Suggested fields:

- Guest name
- Reservation / confirmation reference
- Arrival time (when available)
- Room or room type
- Reservation status
- A contextual action such as View or Check-in

Use realistic fictional demo records. Do not hard-code real guest personal data. The panel should have:

- A clear section header and count.
- Search/filter only if it adds practical value at this scale.
- Status badges with text labels.
- A “View all arrivals” link.
- Empty, loading, and error states.

The `24 guests` figure is the reference visual; the list should be driven by data and the count should agree with the displayed dataset.

### Operational Alerts

Section title:

> Operational alerts

Reference alerts:

- 4 rooms awaiting cleaning
- 2 reservations require attention

Design:

- A compact list with icon, clear message, count, and severity.
- Use warning/attention styling without making the entire panel alarming.
- Each alert should open the relevant filtered view (e.g. rooms awaiting cleaning or reservations needing attention).
- Include an empty state when there are no alerts.

### Dashboard behavior and data integrity

- All KPI values and lists must come from a typed data layer or API, not be scattered static literals in the UI.
- Seed/demo data is acceptable for the first visual implementation, but clearly separate it from production data.
- Loading skeletons should preserve layout to avoid jumps.
- Provide a visible connection state.
- Respect property timezone and operational hotel day where applicable; calendar date and hotel business day may differ.
- The dashboard must not invent operational data. If data is unavailable, show a loading, empty, or error state.

## 5. Other screen patterns to carry forward

The Dashboard establishes the visual language, not a license to make every screen a dashboard. Each module should prioritize its operational task.

### Room Rack

Purpose: let reception quickly inspect room availability and operational state.

Reference behavior:

- Filter by floor, room category, and status.
- Room cards show room number, category, occupancy, housekeeping status, guest (when occupied), and expected departure.
- Selecting a room opens a side panel with details and available actions.
- Separate occupancy status from housekeeping status. A room can be vacant but dirty, occupied but clean, etc.
- Make states explicit with text labels and accessible color treatment.
- Room assignment must be protected by server-side conflict validation. A visual temporary lock may inform other receptionists, but the backend/database must be the final authority so two users cannot assign the same room concurrently.

### Reservation Calendar

Purpose: visualize reservations over time.

Reference behavior:

- Timeline/grid layout with rooms or room types in rows and dates in columns, depending on the selected view.
- Reservation bars span their occupied dates.
- Clear today marker, date navigation, filters, and reservation status.
- Avoid relying on color alone to distinguish reservation states.
- Support dense operational data while keeping labels readable.
- On narrow screens, provide a practical alternate list/day view rather than forcing an unusable wide grid.

## 6. Interaction and motion principles

- Motion should communicate state changes, not decorate every element.
- Use short, subtle transitions for hover, focus, opening drawers, and changing tabs.
- Use Framer Motion only where it improves clarity.
- Respect `prefers-reduced-motion`.
- Avoid large page entrance animations, constant floating effects, and motion that slows down repetitive reception tasks.
- Use optimistic UI only when rollback and error handling are implemented.
- Destructive or financially significant actions require confirmation and clear feedback.

## 7. Accessibility and responsive behavior

- Keyboard navigable controls and visible focus rings.
- Semantic headings and buttons.
- Accessible labels for icon-only buttons.
- Adequate contrast and readable status labels.
- Tables should remain usable with keyboard navigation.
- Do not encode meaning only through color.
- Desktop-first for reception workstations, but responsive down to tablet/mobile widths.
- Avoid horizontal page overflow. Dense operational grids may use their own controlled horizontal scrolling.

## 8. Implementation rules for OpenCode

1. Read this document before creating or modifying UI.
2. Inspect the existing repository and reuse its conventions. Do not replace the architecture or dependencies without a concrete reason.
3. Implement the shared theme and application shell before individual pages.
4. Implement **Screen 01 — Dashboard** first and use it to validate the design system.
5. Keep components small, typed, reusable, and accessible.
6. Keep mock data in clearly named fixtures or seed files. Never mix demo data with production API logic.
7. Do not fabricate backend behavior. If an API is not implemented, use an explicit mock adapter and document it.
8. Do not leave nonfunctional buttons, links, filters, or menu items.
9. Include loading, empty, error, disabled, and responsive states.
10. Avoid unnecessary dependencies and avoid introducing Tailwind if the project is using Chakra UI.
11. Do not modify business rules, database schema, authentication, or API contracts merely to make a visual component easier.
12. After each screen, run type checks, lint, and relevant tests; fix regressions before proceeding.
13. Update this document when a visual decision becomes a stable product-wide rule. Record one-off screen decisions in the screen-specific spec instead.
14. Do not redesign already-approved screens without explicit instruction.

## 9. Suggested implementation sequence

### Phase A — Foundation

- Inspect current repository and report existing framework/theme/component conventions.
- Add centralized design tokens and typography.
- Build responsive `AppShell`, sidebar, top bar, page header.
- Add shared card, badge, table/list, button, loading, empty, and error patterns.

### Phase B — Dashboard

- Build the Dashboard layout to match Section 4.
- Use fictional fixture data for the first visual pass.
- Ensure all five Quick Actions and alert/arrival links have real navigation or explicit temporary mock behavior.
- Verify desktop, tablet, and mobile layouts.

### Phase C — Future screens

For each new screen:

- Create a short screen spec with purpose, primary user tasks, information hierarchy, fields, actions, states, and responsive behavior.
- Reuse the shared design system.
- Do not force the Dashboard card layout onto workflows that need tables, calendars, forms, or room grids.
- Add acceptance criteria and tests for critical interactions.

## 10. Definition of done — visual screen

A screen is not complete until:

- It follows the tokens and application shell.
- Its hierarchy and primary task are immediately understandable.
- It works at desktop and tablet/mobile widths.
- Interactive controls work and provide feedback.
- Loading, empty, and error states exist.
- Keyboard focus and contrast are acceptable.
- No critical data is hard-coded in the component.
- Type check, lint, and relevant tests pass.
- Any intentional deviation from this guide is documented.

---

## OpenCode task prompt

Use the following prompt when starting implementation:

> Read `docs/DESIGN_SYSTEM.md` completely. Inspect the repository before making changes. Implement the NOVA PMS visual foundation and **Screen 01 — Dashboard** according to this guide. Preserve existing project architecture and conventions; use Next.js, TypeScript, and Chakra UI if that is what the repository already uses. Start by reporting the current structure and a concise implementation plan. Then implement the shared theme, responsive application shell, and Dashboard. Use clearly isolated fictional demo data where APIs are not ready. Do not invent backend behavior or leave dead controls. Include loading, empty, error, online/offline states, responsive behavior, and accessible interactions. Run type checks, lint, and relevant tests, and summarize changed files and remaining gaps. Do not start other screens until the Dashboard is reviewed and approved.

---

## Implementation status — 2026-11-08

- Theme tokens and Chakra defaults live in `apps/web/src/theme/index.ts` (`brand`/`sky`, `mint`, `lime`, `warning`, `danger`, blue-gray `gray`, `canvas`, `surface`, `sidebar`, `sidebarHover`, `line`, `textPrimary`, `textSecondary`).
- `AppShell` uses the navy sidebar, sky active indicators, organization/property selectors, responsive drawer, topbar, connection indicator and user menu.
- Shared UI primitives: `PageHeader`, `SectionCard`, `MetricCard`, `StatusBadge`, `AlertItem`, `EmptyState`, `ErrorAlert`, `QueryFeedback`, `KeyValue`.
- Dashboard KPIs, arrivals and alerts are driven by the real Front Office overview API. No occupancy trend is shown because the API does not expose a comparison period.
- Quick Actions link to implemented flows: Front Desk, new reservation (`/reservations?new=1`), check-in (`/front-office?tab=arrivals`), Room Rack (`/front-office?tab=rack`) and Calendar.
- Intentional gaps: Cashier is not linked until the module exists; connection state exposes real Online/Offline only (no synthetic Syncing/Degraded state).

## Implementation status — 2026-11-09 (exports, audit feed, offline)

- Export actions in Guests, Reservations and Folios use the shared `PageHeader` action slot, small `outline` buttons, the local `DownloadIcon`, visible loading state and the same filters shown on screen. No new raw colors were introduced.
- The Audit feed uses `SectionCard`, `QueryFeedback`, `ErrorAlert`, `textSecondary`/`line` tokens, labeled date/actor inputs, a wrapped filter bar, an explicit `Cargar más` cursor action and modal detail. Empty, loading and error states are preserved.
- The offline page is a standalone static document (no Chakra/provider dependency) with semantic heading and link; mutations remain blocked with an explicit message. It intentionally does not fake a synchronization state.
- No visual browser review was performed in this run; verification was typecheck, lint, build, unit/E2E and manual token/component inspection.
