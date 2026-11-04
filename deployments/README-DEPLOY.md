# Deploy the full stack

One small Linux VM with a public IP runs everything: Postgres, MongoDB, Mosquitto, the API and the built frontend behind Caddy.

## 1. Host

Oracle Cloud Always Free is enough. As of June 2026 it gives 2 OCPUs and 12 GB RAM on Ampere A1, plus a public IPv4. Pick a region with Ampere capacity, Ubuntu 24.04, and note the public IP.

Open these TCP ports in the cloud security list and in the host firewall: 22, 80, 443, 1883.

## 2. DNS

Point a free DuckDNS subdomain at the public IP, or use `<public-ip>.sslip.io` with no setup at all. `SITE_ADDRESS` uses that name, and Caddy needs it to issue the certificate.

If another service already listens on 443 on one interface, such as a Tailscale address, set `PUBLIC_BIND_IP` to the machine's LAN or private IP so only that address is bound.

## 3. Secrets

```sh
cp .env.prod.example .env.prod
```

Fill every value. `SITE_ADDRESS` is the DuckDNS name without a scheme. `JWT_SECRET` must be at least 32 characters.

## 4. Broker users

The production broker refuses anonymous clients, so create one user for the backend and one per device.

```sh
docker run --rm -it -v "$PWD/mosquitto/config:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -c -b /m/passwd backend 'the-backend-password'

docker run --rm -it -v "$PWD/mosquitto/config:/m" eclipse-mosquitto:2 \
  mosquitto_passwd -b /m/passwd node1 'the-node1-password'
```

Use the same backend password in `MQTT_BACKEND_PASSWORD`.

## 5. Migration

PostgreSQL only runs `001_initial_schema.sql` on a fresh volume. Apply the later migrations before the first start, and again after any pull that adds one:

```sh
for file in 004_device_curfew 005_guard_mode 006_curfew_minutes; do
  docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres
  docker exec -i warehouse-prod-postgres-1 psql -U warehouse_app -d warehouse_db \
    < "../backend/migrations/$file.sql"
done
```

Every file is idempotent.

## 6. Start

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec \
  -e SEED_ADMIN_PASSWORD='...' -e SEED_OPERATOR_PASSWORD='...' -e SEED_VIEWER_PASSWORD='...' \
  backend npm run seed
```

Check `https://<SITE_ADDRESS>/health`. It must report Postgres, Mongo and MQTT connected.

## 7. Firmware

Point the boards at the host and give them the broker user:

```cpp
const char* mqtt_server = "<SITE_ADDRESS>";
if (client.connect("NODE1_ENV", "node1", "the-node1-password")) {
```

Node 2 also receives `guard_mode on/off` from the backend according to the curfew set on its device page. The backend re-sends it on every heartbeat and whenever the config is saved.

Port 1883 is plaintext in this setup. Moving to 8883 with TLS means `WiFiClientSecure` plus the CA certificate, and closing 1883.

## 8. Update

```sh
cd warehouse-iot-monitoring
git fetch origin
git reset --hard origin/main

cd deployments
# run any new migration first
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build backend web
```

For a frontend-only change, avoid recreating the backend:

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps --build web
```

## Notes

- Caddy serves the built frontend, proxies `/api` and upgrades `/ws`.
- Postgres and Mongo have no published ports, so only the proxy and the broker are reachable.
- The relay service is not part of this file. Devices publish here directly.
- Rotate the seeded accounts after the first check, and remember `POST /api/auth/login` has no rate limit.
- `OFFLINE_TIMEOUT_SECONDS` defaults to 30. Raise it to 35–40 if a board ever sends only heartbeats every 30 seconds.
- Full runbook, backups and troubleshooting: [../docs/operations.md](../docs/operations.md).
