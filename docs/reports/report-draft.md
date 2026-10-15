# BÁO CÁO ĐỒ ÁN: HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG VÀ AN NINH KHO HÀNG (IoT)

## CHƯƠNG 1: GIỚI THIỆU TỔNG QUAN
### 1.1. Đặt vấn đề
Kho hàng yêu cầu quy trình kiểm soát nghiêm ngặt về nhiệt độ, độ ẩm và nguy cơ hỏa hoạn/xâm nhập trái phép.

### 1.2. Mục tiêu đề tài
Xây dựng hệ thống IoT hoàn chỉnh theo mô hình Monorepo gồm 5 tầng kiến trúc, kết nối cảm biến ESP32 qua giao thức MQTT đến Backend và hiển thị trực quan trên Web Dashboard.

---

## CHƯƠNG 2: KIẾN TRÚC HỆ THỐNG VÀ THIẾT KẾ CƠ SỞ DỮ LIỆU
### 2.1. Kiến trúc 5 tầng (5-Layer Architecture)
- Tầng Cảm nhận (Perception Layer): ESP32 Node 1 (Môi trường) & Node 2 (An ninh).
- Tầng Mạng (Network Layer): Wi-Fi & MQTT Broker (Mosquitto).
- Tầng Lưu trữ (Storage Layer): Cơ sở dữ liệu quan hệ (PostgreSQL/MySQL) 9 bảng.
- Tầng Xử lý (Backend Layer): REST API & Broker Subscriber.
- Tầng Ung dụng (Application Layer): Web Dashboard (React/Vite).

### 2.2. Thiết kế Cơ sở dữ liệu (ERD)
Hệ thống sử dụng 9 bảng chính: `users`, `nodes`, `sensors`, `telemetry`, `actuators`, `alert_rules`, `alerts`, `device_controls`, và `audit_logs`.