#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =========================================================================
// MCP23017 16-BIT I2C I/O EXPANDER PIN ASSIGNMENTS
// =========================================================================
// Because all direct ESP32-S3 GPIOs are utilized by the 800x480 RGB display bus
// and onboard peripherals, all field inputs and relay outputs interface through
// the MCP23017 I/O Expander module over the shared I2C bus (SDA: GPIO 8, SCL: GPIO 9).

#define MCP23017_DEFAULT_ADDR        0x20 // Default I2C Address (A0=GND, A1=GND, A2=GND)
#define MCP23017_IODIRA              0x00 // Port A I/O Direction (1=Input, 0=Output)
#define MCP23017_IODIRB              0x01 // Port B I/O Direction (1=Input, 0=Output)
#define MCP23017_GPPUA               0x0C // Port A Pull-Up Configuration (1=100k Pullup Enabled)
#define MCP23017_GPPUB               0x0D // Port B Pull-Up Configuration (1=100k Pullup Enabled)
#define MCP23017_GPIOA               0x12 // Port A Input Values
#define MCP23017_GPIOB               0x13 // Port B Input Values
#define MCP23017_OLATA               0x14 // Port A Output Latch
#define MCP23017_OLATB               0x15 // Port B Output Latch

// MCP23017 Port A: Field Inputs (Internal 100k Pull-Ups Enabled)
#define MCP_PIN_FLOAT_TANK_HIGH      0    // GPA0 (Pin 21): Tank High Float (LOW = Tank Full Stop, HIGH = Below Full)
#define MCP_PIN_FLOAT_TANK_LOW       1    // GPA1 (Pin 22): Tank Low Float (HIGH = Demand Water, LOW = Adequate)
#define MCP_PIN_FLOAT_TANK_EMPTY     2    // GPA2 (Pin 23): Tank Empty Float (LOW = Critical Empty Alarm, HIGH = Adequate)
#define MCP_PIN_FREEZE_SENSOR        3    // GPA3 (Pin 24): Outside Freeze Sensor (HIGH = <40°F Freeze Hazard, LOW = >=40°F Normal)
#define MCP_PIN_SPARE_IN1            4    // GPA4 (Pin 25): Spare Auxiliary Field Input 1 (Freed from legacy switch)
#define MCP_PIN_SPARE_IN2            5    // GPA5 (Pin 26): Spare Auxiliary Field Input 2 (Freed from legacy switch)
#define MCP_PIN_SPARE_IN3            6    // GPA6 (Pin 27): Spare Auxiliary Field Input 3
#define MCP_PIN_SPARE_IN4            7    // GPA7 (Pin 28): Spare Auxiliary Field Input 4

// MCP23017 Port B: Relay & Actuator Outputs (Active HIGH)
#define MCP_PIN_RELAY_LINE_VALVE     0    // GPB0 (Pin 1): Line Valve (NC) & Fill Pipe Drain (NO) Shared Relay
#define MCP_PIN_RELAY_PUMP           1    // GPB1 (Pin 2): Booster Water Pump Relay
#define MCP_PIN_RELAY_ALARM          2    // GPB2 (Pin 3): Tank Empty / General Siren Relay
#define MCP_PIN_RELAY_LOW_TEMP_ALARM 3    // GPB3 (Pin 4): Pumphouse Interior Low Temp Alarm Relay (<55°F)
#define MCP_PIN_HEXAPOD_MOUTH        4    // GPB4 (Pin 5): Hexapod Physical Mouth Actuator / LED Output
#define MCP_PIN_HEXAPOD_EYES         5    // GPB5 (Pin 6): Hexapod Ocular LED Eyes Output
#define MCP_PIN_SPARE_OUT1           6    // GPB6 (Pin 7): Spare Auxiliary Output 1
#define MCP_PIN_SPARE_OUT2           7    // GPB7 (Pin 8): Spare Auxiliary Output 2

// Fallback Direct GPIO Pin Mappings (used if MCP23017 is bypassed/in simulator)
#define PIN_RELAY_LINE_VALVE         15   // Fallback Line Valve Relay
#define PIN_RELAY_PUMP               16   // Fallback Water Pump Relay
#define PIN_RELAY_ALARM              19   // Fallback Tank Empty Alarm Relay / Buzzer
#define PIN_RELAY_LOW_TEMP_ALARM     13   // Fallback Pumphouse Low Temp Alarm Relay
#define PIN_FLOAT_TANK_EMPTY         20   // Fallback Tank Empty Float
#define PIN_FLOAT_TANK_LOW           43   // Fallback Tank Low Float
#define PIN_FLOAT_TANK_HIGH          44   // Fallback Tank High Float
#define PIN_FREEZE_SENSOR            6    // Fallback Freeze Sensor
#define PIN_DHT11_DATA               43   // DHT11 Data Pin

// Onboard Waveshare I2C Bus (Touch GT911 + CH422G I/O Expander + MCP23017 + ADS1115)
#define PIN_I2C_SDA             8    // GT911 Touch, CH422G, MCP23017, ADS1115 SDA
#define PIN_I2C_SCL             9    // GT911 Touch, CH422G, MCP23017, ADS1115 SCL
#define PIN_TOUCH_INT           4    // GT911 Touch Interrupt (TP_IRQ)

// =========================================================================
// ADS1115 16-BIT I2C ADC, PRESSURE TRANSDUCERS & FCS521-SD-10V CURRENT SENSOR
// =========================================================================
// Municipal Water Line & Fill Pipe Pressure + Pump AC Current Monitoring
// Shares existing I2C Bus (SDA: GPIO 8, SCL: GPIO 9) with MCP23017 and Touch Controller.
#define ADS1115_DEFAULT_ADDR          0x48 // I2C Address (ADDR connected to GND)
#define ADS1115_REG_POINTER_CONVERT   0x00 // Conversion Register
#define ADS1115_REG_POINTER_CONFIG    0x01 // Configuration Register

// ADS1115 ADC Channels
#define ADS_CHAN_PRESSURE_MUNICIPAL   0    // AIN0: Municipal Water Supply (0 - 100 PSI)
#define ADS_CHAN_PRESSURE_FILL_PIPE   1    // AIN1: Fill Pipe / Booster Pump Discharge (0 - 200 PSI)
#define ADS_CHAN_PUMP_CURRENT         2    // AIN2: FCS521-SD-10V Current Transmitter (0 - 50A AC, 0 - 10V DC)
#define ADS_CHAN_AUX_3                3    // AIN3: Auxiliary / Spare Analog Channel

// Pressure Transducer Specifications & Voltage Divider Scaling
// Sensors: 5V powered, 0.5V = 0 PSI, 4.5V = Max Rated PSI
// 2:1 Voltage Divider: R1=10k, R2=20k -> Factor = 20/(10+20) = 2/3 (~0.6667)
#define PRESSURE_VOLTAGE_DIVIDER_RATIO 0.666667f // R2 / (R1 + R2)
#define PRESSURE_SENSOR_VMIN           0.50f     // 0.5V at 0 PSI
#define PRESSURE_SENSOR_VMAX           4.50f     // 4.5V at Max PSI
#define PRESSURE_SENSOR_VSPAN          4.00f     // (4.5V - 0.5V)

#define MUNICIPAL_PRESSURE_MAX_PSI     100.0f    // 0 - 100 PSI Range
#define FILL_PIPE_PRESSURE_MAX_PSI     200.0f    // 0 - 200 PSI Range
#define PRESSURE_READ_INTERVAL_MS      500       // Read and filter pressure every 500ms

// FCS521-SD-10V AC Current Transmitter Specifications & Voltage Divider
// Sensor: 0 - 50A AC Input -> 0 - 10V DC Linear Output (0.2V/A or 5.0A/V)
// 3:1 Voltage Divider: R1=20k, R2=10k -> Factor = 10/(20+10) = 1/3 (~0.333333)
// At 50A (10V Out), ADC input is 3.33V (Safe for 3.3V ADS1115 input)
#define CURRENT_VOLTAGE_DIVIDER_RATIO 0.333333f // R2 / (R1 + R2)
#define PUMP_CURRENT_SENSOR_VMIN      0.00f     // 0.0V at 0 Amps
#define PUMP_CURRENT_SENSOR_VMAX      10.00f    // 10.0V at 50 Amps
#define PUMP_CURRENT_MAX_AMPS         50.0f     // 0 - 50 Amps Rated Span
#define PUMP_CURRENT_AMPS_PER_VOLT    5.0f      // 50A / 10V = 5.0 A/V
#define CURRENT_READ_INTERVAL_MS      250       // Read and filter current every 250ms

// Dynamic Motor Current Protection Thresholds (Amperes)
#define PUMP_OVERCURRENT_THRESHOLD_AMPS  18.0f  // Overload / Motor Jam / Locked Rotor Trip (> 18.0A)
#define PUMP_UNDERCURRENT_THRESHOLD_AMPS 4.5f   // Dry Run / Loss of Suction Prime / Cavitation (< 4.5A)
#define PUMP_CURRENT_IDLE_MAX_AMPS       0.5f   // Max current when pump is officially OFF (< 0.5A)
#define PUMP_NOMINAL_RUNNING_AMPS        11.2f  // Typical running booster pump load (~11.2A)

// Pressure Alarm Thresholds & Safety Cutouts
#define MUNICIPAL_LOW_PRESSURE_ALARM_PSI  20.0f  // Warning if municipal city pressure < 20 PSI
#define MUNICIPAL_PRESSURE_CUTOUT_PSI     5.0f   // Critical low pressure cutout threshold (< 5 PSI)
#define MUNICIPAL_PRESSURE_FAULT_DELAY_MS (30UL * 1000UL) // 30 Seconds Delay before Pump Shutdown
#define FILL_PIPE_HIGH_PRESSURE_ALARM_PSI 180.0f // Warning if fill pipe pressure > 180 PSI (blockage/freeze)

// =========================================================================
// I2S MONO AUDIO AMPLIFIER CONFIGURATION (MAX98357A / Class-D I2S DAC Amp)
// =========================================================================
// Direct ESP32-S3 GPIO pin mapping for I2S Mono DAC Audio Amplifier (e.g. MAX98357A)
// When MCP23017 handles field relays and inputs, GPIOs 12, 11, 13 are dedicated to hardware I2S.
#define I2S_ENABLED                  true // Enable I2S Hardware Audio Output
#define I2S_PORT_NUM                 0    // ESP32-S3 I2S Port (0 = I2S_NUM_0)
#define PIN_I2S_BCLK                 12   // I2S Bit Clock (BCLK / SCK / BCK)
#define PIN_I2S_LRC                  11   // I2S Left/Right Word Select Clock (LRC / WS / LCK)
#define PIN_I2S_DOUT                 13   // I2S Serial Data Out to Amp DIN (DIN / SDATA / SD)
#define PIN_I2S_SD_MODE              -1   // Optional Shutdown / Mute Pin (-1 if tied to VDD/GND or unmanaged)
#define I2S_SAMPLE_RATE              16000// 16kHz audio sample rate (optimal for speech, chimes, sirens)
#define I2S_DEFAULT_VOLUME           80   // Default power-on volume percentage (0 to 100)
#define I2S_FEEDBACK_CLICKS_ENABLED  true // Play subtle tactile audio chirp on touchscreen presses

// Hexapod Physical Actuator & LED Output Pins
#define PIN_HEXAPOD_MOUTH       11   // Hexapod Mouth Actuator / LED Output (Fallback GPIO)
#define PIN_HEXAPOD_EYES        12   // Hexapod Ocular LED Eyes Output (Fallback GPIO)

// Hexapod Eyes Blinking & Speech Sync Timings
#define HEXAPOD_BLINK_INTERVAL_MIN_MS  3000 // Minimum 3.0s between natural eye blinks
#define HEXAPOD_BLINK_INTERVAL_MAX_MS  6000 // Maximum 6.0s between natural eye blinks
#define HEXAPOD_BLINK_DURATION_MS      150  // 150ms eye blink duration
#define HEXAPOD_MOUTH_AUTO_CLOSE_MS    300  // Auto-close mouth if no speech pulse received within 300ms

// Debounce & Polling intervals
#define SENSOR_DEBOUNCE_MS      250  // Filter out water sloshing/ripples in holding tank
#define DHT_READ_INTERVAL_MS    3000 // Read ambient temperature/humidity every 3s
#define TELEMETRY_BROADCAST_MS  1000 // Broadcast system status every 1s

// Environmental Alarm Thresholds
#define PUMP_ROOM_LOW_TEMP_ALARM_THRESHOLD_F 55.0f // Alarm triggered if pump room temp drops below 55°F

// =========================================================================
// TIMING CONSTANTS (Water Pump Duty Cycle & Safety Protection)
// =========================================================================
#define PUMP_MAX_RUN_TIME_MS          (25UL * 60UL * 1000UL) // 25 Minutes Maximum Continuous Run
#define PUMP_COOLDOWN_TIME_MS         (2UL * 60UL * 60UL * 1000UL) // 2 Hours Mandatory Cooldown
#define LINE_VALVE_TO_PUMP_DELAY_MS   (5UL * 1000UL)         // 5 Seconds Delay after Line Valve Opens before Pump Starts
#define PUMP_START_STABILIZE_DELAY_MS (5UL * 1000UL)         // 5 Seconds Startup Current Draw Stabilization Delay
#define PUMP_CURRENT_FAULT_DELAY_MS   (60UL * 1000UL)        // 1 Minute (60s) Warning & Alarm Pulse before Fault Shutdown
#define ALARM_PULSE_INTERVAL_MS       500                    // 500ms ON / 500ms OFF Alarm Relay Pulsing

// =========================================================================
// SECURITY & PASSWORD CONFIGURATION
// =========================================================================
#define SYSTEM_ACCESS_PASSWORD        "5100"                 // Default PIN / Password to change states
#define SYSTEM_ACCESS_PASSWORD_ALT    "tweed123"             // Alternate alphanumeric passphrase

// =========================================================================
// BLE GATT SERVICE & CHARACTERISTIC UUIDs
// =========================================================================
#define BLE_DEVICE_NAME             "Tweed-PumpHouse"
#define BLE_SERVICE_UUID            "a7b30001-9f2d-43c2-a89e-01a7d65b1200"
#define BLE_CHAR_TELEMETRY_UUID     "a7b30002-9f2d-43c2-a89e-01a7d65b1200" // Read/Notify JSON status
#define BLE_CHAR_COMMAND_UUID       "a7b30003-9f2d-43c2-a89e-01a7d65b1200" // Write control commands

// =========================================================================
// WIFI & NETWORK CONFIGURATION
// =========================================================================
#define DEFAULT_WIFI_SSID           "Your_WiFi_SSID"
#define DEFAULT_WIFI_PASS           "Your_WiFi_Password"
#define MDNS_HOSTNAME               "tweed-pumphouse"
#define HTTP_SERVER_PORT            80

// Cloud Sync Webhook / Remote API (Optional Netlify / Firebase Bridge)
#define CLOUD_SYNC_ENABLED          true
#define CLOUD_ENDPOINT_URL          "https://tweed-pumphouse.netlify.app/api/telemetry"
#define CLOUD_SYNC_INTERVAL_MS      5000 // Push to cloud every 5 seconds

#endif // CONFIG_H
