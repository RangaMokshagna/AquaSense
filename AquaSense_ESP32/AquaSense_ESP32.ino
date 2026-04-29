/*
 * AquaSense ESP32 Firmware — Single File Version
 * ─────────────────────────────────────────────────
 * Open THIS FILE ONLY in Arduino IDE.
 * No other files needed.
 *
 * Libraries to install (Tools → Manage Libraries):
 *   1. OneWire           by Paul Stoffregen
 *   2. DallasTemperature by Miles Burton
 *   3. ArduinoJson       by Benoit Blanchon  ← install v6.x NOT v7
 *
 * Board: Tools → Board → ESP32 Dev Module
 * ─────────────────────────────────────────────────
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ═══════════════════════════════════════════════════
//   STEP 1: Edit these settings before uploading
// ═══════════════════════════════════════════════════
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#define WIFI_SSID      "vivo X200"         // Exact 2.4 GHz WiFi/hotspot name
#define WIFI_PASSWORD  "********"         // Exact WiFi/hotspot password

// Run ipconfig in PowerShell → find IPv4 Address under WiFi adapter
#define BACKEND_IP     "10.150.241.1"     // ← your PC's IP address
#define BACKEND_PORT   5000

#define API_KEY        "changeme"
#define DEVICE_ID      "esp32-sensor-01"

// How often to send a reading (seconds)
#define SEND_INTERVAL  5

// ═══════════════════════════════════════════════════
//   STEP 2: Wiring — confirm these pin numbers match
// ═══════════════════════════════════════════════════

#define PIN_TEMP       4    // DS18B20  DATA wire  (+ 4.7kΩ between DATA and 3.3V)
#define PIN_TURBIDITY  34   // QBM      AOUT wire  (analog input only)
#define PIN_PH         35   // pH probe AOUT wire  (analog input only)

// ═══════════════════════════════════════════════════
//   STEP 3: Calibration values
//   Run ph_calibration.ino first to measure your voltages
// ═══════════════════════════════════════════════════

// pH calibration — dip probe in buffer solutions and note voltages
#define PH_VOLTAGE_AT_7   2.50    // Voltage when probe is in pH 7.0 buffer
#define PH_VOLTAGE_AT_4   3.05    // Voltage when probe is in pH 4.0 buffer

// Turbidity calibration — measure voltage in clear tap water
// Higher voltage = cleaner water (QBM sensor behaviour)
#define TURB_VOLTAGE_CLEAR  3.065  // Voltage in clear water (0 NTU)
                                   // ← update this after measuring your sensor
#define TURB_NTU_PER_VOLT   550.0  // NTU per 1 volt drop from clear water

// ═══════════════════════════════════════════════════
//   DO NOT EDIT BELOW THIS LINE
// ═══════════════════════════════════════════════════

OneWire           oneWire(PIN_TEMP);
DallasTemperature tempSensor(&oneWire);

unsigned long lastSendTime = 0;
int           readingCount = 0;

// pH slope calculated from two-point calibration
float phSlope = (7.0 - 4.0) / (PH_VOLTAGE_AT_4 - PH_VOLTAGE_AT_7);

// ─────────────────────────────────────────────────
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // disable brownout
  Serial.begin(115200);
  delay(500);

  Serial.println("\n================================");
  Serial.println("  AquaSense ESP32  v1.0");
  Serial.println("================================");
  Serial.printf("  Device  : %s\n", DEVICE_ID);
  Serial.printf("  Backend : http://%s:%d\n", BACKEND_IP, BACKEND_PORT);
  Serial.println();

  // Configure ADC — 12-bit resolution, 0–3.3V range
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Start DS18B20 temperature sensor
  tempSensor.begin();
  tempSensor.setResolution(12);  // 12-bit = 0.0625°C precision
  int found = tempSensor.getDeviceCount();
  Serial.printf("[DS18B20] Found %d sensor(s)\n", found);
  if (found == 0) {
    Serial.println("[DS18B20] WARNING: none found!");
    Serial.println("           Check GPIO4 wiring and 4.7kΩ resistor");
  }

  // Connect to WiFi
  connectWiFi();

  // Warm up all sensors — takes 3 readings to stabilise
  Serial.println("[Warmup] Stabilising sensors (3 readings)...");
  for (int i = 0; i < 3; i++) {
    tempSensor.requestTemperatures();
    delay(900);
  }

  Serial.printf("\n[Ready] Sending every %ds\n\n", SEND_INTERVAL);
}

// ─────────────────────────────────────────────────
void loop() {
  // Reconnect WiFi if connection dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost — reconnecting...");
    connectWiFi();
  }

  unsigned long now = millis();
  if (now - lastSendTime >= (SEND_INTERVAL * 1000UL)) {
    lastSendTime = now;

    // Request temperature conversion (takes ~750ms at 12-bit resolution)
    tempSensor.requestTemperatures();
    delay(800);

    float temperature = readTemperature();
    float turbidity   = readTurbidity();
    float ph          = readPH();

    readingCount++;
    Serial.println("─────────────────────────────────");
    Serial.printf("[#%d] pH:          %.2f\n",    readingCount, ph);
    Serial.printf("[#%d] Turbidity:   %.2f NTU\n", readingCount, turbidity);
    Serial.printf("[#%d] Temperature: %.1f C\n",   readingCount, temperature);

    // Skip sending if DS18B20 is disconnected
    if (temperature < -100.0) {
      Serial.println("[SKIP] Temperature error — check DS18B20 wiring");
      return;
    }

    if (WiFi.status() == WL_CONNECTED) {
      sendReading(ph, turbidity, temperature);
    } else {
      Serial.println("[SKIP] No WiFi connection");
    }
  }
}

// ─────────────────────────────────────────────────
// Read DS18B20 temperature sensor (OneWire digital)
// ─────────────────────────────────────────────────
float readTemperature() {
  float t = tempSensor.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) {
    Serial.println("[Temp]  ERROR: sensor disconnected!");
    return -999.0;
  }
  return t;
}

// ─────────────────────────────────────────────────
// Read QBM turbidity sensor (analog on GPIO34)
// ─────────────────────────────────────────────────
float readTurbidity() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(PIN_TURBIDITY);
    delay(5);
  }
  float adc     = sum / 10.0;
  float voltage = (adc / 4095.0) * 3.3;

  // Higher voltage = cleaner water
  // NTU = (clear water voltage - measured voltage) × slope
  float ntu = (TURB_VOLTAGE_CLEAR - voltage) * TURB_NTU_PER_VOLT;
  ntu = constrain(ntu, 0.0, 3000.0);

  Serial.printf("[Turb]  ADC=%.0f  V=%.3f  NTU=%.2f\n", adc, voltage, ntu);
  return ntu;
}

// ─────────────────────────────────────────────────
// Read analog pH sensor (analog on GPIO35)
// ─────────────────────────────────────────────────
float readPH() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(PIN_PH);
    delay(5);
  }
  float adc     = sum / 10.0;
  float voltage = (adc / 4095.0) * 3.3;

  // Two-point calibration formula
  // pH = 7.0 + (V_at_7 - V_measured) × slope
  float ph = 7.0 + (PH_VOLTAGE_AT_7 - voltage) * phSlope;
  ph = constrain(ph, 0.0, 14.0);

  Serial.printf("[pH]    ADC=%.0f  V=%.3f  pH=%.2f\n", adc, voltage, ph);
  return ph;
}

// ─────────────────────────────────────────────────
// Connect to WiFi with clean reconnect
// ─────────────────────────────────────────────────
const char* wifiStatusName(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "idle";
    case WL_NO_SSID_AVAIL:
      return "ssid not found";
    case WL_SCAN_COMPLETED:
      return "scan completed";
    case WL_CONNECTED:
      return "connected";
    case WL_CONNECT_FAILED:
      return "connect failed / wrong password";
    case WL_CONNECTION_LOST:
      return "connection lost";
    case WL_DISCONNECTED:
      return "disconnected";
    default:
      return "unknown";
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.disconnect(false, true);
  delay(500);

  Serial.printf("[WiFi]  Scanning for %s...\n", WIFI_SSID);
  int networkCount = WiFi.scanNetworks(false, true);
  bool foundNetwork = false;

  for (int i = 0; i < networkCount; i++) {
    if (WiFi.SSID(i) == WIFI_SSID) {
      foundNetwork = true;
      Serial.printf("[WiFi]  Found %s  RSSI: %d dBm  Channel: %d  Encryption: %d\n",
                    WIFI_SSID, WiFi.RSSI(i), WiFi.channel(i), WiFi.encryptionType(i));
      break;
    }
  }

  WiFi.scanDelete();

  if (!foundNetwork) {
    Serial.println("[WiFi]  Network not found. Check SSID, hotspot visibility, and 2.4 GHz mode.");
  }

  Serial.printf("[WiFi]  Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 20000UL) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" OK\n[WiFi]  IP: %s  RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    wl_status_t status = WiFi.status();
    Serial.printf(" FAILED\n[WiFi]  Status: %d (%s)\n", status, wifiStatusName(status));
    Serial.println("[WiFi]  Tip: ESP32 needs a 2.4 GHz WiFi/hotspot and the exact password.");
  }
}

// ─────────────────────────────────────────────────
// Send reading to Node.js backend via HTTP POST
// ─────────────────────────────────────────────────
void sendReading(float ph, float turbidity, float temperature) {
  String url = String("http://") + BACKEND_IP + ":" + BACKEND_PORT + "/api/readings";

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["deviceId"]    = DEVICE_ID;
  doc["ph"]          = serialized(String(ph, 2));
  doc["turbidity"]   = serialized(String(turbidity, 2));
  doc["temperature"] = serialized(String(temperature, 1));
  doc["source"]      = "esp32";

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);
  http.setTimeout(8000);

  Serial.printf("[HTTP]  POST %s\n", url.c_str());
  int code = http.POST(payload);

  if (code == 201) {
    String resp = http.getString();
    StaticJsonDocument<512> respDoc;
    if (deserializeJson(respDoc, resp) == DeserializationError::Ok) {
      const char* quality = respDoc["prediction"]["qualityClass"];
      float       wqi     = respDoc["prediction"]["wqiScore"];
      int         alerts  = respDoc["alerts"].size();
      Serial.printf("[OK]   Quality=%s  WQI=%.0f  Alerts=%d\n",
                    quality ? quality : "?", wqi, alerts);
    } else {
      Serial.println("[OK]   201 received");
    }
  } else if (code > 0) {
    Serial.printf("[ERR]  HTTP error: %d\n", code);
  } else {
    Serial.printf("[ERR]  No response from %s:%d\n", BACKEND_IP, BACKEND_PORT);
    Serial.println("[ERR]  Is the backend running? Try: npm run dev");
    Serial.println("[ERR]  Is BACKEND_IP your PC's IPv4 address?");
  }

  http.end();
} 
