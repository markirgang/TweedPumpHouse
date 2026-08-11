#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =========================================================================
// HARDWARE PIN ASSIGNMENTS (WT32-SC01 ESP32 & CON1/CON2 Expansion Headers)
// =========================================================================

// Actuator Output Pins (Relay modules, Active HIGH)
#define PIN_RELAY_LINE_VALVE    2    // Line Valve Relay: HIGH = Valve Open, LOW = Closed
#define PIN_RELAY_PUMP          25   // Water Pump Relay: HIGH = Pump ON, LOW = Off
#define PIN_RELAY_ALARM         26   // Tank Empty Alarm Relay / Buzzer: HIGH = Active, LOW = Muted

// Float Sensor Inputs (Connected with Internal/External Pull-up, Switch to GND)
// Switch Logic:
// - Tank Empty Switch: Down/Empty = LOW (Alarm), Floating/Adequate = HIGH
// - Tank Low Switch:   Down/Low = LOW (Demand Water), Floating = HIGH
// - Tank High Switch:  Down = LOW (Filling Allowed), Floating/Full = HIGH (Full Stop)
#define PIN_FLOAT_TANK_EMPTY    27   // Lowest float switch in Tweed Blvd holding tank
#define PIN_FLOAT_TANK_LOW      32   // Middle float switch in Tweed Blvd holding tank
#define PIN_FLOAT_TANK_HIGH     33   // Highest float switch in Tweed Blvd holding tank

// Environmental Sensor Inputs
#define PIN_FREEZE_SENSOR       35   // Freeze Sensor Switch outside Pump Room (LOW = <40°F Freeze Danger, HIGH = Normal)
#define PIN_DHT11_DATA          4    // DHT11 1-Wire Temperature & Humidity Sensor

// Pump Motor Current Protection Sensor Inputs (WT32-SC01 CON1 Header)
// Connected to Digital Current Switches / Transducers (Active LOW on Fault contact closure)
#define PIN_PUMP_OVERCURRENT    34   // CON1 Pin: Overcurrent switch (LOW = Overload/Jam fault, HIGH = Normal)
#define PIN_PUMP_UNDERCURRENT   36   // CON1 Pin (SENSOR_VP): Undercurrent switch (LOW = Dry run/loss of prime, HIGH = Normal)

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
