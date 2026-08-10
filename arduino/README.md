# Tweed Pump House — Arduino IDE Firmware Setup

This directory contains the firmware packaged specifically for direct compilation and flashing using the standard **Arduino IDE (v2.x or v1.8.x)**.

---

## 📂 Sketch Location

Open the main sketch file in Arduino IDE:
👉 **`arduino/TweedPumpHouse/TweedPumpHouse.ino`**

When you open `TweedPumpHouse.ino`, Arduino IDE will automatically load the accompanying source files in neighboring tabs:
- `config.h` — Hardware GPIO mapping, sensor thresholds, WiFi/BLE credentials
- `controller.h` / `controller.cpp` — State machine and relay automation logic
- `display_gui.h` / `display_gui.cpp` — WT32-SC01 (ST7796 3.5" LCD + FT6336U Touch) GUI
- `ble_service.h` / `ble_service.cpp` — Web Bluetooth GATT server
- `web_sync.h` / `web_sync.cpp` — Local web server & cloud webhook synchronization

---

## 🛠️ Arduino IDE Board Settings

From the **Tools** menu in Arduino IDE, select:

| Setting | Recommended Value |
|---|---|
| **Board** | `ESP32 Wrover Module` *(or `ESP32 Dev Module`)* |
| **PSRAM** | `Enabled` *(Important for WT32-SC01 graphics buffer)* |
| **Flash Size** | `4MB (32Mb)` |
| **Flash Frequency** | `80MHz` |
| **Partition Scheme** | `Minimal SPIFFS (1.9MB APP with OTA/190KB SPIFFS)` or `Huge APP (3MB No OTA/1MB SPIFFS)` |
| **Upload Speed** | `921600` *(or `115200` if connection is unstable)* |
| **Core Debug Level** | `None` (or `Info` / `Verbose` for serial debugging) |
| **Port** | Select the COM port connected to the WT32-SC01 |

---

## 📦 Required Libraries

Install the following libraries via **Tools > Manage Libraries...** (or via GitHub ZIP):

1. **LovyanGFX** (`lovyan03/LovyanGFX`) — v1.1.16 or higher
2. **ArduinoJson** (`Benoit Blanchon`) — v7.0.4 or higher
3. **DHT sensor library** (`Adafruit`) — v1.4.6 or higher
4. **Adafruit Unified Sensor** (`Adafruit`) — v1.1.14 or higher
5. **ESPAsyncWebServer** — [`github.com/me-no-dev/ESPAsyncWebServer`](https://github.com/me-no-dev/ESPAsyncWebServer)
6. **AsyncTCP** — [`github.com/me-no-dev/AsyncTCP`](https://github.com/me-no-dev/AsyncTCP)

---

## 🚀 How to Flash

1. Connect your **WT32-SC01** via USB-C to your computer.
2. Select the correct **COM Port** in Arduino IDE.
3. Click **Upload** (or press `Ctrl + U`).
4. Open the **Serial Monitor** at **115200 baud** to view system initialization logs and telemetry.
