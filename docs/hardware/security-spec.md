# Tài liệu Quy chuẩn Bảo mật & Nhật ký Hệ thống (Audit Log)

## 1. Bảo mật Tài khoản & API
- **Mã hóa Mật khẩu**: Sử dụng thuật toán `bcrypt` với `salt_rounds = 10` để lưu hash mật khẩu trong bảng `users`.
- **Xác thực API**: Sử dụng **JWT (JSON Web Token)** ngắn hạn (hạn 24h). Mỗi request từ Web Dashboard phải đính kèm header `Authorization: Bearer <token>`.

## 2. Bảo mật Kết nối IoT (MQTT)
- Khuyến nghị bật xác thực User/Password trên Mosquitto Broker cho các Node ESP32.

## 3. Quy chuẩn Ghi nhận Audit Log
Mọi thao tác quản trị nhạy cảm bắt buộc phải ghi bản ghi vào bảng `audit_logs`:
- Đăng nhập/Đăng xuất người dùng.
- Lệnh điều khiển trực tiếp phần cứng (Bật/Tắt quạt, ngắt còi).
- Thay đổi cấu hình ngưỡng cảnh báo trong `alert_rules`.