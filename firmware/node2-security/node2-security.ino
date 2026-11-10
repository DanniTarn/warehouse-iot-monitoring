#include <WiFi.h>
#include <WiFiManager.h>      
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "secrets.h"

#ifndef DEVICE_CODE
#error "secrets.h thiếu DEVICE_CODE."
#endif
#ifndef DEVICE_TOKEN
#error "secrets.h thiếu DEVICE_TOKEN."
#endif
#ifndef MQTT_HOST
#error "secrets.h thiếu MQTT_HOST, MQTT_USER và MQTT_PASS."
#endif

// ================= TOPIC DẪN XUẤT TỪ DEVICE_CODE =================
const String topicAck = String("khohang/") + DEVICE_CODE + "/ack";
const String topicTelemetry = String("khohang/") + DEVICE_CODE + "/telemetry";
const String topicCommand = String("khohang/") + DEVICE_CODE + "/command";
const char* heartbeatTopic = "khohang/heartbeat";

// ================= CẤU HÌNH PHẦN CỨNG =================
#define PIR_PIN 13
#define DOOR_PIN 14
#define BUZZER_PIN 27
#define LED_PIN 26
#define BOOT_PIN 0  

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;
unsigned long lastHeartbeat = 0;
unsigned long bootPressStartTime = 0;
unsigned long lastLedBlink = 0;

bool isBootHeld = false;
bool alarmState = false;
bool ledState = false;

int lastDoorState = -1;
int lastPirState = -1;

const unsigned long PIR_WARMUP_TIME = 30000; 

void publishAlarmState() {
  if (client.connected()) {
    StaticJsonDocument<256> ackDoc;
    ackDoc["device_id"] = DEVICE_CODE;
    ackDoc["status"] = alarmState ? "ALARM_ON_ACK" : "ALARM_OFF_ACK";
    ackDoc["token"] = DEVICE_TOKEN;
    char ackBuffer[320];
    serializeJson(ackDoc, ackBuffer);
    client.publish(topicAck.c_str(), ackBuffer);
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);
  
  if (!error && doc.containsKey("alarm")) {
    String cmd = doc["alarm"];
    if (cmd == "on") {
      digitalWrite(BUZZER_PIN, HIGH);
      alarmState = true;
      Serial.println("WEB LENH: BAT COI BAO DONG!");
    } else if (cmd == "off") {
      digitalWrite(BUZZER_PIN, LOW);
      alarmState = false;
      Serial.println("WEB LENH: TAT COI BAO DONG!");
    }
    publishAlarmState();
  }
}

void reconnect() {
  if (!client.connected()) {
    if (client.connect(DEVICE_CODE, MQTT_USER, MQTT_PASS)) {
      client.subscribe(topicCommand.c_str());
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  pinMode(PIR_PIN, INPUT);
  pinMode(DOOR_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BOOT_PIN, INPUT_PULLUP);

  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  Serial.println("Khoi dong Node 2 (An Ninh)...");
  Serial.println("DANG LAM NONG CAM BIEN PIR (30 giay)...");

  WiFiManager wm;
  wm.setConfigPortalTimeout(20);
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
  // 1. NÚT RESET WI-FI
  if (digitalRead(BOOT_PIN) == LOW) { 
    if (!isBootHeld) {
      isBootHeld = true;
      bootPressStartTime = millis(); 
    } else if (millis() - bootPressStartTime > 3000) {
      Serial.println("DANG XOA WIFI...");
      WiFiManager wm;
      wm.resetSettings(); 
      delay(1000);
      ESP.restart(); 
    }
  } else {
    isBootHeld = false; 
  }

  // 2. KẾT NỐI MQTT
  if (WiFi.status() == WL_CONNECTED) {
    if (!client.connected()) {
      reconnect();
    }
    client.loop(); 
  }

  unsigned long now = millis();
  
  // 3. LOGIC ĐÈN BÁO TRẠNG THÁI MẠNG VÀ BÁO ĐỘNG
  if (alarmState) {
    // Khi đang báo động: Đèn LED nhấp nháy liên tục (cùng còi hú)
    if (now - lastLedBlink > 200) { // Nháy nhanh 200ms
      lastLedBlink = now;
      ledState = !ledState;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
    }
  } else {
    // Trạng thái bình thường: Đèn sáng nếu có mạng, chớp chậm nếu mất mạng
    if (client.connected()) {
      digitalWrite(LED_PIN, HIGH); // Sáng liên tục: Sẵn sàng
    } else {
      if (now - lastLedBlink > 1000) { // Nháy chậm 1s báo mất kết nối
        lastLedBlink = now;
        ledState = !ledState;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      }
    }
  }

  // 4. ĐỌC CẢM BIẾN
  int currentDoorState = digitalRead(DOOR_PIN);
  int currentPirState = LOW; 

  if (now > PIR_WARMUP_TIME) {
    currentPirState = digitalRead(PIR_PIN);
  }

  // 5. EDGE COMPUTING (AN NINH)
  if (currentDoorState == HIGH || currentPirState == HIGH) {
    if (!alarmState) {
      alarmState = true;
      digitalWrite(BUZZER_PIN, HIGH);
      
      if (currentDoorState == HIGH) Serial.println("CANH BAO: Phat hien CUA BI MO!");
      if (currentPirState == HIGH) Serial.println("CANH BAO: Phat hien CO CHUYEN DONG!");
      
      publishAlarmState();
    }
  }

  // 6. GỬI TELEMETRY 
  if (currentDoorState != lastDoorState || currentPirState != lastPirState || now - lastMsg > 5000) {
    lastMsg = now;
    lastDoorState = currentDoorState;
    lastPirState = currentPirState;

    StaticJsonDocument<384> doc;
    doc["device_id"] = DEVICE_CODE;
    doc["token"] = DEVICE_TOKEN;
    doc["door_open"] = (currentDoorState == HIGH); 
    doc["motion_detected"] = (now > PIR_WARMUP_TIME) ? (currentPirState == HIGH) : false;
    doc["alarm_state"] = alarmState ? "ON" : "OFF";
    
    char jsonBuffer[640];
    serializeJson(doc, jsonBuffer);
    
    if (client.connected()) {
      client.publish(topicTelemetry.c_str(), jsonBuffer);
    }
  }

  // 7. GỬI HEARTBEAT
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