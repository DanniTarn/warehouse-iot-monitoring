# API

Base URL khi chạy local: `http://localhost:3000/api`. Mọi phản hồi là JSON.

## Xác thực

Đăng nhập:

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"..."}'
```

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "user_id": 1,
    "username": "admin",
    "full_name": "Quản trị viên",
    "email": null,
    "role": "ADMIN",
    "is_active": true,
    "created_at": "2026-11-09T...",
    "last_login": "2026-11-09T..."
  }
}
```

Gửi token trên mọi request cần đăng nhập:

```bash
TOKEN="eyJhbGciOi..."
curl -s http://localhost:3000/api/devices -H "Authorization: Bearer $TOKEN"
```

| Vai trò | Quyền |
| --- | --- |
| `VIEWER` | Đọc thiết bị, telemetry, cảnh báo, lịch sử |
| `OPERATOR` | Thêm quyền xác nhận cảnh báo, điều khiển, sửa cấu hình |
| `ADMIN` | Toàn quyền, gồm thiết bị, người dùng và nhật ký |

Lỗi trả về dạng `{ "message": "..." }` với mã 400, 401, 403, 404, 409 hoặc 503. `401` là token sai hoặc hết hạn; `403` là không đủ quyền.

## Điểm cuối

### Xác thực

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/auth/login` | Công khai | Trả token và người dùng |
| GET | `/auth/me` | Đã đăng nhập | Người dùng của token |
| POST | `/auth/logout` | Đã đăng nhập | Ghi audit đăng xuất |

### Thiết bị

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/devices` | Đã đăng nhập | Danh sách, kèm `online` |
| POST | `/devices` | ADMIN | Đăng ký, trả `{ device, auth_token }` |
| GET | `/devices/:id` | Đã đăng nhập | Một thiết bị |
| POST | `/devices/:id/activate` | ADMIN | `REGISTERED` → `ACTIVE` |
| POST | `/devices/:id/revive` | ADMIN | `DECOMMISSIONED` → `ACTIVE`, cấp token mới, trả `{ device, auth_token }` |
| PATCH | `/devices/:id/lifecycle` | ADMIN | `{ "status": "ACTIVE" \| "MAINTENANCE" \| "DECOMMISSIONED" }` |
| POST | `/devices/:id/token` | ADMIN | Cấp lại token, trả một lần |
| GET | `/devices/:id/config` | Đã đăng nhập | Cấu hình thiết bị |
| PUT | `/devices/:id/config` | ADMIN, OPERATOR | Sửa cấu hình |

Đăng ký thiết bị:

```json
{
  "device_name": "Node 3 · Môi trường",
  "device_code": "NODE3_ENV",
  "mac_address": "24:6F:28:B0:77:5A",
  "warehouse_id": 1,
  "assigned_user_id": 2
}
```

`device_code` phải khớp `NODE<số>_ENV` hoặc `NODE<số>_SEC`. Token chỉ trả về một lần và backend chỉ lưu hash.

Cấu hình:

```json
{
  "temperature_threshold": 50,
  "humidity_threshold": 65,
  "smoke_gas_threshold": 300,
  "night_mode_enabled": true,
  "curfew_start_hour": 20,
  "curfew_start_minute": 0,
  "curfew_end_hour": 6,
  "curfew_end_minute": 0,
  "guard_mode": "AUTO"
}
```

`guard_mode`: `AUTO` theo giờ giới nghiêm, `ON` bật mọi lúc, `OFF` tắt. Giờ và phút là số nguyên, giờ 0–23, phút 0–59.

### Trạng thái

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/actuators` | Đã đăng nhập | Trạng thái quạt, còi, LED của mọi thiết bị |
| GET | `/system` | Đã đăng nhập | `night`, khung giờ, múi giờ, giờ server |

### Telemetry

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/telemetry` | Đã đăng nhập | Lọc `device_id`, `from`, `to`, `limit`, `offset`; mới nhất trước |
| GET | `/telemetry/latest` | Đã đăng nhập | Bản ghi mới nhất mỗi thiết bị |
| GET | `/telemetry/archive` | Đã đăng nhập | Lịch sử trong MongoDB; `device_id`, `from`, `to`, `limit`, `offset` |

`limit` tối đa 500. Ngày dạng `YYYY-MM-DD` được hiểu theo `Asia/Ho_Chi_Minh`.

### Lệnh

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/commands` | Đã đăng nhập | Lọc `device_id`, `from`, `to`, `limit` |
| POST | `/commands/device/:id` | ADMIN, OPERATOR | Gửi lệnh, trả lệnh `PENDING` |

```json
{ "command_type": "FAN_AUTO", "parameters": {} }
```

Lệnh người dùng: `FAN_ON`, `FAN_OFF`, `FAN_AUTO`, `BUZZER_OFF`. Lệnh tự động: `BUZZER_ON`, `LED_RED`, có `username: "SYSTEM"`.

### Cảnh báo

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/alerts` | Đã đăng nhập | Lọc `status` (`open`/`resolved`), `severity`, `device_id`, `limit` |
| GET | `/alerts/archive` | Đã đăng nhập | Lịch sử trong MongoDB |
| POST | `/alerts/:id/acknowledge` | ADMIN, OPERATOR | Xác nhận xử lý |

### Người dùng

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/users` | ADMIN | Danh sách tài khoản |
| POST | `/users` | ADMIN | Tạo tài khoản |
| PATCH | `/users/:id` | ADMIN | `{ "role"?: ..., "is_active"?: ... }` |

```json
{
  "username": "operator02",
  "full_name": "Thủ kho ca đêm",
  "email": "operator02@kho.example",
  "role": "OPERATOR",
  "password": "mat-khau-8-ky-tu"
}
```

Không thể tự khóa, tự hạ quyền hoặc khóa quản trị viên cuối cùng.

### Nhật ký và kho

| Phương thức | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/audit-logs` | ADMIN | Lọc `user_id`, `from`, `to`, `limit` |
| GET | `/warehouses` | Đã đăng nhập | Danh sách kho |
| GET | `/health` | Công khai | Trạng thái PostgreSQL, MongoDB, MQTT |

## WebSocket

```
ws://localhost:3000/ws?token=<JWT>
wss://<host>/ws?token=<JWT>
```

Khung dữ liệu:

```json
{ "type": "telemetry", "data": { "telemetry_id": 123, "device_code": "NODE1_ENV", "...": "..." } }
```

| `type` | `data` |
| --- | --- |
| `telemetry` | Bản ghi telemetry |
| `device_status` | `{ device_id, online, last_heartbeat, lifecycle_status }` |
| `alert_created` | Alert |
| `alert_updated` | Alert |
| `command_status` | DeviceCommand |
| `actuator_status` | `{ device_id, device_code, actuator_type, state }` |

Token được kiểm tra khi nâng cấp kết nối. Origin phải nằm trong `CORS_ORIGIN`.
