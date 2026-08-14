#include "controller.h"
#include <ArduinoJson.h>
#include <Wire.h>

WaterSystemController systemController;

WaterSystemController::WaterSystemController() 
    : _dht(PIN_DHT11_DATA, DHT11),
      _lastDebounceTime(0),
      _lastDhtReadTime(0),
      _lastTelemetryBroadcast(0),
      _lineValveOpenedTime(0),
      _prevTankEmptyState(false),
      _prevPumpRoomLowTempState(false),
      _mcpDetected(false),
      _mcpAddress(MCP23017_DEFAULT_ADDR),
      _mcpOutputLatchB(0x00)
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
    _telemetry.relayLowTempAlarm = false;

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

    _telemetry.pumpCurrentFaultPending = false;
    _telemetry.isOvercurrentPending = false;
    _telemetry.isUndercurrentPending = false;
    _telemetry.pumpCurrentFaultStartTime = 0;
    _telemetry.pumpCurrentFaultRemainingMs = 0;
    _telemetry.alarmPulsing = false;

    _telemetry.temperatureC = 20.0f;
    _telemetry.temperatureF = 68.0f;
    _telemetry.humidity = 50.0f;
    _telemetry.dhtValid = false;
    _telemetry.pumpRoomLowTempAlarm = false;
    _telemetry.isFillCycleActive = false;

    // Hexapod Default State
    _telemetry.hexapodMouth = false;
    _telemetry.hexapodEyes = true;
    _telemetry.hexapodSpeechSync = true;
    _hexapodLastBlinkTime = 0;
    _hexapodIsBlinking = false;
    _hexapodNextBlinkInterval = 3500;
    _hexapodMouthOffTime = 0;
}

void WaterSystemController::mcpWriteRegister(uint8_t addr, uint8_t reg, uint8_t val) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.write(val);
    Wire.endTransmission();
}

uint8_t WaterSystemController::mcpReadRegister(uint8_t addr, uint8_t reg) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    if (Wire.endTransmission() != 0) {
        return 0xFF;
    }
    Wire.requestFrom(addr, (uint8_t)1);
    if (Wire.available()) {
        return Wire.read();
    }
    return 0xFF;
}

bool WaterSystemController::initMCP23017() {
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);

    // Scan for MCP23017 expansion module (standard addresses 0x20 to 0x27)
    _mcpDetected = false;
    for (uint8_t addr = 0x20; addr <= 0x27; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            _mcpAddress = addr;
            _mcpDetected = true;
            break;
        }
    }

    if (_mcpDetected) {
        Serial.printf("[MCP23017] Detected 16-bit I/O Expander module at I2C address 0x%02X\n", _mcpAddress);
        
        // 1. Port A Direction: All 8 pins as INPUTS (0xFF)
        mcpWriteRegister(_mcpAddress, MCP23017_IODIRA, 0xFF);

        // 2. Port A Pull-ups: Enable 100k internal pull-up resistors on all Port A inputs (0xFF)
        mcpWriteRegister(_mcpAddress, MCP23017_GPPUA, 0xFF);

        // 3. Port B Direction: All 8 pins as OUTPUTS (0x00) for Relays and Actuators
        mcpWriteRegister(_mcpAddress, MCP23017_IODIRB, 0x00);

        // 4. Port B Outputs: Default all relays OFF (0x00) except Hexapod Eyes ON (Bit 5 = 0x20)
        _mcpOutputLatchB = (1 << MCP_PIN_HEXAPOD_EYES);
        mcpWriteRegister(_mcpAddress, MCP23017_OLATB, _mcpOutputLatchB);

        Serial.println("[MCP23017] Successfully configured Port A (Inputs with Pullup) and Port B (Relay Outputs)");
        return true;
    } else {
        Serial.println("[MCP23017] Note: No MCP23017 expander detected on I2C bus; falling back to direct GPIO / simulation mode");
        return false;
    }
}

void WaterSystemController::begin() {
    // 1. Initialize MCP23017 I/O Expander Module on I2C (GPIO 8 SDA, GPIO 9 SCL)
    initMCP23017();

    // 2. Configure Fallback Relay Actuator Output Pins (Active HIGH)
    pinMode(PIN_RELAY_LINE_VALVE, OUTPUT);
    pinMode(PIN_RELAY_PUMP, OUTPUT);
    pinMode(PIN_RELAY_ALARM, OUTPUT);
    pinMode(PIN_RELAY_LOW_TEMP_ALARM, OUTPUT);

    digitalWrite(PIN_RELAY_LINE_VALVE, LOW);
    digitalWrite(PIN_RELAY_PUMP, LOW);
    digitalWrite(PIN_RELAY_ALARM, LOW);
    digitalWrite(PIN_RELAY_LOW_TEMP_ALARM, LOW);

    // 3. Configure Fallback Hexapod Physical Mouth & Eyes Actuator / LED Output Pins
    pinMode(PIN_HEXAPOD_MOUTH, OUTPUT);
    pinMode(PIN_HEXAPOD_EYES, OUTPUT);
    digitalWrite(PIN_HEXAPOD_MOUTH, LOW);
    digitalWrite(PIN_HEXAPOD_EYES, HIGH); // Default eyes illuminated

    // 4. Configure Fallback Float Switch and Freeze Sensor Input Pins with Pull-Up
    pinMode(PIN_FLOAT_TANK_EMPTY, INPUT_PULLUP);
    pinMode(PIN_FLOAT_TANK_LOW, INPUT_PULLUP);
    pinMode(PIN_FLOAT_TANK_HIGH, INPUT_PULLUP);
    pinMode(PIN_FREEZE_SENSOR, INPUT_PULLUP);

    // 5. Configure Fallback Pump Current Protection Sensors (CON1 Header)
    pinMode(PIN_PUMP_OVERCURRENT, INPUT);
    pinMode(PIN_PUMP_UNDERCURRENT, INPUT);

    // 6. Start DHT11 Sensor
    _dht.begin();

    // 7. Initial sensor read
    readSensors();
}

void WaterSystemController::readSensors() {
    unsigned long now = millis();

    // Debounced Reading for Float Switches, Freeze Sensor & Current Sensors
    // Field Logic:
    // - Tank Low Switch:    LOW = Adequate (Auto OK), HIGH = Demand Water (Fill Demand)
    // - Tank High Switch:   LOW = Tank Full (Shutoff Stop), HIGH = Below Full (Filling Allowed)
    // - Freeze Sensor:      HIGH = <40°F (Freeze Hazard / Pipe Drain), LOW = >=40°F (Warm / Normal Top-Off)
    // - Tank Empty Switch:  LOW = Critical Empty (ALARM), HIGH = Adequate (Normal OK)
    // - Overcurrent Switch: LOW = Overload fault, HIGH = Normal
    // - Undercurrent Switch:LOW = Dry-run fault, HIGH = Normal
    
    bool rawEmpty;
    bool rawLow;
    bool rawHigh;
    bool rawFreeze;
    bool rawOvercurrent;
    bool rawUndercurrent;

    if (_mcpDetected) {
        // Read Port A (all 8 input bits) directly from MCP23017
        uint8_t portA = mcpReadRegister(_mcpAddress, MCP23017_GPIOA);
        rawHigh = ((portA & (1 << MCP_PIN_FLOAT_TANK_HIGH)) != 0);
        rawLow = ((portA & (1 << MCP_PIN_FLOAT_TANK_LOW)) != 0);
        rawEmpty = ((portA & (1 << MCP_PIN_FLOAT_TANK_EMPTY)) == 0); // Active LOW = Empty Alarm
        rawFreeze = ((portA & (1 << MCP_PIN_FREEZE_SENSOR)) != 0);   // HIGH = <40F
        rawOvercurrent = ((portA & (1 << MCP_PIN_PUMP_OVERCURRENT)) == 0); // Active LOW = Fault
        rawUndercurrent = ((portA & (1 << MCP_PIN_PUMP_UNDERCURRENT)) == 0); // Active LOW = Fault
    } else {
        // Fallback to direct GPIO pin reads
        rawEmpty = (digitalRead(PIN_FLOAT_TANK_EMPTY) == LOW);
        rawLow = (digitalRead(PIN_FLOAT_TANK_LOW) == HIGH);
        rawHigh = (digitalRead(PIN_FLOAT_TANK_HIGH) == HIGH);
        rawFreeze = (digitalRead(PIN_FREEZE_SENSOR) == HIGH);
        rawOvercurrent = (digitalRead(PIN_PUMP_OVERCURRENT) == LOW);
        rawUndercurrent = (digitalRead(PIN_PUMP_UNDERCURRENT) == LOW);
    }

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
            _telemetry.pumpRoomLowTempAlarm = (_telemetry.temperatureF < PUMP_ROOM_LOW_TEMP_ALARM_THRESHOLD_F);
        } else {
            _telemetry.dhtValid = false;
        }
        _lastDhtReadTime = now;

        // Auto reset silence flag if pump room warmed back up and drops below 55°F again
        if (!_telemetry.pumpRoomLowTempAlarm && _prevPumpRoomLowTempState) {
            _telemetry.alarmSilenced = false;
        }
        _prevPumpRoomLowTempState = _telemetry.pumpRoomLowTempAlarm;
    }
}

void WaterSystemController::executeStateMachine() {
    unsigned long now = millis();

    // -------------------------------------------------------------
    // 1. PUMP OVERCURRENT & UNDERCURRENT SAFETY TRIPS (WITH 5s STABILIZATION & 1-MIN WARNING PULSE)
    // -------------------------------------------------------------
    bool isPumpRunning = (_telemetry.pump || _telemetry.pumpTimingState == PUMP_STATE_RUNNING || _telemetry.pumpOverride == MODE_FORCE_ON);
    // Allow 5 seconds for motor inrush current and suction prime to stabilize before evaluating overcurrent/undercurrent
    bool isCurrentStabilized = isPumpRunning && (_telemetry.pumpRunStartTime > 0) && ((now - _telemetry.pumpRunStartTime) >= PUMP_START_STABILIZE_DELAY_MS);
    bool hasActiveSensorFault = (_telemetry.pumpOvercurrent || _telemetry.pumpUndercurrent);

    // If neither trip is already latched:
    if (!_telemetry.pumpOvercurrentTrip && !_telemetry.pumpUndercurrentTrip) {
        if (isCurrentStabilized && hasActiveSensorFault) {
            if (!_telemetry.pumpCurrentFaultPending) {
                // Start 1-minute warning countdown
                _telemetry.pumpCurrentFaultPending = true;
                _telemetry.pumpCurrentFaultStartTime = now;
                _telemetry.isOvercurrentPending = _telemetry.pumpOvercurrent;
                _telemetry.isUndercurrentPending = _telemetry.pumpUndercurrent;
                _telemetry.pumpCurrentFaultRemainingMs = PUMP_CURRENT_FAULT_DELAY_MS;
            } else {
                if (_telemetry.pumpOvercurrent) _telemetry.isOvercurrentPending = true;
                if (_telemetry.pumpUndercurrent) _telemetry.isUndercurrentPending = true;

                unsigned long elapsed = now - _telemetry.pumpCurrentFaultStartTime;
                if (elapsed >= PUMP_CURRENT_FAULT_DELAY_MS) {
                    // Full 1 minute elapsed with continuous fault -> Latch trip & stop pump
                    if (_telemetry.isOvercurrentPending) {
                        _telemetry.pumpOvercurrentTrip = true;
                    }
                    if (_telemetry.isUndercurrentPending) {
                        _telemetry.pumpUndercurrentTrip = true;
                    }
                    _telemetry.pumpCurrentFaultPending = false;
                    _telemetry.pumpCurrentFaultRemainingMs = 0;
                    _telemetry.isOvercurrentPending = false;
                    _telemetry.isUndercurrentPending = false;
                    _telemetry.alarmPulsing = false;
                } else {
                    _telemetry.pumpCurrentFaultRemainingMs = PUMP_CURRENT_FAULT_DELAY_MS - elapsed;
                }
            }
        } else if (_telemetry.pumpCurrentFaultPending && (!hasActiveSensorFault || !isPumpRunning)) {
            // Fault cleared within the 1-minute window or pump stopped -> Cancel warning and alarm pulse
            _telemetry.pumpCurrentFaultPending = false;
            _telemetry.pumpCurrentFaultStartTime = 0;
            _telemetry.pumpCurrentFaultRemainingMs = 0;
            _telemetry.isOvercurrentPending = false;
            _telemetry.isUndercurrentPending = false;
            _telemetry.alarmPulsing = false;
        }
    }

    bool hasCurrentFault = (_telemetry.pumpOvercurrentTrip || _telemetry.pumpUndercurrentTrip);

    // -------------------------------------------------------------
    // 2. TANK EMPTY, LOW PUMP ROOM TEMP (<55°F) & FAULT AUDIBLE ALARM / PULSING LOGIC
    // -------------------------------------------------------------
    if (_telemetry.pumpCurrentFaultPending) {
        // Pre-trip warning period: pulse alarm relay (500ms ON / 500ms OFF)
        if (!_telemetry.alarmSilenced) {
            bool pulseOn = ((now / ALARM_PULSE_INTERVAL_MS) % 2 == 0);
            _telemetry.alarm = pulseOn;
            _telemetry.alarmPulsing = true;
        } else {
            _telemetry.alarm = false;
            _telemetry.alarmPulsing = false;
        }
    } else {
        _telemetry.alarmPulsing = false;
        bool alarmCondition = _telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip || _telemetry.pumpRoomLowTempAlarm;
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
    }

    // Pumphouse Interior Low Temp Alarm Dedicated Relay (GPIO 13)
    _telemetry.relayLowTempAlarm = _telemetry.pumpRoomLowTempAlarm;

    // -------------------------------------------------------------
    // 3. FILL CYCLE AUTOMATION (Tank High / Low Level Transitions)
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
    // 4. LINE VALVE & FREEZE PROTECTION AUTOMATION
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

    // Apply Line Valve Manual Override & Output
    bool prevLineValve = _telemetry.lineValve;
    if (_telemetry.valveOverride == MODE_FORCE_ON) {
        _telemetry.lineValve = true;
    } else if (_telemetry.valveOverride == MODE_FORCE_OFF) {
        _telemetry.lineValve = false;
    } else {
        _telemetry.lineValve = autoLineValveRequest;
    }

    // Track when Line Valve was opened to enforce the 5-second booster pump start delay
    if (_telemetry.lineValve) {
        if (!prevLineValve || _lineValveOpenedTime == 0) {
            _lineValveOpenedTime = now;
        }
    } else {
        _lineValveOpenedTime = 0;
    }

    // -------------------------------------------------------------
    // 5. BOOSTER PUMP TIMING, 5-SECOND START DELAY & MOTOR PROTECTION
    // -------------------------------------------------------------
    bool autoPumpRequest = false;
    bool lineValveReady = _telemetry.lineValve && (_lineValveOpenedTime > 0) && ((now - _lineValveOpenedTime) >= LINE_VALVE_TO_PUMP_DELAY_MS);

    if (hasCurrentFault) {
        // Current safety trip engaged -> shut off pump immediately and record run duration
        if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
            _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
            _telemetry.pumpTimingState = PUMP_STATE_IDLE;
        }
        autoPumpRequest = false;
    }
    else if (_telemetry.isFillCycleActive && _telemetry.tankLow && lineValveReady) {
        // Water is low, active fill demanded, and line valve has been open for at least 5 seconds
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
        // If not demanding pump (or still in 5s line valve prime delay) and currently running, stop pump & preserve run duration
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
    // 6. APPLY BOOSTER PUMP MANUAL OVERRIDES
    // -------------------------------------------------------------
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
    bool eyeState = _telemetry.hexapodEyes && !_hexapodIsBlinking;

    // 1. Write outputs to MCP23017 16-Bit I/O Expander Port B
    if (_mcpDetected) {
        uint8_t outB = 0;
        if (_telemetry.lineValve)         outB |= (1 << MCP_PIN_RELAY_LINE_VALVE);
        if (_telemetry.pump)              outB |= (1 << MCP_PIN_RELAY_PUMP);
        if (_telemetry.alarm)             outB |= (1 << MCP_PIN_RELAY_ALARM);
        if (_telemetry.relayLowTempAlarm) outB |= (1 << MCP_PIN_RELAY_LOW_TEMP_ALARM);
        if (_telemetry.hexapodMouth)      outB |= (1 << MCP_PIN_HEXAPOD_MOUTH);
        if (eyeState)                     outB |= (1 << MCP_PIN_HEXAPOD_EYES);

        if (outB != _mcpOutputLatchB) {
            _mcpOutputLatchB = outB;
            mcpWriteRegister(_mcpAddress, MCP23017_OLATB, _mcpOutputLatchB);
        }
    }

    // 2. Write fallback physical pin outputs to relays (Active HIGH)
    digitalWrite(PIN_RELAY_LINE_VALVE, _telemetry.lineValve ? HIGH : LOW);
    digitalWrite(PIN_RELAY_PUMP, _telemetry.pump ? HIGH : LOW);
    digitalWrite(PIN_RELAY_ALARM, _telemetry.alarm ? HIGH : LOW);
    digitalWrite(PIN_RELAY_LOW_TEMP_ALARM, _telemetry.relayLowTempAlarm ? HIGH : LOW);

    // 3. Write fallback physical pin outputs to Hexapod Mascot (Active HIGH)
    digitalWrite(PIN_HEXAPOD_MOUTH, _telemetry.hexapodMouth ? HIGH : LOW);
    digitalWrite(PIN_HEXAPOD_EYES, eyeState ? HIGH : LOW);
}

void WaterSystemController::update() {
    readSensors();
    executeStateMachine();

    // Natural Hexapod LED Eyes Blinking & Mouth Pulse Handling
    unsigned long now = millis();
    if (_telemetry.hexapodEyes) {
        if (!_hexapodIsBlinking && (now - _hexapodLastBlinkTime >= _hexapodNextBlinkInterval)) {
            _hexapodIsBlinking = true;
            _hexapodLastBlinkTime = now;
        } else if (_hexapodIsBlinking && (now - _hexapodLastBlinkTime >= HEXAPOD_BLINK_DURATION_MS)) {
            _hexapodIsBlinking = false;
            _hexapodLastBlinkTime = now;
            _hexapodNextBlinkInterval = HEXAPOD_BLINK_INTERVAL_MIN_MS + (now % (HEXAPOD_BLINK_INTERVAL_MAX_MS - HEXAPOD_BLINK_INTERVAL_MIN_MS));
        }
    }

    // Auto-close mouth if speech sync pulse timed out
    if (_telemetry.hexapodSpeechSync && _telemetry.hexapodMouth && _hexapodMouthOffTime > 0 && now >= _hexapodMouthOffTime) {
        _telemetry.hexapodMouth = false;
        _hexapodMouthOffTime = 0;
    }

    updateActuators();
}

void WaterSystemController::setHexapodMouth(bool open) {
    _telemetry.hexapodMouth = open;
    if (open && _telemetry.hexapodSpeechSync) {
        _hexapodMouthOffTime = millis() + HEXAPOD_MOUTH_AUTO_CLOSE_MS;
    }
}

void WaterSystemController::setHexapodEyes(bool on) {
    _telemetry.hexapodEyes = on;
    _hexapodIsBlinking = false;
    _hexapodLastBlinkTime = millis();
}

void WaterSystemController::setHexapodSpeechSync(bool enabled) {
    _telemetry.hexapodSpeechSync = enabled;
    if (!enabled) {
        _telemetry.hexapodMouth = false;
        _hexapodMouthOffTime = 0;
    }
}

void WaterSystemController::silenceAlarm() {
    if (_telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip || _telemetry.pumpCurrentFaultPending) {
        _telemetry.alarmSilenced = true;
        _telemetry.alarm = false;
        _telemetry.alarmPulsing = false;
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
    _telemetry.pumpCurrentFaultPending = false;
    _telemetry.pumpCurrentFaultStartTime = 0;
    _telemetry.pumpCurrentFaultRemainingMs = 0;
    _telemetry.isOvercurrentPending = false;
    _telemetry.isUndercurrentPending = false;
    _telemetry.alarmPulsing = false;
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
    _lineValveOpenedTime = 0;
    digitalWrite(PIN_RELAY_LINE_VALVE, LOW);
    digitalWrite(PIN_RELAY_PUMP, LOW);
}

bool WaterSystemController::verifyPassword(const String& pass) const {
    if (pass.length() == 0) return false;
    return (pass == SYSTEM_ACCESS_PASSWORD || pass == SYSTEM_ACCESS_PASSWORD_ALT);
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
    doc["relayLowTempAlarm"] = _telemetry.relayLowTempAlarm;
    doc["alarmSilenced"] = _telemetry.alarmSilenced;
    doc["mcpDetected"] = _mcpDetected;
    doc["mcpAddress"] = _mcpAddress;

    // Faults, Warnings & Overrides
    doc["pumpOvercurrentTrip"] = _telemetry.pumpOvercurrentTrip;
    doc["pumpUndercurrentTrip"] = _telemetry.pumpUndercurrentTrip;
    doc["pumpCurrentFaultPending"] = _telemetry.pumpCurrentFaultPending;
    doc["pumpCurrentFaultRemainingSec"] = _telemetry.pumpCurrentFaultRemainingMs / 1000UL;
    doc["isOvercurrentPending"] = _telemetry.isOvercurrentPending;
    doc["isUndercurrentPending"] = _telemetry.isUndercurrentPending;
    doc["alarmPulsing"] = _telemetry.alarmPulsing;

    doc["valveOverride"] = (int)_telemetry.valveOverride;
    doc["pumpOverride"] = (int)_telemetry.pumpOverride;
    doc["tankHighOverride"] = (int)_telemetry.tankHighOverride;
    doc["tankLowOverride"] = (int)_telemetry.tankLowOverride;
    doc["tankEmptyOverride"] = (int)_telemetry.tankEmptyOverride;
    doc["overcurrentOverride"] = (int)_telemetry.overcurrentOverride;
    doc["undercurrentOverride"] = (int)_telemetry.undercurrentOverride;
    doc["freezeOverride"] = (int)_telemetry.freezeOverride;

    // Hexapod Robotic Mascot
    doc["hexapodMouth"] = _telemetry.hexapodMouth;
    doc["hexapodEyes"] = _telemetry.hexapodEyes;
    doc["hexapodSpeechSync"] = _telemetry.hexapodSpeechSync;

    // Pump timers & On-Time Tracking
    doc["pumpTimingState"] = (int)_telemetry.pumpTimingState;
    doc["pumpTimedOut"] = (_telemetry.pumpTimingState == PUMP_STATE_COOLDOWN);
    doc["pumpRunElapsedSec"] = _telemetry.pumpRunElapsedMs / 1000UL;
    doc["pumpLastRunDurationSec"] = _telemetry.pumpLastRunDurationMs / 1000UL;
    doc["pumpRunMaxSec"] = PUMP_MAX_RUN_TIME_MS / 1000UL;
    doc["pumpCooldownRemainingSec"] = _telemetry.pumpCooldownRemainingMs / 1000UL;
    doc["pumpCooldownTotalSec"] = PUMP_COOLDOWN_TIME_MS / 1000UL;

    // DHT11 & Environmental Alarms
    doc["temperatureC"] = _telemetry.temperatureC;
    doc["temperatureF"] = _telemetry.temperatureF;
    doc["humidity"] = _telemetry.humidity;
    doc["dhtValid"] = _telemetry.dhtValid;
    doc["pumpRoomLowTempAlarm"] = _telemetry.pumpRoomLowTempAlarm;

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

    // Require password authentication for changing any sensor, valve, or pump override state
    bool hasOverrideCmd = doc.containsKey("setValveOverride") || doc.containsKey("setPumpOverride") ||
                          doc.containsKey("setTankHighOverride") || doc.containsKey("setTankLowOverride") ||
                          doc.containsKey("setTankEmptyOverride") || doc.containsKey("setOvercurrentOverride") ||
                          doc.containsKey("setUndercurrentOverride") || doc.containsKey("setFreezeOverride") ||
                          doc.containsKey("resetAllOverrides");
    if (hasOverrideCmd) {
        String pwd = doc["password"] | "";
        String pin = doc["pin"] | "";
        if (!verifyPassword(pwd) && !verifyPassword(pin)) {
            Serial.println("[SECURITY] Unauthorized override command rejected (incorrect PIN/password).");
            return false;
        }
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

    // Hexapod Robotic Mascot & Speech Sync Commands
    if (doc.containsKey("setHexapodMouth")) {
        setHexapodMouth(doc["setHexapodMouth"].as<bool>());
    }
    if (doc.containsKey("setHexapodEyes")) {
        setHexapodEyes(doc["setHexapodEyes"].as<bool>());
    }
    if (doc.containsKey("setHexapodSpeechSync")) {
        setHexapodSpeechSync(doc["setHexapodSpeechSync"].as<bool>());
    }

    return true;
}


