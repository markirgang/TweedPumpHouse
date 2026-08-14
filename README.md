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

## 2. Hardware Architecture & MCP23017 16-Bit I/O Expander Wiring Table

Because all direct ESP32-S3 GPIO pins are dedicated to driving the 800x480 parallel RGB LCD bus and onboard touch controller, all external field inputs and relay actuators connect via the **MCP23017 16-Bit I/O Expander Module** over the shared I2C bus (`GPIO 8` SDA, `GPIO 9` SCL, Address `0x20`).

### A. MCP23017 Port A — Field Sensor Inputs (Internal 100k Pull-Ups Enabled)

| Signal / Field Sensor | MCP23017 Pin | Port & Bit | Logic / Active Level | Behavior Description |
| :--- | :--- | :--- | :--- | :--- |
| **Tank High Float Switch** | Pin 21 | `GPA0` (Bit 0) | LOW = Tank Full (Shutoff Stop)<br>HIGH = Below Full (Refill Allowed) | Highest float in holding tank |
| **Tank Low Float Switch** | Pin 22 | `GPA1` (Bit 1) | HIGH = Water Level Low (Demand Water)<br>LOW = Water Level Adequate | Triggers 5s Line Valve priming & Booster Pump |
| **Tank Empty Float Switch**| Pin 23 | `GPA2` (Bit 2) | LOW = Critically Empty (ALARM SIREN)<br>HIGH = Water Level OK | Lowest emergency float switch |
| **Freeze Sensor Switch** | Pin 24 | `GPA3` (Bit 3) | HIGH = < 40°F (Freeze Hazard / Pipe Drain)<br>LOW = >= 40°F (Normal / Warm Top-Off) | Outdoor temperature thermostat |
| **Pump Overcurrent Sensor**| Pin 25 | `GPA4` (Bit 4) | LOW = Overcurrent Trip (Motor Jam / Overload)<br>HIGH = Normal Motor Load | Pump motor protection |
| **Pump Undercurrent Sensor**| Pin 26 | `GPA5` (Bit 5) | LOW = Dry Run / Loss of Prime Trip<br>HIGH = Positive Suction Prime OK | Pump dry run cavitation protection |
| **Spare Auxiliary Input 1** | Pin 27 | `GPA6` (Bit 6) | Input (Pullup) | Reserved for future expansion |
| **Spare Auxiliary Input 2** | Pin 28 | `GPA7` (Bit 7) | Input (Pullup) | Reserved for future expansion |

### B. MCP23017 Port B — Relay Actuators & Hexapod Outputs (Active HIGH)

| Actuator / Output Device | MCP23017 Pin | Port & Bit | Active Level | Controlled Plumbing / Device |
| :--- | :--- | :--- | :--- | :--- |
| **Line Valve & Drain Shared Relay** | Pin 1 | `GPB0` (Bit 0) | HIGH = Energized<br>LOW = De-energized | HIGH = Line Valve OPEN & Fill Pipe Drain CLOSED<br>LOW = Line Valve CLOSED & Fill Pipe Drain OPEN (Draining Pipe) |
| **Booster Water Pump Relay** | Pin 2 | `GPB1` (Bit 1) | HIGH = Pump Running<br>LOW = Pump Off | 25-Min Max Run / 2-Hour Cooldown Protection |
| **Alarm Buzzer / Siren Relay** | Pin 3 | `GPB2` (Bit 2) | HIGH = Siren Active<br>LOW = Off / Silenced | Tank Empty, Overload Fault, or Room Low Temp |
| **Pumphouse Low Temp Relay** | Pin 4 | `GPB3` (Bit 3) | HIGH = Active (<55°F)<br>LOW = Normal (>=55°F) | Pumphouse room ambient heating failure alarm |
| **Hexapod Mouth Actuator** | Pin 5 | `GPB4` (Bit 4) | HIGH = Mouth Open<br>LOW = Mouth Closed | Cyber-Hexapod audio lip-sync mouth output |
| **Hexapod Ocular LED Eyes** | Pin 6 | `GPB5` (Bit 5) | HIGH = Eyes Illuminated<br>LOW = Blinking Off (150ms) | Mascot eyes blinking automation |
| **Spare Relay Output 1** | Pin 7 | `GPB6` (Bit 6) | Output | Reserved auxiliary relay |
| **Spare Relay Output 2** | Pin 8 | `GPB7` (Bit 7) | Output | Reserved auxiliary relay |

### C. Onboard Waveshare ESP32-S3 Dedicated Peripherals

| Device | Interface | ESP32-S3 GPIO Pins | Description |
| :--- | :--- | :--- | :--- |
| **I2C Bus (MCP23017 + Touch + CH422G)** | Standard I2C | `GPIO 8` (SDA), `GPIO 9` (SCL) | Fast 400kHz shared system bus |
| **GT911 Capacitive Touch** | I2C | `GPIO 8`, `GPIO 9`, `GPIO 4` (IRQ) | 5-point capacitive multi-touch |
| **CH422G Expander** | I2C | `GPIO 8`, `GPIO 9` (Address `0x24`/`0x38`) | LCD backlight & peripheral reset |
| **7.0" 800x480 RGB LCD** | Parallel RGB | 20 Dedicated Display Pins | ST7262 driver with PSRAM double buffer |
| **DHT11 Temp & Humidity Sensor** | 1-Wire Digital | `GPIO 43` | Ambient Pumphouse Climate Monitoring |

---

## 2B. Hexabot AI Robotic Mascot & Python Audio Stream Synchronization

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
