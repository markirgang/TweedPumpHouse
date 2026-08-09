# Tweed Boulevard / Route 9W ESP32 Water System Controller

Autonomous water pumping, holding tank monitoring, and freeze protection system powered by an **ESP32 with WT32-SC01 3.5" Capacitive Touchscreen**, featuring direct **Web Bluetooth (BLE)** connection and a **Netlify Cloud Web App** for remote monitoring.

---

## 1. System Overview

The system controls the water supply pumped uphill from the **Municipal Water Supply on Route 9W** (bottom of hill) to the **Water Holding Tank on Tweed Boulevard** (top of hill).

```
                             [ Tweed Blvd Holding Tank ]
                           +-------------------------------+
                           | [x] Tank High Float Switch    |
                           |                               |
                           | [x] Tank Low Float Switch     |
                           |                               |
                           | [!] Tank Empty Float Switch   |
                           +---------------+---------------+
                                           ^
                                           |  (Water Fill Pipe - Freeze Hazard)
                                           |
+------------------------------------------+------------------------------------------+
|  PUMP ROOM (Route 9W at bottom of hill)                                             |
|                                                                                     |
|   [Municipal 9W] ---> [ Line Valve ] ---> [ Water Pump ] ---> [ Non-Return Check ]  |
|                                                                                     |
|   [WT32-SC01 Touch Screen] <---> [ESP32 Controller]                                 |
|       - DHT11 Temp/Humidity (Pump room)                                             |
|       - External Freeze Sensor Switch (<40°F)                                       |
|       - Alarm Buzzer / Relay (Tank Empty Alarm)                                     |
|       - Line Valve Relay & Pump Relay                                               |
|       - BLE 5.0 (Local Smartphone Direct Connect)                                   |
|       - WiFi (Local WebServer + Netlify Cloud Bridge / MQTT)                         |
+-------------------------------------------------------------------------------------+
```

---

## 2. Hardware Pinout & Wiring Table (WT32-SC01)

| Device / Signal | ESP32 Pin | Type | Logic / Behavior |
| :--- | :--- | :--- | :--- |
| **Line Valve Relay** | `GPIO 2` | Output (Relay) | HIGH = Valve Open (Energized), LOW = Closed |
| **Water Pump Relay** | `GPIO 25` | Output (Relay) | HIGH = Pump Running (Energized), LOW = Off |
| **Alarm Buzzer / Relay** | `GPIO 26` | Output (Relay) | HIGH = Sounding Alarm, LOW = Muted/Off |
| **Tank Empty Float** | `GPIO 27` | Input (Pullup) | Down (Non-floating) = LOW (ALARM), Floating = HIGH |
| **Tank Low Float** | `GPIO 32` | Input (Pullup) | Down = LOW (Demand Water/Pump), Floating = HIGH |
| **Tank High Float** | `GPIO 33` | Input (Pullup) | Down = LOW (Filling Allowed), Floating = HIGH (Full Stop) |
| **Freeze Sensor (<40°F)**| `GPIO 35` | Input (Pullup) | Active/Cold (<40°F) = LOW, Warm (>=40°F) = HIGH |
| **Pump Overcurrent Sensor**| `GPIO 34` (CON1) | Input | LOW = Overcurrent Trip (> Limit / Jammed Motor), HIGH = Normal |
| **Pump Undercurrent Sensor**| `GPIO 36` (CON1) | Input (SENSOR_VP) | LOW = Dry Run Trip (Loss of Prime / Cavitation), HIGH = Normal |
| **DHT11 Data Pin** | `GPIO 4` | Digital 1-Wire | Reads Pump Room Temp & Humidity |
| **ST7796 Color LCD** | Integrated | SPI Bus | Pins 13, 12, 14, 15, 21, 22, 23 (3.5" 480x320) |
| **FT6336U Capacitive Touch**| Integrated | I2C Bus | Pins 18 (SDA), 19 (SCL), 39 (INT) |

---

## 3. Automation State Machine & Control Rules

### A. Tank Empty & Audible Alarm
* **Tank Empty Switch Down (Non-floating)**: Tank is critically empty $\rightarrow$ The ESP32 energizes the **Alarm Relay (`GPIO 26`)**, sounding the audible alarm siren.
* **Silence Alarm**: Pressing **Silence Alarm** on the WT32-SC01 touchscreen or in the Web App de-energizes the alarm relay. If the tank refills and empties again later, the alarm will automatically re-arm.

### B. Tank Low, Pump Cycle & On-Time Tracking
* **Tank Low Switch Down**: Water is low.
  1. Opens **Line Valve** (`GPIO 2` HIGH).
  2. Turns ON **Water Pump** (`GPIO 25` HIGH) to assist municipal pressure.
  3. **Live Pump On-Time Tracking**: The touchscreen LCD, Web App, and Bluetooth interfaces display the exact elapsed running time (e.g. `08:34 / 25:00`).
  4. **Pump Duty Cycle Timer**: Pump runs for **maximum 25 minutes**. If 25 minutes elapse and Tank Low is still down, the pump enters a **2-hour mandatory cooldown** to protect the pump motor.
  5. **Timed Out Duration Display**: When timed out, all interfaces show that the pump ran for 25:00 along with the remaining cooldown time.
  6. **Reset Pump Timeout**: Pressing **Reset Pump Timeout** on the touchscreen or Web App immediately clears the cooldown and restarts the pump.

### C. Motor Health: Overcurrent & Undercurrent Protection
* **Pump Overcurrent (`GPIO 34`)**: If motor load exceeds threshold (e.g. locked rotor, mechanical jam, electrical overload), the pump is shut off immediately, the audible alarm sounds, and an **OVERCURRENT FAULT** alert is displayed on the local screen, Web App, and BLE.
* **Pump Undercurrent (`GPIO 36`)**: If the pump is running dry (e.g. municipal main dry, loss of suction prime, cavitation), the pump is shut off immediately to prevent seal burnout, and a **DRY RUN / UNDERCURRENT FAULT** alert is displayed.
* **Fault Reset**: Pressing **Reset Pump / Fault** clears the trip and allows normal operation to resume.

### D. Tank High & Shutoff
* **Tank High Switch Floating (FULL)**: Tank is filled $\rightarrow$ Both **Line Valve and Pump turn OFF** until the water level drops back to **Tank Low**. The last run duration is saved and displayed.

### E. Freeze Protection Logic (<40°F Outside)
* **Freeze Sensor ON (< 40°F)**: There is danger that the water inside the exposed fill pipe between the Pump Room and Tweed Blvd could freeze and burst. When the water level drops below Tank High, the **Line Valve remains CLOSED** to isolate the fill pipe. The system only opens the valve and turns on the pump when the water reaches **Tank Low**.
* **Freeze Sensor OFF (>= 40°F / Warm)**: When the water level drops below Tank High, the **Line Valve opens automatically** so municipal water pressure can naturally top off the tank without engaging the pump.

---

## 4. How to Deploy to Netlify

1. Navigate to the `webapp/` folder.
2. Login to your [Netlify Dashboard](https://app.netlify.com/).
3. Drag and drop the `webapp/` folder into the Netlify "Deploy manually" dropzone, or connect your GitHub repository with build settings:
   - **Publish directory**: `webapp`
4. Once deployed, open your Netlify URL (e.g. `https://your-site.netlify.app`) on any phone, tablet, or PC!

---

## 5. How to Connect the App

### Option 1: Web Bluetooth (BLE) - Direct Wireless (No Wi-Fi needed)
1. Open the Netlify App in **Google Chrome**, **Microsoft Edge**, or **Bluefy (iOS)**.
2. Click **Connect ESP32** $\rightarrow$ **Web Bluetooth (BLE)**.
3. Select `Tweed-PumpHouse` from the Bluetooth pairing list.
4. Telemetry streams live and commands are dispatched directly over BLE.

### Option 2: Netlify Cloud / Local LAN IP
1. Click **Connect ESP32** $\rightarrow$ **Netlify Cloud / Local WiFi IP**.
2. Enter your ESP32's local IP (e.g. `http://192.168.1.120/api/status`) or your cloud serverless webhook URL.

### Option 3: Interactive Hardware Test Bench (Simulator)
1. Click **Connect ESP32** $\rightarrow$ **Interactive Simulator Mode**.
2. Test tank levels (Full, Mid, Low, Empty), freeze conditions, 25m pump timeouts, and alarm silences directly in the browser!

---

## 6. How to Flash the ESP32 Firmware

### Using PlatformIO (VS Code):
```bash
cd firmware
pio run --target upload
pio device monitor -b 115200
```

### Using Arduino IDE:
1. Install ESP32 board support (`esp32` by Espressif).
2. Install libraries: `LovyanGFX`, `ArduinoJson`, `DHT sensor library`, `ESPAsyncWebServer`, `AsyncTCP`.
3. Select board: **ESP32 Wrover Module** (or WT32-SC01 board profile).
4. Set **Partition Scheme**: `Minimal SPIFFS (Large APPS with OTA)`.
5. Set **PSRAM**: `Enabled`.
6. Upload `src/main.cpp`.

---

## 7. Multi-Computer Workflow & Git Worktrees

The repository is hosted on GitHub at [github.com/markirgang/TweedPumpHouse](https://github.com/markirgang/TweedPumpHouse).

### A. Setting Up on a New Computer
To clone and work on this project from any other PC, laptop, or Mac:
```bash
git clone https://github.com/markirgang/TweedPumpHouse.git
cd TweedPumpHouse
```

### B. Daily Synchronization Across Computers
Before you start working on any computer:
```bash
git pull origin main
```

When you finish your changes on that computer:
```bash
git add .
git commit -m "Describe your changes"
git push origin main
```

### C. Using Git Worktrees (Work on Multiple Branches Simultaneously)
If you want to test new firmware experiments or UI redesigns in parallel directories without switching branches back and forth:
```bash
# 1. Create and checkout a new branch in a separate working folder:
git worktree add ../TweedPumpHouse-dev -b dev

# 2. List all active worktrees across your machine:
git worktree list

# 3. When finished with that worktree folder:
git worktree remove ../TweedPumpHouse-dev
```

> [!TIP]
> **OneDrive Sync Recommendation**: If cloning on a second machine, it is recommended to clone into a local non-cloud directory (e.g. `C:\Projects\TweedPumpHouse` or `~/Projects/TweedPumpHouse`) rather than an active cloud-sync folder to ensure OneDrive background file locks do not conflict with local Git operations.

