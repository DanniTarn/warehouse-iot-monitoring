# Frontend handoff: Warehouse monitoring web dashboard

Build the web dashboard for the IoT warehouse monitoring project in the team repo's `frontend/` folder. This document holds everything that has been decided. Where something is not decided, it says so and tells you which assumption to make.

- **Team repo:** https://github.com/DanniTarn/warehouse-iot-monitoring
- **Design source:** `./design/*.dc.html` in this folder: 9 screens, see §3.
- **Owner:** "Người 3", the frontend member of a 4-person university team. They must be able to explain and defend every line in the final presentation.

---

## 0. Rules for this job

1. **Work only inside `frontend/`.** Do not modify `backend/`, `firmware/`, `database/`, `deployments/` or `docs/`. The repo already has empty folders: `frontend/public`, `frontend/src/{assets,components/{charts,common,control},pages,services,store}`. Use them, and delete their `.gitkeep` files once real files exist.
2. **Do not commit or push.** The course requires each member to commit with their own GitHub account, so leave all changes uncommitted for the owner to review and commit.
3. **Never commit secrets.** No passwords, tokens or keys. Put config in `.env` (gitignored) and document every variable in `frontend/.env.example`.
4. **Keep the code simple enough for a student to explain.** Use plain React patterns, no clever abstractions, and a short comment wherever the reason is not obvious.
5. **Write the UI copy in Vietnamese, exactly as in the design files.** Keep code identifiers, enum values, device codes and DB field names in English or ASCII, exactly as given here.
6. **Mock first.** The backend API does not exist yet. Build every screen against a typed API layer with a mock implementation (§7), so the whole app runs with `npm run dev` and no backend.

## 1. Context

**Product:** "Hệ thống giám sát môi trường và an ninh kho hàng" (warehouse environment and security monitoring).

**Pipeline:** ESP32 → MQTT → Backend (JWT auth, rule engine) → PostgreSQL → this dashboard. The dashboard talks only to the backend, over HTTPS/REST plus a WebSocket for live updates.

**Two hardware nodes:**

| Device code | Role | Sensors | Actuators |
|---|---|---|---|
| `NODE1_ENV` | Environment | DHT22 (temperature °C, humidity %), MQ-2 (smoke/gas) | Relay 5V → mini fan |
| `NODE2_SEC` | Security | MC-38 door contact (open/closed), HC-SR501 PIR (motion) | Buzzer, multi-colour LED |

**Automatic behaviour (runs in the backend or firmware, not the frontend):**
- Humidity above the configured threshold (default 65 %) turns the fan on.
- High smoke on Node 1 makes the backend trigger the buzzer and red LED on Node 2.
- Door opened or motion detected outside working hours (night mode) raises an intrusion alert, sounds the buzzer locally, and must show a **red alarm banner** on the dashboard.

**Team deadlines (2026)** map to the milestones in §10:

| Date | Milestone |
|---|---|
| 15/10 | Basic UI |
| 20/10 | Device → dashboard flow working end to end |
| 24/10 | Control, alerts and offline handling |
| 29/10 | All required features done |
| 01/11 | Product freeze |

## 2. Stack

| Concern | Choice |
|---|---|
| Build | Vite + React 18 + TypeScript |
| Routing | React Router v6 |
| State | Zustand (use `src/store/`) |
| Charts | Recharts |
| HTTP | `fetch` wrapper in `src/services/http.ts` (no axios) |
| Realtime | Native `WebSocket` to the backend; optional dev-only `mqtt` (mqtt.js) adapter, §7.4 |
| Styling | Plain CSS with CSS custom properties (§4) and CSS Modules per component. No Tailwind or UI kit. |
| Tests | Vitest + @testing-library/react |
| Lint | ESLint (Vite React TS template defaults) |

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm test`. Pin exact versions in `package.json`.

## 3. Design reference

`./design/` holds the high-fidelity screens. Each `.dc.html` file is a mockup format, not production code. Read them for layout, exact sizes, colours, copy and behaviour:

- Markup inside `<x-dc>` is the screen. The inline `style="…"` values are the exact spacing, sizes, radii and colours to reproduce.
- `{{name}}` is a value computed in the `<script type="text/x-dc">` block at the bottom (`renderVals()`). That block also holds the sample data and the interaction logic, such as role gating, command PENDING → ACKNOWLEDGED, and filters. Treat it as a behaviour reference.
- `<sc-for list="{{rows}}" as="r">` means map over a list; `<sc-if value="{{x}}">` means render conditionally.
- `data-props` in the script tag lists the states each screen can show. `role` (ADMIN/OPERATOR/VIEWER) and `incident` (alarm on/off) are the important ones.
- Ignore `<helmet>`, `support.js`, `DCLogic` and `hint-*` attributes; they belong to the mockup tool.

| Design file | Route | Screen |
|---|---|---|
| `Login.dc.html` | `/login` | Đăng nhập |
| `Main.dc.html` | `/` | Tổng quan (overview) |
| `Devices.dc.html` | `/devices` | Thiết bị (device list) |
| `DeviceAdd.dc.html` | `/devices/new` | Thêm thiết bị (Admin only) |
| `DeviceDetail.dc.html` | `/devices/:deviceId` when the device is an environment node | Chi tiết & điều khiển (Node 1) |
| `DeviceDetailSec.dc.html` | `/devices/:deviceId` when the device is a security node | Node 2 · An ninh |
| `Alerts.dc.html` | `/alerts` | Cảnh báo |
| `History.dc.html` | `/history?tab=telemetry\|commands\|audit` | Lịch sử |
| `Users.dc.html` | `/users` (Admin only) | Người dùng |

**Choosing the device detail variant:** the ERD has no device-type column yet. Use `device_code.endsWith('_ENV')` for environment and `endsWith('_SEC')` for security, behind a single `getDeviceKind(device)` helper so it is easy to swap later.

## 4. Design tokens

Put these in `src/assets/tokens.css` as CSS custom properties and use them everywhere. No raw hex values in components.

```css
:root {
  /* surfaces */
  --bg-page: #EEF1F4;
  --surface: #FFFFFF;
  --surface-muted: #F6F8FA;   /* table header */
  --border: #D9DFE6;          /* card border */
  --divider: #E3E8ED;         /* row separators */
  --input-border: #A9B4C0;
  --axis: #B9C2CC;            /* chart baseline */
  --grid: #E3E8ED;            /* chart gridlines */

  /* ink */
  --ink: #101A26;
  --ink-2: #45525F;           /* secondary text */
  --ink-3: #5E6B78;           /* muted: codes, timestamps, axis labels */

  /* sidebar */
  --nav-bg: #101A26;
  --nav-text: #C4CEDA;
  --nav-muted: #9FB0C3;
  --nav-active-bg: #22344A;
  --nav-divider: #2A3A4D;
  --nav-chip-border: #4A5D73;

  /* accent */
  --accent: #1B5FCC;
  --accent-hover: #134A9F;
  --accent-soft: #F0F5FD;     /* selected card background */

  /* status: always pair with an icon or label, never colour alone */
  --good-fg: #0B6B2E;      --good-bg: #E0F2E5;
  --warn-fg: #6E4200;      --warn-bg: #FFEFC7;   --warn-text: #8A5300; /* warning text on white */
  --crit-fg: #8F1D17;      --crit-bg: #FBE4E2;   --crit-solid: #B3261E; /* alarm banner, danger button */
  --info-fg: #134A9F;      --info-bg: #DCE8FA;
  --neutral-fg: #45525F;   --neutral-bg: #E6EAEF;

  /* chart series (validated for colour-vision deficiency on white) */
  --series-temp: #eb6834;
  --series-humidity: #2a78d6;
  --series-smoke: #4a3aa7;

  /* type */
  --font-ui: 'Be Vietnam Pro', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* radii */
  --r-card: 10px; --r-control: 8px; --r-badge: 6px;
}
```

**Fonts:** load from Google Fonts in `index.html`: Be Vietnam Pro 400/500/600/700 and JetBrains Mono 400/500/600.
- Be Vietnam Pro is for all UI text.
- JetBrains Mono is for sensor values, device codes, enum badges, timestamps, IPs, MACs and axis labels.

**Type scale:**

| Element | Size and weight |
|---|---|
| Body | 14px / 1.45 |
| Page title (h1) | 24px / 700 |
| Card title | 16px / 600 |
| Big reading | 30px mono 600 |
| Small label | 12–13px |

**Layout:**
- **Page:** padding `24px 28px 32px`, 20px gap between sections, 16px gap inside grids. Cards have a 1px `--border`, `--r-card` radius and 16px 18px padding.
- **App shell:** a flex row that wraps. The sidebar is `flex: 1 1 232px`; main is `flex: 999 1 560px; min-width: 0`. Below about 800px the sidebar stacks on top; it is never `position: fixed` and never `100vh` tall.
- **Responsive grids:** `repeat(auto-fit, minmax(min(<min>px, 100%), 1fr))`.
- **Wide tables:** sit inside an `overflow-x: auto` box.
- **Hit targets:** at least 44px tall for buttons, nav links and table actions.
- **Focus:** `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px }`.

**Icons:** inline stroke SVGs at 24 × 24 viewBox with `stroke-width: 1.8`, copied from the design files: overview, devices, bell, clock, users, warehouse mark, warning triangle, critical octagon, info circle and check. Put them in `src/components/common/Icon.tsx`. No emoji and no icon font.

**Locale (`src/services/format.ts`):**
- Use `vi-VN` formatting with a decimal comma (`28,4`), 24-hour time, `dd/MM/yyyy`, timezone `Asia/Ho_Chi_Minh`.
- Units: temperature `°C`, humidity `%`, smoke `ppm` (unconfirmed, see §11).
- Relative heartbeat text: "Heartbeat N giây trước" / "N phút trước" / "N giờ trước". Tick every second.

## 5. Roles and permissions

Hide or disable controls in the UI by role, but the backend is the real enforcer: handle a `403` everywhere.

| Capability | VIEWER | OPERATOR | ADMIN |
|---|---|---|---|
| Log in; view overview, devices, sensor data, charts, history (telemetry and commands) | ✓ | ✓ | ✓ |
| Acknowledge alerts ("Xác nhận đã xử lý") | – | ✓ | ✓ |
| Control devices (fan mode, mute buzzer) and edit device config | – | ✓ | ✓ |
| Add device, activate, rotate token, maintenance, decommission | – | – | ✓ |
| Manage users (create, change role, lock/unlock) | – | – | ✓ |
| View audit log (History → "Nhật ký thao tác") | – | – | ✓ |

**UI rules:**
- **Viewer:** control buttons are disabled, with the note "Tài khoản Viewer chỉ có quyền xem…" (copy in the design).
- **Admin-only things:** hidden entirely for other roles. That covers the nav item "Người dùng", the "Thêm thiết bị" button, lifecycle buttons and the audit tab.
- **Direct URL to an admin route by a non-admin:** show the 403 state from `Users.dc.html` ("Bạn không có quyền xem trang này").
- **`403` from the API:** show a toast/inline error "Bạn không có quyền thực hiện thao tác này." and leave the UI state unchanged.
- **The Admin's own row** in Users cannot be locked or demoted.

## 6. Data model (TypeScript, from the team ERD)

Put these in `src/services/types.ts`. Field names follow the database (snake_case) so API responses map 1:1.

```ts
export type Role = 'ADMIN' | 'OPERATOR' | 'VIEWER';
export type LifecycleStatus = 'REGISTERED' | 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE' | 'DECOMMISSIONED';
export type CommandType = 'FAN_ON' | 'FAN_OFF' | 'FAN_AUTO' | 'BUZZER_OFF'; // FAN_AUTO: proposed, §11
export type CommandStatus = 'PENDING' | 'SENT' | 'ACKNOWLEDGED' | 'FAILED';
export type Severity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertType =
  | 'SMOKE_CRITICAL' | 'DOOR_BREACH' | 'MOTION_INTRUSION'
  | 'HUMIDITY_HIGH' | 'DEVICE_OFFLINE'; // last two: proposed, §11
export type AuditAction = 'LOGIN' | 'UPDATE_CONFIG' | 'MANUAL_CONTROL' | 'DECOMMISSION' | string;

export interface User {
  user_id: number; username: string; full_name: string; email: string | null;
  role: Role; is_active: boolean; created_at: string; last_login: string | null;
}
export interface Warehouse { warehouse_id: number; warehouse_name: string; location_address: string | null; }
export interface Device {
  device_id: number; device_code: string; device_name: string;
  warehouse_id: number | null; warehouse_name?: string;
  assigned_user_id: number | null; assigned_username?: string;
  mac_address: string; firmware_version: string | null; ip_address: string | null;
  lifecycle_status: LifecycleStatus;
  last_heartbeat: string | null;   // ISO 8601
  online: boolean;                 // computed by backend from last_heartbeat
  created_at: string;
}
export interface DeviceConfig {
  device_id: number;
  humidity_threshold: number | null;   // %
  smoke_gas_threshold: number | null;  // unit unconfirmed, §11
  telemetry_interval: number;          // seconds
  night_mode_enabled: boolean;
  updated_at: string;
}
export interface Telemetry {
  telemetry_id: number; device_id: number; device_code: string;
  temperature: number | null; humidity: number | null; smoke_gas_level: number | null;
  door_status: boolean | null;     // true = open
  motion_detected: boolean | null;
  recorded_at: string;
}
export interface DeviceCommand {
  command_id: number; device_id: number; device_code: string;
  user_id: number; username: string;
  command_type: CommandType; parameters: Record<string, unknown> | null;
  status: CommandStatus; sent_at: string; acknowledged_at: string | null;
}
export interface Alert {
  alert_id: number; device_id: number; device_code: string;
  alert_type: AlertType; severity: Severity; alert_message: string;
  is_acknowledged: boolean;
  resolved_by_user_id: number | null; resolved_by_username: string | null;
  created_at: string; resolved_at: string | null;
}
export interface AuditLog {
  log_id: number; user_id: number; username: string;
  action: AuditAction; ip_client: string | null; details: string | null; created_at: string;
}
```

## 7. Data layer

### 7.1 Structure

```
src/services/
  types.ts          # §6
  http.ts           # fetch wrapper: base URL, JWT header, JSON, 401/403 handling
  api.ts            # ApiClient interface + factory picking mock or real from env
  api.real.ts       # REST implementation (§7.2)
  api.mock.ts       # in-memory implementation seeded from the design sample data
  realtime.ts       # RealtimeSource interface + backend WebSocket implementation (§7.3)
  realtime.mock.ts  # emits Node 1 telemetry every 5 s, heartbeats every 30 s, command acks after ~1 s
  realtime.mqttDev.ts  # optional dev-only read-only adapter (§7.4)
  format.ts         # number, date and relative-time formatting
src/store/          # Zustand stores: auth, devices, telemetry (ring buffer per device), alerts, commands
```

`VITE_DATA_SOURCE` = `mock` (default) | `api` | `mqtt-dev`.
- `mqtt-dev` uses mock REST together with live telemetry from the public MQTT test broker.
- The UI never imports a mock directly; it goes through `api.ts` and `realtime.ts`.

### 7.2 REST API (proposed, Người 1 has not published one yet)

Keep every path in `api.real.ts` so it is a one-file change when the real contract arrives. Base: `VITE_API_BASE_URL` (e.g. `http://localhost:3000/api`). Auth: `Authorization: Bearer <jwt>`.

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` `{username,password}` | → `{ token, user: User }`. A wrong password shows the generic error "Sai tên đăng nhập hoặc mật khẩu." |
| GET | `/auth/me` | → `User`; used on app load |
| GET | `/devices` | → `Device[]` |
| GET | `/devices/:id` | → `Device` |
| POST | `/devices` (ADMIN) `{device_name, device_code, mac_address, warehouse_id, assigned_user_id}` | → `{ device: Device, auth_token: string }`. **The token is returned once; never store it in state longer than that screen.** |
| POST | `/devices/:id/activate` (ADMIN) | REGISTERED → ACTIVE |
| PATCH | `/devices/:id/lifecycle` (ADMIN) `{status:'MAINTENANCE'\|'ACTIVE'\|'DECOMMISSIONED'}` | |
| POST | `/devices/:id/token` (ADMIN) | Rotate → `{ auth_token }` (show once) |
| GET / PUT | `/devices/:id/config` | `DeviceConfig` |
| GET | `/telemetry?device_id&from&to&limit` | → `Telemetry[]`, newest first |
| GET | `/telemetry/latest` | → latest `Telemetry` per device |
| POST | `/devices/:id/commands` `{command_type, parameters?}` | → `DeviceCommand` (status `PENDING`) |
| GET | `/commands?device_id&from&to&limit` | → `DeviceCommand[]` |
| GET | `/alerts?status=open\|resolved&severity&device_id` | → `Alert[]` |
| POST | `/alerts/:id/acknowledge` | → `Alert` |
| GET | `/audit-logs?from&to&user_id` (ADMIN) | → `AuditLog[]` |
| GET / POST | `/users` (ADMIN) | Create body `{username, full_name, email?, role, password}` |
| PATCH | `/users/:id` (ADMIN) `{role?, is_active?}` | |
| GET | `/warehouses` | for selects |

**Error handling in `http.ts`:**
- **`401`:** clear the session and redirect to `/login`.
- **`403`:** throw a typed `ForbiddenError` that the UI shows as described in §5.
- **Network error:** show the inline error "Không kết nối được máy chủ." with a retry.

### 7.3 Realtime (proposed)

`VITE_WS_URL` (e.g. `ws://localhost:3000/ws?token=<jwt>`). Messages are JSON `{ "type": string, "data": … }`:

| type | data | UI effect |
|---|---|---|
| `telemetry` | `Telemetry` | Append to the per-device ring buffer (keep about 24 h at 5 s; downsample for charts); update tiles |
| `device_status` | `{ device_id, online, last_heartbeat, lifecycle_status }` | Update badges and heartbeat text |
| `alert_created` | `Alert` | Prepend to alerts; if CRITICAL and open, show the red banner |
| `alert_updated` | `Alert` | Update or move to resolved; remove the banner when no open CRITICAL remains |
| `command_status` | `DeviceCommand` | Update the command row and status line (PENDING → SENT → ACKNOWLEDGED / FAILED) |

**Reconnect:** exponential backoff of 1 s, 2 s, 4 s, then every 10 s. While disconnected, the "Trực tiếp" chip on the overview turns neutral and reads "Mất kết nối, đang thử lại…". After reconnecting, refetch `/telemetry/latest`, `/alerts?status=open` and `/devices`.

### 7.4 Dev-only MQTT adapter (`VITE_DATA_SOURCE=mqtt-dev`)

Người 2's firmware is already publishing real Node 1 data to the public test broker. This adapter lets the dashboard show it before the backend exists. **It is read-only: it must never call `publish`.** Sending commands straight from the browser would skip JWT, role checks and the audit log. On a public broker anyone could also send them, so commands always go through REST.

- **Broker:** `wss://broker.hivemq.com:8884/mqtt`, set in `VITE_MQTT_WS_URL`.
- **Subscribe:** `khohang/NODE1_ENV/telemetry`, `khohang/NODE2_SEC/telemetry`, `khohang/heartbeat`.
- **Firmware payloads** (the device does not send a timestamp; use receive time as `recorded_at`):

```jsonc
// khohang/NODE1_ENV/telemetry, every 5 s
{ "device_id": "NODE1_ENV", "temperature": 32.3, "humidity": 62.1, "smoke_level": 300 }
// khohang/NODE2_SEC/telemetry (planned)
{ "device_id": "NODE2_SEC", "door_open": 1, "motion_detected": 0 }   // 1 = open / motion
// khohang/heartbeat, every 30 s
{ "device_id": "NODE1_ENV", "status": "online" }
```

**Mapping into `Telemetry`:**
- `smoke_level` → `smoke_gas_level`
- `door_open` 0/1 → `door_status` boolean
- `motion_detected` 0/1 → boolean
- `device_id` (the code string) → `device_code`

Ignore malformed messages silently, logging them in dev only.

**Offline rule (until the backend computes it):** a device is offline when `now − last_heartbeat > 90 s`, i.e. three missed 30-second heartbeats.

## 8. Screens: what to build and how to accept it

All authenticated screens share `AppShell` (sidebar + main):
- **Sidebar:** brand, nav items (Tổng quan, Thiết bị, Cảnh báo with an open-alert count badge, Lịch sử, Người dùng for Admin only), and at the bottom the username, a role chip and "Đăng xuất".
- **Active nav item:** `aria-current="page"`.
- **Login:** the only screen outside the shell.

**Login (`/login`)**
- Split layout: a dark panel with the product statement and role descriptions, and the form card on the right.
- Fields have real `<label>`s. On submit, call `/auth/login`, store the token, and go to `/`. Show the generic error banner on failure and disable the button while the request runs.
- **Token storage:** keep it in memory and mirror it to `sessionStorage` so a refresh keeps the session. Logout clears both.
- **Mock users:** `admin`, `operator01` and `viewer01` with roles to match. Put the mock passwords in `api.mock.ts` and document them in the frontend README as dev-only values; they are not real credentials.

**Tổng quan (`/`)**
- **Header:** title, warehouse name, a "Trực tiếp" live chip, the last-update time, and a 1 giờ / 6 giờ / 24 giờ range switch (segmented buttons with `aria-pressed`).
- **Alarm banner:** shown while any CRITICAL alert is open. Background `--crit-solid`, `role="alert"`, a line with alert_type · device_code · time, a message, and buttons:
  - "Tắt còi" sends `BUZZER_OFF` to NODE2_SEC. Disabled when the buzzer is not sounding or the role is Viewer.
  - "Xác nhận đã xử lý" acknowledges the alert.
  - Viewers see the read-only note instead of buttons.
- **Five stat tiles**, each with label, sensor code, big value, unit and a status line (dot + text, status colour):
  - Nhiệt độ (DHT22)
  - Độ ẩm (DHT22) shows "Vượt ngưỡng 65 %" in warning style when above `humidity_threshold`.
  - Khói / khí gas (MQ-2)
  - Cửa kho (MC-38) shows "Mở" or "Đóng"; open during night mode is critical.
  - Chuyển động (HC-SR501)
- **Three charts as small multiples** (temperature, humidity, smoke), each in its own card with its own y-axis. Never use a dual axis. Per chart:
  - 2px line in the series colour, area fill at 10 % opacity, and an end dot with a 2px white ring.
  - Three gridlines and a baseline, y labels on the left, three x labels (start, middle, now).
  - A dashed threshold line from the device config (humidity 65, smoke 300) labelled "Ngưỡng 65 %" at the left.
  - **Hover crosshair synced across all three charts:** hovering one shows the crosshair, dot and a dark tooltip (time + value) on all three. Flip the tooltip left when past the midpoint.
  - The SVG has `role="img"` and an `aria-label` with the current value.
  - Y domains from the design: temperature 24–32, humidity 50–80, smoke 0–400. Widen a domain when data falls outside it.
- **Bottom row (three cards):**
  - **Điều khiển nhanh:** fan mode segmented Tự động / Bật / Tắt sending `FAN_AUTO` / `FAN_ON` / `FAN_OFF`, a fan state badge, and a command status line. Below that, the buzzer state badge and the "Tắt còi" button with a status line.
  - **Thiết bị:** a row per node linking to its detail page, with an online badge and live heartbeat text. Also night mode on/off and the LED state.
  - **Cảnh báo đang mở:** up to 5 open alerts (severity badge with icon, time, message, type · device) and a "Xem tất cả" link. Empty state: "Không có cảnh báo đang mở."

**Thiết bị (`/devices`)**
- Header with a summary ("N thiết bị · M đang online") and "Thêm thiết bị" (Admin) linking to `/devices/new`.
- **Lifecycle strip:** five cards (REGISTERED, ACTIVE, OFFLINE, MAINTENANCE, DECOMMISSIONED) with counts. Clicking one filters the table; clicking it again clears the filter (`aria-pressed`).
- **Toolbar:** search by name, code or MAC; warehouse select; an "Hiển thị x / y" count.
- **Table columns:** Thiết bị (name + code), Vòng đời badge, Kết nối (dot + Online / Offline / Chưa kết nối / Bị chặn + heartbeat text), Kho, Firmware, IP / MAC, Phụ trách, and an action link: "Chi tiết", or "Kích hoạt" for REGISTERED when Admin.
- Empty state when filters match nothing.
- **Badge colours:** REGISTERED info, ACTIVE good, OFFLINE crit, MAINTENANCE warn, DECOMMISSIONED neutral.

**Thêm thiết bị (`/devices/new`, Admin)**
- **Three-step strip:** Đăng ký → Nạp token vào firmware → Kích hoạt.
- **Form fields:** device_name, device_code (unique; uppercase, e.g. `NODE3_ENV`), mac_address (validate `^([0-9A-F]{2}:){5}[0-9A-F]{2}$`, case-insensitive), warehouse select, assigned user select, and a node type radio (Môi trường / An ninh). Show inline validation errors.
- **On success:** replace the form with the result card: the REGISTERED badge, the token in a dark mono box, a "Sao chép" button using `navigator.clipboard` with "Đã sao chép" feedback, and the warning "Token chỉ hiển thị một lần…". Also a link back to the list and "Thêm thiết bị khác".
- The right column explains the lifecycle states, as in the design.
- Non-admins get the 403 state.

**Device detail, environment (`/devices/:id`, `DeviceDetail.dc.html`)**
- **Header:** back link, name, code, lifecycle badge, online and heartbeat. Admin buttons: "Chuyển bảo trì", and "Thu hồi thiết bị" as a danger button that needs a confirm dialog saying the token is revoked and the device can no longer connect.
- **Left column:** an info list (Kho, Phụ trách, MAC, IP, Firmware, Đăng ký lúc, Heartbeat gần nhất, the token masked as `••••••••` plus its last 4 characters) and "Cấp lại token" (Admin, with confirm, shows the new token once). Below it, the sensors and actuators list.
- **Right column:**
  - Current readings, three tiles.
  - **Fan control:** segmented Tự động / Bật cưỡng chế / Tắt cưỡng chế, plus a state badge.
  - **Config form:**
    - Fields: humidity_threshold (0–100), smoke_gas_threshold (≥ 0), telemetry_interval (≥ 1, default 5 s), and the night_mode_enabled checkbox. Each field shows its DB field name in small mono under the input.
    - Save and Undo are enabled only when the form is dirty.
    - After saving, show "Đã lưu. Thao tác UPDATE_CONFIG được ghi vào nhật ký."
    - Viewers get disabled inputs and no buttons.
  - **Lệnh gần đây:** table of command rows; a new command appears at the top as PENDING and updates live.

**Device detail, security (`/devices/:id`, `DeviceDetailSec.dc.html`)**
- Same shell and left column. Sensors listed: MC-38, HC-SR501, Buzzer 5V, LED.
- **Four status tiles:** Cửa kho, Chuyển động, Còi báo động, Đèn LED.
- **"Điều khiển còi báo động" card:** the "Tắt còi" button (enabled only while the buzzer sounds), the triggering alert text, and a "Xem cảnh báo" link.
- **Config:** night_mode_enabled and telemetry_interval.
- **"Sự kiện an ninh gần đây" table:** time, sensor, event, alert badge or "—". Build it from NODE2 telemetry changes, plus alerts.
- **"Lệnh gần đây"** table.

**Cảnh báo (`/alerts`)**
- **Tabs:** Đang mở / Đã xử lý / Tất cả, with counts. Filters: severity and device.
- **Each row:** severity badge (icon + label, fixed width), message, `alert_type · device_code · dd/MM/yyyy HH:mm:ss`, and on the right:
  - "Xác nhận đã xử lý" for an open alert seen by Operator or Admin.
  - "Chưa xử lý" for an open alert seen by a Viewer.
  - "Đã xử lý bởi {user} · {time}" with a check icon once resolved.
- **Acknowledge:** optimistic update, rolled back on error.
- Footer: "Hiển thị x / y cảnh báo".

**Lịch sử (`/history`)**
- **Tabs:** Dữ liệu cảm biến, Lệnh điều khiển, and Nhật ký thao tác (Admin only). Keep the tab in the URL query.
- **Filters:** device select, Từ ngày / Đến ngày (`<input type="date">` with labels; default the last 7 days). "Xuất CSV" exports the current tab's filtered rows client-side.
- **Telemetry table:**
  - Columns: time, device, temperature, humidity, smoke (numbers right-aligned with `tabular-nums`), door, motion. Show "—" where a node has no such sensor.
  - Humidity above threshold in bold warning colour; door open in bold critical colour.
- **Commands table:** time, device, command, sender, status badge, ack time.
- **Audit table:** time, user, action (mono), IP, details. A denied action ("Bị từ chối (403)…") in bold critical colour.
- **Pagination:** "Mới hơn" / "Cũ hơn" buttons; 50 rows per page from the API.

**Người dùng (`/users`, Admin)**
- **Table:** Tài khoản (full name + `username · email`), Vai trò (inline select), Trạng thái badge (Hoạt động / Đã khóa), Đăng nhập gần nhất, and a "Khóa" / "Mở khóa" button.
- The Admin's own row is disabled and shows "Bạn".
- **"Tạo tài khoản" form** in the right column: username, full name, email (optional), role select, temporary password. Validate required fields and duplicate usernames. Show the success note "Đã tạo tài khoản {username}."
- **Role change and lock/unlock:** confirm first, then optimistic update with rollback on error.
- Non-admins get the 403 state.

## 9. Command flow (used by the fan and buzzer controls)

1. On click, call `POST /devices/:id/commands`. The control shows "{TYPE} · PENDING" and its buttons stay disabled until the command resolves.
2. Update from `command_status` realtime events: SENT, then ACKNOWLEDGED (show `acknowledged_at`) or FAILED.
3. If there is no ACKNOWLEDGED or FAILED after 10 s, show "Không nhận được phản hồi từ thiết bị" in warning style and re-enable the controls. Do not mark it FAILED locally; the backend owns the status.
4. The mock acknowledges after about 900 ms. Make one command type in the mock fail occasionally so the FAILED state can be demoed.

## 10. Milestones

| By | Deliver |
|---|---|
| **15/10** | Vite scaffold in `frontend/`, tokens, fonts, AppShell, routing with role guards, all 9 screens rendering with mock data at 1440px and 375px wide |
| **20/10** | Realtime overview: charts updating from `realtime.mock.ts` and from the `mqtt-dev` adapter showing real Node 1 data; `api.real.ts` wired to whatever endpoints Người 1 has shipped |
| **24/10** | Command flow (§9), alert banner, acknowledge, offline detection and reconnect behaviour |
| **29/10** | Devices add/activate/lifecycle, users, config save, history filters + CSV, audit tab, tests passing |

## 11. Open questions (build with the default, keep each behind one constant or type)

| # | Question | Default to build with | Ask |
|---|---|---|---|
| 1 | Device codes: firmware uses `NODE1_ENV` / `NODE2_SEC`, the ERD doc uses `NODE_1_ENV` / `NODE_2_SEC` | Use the firmware names | Người 4 |
| 2 | Unit and range of `smoke_level` (ppm or raw MQ-2 ADC?) | Label "ppm", threshold 300, chart 0–400; put the unit and domain in one config object | Người 2 |
| 3 | Firmware field names (`smoke_level`, `door_open`) vs ERD (`smoke_gas_level`, `door_status`) | Frontend speaks ERD names; only the `mqtt-dev` adapter maps | Người 1 |
| 4 | `FAN_AUTO` command (return fan to rule control) is not in the ERD list | Include it | Người 1, Người 4 |
| 5 | `HUMIDITY_HIGH`, `DEVICE_OFFLINE` alert types are not in the ERD list | Include them | Người 4 |
| 6 | Command payload on `/control` and the device's ack topic | Not the frontend's concern; frontend only sees `command_status` | Người 1, Người 2 |
| 7 | Offline timeout | 90 s | Team |
| 8 | Night-mode hours (curfew window) are not stored anywhere | Only the on/off toggle | Người 4 |
| 9 | Device type column | Derive from code suffix (§3) | Người 4 |
| 10 | REST and WebSocket contract | §7.2 / §7.3 as proposed | Người 1 |

## 12. Definition of done

- `npm run build`, `npm run lint` and `npm test` all pass with no errors.
- The app runs with `VITE_DATA_SOURCE=mock` and no backend. All 9 screens are reachable and match the design files in layout, spacing, colours and copy.
- Every screen works at 375px wide: no horizontal page scroll, wide tables scroll inside their box, and the sidebar stacks.
- Role gating behaves as in §5 for all three mock users, including the 403 states.
- **Keyboard and screen reader:** every control is a real `<button>`, `<a href>` or labelled input; focus is visible; icon-only buttons have `aria-label`; the alarm banner has `role="alert"`; status is never shown by colour alone.
- **Tests cover:**
  - Role gating (nav and controls per role).
  - `format.ts` (decimal comma, relative heartbeat time).
  - The `mqtt-dev` payload mapping.
  - The command status flow, including the 10 s no-response state.
  - Alert banner show/hide.
- **`frontend/README.md` explains:**
  - How to run each data source, and every env variable.
  - The mock login accounts (dev-only).
  - The folder layout.
  - Where to change the API paths when Người 1's contract lands.
- `frontend/.env.example` lists `VITE_DATA_SOURCE`, `VITE_API_BASE_URL`, `VITE_WS_URL` and `VITE_MQTT_WS_URL` with safe example values. No real secrets anywhere.
- Nothing is committed. Leave a short summary of what was built, what is mocked, and anything left from §11.
