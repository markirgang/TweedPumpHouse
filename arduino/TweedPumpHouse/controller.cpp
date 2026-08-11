#include "controller.h"
#include <ArduinoJson.h>

WaterSystemController systemController;

WaterSystemController::WaterSystemController() 
    : _dht(PIN_DHT11_DATA, DHT11),
      _lastDebounceTime(0),
      _lastDhtReadTime(0),
      _lastTelemetryBroadcast(0),
      _prevTankEmptyState(false)
{
    // Initialize default telemetry state
    _telemetry.tankEmpty = false;
    _telemetry.tankLow = false;
    _telemetry.tankHigh = false;
    _telemetry.freezeSensor = false;
    _telemetry.pumpOvercurrent = false;
    _telemetry.pumpUndercurrent = false;

    _telemetry.lineValve = false;
    _telemetry.pump = false;
    _telemetry.alarm = false;

    _telemetry.alarmSilenced = false;
    _telemetry.pumpOvercurrentTrip = false;
    _telemetry.pumpUndercurrentTrip = false;
    _telemetry.valveOverride = MODE_AUTO;
    _telemetry.pumpOverride = MODE_AUTO;

    _telemetry.tankHighOverride = MODE_AUTO;
    _telemetry.tankLowOverride = MODE_AUTO;
    _telemetry.tankEmptyOverride = MODE_AUTO;
    _telemetry.overcurrentOverride = MODE_AUTO;
    _telemetry.undercurrentOverride = MODE_AUTO;
    _telemetry.freezeOverride = MODE_AUTO;

    _telemetry.pumpTimingState = PUMP_STATE_IDLE;
    _telemetry.pumpRunStartTime = 0;
    _telemetry.pumpRunElapsedMs = 0;
    _telemetry.pumpLastRunDurationMs = 0;
    _telemetry.pumpCooldownStartTime = 0;
    _telemetry.pumpCooldownRemainingMs = 0;

    _telemetry.temperatureC = 20.0f;
    _telemetry.temperatureF = 68.0f;
    _telemetry.humidity = 50.0f;
    _telemetry.dhtValid = false;

    _telemetry.isFillCycleActive = false;
}

void WaterSystemController::begin() {
    // Configure Relay Actuator Output Pins
    pinMode(PIN_RELAY_LINE_VALVE, OUTPUT);
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_RELAY_ALARM, OUTPUT);

    digitalWrite(PIN_RELAY_LINE_VALVE, LOW);
    digitalWrite(PIN_RELAY_PUMP, LOW);
    digitalWrite(PIN_RELAY_ALARM, LOW);

    // Configure Float Switch and Freeze Sensor Input Pins with Pull-Up
    pinMode(PIN_FLOAT_TANK_EMPTY, INPUT_PULLUP);
    pinMode(PIN_FLOAT_TANK_LOW, INPUT_PULLUP);
    pinMode(PIN_FLOAT_TANK_HIGH, INPUT_PULLUP);
    pinMode(PIN_FREEZE_SENSOR, INPUT_PULLUP);

    // Configure Pump Current Protection Sensors (CON1 Header)
    pinMode(PIN_PUMP_OVERCURRENT, INPUT);
    pinMode(PIN_PUMP_UNDERCURRENT, INPUT);

    // Start DHT11 Sensor
    _dht.begin();

    // Initial sensor read
    readSensors();
}

void WaterSystemController::readSensors() {
    unsigned long now = millis();

    // Debounced Reading for Float Switches, Freeze Sensor & Current Sensors
    // Wiring convention (Switch to GND with Pullup):
    // - Tank Empty Switch: Down (OFF/Empty) = Pin HIGH (or LOW if NO/NC configured)
    //   Here we standardize active LOW on physical pin when switch contact closes.
    //   Tank Empty: Floating = Closed to GND (LOW) -> Not Empty. Down = Open (HIGH) -> Empty.
    //   Tank Low: Floating = Open (HIGH) -> OK. Down = Closed to GND (LOW) -> Tank Low.
    //   Tank High: Floating = Open (HIGH) -> Tank High Floating/Full. Down = Closed to GND (LOW) -> Dropped.
    //   Freeze Sensor: <40°F Closed to GND (LOW) -> Freeze danger. >=40°F Open (HIGH) -> Warm.
    //   Overcurrent Switch: Closed to GND (LOW) -> Overload trip. Open (HIGH) -> Normal.
    //   Undercurrent Switch: Closed to GND (LOW) -> Dry run / low load trip. Open (HIGH) -> Normal.
    
    bool rawEmpty = (digitalRead(PIN_FLOAT_TANK_EMPTY) == HIGH); // HIGH = switch down / empty
    bool rawLow = (digitalRead(PIN_FLOAT_TANK_LOW) == LOW);       // LOW = switch down / low water
    bool rawHigh = (digitalRead(PIN_FLOAT_TANK_HIGH) == LOW);     // LOW = switch down / filling allowed. HIGH = floating/FULL
    bool rawFreeze = (digitalRead(PIN_FREEZE_SENSOR) == LOW);     // LOW = <40°F freeze danger
    bool rawOvercurrent = (digitalRead(PIN_PUMP_OVERCURRENT) == LOW);   // LOW = Overcurrent fault
    bool rawUndercurrent = (digitalRead(PIN_PUMP_UNDERCURRENT) == LOW); // LOW = Undercurrent / Dry-run fault

    if (now - _lastDebounceTime > SENSOR_DEBOUNCE_MS) {
        // Tank High: false = Floating (FULL), true = Dropped/Down
        if (_telemetry.tankHighOverride == MODE_FORCE_ON) {
            _telemetry.tankHigh = false; // Simulated FULL (Floating)
        } else if (_telemetry.tankHighOverride == MODE_FORCE_OFF) {
            _telemetry.tankHigh = true;  // Simulated Down / Filling Allowed
        } else {
            _telemetry.tankHigh = rawHigh;
        }

        // Tank Low: true = Down (Low water / Demand fill), false = Floating (Adequate)
        if (_telemetry.tankLowOverride == MODE_FORCE_ON) {
            _telemetry.tankLow = true;  // Simulated LOW (Demand water)
        } else if (_telemetry.tankLowOverride == MODE_FORCE_OFF) {
            _telemetry.tankLow = false; // Simulated Adequate
        } else {
            _telemetry.tankLow = rawLow;
        }

        // Tank Empty: true = Down (Critical Empty Alarm), false = Floating (OK)
        if (_telemetry.tankEmptyOverride == MODE_FORCE_ON) {
            _telemetry.tankEmpty = true;  // Simulated Empty Alarm
        } else if (_telemetry.tankEmptyOverride == MODE_FORCE_OFF) {
            _telemetry.tankEmpty = false; // Simulated OK
        } else {
            _telemetry.tankEmpty = rawEmpty;
        }

        // Freeze Sensor: true = <40°F danger, false = >=40°F warm
        if (_telemetry.freezeOverride == MODE_FORCE_ON) {
            _telemetry.freezeSensor = true;  // Simulated <40F freeze danger
        } else if (_telemetry.freezeOverride == MODE_FORCE_OFF) {
            _telemetry.freezeSensor = false; // Simulated >=40F warm
        } else {
            _telemetry.freezeSensor = rawFreeze;
        }

        // Overcurrent: true = Overload Fault, false = Normal
        if (_telemetry.overcurrentOverride == MODE_FORCE_ON) {
            _telemetry.pumpOvercurrent = true;  // Simulated Overload Fault
        } else if (_telemetry.overcurrentOverride == MODE_FORCE_OFF) {
            _telemetry.pumpOvercurrent = false; // Simulated Normal
        } else {
            _telemetry.pumpOvercurrent = rawOvercurrent;
        }

        // Undercurrent: true = Dry Run Fault, false = Normal
        if (_telemetry.undercurrentOverride == MODE_FORCE_ON) {
            _telemetry.pumpUndercurrent = true;  // Simulated Dry Run Fault
        } else if (_telemetry.undercurrentOverride == MODE_FORCE_OFF) {
            _telemetry.pumpUndercurrent = false; // Simulated Normal
        } else {
            _telemetry.pumpUndercurrent = rawUndercurrent;
        }

        _lastDebounceTime = now;

        // Auto reset silence flag if tank was refilled and empties again
        if (!_telemetry.tankEmpty && _prevTankEmptyState) {
            _telemetry.alarmSilenced = false;
        }
        _prevTankEmptyState = _telemetry.tankEmpty;
    }

    // Read DHT11 Temperature & Humidity periodically
    if (now - _lastDhtReadTime > DHT_READ_INTERVAL_MS) {
        float h = _dht.readHumidity();
        float t = _dht.readTemperature(); // Celsius

        if (!isnan(h) && !isnan(t)) {
            _telemetry.humidity = h;
            _telemetry.temperatureC = t;
            _telemetry.temperatureF = (t * 1.8f) + 32.0f;
            _telemetry.dhtValid = true;
        } else {
            _telemetry.dhtValid = false;
        }
        _lastDhtReadTime = now;
    }
}

void WaterSystemController::executeStateMachine() {
    unsigned long now = millis();

    // -------------------------------------------------------------
    // 1. PUMP OVERCURRENT & UNDERCURRENT SAFETY TRIPS
    // -------------------------------------------------------------
    // Check if pump is active or trying to run while a current fault is sensed
    if (_telemetry.pump || _telemetry.pumpTimingState == PUMP_STATE_RUNNING || _telemetry.pumpOverride == MODE_FORCE_ON) {
        if (_telemetry.pumpOvercurrent) {
            _telemetry.pumpOvercurrentTrip = true;
        }
        if (_telemetry.pumpUndercurrent) {
            _telemetry.pumpUndercurrentTrip = true;
        }
    }

    bool hasCurrentFault = (_telemetry.pumpOvercurrentTrip || _telemetry.pumpUndercurrentTrip);

    // -------------------------------------------------------------
    // 2. TANK EMPTY & FAULT AUDIBLE ALARM LOGIC
    // -------------------------------------------------------------
    bool alarmCondition = _telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip;
    if (alarmCondition) {
        if (!_telemetry.alarmSilenced) {
            _telemetry.alarm = true;
        } else {
            _telemetry.alarm = false;
        }
    } else {
        _telemetry.alarm = false;
        _telemetry.alarmSilenced = false;
    }

    // -------------------------------------------------------------
    // 3. FILL CYCLE & PUMP / LINE VALVE AUTOMATION
    // -------------------------------------------------------------
    // Check if Tank High float switch is floating (rawHigh == false, Tank is FULL)
    if (!_telemetry.tankHigh) {
        // Tank has reached FULL level
        _telemetry.isFillCycleActive = false;

        // Stop pump and save run duration
        if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
            _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
            _telemetry.pumpTimingState = PUMP_STATE_IDLE;
        }
    } 
    // Check if Tank Low float switch is down (water has dropped to LOW)
    else if (_telemetry.tankLow) {
        // Demand active fill cycle
        _telemetry.isFillCycleActive = true;
    }

    // -------------------------------------------------------------
    // 4. PUMP TIMING & PROTECTION LOGIC (25m Max Run, 2h Cooldown)
    // -------------------------------------------------------------
    bool autoPumpRequest = false;

    if (hasCurrentFault) {
        // Current safety trip engaged -> shut off pump immediately and record run duration
        if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
            _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
            _telemetry.pumpTimingState = PUMP_STATE_IDLE;
        }
        autoPumpRequest = false;
    }
    else if (_telemetry.isFillCycleActive && _telemetry.tankLow) {
        // Water is low and actively demanding pump
        if (_telemetry.pumpTimingState == PUMP_STATE_IDLE) {
            _telemetry.pumpTimingState = PUMP_STATE_RUNNING;
            _telemetry.pumpRunStartTime = now;
            _telemetry.pumpRunElapsedMs = 0;
            autoPumpRequest = true;
        } 
        else if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpRunElapsedMs = now - _telemetry.pumpRunStartTime;
            if (_telemetry.pumpRunElapsedMs >= PUMP_MAX_RUN_TIME_MS) {
                // 25-minute run timeout exceeded -> enter 2-hour cooldown & preserve run duration
                _telemetry.pumpTimingState = PUMP_STATE_COOLDOWN;
                _telemetry.pumpLastRunDurationMs = _telemetry.pumpRunElapsedMs;
                _telemetry.pumpCooldownStartTime = now;
                _telemetry.pumpCooldownRemainingMs = PUMP_COOLDOWN_TIME_MS;
                autoPumpRequest = false;
            } else {
                autoPumpRequest = true;
            }
        } 
        else if (_telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
            unsigned long elapsedCooldown = now - _telemetry.pumpCooldownStartTime;
            if (elapsedCooldown >= PUMP_COOLDOWN_TIME_MS) {
                // Cooldown completed -> return to IDLE so pump can restart
                _telemetry.pumpTimingState = PUMP_STATE_IDLE;
                _telemetry.pumpCooldownRemainingMs = 0;
                autoPumpRequest = true;
            } else {
                _telemetry.pumpCooldownRemainingMs = PUMP_COOLDOWN_TIME_MS - elapsedCooldown;
                autoPumpRequest = false;
            }
        }
    } else {
        // If not demanding pump and currently running, stop pump & preserve run duration
        if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
            _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
            _telemetry.pumpTimingState = PUMP_STATE_IDLE;
        } else if (_telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
            unsigned long elapsedCooldown = now - _telemetry.pumpCooldownStartTime;
            if (elapsedCooldown >= PUMP_COOLDOWN_TIME_MS) {
                _telemetry.pumpTimingState = PUMP_STATE_IDLE;
                _telemetry.pumpCooldownRemainingMs = 0;
            } else {
                _telemetry.pumpCooldownRemainingMs = PUMP_COOLDOWN_TIME_MS - elapsedCooldown;
            }
        }
        autoPumpRequest = false;
    }

    // -------------------------------------------------------------
    // 5. LINE VALVE & FREEZE PROTECTION AUTOMATION
    // -------------------------------------------------------------
    bool autoLineValveRequest = false;

    if (!_telemetry.tankHigh) {
        // Tank is FULL: Line valve stays closed
        autoLineValveRequest = false;
    } 
    else if (_telemetry.isFillCycleActive) {
        // Active fill cycle in progress: Line valve OPEN
        autoLineValveRequest = true;
    } 
    else {
        // Water is between High and Low (Tank High has dropped/turned ON, but Low is not yet reached)
        if (_telemetry.freezeSensor) {
            // FREEZE DANGER (<40°F): Keep Line Valve CLOSED to protect fill pipe from freezing!
            autoLineValveRequest = false;
        } else {
            // WARM (>=40°F): Open Line Valve so municipal pressure alone can top off the tank
            autoLineValveRequest = true;
        }
    }

    // -------------------------------------------------------------
    // 6. APPLY MANUAL OVERRIDES & UPDATE DURATION
    // -------------------------------------------------------------
    // Line Valve Output
    if (_telemetry.valveOverride == MODE_FORCE_ON) {
        _telemetry.lineValve = true;
    } else if (_telemetry.valveOverride == MODE_FORCE_OFF) {
        _telemetry.lineValve = false;
    } else {
        _telemetry.lineValve = autoLineValveRequest;
    }

    // Pump Output
    if (hasCurrentFault) {
        // Fault active: Override cannot bypass motor protection
        _telemetry.pump = false;
    } else if (_telemetry.pumpOverride == MODE_FORCE_ON) {
        if (!_telemetry.pump) {
            _telemetry.pumpRunStartTime = now;
        }
        _telemetry.pump = true;
        _telemetry.pumpTimingState = PUMP_STATE_RUNNING;
        _telemetry.pumpRunElapsedMs = now - _telemetry.pumpRunStartTime;
    } else if (_telemetry.pumpOverride == MODE_FORCE_OFF) {
        if (_telemetry.pump) {
            _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
            _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
        }
        _telemetry.pump = false;
    } else {
        _telemetry.pump = autoPumpRequest;
        if (_telemetry.pump && _telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpRunElapsedMs = now - _telemetry.pumpRunStartTime;
        }
    }
}

void WaterSystemController::updateActuators() {
    // Write physical pin outputs to relays (Active HIGH)
    digitalWrite(PIN_RELAY_LINE_VALVE, _telemetry.lineValve ? HIGH : LOW);
    digitalWrite(PIN_RELAY_PUMP, _telemetry.pump ? HIGH : LOW);
    digitalWrite(PIN_RELAY_ALARM, _telemetry.alarm ? HIGH : LOW);
}

void WaterSystemController::update() {
    readSensors();
    executeStateMachine();
    updateActuators();
}

void WaterSystemController::silenceAlarm() {
    if (_telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip) {
        _telemetry.alarmSilenced = true;
        _telemetry.alarm = false;
        digitalWrite(PIN_RELAY_ALARM, LOW);
    }
}

void WaterSystemController::resetPumpTimeout() {
    _telemetry.pumpTimingState = PUMP_STATE_IDLE;
    _telemetry.pumpRunStartTime = 0;
    _telemetry.pumpRunElapsedMs = 0;
    _telemetry.pumpCooldownStartTime = 0;
    _telemetry.pumpCooldownRemainingMs = 0;
    _telemetry.pumpOvercurrentTrip = false;
    _telemetry.pumpUndercurrentTrip = false;
    _telemetry.alarmSilenced = false;
}

void WaterSystemController::setLineValveOverride(OverrideMode mode) {
    _telemetry.valveOverride = mode;
}

void WaterSystemController::setPumpOverride(OverrideMode mode) {
    _telemetry.pumpOverride = mode;
}

void WaterSystemController::setTankHighOverride(OverrideMode mode) {
    _telemetry.tankHighOverride = mode;
}

void WaterSystemController::setTankLowOverride(OverrideMode mode) {
    _telemetry.tankLowOverride = mode;
}

void WaterSystemController::setTankEmptyOverride(OverrideMode mode) {
    _telemetry.tankEmptyOverride = mode;
}

void WaterSystemController::setOvercurrentOverride(OverrideMode mode) {
    _telemetry.overcurrentOverride = mode;
}

void WaterSystemController::setUndercurrentOverride(OverrideMode mode) {
    _telemetry.undercurrentOverride = mode;
}

void WaterSystemController::setFreezeOverride(OverrideMode mode) {
    _telemetry.freezeOverride = mode;
}

void WaterSystemController::resetAllOverrides() {
    _telemetry.valveOverride = MODE_AUTO;
    _telemetry.pumpOverride = MODE_AUTO;
    _telemetry.tankHighOverride = MODE_AUTO;
    _telemetry.tankLowOverride = MODE_AUTO;
    _telemetry.tankEmptyOverride = MODE_AUTO;
    _telemetry.overcurrentOverride = MODE_AUTO;
    _telemetry.undercurrentOverride = MODE_AUTO;
    _telemetry.freezeOverride = MODE_AUTO;
}

void WaterSystemController::emergencyStop() {
    _telemetry.valveOverride = MODE_FORCE_OFF;
    _telemetry.pumpOverride = MODE_FORCE_OFF;
    _telemetry.isFillCycleActive = false;
    _telemetry.lineValve = false;
    _telemetry.pump = false;
    digitalWrite(PIN_RELAY_LINE_VALVE, LOW);
    digitalWrite(PIN_RELAY_PUMP, LOW);
}

String WaterSystemController::getTelemetryJson() const {
    JsonDocument doc;

    // Sensors
    doc["tankEmpty"] = _telemetry.tankEmpty;
    doc["tankLow"] = _telemetry.tankLow;
    doc["tankHigh"] = _telemetry.tankHigh;
    doc["freezeSensor"] = _telemetry.freezeSensor;
    doc["pumpOvercurrent"] = _telemetry.pumpOvercurrent;
    doc["pumpUndercurrent"] = _telemetry.pumpUndercurrent;

    // Actuators
    doc["lineValve"] = _telemetry.lineValve;
    doc["pump"] = _telemetry.pump;
    doc["alarm"] = _telemetry.alarm;
    doc["alarmSilenced"] = _telemetry.alarmSilenced;

    // Faults & Overrides
    doc["pumpOvercurrentTrip"] = _telemetry.pumpOvercurrentTrip;
    doc["pumpUndercurrentTrip"] = _telemetry.pumpUndercurrentTrip;
    doc["valveOverride"] = (int)_telemetry.valveOverride;
    doc["pumpOverride"] = (int)_telemetry.pumpOverride;
    doc["tankHighOverride"] = (int)_telemetry.tankHighOverride;
    doc["tankLowOverride"] = (int)_telemetry.tankLowOverride;
    doc["tankEmptyOverride"] = (int)_telemetry.tankEmptyOverride;
    doc["overcurrentOverride"] = (int)_telemetry.overcurrentOverride;
    doc["undercurrentOverride"] = (int)_telemetry.undercurrentOverride;
    doc["freezeOverride"] = (int)_telemetry.freezeOverride;

    // Pump timers & On-Time Tracking
    doc["pumpTimingState"] = (int)_telemetry.pumpTimingState;
    doc["pumpTimedOut"] = (_telemetry.pumpTimingState == PUMP_STATE_COOLDOWN);
    doc["pumpRunElapsedSec"] = _telemetry.pumpRunElapsedMs / 1000UL;
    doc["pumpLastRunDurationSec"] = _telemetry.pumpLastRunDurationMs / 1000UL;
    doc["pumpRunMaxSec"] = PUMP_MAX_RUN_TIME_MS / 1000UL;
    doc["pumpCooldownRemainingSec"] = _telemetry.pumpCooldownRemainingMs / 1000UL;
    doc["pumpCooldownTotalSec"] = PUMP_COOLDOWN_TIME_MS / 1000UL;

    // DHT11
    doc["temperatureC"] = _telemetry.temperatureC;
    doc["temperatureF"] = _telemetry.temperatureF;
    doc["humidity"] = _telemetry.humidity;
    doc["dhtValid"] = _telemetry.dhtValid;

    // Fill cycle
    doc["fillCycleActive"] = _telemetry.isFillCycleActive;
    doc["uptimeMs"] = millis();

    String output;
    serializeJson(doc, output);
    return output;
}

bool WaterSystemController::processCommandJson(const String& jsonString) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, jsonString);
    if (error) {
        return false;
    }

    if (doc.containsKey("silenceAlarm")) {
        silenceAlarm();
    }
    if (doc.containsKey("resetPumpTimeout") || doc.containsKey("resetPumpFault")) {
        resetPumpTimeout();
    }
    if (doc.containsKey("setValveOverride")) {
        int mode = doc["setValveOverride"];
        if (mode >= 0 && mode <= 2) {
            setLineValveOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setPumpOverride")) {
        int mode = doc["setPumpOverride"];
        if (mode >= 0 && mode <= 2) {
            setPumpOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setTankHighOverride")) {
        int mode = doc["setTankHighOverride"];
        if (mode >= 0 && mode <= 2) {
            setTankHighOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setTankLowOverride")) {
        int mode = doc["setTankLowOverride"];
        if (mode >= 0 && mode <= 2) {
            setTankLowOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setTankEmptyOverride")) {
        int mode = doc["setTankEmptyOverride"];
        if (mode >= 0 && mode <= 2) {
            setTankEmptyOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setOvercurrentOverride")) {
        int mode = doc["setOvercurrentOverride"];
        if (mode >= 0 && mode <= 2) {
            setOvercurrentOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setUndercurrentOverride")) {
        int mode = doc["setUndercurrentOverride"];
        if (mode >= 0 && mode <= 2) {
            setUndercurrentOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("setFreezeOverride")) {
        int mode = doc["setFreezeOverride"];
        if (mode >= 0 && mode <= 2) {
            setFreezeOverride((OverrideMode)mode);
        }
    }
    if (doc.containsKey("resetAllOverrides")) {
        resetAllOverrides();
    }
    if (doc.containsKey("emergencyStop")) {
        emergencyStop();
    }

    return true;
}
