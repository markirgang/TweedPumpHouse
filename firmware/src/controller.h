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

    // Pressure Transducers & ADS1115 Telemetry
    float pressureMunicipalPsi;        // Live Municipal 9W Line Pressure (0 - 100 PSI)
    float pressureFillPipePsi;         // Live Uphill Fill Pipe / Booster Discharge Pressure (0 - 200 PSI)
    float pressureMunicipalVolts;      // Scaled Sensor Output Voltage (0.5V - 4.5V)
    float pressureFillPipeVolts;       // Scaled Sensor Output Voltage (0.5V - 4.5V)
    bool ads1115Detected;              // true if ADS1115 ADC responded on I2C (0x48)
    bool municipalLowPressureAlarm;    // true if Municipal line < 20 PSI
    bool fillPipeHighPressureAlarm;    // true if Fill pipe > 180 PSI (blockage/freeze danger)

    // FCS521-SD-10V AC Current Transmitter & Motor Protection Telemetry
    float pumpCurrentAmps;             // Live Pump AC RMS Current (0.0 - 50.0 Amps)
    float pumpCurrentVolts;            // Scaled Sensor Output Voltage (0.0V - 10.0V DC)
    float currentOverrideAmps;         // Simulated/Test Current Injection (-1.0f = AUTO mode)

    // Municipal Low Pressure (<5 PSI) 30-Second Cutout Safety Protection
    bool municipalPressureTrip;               // true if latched fault when municipal pressure < 5 PSI for 30s
    bool municipalPressureFaultPending;       // true if counting down 30s before dry-run shutdown
    unsigned long municipalPressureFaultStartTime; // millis() when <5 PSI fault started
    unsigned long municipalPressureFaultRemainingMs; // remaining ms before pump shutdown

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

    // I2S Mono Audio Amplifier Telemetry
    uint8_t audioVolume;                // 0 - 100%
    bool audioMuted;                    // true if audio is muted
    bool audioPlaying;                  // true if a tone/chime/siren/phrase is actively playing
    bool i2sAudioEnabled;               // true if I2S hardware audio amp is enabled
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
    void setCurrentOverrideAmps(float amps);
    void resetAllOverrides();
    void emergencyStop();

    // I2S Mono Audio Amplifier Controls & Cues
    void setAudioVolume(uint8_t percent);
    void setAudioMute(bool muted);
    void toggleAudioMute();
    void playAudioChime(int chimeId);
    void playAudioSiren(int sirenId, uint32_t durationMs = 0);
    void speakAudioPhrase(int phraseId);
    void stopAudio();

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

    // ADS1115 16-Bit I2C ADC Pressure & Current Driver
    bool _adsDetected;
    uint8_t _adsAddress;
    unsigned long _lastPressureReadTime;
    unsigned long _lastCurrentReadTime;
    float _emaPressureMunicipal;
    float _emaPressureFillPipe;
    float _emaPumpCurrent;
    float _emaPumpCurrentVolts;
    bool initADS1115();
    int16_t ads1115ReadRaw(uint8_t channel);
    float rawToSensorVolts(int16_t raw);
    float voltsToPsi(float sensorVolts, float maxPsi);
    float rawToCurrentSensorVolts(int16_t raw);
    float currentVoltsToAmps(float sensorVolts);
    void readPressureSensors();
    void readCurrentSensor();

    void readSensors();
    void executeStateMachine();
    void updateActuators();
public:
    bool isMcpDetected() const { return _mcpDetected; }
    bool isAds1115Detected() const { return _adsDetected; }
};

extern WaterSystemController systemController;

#endif // CONTROLLER_H
