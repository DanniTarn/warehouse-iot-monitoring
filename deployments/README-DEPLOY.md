# Deploy the full stack

One small Linux VM with a public IP runs everything: Postgres, MongoDB, Mosquitto, the API and the built frontend behind Caddy.

## 1. Host

Oracle Cloud Always Free is enough. As of June 2026 it gives 2 OCPUs and 12 GB RAM on Ampere A1, plus a public IPv4. Pick a region with Ampere capacity, Ubuntu 24.04, and note the public IP.

Open these TCP ports in the cloud security list and in the host firewall: 22, 80, 443, 1883.

## 2. DNS

Point a free DuckDNS subdomain at the public IP. `SITE_ADDRESS` uses that name, and Caddy needs it to issue the certificate.

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

## 5. Start

```sh
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec \
  -e SEED_ADMIN_PASSWORD='...' -e SEED_OPERATOR_PASSWORD='...' -e SEED_VIEWER_PASSWORD='...' \
  backend npm run seed
```

Check `https://<SITE_ADDRESS>/health`. It must report Postgres, Mongo and MQTT connected.

## 6. Firmware

Point the boards at the host and give them the broker user:

```cpp
const char* mqtt_server = "<SITE_ADDRESS>";
if (client.connect("NODE1_ENV", "node1", "the-node1-password")) {
```

Port 1883 is plaintext in this setup. Moving to 8883 with TLS means `WiFiClientSecure` plus the CA certificate, and closing 1883.

## Notes

- Caddy serves the built frontend, proxies `/api` and upgrades `/ws`.
- Postgres and Mongo have no published ports, so only the proxy and the broker are reachable.
- The relay service is not part of this file. Devices publish here directly.
- Rotate the seeded accounts after the first check, and remember `POST /api/auth/login` has no rate limit.
