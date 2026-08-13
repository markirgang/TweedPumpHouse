#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =========================================================================
// HARDWARE PIN ASSIGNMENTS (Waveshare ESP32-S3-Touch-LCD-7 Breakout Headers)
// =========================================================================
// The Waveshare 7.0" 800x480 RGB display utilizes 20 dedicated GPIOs for the
// parallel RGB bus. External actuators and sensors connect to the dedicated
// peripheral headers on the board (RS485, CAN, UART2, Sensor AD, and I2C).

// Actuator Output Pins (Relay modules, Active HIGH)
#define PIN_RELAY_LINE_VALVE    15   // RS485 Header (P5 Pin 1): Line Valve Relay (HIGH = Valve Open)
#define PIN_RELAY_PUMP          16   // RS485 Header (P5 Pin 2): Water Pump Relay (HIGH = Pump ON)
#define PIN_RELAY_ALARM         19   // CAN Header (P3 Pin 1): Tank Empty Alarm Relay / Buzzer (HIGH = Active)

// Float Sensor & Environmental Inputs
// Confirmed Hardware Logic:
// - Tank Empty Switch (GPIO 20):  LOW = Down/Empty (Critical Empty ALARM), HIGH = Floating/Adequate (Normal OK)
// - Tank Low Switch (GPIO 43):    HIGH = Demand Water (Low), LOW = Adequate (Auto OK)
// - Tank High Switch (GPIO 44):   LOW = Tank Full (Shutoff Stop), HIGH = Below Full (Filling Allowed)
// - Freeze Sensor Switch (GPIO 6): HIGH = <40°F (Freeze Hazard / Pipe Drain), LOW = >=40°F (Warm / Normal Top-Off)
#define PIN_FLOAT_TANK_EMPTY    20   // CAN Header (P3 Pin 2): Lowest float switch (LOW = Critical Empty ALARM, HIGH = Adequate)
#define PIN_FLOAT_TANK_LOW      43   // UART2 Header (P1 Pin 3): Middle float switch (HIGH = Demand Water, LOW = Adequate)
#define PIN_FLOAT_TANK_HIGH     44   // UART2 Header (P1 Pin 2): Highest float switch (LOW = Tank Full Shutoff, HIGH = Below Full)
#define PIN_FREEZE_SENSOR       6    // Sensor AD Header (P2 Pin 3): Freeze sensor (HIGH = <40°F Freeze Hazard, LOW = >=40°F Normal)

// Environmental 1-Wire & Protection Sensor Inputs
#define PIN_DHT11_DATA          43   // Shared Digital Pin or Dedicated Sensor Header Pin for DHT11 Temp & Humidity
#define PIN_PUMP_OVERCURRENT    19   // Header / Expander Pin: Overcurrent switch (LOW = Overload/Jam fault, HIGH = Normal)
#define PIN_PUMP_UNDERCURRENT   20   // Header / Expander Pin: Undercurrent switch (LOW = Dry run/loss of prime, HIGH = Normal)

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
