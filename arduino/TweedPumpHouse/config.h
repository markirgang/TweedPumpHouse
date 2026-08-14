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
#define MCP_PIN_PUMP_OVERCURRENT     4    // GPA4 (Pin 25): Overcurrent Sensor (LOW = Overload Trip, HIGH = Normal)
#define MCP_PIN_PUMP_UNDERCURRENT    5    // GPA5 (Pin 26): Undercurrent Sensor (LOW = Dry Run / Cavitation Trip, HIGH = Normal)
#define MCP_PIN_SPARE_IN1            6    // GPA6 (Pin 27): Spare Auxiliary Field Input 1
#define MCP_PIN_SPARE_IN2            7    // GPA7 (Pin 28): Spare Auxiliary Field Input 2

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
#define PIN_PUMP_OVERCURRENT         19   // Fallback Overcurrent Sensor
#define PIN_PUMP_UNDERCURRENT        20   // Fallback Undercurrent Sensor
#define PIN_DHT11_DATA               43   // DHT11 Data Pin

// Onboard Waveshare I2C Bus (Touch GT911 + CH422G I/O Expander)
#define PIN_I2C_SDA             8    // GT911 Touch & CH422G SDA
#define PIN_I2C_SCL             9    // GT911 Touch & CH422G SCL
#define PIN_TOUCH_INT           4    // GT911 Touch Interrupt (TP_IRQ)

// Hexapod Physical Actuator & LED Output Pins
#define PIN_HEXAPOD_MOUTH       11   // Hexapod Mouth Actuator / LED Output (HIGH = Mouth Open / Active, LOW = Closed)
#define PIN_HEXAPOD_EYES        12   // Hexapod Ocular LED Eyes Output (HIGH = Eyes ON, LOW = Eyes Off / Blink)

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
