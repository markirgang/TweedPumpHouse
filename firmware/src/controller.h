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
    bool lineValve;       // true = Valve Open, false = Valve Closed
    bool pump;            // true = Pump Running, false = Pump Off
    bool alarm;           // true = Audible Alarm active, false = Off/Silenced

    // Alarm, Fault & Override Controls
    bool alarmSilenced;   // true if user pressed Silence Alarm
    bool pumpOvercurrentTrip;  // latched fault state when motor overcurrent trips
    bool pumpUndercurrentTrip; // latched fault state when dry-run undercurrent trips
    OverrideMode valveOverride; // AUTO / FORCE_ON / FORCE_OFF
    OverrideMode pumpOverride;  // AUTO / FORCE_ON / FORCE_OFF

    // Pump Safety Timers & On-Time Tracking
    PumpTimingState pumpTimingState; // IDLE, RUNNING, COOLDOWN
    unsigned long pumpRunStartTime;
    unsigned long pumpRunElapsedMs;       // Active running duration (or duration before stopping)
    unsigned long pumpLastRunDurationMs;   // Duration pump was on in the last cycle / timed-out cycle
    unsigned long pumpCooldownStartTime;
    unsigned long pumpCooldownRemainingMs;

    // Environmental Telemetry (DHT11)
    float temperatureC;
    float temperatureF;
    float humidity;
    bool dhtValid;

    // Fill cycle internal state
    bool isFillCycleActive; // true if active pumping/filling from Low to High
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
    void emergencyStop();

    // Telemetry & Command API
    const SystemTelemetry& getTelemetry() const { return _telemetry; }
    String getTelemetryJson() const;
    bool processCommandJson(const String& jsonString);

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

    bool _prevTankEmptyState;

    void readSensors();
    void executeStateMachine();
    void updateActuators();
};

extern WaterSystemController systemController;

#endif // CONTROLLER_H
