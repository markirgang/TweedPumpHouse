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
| **Spare Auxiliary Input 3** | Pin 25 | `GPA4` (Bit 4) | Input (Pullup) | Freed input (formerly binary overcurrent) |
| **Spare Auxiliary Input 4** | Pin 26 | `GPA5` (Bit 5) | Input (Pullup) | Freed input (formerly binary undercurrent) |
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
| **I2C Bus (MCP23017 + ADS1115 + Touch + CH422G)** | Standard I2C | `GPIO 8` (SDA), `GPIO 9` (SCL) | Fast 400kHz shared system bus |
| **ADS1115 16-Bit ADC** | I2C | `GPIO 8`, `GPIO 9` (Address `0x48`) | High-precision pressure & AC current ADC |
| **GT911 Capacitive Touch** | I2C | `GPIO 8`, `GPIO 9`, `GPIO 4` (IRQ) | 5-point capacitive multi-touch |
| **CH422G Expander** | I2C | `GPIO 8`, `GPIO 9` (Address `0x24`/`0x38`) | LCD backlight & peripheral reset |
| **7.0" 800x480 RGB LCD** | Parallel RGB | 20 Dedicated Display Pins | ST7262 driver with PSRAM double buffer |
| **DHT11 Temp & Humidity Sensor** | 1-Wire Digital | `GPIO 43` | Ambient Pumphouse Climate Monitoring |

---

## 2D. ADS1115 16-Bit ADC & Sensor Topology

The controller integrates dual 0.5V – 4.5V stainless steel piezoresistive pressure transducers and an **FCS521-SD-10V AC Current Transmitter (0 – 50A AC to 0 – 10V DC linear converter)** monitored via an **ADS1115 16-Bit I2C ADC Module** over the shared I2C bus (`GPIO 8` SDA, `GPIO 9` SCL, Address `0x48`).

### A. ADS1115 Channel Mapping

| Sensor / Transmitter | Rated Span | Sensor Output | Divider / Scaling | ADS1115 Channel | Nominal Operating Level | Protection Thresholds |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Municipal Pressure (9W)** | **0 – 100 PSI** | 0.5V – 4.5V DC | 2:1 ($10\text{k}\Omega / 20\text{k}\Omega$) | `AIN0` (Chan 0) | 40 – 80 PSI | Cutout: $< 5.0\text{ PSI}$ (30s delay) |
| **Fill Pipe Pressure (Uphill)** | **0 – 200 PSI** | 0.5V – 4.5V DC | 2:1 ($10\text{k}\Omega / 20\text{k}\Omega$) | `AIN1` (Chan 1) | 0 PSI (Drained), 115–135 PSI (Pumping) | Warning: $> 180.0\text{ PSI}$ |
| **Pump Current (FCS521-SD-10V)** | **0 – 50 A AC** | 0.0V – 10.0V DC | 3:1 ($20\text{k}\Omega / 10\text{k}\Omega$) | `AIN2` (Chan 2) | 8.0 – 14.0 A (11.2A typical) | Overload: $> 18.0\text{A}$<br>Dry Run: $< 4.5\text{A}$ |
| **Spare Analog Input** | Auxiliary | 0.0V – 3.3V DC | Direct 1:1 | `AIN3` (Chan 3) | 0 – 3.3V | Reserved |

### B. FCS521-SD-10V Hardware Wiring & Calculations

The **FCS521-SD-10V** current transmitter produces a precision linear $0 - 10\text{V DC}$ output across its $0 - 50\text{A AC}$ measurement span ($5.0\text{ A/V}$ or $0.2\text{ V/A}$). To safely interface with the 3.3V ADS1115 ADC without overvoltage:
- **Resistive Divider**: $R_1 = 20\text{k}\Omega$ (series from sensor signal) and $R_2 = 10\text{k}\Omega$ (pulldown to GND).
- **Voltage Division Factor**: $\frac{R_2}{R_1 + R_2} = \frac{10\text{k}\Omega}{20\text{k}\Omega + 10\text{k}\Omega} = \frac{1}{3} \approx 0.333333$.
- **Max ADC Input**: At $50\text{A}$ ($10\text{V}$), $V_{\text{ADC}} = 10\text{V} \times \frac{1}{3} = 3.333\text{V}$, perfectly matching ADS1115 Gain 1 ($\pm 4.096\text{V}$) mode.

```
                  +----------------------------------------------+
                  | FCS521-SD-10V AC Current Transmitter         |
  Pump Motor L1 --|--> Toroid Doughnut Core Hole (Single Pass) --|--
                  | VCC (12-24V DC), GND, VOUT (0-10V DC)        |
                  +-----------------------+----------------------+
                                          |
                                          | VOUT (0 - 10V DC)
                                          v
                                    [ R1: 20kΩ 1% ]
                                          |
                                          +-----> ADS1115 AIN2 (0 - 3.333V)
                                          |
                                    [ R2: 10kΩ 1% ]
                                          |
                                         GND
```

$$\text{Current (Amps)} = \left(\frac{V_{\text{ADC}}}{0.333333}\right) \times 5.0\text{ A/V} = V_{\text{sensor}} \times 5.0\text{ A/V}$$

### C. Dynamic Motor Current Trip Logic & Protection

1. **5-Second Inrush Stabilization**:
   - Suppresses nuisance tripping during motor startup inrush (~22.5A for the first 1–2 seconds) and initial suction priming.
2. **Overcurrent Overload Protection ($> 18.0\text{A}$)**:
   - If motor current exceeds **18.0 A**, a 60-second warning countdown begins with pulsing alarm relay and warning chimes.
   - If overload persists for 60 seconds, the booster pump is locked out with a latched `pumpOvercurrentTrip`.
3. **Dry-Run / Cavitation Loss of Prime ($< 4.5\text{A}$)**:
   - If motor current falls below **4.5 A** while running (indicating unloaded impeller due to air ingestion or empty suction), a 60-second warning countdown begins.
   - If undercurrent persists for 60 seconds, the booster pump is locked out with a latched `pumpUndercurrentTrip`.

### B. Voltage Divider & Hardware Wiring Diagram

```
                       +5V Power Rail
                         |          |
                 +-------+          +-------+
                 |                          |
            [Municipal 9W               [Fill Pipe Uphill
             Transducer (0-100 PSI)]     Transducer (0-200 PSI)]
                 |     |                    |     |
              GND|     |Out (0.5-4.5V)   GND|     |Out (0.5-4.5V)
                 |     +----+               |     +----+
                 |          |               |          |
                 |       [R1 10kΩ]          |       [R1 10kΩ]
                 |          |               |          |
                 |          +----> AIN0     |          +----> AIN1
                 |          |     (ADS1115) |          |     (ADS1115)
                 |       [R2 20kΩ]          |       [R2 20kΩ]
                 |          |               |          |
                 +----------+---------------+----------+---> GND
                                                        |
                            ADS1115 Module (Addr 0x48) -+
                             - VDD  ---> 3.3V
                             - GND  ---> GND
                             - SCL  ---> ESP32 GPIO 9 (Shared I2C)
                             - SDA  ---> ESP32 GPIO 8 (Shared I2C)
                             - ADDR ---> GND (Address 0x48)
```

$$\text{PSI} = \frac{V_{\text{sensor}} - 0.5\text{V}}{4.0\text{V}} \times P_{\max}$$

### C. Municipal Water Low Pressure (< 5 PSI) 30-Second Cutout Protection

To safeguard the booster pump against running dry and destroying shaft seals or overheating during municipal main outages, pressure loss, or line breaks:
1. **Trigger Condition**: When the municipal water pressure drops below **5.0 PSI** while the booster pump is running or demanded (active fill cycle).
2. **30-Second Delay**: A 30-second warning countdown begins with an audible pre-trip warning chirp / pulsing alarm.
3. **Emergency Cutout**: If municipal pressure remains $<5.0\text{ PSI}$ for 30 consecutive seconds:
   - The booster pump relay is immediately de-energized.
   - A latched **Municipal Water Outage Trip** is engaged.
   - Emergency siren is sounded and visual alarms flash across the 7" LCD HMI and Web Dashboard.
4. **Recovery & Reset**: Once city water pressure restores ($\ge 5.0\text{ PSI}$), the fault can be acknowledged and cleared via the **"Reset Fault / Timeout"** button on the touchscreen or Web UI.

---

## 2B. MAX98357A I2S Mono Audio Amplifier & Voice Synthesizer

The controller integrates a dedicated hardware **MAX98357A I2S Class-D Mono DAC & Audio Amplifier** delivering zero-latency DMA audio output directly from the ESP32-S3.

### A. Hardware Wiring Pinout Table

| MAX98357A Amp Pin | ESP32-S3 Connection | Function / Description |
| :--- | :--- | :--- |
| **BCLK / SCK** | `GPIO 12` | I2S Bit Clock (Serial Clock) |
| **LRC / WS** | `GPIO 11` | I2S Word Select / Left-Right Clock |
| **DIN / SDATA** | `GPIO 13` | I2S Serial Audio Data Stream |
| **GAIN** | `GND` (12dB) / Floating (9dB) | Hardware Gain Selection |
| **SD_MODE** | `5V` (via 1MΩ pull-up) or `GPIO` | Left-Channel Mono Decode / Active Enable |
| **GND** | `GND` (Common Ground) | Power and signal ground |
| **VIN / VDD** | `5V` (Recommended) or `3.3V` | 3.2W into 4Ω at 5V, or 1.4W into 8Ω |
| **Speaker +/-** | 4Ω to 8Ω Speaker (2W - 5W) | High-fidelity mono speaker output |

```
  ESP32-S3 (Direct GPIOs)               MAX98357A Mono I2S Amp
+-------------------------+             +--------------------+
| GPIO 12 (BCLK)          | ----------> | BCLK               |
| GPIO 11 (LRC / WS)      | ----------> | LRC                |
| GPIO 13 (DIN / DOUT)    | ----------> | DIN                |
| 5V Power                | ----------> | VIN                |      +---------------+
| Ground (GND)            | ----------> | GND                | ===> | 4-8Ω Speaker  |
|                         |             | GAIN  (to GND/12dB)|      | (2W - 5W)     |
|                         |             | SD_MODE (Pullup)   |      +---------------+
+-------------------------+             +--------------------+
```

### B. Sound Effects, Chimes & Continuous Sirens

| Sound ID | Sound Name | Acoustic Signature | Trigger Condition |
| :--- | :--- | :--- | :--- |
| `CHIME_CLICK` | **Tactile Touch Click** | 1800Hz (15ms) | Touchscreen presses & GUI feedback |
| `CHIME_STARTUP` | **System Boot Chord** | C5-E5-G5-C6 Ascending Arpeggio | Power-on / Controller boot |
| `CHIME_VALVE_OPEN`| **Line Valve Open** | 440Hz $\rightarrow$ 660Hz Dual-Tone | Municipal fill pipe valve energized |
| `CHIME_PUMP_START` | **Booster Pump Start** | 349Hz-523Hz-698Hz Tri-Tone | Booster pump starting |
| `CHIME_TANK_FULL` | **Holding Tank Full** | D5-F#5-A5-D6 Melodic Sequence | Holding tank filled to 100% |
| `CHIME_WARNING` | **Pre-Trip Warning** | 880Hz Dual Pulse | Current fault 60s countdown |
| `CHIME_FAULT` | **Fault Alert** | 988Hz-587Hz-370Hz Descending | Motor overload / dry run trip |
| `CHIME_SILENCE` | **Silence Acknowledged**| 659Hz $\rightarrow$ 523Hz Soft Chime | Alarm silenced by user |
| `SIREN_TANK_EMPTY`| **Tank Empty Wail** | 800Hz / 1200Hz Alternating Wail | Critical holding tank empty alarm |
| `SIREN_FREEZE` | **Freeze Alert Siren** | 550Hz - 850Hz Warble Sweep | Outside temperature < 40°F |
| `SIREN_PUMP_FAULT`| **Pump Fault Buzzer** | 920Hz Pulsed Alarm (100ms on/off) | Overload / dry-run cavitation |
| `SIREN_LOW_TEMP` | **Room Low Temp Siren**| 600Hz / 750Hz Alternating Siren | Pumphouse room temp < 55°F |

### C. On-Chip Synthetic Robotic Speech Phrases (Formant Synthesizer)

The firmware includes an on-chip synthetic formant vocalizer that automatically synchronizes physical/virtual mouth movement and ocular eye blinks:
* `PHRASE_SYSTEM_NOMINAL`: *"System Nominal"*
* `PHRASE_WATER_LOW`: *"Water Low - Line Valve Opening - Pump Starting"*
* `PHRASE_TANK_FULL`: *"Holding Tank Full - Stopping Booster Pump"*
* `PHRASE_FREEZE_WARNING`: *"Warning - Outside Freeze Hazard Detected"*
* `PHRASE_CRITICAL_ALARM`: *"Critical Alarm - Holding Tank Empty"*
* `PHRASE_ALARM_SILENCED`: *"Alarm Silenced"*
* `PHRASE_FAULT_CLEARED`: *"Fault Reset - Normal Operation Resumed"*
* `PHRASE_LOW_TEMP_ALARM`: *"Alert - Pumphouse Interior Low Temperature"*

---

## 2C. Hexabot AI Robotic Mascot & Python Audio Stream Synchronization

The controller includes dedicated outputs and a WebSocket bridge for an animated 6-legged cyber-hexapod robot assistant:
* **Mouth Output (`GPIO 11`)**: Energizes when speech phonemes/volume cross threshold, driving physical/virtual mouth movement.
* **Ocular LED Eyes (`GPIO 12`)**: Stays illuminated and automatically blinks off for ~150ms every 2.8 to 5.5 seconds.
* **Speech Synchronization Switch**: Available in the Web App and firmware to toggle real-time speech lip-sync and eye blinking.
* **Python Audio Stream Bridge (`hexapod_audio_stream.py`)**:
  - Analyzes live audio streams in real-time using RMS amplitude thresholding.
  - Streams binary PCM audio and JSON lip-sync packets over WebSocket (`ws://localhost:8765`).
  - Supports speech test generation: `python hexapod_audio_stream.py --test-speech` or `python hexapod_audio_stream.py --say "System Nominal"`.
  - Supports hardware I2S sound triggers: `python hexapod_audio_stream.py --chime startup` or `python hexapod_audio_stream.py --phrase water_low --serial COM3`.

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
