# Phát triển

## Yêu cầu

- Node.js 22.12 trở lên (đã kiểm tra với Node 26).
- Docker Desktop và Docker Compose cho PostgreSQL, MongoDB và Mosquitto.
- npm.

## Cấu trúc

```text
backend/
  src/routes/       REST
  src/services/     rule engine, MQTT, watchdog, đồng bộ Mongo
  src/utils/        mapping, protocol, HTTP
  migrations/       SQL
  scripts/          seed, simulator, kiểm tra
  tests/            node:test
frontend/
  src/components/ui/     shadcn
  src/components/app/    shell, kit, pagination, native select
  src/pages/             màn hình
  src/services/          http, api.real, api.mock, realtime, format
  src/store/             Zustand: auth, dashboard, actions
  src/index.css          Tailwind và theme
```

## Backend

Khởi động ba dịch vụ nền bằng compose dev:

```sh
cd deployments
cp .env.example .env
docker compose --env-file .env up -d postgres mongo mosquitto
```

Chạy API:

```sh
cd backend
npm ci
cp .env.example .env
# điền DATABASE_URL, MONGO_URI, JWT_SECRET
npm run seed
npm run dev
```

`npm run seed` cần `SEED_ADMIN_PASSWORD`, `SEED_OPERATOR_PASSWORD`, `SEED_VIEWER_PASSWORD` (tối thiểu 8 ký tự). Đặt `SEED_DEFAULT_NODES=true` để tạo `NODE1_ENV` và `NODE2_SEC`.

### Migration

`001_initial_schema.sql` được PostgreSQL chạy tự động khi volume còn trống. Các migration sau phải chạy tay:

```sh
docker compose exec -T postgres psql -U warehouse_app -d warehouse_db \
  < ../backend/migrations/004_device_curfew.sql
```

Danh sách hiện tại:

| Tệp | Nội dung |
| --- | --- |
| `001_initial_schema.sql` | Toàn bộ schema ban đầu |
| `002_mongo_outbox.sql` | Hàng đợi đồng bộ MongoDB |
| `003_firmware_threshold.sql` | Ngưỡng nhiệt độ cho firmware |
| `004_device_curfew.sql` | Giờ giới nghiêm theo thiết bị |
| `005_guard_mode.sql` | Chế độ cảnh giới `AUTO/ON/OFF` |
| `006_curfew_minutes.sql` | Phút giới nghiêm |

Mọi migration đều idempotent, chạy lại an toàn.

### Script

| Lệnh | Việc |
| --- | --- |
| `npm start` | Chạy server |
| `npm run dev` | Chạy với nodemon |
| `npm test` | 26 test |
| `npm run seed` | Tạo tài khoản và node mặc định |
| `npm run simulate` | Giả lập hai ESP32 qua MQTT |
| `npm run check` | Kiểm tra cấu hình môi trường |
| `npm run backfill:mongo` | Đẩy lại outbox sang MongoDB |

## Frontend

```sh
cd frontend
npm ci
cp .env.example .env
# VITE_DATA_SOURCE=api
npm run dev
```

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Vite tại `127.0.0.1:5173` |
| `npm run build` | `tsc -b` và build tĩnh |
| `npm run lint` | ESLint, không cho warning |
| `npm test` | 103 test Vitest |
| `npm run preview` | Xem bản build |

`VITE_DATA_SOURCE=mock` dùng fixture trong bộ nhớ và không cần backend; `api` đọc backend thật. Test luôn chạy ở `mock` nhờ `vitest.config.ts`.

### Luồng dữ liệu

```text
http.ts → api.real.ts → store/dashboard.ts → pages
realtime.ts → store/dashboard.ts#applyEvent → pages
store/actions.ts → api.real.ts (ghi) → toast / thông báo
```

- `api.ts` chọn `mock` hoặc `api`; trang không import trực tiếp adapter.
- `dashboardView.ts` suy ra chế độ quạt, còi, LED từ config, lệnh và actuator.
- `realtime.ts` tự kết nối lại với backoff và tải lại dashboard sau khi nối lại.

### Thêm một trường cấu hình

1. Thêm cột vào migration mới và cập nhật `001`.
2. Thêm validate trong `backend/src/routes/devices.js`.
3. Thêm vào `DeviceConfig`, `ConfigPatch` trong `frontend/src/services/types.ts`.
4. Thêm vào `api.mock.ts` và fixture test.
5. Thêm ô nhập trong `ConfigForm.tsx`.
6. Chạy migration, `npm test` hai phía.

### Thêm một trang

1. Tạo `src/pages/TenTrang.tsx` với `PageHeader`.
2. Thêm route trong `App.tsx`, bọc `AdminRoute` nếu chỉ Admin.
3. Thêm mục vào `Navigation` trong `app-shell.tsx` nếu cần.
4. Thêm test hành vi trong `App.test.tsx`.

## Quy ước

- TypeScript strict. Không dấu chấm phẩy, nháy đơn, thụt 2 dấu cách.
- Test kiểm tra hành vi người dùng thấy, không kiểm tra chi tiết nội bộ.
- Commit theo dạng `feat:`, `fix:`, `chore:`, `docs:` và giải thích lý do trong thân.
- **Không thêm `Co-Authored-By` cho công cụ AI.** CI từ chối; bật hook để tự xoá:

  ```sh
  git config core.hooksPath .githooks
  ```

- Mỗi thay đổi schema cần migration mới; không sửa migration đã chạy trên môi trường khác.

## Gỡ lỗi

| Việc | Cách kiểm tra |
| --- | --- |
| Backend sống | `curl localhost:3000/health` |
| Log backend | `docker compose logs -f backend` |
| MQTT | `mosquitto_sub -h localhost -t 'khohang/#' -v` |
| WebSocket | mở DevTools → Network → WS, hoặc `wscat` |
| Thiết bị offline | kiểm tra heartbeat, mã thiết bị, vòng đời `ACTIVE` |
| Cảnh báo không phát | cảnh giới, giờ giới nghiêm, `night_mode_enabled` |
| CORS | thêm origin vào `CORS_ORIGIN` và khởi động lại backend |
| Quyền | đăng nhập đúng vai trò; route ghi trả 403 nếu thiếu quyền |
