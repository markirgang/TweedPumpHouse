export type SystemMode = 'AUTO' | 'MANUAL_ON' | 'MANUAL_OFF';

export type SystemState =
  | 'IDLE_FULL'                  // Tank full, pipe drained
  | 'LOW_WATER_VALVE_OPENING'    // Low float triggered, line valve opening delay (5s)
  | 'PUMPING'                    // Booster pump running, filling tank
  | 'PUMP_STOPPING_DELAY'        // High float reached, pump stopped, line valve closing delay (5s)
  | 'WARM_PREFILL_STANDBY'       // High float dropped, non-freezing (>45°F): Line valve open, drain closed
  | 'FREEZE_DRAINED_STANDBY'     // High float dropped, freezing (<=45°F): Line valve closed, pipe drained
  | 'FAULT_TRIPPED';             // Pump timeout, undercurrent, or overcurrent fault

export type FaultType = 
  | null
  | 'MAX_RUN_TIME_EXCEEDED' // >20 minutes continuous pump operation
  | 'LOW_CURRENT_UNDERCURRENT' // <15.0A dry run / air bound
  | 'HIGH_CURRENT_OVERCURRENT' // >30.0A stall / overload
  | 'LOW_MUNICIPAL_PRESSURE'; // <35.0 PSI city pressure

export interface SensorData {
  // Tank floats
  bottomFloat: boolean;      // True if tank empty (0%)
  lowWaterFloat: boolean;    // True if level < 50% (floating UP / OPEN when >= 50%)
  highWaterFloat: boolean;   // True if level < 95% (turns OFF when full >= 95%)

  // Calculated tank level
  tankLevelPercent: number;  // 0 - 100%

  // Freeze & Temp
  outsideTempF: number;      // e.g. 38°F or 65°F
  freezeSensorClosed: boolean; // True if freezing <= 45°F

  // Pressures (0-5V DC Transducer, 0-200 PSI range)
  municipalPressurePSI: number; // City main incoming pressure (~55 PSI)
  municipalPressureVolts: number; // 0 - 5.0V DC transducer signal
  lowMunicipalPressure: boolean; // True if < 35.0 PSI (0.875V DC)
  fillPipePressurePSI: number;  // Fill pipe line pressure (0 drained, ~50 static, ~115 pumping)
  fillPipePressureVolts: number; // 0 - 5.0V DC transducer signal

  // Motor / Pump Telemetry (FCS521 Current Sensor: 0-50A AC -> 0-5V DC)
  motorCurrentAmps: number;  // Normal ~21.5A, low <15.0A, high >30.0A
  motorCurrentVolts: number; // 0 - 5.0V DC FCS521 transducer signal (15A = 1.5V, 30A = 3.0V)
  pumpRunTimeSeconds: number; // Time current continuous pump run
  maxRunTimerSeconds: number; // 20 mins = 1200 seconds
  autoResetCountdownSeconds: number; // 2 hours = 7200 seconds countdown for overrun cutoff

  // Actuator & Alarm States
  relayState: boolean;       // Relay ON = Line Valve OPEN & Drain Valve CLOSED
  lineValveOpen: boolean;    // NC valve state
  drainValveClosed: boolean; // NO valve state
  boosterPumpActive: boolean; // Pump state
  alarmRelayActive: boolean; // True if undercurrent, overcurrent, overrun, or low pressure alarm active
  alarmSilenced: boolean;    // True if authorized user clicked Silence Alarm
}

export interface ControlOverrides {
  relayOverride: SystemMode;
  pumpOverride: SystemMode;
  freezeSensorOverride: 'AUTO' | 'FORCE_FREEZING' | 'FORCE_WARM';
  bottomFloatOverride: SystemMode;
  lowFloatOverride: SystemMode;
  highFloatOverride: SystemMode;
  simulatedCurrentAmps: number | null; // Null means auto-calculate
}

export interface SCADAEventLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SEQUENCE' | 'USER_ACTION';
  message: string;
  state: SystemState;
}
