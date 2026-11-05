# Giám sát kho · Frontend

Single-page app bằng Vite, React 18 và TypeScript. Giao diện dùng Tailwind CSS v4 với shadcn trong `src/components/ui`, các primitive nghiệp vụ trong `src/components/app`. Biểu đồ dùng Recharts, trạng thái dùng Zustand, định tuyến dùng React Router.

## Chạy

Yêu cầu Node.js 22.12 trở lên.

```sh
cd frontend
npm ci
cp .env.example .env
npm run dev
```

Vite chạy tại `http://127.0.0.1:5173`.

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `tsc -b` và build tĩnh vào `dist/` |
| `npm run lint` | ESLint, không cho warning |
| `npm test` | 103 test Vitest |
| `npm run preview` | Xem bản build |

## Nguồn dữ liệu

| `VITE_DATA_SOURCE` | Hành vi |
| --- | --- |
| `mock` | Fixture trong bộ nhớ, không cần backend; mặc định khi không đặt |
| `api` | Đọc backend thật qua REST và WebSocket |

```dotenv
VITE_DATA_SOURCE=api
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

Mọi biến `VITE_` đều công khai trong bundle, không đặt bí mật ở đây.

## Tài khoản demo

Chế độ `mock` dùng mật khẩu `demo123`:

| Tài khoản | Vai trò |
| --- | --- |
| `admin` | ADMIN |
| `operator01` | OPERATOR |
| `viewer01` | VIEWER |

Chế độ `api` dùng tài khoản trong cơ sở dữ liệu backend, không dùng các tài khoản trên.

## Chức năng

- Đăng nhập, đăng xuất, khôi phục phiên, chặn route theo vai trò.
- Tổng quan: chỉ số hiện tại, biểu đồ 1/6/24 giờ, banner cảnh báo, điều khiển nhanh.
- Thiết bị: tìm kiếm, lọc vòng đời và kho, kích hoạt, xem chi tiết.
- Chi tiết thiết bị: thông tin, chỉ số, điều khiển quạt hoặc còi, cấu hình, sự kiện an ninh, 10 lệnh gần nhất.
- Cấu hình Node 1: ngưỡng nhiệt độ, độ ẩm, khói.
- Cấu hình Node 2: giờ giới nghiêm đến phút và chế độ cảnh giới `Tự động / Bật / Tắt`.
- Cảnh báo: lọc theo trạng thái, mức độ, thiết bị; xác nhận xử lý.
- Lịch sử: telemetry, lệnh, nhật ký; lọc theo ngày và thiết bị; phân trang; xuất CSV.
- Người dùng: tạo tài khoản, đổi vai trò, khóa/mở khóa.
- Phân trang có số trang, ellipsis và chọn 25/50/100 dòng.

## Cấu trúc

```text
src/
  components/ui/      shadcn: button, card, badge, table, sheet, select...
  components/app/     shell, page header, kit, pagination, native select
  components/charts/  biểu đồ cảm biến
  components/control/ quạt, form cấu hình
  pages/              các màn hình
  services/http.ts    fetch, JSON, lỗi 401/403
  services/api.ts     chọn mock hoặc api
  services/api.real.ts đọc REST
  services/api.mock.ts fixture cho test
  services/realtime.ts WebSocket và backoff
  services/dashboardView.ts suy ra trạng thái quạt, còi, LED
  store/auth.ts       phiên đăng nhập
  store/dashboard.ts  dữ liệu dashboard và reducer sự kiện
  store/actions.ts    thao tác ghi
  index.css           Tailwind và theme
```

`http.ts` giữ transport và lỗi. `api.real.ts` giữ toàn bộ đường dẫn REST. `dashboardView.ts` là hàm thuần, dễ test. `realtime.ts` chỉ phát sự kiện; `store/dashboard.ts` hợp nhất chúng.

## Định tuyến

| Đường dẫn | Trang | Quyền |
| --- | --- | --- |
| `/login` | Đăng nhập | Công khai |
| `/` | Tổng quan | Đã đăng nhập |
| `/devices` | Thiết bị | Đã đăng nhập |
| `/devices/:deviceId` | Chi tiết thiết bị | Đã đăng nhập |
| `/devices/new` | Thêm thiết bị | ADMIN |
| `/alerts` | Cảnh báo | Đã đăng nhập |
| `/history` | Lịch sử | Đã đăng nhập |
| `/users` | Người dùng | ADMIN |

Người dùng `VIEWER` thấy nút điều khiển ở trạng thái khóa; `OPERATOR` không thấy thao tác vòng đời và quản lý người dùng; route Admin trả trang 403.

## Giao diện

- Desktop từ 1024 px: sidebar cố định, nội dung tối đa 1440 px.
- Dưới 800 px: thanh trên cùng, menu dạng sheet, thẻ chỉ số hai cột, biểu đồ xuống cuối.
- Bảng cuộn ngang trong thẻ, không làm tràn trang.
- Màu trạng thái luôn đi kèm nhãn hoặc biểu tượng.

## Kiểm thử

```sh
npm run lint
npm run build
npm test
```

Test chạy ở `mock` nhờ `vitest.config.ts`, không gọi mạng. Các nhóm chính: phân quyền, đăng nhập, thao tác ghi, cảnh báo, lịch sử, cấu hình, biểu đồ và định dạng.

## Triển khai

Frontend được build tĩnh và phục vụ bởi Caddy trong `frontend/Dockerfile`. Hai biến `VITE_API_BASE_URL` và `VITE_WS_URL` được truyền lúc build, nên đổi tên miền cần build lại ảnh `web`. Caddy phục vụ `index.html` cho mọi route để deep link không 404.

Xem [docs/operations.md](../docs/operations.md).

## Giới hạn

- `VITE_DATA_SOURCE=mock` chỉ để test và demo offline; dữ liệu không phải thật.
- `telemetry_interval` chỉ hiển thị, firmware gửi cố định 5 giây.
- Chưa có chế độ tối.
- Chưa có giới hạn tần suất đăng nhập ở phía backend.
