# Đối chiếu Backend Người 1 với firmware nhóm ngày 08/11/2026

Bản dự án mới bổ sung hai file `firmware/node1-environment/node1-environment.ino` và `firmware/node2-security/node2-security.ino`. Không có nội dung cũ nào thay đổi so với ZIP dự án tổng thể trước đó.

## MQTT Broker

Cả hai file firmware hiện sử dụng `broker.hivemq.com:1883`, trong khi Docker mặc định kết nối Mosquitto nội bộ. Hai phía phải sử dụng cùng broker. Khuyến nghị dùng Mosquitto nội bộ và cấu hình IP LAN của máy chạy Docker trong firmware. Mở cổng TCP 1883 trên mạng nội bộ khi cần, nhưng không mở broker cho Internet bằng cấu hình cho phép truy cập ẩn danh. Chỉ dùng broker công cộng để thử nghiệm không nhạy cảm.

Bản Docker cho phép đặt `MQTT_BROKER_URL` trong `deployments/.env` nếu cần dùng broker khác. `MQTT_TOPIC_PREFIX=khohang` khớp firmware.

## Topic và dữ liệu

| Hướng | Topic | Ví dụ payload |
| --- | --- | --- |
| Node 1 → Backend | `khohang/NODE1_ENV/telemetry` | `{"device_id":"NODE1_ENV","temperature":30,"humidity":70,"smoke_level":250,"fan_state":"ON"}` |
| Node 2 → Backend | `khohang/NODE2_SEC/telemetry` | `{"device_id":"NODE2_SEC","door_open":false,"motion_detected":true,"alarm_state":"ON"}` |
| Hai Node → Backend | `khohang/heartbeat` | `{"device_id":"NODE1_ENV","status":"online"}` |
| Backend → Node 1 | `khohang/NODE1_ENV/command` | `{"command_id":12,"fan":"on"}` |
| Backend → Node 2 | `khohang/NODE2_SEC/command` | `{"command_id":13,"alarm":"off"}` |
| Node 1 → Backend | `khohang/NODE1_ENV/ack` | `{"device_id":"NODE1_ENV","status":"FAN_ON_ACK"}` |
| Node 2 → Backend | `khohang/NODE2_SEC/ack` | `{"device_id":"NODE2_SEC","status":"ALARM_OFF_ACK"}` |

Backend lưu trạng thái quạt/còi và trạng thái LED báo động theo `fan_state`, `alarm_state` hoặc ACK trạng thái. Đèn Node 2 hiện nhấp nháy cùng còi; firmware chưa có lệnh điều khiển LED độc lập.

## Ngưỡng cấu hình

PUT `/api/devices/:id/config` có thể nhận thêm `temperature_threshold` từ 0 đến 125 độ C. Đối với Node 1, Backend gửi:

```json
{"threshold_t":50,"threshold_h":65,"threshold_gas":300}
```

Ngưỡng cấu hình được gửi khi người quản trị sửa ngưỡng. Có thể bật `SYNC_THRESHOLDS_ON_HEARTBEAT=true` để gửi định kỳ khi nhận heartbeat Node 1 (tối đa một lần mỗi 60 giây) sau khi đã kiểm tra và hiệu chuẩn ngưỡng. Mặc định đặt `false` để tránh tự ghi đè ngưỡng 800 trong firmware bằng giá trị 300 từ tài liệu khi chưa hiệu chuẩn. Firmware chưa xác nhận đã lưu ngưỡng, vì vậy REST trả về cấu hình đã lưu trên PostgreSQL, không khẳng định thiết bị đã áp dụng. Giá trị ngưỡng khói 300 trong tài liệu Frontend khác mặc định 800 trong firmware; MQ-2 đang trả về giá trị ADC thô, chưa phải ppm. Nhóm cần hiệu chuẩn MQ-2 và thống nhất ngưỡng trước khi thử trên thiết bị thật. Không xem hệ thống này là thiết bị báo cháy đạt chứng nhận.

## ACK chưa có command_id

Firmware hiện gửi ACK như `FAN_ON_ACK` hoặc `ALARM_ON_ACK` nhưng không đưa lại `command_id`. Backend có cơ chế tương thích: khi nhận ACK, cập nhật trạng thái actuator và chỉ ghi nhận một lệnh `ACKNOWLEDGED` nếu có đúng một lệnh cùng loại đang chờ trên Node trong 10 giây. Nếu có nhiều lệnh cùng loại cùng chờ, Backend không đoán ID, để timeout xử lý.

Để xác nhận lệnh chính xác, thành viên firmware cần thêm `command_id` từ payload lệnh vào ACK. Khi đã thêm, Backend ưu tiên xác nhận theo ID và kiểm tra đúng Node. Đặc biệt, ACK từ thao tác nút vật lý cũng có thể xuất hiện khi không có lệnh web.

## Chế độ quạt và xử lý tại thiết bị

Firmware Node 1 hiện chạy Edge Computing trong mỗi vòng `loop`, tự thay đổi trạng thái quạt theo độ ẩm, nhiệt độ, khí gas. Do đó, lệnh `FAN_ON`/`FAN_OFF` từ web có thể bị firmware ghi đè ngay sau khi nhận. Backend không thể đảm bảo chế độ bật/tắt thủ công duy trì liên tục nếu không sửa firmware.

Người 2 cần bổ sung biến chế độ `AUTO`, `ON`, `OFF` trong Node 1 và xử lý trường chế độ quạt để giữ thao tác web, trừ trường hợp vượt ngưỡng nguy hiểm cần ưu tiên tắt quạt. Khi người dùng chọn `FAN_AUTO`, Backend hiện đặt chế độ tự động ở PostgreSQL và xác nhận xử lý phía server; firmware hiện vẫn luôn tự động, nên thao tác này chưa có ACK từ thiết bị.

Node 2 hiện bật còi khi cửa mở hoặc có chuyển động ở bất kỳ thời điểm nào, trong khi Backend chỉ tạo cảnh báo xâm nhập ngoài giờ nếu chế độ ban đêm bật. Cần thống nhất chính sách cảnh báo với người phụ trách firmware.

## Các giới hạn cần ghi rõ khi nghiệm thu

- Chưa chạy thử trực tiếp với ESP32, PostgreSQL, MongoDB và MQTT Broker trên cùng một môi trường.
- Firmware không có chứng thực MQTT theo từng thiết bị. Không dùng public broker cho triển khai thật.
- Cần bổ sung `command_id` vào ACK và hỗ trợ chế độ quạt trên firmware để nghiệm thu điều khiển đầu cuối chính xác.
- `telemetry_interval` đang lưu ở Backend; firmware vẫn gửi cố định 5 giây, chưa có cấu hình chu kỳ qua MQTT.
- Phần Frontend trong repository nhóm đang dùng mock data; Người 3 cần kết nối REST và WebSocket.
