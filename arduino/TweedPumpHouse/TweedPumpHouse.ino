/**
 * ============================================================================
 * TWEED BLVD / ROUTE 9W WATER PUMP HOUSE SYSTEM
 * WT32-SC01 ESP32 Controller with BLE & Cloud Web Sync
 * ============================================================================
 * 
 * ARDUINO IDE COMPILATION INSTRUCTIONS:
 * -------------------------------------
 * 1. Required Libraries (Install via Arduino Library Manager or ZIP):
 *    - LovyanGFX (by lovyan03) v1.1.16+
 *    - ArduinoJson (by Benoit Blanchon) v7.0.4+
 *    - DHT sensor library (by Adafruit) v1.4.6+
 *    - Adafruit Unified Sensor (by Adafruit) v1.1.14+
 *    - ESPAsyncWebServer (https://github.com/me-no-dev/ESPAsyncWebServer)
 *    - AsyncTCP (https://github.com/me-no-dev/AsyncTCP)
 * 
 * 2. Arduino IDE Board Settings (Tools menu):
 *    - Board: "ESP32 Wrover Module" (or "ESP32 Dev Module")
 *    - PSRAM: "Enabled"
 *    - Flash Size: "4MB (32Mb)"
 *    - Flash Frequency: "80MHz"
 *    - Partition Scheme: "Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)" or "Huge APP (3MB No OTA/1MB SPIFFS)"
 *    - Core Debug Level: "None" (or "Info")
 *    - Upload Speed: "921600"
 * ============================================================================
 */

#include <Arduino.h>
#include "config.h"
#include "controller.h"
#include "display_gui.h"
#include "ble_service.h"
#include "web_sync.h"

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=======================================================");
    Serial.println("  TWEED BLVD / ROUTE 9W WATER PUMP HOUSE SYSTEM");
    Serial.println("  WT32-SC01 ESP32 Controller with BLE & Cloud Web Sync");
    Serial.println("=======================================================\n");

    // 1. Initialize Hardware Sensors & Actuators
    systemController.begin();
    Serial.println("[SYSTEM] Controller core and relay drivers initialized.");

    // 2. Initialize WT32-SC01 3.5\" Touchscreen GUI
    displayGui.begin();
    Serial.println("[LCD] WT32-SC01 LovyanGFX display & touch initialized.");

    // 3. Initialize Bluetooth Low Energy (BLE) GATT Service
    bleManager.begin();

    // 4. Initialize WiFi, Local Web Server & Cloud Webhook Sync
    webSyncManager.begin();

    Serial.println("[SYSTEM] All modules operational. Starting main loop...\n");
}

void loop() {
    // 1. Process Hardware Sensors & State Machine Automation
    systemController.update();

    // 2. Extract Current Telemetry JSON
    String telemetryJson = systemController.getTelemetryJson();

    // 3. Update Bluetooth GATT notifications (if phone/app is connected via Web Bluetooth)
    bleManager.update(telemetryJson);

    // 4. Update Web Sync & Cloud Push (if connected to WiFi / Netlify endpoint)
    webSyncManager.update(telemetryJson);

    // 5. Update WT32-SC01 On-Screen Touch Display & Handle Touch Presses
    displayGui.update(
        systemController.getTelemetry(), 
        webSyncManager.isWiFiConnected(), 
        bleManager.isClientConnected()
    );

    // Short yield for ESP32 background tasks (WiFi, BLE, RTOS)
    delay(10);
}
