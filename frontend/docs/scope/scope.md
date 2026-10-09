# Scope: Giám sát kho

Build the warehouse monitoring frontend for the team's 15/10/2026 checkpoint. The supplied handoff and nine HTML designs are the approved specification.

**Build approach:** Facade (all screens on typed mock data before backend integration).
**Workflow:** Alpha, with browser verification and the handoff's build, lint, and test checks.
**Boundary:** Application work stays in `frontend/`. This scope lives here to respect the handoff's restriction on repository docs edits. The user authorized committing this version and opening a pull request on 14/10/2026, superseding the handoff's initial no-commit instruction.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Scaffold, typed mock data, tokens and shared shell | Foundation | done |
| 2 | Sign in, session and role guards | 15/10 | done |
| 3 | Overview and both device detail screens | 15/10 | done |
| 4 | Device list, registration, alerts, history and users | 15/10 | done |
| 5 | Responsive and role verification | 15/10 | done |
| 6 | Realtime and backend integration | 20/10, deferred | planned |
| 7 | Commands, alert actions and offline handling | 24/10, deferred | planned |
| 8 | Saved administration, configuration and exports | 29/10, deferred | planned |

## Current milestone

### 1. Scaffold, typed mock data, tokens and shared shell · done
Make the supplied stack runnable and share the design language across routes.
**Done when:** exact versions are pinned, typed mock reads work without a backend, and the shell matches the reference.
- [x] Design it (spec): use the supplied handoff, captured in [0001](../specs/0001-basic-ui.md).
- [x] Build it: `/develop frontend foundation`
- [x] Verify it: `/check verify frontend foundation`

### 2. Sign in, session and role guards · done
Demonstrate all three roles with a session that survives refresh.
**Done when:** login, logout, route guards, and the Admin 403 state work.
- [x] Build it: `/develop frontend session`
- [x] Verify it: `/check verify frontend session`

### 3. Overview and both device detail screens · done
Show the incident, sensor readings, charts, controls and configuration forms.
**Done when:** the three screens match the supplied composition and show role dependent controls on mock data.
- [x] Build it: `/develop monitoring screens`
- [x] Verify it: `/check verify monitoring screens`

### 4. Device list, registration, alerts, history and users · done
Render the remaining reference screens with usable navigation and local display filters.
**Done when:** each route and history tab is reachable, and data tables have empty states.
- [x] Build it: `/develop administration screens`
- [x] Verify it: `/check verify administration screens`

### 5. Responsive and role verification · done
Prove the milestone at desktop and phone widths.
**Done when:** build, lint and tests pass; all nine screens render at 1440px and 375px; tables scroll within their containers; role gates pass for every account.
- [x] Verify it: `/check verify milestone 15/10`

## Deferred

### 6. Realtime and backend integration · planned
The 20/10 milestone owns WebSocket, MQTT, live chart updates and real API paths.
- [ ] `/develop milestone 20/10`

### 7. Commands, alert actions and offline handling · planned
The 24/10 milestone owns command acknowledgement, alert mutations and connection recovery.
- [ ] `/develop milestone 24/10`

### 8. Saved administration, configuration and exports · planned
The 29/10 milestone owns device lifecycle and token actions, user mutations, saved config, API history filtering, CSV and related tests.
- [ ] `/develop milestone 29/10`

Status: planned means queued, in-progress means being built, done means the milestone checks passed. Later milestones remain deferred even when their controls are visible.

Verification on 14/10/2026: build and lint passed, 37 tests passed. All nine screens rendered at 1440px and 375px with no page overflow. Browser checks covered role guards, session refresh/logout, filters, configuration Undo and deferred action notices. Work stops at milestone 15/10.
