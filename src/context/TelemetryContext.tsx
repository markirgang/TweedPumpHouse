import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  SensorData,
  ControlOverrides,
  SystemState,
  FaultType,
  SCADAEventLog
} from '../types/telemetry';

interface TelemetryContextType {
  sensors: SensorData;
  overrides: ControlOverrides;
  systemState: SystemState;
  activeFault: FaultType;
  simSpeed: number;
  isAuthenticated: boolean;
  eventLogs: SCADAEventLog[];
  
  // Actions
  setSimSpeed: (speed: number) => void;
  authenticate: (password: string) => boolean;
  deauthenticate: () => void;
  updateOverride: <K extends keyof ControlOverrides>(key: K, value: ControlOverrides[K]) => void;
  resetAllOverrides: () => void;
  resetFault: () => void;
  silenceAlarm: () => void;
  setTankLevel: (level: number) => void;
  setOutsideTemp: (tempF: number) => void;
  simulateFault: (fault: FaultType) => void;
  addEventLog: (type: SCADAEventLog['type'], message: string) => void;
  clearEventLogs: () => void;
  triggerScenario: (scenarioName: string) => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

const DEFAULT_PASSWORD = '5100';

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Authentication
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Simulation controls
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 5x, 10x, 60x

  // Core System Telemetry State
  const [tankLevelPercent, setTankLevelPercent] = useState<number>(85.0);
  const [outsideTempF, setOutsideTempF] = useState<number>(55.0); // > 45°F initially
  const [municipalPressurePSI, setMunicipalPressurePSI] = useState<number>(58.0);
  const [simulatedCurrentAmps, setSimulatedCurrentAmps] = useState<number | null>(null);

  // State Machine and Timers
  const [systemState, setSystemState] = useState<SystemState>('WARM_PREFILL_STANDBY');
  const [activeFault, setActiveFault] = useState<FaultType>(null);
  
  const [relayStateInternal, setRelayStateInternal] = useState<boolean>(true); // Line valve open in warm standby
  const [boosterPumpInternal, setBoosterPumpInternal] = useState<boolean>(false);

  // Timers & Alarms
  const [lineValveTimer, setLineValveTimer] = useState<number>(0);
  const [pumpStopTimer, setPumpStopTimer] = useState<number>(0);
  const [pumpRunTimeSeconds, setPumpRunTimeSeconds] = useState<number>(0);
  const [autoResetCountdownSeconds, setAutoResetCountdownSeconds] = useState<number>(0);
  const [alarmSilenced, setAlarmSilenced] = useState<boolean>(false);

  // Control Overrides
  const [overrides, setOverrides] = useState<ControlOverrides>({
    relayOverride: 'AUTO',
    pumpOverride: 'AUTO',
    freezeSensorOverride: 'AUTO',
    bottomFloatOverride: 'AUTO',
    lowFloatOverride: 'AUTO',
    highFloatOverride: 'AUTO',
    simulatedCurrentAmps: null
  });

  // Event Logs
  const [eventLogs, setEventLogs] = useState<SCADAEventLog[]>([
    {
      id: 'log-0',
      timestamp: new Date().toLocaleTimeString(),
      type: 'INFO',
      message: 'Tweedpump Water Telemetry Controller Initialized on Route 9W / Tweed Blvd system.',
      state: 'WARM_PREFILL_STANDBY'
    }
  ]);

  const addEventLog = (type: SCADAEventLog['type'], message: string) => {
    const newLog: SCADAEventLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      state: systemState
    };
    setEventLogs(prev => [newLog, ...prev.slice(0, 99)]); // keep max 100
  };

  const clearEventLogs = () => setEventLogs([]);

  // Compute calculated float switches based on tank level & overrides
  const rawBottomFloat = tankLevelPercent <= 2.0;
  const rawLowWaterFloat = tankLevelPercent < 50.0; // Floating UP (OPEN) when >= 50%
  const rawHighWaterFloat = tankLevelPercent < 95.0; // OFF when >= 95% full

  const bottomFloat = overrides.bottomFloatOverride === 'MANUAL_ON' 
    ? true 
    : overrides.bottomFloatOverride === 'MANUAL_OFF' 
      ? false 
      : rawBottomFloat;

  const lowWaterFloat = overrides.lowFloatOverride === 'MANUAL_ON' 
    ? true 
    : overrides.lowFloatOverride === 'MANUAL_OFF' 
      ? false 
      : rawLowWaterFloat;

  const highWaterFloat = overrides.highFloatOverride === 'MANUAL_ON' 
    ? true 
    : overrides.highFloatOverride === 'MANUAL_OFF' 
      ? false 
      : rawHighWaterFloat;

  // Compute freeze sensor state (closed if <= 45°F)
  const rawFreezeSensorClosed = outsideTempF <= 45.0;
  const freezeSensorClosed = overrides.freezeSensorOverride === 'FORCE_FREEZING'
    ? true
    : overrides.freezeSensorOverride === 'FORCE_WARM'
      ? false
      : rawFreezeSensorClosed;

  // Calculate final relay and pump states after overrides
  const effectiveRelayState = overrides.relayOverride === 'MANUAL_ON'
    ? true
    : overrides.relayOverride === 'MANUAL_OFF'
      ? false
      : relayStateInternal;

  const effectiveBoosterPump = overrides.pumpOverride === 'MANUAL_ON'
    ? true
    : overrides.pumpOverride === 'MANUAL_OFF'
      ? false
      : boosterPumpInternal;

  // Actuator physical states
  const lineValveOpen = effectiveRelayState;
  const drainValveClosed = effectiveRelayState;

  // Motor current calculation
  let motorCurrentAmps = 0.0;
  if (effectiveBoosterPump) {
    if (overrides.simulatedCurrentAmps !== null) {
      motorCurrentAmps = overrides.simulatedCurrentAmps;
    } else if (simulatedCurrentAmps !== null) {
      motorCurrentAmps = simulatedCurrentAmps;
    } else {
      // Normal pump current (~21.5A with slight jitter)
      motorCurrentAmps = 21.5 + (Math.sin(Date.now() / 1000) * 0.4);
    }
  }

  // Pressure calculations
  let fillPipePressurePSI = 0.0;
  if (effectiveBoosterPump) {
    fillPipePressurePSI = 115.0 + (Math.sin(Date.now() / 800) * 2.0); // Active pumping head
  } else if (lineValveOpen) {
    fillPipePressurePSI = municipalPressurePSI - 3.0; // Municipal static pressure
  } else {
    fillPipePressurePSI = 0.0; // Drained pipe
  }

  // Transducer Voltages
  // 0-200 PSI Pressure Transducers -> 0-5V DC (40 PSI / Volt)
  const municipalPressureVolts = Math.min(5.0, Math.max(0.0, municipalPressurePSI / 40.0));
  const fillPipePressureVolts = Math.min(5.0, Math.max(0.0, fillPipePressurePSI / 40.0));

  // FCS521 Current Transducer (0-50A AC -> 0-5V DC, 10 Amps / Volt)
  const motorCurrentVolts = Math.min(5.0, Math.max(0.0, motorCurrentAmps / 10.0));

  const lowMunicipalPressure = municipalPressurePSI < 35.0;
  const alarmRelayActive = activeFault !== null || lowMunicipalPressure;

  const sensorData: SensorData = {
    bottomFloat,
    lowWaterFloat,
    highWaterFloat,
    tankLevelPercent,
    outsideTempF,
    freezeSensorClosed,
    municipalPressurePSI,
    municipalPressureVolts,
    lowMunicipalPressure,
    fillPipePressurePSI,
    fillPipePressureVolts,
    motorCurrentAmps,
    motorCurrentVolts,
    pumpRunTimeSeconds,
    maxRunTimerSeconds: 1200, // 20 minutes
    autoResetCountdownSeconds,
    relayState: effectiveRelayState,
    lineValveOpen,
    drainValveClosed,
    boosterPumpActive: effectiveBoosterPump,
    alarmRelayActive,
    alarmSilenced
  };

  // Keep ref for tick logic
  const sensorRef = useRef(sensorData);
  const stateRef = useRef(systemState);
  const faultRef = useRef(activeFault);

  useEffect(() => {
    sensorRef.current = sensorData;
    stateRef.current = systemState;
    faultRef.current = activeFault;
  });

  // State Machine and Simulation Engine Tick
  useEffect(() => {
    const intervalMs = 200; // tick every 200ms
    const timer = setInterval(() => {
      const stepSeconds = (intervalMs / 1000) * simSpeed;
      const s = sensorRef.current;
      const curState = stateRef.current;
      const curFault = faultRef.current;

      // Low municipal water pressure alarm check (< 35.0 PSI)
      if (s.municipalPressurePSI < 35.0 && curFault === null) {
        setActiveFault('LOW_MUNICIPAL_PRESSURE');
        setSystemState('FAULT_TRIPPED');
        setBoosterPumpInternal(false);
        setRelayStateInternal(false);
        setAlarmSilenced(false);
        addEventLog('ALERT', `ALARM RELAY ENERGIZED: Low municipal water pressure detected (${s.municipalPressurePSI.toFixed(1)} PSI < 35.0 PSI). Pump & line valve isolated.`);
        return;
      }

      // Handle 2-Hour Auto-Reset Timer for Pump Overrun Cutoff (7200 seconds)
      if (curFault === 'MAX_RUN_TIME_EXCEEDED') {
        setAutoResetCountdownSeconds(prev => {
          const remaining = prev - stepSeconds;
          if (remaining <= 0) {
            setActiveFault(null);
            setPumpRunTimeSeconds(0);
            setSystemState('IDLE_FULL');
            setAlarmSilenced(false);
            addEventLog('INFO', '2-Hour Auto-Reset Timer completed. Booster pump overrun cutoff automatically cleared. System returned to AUTO.');
            return 0;
          }
          return remaining;
        });
      }

      // Skip auto transitions if fault active
      if (curFault !== null) {
        setBoosterPumpInternal(false);
        setRelayStateInternal(false);
        return;
      }

      // Check pump motor current protections when booster pump is active
      if (s.boosterPumpActive) {
        // Increment continuous run timer
        setPumpRunTimeSeconds(prev => {
          const nextVal = prev + stepSeconds;
          if (nextVal >= 1200) { // 20 minutes
            setActiveFault('MAX_RUN_TIME_EXCEEDED');
            setSystemState('FAULT_TRIPPED');
            setBoosterPumpInternal(false);
            setRelayStateInternal(false);
            setAlarmSilenced(false);
            setAutoResetCountdownSeconds(7200); // 2 hours = 7200 seconds countdown
            addEventLog('ALERT', 'CRITICAL FAULT: Booster pump ran continuously for over 20 minutes (1200s). Emergency pump shutdown triggered! 2-Hour Auto-Reset timer initialized.');
          }
          return nextVal;
        });

        // Undercurrent Protection check (< 15.0 Amps)
        if (s.motorCurrentAmps < 15.0) {
          setActiveFault('LOW_CURRENT_UNDERCURRENT');
          setSystemState('FAULT_TRIPPED');
          setBoosterPumpInternal(false);
          setRelayStateInternal(false);
          setAlarmSilenced(false);
          addEventLog('ALERT', `CRITICAL FAULT: Low motor current detected (${s.motorCurrentAmps.toFixed(1)}A < 15.0A). Dry run or air bound protection tripped!`);
          return;
        }

        // Overcurrent Protection check (> 30.0 Amps)
        if (s.motorCurrentAmps > 30.0) {
          setActiveFault('HIGH_CURRENT_OVERCURRENT');
          setSystemState('FAULT_TRIPPED');
          setBoosterPumpInternal(false);
          setRelayStateInternal(false);
          setAlarmSilenced(false);
          addEventLog('ALERT', `CRITICAL FAULT: High motor current detected (${s.motorCurrentAmps.toFixed(1)}A > 30.0A). Motor overload / deadhead protection tripped!`);
          return;
        }

        // Water level increases while pumping
        setTankLevelPercent(prev => {
          const newLevel = Math.min(100.0, prev + (0.8 * stepSeconds));
          return Math.round(newLevel * 10) / 10;
        });
      }

      // Water level slow natural depletion if idle or warm standby
      if (!s.boosterPumpActive && curState !== 'FAULT_TRIPPED') {
        setTankLevelPercent(prev => {
          const newLevel = Math.max(0.0, prev - (0.05 * stepSeconds));
          return Math.round(newLevel * 10) / 10;
        });
      }

      // AUTO State Machine Logic Transitions
      if (overrides.relayOverride === 'AUTO' && overrides.pumpOverride === 'AUTO') {
        switch (curState) {
          case 'IDLE_FULL':
          case 'FREEZE_DRAINED_STANDBY':
          case 'WARM_PREFILL_STANDBY': {
            // Priority 1: Tank drops to Low Water Float (<= 25%) -> Start full pumping cycle
            if (s.lowWaterFloat) {
              setSystemState('LOW_WATER_VALVE_OPENING');
              setRelayStateInternal(true); // Line valve OPEN, Drain valve CLOSED
              setLineValveTimer(5.0); // 5 sec start delay
              addEventLog('SEQUENCE', 'Low water level detected (Low Float CLOSED). Energized relay: Line valve OPEN, Drain valve CLOSED. 5s booster pump delay initialized.');
              break;
            }

            // Priority 2: High Water float is CLOSED (level drops below 95% full)
            if (s.highWaterFloat) {
              if (s.freezeSensorClosed) {
                // Freezing conditions (<= 45°F): Line valve held closed, pipe kept drained
                if (curState !== 'FREEZE_DRAINED_STANDBY') {
                  setSystemState('FREEZE_DRAINED_STANDBY');
                  setRelayStateInternal(false);
                  addEventLog('WARNING', 'Tank water level dropped below 95%. Freeze sensor CLOSED (<= 45°F). Holding line valve CLOSED and drain valve OPEN to prevent fill pipe freezing.');
                }
              } else {
                // Non-freezing conditions (> 45°F): Line valve reopens to allow pre-fill / static feed
                if (curState !== 'WARM_PREFILL_STANDBY') {
                  setSystemState('WARM_PREFILL_STANDBY');
                  setRelayStateInternal(true);
                  addEventLog('SEQUENCE', 'Tank water level dropped below 95%. Freeze sensor OPEN (> 45°F). Reopening line valve for static pre-fill.');
                }
              }
            } else {
              // High Water float is OPEN (>= 95% full)
              if (curState !== 'IDLE_FULL') {
                setSystemState('IDLE_FULL');
                setRelayStateInternal(false);
              }
            }
            break;
          }

          case 'LOW_WATER_VALVE_OPENING': {
            // Decrement 5s valve delay timer
            setLineValveTimer(prev => {
              const remaining = prev - stepSeconds;
              if (remaining <= 0) {
                setSystemState('PUMPING');
                setBoosterPumpInternal(true);
                setPumpRunTimeSeconds(0);
                addEventLog('SEQUENCE', '5-second valve delay completed. Booster pump STARTED. Water ascending 9W fill pipe to Tweed Blvd tank.');
                return 0;
              }
              return remaining;
            });
            break;
          }

          case 'PUMPING': {
            // High water reached (>= 95% full / High Float turns OFF)
            if (!s.highWaterFloat) {
              setBoosterPumpInternal(false);
              setSystemState('PUMP_STOPPING_DELAY');
              setPumpStopTimer(5.0);
              addEventLog('SEQUENCE', 'High water level reached (High Float OPENED). Booster pump STOPPED. 5-second line valve closing delay initialized.');
            }
            break;
          }

          case 'PUMP_STOPPING_DELAY': {
            // Decrement 5s pump stop delay timer
            setPumpStopTimer(prev => {
              const remaining = prev - stepSeconds;
              if (remaining <= 0) {
                setRelayStateInternal(false); // Close line valve, open drain valve
                setSystemState('IDLE_FULL');
                addEventLog('SEQUENCE', '5-second pump stop delay completed. Relay de-energized: Line valve CLOSED, Drain valve OPENED (Fill pipe drained).');
                return 0;
              }
              return remaining;
            });
            break;
          }
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [simSpeed, overrides]);

  // Actions
  const authenticate = (password: string) => {
    if (password === DEFAULT_PASSWORD) {
      setIsAuthenticated(true);
      addEventLog('USER_ACTION', 'User authenticated with default passcode 5100. Telemetry overrides unlocked.');
      return true;
    }
    return false;
  };

  const deauthenticate = () => {
    setIsAuthenticated(false);
    addEventLog('USER_ACTION', 'User logged out / controls locked.');
  };

  const updateOverride = <K extends keyof ControlOverrides>(key: K, value: ControlOverrides[K]) => {
    setOverrides(prev => ({ ...prev, [key]: value }));
    addEventLog('USER_ACTION', `Manual override changed: ${String(key)} = ${value}`);
  };

  const resetAllOverrides = () => {
    setOverrides({
      relayOverride: 'AUTO',
      pumpOverride: 'AUTO',
      freezeSensorOverride: 'AUTO',
      bottomFloatOverride: 'AUTO',
      lowFloatOverride: 'AUTO',
      highFloatOverride: 'AUTO',
      simulatedCurrentAmps: null
    });
    setSimulatedCurrentAmps(null);
    addEventLog('USER_ACTION', 'All manual telemetry overrides reset to AUTO.');
  };

  const resetFault = () => {
    setActiveFault(null);
    setPumpRunTimeSeconds(0);
    setAutoResetCountdownSeconds(0);
    setAlarmSilenced(false);
    setSimulatedCurrentAmps(null);
    setMunicipalPressurePSI(prev => (prev < 35.0 ? 58.0 : prev));
    setSystemState('IDLE_FULL');
    addEventLog('USER_ACTION', 'Authorized user manually reset pump cutoff and alarm relay. System restored to AUTO.');
  };

  const silenceAlarm = () => {
    setAlarmSilenced(true);
    addEventLog('USER_ACTION', 'Authorized user silenced alarm relay horn/buzzer output.');
  };

  const setTankLevel = (level: number) => {
    const bounded = Math.min(100, Math.max(0, level));
    setTankLevelPercent(bounded);
    addEventLog('USER_ACTION', `Tank water level manually set to ${bounded.toFixed(1)}%.`);
  };

  const setOutsideTemp = (tempF: number) => {
    setOutsideTempF(tempF);
    addEventLog('USER_ACTION', `Outside temperature set to ${tempF}°F.`);
  };

  const simulateFault = (fault: FaultType) => {
    if (fault === 'LOW_CURRENT_UNDERCURRENT') {
      setSimulatedCurrentAmps(10.5); // < 15.0A
    } else if (fault === 'HIGH_CURRENT_OVERCURRENT') {
      setSimulatedCurrentAmps(35.2); // > 30.0A
    } else if (fault === 'MAX_RUN_TIME_EXCEEDED') {
      setPumpRunTimeSeconds(1201);
    } else if (fault === 'LOW_MUNICIPAL_PRESSURE') {
      setMunicipalPressurePSI(22.0); // < 35.0 PSI
    }
  };

  const triggerScenario = (scenarioName: string) => {
    resetAllOverrides();
    resetFault();

    if (scenarioName === 'NORMAL_FILL_CYCLE') {
      setOutsideTempF(65.0);
      setTankLevelPercent(20.0); // Trigger low water switch
      addEventLog('USER_ACTION', 'Scenario Triggered: Normal Tank Fill Cycle (> 45°F Warm Ambient).');
    } else if (scenarioName === 'FREEZE_DROPDOWN_PREVENTION') {
      setOutsideTempF(34.0); // Freezing
      setTankLevelPercent(88.0); // Dropped below high float (95%)
      addEventLog('USER_ACTION', 'Scenario Triggered: Tank Level Drop under Freezing Conditions (34°F). Fill pipe held drained.');
    } else if (scenarioName === 'WARM_DROPDOWN_PREFILL') {
      setOutsideTempF(58.0); // Warm
      setTankLevelPercent(88.0); // Dropped below high float (95%)
      addEventLog('USER_ACTION', 'Scenario Triggered: Tank Level Drop under Non-Freezing Conditions (58°F). Line valve pre-filled.');
    } else if (scenarioName === 'PUMP_TIMEOUT_TEST') {
      setOutsideTempF(55.0);
      setTankLevelPercent(30.0);
      setSystemState('PUMPING');
      setBoosterPumpInternal(true);
      setRelayStateInternal(true);
      setPumpRunTimeSeconds(1195); // 5 seconds before 20-min timeout!
      addEventLog('USER_ACTION', 'Scenario Triggered: 20-Minute Pump Max Run Timer Test (Simulating 19m 55s run time).');
    } else if (scenarioName === 'UNDERCURRENT_DRYRUN_TEST') {
      setOutsideTempF(55.0);
      setTankLevelPercent(40.0);
      setSystemState('PUMPING');
      setBoosterPumpInternal(true);
      setRelayStateInternal(true);
      setSimulatedCurrentAmps(10.5); // Low current (<15.0A)
      addEventLog('USER_ACTION', 'Scenario Triggered: Pump Dry Run Undercurrent Test (< 15.0 Amps).');
    } else if (scenarioName === 'OVERCURRENT_STALL_TEST') {
      setOutsideTempF(55.0);
      setTankLevelPercent(40.0);
      setSystemState('PUMPING');
      setBoosterPumpInternal(true);
      setRelayStateInternal(true);
      setSimulatedCurrentAmps(35.2); // High current (>30.0A)
      addEventLog('USER_ACTION', 'Scenario Triggered: Pump Motor Stall Overcurrent Test (> 30.0 Amps).');
    } else if (scenarioName === 'LOW_MUNICIPAL_PRESSURE_TEST') {
      setMunicipalPressurePSI(22.0); // Low municipal pressure (< 35.0 PSI)
      addEventLog('USER_ACTION', 'Scenario Triggered: Low Municipal Pressure Alarm (< 35.0 PSI). Alarm Relay Energized.');
    }
  };

  return (
    <TelemetryContext.Provider
      value={{
        sensors: sensorData,
        overrides,
        systemState,
        activeFault,
        simSpeed,
        isAuthenticated,
        eventLogs,
        setSimSpeed,
        authenticate,
        deauthenticate,
        updateOverride,
        resetAllOverrides,
        resetFault,
        silenceAlarm,
        setTankLevel,
        setOutsideTemp,
        simulateFault,
        addEventLog,
        clearEventLogs,
        triggerScenario
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};
