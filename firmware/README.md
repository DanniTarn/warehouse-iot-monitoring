# Firmware

Two ESP32 sketches:

- `node1-environment/node1-environment.ino` reads DHT22 and MQ-2, drives the fan relay, runs local fire rules, and triggers the security node.
- `node2-security/node2-security.ino` reads the door switch and PIR, drives the buzzer and status LED, and runs local alarm rules.

## Arduino IDE

1. Install the ESP32 core. Boards Manager URL: `https://espressif.github.io/arduino-esp32/package_esp32_index.json`. Board: **ESP32 Dev Module**.
2. Install these libraries:
   - **WiFiManager** (tzapu)
   - **PubSubClient** (Nick O'Leary)
   - **ArduinoJson 6.x**, not 7.x. The sketches use `StaticJsonDocument`.
   - Node 1 only: **DHT sensor library**, **Adafruit Unified Sensor**, **Adafruit GFX Library**, **Adafruit SSD1306**.
3. In the sketch folder, copy `secrets.example.h` to `secrets.h` and fill every value for that one board. `secrets.h` is gitignored; never commit it.
4. Select the port and upload. Open Serial Monitor at **115200**.

## Per-board configuration

Everything specific to a board lives in `secrets.h`:

```cpp
#define DEVICE_CODE "NODE3_ENV"    // must match the code registered in the app
#define DEVICE_TOKEN "..."          // shown once on the device page
#define MQTT_HOST "158.178.229.252"
#define MQTT_PORT 1883
#define MQTT_USER "node3"           // broker user created on the VPS
#define MQTT_PASS "..."
```

Node 1 also has `SEC_CODE`, the security node it tells to sound the buzzer on fire.

The sketch derives the MQTT client ID, the setup access point name, and the ACK, telemetry and command topics from `DEVICE_CODE`. One code change per board is a mistake waiting to happen otherwise.

## First boot

The board starts an access point named `ESP32_<DEVICE_CODE>_Setup`. Connect from a phone, pick the warehouse Wi-Fi, and save. The board then connects to the broker.

Check in the app: the device should receive telemetry within 5 seconds and report online. If it stays offline, check the broker user and that the board can reach port 1883 on the server.

## Troubleshooting

- **Compile error about `secrets.h`**: copy `secrets.example.h` to `secrets.h` in that sketch folder.
- **Compile error about `DEVICE_CODE`**: the copy is incomplete; fill every key.
- **MQTT never connects**: wrong `MQTT_HOST`, `MQTT_USER` or `MQTT_PASS`, or the network blocks outbound 1883.
- **Telemetry never appears although the broker is connected**: the device code is not registered and activated, the token is wrong, or the backend runs with `DEVICE_AUTH_REQUIRED=true` and the payload has no valid token.
- **Two boards keep disconnecting each other**: both share a `DEVICE_CODE`. Every board needs its own code, which also makes the MQTT client ID unique.
- **Node 1 freezes at boot**: `setup()` halts when the SSD1306 display is not found. Flash a board that has the OLED, or remove the display initialization for a board without one.
