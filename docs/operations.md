# Vận hành và triển khai

Một VM Linux chạy toàn bộ stack: PostgreSQL, MongoDB, Mosquitto, backend và bản build frontend sau Caddy. Caddy tự cấp chứng chỉ TLS và proxy `/api`, `/ws`.

## Yêu cầu hạ tầng

- VM Linux, khuyến nghị Ubuntu 24.04, 2 vCPU / 4 GB RAM trở lên.
- IP công khai và một tên miền trỏ về IP đó. Có thể dùng `<ip>.sslip.io` miễn phí.
- Mở TCP 22, 80, 443 và 1883 ở security list của cloud và firewall trên máy.
- Docker Engine và Docker Compose.

Cấu hình đã dùng cho bản demo: Oracle Cloud Always Free, Ampere A1, `ap-singapore-1`.

## Cài đặt lần đầu

### 1. Mã nguồn

```sh
git clone https://github.com/DanniTarn/warehouse-iot-monitoring.git
cd warehouse-iot-monitoring
```

### 2. Cấu hình

```sh
cd deployments
cp .env.prod.example .env.prod
chmod 600 .env.prod
```

Điền tối thiểu:

| Biến | Ghi chú |
| --- | --- |
| `SITE_ADDRESS` | Tên miền, không có `https://` |
| `POSTGRES_PASSWORD` | Mật khẩu mạnh |
| `MONGO_PASSWORD` | Tránh ký tự phải URL-encode |
| `JWT_SECRET` | Tối thiểu 32 ký tự |
| `MQTT_BACKEND_PASSWORD` | Trùng với user `backend` của broker |
| `SEED_DEFAULT_NODES` | `true` nếu muốn tạo hai node demo |
| `PUBLIC_BIND_IP` | Chỉ đặt khi 443 đã bị dịch vụ khác giữ trên một interface |

### 3. User MQTT

Broker production từ chối kết nối ẩn danh. Tạo user cho backend và từng thiết bị:

```sh
docker run --rm -it -v "$PWD/mosquitto/config:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /m/passwd backend '<mật khẩu backend>'

docker run --rm -it -v "$PWD/mosquitto/config:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -b /m/passwd node1 '<mật khẩu node 1>'

docker run --rm -it -v "$PWD/mosquitto/config:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -b /m/passwd node2 '<mật khẩu node 2>'

chmod 600 mosquitto/config/passwd
```

### 4. Migration

PostgreSQL chỉ tự chạy `001_initial_schema.sql` khi volume còn trống. Các migration sau chạy tay trước khi khởi động backend:

```sh
for file in 004_device_curfew 005_guard_mode 006_curfew_minutes; do
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres
  docker exec -i warehouse-prod-postgres-1 psql -U warehouse_app -d warehouse_db \
    < "../backend/migrations/$file.sql"
done
```

Mọi tệp đều idempotent, chạy lại không lỗi.

### 5. Khởi động

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
```

Lần đầu Caddy cần 80 và 443 mở để cấp chứng chỉ. Kiểm tra:

```sh
curl -s https://<SITE_ADDRESS>/health
```

Kết quả phải có `postgres_connected`, `mongodb_connected`, `mqtt_connected` đều `true`.

### 6. Seed

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod exec \
  -e SEED_ADMIN_PASSWORD='...' \
  -e SEED_OPERATOR_PASSWORD='...' \
  -e SEED_VIEWER_PASSWORD='...' \
  backend npm run seed
```

Đổi mật khẩu ngay sau lần đăng nhập đầu tiên.

## Cập nhật phiên bản

```sh
cd warehouse-iot-monitoring
git fetch origin
git reset --hard origin/main

cd deployments
# chạy migration mới nếu có
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build backend web
```

Chỉ đổi frontend:

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps --build web
```

`--no-deps` tránh recreate backend khi chỉ có frontend thay đổi.

## Sao lưu và phục hồi

Sao lưu:

```sh
docker exec warehouse-prod-postgres-1 pg_dump -U warehouse_app warehouse_db \
  | gzip > postgres-$(date +%F).sql.gz

docker exec warehouse-prod-mongo-1 mongodump \
  --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive --gzip > mongo-$(date +%F).archive.gz
```

Phục hồi PostgreSQL:

```sh
gunzip -c postgres-YYYY-MM-DD.sql.gz \
  | docker exec -i warehouse-prod-postgres-1 psql -U warehouse_app -d warehouse_db
```

Phục hồi MongoDB:

```sh
docker exec -i warehouse-prod-mongo-1 mongorestore \
  --username "$MONGO_USER" --password "$MONGO_PASSWORD" --authenticationDatabase admin \
  --archive --gzip < mongo-YYYY-MM-DD.archive.gz
```

Volume dữ liệu: `deployments_pgdata`, `deployments_mongodata`, `deployments_mosquitto_data`, `deployments_caddy_data`.

## Nhật ký và sức khoẻ

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod ps
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f backend
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f web
curl -s https://<SITE_ADDRESS>/health
```

Backend ghi log cảnh báo, lệnh tự động và lỗi MQTT. Caddy ghi lỗi cấp chứng chỉ.

## Xoay vòng bí mật

| Bí mật | Cách đổi | Ảnh hưởng |
| --- | --- | --- |
| Mật khẩu web | API `PATCH /api/users/:id` hoặc seed | Phiên cũ vẫn dùng JWT đến khi hết hạn |
| `JWT_SECRET` | Sửa `.env.prod`, recreate backend | Mọi phiên đăng nhập bị đăng xuất |
| Mật khẩu PostgreSQL / MongoDB | Đổi trong DB rồi sửa `.env.prod` | Backend mất kết nối đến khi recreate |
| User MQTT | `mosquitto_passwd`, cập nhật `.env.prod`, recreate backend | Thiết bị phải đổi mật khẩu tương ứng |
| Token thiết bị | `POST /api/devices/:id/token` | Token cũ mất hiệu lực; firmware phải nạp lại |

## TLS và cổng

- Caddy tự xin chứng chỉ qua HTTP-01. Cần 80 và 443 mở từ Internet.
- MQTT hiện là plaintext trên 1883. Khi bật TLS 8883, firmware cần `WiFiClientSecure` và CA certificate, đồng thời đóng 1883.
- Không mở 5432, 27017 hoặc 3000 ra Internet. Compose production chỉ publish 80, 443 và 1883.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp | Cách xử lý |
| --- | --- | --- |
| Trang không lên, HTTP 502 | Backend chưa sẵn sàng hoặc sai `SITE_ADDRESS` | `docker compose ps`, xem log backend |
| Caddy không cấp chứng chỉ | 80/443 bị chặn ở cloud | mở ingress, kiểm tra `curl http://<host>` |
| `mqtt_connected: false` | Sai user/mật khẩu hoặc thiết bị chưa có trong `passwd` | kiểm tra `.env.prod`, `mosquitto_passwd`, log broker |
| Thiết bị không lên `ACTIVE` | Chưa kích hoạt hoặc sai mã | kiểm tra `/api/devices`, trạng thái vòng đời |
| Cảnh báo cửa không phát | Cảnh giới `OFF`, ngoài giờ với `AUTO`, hoặc cửa đã mở từ trước | xem `guard_mode`, giờ giới nghiêm; đóng rồi mở lại |
| Còi không theo giờ | Firmware chưa nhận `guard_mode` | kiểm tra log MQTT, heartbeat 30 giây |
| `git pull` báo diverge | Lịch sử từng bị force-push | `git fetch && git reset --hard origin/main` |
| 401 trên WebSocket | Token hết hạn hoặc sai origin | đăng nhập lại, thêm origin vào `CORS_ORIGIN` |

## Danh sách kiểm tra trước khi mở rộng truy cập

- [ ] Đổi toàn bộ mật khẩu seed và mật khẩu broker.
- [ ] `JWT_SECRET` riêng, tối thiểu 32 ký tự.
- [ ] MQTT bật user/password, cân nhắc ACL theo topic.
- [ ] Cân nhắc TLS 8883 cho thiết bị.
- [ ] Thêm giới hạn tần suất cho `/api/auth/login`.
- [ ] Sao lưu định kỳ PostgreSQL và MongoDB.
- [ ] Theo dõi dung lượng đĩa và log.
