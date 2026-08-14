#ifndef CONTROLLER_H
#define CONTROLLER_H

#include <Arduino.h>
#include <DHT.h>
#include "config.h"

enum OverrideMode {
    MODE_AUTO = 0,
    MODE_FORCE_ON = 1,
    MODE_FORCE_OFF = 2
};

enum PumpTimingState {
    PUMP_STATE_IDLE = 0,
    PUMP_STATE_RUNNING = 1,
    PUMP_STATE_COOLDOWN = 2
};

struct SystemTelemetry {
    // Sensor Debounced States
    bool tankEmpty;       // true if tank is empty (switch down, critical alarm)
    bool tankLow;         // true if water level is low (switch down, fill demand)
    bool tankHigh;        // true if switch is down (below full); false if floating (tank FULL)
    bool freezeSensor;    // true if outside temp < 40°F (freeze danger active)
    bool pumpOvercurrent; // true if overcurrent sensor detects overload (> trip current)
    bool pumpUndercurrent;// true if undercurrent sensor detects dry run / loss of prime

    // Actuator States (Physical Relay outputs)
    bool lineValve;             // true = Valve Open, false = Valve Closed
    bool pump;                  // true = Pump Running, false = Pump Off
    bool alarm;                 // true = Audible Alarm active, false = Off/Silenced
    bool relayLowTempAlarm;     // true = Pumphouse Interior Low Temp Alarm Relay Active (HIGH), false = Off

    // Alarm, Fault & Override Controls
    bool alarmSilenced;   // true if user pressed Silence Alarm
    bool pumpOvercurrentTrip;  // latched fault state when motor overcurrent trips
    bool pumpUndercurrentTrip; // latched fault state when dry-run undercurrent trips
    OverrideMode valveOverride; // AUTO / FORCE_ON / FORCE_OFF
    OverrideMode pumpOverride;  // AUTO / FORCE_ON / FORCE_OFF

    // Sensor Software Overrides (Settings / Diagnostics)
    OverrideMode tankHighOverride;     // AUTO / FORCE_ON (Sim Full) / FORCE_OFF (Sim Normal)
    OverrideMode tankLowOverride;      // AUTO / FORCE_ON (Sim Low Demand) / FORCE_OFF (Sim OK)
    OverrideMode tankEmptyOverride;    // AUTO / FORCE_ON (Sim Empty Alarm) / FORCE_OFF (Sim OK)
    OverrideMode overcurrentOverride;  // AUTO / FORCE_ON (Sim Trip) / FORCE_OFF (Sim Normal)
    OverrideMode undercurrentOverride; // AUTO / FORCE_ON (Sim Dry Run) / FORCE_OFF (Sim Normal)
    OverrideMode freezeOverride;       // AUTO / FORCE_ON (Sim <40F) / FORCE_OFF (Sim >=40F)

    // Pump Safety Timers & On-Time Tracking
    PumpTimingState pumpTimingState; // IDLE, RUNNING, COOLDOWN
    unsigned long pumpRunStartTime;
    unsigned long pumpRunElapsedMs;       // Active running duration (or duration before stopping)
    unsigned long pumpLastRunDurationMs;   // Duration pump was on in the last cycle / timed-out cycle
    unsigned long pumpCooldownStartTime;
    unsigned long pumpCooldownRemainingMs;

    // Environmental Telemetry (DHT11) & Pump Room Freeze Protection
    float temperatureC;
    float temperatureF;
    float humidity;
    bool dhtValid;
    bool pumpRoomLowTempAlarm; // true if pump room temp < 55°F (critical room freeze alarm)

    // Fill cycle internal state
    bool isFillCycleActive; // true if active pumping/filling from Low to High

    // 1-Minute Current Fault Warning & Alarm Pulsing State
    bool pumpCurrentFaultPending;       // true if overcurrent/undercurrent is counting down 60s
    bool isOvercurrentPending;          // true if pending fault is overcurrent
    bool isUndercurrentPending;         // true if pending fault is undercurrent
    unsigned long pumpCurrentFaultStartTime; // millis() when fault warning started
    unsigned long pumpCurrentFaultRemainingMs; // remaining ms before pump shutdown
    bool alarmPulsing;                  // true if alarm relay is actively pulsing (pre-trip warning)

    // Hexapod Robotic Mascot Actuators & Speech Lip-Sync State
    bool hexapodMouth;                  // true = Mouth Open / Speaking, false = Closed
    bool hexapodEyes;                   // true = Ocular Eyes Illuminated, false = Closed/Blinking
    bool hexapodSpeechSync;             // true = Synchronized to AI Python Audio Stream & Voice, false = Manual
};

class WaterSystemController {
public:
    WaterSystemController();

    void begin();
    void update();

    // User / Remote Interactive Actions
    void silenceAlarm();
    void resetPumpTimeout();
    void setLineValveOverride(OverrideMode mode);
    void setPumpOverride(OverrideMode mode);
    void setTankHighOverride(OverrideMode mode);
    void setTankLowOverride(OverrideMode mode);
    void setTankEmptyOverride(OverrideMode mode);
    void setOvercurrentOverride(OverrideMode mode);
    void setUndercurrentOverride(OverrideMode mode);
    void setFreezeOverride(OverrideMode mode);
    void resetAllOverrides();
    void emergencyStop();

    // Hexapod Physical Actuators & Speech Lip-Sync API
    void setHexapodMouth(bool open);
    void setHexapodEyes(bool on);
    void setHexapodSpeechSync(bool enabled);

    // Telemetry & Command API
    const SystemTelemetry& getTelemetry() const { return _telemetry; }
    String getTelemetryJson() const;
    bool processCommandJson(const String& jsonString);
    bool verifyPassword(const String& pass) const;

private:
    SystemTelemetry _telemetry;
    DHT _dht;

    // Internal debouncing trackers
    int _rawEmptyPin;
    int _rawLowPin;
    int _rawHighPin;
    int _rawFreezePin;

    unsigned long _lastDebounceTime;
    unsigned long _lastDhtReadTime;
    unsigned long _lastTelemetryBroadcast;
    unsigned long _lineValveOpenedTime; // Timestamp when Line Valve was energized (for 5s booster start delay)

    // Hexapod Natural Eye Blinking & Speech Lip-Sync Trackers
    unsigned long _hexapodLastBlinkTime;
    bool _hexapodIsBlinking;
    unsigned long _hexapodNextBlinkInterval;
    unsigned long _hexapodMouthOffTime;

    bool _prevTankEmptyState;
    bool _prevPumpRoomLowTempState;

    // MCP23017 16-Bit I2C I/O Expander Driver
    bool _mcpDetected;
    uint8_t _mcpAddress;
    uint8_t _mcpOutputLatchB;
    bool initMCP23017();
    void mcpWriteRegister(uint8_t addr, uint8_t reg, uint8_t val);
    uint8_t mcpReadRegister(uint8_t addr, uint8_t reg);

    void readSensors();
    void executeStateMachine();
    void updateActuators();
public:
    bool isMcpDetected() const { return _mcpDetected; }
};

extern WaterSystemController systemController;

#endif // CONTROLLER_H
