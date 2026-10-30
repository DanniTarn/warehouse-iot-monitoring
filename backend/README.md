# Backend IoT – Giám sát kho hàng

Backend dành cho Người 1, viết bằng Node.js, Express, PostgreSQL, MongoDB (Mongoose), MQTT và WebSocket. PostgreSQL quản lý nghiệp vụ quan hệ và các bản ghi đồng bộ với hợp đồng Frontend; MongoDB lưu dữ liệu lịch sử cảm biến và cảnh báo để truy vấn theo thời gian. Cả hai cơ sở dữ liệu đều được cấu hình trong Docker.

## 1. Chức năng

- Đăng nhập JWT trong 24 giờ; ba vai trò `ADMIN`, `OPERATOR`, `VIEWER`.
- Tài khoản: tạo, xem, đổi quyền, khóa/mở khóa, không cho admin tự khóa và không cho vô hiệu hóa admin cuối cùng.
- Thiết bị: đăng ký, sinh token một lần, kích hoạt, bảo trì, thu hồi, xoay token, quản lý cấu hình.
- MQTT: dữ liệu Node 1 (nhiệt độ, độ ẩm, khói), Node 2 (cửa, chuyển động), heartbeat và ACK.
- PostgreSQL: lưu tài khoản, thiết bị, cấu hình, lệnh điều khiển, audit log và bản ghi telemetry/cảnh báo phục vụ hợp đồng Frontend.
- MongoDB: lưu collection `telemetries`, `alerts`; tự đồng bộ thông qua hàng đợi PostgreSQL với cơ chế retry khi MongoDB tạm gián đoạn.
- Rule engine: độ ẩm cao bật quạt trong chế độ AUTO; vượt ngưỡng khói cảnh báo CRITICAL, gửi còi/LED đỏ Node 2; phát hiện cửa mở hoặc chuyển động mọi lúc, WARNING trong giờ làm việc và CRITICAL ngoài giờ 20:00–06:00. Còi chỉ kêu ngoài giờ.
- Phát hiện mất kết nối sau 90 giây; điều khiển PENDING → SENT → ACKNOWLEDGED / FAILED, timeout 10 giây.
- WebSocket `/ws` gửi `telemetry`, `device_status`, `alert_created`, `alert_updated`, `command_status`.

## 2. Chạy bằng Docker với dự án nhóm

Yêu cầu Docker Desktop và Docker Compose. Mở terminal tại `deployments` của dự án nhóm.

```powershell
copy .env.example .env
```

Sửa `.env`, thay `POSTGRES_PASSWORD`, `MONGO_PASSWORD` và `JWT_SECRET` bằng giá trị bí mật thực tế. `MONGO_USERNAME` mặc định là `warehouse_admin`. Tránh ký tự đặc biệt chưa được URL-encode trong mật khẩu MongoDB vì Backend nhận thông tin qua chuỗi kết nối. Muốn có sẵn hai Node thử nghiệm thì đặt `SEED_DEFAULT_NODES=true` trước khi chạy.

```powershell
docker compose --env-file .env up -d --build
docker compose ps
```

Backend chạy ở `http://localhost:3000`, REST API dùng tiền tố `/api`, WebSocket dùng `ws://localhost:3000/ws?token=JWT`. Kiểm tra:

```powershell
curl http://localhost:3000/health
```

Tạo tài khoản ban đầu. Thay ba mật khẩu trong lệnh bằng mật khẩu riêng, tối thiểu 8 ký tự:

```powershell
docker compose exec -e SEED_ADMIN_PASSWORD=MatKhauAdminMoi123 -e SEED_OPERATOR_PASSWORD=MatKhauOperatorMoi123 -e SEED_VIEWER_PASSWORD=MatKhauViewerMoi123 backend npm run seed
```

Chạy mô phỏng ESP32 nếu đã tạo hai Node demo (`SEED_DEFAULT_NODES=true`):

```powershell
docker compose exec backend npm run simulate
```

Dùng `Ctrl+C` để dừng bộ mô phỏng. Lệnh này chỉ dừng mô phỏng, không dừng Backend.

## 3. Chạy Backend trực tiếp trên Windows

Yêu cầu Node.js 20.19+, PostgreSQL, MongoDB và MQTT Broker đang hoạt động.

```powershell
cd backend
copy .env.example .env
npm ci
npm run seed
npm run dev
```

Sửa `.env` trước khi chạy; điền `DATABASE_URL`, `MONGO_URI` và `JWT_SECRET`. Nếu MongoDB của bạn đã bật xác thực, dùng `MONGO_URI=mongodb://user:password@localhost:27017/warehouse_history?authSource=admin` và URL-encode mật khẩu nếu có ký tự đặc biệt. Lệnh `npm run seed` yêu cầu thêm `SEED_ADMIN_PASSWORD`, `SEED_OPERATOR_PASSWORD`, `SEED_VIEWER_PASSWORD` trong `.env`. Muốn test hai Node bằng simulator, bật `SEED_DEFAULT_NODES=true` và chạy lại seed, sau đó `npm run simulate` ở một cửa sổ terminal khác.

## 4. Danh sách REST API

| Phương thức | Endpoint | Quyền |
| --- | --- | --- |
| POST | `/api/auth/login` | Công khai |
| GET | `/api/auth/me` | Đã đăng nhập |
| POST | `/api/auth/logout` | Đã đăng nhập |
| GET | `/api/devices` | Đã đăng nhập |
| GET | `/api/devices/:id` | Đã đăng nhập |
| POST | `/api/devices` | ADMIN |
| POST | `/api/devices/:id/activate` | ADMIN |
| PATCH | `/api/devices/:id/lifecycle` | ADMIN |
| POST | `/api/devices/:id/token` | ADMIN |
| GET | `/api/devices/:id/config` | Đã đăng nhập |
| PUT | `/api/devices/:id/config` | ADMIN, OPERATOR |
| GET | `/api/telemetry` | Đã đăng nhập |
| GET | `/api/telemetry/latest` | Đã đăng nhập |
| GET | `/api/telemetry/archive` | Đã đăng nhập, truy vấn MongoDB |
| GET | `/api/commands` | Đã đăng nhập |
| POST | `/api/devices/:id/commands` | ADMIN, OPERATOR |
| GET | `/api/alerts` | Đã đăng nhập |
| GET | `/api/alerts/archive` | Đã đăng nhập, truy vấn MongoDB |
| POST | `/api/alerts/:id/acknowledge` | ADMIN, OPERATOR |
| GET | `/api/users` | ADMIN |
| POST | `/api/users` | ADMIN |
| PATCH | `/api/users/:id` | ADMIN |
| GET | `/api/audit-logs` | ADMIN |
| GET | `/api/warehouses` | Đã đăng nhập |
| GET | `/health` | Công khai |

`/api/telemetry`, `/api/commands`, `/api/alerts`, `/api/audit-logs` hỗ trợ bộ lọc theo tài liệu Frontend handoff. Đường `/api/telemetry` còn hỗ trợ `offset` bắt đầu từ 0.

Các request cần quyền đăng nhập gửi `Authorization: Bearer <JWT>`.

Đăng nhập:

```json
{"username":"admin","password":"mật khẩu đã đặt khi seed"}
```

Đăng ký thiết bị:

```json
{"device_name":"Node 1 · Môi trường","device_code":"NODE1_ENV","mac_address":"24:6F:28:A1:3C:90","warehouse_id":1,"assigned_user_id":2}
```

Chỉ Admin nhận token thiết bị ngay sau khi đăng ký hoặc cấp lại. Backend lưu hash, không trả token về ở các API đọc.

Điều khiển:

```json
{"command_type":"FAN_AUTO","parameters":{}}
```

Các lệnh người dùng: `FAN_ON`, `FAN_OFF`, `FAN_AUTO`, `BUZZER_OFF`. Các lệnh tự động bổ sung: `BUZZER_ON`, `LED_RED`. Lệnh tự động có `user_id=null`, `username=SYSTEM`.

Cấu hình mặc định: ngưỡng độ ẩm 65%, ngưỡng khói 300, gửi dữ liệu mỗi 5 giây, chế độ ban đêm bật, quạt ở chế độ AUTO. Giờ ban đêm mặc định 20:00–06:00 tại Việt Nam, có thể sửa trong `.env`.

## 5. MQTT – giao kèo với Người 2

Broker phải dùng cùng cấu hình cho ESP32 và Backend. Bộ tài liệu hiện có dùng:

| MQTT topic | Chiều | Payload |
| --- | --- | --- |
| `khohang/NODE1_ENV/telemetry` | ESP32 → BE | `{"device_id":"NODE1_ENV","temperature":32.3,"humidity":62.1,"smoke_level":300}` |
| `khohang/NODE2_SEC/telemetry` | ESP32 → BE | `{"device_id":"NODE2_SEC","door_open":1,"motion_detected":0}` |
| `khohang/heartbeat` | ESP32 → BE | `{"device_id":"NODE1_ENV","status":"online"}` |
| `khohang/NODE1_ENV/command` | BE → ESP32 | `{"command_id":12,"command":"FAN_ON","command_type":"FAN_ON","params":{},"parameters":{}}` |
| `khohang/NODE1_ENV/ack` | ESP32 → BE | `{"device_id":"NODE1_ENV","command_id":12,"status":"ACKNOWLEDGED"}` |
| `khohang/NODE2_SEC/command` | BE → ESP32 | Cùng cấu trúc lệnh |
| `khohang/NODE2_SEC/ack` | ESP32 → BE | Cùng cấu trúc ACK |

Backend còn nhận heartbeat riêng trên `khohang/NODE1_ENV/heartbeat`, `khohang/NODE2_SEC/heartbeat`. Khi nhận telemetry, backend dùng thời gian nhận để tạo `recorded_at`, theo firmware đã nêu trong handoff.

**Phối hợp firmware:** Người 2 cần thực hiện xử lý `FAN_ON`, `FAN_OFF`, `FAN_AUTO`, `BUZZER_ON`, `BUZZER_OFF`, `LED_RED` và publish ACK đúng `command_id`. Để Node thực sự hoạt động, cần có đăng ký và trạng thái `ACTIVE` trong database. Node chưa đăng ký hoặc đã thu hồi bị bỏ qua.

## 6. Bảo mật khi demo và triển khai

Tập tin Mosquitto của Docker hiện để `allow_anonymous true` **chỉ phục vụ môi trường phát triển/demo**. Không đưa Broker công khai ra Internet với cấu hình này. Khi dùng thật, bật user/password, giới hạn truy cập mạng, cấu hình ACL/topic và TLS; đặt `MQTT_USERNAME`, `MQTT_PASSWORD` của Backend phù hợp cấu hình Broker. Token cấp phát qua API hiện mới dùng cho quy trình đăng ký/quản lý thiết bị: firmware được mô tả trong handoff **chưa gửi token hay xác thực theo từng thiết bị**, nên Backend chỉ có thể kiểm tra mã thiết bị và trạng thái vòng đời sau khi Broker đã chấp nhận kết nối. Chưa thể xem đây là xác thực MQTT chống giả mạo thiết bị.

Nếu demo trên HiveMQ công cộng, hãy chú ý topic có thể bị người lạ publish hoặc subscribe. Không dùng token và tài khoản thật trên broker công cộng. Để an toàn, dùng Mosquitto nội bộ trong Docker rồi trỏ firmware vào IP LAN của máy chạy Docker.

## 7. Kiểm thử và giới hạn bàn giao

```powershell
npm run check
npm test
```

Có test cho mapping cảm biến, MQTT topic, tính online, giờ ban đêm, xác thực input, luật độ ẩm, quạt, khói, còi/LED và xâm nhập. Cần chạy kiểm thử tích hợp trên PostgreSQL + MQTT Broker thật với mô phỏng ESP32 hoặc phần cứng để nghiệm thu API và trạng thái lệnh.

Frontend nhóm hiện là phiên bản mock; Người 3 vẫn cần bổ sung `api.real.ts`, `realtime.ts` và chuyển `VITE_DATA_SOURCE` sang `api` để sử dụng Backend này. Không chỉnh sửa Frontend trong gói bàn giao cho Người 1. Các quy ước chưa được firmware xác nhận: payload ACK, lệnh `LED_RED`, đơn vị khói MQ-2 và giờ chế độ đêm. Cần thống nhất với Người 2 trước khi gắn phần cứng thật.

## 8. Sử dụng MongoDB và kiểm tra đồng bộ

Hai collection lịch sử nằm trong database MongoDB `warehouse_history`:

- `telemetries`: `telemetry_id`, `device_id`, `device_code`, `temperature`, `humidity`, `smoke_gas_level`, `door_status`, `motion_detected`, `recorded_at`.
- `alerts`: `alert_id`, `device_id`, `device_code`, `alert_type`, `severity`, `alert_message`, `is_acknowledged`, `resolved_by_user_id`, `created_at`, `resolved_at`.

Tất cả bản tin hợp lệ đi vào PostgreSQL trước. Trigger đưa bản ghi telemetry/cảnh báo vào bảng `mongo_outbox` trong cùng transaction. Worker chạy khoảng mỗi giây để lưu vào MongoDB bằng upsert theo ID. Khi MongoDB lỗi, bản ghi còn trong `mongo_outbox` và được thử lại với thời gian chờ tăng dần, tối đa 60 giây. Đây là đồng bộ cuối cùng nhất quán, không phải một transaction nguyên tử trải trên hai database.

REST API thông thường vẫn dùng PostgreSQL để đảm bảo hợp đồng snake_case với Frontend. API tra cứu lịch sử trực tiếp trong MongoDB:

```text
GET /api/telemetry/archive?device_id=1&from=2026-11-01&to=2026-11-08&limit=50&offset=0
GET /api/alerts/archive?device_id=1&status=open&severity=CRITICAL&limit=50
```

Các API này cần JWT. `GET /health` trả `mongodb_connected` và `mongodb_pending_records` để thấy tiến độ. Nếu MongoDB mất kết nối, truy vấn archive trả HTTP 503; API chính và hàng đợi PostgreSQL vẫn hoạt động khi máy chủ đang chạy. Backend cần cả hai database để khởi động.

Dữ liệu được tạo bởi phiên Backend cũ, trước khi có trigger, có thể đồng bộ lần đầu bằng:

```powershell
cd deployments
docker compose exec backend npm run backfill:mongo
```

Lệnh backfill chủ động đưa toàn bộ telemetry/cảnh báo PostgreSQL vào hàng đợi và đồng bộ MongoDB; upsert theo ID nên không tạo bản ghi lịch sử trùng. Thực hiện lại nếu cần dựng lại MongoDB sau khi thay ổ lưu trữ.

Cấu hình Docker lưu dữ liệu MongoDB trong volume `mongodata`, chỉ công bố cổng 27017 trên loopback của máy chủ và yêu cầu username/password. Không chia sẻ file `.env` hoặc commit mật khẩu thật.

Tài liệu báo cáo tổng thể có ERD dữ liệu quan hệ, còn Backend Người 1 ban đầu sử dụng Mongoose cho telemetry và alerts. Bản tích hợp này giữ ERD PostgreSQL để tương thích hợp đồng nhóm, đồng thời giữ MongoDB làm kho lịch sử đúng với Backend gốc. Nhóm cần xác nhận và cập nhật bản báo cáo kiến trúc cuối cùng theo mô hình hai database này.

## 9. Tương thích firmware mới ngày 08/11/2026

Backend hỗ trợ trực tiếp JSON hiện tại của ESP32: `fan: on/off`, `alarm: on/off`, `FAN_ON_ACK`, `ALARM_OFF_ACK`, `fan_state`, `alarm_state` và ba ngưỡng `threshold_t`, `threshold_h`, `threshold_gas`. PostgreSQL giữ dữ liệu nghiệp vụ; MongoDB tiếp tục lưu lịch sử qua outbox.

Đọc `FIRMWARE_INTEGRATION.md` trước khi kết nối ESP32 thật. Cần thống nhất MQTT Broker, bổ sung `command_id` vào ACK và xử lý chế độ quạt thủ công trong firmware. Không sử dụng các giá trị khí gas thô như một phép đo ppm đã hiệu chuẩn.

Sau khi lấy bản cập nhật, không cần xóa dữ liệu database cũ. Backend sẽ chạy thêm migration `003_firmware_threshold.sql` khi khởi động. Nếu đang chạy Docker:

```powershell
cd deployments
docker compose --env-file .env up -d --build
```

Kiểm thử:

```powershell
cd backend
npm ci
npm run check
npm test
```
