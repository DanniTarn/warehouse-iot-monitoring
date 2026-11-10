# Deploy the full stack

One small Linux VM with a public IP runs everything: Postgres, MongoDB, Mosquitto, the API and the built frontend behind Caddy.

## 1. Host

Oracle Cloud Always Free is enough. As of June 2026 it gives 2 OCPUs and 12 GB RAM on Ampere A1, plus a public IPv4. Pick a region with Ampere capacity, Ubuntu 24.04, and note the public IP.

Open these TCP ports in the cloud security list and in the host firewall: 22, 80, 443, 1883, 8883. 1883 is temporary until every board moves to TLS.

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

Each sketch reads everything board-specific from `secrets.h`, created from `secrets.example.h` in the same folder:

```cpp
#define DEVICE_CODE "NODE1_ENV"
#define DEVICE_TOKEN "the-token-shown-once-in-the-app"
#define MQTT_HOST "SITE_ADDRESS"
#define MQTT_PORT 8883
#define MQTT_USER "node1"
#define MQTT_PASS "the-node1-password"

// Node 1 only, the security node it triggers on fire:
#define SEC_CODE "NODE2_SEC"
```

Topics, payload `device_id`, MQTT client ID and the setup access point all derive from `DEVICE_CODE`. Flash one board per `secrets.h`; no other edit is needed. `secrets.h` is gitignored.

The broker refuses anonymous clients, so use the per-device user created in step 4. It also enforces a topic ACL from `mosquitto/config/acl`: a device may only publish its own telemetry and ACK, read its own command topic, and write the shared heartbeat topic. Node 1 also has write access to Node 2's command topic for its local fire trigger. The backend user may read all telemetry, ACK and heartbeat topics and write command topics.

Adding a device means adding a block for its broker user to that ACL file and restarting Mosquitto. A device without an ACL block authenticates but its publishes and subscriptions are silently dropped.

Boards flashed before token enforcement must be reflashed. To avoid a gap, set `DEVICE_AUTH_REQUIRED=false` in `.env.prod`, deploy, reflash each node, then set it back to `true`.

Node 2 also receives `guard_mode on/off` from the backend according to the curfew set on its device page. The backend re-sends it on every heartbeat and whenever the config is saved.

Devices connect over TLS on 8883 using the Let's Encrypt certificate Caddy already renews. The firmware embeds ISRG Root X1 in `mqtt-ca.h` and verifies the hostname, so `MQTT_HOST` must be `SITE_ADDRESS`, not the IP. The plaintext listener on 1883 stays for the backend container and for boards that have not been reflashed; remove its host port mapping once every board is on 8883.

Mosquitto reads Caddy's certificate directly from the `caddy_data` volume. A daily systemd timer sends it SIGHUP so it picks up renewals without a restart:

```sh
sudo install -m 644 deployments/systemd/mosquitto-cert-reload.service /etc/systemd/system/
sudo install -m 644 deployments/systemd/mosquitto-cert-reload.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mosquitto-cert-reload.timer
```

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

## 9. Automatic deploys

A systemd timer on the host checks `origin/main` every minute and runs `/usr/local/sbin/warehouse-deploy`. When the recorded SHA differs, the script fetches, applies the idempotent migrations, rebuilds only the services whose files changed, and waits for the API health check and the public site. It writes the deployed SHA to `~/workspace/.warehouse-deployed-sha` only after both checks pass, so a failed build or a sick container is retried on the next tick.

The host pulls instead of GitHub pushing because the Oracle security list does not admit the Actions runners on port 22. `.github/workflows/ci.yml` still runs lint, tests and both builds on every push and pull request. If port 22 is opened to the runner ranges later, a push-based job can call the same script over SSH without changing the deploy logic.

Install once on the host:

```sh
sudo install -m 755 deployments/deploy.sh /usr/local/sbin/warehouse-deploy
sudo install -m 644 deployments/systemd/warehouse-deploy.service /etc/systemd/system/
sudo install -m 644 deployments/systemd/warehouse-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warehouse-deploy.timer
```

Inspect the pipeline:

```sh
systemctl list-timers warehouse-deploy.timer
journalctl -u warehouse-deploy -n 50
```

The checkout must track the branch that receives merges, and the script resets it to `origin/main` on every deploy. A manual deploy is `sudo systemctl start warehouse-deploy.service` or `/usr/local/sbin/warehouse-deploy`. Run it as the user that owns the checkout, so git does not leave root-owned files behind.

## Notes

- Caddy serves the built frontend, proxies `/api` and upgrades `/ws`.
- Postgres and Mongo have no published ports, so only the proxy and the broker are reachable.
- The relay service is not part of this file. Devices publish here directly.
- Rotate the seeded accounts after the first check, and remember `POST /api/auth/login` has no rate limit.
- `OFFLINE_TIMEOUT_SECONDS` defaults to 30. Raise it to 35–40 if a board ever sends only heartbeats every 30 seconds.
- Full runbook, backups and troubleshooting: [../docs/operations.md](../docs/operations.md).
