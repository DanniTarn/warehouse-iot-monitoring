# Giám sát kho · Frontend

Vite, React and TypeScript single-page app. The interface is built on Tailwind CSS v4 with shadcn components in `src/components/ui`, plus app-level pieces in `src/components/app`. Charts use Recharts. State is Zustand; routing is React Router. The design layer was rebuilt on shadcn while the data layer in `src/services` and `src/store` stayed unchanged.

Milestone **15/10/2026** supplied the nine screen variants and role guards. The `api` source reads the running Express backend over REST and WebSocket; `mock` remains for tests and offline demos.

## Run

Use Node.js 22.12 or later (verified with Node 26.8.1) and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. The default mock source needs no backend. The `api` source needs the backend described in [Configuration](#configuration).

```sh
npm run build
npm run lint
npm test
```

## Demonstration accounts

These are development fixtures, not real credentials. All use password `demo123`. The `api` source signs in with the accounts in the backend database instead.

| Username | Role |
|----------|------|
| `admin` | ADMIN |
| `operator01` | OPERATOR |
| `viewer01` | VIEWER |

The selected source keeps its token in memory and `sessionStorage`. A refresh restores the session with `GET /auth/me` in api mode or the mock `me` method in mock mode. Logout clears it. This is not production authentication or a backend security boundary.

## What works in this milestone

- Login, logout, session restoration and role guards.
- All nine designs: login, overview, devices, registration, environment detail, security detail, alerts, history and users.
- Sidebar active state, direct URL 403 states and Admin only audit navigation.
- Three Recharts plots with independent hover, separate axes, thresholds and 1/6/24 hour display ranges.
- Local search, lifecycle and warehouse filters, alert filters, history tabs and date filters, local pagination, editable form previews and config Undo.
- Vietnamese formatting, live relative heartbeat labels, loading/error/empty states and keyboard focus.
- Responsive layout at 1440px and 375px. Tables scroll inside their cards.

With the default `mock` source, all readings, device state, alerts, command history, audit records and accounts are fixtures. The footer says the data is simulated. With `VITE_DATA_SOURCE=api`, reads come from the backend and telemetry, alert, command and device status events arrive over the WebSocket. The footer says the data is live. Mock mode emits no new telemetry. History defaults to today in Asia/Ho_Chi_Minh, so the 13/10/2026 fixtures need the date inputs changed.

Buttons for hardware commands, alert acknowledgement, registration, activation, lifecycle changes, token rotation, saved config, account creation, role changes and CSV export explain their scheduled milestone. They do not claim to send a command or save a mutation. Form fields can be explored without changing fixtures. No token is generated.

## Configuration

Copy `.env.example` to `.env` if needed. `.env` and local variants are ignored. Every `VITE_` value is public browser configuration, never a secret.

| Variable | Example | Status |
|----------|---------|--------|
| `VITE_DATA_SOURCE` | `mock` | `mock` (default when unset) or `api` |
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Express API base for the `api` source |
| `VITE_WS_URL` | `ws://localhost:3000/ws` | WebSocket base; the client appends the JWT as `token` |
| `VITE_MQTT_WS_URL` | `wss://broker.hivemq.com:8884/mqtt` | Reserved for the optional read only MQTT adapter |

`api` reads the running backend. `mqtt-dev` still shows an unsupported source message. Google Fonts loads the two reference font families; system fallbacks apply without Internet access.

## Layout and future integration

```text
src/
  assets/                 exact design tokens and base CSS
  components/common/      shell, semantic UI primitives, icons and tables
  components/charts/      Recharts small multiples
  components/control/     fan and configuration previews
  pages/                  route screens with CSS Modules
  services/types.ts       ERD types, snake_case API fields
  services/api.ts         typed API boundary and source selection
  services/api.mock.ts    all sample records, demo login and read methods
  services/api.real.ts    REST reads against the backend contract
  services/http.ts        fetch, JSON parsing and typed HTTP errors
  services/dashboardView.ts derived fan, buzzer, LED and security presentation
  services/realtime.ts    WebSocket stream, frame parsing and reconnect backoff
  services/config.ts      open question defaults and device kind helper
  services/format.ts      vi-VN and Asia/Ho_Chi_Minh formatting
  store/                  Zustand session and dashboard read state
  test/                   Testing Library setup
```

`api.ts` selects `api.mock.ts` or `api.real.ts`; pages never import either adapter directly. `http.ts` owns transport and error mapping, `api.real.ts` owns the REST reads, `dashboardView.ts` derives presentation from loaded data, and `realtime.ts` owns the socket and reconnect policy. Commands, acknowledgements and configuration writes remain deferred.

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
