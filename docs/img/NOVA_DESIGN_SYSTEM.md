# NOVA PMS — Visual Design System

Version: 1.0  
Status: Approved visual direction  
Product: Hotel Property Management System (PMS)

## 1. Approved direction

- Visual style: Light SaaS.
- Information density: Balanced.
- Modal strategy: Hybrid — dialog, drawer, or full-page flow according to task complexity.
- Primary UX context: Front desk staff working continuously during a hotel shift.
- Visual personality: Calm, professional, welcoming, clear, efficient.
- Reference assets:
  - `01-user-reference-dashboard.png`: user's preferred visual reference.
  - `02-nova-dashboard-concept.png`: generated NOVA direction concept.

Treat these images as visual references, not as exact product specifications. Do not copy sample names, dates, counts, weather, hotel imagery, or other placeholder content as real product data.

## 2. Visual principles

1. Make frequent actions immediately discoverable.
2. Prefer large, clearly labeled quick-action cards over tiny icon-only buttons for primary workflows.
3. Use pastel backgrounds to distinguish action families, not to encode room or reservation statuses.
4. Keep typography readable at typical reception monitor distances.
5. Preserve context during operational workflows.
6. Use consistent spacing, alignment, border radii, and interaction states.
7. Avoid visual clutter, excessive gradients, excessive shadows, and unnecessary decoration.
8. Design responsive layouts; do not force desktop navigation patterns onto mobile.

## 3. Color tokens

Use these as initial design tokens. Check contrast before shipping.

| Token                         | Suggested value | Use                                      |
| ----------------------------- | --------------- | ---------------------------------------- |
| `color.brand.navy`            | `#142B43`       | Primary navigation / dark brand surfaces |
| `color.brand.blue`            | `#2584E8`       | Primary actions, links, focus            |
| `color.brand.mint`            | `#079B70`       | Positive actions and selected highlights |
| `color.accent.lime`           | `#B7EF83`       | Small brand accents only                 |
| `color.surface.canvas`        | `#F4F7FB`       | App background                           |
| `color.surface.card`          | `#FFFFFF`       | Cards, dialogs, panels                   |
| `color.text.primary`          | `#172B45`       | Main text                                |
| `color.text.secondary`        | `#647A96`       | Supporting text                          |
| `color.border.subtle`         | `#E5ECF4`       | Dividers and card borders                |
| `color.action.checkin.bg`     | `#E5F0FF`       | Check-in quick action                    |
| `color.action.checkin.fg`     | `#2584E8`       | Check-in icon / title                    |
| `color.action.room.bg`        | `#DFF6EC`       | Room assignment quick action             |
| `color.action.room.fg`        | `#079B70`       | Room assignment icon / title             |
| `color.action.reservation.bg` | `#F0E9FF`       | New reservation quick action             |
| `color.action.reservation.fg` | `#8758DF`       | Reservation icon / title                 |
| `color.action.payment.bg`     | `#FFF0DC`       | Register payment quick action            |
| `color.action.payment.fg`     | `#B87318`       | Payment icon / title                     |

Pastel colors are action-category styling only. Define a separate semantic status palette for room status, housekeeping, payments, and reservation states. Never rely on color alone; always include text or an icon/label.

## 4. Typography

- Preferred font: Inter, or the existing project font if already consistently implemented.
- Page title: 28–32 px desktop, responsive down to 24 px.
- Section title: 18–22 px.
- KPI value: 32–40 px, semibold.
- Card title: 16–18 px, semibold.
- Body: 14–16 px.
- Supporting labels: 12–14 px; avoid tiny operational text.
- Use tabular numerals for prices, counts, room numbers, and times where possible.

## 5. Layout and spacing

- Use a consistent 4 px spacing scale: 4, 8, 12, 16, 24, 32, 40.
- Card radius: 14–20 px; quick-action cards may use 16–20 px.
- Inputs and buttons: 10–12 px radius.
- Use subtle borders and restrained shadows; avoid heavy elevation.
- Desktop content should use a responsive grid with clear alignment.
- Keep important actions above the fold on common laptop/desktop resolutions.
- Use a max-width only where it improves readability; operational grids may use the available width.

## 6. Dashboard structure

Recommended desktop information hierarchy:

1. Global app shell:
   - Brand / property identity.
   - Primary navigation.
   - Global search for reservations, guests, and rooms.
   - Notifications.
   - User / role menu.
   - Online / offline / synchronization state.
2. Welcome header:
   - Greeting and operational date.
   - Property / front desk context where useful.
3. KPI cards:
   - Occupancy.
   - Arrivals.
   - Departures.
   - Available rooms.
   - Each card: icon, value, label, optional trend or secondary detail.
4. Quick actions:
   - Check-in.
   - Assign room / Room Rack.
   - New reservation.
   - Register payment.
   - Large pastel cards, icon prominent, clear title and short description.
5. Operational work area:
   - Today's arrivals.
   - Today's departures.
   - Alerts / tasks.
   - Each list should show actionable status and a clear route to details.
6. Optional training / help card:
   - NOVA Academy entry point; visually secondary to live operations.

Do not hardcode demo figures or fake operational data. Use seeded mock data only in demo/dev environments and label it appropriately.

## 7. Quick-action card component

Create a reusable component, for example `QuickActionCard`, with:

- icon
- title
- description
- semantic action variant (`checkin`, `room`, `reservation`, `payment`)
- onClick / route action
- disabled state and optional disabled reason
- loading state
- keyboard focus state
- hover / pressed states
- accessible name and focus-visible outline

Behavior:

- Entire card is a clickable target.
- Use pointer cursor only when enabled.
- Hover should be subtle (slight elevation or border emphasis), not a large movement.
- Focus must be visible for keyboard users.
- Do not make decorative icon/text elements separate confusing click targets.
- On mobile, cards should become a 1-column or 2-column grid depending on available width.

## 8. Navigation behavior

- Desktop: use a persistent left sidebar as the primary navigation. Avoid also showing a full duplicate bottom navigation on desktop.
- Tablet: sidebar may collapse to icon rail or a compact drawer.
- Mobile: use a fixed bottom navigation with a small number of high-frequency destinations (e.g. Home, Reception, Rooms, Reservations, More). Ensure content has bottom padding so it is not obscured.
- Keep global search and account controls accessible at appropriate breakpoints.
- Active navigation item must be visually distinct and include accessible state.

## 9. Hybrid modal system

Choose presentation based on task size and context:

| Task                                          | Preferred presentation                                     |
| --------------------------------------------- | ---------------------------------------------------------- |
| Confirm a destructive action                  | Small confirmation dialog                                  |
| Edit a few guest fields                       | Medium dialog                                              |
| Register a payment                            | Medium / large dialog                                      |
| Assign a room while viewing room availability | Wide drawer or large dialog that preserves context         |
| View reservation details                      | Right-side drawer                                          |
| Multi-step check-in                           | Large stepper dialog or dedicated page if the flow is long |
| Create a complex reservation                  | Dedicated page                                             |
| Complex guest profile / history               | Drawer or dedicated page                                   |

Modal requirements:

- Clear title and optional short description.
- Close control with accessible label.
- Consistent header, content, and footer regions.
- Primary and secondary actions in predictable locations.
- Sticky footer for long forms.
- Inline validation next to fields.
- Loading, success, empty, and error states.
- Warn before discarding unsaved changes.
- Focus trap, Escape behavior where safe, focus restoration, and keyboard navigation.
- On mobile, large dialogs should become full-screen sheets/pages.
- Never place a long, complex workflow inside a cramped small dialog.

## 10. Operational UX and reliability

- Show a clear network state: Online, Offline, Syncing, Sync failed.
- Do not imply an action has been saved until the server confirms it or the UI clearly labels it as queued offline.
- Use explicit confirmation for consequential actions (room assignment, check-in/out, payment, cancellation).
- Preserve user-entered form data when safe after recoverable errors.
- Prevent double submission and provide idempotent operation feedback.
- For room assignment, the backend must enforce conflict prevention; a visual lock alone is not sufficient.
- Keep audit-sensitive actions traceable.

## 11. Accessibility and responsive behavior

- Meet WCAG AA contrast targets for text and controls.
- Never use color as the only status signal.
- Support keyboard navigation and visible focus.
- Provide labels and error text for all inputs.
- Respect reduced-motion preferences.
- Use touch targets around 44 x 44 px minimum on touch devices.
- Test desktop, tablet, and mobile breakpoints.

## 12. Implementation rules

- Inspect the existing codebase and component library before changing dependencies.
- Reuse existing architecture, routing, API contracts, and design tokens where possible.
- Build shared tokens and primitives before duplicating page-specific styling.
- Do not introduce a second UI library without a documented reason.
- Keep business logic out of presentational components.
- Do not replace real backend data with hardcoded arrays.
- Add tests for navigation, modal behavior, form validation, and primary quick actions.
- Capture screenshots at desktop and mobile breakpoints after implementation.
