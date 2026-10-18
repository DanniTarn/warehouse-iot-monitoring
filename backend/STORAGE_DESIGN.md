# Thiết kế lưu trữ Backend Người 1

## Đối chiếu tài liệu gốc

`BackendIOT-main/src/config/db.js` kết nối PostgreSQL qua `pg` và MongoDB qua `mongoose`. `BackendIOT-main/src/models/Telemetry.js` khai báo MongoDB model `Telemetry` và `Alert`. Tài liệu `docs/reports/report-draft.md` của repository nhóm mô tả chín bảng PostgreSQL/MySQL, còn `docs/frontend-handoff/HANDOFF.md` yêu cầu dữ liệu API dạng snake_case và mô tả pipeline PostgreSQL.

Do đó, để không bỏ MongoDB của Backend Người 1 và không phá hợp đồng Frontend, giải pháp này dùng hai database. Đây là lựa chọn tích hợp cần được nhóm xác nhận trong tài liệu kiến trúc cuối cùng.

## Vai trò các database

PostgreSQL giữ users, warehouses, nodes, sensors, actuators, device_configs, telemetry, alert_rules, alerts, device_controls, audit_logs và mongo_outbox. MongoDB giữ hai collection `telemetries` và `alerts`, dùng để truy vấn lịch sử theo thời gian.

Dữ liệu telemetry và alerts ở PostgreSQL là bản ghi nghiệp vụ gốc. MongoDB là bản lưu lịch sử được đồng bộ từ PostgreSQL, không phải bản ghi độc lập viết qua một API khác.

## Đồng bộ và khôi phục

Sau mỗi lần INSERT telemetry/alerts hoặc UPDATE trạng thái alerts, trigger trong migration `002_mongo_outbox.sql` ghi snapshot tương ứng vào `mongo_outbox`, chung transaction với dữ liệu nguồn. Worker dùng upsert theo ID nguồn, đánh dấu thành công và tự retry khi có lỗi. Hệ thống không xóa bản ghi MongoDB mỗi khi thay đổi cài đặt thiết bị; dữ liệu lịch sử được bảo toàn.

Có thể xem trạng thái tại `/health`, truy vấn MongoDB qua `/api/telemetry/archive` và `/api/alerts/archive`, hoặc gọi `npm run backfill:mongo` để nhập lại dữ liệu cũ. Cần Docker Compose với PostgreSQL, MongoDB, Mosquitto và Backend, cấu hình mật khẩu trong `deployments/.env`.

## Giới hạn

Chưa thực hiện kiểm thử end-to-end với ESP32 vật lý và hai database thật trong môi trường bàn giao. Đồng bộ giữa hai database là eventual consistency, nên lịch sử MongoDB có thể trễ khoảng một chu kỳ worker hoặc lâu hơn khi sự cố. Các endpoint REST chính vẫn trả dữ liệu PostgreSQL ngay sau khi lưu thành công.
