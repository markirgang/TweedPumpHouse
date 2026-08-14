# Tweed Boulevard / Route 9W ESP32 Water System Controller

Autonomous water pumping, holding tank monitoring, and freeze protection system powered by a **Waveshare ESP32-S3 Touch LCD-7 (7.0" 800x480 Capacitive Touchscreen)**, featuring direct **Web Bluetooth (BLE)** connection and a **Netlify Cloud Web App** for remote monitoring.

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
|   [Waveshare ESP32-S3 7" Touchscreen] <---> [ESP32-S3 Controller]                    |
|       - DHT11 Temp/Humidity (Pump room)                                             |
|       - External Freeze Sensor Switch (<40°F)                                       |
|       - Alarm Buzzer / Relay (Tank Empty Alarm)                                     |
|       - Line Valve Relay & Pump Relay                                               |
|       - BLE 5.0 (Local Smartphone Direct Connect)                                   |
|       - WiFi (Local WebServer + Netlify Cloud Bridge / MQTT)                         |
+-------------------------------------------------------------------------------------+
```

---

## 2. Hardware Pinout & Wiring Table (Waveshare ESP32-S3-Touch-LCD-7)

| Device / Signal | Header & Pin | ESP32-S3 GPIO | Type | Logic / Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Shared Valve Relay (Line & Drain)** | RS485 Header (P5) Pin 1 | `GPIO 15` | Output (Relay) | HIGH = Line Valve Open & Drain Valve Closed (Energized)<br>LOW = Line Valve Closed & Drain Valve Open (Draining Pipe) |
| **Water Pump Relay** | RS485 Header (P5) Pin 2 | `GPIO 16` | Output (Relay) | HIGH = Pump Running (Energized), LOW = Off |
| **Alarm Buzzer / Siren Relay** | CAN Header (P3) Pin 1 | `GPIO 19` | Output (Relay) | HIGH = Sounding Alarm, LOW = Muted/Off |
| **Pumphouse Low Temp Alarm Relay** | Auxiliary Header Pin | `GPIO 13` | Output (Relay) | HIGH = Pump Room Temp < 55°F (Alarm Output Active), LOW = Normal |
| **Tank Empty Float** | CAN Header (P3) Pin 2 | `GPIO 20` | Input (Pullup) | LOW = Critical Empty (ALARM), HIGH = Adequate (Normal) |
| **Tank Low Float** | UART2 Header (P1) Pin 3 | `GPIO 43` | Input (Pullup) | HIGH = Demand Water (Auto Pump), LOW = Adequate (Normal) |
| **Tank High Float** | UART2 Header (P1) Pin 2 | `GPIO 44` | Input (Pullup) | LOW = Tank Full (Shutoff Stop), HIGH = Below Full (Filling Allowed) |
| **Freeze Sensor (<40°F)**| Sensor AD Header (P2) Pin 3 | `GPIO 6` | Input (Pullup) | HIGH = < 40°F (Freeze Hazard / Pipe Drain), LOW = >= 40°F (Normal / Warm) |
| **DHT11 Data Pin** | Shared Header Pin | `GPIO 43` / Expander | Digital 1-Wire | Reads Pump Room Temp & Humidity |
| **Pump Overcurrent Sensor**| Header / I2C Expander | Configurable | Input | LOW = Overcurrent Trip (> Limit / Jammed Motor), HIGH = Normal |
| **Pump Undercurrent Sensor**| Header / I2C Expander | Configurable | Input | LOW = Dry Run Trip (Loss of Prime / Cavitation), HIGH = Normal |
| **Hexapod Mouth Actuator / LED** | Expansion Header Pin | `GPIO 11` | Output (Digital) | HIGH = Mouth Open / Active Lip-Sync, LOW = Closed |
| **Hexapod Ocular LED Eyes** | Expansion Header Pin | `GPIO 12` | Output (Digital) | HIGH = Eyes ON / Illuminated, LOW = Blinking Off (150ms) |
| **7.0" 800x480 RGB LCD** | Integrated ST7262 | 20 Dedicated Pins | Parallel RGB | Data: GPIO 14, 38, 18, 17, 10, 39, 0, 45, 48, 47, 21, 1, 2, 42, 41, 40<br>Sync: GPIO 5 (DE), 3 (VSYNC), 46 (HSYNC), 7 (PCLK) |
| **GT911 Capacitive Touch** | Integrated I2C | `GPIO 8` (SDA), `GPIO 9` (SCL) | I2C Bus | Address `0x5D`, Interrupt `GPIO 4` |
| **CH422G I/O Expander** | Integrated I2C | `GPIO 8` (SDA), `GPIO 9` (SCL) | I2C Bus | Address `0x24` / `0x38` (Controls Backlight, Resets) |

---

## 2B. Hexapod AI Robotic Mascot & Python Audio Stream Synchronization

The controller includes dedicated outputs and a WebSocket bridge for an animated 6-legged cyber-hexapod robot assistant:
* **Mouth Output (`GPIO 11`)**: Energizes when speech phonemes/volume cross threshold, driving physical/virtual mouth movement.
* **Ocular LED Eyes (`GPIO 12`)**: Stays illuminated and automatically blinks off for ~150ms every 2.8 to 5.5 seconds.
* **Speech Synchronization Switch**: Available in the Web App and firmware to toggle real-time speech lip-sync and eye blinking.
* **Python Audio Stream Bridge (`hexapod_audio_stream.py`)**:
  - Analyzes live audio streams in real-time using RMS amplitude thresholding.
  - Streams binary PCM audio and JSON lip-sync packets over WebSocket (`ws://localhost:8765`).
  - Supports speech test generation: `python hexapod_audio_stream.py --test-speech` or `python hexapod_audio_stream.py --say "System Nominal"`.
  - Supports direct Serial bridging to ESP32: `python hexapod_audio_stream.py --serial COM3`.

---

## 3. Automation State Machine & Control Rules

### A. Tank Empty & Audible Alarm
* **Tank Empty Switch Down (Non-floating)**: Tank is critically empty $\rightarrow$ The ESP32 energizes the **Alarm Relay (`GPIO 19`)**, sounding the audible alarm siren.
* **Silence Alarm**: Pressing **Silence Alarm** on the 7-inch touchscreen or in the Web App de-energizes the alarm relay. If the tank refills and empties again later, the alarm will automatically re-arm.

### B. Tank Low, Pump Cycle & On-Time Tracking
* **Tank Low Switch Down**: Water is low.
  1. Opens **Line Valve** (`GPIO 15` HIGH) to charge the fill/suction line.
  2. **5-Second Priming Delay**: Waits 5 seconds after the line valve is opened to allow municipal line pressure to establish positive suction head.
  3. Turns ON **Booster Water Pump** (`GPIO 16` HIGH) to assist municipal pressure.
  4. **Live Pump On-Time Tracking**: The 7" touchscreen LCD, Web App, and Bluetooth interfaces display the exact elapsed running time (e.g. `08:34 / 25:00`).
  5. **Pump Duty Cycle Timer**: Pump runs for **maximum 25 minutes**. If 25 minutes elapse and Tank Low is still down, the pump enters a **2-hour mandatory cooldown** to protect the pump motor.
  6. **Timed Out Duration Display**: When timed out, all interfaces show that the pump ran for 25:00 along with the remaining cooldown time.
  7. **Reset Pump Timeout**: Pressing **Reset Pump Timeout** on the touchscreen or Web App immediately clears the cooldown and restarts the pump.

### C. Motor Health: Overcurrent & Undercurrent Protection
* **Pump Overcurrent**: If motor load exceeds threshold (e.g. locked rotor, mechanical jam, electrical overload), the pump is shut off immediately, the audible alarm sounds, and an **OVERCURRENT FAULT** alert is displayed on the local screen, Web App, and BLE.
* **Pump Undercurrent**: If the pump is running dry (e.g. municipal main dry, loss of suction prime, cavitation), the pump is shut off immediately to prevent seal burnout, and a **DRY RUN / UNDERCURRENT FAULT** alert is displayed.
* **Fault Reset**: Pressing **Reset Pump / Fault** clears the trip and allows normal operation to resume.

### D. Tank High & Shutoff
* **Tank High Switch Floating (FULL)**: Tank is filled $\rightarrow$ Both **Line Valve and Pump turn OFF** until the water level drops back to **Tank Low**. The last run duration is saved and displayed.

### E. Freeze Protection Logic (<40°F Outside) & Pipe Draining
* **Shared Relay Architecture**: Both the **Line Valve (Normally Closed)** and the **Fill Pipe Drain Valve (Normally Open)** share a single control relay (`GPIO 15`).
  - **Relay ON / Energized**: Line Valve is OPEN, Drain Valve is CLOSED (water allowed to fill holding tank).
  - **Relay OFF / De-energized**: Line Valve is CLOSED, Drain Valve is OPEN (fill pipe drains into pump house sump).
* **High Water Float Drop (Normal Mode Top-Off)**: When the "High Water" float switch transitions from floating (FULL) to not floating (water level drops below top switch):
  - **Freeze Sensor OFF ($\ge 40^\circ\text{F}$ Warm)**: The Shared Relay **energizes ON** $\rightarrow$ **Line Valve OPENS** and **Fill Pipe Drain CLOSES**, allowing municipal line pressure to naturally top off the tank without engaging the pump.
  - **Freeze Sensor ON ($< 40^\circ\text{F}$ Freeze Hazard)**: The Shared Relay **remains OFF** $\rightarrow$ **Line Valve stays CLOSED** and **Fill Pipe Drain stays OPEN** (pipe drained to sump) to prevent exposed fill pipes from freezing and bursting.
* **Active Fill Exception**: Even when the Freeze Sensor is ON, once water level drops to **Tank Low**, the system engages the Shared Relay and Booster Pump to actively fill the tank until **Tank High** is reached, at which point the relay immediately de-energizes and the pipe drains completely.

### F. Pump Room Low Temperature Alarm (<55°F)
* **Low Temperature Trigger**: If ambient pump room temperature measured by the DHT11 sensor drops below **$55^\circ\text{F}$**, the ESP32 activates the **Audible Alarm Siren Relay (`GPIO 19`)** to alert operators to potential pump house heating failure and freeze risks to the indoor booster pump and piping.
* **Alert Displays**: A critical low-temperature banner is displayed across the Waveshare 7" LCD, the Web App, and announced by the Hexapod Mascot audio companion.
* **Silence & Auto-Rearm**: Pressing **Silence Alarm** mutes the siren. If the room warms back up $\ge 55^\circ\text{F}$ and subsequently drops below $55^\circ\text{F}$ again, the alarm automatically re-arms.

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
1. Open **[`arduino/TweedPumpHouse/TweedPumpHouse.ino`](file:///c:/Users/marki/OneDrive/Desktop/TweedPumpHouse/arduino/TweedPumpHouse/TweedPumpHouse.ino)** in Arduino IDE.
2. Install ESP32 board support (`esp32` by Espressif).
3. Install required libraries: `LovyanGFX`, `ArduinoJson`, `DHT sensor library`, `Adafruit Unified Sensor`, `ESPAsyncWebServer`, `AsyncTCP`.
4. Select board: **ESP32S3 Dev Module**.
5. Set **Flash Size**: `16MB (128Mb)`.
6. Set **PSRAM**: `OPI PSRAM` (or `Enabled`).
7. Set **USB CDC On Boot**: `Enabled`.
8. Click **Upload** (`Ctrl + U`).

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
> **OneDrive Sync Recommendation**: If cloning on a second machine, it is recommended to clone into a local non-non-cloud directory (e.g. `C:\Projects\TweedPumpHouse` or `~/Projects/TweedPumpHouse`) rather than an active cloud-sync folder to ensure OneDrive background file locks do not conflict with local Git operations.
