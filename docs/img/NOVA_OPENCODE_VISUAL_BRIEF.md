# NOVA PMS — OpenCode Visual Implementation Brief
Version: 1.0  
Priority: Dashboard visual foundation, then Reception.

## Objective

Use the supplied image references and `NOVA_DESIGN_SYSTEM.md` to improve the current NOVA PMS UI/UX. The target is a polished, production-quality hotel PMS interface with a Light SaaS style, balanced information density, large pastel quick-action cards, and a hybrid modal system.

## Reference files

- `01-user-reference-dashboard.png`: user's preferred example. Pay particular attention to the spacious KPI cards, large pastel quick actions, icon scale, rounded white panels, and readable text.
- `02-nova-dashboard-concept.png`: a proposed NOVA visual direction. Use as inspiration for hierarchy, app shell, and operational dashboard layout.
- `NOVA_DESIGN_SYSTEM.md`: source of truth for tokens, layout, navigation, quick actions, modal patterns, and implementation rules.

## Important interpretation

The references are visual direction, not permission to fabricate functionality. Sample guest names, counts, dates, weather, room numbers, and payment states are illustrative only. Connect to existing data/API or use clearly labeled development fixtures.

The generated concept shows both a sidebar and a bottom navigation. Do not render both as duplicate primary navigation on desktop:
- Desktop: sidebar.
- Mobile: bottom navigation.
- Tablet: collapsed sidebar or responsive drawer.

## Implementation sequence

### Phase 0 — Inspect before coding
1. Inspect repository structure, framework, routes, current design system, existing components, and API integration.
2. Identify the current Dashboard and Reception routes.
3. Identify existing modal/dialog/drawer implementations and their pain points.
4. Report a concise implementation plan and any architectural risks.
5. Do not replace dependencies or restructure the app without a reason.

### Phase 1 — Design foundations
Implement or normalize:
- Color and semantic tokens.
- Typography scale.
- Spacing, radius, border, shadow tokens.
- Buttons, inputs, badges, cards, icon wrappers.
- Responsive app shell.
- Shared page headers and section headers.
- Shared loading, empty, error, and offline states.

### Phase 2 — Dashboard
Build the Dashboard with this hierarchy:
1. App shell: brand/property, sidebar on desktop, global search, notifications, user menu, connection state.
2. Welcome header with greeting and hotel operational date.
3. KPI cards: occupancy, arrivals, departures, available rooms.
4. Large Quick Actions grid:
   - Check-in (blue pastel).
   - Assign room / Room Rack (mint pastel).
   - New reservation (lavender pastel).
   - Register payment (warm pastel).
5. Operational lists:
   - Today's arrivals.
   - Today's departures.
   - Alerts / tasks.
6. Optional NOVA Academy/help card as a secondary element.

KPI cards should have prominent values and concise labels. Avoid meaningless decorative graphs. Show trend indicators only when backed by actual data.

Quick-action cards:
- Use a large icon (approximately 28–36 px depending on component scale).
- Include title and one-line description.
- Entire card is interactive.
- Use subtle hover, pressed, disabled, loading, and keyboard-focus states.
- Use responsive grid behavior.
- Keep color pastel and restrained.

### Phase 3 — Hybrid modal foundation
Create a consistent shared modal/drawer API and styles. Do not create unrelated one-off modal designs.

Implement:
- Small confirmation dialog.
- Medium form dialog.
- Large workflow dialog / stepper.
- Right-side detail drawer.
- Responsive full-screen presentation on mobile for complex flows.

All dialogs must have:
- Consistent title/header/content/footer.
- Predictable close and cancel actions.
- Sticky footer for long forms.
- Inline validation and error states.
- Loading and disabled submit states.
- Unsaved-changes warning when appropriate.
- Accessible focus handling and keyboard support.

### Phase 4 — Reception
Prioritize practical front-desk workflows:
- Arrivals list and pending check-ins.
- Search reservation / guest.
- Guest identity and reservation summary.
- Room assignment with visible availability and room status.
- Payment / deposit context where applicable.
- Check-in confirmation and clear result state.

Use a stepper or dedicated page for a long check-in process. Use a wide drawer or large dialog for room assignment only if the user can still understand the current reservation and room context.

Room assignment must not rely only on client-side state. Preserve the backend/database conflict-prevention guarantees: revalidate availability atomically at commit and communicate conflicts clearly.

### Phase 5 — Other modules (after Dashboard and Reception approval)
Extend the same design language to:
- Room Rack / Rooms.
- Reservation Calendar.
- Guest profiles.
- Cashier / Folios.
- Reports.
- NOVA Academy.

Do not start these modules until Dashboard and Reception have been reviewed.

## Acceptance criteria

### Dashboard
- [ ] Matches the approved Light SaaS direction.
- [ ] Large, readable KPI cards.
- [ ] Large pastel quick-action cards with clear labels and icons.
- [ ] Quick actions navigate to real routes or trigger real implemented workflows.
- [ ] Arrivals, departures, and alerts have clear hierarchy.
- [ ] No fabricated production data.
- [ ] Desktop sidebar and mobile bottom navigation behave responsively.
- [ ] Loading, empty, error, and offline states are designed.

### Modals and drawers
- [ ] One consistent visual system across all dialogs.
- [ ] Presentation type matches task complexity.
- [ ] Form validation appears next to the relevant field.
- [ ] Long forms have a usable sticky footer.
- [ ] Unsaved changes are protected.
- [ ] Keyboard and focus behavior work.
- [ ] Mobile dialogs adapt to full-screen where needed.

### Reception
- [ ] The main front-desk tasks are easy to find.
- [ ] Check-in flow is understandable and not cramped.
- [ ] Room assignment exposes room status and availability.
- [ ] Assignment conflicts are handled with a clear recoverable message.
- [ ] Actions show pending/success/failure feedback.

### Quality
- [ ] Existing business logic and API contracts remain intact unless changes are justified.
- [ ] No duplicate primary navigation on desktop.
- [ ] Responsive screenshots captured for desktop and mobile.
- [ ] Tests run and results reported.
- [ ] Remaining gaps are listed honestly.

## First task for OpenCode

Start with Phase 0. Inspect the project and report:
1. Existing Dashboard and Reception routes/components.
2. Existing modal/dialog/drawer components.
3. Design tokens and UI library in use.
4. Proposed files/components to change.
5. Risks or missing API/data needed.

Then implement the foundations and Dashboard. Do not proceed to the full Reception redesign until the Dashboard is ready for review.

## Prompt to run

Read `NOVA_DESIGN_SYSTEM.md`, `NOVA_OPENCODE_VISUAL_BRIEF.md`, and inspect both PNG references. First inspect the current codebase and propose a focused plan. Then implement the shared visual foundations and Dashboard according to the approved direction. Prioritize large pastel quick-action cards, readable operational KPI cards, a clean app shell, and a consistent hybrid modal foundation. Preserve existing architecture and backend contracts. Do not fabricate production data or implement nonfunctional controls. Capture desktop and mobile screenshots, run relevant tests, and report what changed and what remains. Stop for review before redesigning the remaining modules.
