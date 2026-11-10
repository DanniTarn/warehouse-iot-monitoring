#include <WiFi.h>
#include <WiFiManager.h>      
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "DHT.h"
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "secrets.h"

#ifndef DEVICE_CODE
#error "secrets.h thiếu DEVICE_CODE."
#endif
#ifndef DEVICE_TOKEN
#error "secrets.h thiếu DEVICE_TOKEN."
#endif
#ifndef SEC_CODE
#error "secrets.h thiếu SEC_CODE cho liên kết báo cháy sang Node an ninh."
#endif
#ifndef MQTT_HOST
#error "secrets.h thiếu MQTT_HOST, MQTT_USER và MQTT_PASS."
#endif

// ================= TOPIC DẪN XUẤT TỪ DEVICE_CODE =================
const String topicAck = String("khohang/") + DEVICE_CODE + "/ack";
const String topicTelemetry = String("khohang/") + DEVICE_CODE + "/telemetry";
const String topicCommand = String("khohang/") + DEVICE_CODE + "/command";
const String topicSecCommand = String("khohang/") + SEC_CODE + "/command";
const char* heartbeatTopic = "khohang/heartbeat";

// ================= CẤU HÌNH PHẦN CỨNG =================
#define DHTPIN 4
#define DHTTYPE DHT22
#define MQ2PIN 34
#define RELAYPIN 5
#define BOOT_PIN 0          // Nút Reset Wi-Fi
#define FAN_BUTTON_PIN 15   // Nút bật/tắt quạt thủ công
#define LEDPIN 2            // Đèn báo kết nối MQTT

// ================= CẤU HÌNH OLED =================
#define SCREEN_WIDTH 128 
#define SCREEN_HEIGHT 64 
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

DHT dht(DHTPIN, DHTTYPE);
WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastOledUpdate = 0;

unsigned long bootPressStartTime = 0;
bool isBootHeld = false;

// Biến trạng thái nút nhấn & quạt
bool relayState = false; // Mặc định là TẮT
int lastButtonState = HIGH;
int currentButtonState = HIGH;
unsigned long lastDebounceTime = 0;
unsigned long debounceDelay = 50; 

// ================= BIẾN CẤU HÌNH EDGE COMPUTING =================
float threshold_t = 50.0; // Ngưỡng nhiệt độ
float threshold_h = 65.0; // Ngưỡng độ ẩm
int threshold_gas = 800;  // Ngưỡng khí gas

// ---------------- HÀM CẬP NHẬT MÀN HÌNH OLED ----------------
void updateOLED(float t, float h, int gas) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.print("WIFI: ");
  display.println(WiFi.status() == WL_CONNECTED ? "Da ket noi" : "Mat K/N");

  display.setCursor(0, 15);
  display.print("Nhiet do: "); display.print(t, 1); display.println(" C");
  
  display.setCursor(0, 25);
  display.print("Do am: "); display.print(h, 1); display.println(" %");

  display.setCursor(0, 35);
  display.print("Khi gas: "); display.println(gas);

  display.setCursor(0, 48);
  display.print("QUAT: "); 
  display.println(relayState ? "DANG BAT" : "DANG TAT");

  display.display();
}

// ---------------- HÀM XÁC NHẬN TRẠNG THÁI QUẠT ----------------
void publishFanState() {
  StaticJsonDocument<256> ackDoc;
  ackDoc["device_id"] = DEVICE_CODE;
  ackDoc["status"] = relayState ? "FAN_ON_ACK" : "FAN_OFF_ACK";
  ackDoc["token"] = DEVICE_TOKEN;
  char ackBuffer[320];
  serializeJson(ackDoc, ackBuffer);
  client.publish(topicAck.c_str(), ackBuffer);
}

// ---------------- HÀM NHẬN LỆNH TỪ MQTT ----------------
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (error) return;

  // 1. Lệnh điều khiển quạt từ Web
  if (doc.containsKey("fan")) {
    String cmd = doc["fan"];
    if (cmd == "on") {
      digitalWrite(RELAYPIN, LOW); // Kéo xuống GND -> Relay ĐÓNG
      relayState = true;
    } else if (cmd == "off") {
      digitalWrite(RELAYPIN, HIGH); // Thả nổi chân -> Relay NGẮT
      relayState = false;
    }
    updateOLED(dht.readTemperature(), dht.readHumidity(), analogRead(MQ2PIN));
    publishFanState();
  }

  // 2. Lệnh cập nhật ngưỡng cấu hình Edge Computing
  if (doc.containsKey("threshold_t")) {
    threshold_t = doc["threshold_t"];
    Serial.print("Web da doi nguong NHIET DO thanh: "); 
    Serial.println(threshold_t);
  }
  if (doc.containsKey("threshold_h")) {
    threshold_h = doc["threshold_h"];
    Serial.print("Web da doi nguong DO AM thanh: "); 
    Serial.println(threshold_h);
  }
  if (doc.containsKey("threshold_gas")) {
    threshold_gas = doc["threshold_gas"];
    Serial.print("Web da doi nguong KHI GAS thanh: "); 
    Serial.println(threshold_gas);
  }
}

void reconnect() {
  if (!client.connected()) {
    if (client.connect(DEVICE_CODE, MQTT_USER, MQTT_PASS)) {
      client.subscribe(topicCommand.c_str());
      digitalWrite(LEDPIN, HIGH); 
    } else {
      digitalWrite(LEDPIN, LOW); 
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  // FIX LỖI RÒ ĐIỆN 5V BẰNG OPEN DRAIN
  pinMode(RELAYPIN, OUTPUT_OPEN_DRAIN); 
  digitalWrite(RELAYPIN, HIGH); // Khởi động TẮT quạt (Thả nổi)
  
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);
  
  pinMode(BOOT_PIN, INPUT_PULLUP);
  pinMode(FAN_BUTTON_PIN, INPUT_PULLUP);

  dht.begin();

  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("Loi: Khong tim thay OLED"));
    for(;;); 
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,20);
  display.println("Khoi dong Node 1...");
  display.display();

  // ================= TỐI ƯU WIFIMANAGER (KHÔNG TREO) =================
  WiFiManager wm;
  wm.setConfigPortalTimeout(20); // Chỉ chờ 20 giây, không có mạng sẽ đi tiếp
  String apName = String("ESP32_") + DEVICE_CODE + "_Setup";
  
  if (!wm.autoConnect(apName.c_str())) {
    Serial.println("Khong co Wi-Fi! Chuyen sang che do OFFLINE (Edge Computing).");
  } else {
    Serial.println("Da ket noi Wi-Fi!");
  }
  
  client.setServer(MQTT_HOST, MQTT_PORT);
  client.setCallback(mqttCallback);
}

void loop() {
  // ================= 1. NÚT RESET WI-FI (GIỮ 3S) =================
  if (digitalRead(BOOT_PIN) == LOW) { 
    if (!isBootHeld) {
      isBootHeld = true;
      bootPressStartTime = millis(); 
    } else if (millis() - bootPressStartTime > 3000) {
      display.clearDisplay();
      display.setCursor(0,25);
      display.println("DANG XOA WIFI...");
      display.display();
      WiFiManager wm;
      wm.resetSettings(); 
      delay(1000);
      ESP.restart(); 
    }
  } else {
    isBootHeld = false; 
  }

  // ================= 2. NÚT BẬT/TẮT QUẠT THỦ CÔNG =================
  int reading = digitalRead(FAN_BUTTON_PIN);
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  if ((millis() - lastDebounceTime) > debounceDelay) {
    if (reading != currentButtonState) {
      currentButtonState = reading;
      if (currentButtonState == LOW) { 
        relayState = !relayState; 
        digitalWrite(RELAYPIN, relayState ? LOW : HIGH); 
        updateOLED(dht.readTemperature(), dht.readHumidity(), analogRead(MQ2PIN));
        if (client.connected()) {
          publishFanState(); 
        }
      }
    }
  }
  lastButtonState = reading;

  // ================= 3. DUY TRÌ KẾT NỐI MQTT =================
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      reconnect();
    }
    client.loop(); 
  }

  unsigned long now = millis();
  
  // Đọc cảm biến
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  int gas = analogRead(MQ2PIN);

  // ================= 4. EDGE COMPUTING (XỬ LÝ TẠI CHỖ TỐI ƯU) =================
  if (!isnan(h) && !isnan(t)) {
    
    // KỊCH BẢN 1: CÓ CHÁY (Nhiệt độ hoặc Khí Gas vượt ngưỡng)
    if (t > threshold_t || gas > threshold_gas) {
      
      // 1. Phải TẮT quạt ngay lập tức để ngắt nguồn oxy
      if (relayState) { 
        relayState = false;
        digitalWrite(RELAYPIN, HIGH); 
      }
      
      // 2. Bắn lệnh MQTT chéo sang Node 2 yêu cầu HÚ CÒI
      if (client.connected()) {
        client.publish(topicSecCommand.c_str(), "{\"alarm\":\"on\"}");
      }
      
      updateOLED(t, h, gas);       
      Serial.println("EDGE COMPUTING: CHAY KHO! Da tat quat & Goi Node 2 hu coi!");
    } 
    
    // KỊCH BẢN 2: CHỈ BỊ ẨM MỐC (Độ ẩm cao, Nhiệt và Khói an toàn)
    else if (h > threshold_h) {
      if (!relayState) { 
        relayState = true;
        digitalWrite(RELAYPIN, LOW); // Bật quạt hút ẩm
        updateOLED(t, h, gas);       
        Serial.println("EDGE COMPUTING: Do am cao, tu dong bat quat.");
      }
    } 
    
    // KỊCH BẢN 3: MÔI TRƯỜNG AN TOÀN
    else {
      if (relayState) {
        relayState = false;
        digitalWrite(RELAYPIN, HIGH); // Tắt quạt
        updateOLED(t, h, gas);
        Serial.println("EDGE COMPUTING: Da an toan, tu dong tat quat.");
      }
    }
  }

  // ================= 5. CẬP NHẬT OLED ĐỊNH KỲ =================
  if (now - lastOledUpdate > 2000) {
    lastOledUpdate = now;
    updateOLED(t, h, gas);
  }

  // ================= 6. GỬI TELEMETRY & HEARTBEAT =================
  if (now - lastMsg > 5000) {
    lastMsg = now;

    if (!isnan(h) && !isnan(t)) {
      StaticJsonDocument<384> doc;
      doc["device_id"] = DEVICE_CODE;
      doc["token"] = DEVICE_TOKEN;
      doc["temperature"] = t;
      doc["humidity"] = h;
      doc["smoke_level"] = gas;
      doc["fan_state"] = relayState ? "ON" : "OFF";
      
      char jsonBuffer[640];
      serializeJson(doc, jsonBuffer);
      
      if (client.connected()) {
        client.publish(topicTelemetry.c_str(), jsonBuffer);
      }
    }
  }

  if (now - lastHeartbeat > 30000) {
    lastHeartbeat = now;
    StaticJsonDocument<256> hbDoc;
    hbDoc["device_id"] = DEVICE_CODE;
    hbDoc["status"] = "online";
    hbDoc["token"] = DEVICE_TOKEN;
    char hbBuffer[384];
    serializeJson(hbDoc, hbBuffer);
    
    if (client.connected()) {
      client.publish(heartbeatTopic, hbBuffer);
    }
  }
}