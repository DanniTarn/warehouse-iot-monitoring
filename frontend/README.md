# Giám sát kho · Frontend

Milestone **15/10/2026**: all nine supplied screen variants, typed mock reads, demonstration sessions and role guards. The implementation uses the team's handoff in `../docs/frontend-handoff/`.

## Run

Use Node.js 22.12 or later (verified with Node 26.8.1) and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend or hardware is required.

```sh
npm run build
npm run lint
npm test
```

## Demonstration accounts

These are development fixtures, not real credentials. All use password `demo123`.

| Username | Role |
|----------|------|
| `admin` | ADMIN |
| `operator01` | OPERATOR |
| `viewer01` | VIEWER |

A demo token is kept in memory and `sessionStorage`. Refresh restores the session through the mock `me` method. Logout clears it. This is not production authentication or a backend security boundary.

## What works in this milestone

- Login, logout, session restoration and role guards.
- All nine designs: login, overview, devices, registration, environment detail, security detail, alerts, history and users.
- Sidebar active state, direct URL 403 states and Admin only audit navigation.
- Three static Recharts plots with synchronized hover, separate axes, thresholds and 1/6/24 hour display ranges.
- Local search, lifecycle and warehouse filters, alert filters, history tabs and fixture date filters, local pagination, editable form previews and config Undo.
- Vietnamese formatting, live relative heartbeat labels, loading/error/empty states and keyboard focus.
- Responsive layout at 1440px and 375px. Tables scroll inside their cards.

All readings, device state, alerts, command history, audit records and accounts are mock data. The footer identifies the demonstration. Heartbeat age ticks but new heartbeats and telemetry are not emitted in this milestone. The historical snapshot is 13/10/2026. The default history range follows that fixture so its rows remain visible.

Buttons for hardware commands, alert acknowledgement, registration, activation, lifecycle changes, token rotation, saved config, account creation, role changes and CSV export explain their scheduled milestone. They do not claim to send a command or save a mutation. Form fields can be explored without changing fixtures. No token is generated.

## Configuration

Copy `.env.example` to `.env` if needed. `.env` and local variants are ignored. Every `VITE_` value is public browser configuration, never a secret.

| Variable | Example | Status |
|----------|---------|--------|
| `VITE_DATA_SOURCE` | `mock` | Only supported value for 15/10; default when unset |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Reserved for REST integration on 20/10 |
| `VITE_WS_URL` | `ws://localhost:3000/ws` | Reserved for native WebSocket integration on 20/10 |
| `VITE_MQTT_WS_URL` | `wss://broker.hivemq.com:8884/mqtt` | Reserved for the optional read only MQTT adapter on 20/10 |

`api` and `mqtt-dev` deliberately show an unsupported source message in this milestone. No backend, broker or hardware connections are opened. Google Fonts loads the two reference font families; system fallbacks apply without Internet access.

## Layout and future integration

```text
src/
  assets/                 exact design tokens and base CSS
  components/common/      shell, semantic UI primitives, icons and tables
  components/charts/      Recharts small multiples
  components/control/     fan and configuration previews
  pages/                  route screens with CSS Modules
  services/types.ts       ERD types, snake_case API fields
  services/api.ts         typed mock boundary and source selection
  services/api.mock.ts    all sample records, demo login and read methods
  services/config.ts      open question defaults and device kind helper
  services/format.ts      vi-VN and Asia/Ho_Chi_Minh formatting
  store/                  Zustand session and dashboard read state
  test/                   Testing Library setup
```

On 20/10, add `services/http.ts`, `services/api.real.ts` and realtime adapters from handoff §7. Keep every REST path in `api.real.ts` when the backend contract arrives. Extend the `ApiClient` interface and select the implementation in `api.ts`; pages should never import `api.mock.ts`. Add mutation methods and event driven state in the corresponding later milestones.

The supplied handoff is the architecture authority. The local [scope](docs/scope/scope.md) and [implementation spec](docs/specs/0001-basic-ui.md) record the 15/10 boundary inside `frontend/`, respecting the restriction on editing team docs.

## Open questions encountered

| Handoff §11 | Default used |
|-------------|--------------|
| 1, device codes | `NODE1_ENV` and `NODE2_SEC` in `MONITORING` |
| 2, smoke units/domain | `ppm`, threshold 300, domain 0–400 in `MONITORING.smoke` |
| 3, payload names | ERD names in TypeScript; firmware mapping deferred with MQTT |
| 4, `FAN_AUTO` | Included in `CommandType`; no command is sent |
| 5, proposed alert types | `HUMIDITY_HIGH` and `DEVICE_OFFLINE` included in `AlertType` |
| 7, offline timeout | 90 seconds recorded in `MONITORING`, enforcement deferred |
| 8, night mode hours | Boolean form only; no invented curfew window |
| 9, device type | `getDeviceKind` derives known suffixes and returns unknown otherwise |
| 6 and 10, integration contracts | No hardware command payload or real REST/WebSocket contract assumed to be live |

## Verified milestone

On 14/10/2026, `npm run build`, `npm run lint` and all **37 tests** passed. Browser verification covered all nine designs at 1440px and 375px, including internal table scrolling, all three roles, direct URL denials, session refresh/logout, search empty state, configuration Undo and deferred action feedback. A fixture wiring issue found during verification was fixed and the build and tests were rerun successfully.

The test suite covers session boundaries, role restrictions, protected routes, formatting, missing devices in search, deferred action honesty and retry after a failed read. Real MQTT, command timeout/acknowledgement and alert mutation tests belong to later milestones and are not claimed here.

## Dependency note

The handoff explicitly requires React Router v6. The exact v6 release `6.30.6` is pinned. At verification, npm audit reported two moderate package entries for React Router, covering an open redirect and SSR hydration advisory, with a fix available only on v7. This client rendered prototype uses internal constant routes, numeric device IDs and no SSR hydration. A future production upgrade or v6 patch needs team agreement; this implementation does not silently change the specified major version.

ESLint 9 is pinned for compatibility with its React TypeScript configuration; npm reports that major as no longer supported. Build, lint and tests remain functional. The repository contains only demonstration credentials and public browser configuration.
