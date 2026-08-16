# Tweed Pump House — Arduino IDE Firmware Setup

This directory contains the firmware packaged specifically for direct compilation and flashing using the standard **Arduino IDE (v2.x or v1.8.x)** on the **Waveshare ESP32-S3-Touch-LCD-7** development board.

---

## 📂 Sketch Location

Open the main sketch file in Arduino IDE:
👉 **`arduino/TweedPumpHouse/TweedPumpHouse.ino`**

When you open `TweedPumpHouse.ino`, Arduino IDE will automatically load the accompanying source files in neighboring tabs:
- `config.h` — Hardware GPIO mapping, sensor thresholds, WiFi/BLE credentials
- `controller.h` / `controller.cpp` — State machine, audio triggers, and relay automation logic
- `i2s_audio.h` / `i2s_audio.cpp` — MAX98357A I2S DMA audio driver, tone chimes, emergency sirens & robotic voice
- `display_gui.h` / `display_gui.cpp` — Waveshare 7.0" (ST7262 800x480 RGB + GT911 Touch + CH422G Expander) GUI
- `ble_service.h` / `ble_service.cpp` — Web Bluetooth GATT server
- `web_sync.h` / `web_sync.cpp` — Local web server & cloud webhook synchronization

---

## 🛠️ Arduino IDE Board Settings

From the **Tools** menu in Arduino IDE, select:

| Setting | Recommended Value |
|---|---|
| **Board** | `ESP32S3 Dev Module` |
| **USB CDC On Boot** | `Enabled` |
| **CPU Frequency** | `240MHz (WiFi)` |
| **Flash Mode** | `QIO 80MHz` |
| **Flash Size** | `16MB (128Mb)` |
| **Partition Scheme** | `16M Flash (3MB APP/9.9MB FATFS)` or `Huge APP (3MB No OTA/1MB SPIFFS)` |
| **PSRAM** | `OPI PSRAM` *(Important for 800x480 frame buffer)* |
| **Upload Speed** | `921600` *(or `115200` if connection is unstable)* |
| **Core Debug Level** | `None` (or `Info` / `Verbose` for serial debugging) |
| **Port** | Select the COM port connected to the Waveshare board |

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

## 🔊 MAX98357A I2S Mono Audio Amplifier Wiring

| MAX98357A Pin | ESP32-S3 Pin | Function |
|---|---|---|
| **BCLK** | `GPIO 12` | I2S Bit Clock |
| **LRC / WS** | `GPIO 11` | I2S Word Select Clock |
| **DIN** | `GPIO 13` | I2S Serial Audio Data |
| **GAIN** | `GND` (12dB) / Floating (9dB) | Gain configuration |
| **VIN** | `5V` (or `3.3V`) | 3.2W into 4Ω at 5V |
| **GND** | `GND` | Common Ground |
| **Speaker +/-** | 4Ω to 8Ω Speaker | Mono audio transducer |

---

## 🚀 How to Flash

1. Connect your **Waveshare ESP32-S3-Touch-LCD-7** via USB-C to your computer.
2. Select the correct **COM Port** and **ESP32S3 Dev Module** board settings.
3. Click **Upload** (or press `Ctrl + U`).
4. Open the **Serial Monitor** at **115200 baud** to view system initialization logs and telemetry.

---

## ⚡ FCS521-SD-10V AC Current Transmitter & ADS1115 ADC Wiring

| Sensor / Signal | Hardware Pin | ADS1115 Channel | Divider Network | Range & Conversion |
|---|---|---|---|---|
| **Municipal Pressure (9W)** | Sensor Out (0.5–4.5V) | `AIN0` (Chan 0) | 2:1 ($10\text{k}\Omega / 20\text{k}\Omega$) | 0 – 100 PSI ($\text{Cutout } < 5\text{ PSI}$) |
| **Fill Pipe Pressure (Uphill)** | Sensor Out (0.5–4.5V) | `AIN1` (Chan 1) | 2:1 ($10\text{k}\Omega / 20\text{k}\Omega$) | 0 – 200 PSI ($\text{High } > 180\text{ PSI}$) |
| **Pump Current (FCS521-SD-10V)** | Sensor VOUT (0–10V) | `AIN2` (Chan 2) | 3:1 ($20\text{k}\Omega / 10\text{k}\Omega$) | 0 – 50A AC ($5.0\text{ A/V}$) |
| **Shared I2C Bus** | ESP32 `GPIO 8` (SDA), `GPIO 9` (SCL) | Addr `0x48` | Onboard 400kHz | ADS1115 16-Bit Precision ADC |

- **Overcurrent Protection**: $> 18.0\text{A}$ triggers 60-second warning pre-trip pulse before motor lockout.
- **Undercurrent / Cavitation Protection**: $< 4.5\text{A}$ while pump is running triggers 60-second dry run protection.
- **Inrush Suppression**: 5-second initial bypass prevents false tripping during motor starting spike.

---

## 🕷️ Hexabot AI Mascot & Audio Stream

- **Hexapod Mouth Output**: `GPIO 11` (Active HIGH = Mouth Open / Speaking)
- **Hexapod LED Eyes Output**: `GPIO 12` (Active HIGH = Eyes Illuminated, blinks for 150ms every 3–6s)
- **I2S Hardware Chimes & Sirens**: DMA audio synthesis with automatic lip-sync mouth activation and touch feedback clicks.
- **Python Audio Stream Bridge**: Run `python hexapod_audio_stream.py --test-speech` or `python hexapod_audio_stream.py --serial COMx` to synchronize audio lip-sync with the hardware and Web App.

