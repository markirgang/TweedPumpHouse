#include "controller.h"
#include "i2s_audio.h"
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
      _mcpOutputLatchB(0x00),
      _adsDetected(false),
      _adsAddress(ADS1115_DEFAULT_ADDR),
      _lastPressureReadTime(0),
      _lastCurrentReadTime(0),
      _emaPressureMunicipal(58.0f),
      _emaPressureFillPipe(0.0f),
      _emaPumpCurrent(0.0f),
      _emaPumpCurrentVolts(0.0f)
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

    // Pressure Transducers & ADS1115 Telemetry
    _telemetry.pressureMunicipalPsi = 58.0f;
    _telemetry.pressureFillPipePsi = 0.0f;
    _telemetry.pressureMunicipalVolts = 2.82f;
    _telemetry.pressureFillPipeVolts = 0.50f;
    _telemetry.ads1115Detected = false;
    _telemetry.municipalLowPressureAlarm = false;
    _telemetry.fillPipeHighPressureAlarm = false;

    // FCS521-SD-10V AC Current Transmitter Telemetry
    _telemetry.pumpCurrentAmps = 0.0f;
    _telemetry.pumpCurrentVolts = 0.0f;
    _telemetry.currentOverrideAmps = -1.0f; // -1.0f = AUTO mode

    // Municipal Low Pressure (<5 PSI) 30-Second Cutout Safety Protection
    _telemetry.municipalPressureTrip = false;
    _telemetry.municipalPressureFaultPending = false;
    _telemetry.municipalPressureFaultStartTime = 0;
    _telemetry.municipalPressureFaultRemainingMs = 0;

    // Hexapod Default State
    _telemetry.hexapodMouth = false;
    _telemetry.hexapodEyes = true;
    _telemetry.hexapodSpeechSync = true;
    _hexapodLastBlinkTime = 0;
    _hexapodIsBlinking = false;
    _hexapodNextBlinkInterval = 3500;
    _hexapodMouthOffTime = 0;

    // I2S Mono Audio Amplifier Default State
    _telemetry.audioVolume = I2S_DEFAULT_VOLUME;
    _telemetry.audioMuted = false;
    _telemetry.audioPlaying = false;
    _telemetry.i2sAudioEnabled = I2S_ENABLED;
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

bool WaterSystemController::initADS1115() {
    Wire.beginTransmission(_adsAddress);
    uint8_t error = Wire.endTransmission();
    if (error == 0) {
        _adsDetected = true;
        _telemetry.ads1115Detected = true;
        Serial.printf("[ADS1115] Detected 16-Bit I2C ADC at address 0x%02X\n", _adsAddress);
        return true;
    } else {
        _adsDetected = false;
        _telemetry.ads1115Detected = false;
        Serial.printf("[ADS1115] Note: No ADS1115 ADC module detected at 0x%02X (error %d); simulated pressure/current active\n", _adsAddress, error);
        return false;
    }
}

int16_t WaterSystemController::ads1115ReadRaw(uint8_t channel) {
    if (!_adsDetected) return 0;

    // Config Register:
    // OS = 1 (start conversion)
    // MUX = (0x04 + (channel & 0x03)) << 12 (Single-ended AINx to GND)
    // PGA = 0x0200 (Gain 1: +/-4.096V, 1 LSB = 0.125mV)
    // MODE = 0x0100 (Single-shot)
    // DR = 0x0080 (128 SPS)
    // COMP_QUE = 0x0003 (Disable comparator)
    uint16_t config = 0x8383 | ((uint16_t)(0x04 + (channel & 0x03)) << 12);

    Wire.beginTransmission(_adsAddress);
    Wire.write(ADS1115_REG_POINTER_CONFIG);
    Wire.write((uint8_t)(config >> 8));
    Wire.write((uint8_t)(config & 0xFF));
    if (Wire.endTransmission() != 0) {
        return 0;
    }

    // Conversion delay for 128 SPS (~8ms)
    delay(9);

    Wire.beginTransmission(_adsAddress);
    Wire.write(ADS1115_REG_POINTER_CONVERT);
    if (Wire.endTransmission() != 0) {
        return 0;
    }

    Wire.requestFrom(_adsAddress, (uint8_t)2);
    if (Wire.available() >= 2) {
        int16_t val = (int16_t)((Wire.read() << 8) | Wire.read());
        return val;
    }
    return 0;
}

float WaterSystemController::rawToSensorVolts(int16_t raw) {
    if (raw < 0) raw = 0;
    // ADS1115 Gain 1: 1 LSB = 0.125mV (0.000125V)
    float vadc = (float)raw * 0.000125f;
    // Scale up through 2:1 resistive divider factor (R2 / (R1 + R2))
    float vsensor = vadc / PRESSURE_VOLTAGE_DIVIDER_RATIO;
    return vsensor;
}

float WaterSystemController::voltsToPsi(float sensorVolts, float maxPsi) {
    // 0.5V - 4.5V linear span
    if (sensorVolts < 0.20f) {
        // Disconnected wire / open circuit
        return 0.0f;
    }
    if (sensorVolts <= PRESSURE_SENSOR_VMIN) {
        return 0.0f;
    }
    if (sensorVolts >= PRESSURE_SENSOR_VMAX) {
        return maxPsi;
    }
    float psi = ((sensorVolts - PRESSURE_SENSOR_VMIN) / PRESSURE_SENSOR_VSPAN) * maxPsi;
    return (psi > 0.0f) ? psi : 0.0f;
}

float WaterSystemController::rawToCurrentSensorVolts(int16_t raw) {
    if (raw < 0) raw = 0;
    // ADS1115 Gain 1: 1 LSB = 0.125mV (0.000125V)
    float vadc = (float)raw * 0.000125f;
    // Scale up through 3:1 resistive divider factor (R2 / (R1 + R2) = 1/3)
    float vsensor = vadc / CURRENT_VOLTAGE_DIVIDER_RATIO;
    if (vsensor > PUMP_CURRENT_SENSOR_VMAX) vsensor = PUMP_CURRENT_SENSOR_VMAX;
    return vsensor;
}

float WaterSystemController::currentVoltsToAmps(float sensorVolts) {
    if (sensorVolts <= 0.05f) {
        return 0.0f;
    }
    float amps = sensorVolts * PUMP_CURRENT_AMPS_PER_VOLT; // 5.0 A/V
    if (amps > PUMP_CURRENT_MAX_AMPS) amps = PUMP_CURRENT_MAX_AMPS;
    return amps;
}

void WaterSystemController::setCurrentOverrideAmps(float amps) {
    _telemetry.currentOverrideAmps = amps;
}

void WaterSystemController::readCurrentSensor() {
    unsigned long now = millis();
    if (now - _lastCurrentReadTime < CURRENT_READ_INTERVAL_MS) {
        return;
    }
    _lastCurrentReadTime = now;

    // 1. Check if user set an explicit current override (for test bench / diagnostics)
    if (_telemetry.currentOverrideAmps >= 0.0f) {
        _telemetry.pumpCurrentAmps = _telemetry.currentOverrideAmps;
        _telemetry.pumpCurrentVolts = (_telemetry.pumpCurrentAmps / PUMP_CURRENT_MAX_AMPS) * PUMP_CURRENT_SENSOR_VMAX;
        return;
    }

    // 2. Read live physical sensor via ADS1115 Channel 2 (AIN2) if available
    if (_adsDetected) {
        int16_t rawCurr = ads1115ReadRaw(ADS_CHAN_PUMP_CURRENT);
        float vCurr = rawToCurrentSensorVolts(rawCurr);
        float amps = currentVoltsToAmps(vCurr);

        // Exponential Moving Average filter (70% prev + 30% new)
        _emaPumpCurrent = (_emaPumpCurrent * 0.70f) + (amps * 0.30f);
        _emaPumpCurrentVolts = (_emaPumpCurrentVolts * 0.70f) + (vCurr * 0.30f);

        _telemetry.pumpCurrentAmps = _emaPumpCurrent;
        _telemetry.pumpCurrentVolts = _emaPumpCurrentVolts;
    } else {
        // Realistic Current Simulation for Test Bench / Disconnected Sensor
        float simAmps = 0.0f;
        if (_telemetry.pump || _telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            unsigned long runTime = now - _telemetry.pumpRunStartTime;
            if (runTime < 1000) {
                // Startup inrush current spike (~22.5A for the first second)
                simAmps = 22.5f + (sinf(now / 100.0f) * 1.0f);
            } else {
                // Nominal running current with subtle natural motor vibration (~11.2A)
                simAmps = PUMP_NOMINAL_RUNNING_AMPS + (sinf(now / 600.0f) * 0.35f);
            }
        } else {
            // Pump OFF: Standby zero current
            simAmps = 0.0f;
        }

        _telemetry.pumpCurrentAmps = simAmps;
        _telemetry.pumpCurrentVolts = (simAmps / PUMP_CURRENT_MAX_AMPS) * PUMP_CURRENT_SENSOR_VMAX;
    }
}

void WaterSystemController::readPressureSensors() {
    unsigned long now = millis();
    if (now - _lastPressureReadTime < PRESSURE_READ_INTERVAL_MS) {
        return;
    }
    _lastPressureReadTime = now;

    if (_adsDetected) {
        // 1. Read Channel 0: Municipal Water Pressure (0 - 100 PSI)
        int16_t rawMuni = ads1115ReadRaw(ADS_CHAN_PRESSURE_MUNICIPAL);
        float vMuni = rawToSensorVolts(rawMuni);
        float psiMuni = voltsToPsi(vMuni, MUNICIPAL_PRESSURE_MAX_PSI);

        // 2. Read Channel 1: Fill Pipe Uphill Pressure (0 - 200 PSI)
        int16_t rawFill = ads1115ReadRaw(ADS_CHAN_PRESSURE_FILL_PIPE);
        float vFill = rawToSensorVolts(rawFill);
        float psiFill = voltsToPsi(vFill, FILL_PIPE_PRESSURE_MAX_PSI);

        _telemetry.pressureMunicipalVolts = vMuni;
        _telemetry.pressureFillPipeVolts = vFill;

        // Exponential Moving Average filter (70% prev + 30% new)
        _emaPressureMunicipal = (_emaPressureMunicipal * 0.70f) + (psiMuni * 0.30f);
        _emaPressureFillPipe = (_emaPressureFillPipe * 0.70f) + (psiFill * 0.30f);

        _telemetry.pressureMunicipalPsi = _emaPressureMunicipal;
        _telemetry.pressureFillPipePsi = _emaPressureFillPipe;
    } else {
        // Realistic Hydraulic Simulation for Test Bench / Disconnected Sensor
        // Municipal Main (Route 9W): ~55 to 65 PSI with subtle fluctuation
        float simMuni = 58.0f + (sinf(now / 1500.0f) * 1.5f);
        float simFill = 0.0f;

        if (_telemetry.pump || _telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
            // Booster Pump active: Dynamic uphill discharge head ~115 - 135 PSI
            simFill = 124.0f + (sinf(now / 800.0f) * 2.5f);
            simMuni -= 3.0f; // Slight suction pressure drop when pump pulls from line
        } else if (_telemetry.lineValve) {
            // Line Valve open (warm top-off): Natural municipal static pressure ~42 PSI
            simFill = 42.0f + (sinf(now / 1200.0f) * 1.0f);
        } else {
            // Line Valve closed & Drain open: Pipe drained to sump -> 0 PSI
            simFill = 0.0f;
        }

        _telemetry.pressureMunicipalPsi = simMuni;
        _telemetry.pressureFillPipePsi = simFill;
        _telemetry.pressureMunicipalVolts = PRESSURE_SENSOR_VMIN + ((simMuni / MUNICIPAL_PRESSURE_MAX_PSI) * PRESSURE_SENSOR_VSPAN);
        _telemetry.pressureFillPipeVolts = PRESSURE_SENSOR_VMIN + ((simFill / FILL_PIPE_PRESSURE_MAX_PSI) * PRESSURE_SENSOR_VSPAN);
    }

    // Safety Threshold Evaluation
    _telemetry.municipalLowPressureAlarm = (_telemetry.pressureMunicipalPsi < MUNICIPAL_LOW_PRESSURE_ALARM_PSI && _telemetry.pressureMunicipalPsi > 0.5f);
    _telemetry.fillPipeHighPressureAlarm = (_telemetry.pressureFillPipePsi > FILL_PIPE_HIGH_PRESSURE_ALARM_PSI);
}

void WaterSystemController::begin() {
    // 1. Initialize MCP23017 I/O Expander Module on I2C (GPIO 8 SDA, GPIO 9 SCL)
    initMCP23017();

    // 1B. Initialize ADS1115 16-Bit I2C ADC for Pressure Transducers
    initADS1115();

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

    // 5. Start DHT11 Sensor
    _dht.begin();

    // 6. Initialize I2S Mono Audio Amplifier Driver (MAX98357A / Class-D DAC Amp)
    i2sAudio.begin();

    // 7. Initial sensor read
    readSensors();
}

void WaterSystemController::readSensors() {
    unsigned long now = millis();

    // Debounced Reading for Float Switches & Freeze Sensor
    // Field Logic:
    // - Tank Low Switch:    LOW = Adequate (Auto OK), HIGH = Demand Water (Fill Demand)
    // - Tank High Switch:   LOW = Tank Full (Shutoff Stop), HIGH = Below Full (Filling Allowed)
    // - Freeze Sensor:      HIGH = <40°F (Freeze Hazard / Pipe Drain), LOW = >=40°F (Warm / Normal Top-Off)
    // - Tank Empty Switch:  LOW = Critical Empty (ALARM), HIGH = Adequate (Normal OK)
    
    bool rawEmpty;
    bool rawLow;
    bool rawHigh;
    bool rawFreeze;

    if (_mcpDetected) {
        // Read Port A directly from MCP23017
        uint8_t portA = mcpReadRegister(_mcpAddress, MCP23017_GPIOA);
        rawHigh = ((portA & (1 << MCP_PIN_FLOAT_TANK_HIGH)) != 0);
        rawLow = ((portA & (1 << MCP_PIN_FLOAT_TANK_LOW)) != 0);
        rawEmpty = ((portA & (1 << MCP_PIN_FLOAT_TANK_EMPTY)) == 0); // Active LOW = Empty Alarm
        rawFreeze = ((portA & (1 << MCP_PIN_FREEZE_SENSOR)) != 0);   // HIGH = <40F
    } else {
        // Fallback to direct GPIO pin reads
        rawEmpty = (digitalRead(PIN_FLOAT_TANK_EMPTY) == LOW);
        rawLow = (digitalRead(PIN_FLOAT_TANK_LOW) == HIGH);
        rawHigh = (digitalRead(PIN_FLOAT_TANK_HIGH) == HIGH);
        rawFreeze = (digitalRead(PIN_FREEZE_SENSOR) == HIGH);
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

        _lastDebounceTime = now;

        // Auto reset silence flag if tank was refilled and empties again
        if (!_telemetry.tankEmpty && _prevTankEmptyState) {
            _telemetry.alarmSilenced = false;
        }
        _prevTankEmptyState = _telemetry.tankEmpty;
    }

    // Read FCS521-SD-10V AC Current Transmitter via ADS1115 Channel 2 (AIN2)
    readCurrentSensor();

    bool isPumpCurrentlyRunning = (_telemetry.pump || _telemetry.pumpTimingState == PUMP_STATE_RUNNING || _telemetry.pumpOverride == MODE_FORCE_ON);

    // Overcurrent: true = Overload Fault (> 18.0A), false = Normal
    if (_telemetry.overcurrentOverride == MODE_FORCE_ON) {
        _telemetry.pumpOvercurrent = true;  // Simulated Overload Fault
    } else if (_telemetry.overcurrentOverride == MODE_FORCE_OFF) {
        _telemetry.pumpOvercurrent = false; // Simulated Normal
    } else {
        _telemetry.pumpOvercurrent = (_telemetry.pumpCurrentAmps > PUMP_OVERCURRENT_THRESHOLD_AMPS);
    }

    // Undercurrent: true = Dry Run Fault (< 4.5A when running), false = Normal
    if (_telemetry.undercurrentOverride == MODE_FORCE_ON) {
        _telemetry.pumpUndercurrent = true;  // Simulated Dry Run Fault
    } else if (_telemetry.undercurrentOverride == MODE_FORCE_OFF) {
        _telemetry.pumpUndercurrent = false; // Simulated Normal
    } else {
        _telemetry.pumpUndercurrent = (isPumpCurrentlyRunning && _telemetry.pumpCurrentAmps < PUMP_UNDERCURRENT_THRESHOLD_AMPS);
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

    // Read ADS1115 Stainless Steel Pressure Transducers (Municipal & Fill Pipe)
    readPressureSensors();
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

    // -------------------------------------------------------------
    // 1B. MUNICIPAL WATER LOW PRESSURE (< 5 PSI) 30-SECOND CUTOUT PROTECTION
    // -------------------------------------------------------------
    // Protect pump from running dry during city water outages / low suction pressure
    bool isLowMunicipalPressure = (_telemetry.pressureMunicipalPsi < MUNICIPAL_PRESSURE_CUTOUT_PSI);
    bool pumpActiveOrDemanded = isPumpRunning || (_telemetry.isFillCycleActive && _telemetry.tankLow);

    if (!_telemetry.municipalPressureTrip) {
        if (pumpActiveOrDemanded && isLowMunicipalPressure) {
            if (!_telemetry.municipalPressureFaultPending) {
                // Start 30-second low municipal pressure countdown
                _telemetry.municipalPressureFaultPending = true;
                _telemetry.municipalPressureFaultStartTime = now;
                _telemetry.municipalPressureFaultRemainingMs = MUNICIPAL_PRESSURE_FAULT_DELAY_MS;
                i2sAudio.playChime(CHIME_WARNING);
            } else {
                unsigned long elapsed = now - _telemetry.municipalPressureFaultStartTime;
                if (elapsed >= MUNICIPAL_PRESSURE_FAULT_DELAY_MS) {
                    // Full 30 seconds elapsed under 5 PSI -> Latch fault trip and shut down pump
                    _telemetry.municipalPressureTrip = true;
                    _telemetry.municipalPressureFaultPending = false;
                    _telemetry.municipalPressureFaultRemainingMs = 0;
                    _telemetry.alarmPulsing = false;

                    if (_telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
                        _telemetry.pumpLastRunDurationMs = now - _telemetry.pumpRunStartTime;
                        _telemetry.pumpRunElapsedMs = _telemetry.pumpLastRunDurationMs;
                        _telemetry.pumpTimingState = PUMP_STATE_IDLE;
                    }
                    i2sAudio.playSiren(SIREN_PUMP_FAULT);
                } else {
                    _telemetry.municipalPressureFaultRemainingMs = MUNICIPAL_PRESSURE_FAULT_DELAY_MS - elapsed;
                }
            }
        } else if (_telemetry.municipalPressureFaultPending && (!isLowMunicipalPressure || !pumpActiveOrDemanded)) {
            // Pressure restored >= 5 PSI or demand cleared before 30s -> Cancel countdown
            _telemetry.municipalPressureFaultPending = false;
            _telemetry.municipalPressureFaultStartTime = 0;
            _telemetry.municipalPressureFaultRemainingMs = 0;
        }
    }

    bool hasSafetyTrip = (_telemetry.pumpOvercurrentTrip || _telemetry.pumpUndercurrentTrip || _telemetry.municipalPressureTrip);

    // -------------------------------------------------------------
    // 2. TANK EMPTY, LOW PUMP ROOM TEMP (<55°F) & FAULT AUDIBLE ALARM / PULSING LOGIC
    // -------------------------------------------------------------
    if (_telemetry.pumpCurrentFaultPending || _telemetry.municipalPressureFaultPending) {
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
        bool alarmCondition = _telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip || _telemetry.pumpUndercurrentTrip || _telemetry.municipalPressureTrip || _telemetry.pumpRoomLowTempAlarm;
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

    // Trigger I2S Audio Sirens on state entries
    if (_telemetry.tankEmpty && !_prevTankEmptyState && !_telemetry.alarmSilenced) {
        i2sAudio.playSiren(SIREN_TANK_EMPTY);
    }
    _prevTankEmptyState = _telemetry.tankEmpty;

    if (_telemetry.pumpRoomLowTempAlarm && !_prevPumpRoomLowTempState && !_telemetry.alarmSilenced) {
        i2sAudio.playSiren(SIREN_LOW_TEMP);
    }
    _prevPumpRoomLowTempState = _telemetry.pumpRoomLowTempAlarm;

    // Pumphouse Interior Low Temp Alarm Dedicated Relay (GPIO 13)
    _telemetry.relayLowTempAlarm = _telemetry.pumpRoomLowTempAlarm;

    // -------------------------------------------------------------
    // 3. FILL CYCLE AUTOMATION (Tank High / Low Level Transitions)
    // -------------------------------------------------------------
    // Check if Tank High float switch is floating (rawHigh == false, Tank is FULL)
    if (!_telemetry.tankHigh) {
        // Tank has reached FULL level
        if (_telemetry.isFillCycleActive) {
            i2sAudio.playChime(CHIME_TANK_FULL);
        }
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
            if (!prevLineValve) {
                i2sAudio.playChime(CHIME_VALVE_OPEN);
            }
        }
    } else {
        _lineValveOpenedTime = 0;
    }

    // -------------------------------------------------------------
    // 5. BOOSTER PUMP TIMING, 5-SECOND START DELAY & MOTOR PROTECTION
    // -------------------------------------------------------------
    bool autoPumpRequest = false;
    bool lineValveReady = _telemetry.lineValve && (_lineValveOpenedTime > 0) && ((now - _lineValveOpenedTime) >= LINE_VALVE_TO_PUMP_DELAY_MS);

    if (hasSafetyTrip) {
        // Safety trip engaged (overcurrent, undercurrent, or <5 PSI municipal pressure cutout) -> shut off pump immediately
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
            i2sAudio.playChime(CHIME_PUMP_START);
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
    if (hasSafetyTrip) {
        // Safety trip active: Override cannot bypass motor / dry run protection
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

    // Update I2S Audio DMA, continuous sirens, note sequences, and voice synthesis
    i2sAudio.update();
    _telemetry.audioVolume = i2sAudio.getVolume();
    _telemetry.audioMuted = i2sAudio.isMuted();
    _telemetry.audioPlaying = i2sAudio.isPlaying();

    updateActuators();
}

void WaterSystemController::setAudioVolume(uint8_t percent) {
    i2sAudio.setVolume(percent);
    _telemetry.audioVolume = i2sAudio.getVolume();
}

void WaterSystemController::setAudioMute(bool muted) {
    i2sAudio.setMute(muted);
    _telemetry.audioMuted = i2sAudio.isMuted();
}

void WaterSystemController::toggleAudioMute() {
    i2sAudio.toggleMute();
    _telemetry.audioMuted = i2sAudio.isMuted();
}

void WaterSystemController::playAudioChime(int chimeId) {
    i2sAudio.playChime((AudioChime)chimeId);
}

void WaterSystemController::playAudioSiren(int sirenId, uint32_t durationMs) {
    i2sAudio.playSiren((AudioSiren)sirenId, durationMs);
}

void WaterSystemController::speakAudioPhrase(int phraseId) {
    i2sAudio.speakRoboticPhrase((AudioPhrase)phraseId);
}

void WaterSystemController::stopAudio() {
    i2sAudio.stopAudio();
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
    if (_telemetry.tankEmpty || _telemetry.pumpOvercurrentTrip || _telemetry.pumpUndercurrentTrip || _telemetry.municipalPressureTrip || _telemetry.pumpCurrentFaultPending || _telemetry.municipalPressureFaultPending || _telemetry.pumpRoomLowTempAlarm) {
        _telemetry.alarmSilenced = true;
        _telemetry.alarm = false;
        _telemetry.alarmPulsing = false;
        digitalWrite(PIN_RELAY_ALARM, LOW);
        i2sAudio.stopAudio();
        i2sAudio.playChime(CHIME_SILENCE);
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
    _telemetry.municipalPressureTrip = false;
    _telemetry.pumpCurrentFaultPending = false;
    _telemetry.pumpCurrentFaultStartTime = 0;
    _telemetry.pumpCurrentFaultRemainingMs = 0;
    _telemetry.municipalPressureFaultPending = false;
    _telemetry.municipalPressureFaultStartTime = 0;
    _telemetry.municipalPressureFaultRemainingMs = 0;
    _telemetry.isOvercurrentPending = false;
    _telemetry.isUndercurrentPending = false;
    _telemetry.alarmPulsing = false;
    _telemetry.alarmSilenced = false;
    _telemetry.currentOverrideAmps = -1.0f; // Reset current override to AUTO
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
    _telemetry.currentOverrideAmps = -1.0f;
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
    doc["municipalPressureTrip"] = _telemetry.municipalPressureTrip;
    doc["pumpCurrentFaultPending"] = _telemetry.pumpCurrentFaultPending;
    doc["pumpCurrentFaultRemainingSec"] = _telemetry.pumpCurrentFaultRemainingMs / 1000UL;
    doc["municipalPressureFaultPending"] = _telemetry.municipalPressureFaultPending;
    doc["municipalPressureFaultRemainingSec"] = _telemetry.municipalPressureFaultRemainingMs / 1000UL;
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

    // I2S Mono Audio Amplifier Telemetry
    doc["audioVolume"] = _telemetry.audioVolume;
    doc["audioMuted"] = _telemetry.audioMuted;
    doc["audioPlaying"] = _telemetry.audioPlaying;
    doc["i2sAudioEnabled"] = _telemetry.i2sAudioEnabled;

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

    // Pressure Transducers & ADS1115
    doc["pressureMunicipalPsi"] = _telemetry.pressureMunicipalPsi;
    doc["pressureFillPipePsi"] = _telemetry.pressureFillPipePsi;
    doc["pressureMunicipalVolts"] = _telemetry.pressureMunicipalVolts;
    doc["pressureFillPipeVolts"] = _telemetry.pressureFillPipeVolts;
    doc["ads1115Detected"] = _telemetry.ads1115Detected;
    doc["municipalLowPressureAlarm"] = _telemetry.municipalLowPressureAlarm;
    doc["fillPipeHighPressureAlarm"] = _telemetry.fillPipeHighPressureAlarm;

    // FCS521-SD-10V AC Current Transmitter Telemetry
    doc["pumpCurrentAmps"] = _telemetry.pumpCurrentAmps;
    doc["pumpCurrentVolts"] = _telemetry.pumpCurrentVolts;
    doc["currentOverrideAmps"] = _telemetry.currentOverrideAmps;
    doc["overcurrentThresholdAmps"] = PUMP_OVERCURRENT_THRESHOLD_AMPS;
    doc["undercurrentThresholdAmps"] = PUMP_UNDERCURRENT_THRESHOLD_AMPS;

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
                          doc.containsKey("setCurrentOverride") || doc.containsKey("setPumpCurrentAmps") ||
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
    if (doc.containsKey("setCurrentOverride")) {
        float amps = doc["setCurrentOverride"].as<float>();
        setCurrentOverrideAmps(amps);
    }
    if (doc.containsKey("setPumpCurrentAmps")) {
        float amps = doc["setPumpCurrentAmps"].as<float>();
        setCurrentOverrideAmps(amps);
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

    // I2S Mono Audio Amplifier Commands
    if (doc.containsKey("setAudioVolume")) {
        setAudioVolume(doc["setAudioVolume"].as<uint8_t>());
    }
    if (doc.containsKey("setAudioMute")) {
        setAudioMute(doc["setAudioMute"].as<bool>());
    }
    if (doc.containsKey("toggleAudioMute")) {
        toggleAudioMute();
    }
    if (doc.containsKey("playAudioChime")) {
        if (doc["playAudioChime"].is<int>()) {
            playAudioChime(doc["playAudioChime"].as<int>());
        } else {
            String chime = doc["playAudioChime"].as<String>();
            if (chime == "click") playAudioChime(CHIME_CLICK);
            else if (chime == "startup") playAudioChime(CHIME_STARTUP);
            else if (chime == "valve_open") playAudioChime(CHIME_VALVE_OPEN);
            else if (chime == "pump_start") playAudioChime(CHIME_PUMP_START);
            else if (chime == "tank_full") playAudioChime(CHIME_TANK_FULL);
            else if (chime == "warning") playAudioChime(CHIME_WARNING);
            else if (chime == "fault") playAudioChime(CHIME_FAULT);
            else if (chime == "silence") playAudioChime(CHIME_SILENCE);
        }
    }
    if (doc.containsKey("playAudioSiren")) {
        if (doc["playAudioSiren"].is<int>()) {
            playAudioSiren(doc["playAudioSiren"].as<int>(), doc["durationMs"] | 0);
        } else {
            String siren = doc["playAudioSiren"].as<String>();
            uint32_t dur = doc["durationMs"] | 0;
            if (siren == "tank_empty") playAudioSiren(SIREN_TANK_EMPTY, dur);
            else if (siren == "freeze") playAudioSiren(SIREN_FREEZE_ALERT, dur);
            else if (siren == "fault") playAudioSiren(SIREN_PUMP_FAULT, dur);
            else if (siren == "low_temp") playAudioSiren(SIREN_LOW_TEMP, dur);
        }
    }
    if (doc.containsKey("speakPhrase")) {
        if (doc["speakPhrase"].is<int>()) {
            speakAudioPhrase(doc["speakPhrase"].as<int>());
        } else {
            String phrase = doc["speakPhrase"].as<String>();
            if (phrase == "nominal") speakAudioPhrase(PHRASE_SYSTEM_NOMINAL);
            else if (phrase == "water_low") speakAudioPhrase(PHRASE_WATER_LOW);
            else if (phrase == "tank_full") speakAudioPhrase(PHRASE_TANK_FULL);
            else if (phrase == "freeze") speakAudioPhrase(PHRASE_FREEZE_WARNING);
            else if (phrase == "critical_alarm") speakAudioPhrase(PHRASE_CRITICAL_ALARM);
            else if (phrase == "silenced") speakAudioPhrase(PHRASE_ALARM_SILENCED);
            else if (phrase == "fault_cleared") speakAudioPhrase(PHRASE_FAULT_CLEARED);
            else if (phrase == "low_temp") speakAudioPhrase(PHRASE_LOW_TEMP_ALARM);
        }
    }
    if (doc.containsKey("stopAudio")) {
        stopAudio();
    }

    return true;
}


