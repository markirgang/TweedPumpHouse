/**
 * Tweed Boulevard / Route 9W Water System
 * Cloud Sync & Interactive Hardware Simulator Engine
 */

class CloudSyncManager {
  constructor(onTelemetryCallback, onConnectionChangeCallback) {
    this.onTelemetry = onTelemetryCallback;
    this.onConnectionChange = onConnectionChangeCallback;
    
    this.apiUrl = localStorage.getItem("tweed_api_url") || "/api/status";
    this.pollInterval = null;
    this.isConnected = false;
  }

  setApiUrl(url) {
    this.apiUrl = url;
    localStorage.setItem("tweed_api_url", url);
  }

  startPolling(intervalMs = 2500) {
    this.stopPolling();
    this.fetchStatus();
    this.pollInterval = setInterval(() => this.fetchStatus(), intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async fetchStatus() {
    try {
      const resp = await fetch(this.apiUrl, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      
      this.isConnected = true;
      if (this.onConnectionChange) this.onConnectionChange(true, "Netlify Cloud / LAN");
      if (this.onTelemetry) this.onTelemetry(data, "cloud");
    } catch (err) {
      // If live backend not reachable, notify
      this.isConnected = false;
    }
  }

  async sendCommand(commandObj) {
    try {
      const cmdUrl = this.apiUrl.replace("/status", "/command");
      const resp = await fetch(cmdUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(commandObj)
      });
      return resp.ok;
    } catch (err) {
      console.warn("[Cloud] Send command failed:", err);
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Hardware Simulator Engine (Local Test Bench)
// ---------------------------------------------------------------------------
class HardwareSimulator {
  constructor(onTelemetryCallback) {
    this.onTelemetry = onTelemetryCallback;
    this.isRunning = true;
    
    // Virtual Sensor State
    this.state = {
      tankEmpty: false,
      tankLow: false,
      tankHigh: true,
      freezeSensor: false,
      pumpOvercurrent: false,
      pumpUndercurrent: false,
      
      lineValve: false,
      pump: false,
      alarm: false,
      relayLowTempAlarm: false,
      alarmSilenced: false,
      pumpOvercurrentTrip: false,
      pumpUndercurrentTrip: false,
      
      // 1-Minute Current Fault Warning & Pulsing Alarm State
      pumpCurrentFaultPending: false,
      pumpCurrentFaultRemainingSec: 0,
      isOvercurrentPending: false,
      isUndercurrentPending: false,
      alarmPulsing: false,
      
      valveOverride: 0, // AUTO
      pumpOverride: 0,  // AUTO
      tankHighOverride: 0,
      tankLowOverride: 0,
      tankEmptyOverride: 0,
      overcurrentOverride: 0,
      undercurrentOverride: 0,
      freezeOverride: 0,
      
      pumpTimingState: 0, // 0: IDLE, 1: RUNNING, 2: COOLDOWN
      pumpTimedOut: false,
      pumpRunElapsedSec: 0,
      pumpLastRunDurationSec: 0,
      pumpRunMaxSec: 25 * 60,
      pumpCooldownRemainingSec: 0,
      pumpCooldownTotalSec: 2 * 60 * 60,
      
      temperatureF: 68.0,
      temperatureC: 20.0,
      humidity: 48.0,
      dhtValid: true,
      pumpRoomLowTempAlarm: false,
      
      fillCycleActive: false,

      // Pipeline Pressure Transducers (ADS1115 16-Bit I2C ADC)
      pressureMunicipalPsi: 58.0,
      pressureFillPipePsi: 0.0,
      pressureMunicipalVolts: 2.82,
      pressureFillPipeVolts: 0.50,
      ads1115Detected: true,
      municipalLowPressureAlarm: false,
      fillPipeHighPressureAlarm: false,
      simMuniPressureOverride: null,
      simFillPressureOverride: null,

      // FCS521-SD-10V AC Current Transmitter (0-50A via ADS1115 AIN2)
      pumpCurrentAmps: 0.0,
      pumpCurrentVolts: 0.0,
      currentOverrideAmps: -1.0, // -1 = AUTO mode
      overcurrentThresholdAmps: 18.0,
      undercurrentThresholdAmps: 4.5,
      simCurrentOverrideAmps: null,

      // Municipal Low Pressure (<5 PSI) 30-Second Cutout Safety Protection
      municipalPressureTrip: false,
      municipalPressureFaultPending: false,
      municipalPressureFaultRemainingSec: 0,

      // Hexapod Robotic Mascot States
      hexapodMouth: false,
      hexapodEyes: true,
      hexapodSpeechSync: true,

      // I2S Mono Audio Amplifier States
      audioVolume: 80,
      audioMuted: false,
      audioPlaying: false,
      i2sAudioEnabled: true
    };

    this.lineValveOpenSec = 0;

    this.timer = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (!this.isRunning) return;

    const isPumpRunning = (this.state.pump || this.state.pumpTimingState === 1 || this.state.pumpOverride === 1);

    // 0. Realistic AC Motor Current Simulation (FCS521-SD-10V 0-50A)
    let currentAmps = 0.0;
    if (this.state.simCurrentOverrideAmps !== null && this.state.simCurrentOverrideAmps !== undefined && this.state.simCurrentOverrideAmps >= 0) {
      currentAmps = this.state.simCurrentOverrideAmps;
    } else if (this.state.currentOverrideAmps >= 0) {
      currentAmps = this.state.currentOverrideAmps;
    } else if (isPumpRunning) {
      if (this.state.pumpRunElapsedSec <= 1) {
        // Inrush current spike (~22.5A for the first second)
        currentAmps = 22.5 + (Math.sin(Date.now() / 100) * 1.0);
      } else {
        // Nominal running current with subtle motor vibration (~11.2A)
        currentAmps = 11.2 + (Math.sin(Date.now() / 600) * 0.35);
      }
    } else {
      currentAmps = 0.0;
    }

    this.state.pumpCurrentAmps = Math.max(0, Math.min(50, currentAmps));
    this.state.pumpCurrentVolts = (this.state.pumpCurrentAmps / 50.0) * 10.0;

    // Apply software sensor overrides & evaluate FCS521 current protection
    let effectiveHigh = (this.state.tankHighOverride === 1) ? false : ((this.state.tankHighOverride === 2) ? true : this.state.tankHigh);
    let effectiveLow = (this.state.tankLowOverride === 1) ? true : ((this.state.tankLowOverride === 2) ? false : this.state.tankLow);
    let effectiveEmpty = (this.state.tankEmptyOverride === 1) ? true : ((this.state.tankEmptyOverride === 2) ? false : this.state.tankEmpty);
    let effectiveFreeze = (this.state.freezeOverride === 1) ? true : ((this.state.freezeOverride === 2) ? false : this.state.freezeSensor);
    
    let effectiveOvercurrent = false;
    if (this.state.overcurrentOverride === 1) effectiveOvercurrent = true;
    else if (this.state.overcurrentOverride === 2) effectiveOvercurrent = false;
    else effectiveOvercurrent = (this.state.pumpCurrentAmps > this.state.overcurrentThresholdAmps);

    let effectiveUndercurrent = false;
    if (this.state.undercurrentOverride === 1) effectiveUndercurrent = true;
    else if (this.state.undercurrentOverride === 2) effectiveUndercurrent = false;
    else effectiveUndercurrent = (isPumpRunning && this.state.pumpCurrentAmps < this.state.undercurrentThresholdAmps);

    this.state.pumpOvercurrent = effectiveOvercurrent;
    this.state.pumpUndercurrent = effectiveUndercurrent;

    // 0A. 5-Second Current Stabilization & 1-Minute Fault Warning / Pulsing Delay Logic
    // Allow 5 seconds for pump motor startup inrush current and suction prime to stabilize before evaluating faults
    const isCurrentStabilized = isPumpRunning && (this.state.pumpRunElapsedSec >= 5);
    const hasActiveSensorFault = (effectiveOvercurrent || effectiveUndercurrent);

    if (!this.state.pumpOvercurrentTrip && !this.state.pumpUndercurrentTrip) {
      if (isCurrentStabilized && hasActiveSensorFault) {
        if (!this.state.pumpCurrentFaultPending) {
          // Start 60-second pre-trip countdown
          this.state.pumpCurrentFaultPending = true;
          this.state.pumpCurrentFaultRemainingSec = 60;
          this.state.isOvercurrentPending = effectiveOvercurrent;
          this.state.isUndercurrentPending = effectiveUndercurrent;
        } else {
          if (effectiveOvercurrent) this.state.isOvercurrentPending = true;
          if (effectiveUndercurrent) this.state.isUndercurrentPending = true;

          if (this.state.pumpCurrentFaultRemainingSec > 0) {
            this.state.pumpCurrentFaultRemainingSec--;
          }

          if (this.state.pumpCurrentFaultRemainingSec <= 0) {
            // 60 seconds of persistent overload / undercurrent -> Latch fault & shut down pump
            if (this.state.isOvercurrentPending) this.state.pumpOvercurrentTrip = true;
            if (this.state.isUndercurrentPending) this.state.pumpUndercurrentTrip = true;
            this.state.pumpCurrentFaultPending = false;
            this.state.isOvercurrentPending = false;
            this.state.isUndercurrentPending = false;
            this.state.alarmPulsing = false;
          }
        }
      } else if (this.state.pumpCurrentFaultPending && (!hasActiveSensorFault || !isPumpRunning)) {
        // Transient fault cleared within 60s window or pump stopped
        this.state.pumpCurrentFaultPending = false;
        this.state.pumpCurrentFaultRemainingSec = 0;
        this.state.isOvercurrentPending = false;
        this.state.isUndercurrentPending = false;
        this.state.alarmPulsing = false;
      }
    }

    // 0B. Realistic Pipeline Pressure Simulation (ADS1115) & 30-Second Cutout
    let muniPsi = 58.0 + (Math.sin(Date.now() / 1500) * 1.5);
    let fillPsi = 0.0;

    if (this.state.simMuniPressureOverride !== null && this.state.simMuniPressureOverride !== undefined) {
      muniPsi = this.state.simMuniPressureOverride;
    }

    if (this.state.simFillPressureOverride !== null && this.state.simFillPressureOverride !== undefined) {
      fillPsi = this.state.simFillPressureOverride;
    } else {
      if (this.state.pump || this.state.pumpTimingState === 1) {
        fillPsi = 124.0 + (Math.sin(Date.now() / 800) * 2.5);
        if (this.state.simMuniPressureOverride === null) muniPsi -= 3.0; // Booster suction draw
      } else if (this.state.lineValve) {
        fillPsi = 42.0 + (Math.sin(Date.now() / 1200) * 1.0);
      } else {
        fillPsi = 0.0;
      }
    }

    this.state.pressureMunicipalPsi = muniPsi;
    this.state.pressureFillPipePsi = fillPsi;
    this.state.pressureMunicipalVolts = 0.5 + ((muniPsi / 100.0) * 4.0);
    this.state.pressureFillPipeVolts = 0.5 + ((fillPsi / 200.0) * 4.0);
    this.state.municipalLowPressureAlarm = (muniPsi < 20.0 && muniPsi > 0.5);
    this.state.fillPipeHighPressureAlarm = (fillPsi > 180.0);

    // Municipal Pressure < 5 PSI 30-Second Cutout Protection
    const isMuniUnder5 = (muniPsi < 5.0);
    const pumpActiveOrDemanded = isPumpRunning || (this.state.fillCycleActive && effectiveLow);

    if (!this.state.municipalPressureTrip) {
      if (pumpActiveOrDemanded && isMuniUnder5) {
        if (!this.state.municipalPressureFaultPending) {
          this.state.municipalPressureFaultPending = true;
          this.state.municipalPressureFaultRemainingSec = 30;
        } else {
          if (this.state.municipalPressureFaultRemainingSec > 0) {
            this.state.municipalPressureFaultRemainingSec--;
          }
          if (this.state.municipalPressureFaultRemainingSec <= 0) {
            this.state.municipalPressureTrip = true;
            this.state.municipalPressureFaultPending = false;
            this.state.alarmPulsing = false;
            if (this.state.pumpTimingState === 1) {
              this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
              this.state.pumpTimingState = 0;
              this.state.pumpRunElapsedSec = 0;
            }
          }
        }
      } else if (this.state.municipalPressureFaultPending && (!isMuniUnder5 || !pumpActiveOrDemanded)) {
        this.state.municipalPressureFaultPending = false;
        this.state.municipalPressureFaultRemainingSec = 0;
      }
    }

    const hasCurrentFault = (this.state.pumpOvercurrentTrip || this.state.pumpUndercurrentTrip);
    const hasSafetyTrip = (hasCurrentFault || this.state.municipalPressureTrip);

    // Pump Room Low Temp Alarm (<55°F) & Dedicated Relay Output
    this.state.pumpRoomLowTempAlarm = (this.state.temperatureF < 55.0);
    this.state.relayLowTempAlarm = this.state.pumpRoomLowTempAlarm;

    // 1. Alarm & Pulsing Relay Logic
    if (this.state.pumpCurrentFaultPending || this.state.municipalPressureFaultPending) {
      if (!this.state.alarmSilenced) {
        this.state.alarm = true;
        this.state.alarmPulsing = true;
      } else {
        this.state.alarm = false;
        this.state.alarmPulsing = false;
      }
    } else {
      this.state.alarmPulsing = false;
      const alarmActive = effectiveEmpty || this.state.pumpOvercurrentTrip || this.state.municipalPressureTrip || this.state.pumpRoomLowTempAlarm;
      if (alarmActive) {
        this.state.alarm = !this.state.alarmSilenced;
      } else {
        this.state.alarm = false;
        this.state.alarmSilenced = false;
      }
    }

    // 2. Tank Level Transition Logic
    if (!effectiveHigh) {
      // Tank High is floating (FULL)
      this.state.fillCycleActive = false;
      if (this.state.pumpTimingState === 1) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
        this.state.pumpTimingState = 0;
        this.state.pumpRunElapsedSec = 0;
      }
    } else if (effectiveLow) {
      // Water is low -> demand fill
      this.state.fillCycleActive = true;
    }

    // 3. Shared Relay (GPIO 2) Line Valve & Drain Valve Automation & Freeze Logic
    let autoValve = false;
    if (!effectiveHigh) {
      // Tank High is floating (FULL) -> Relay OFF, valve closed, drain valve open
      autoValve = false;
    } else if (this.state.fillCycleActive) {
      // Active fill cycle triggered by Tank Low down -> Relay ON, valve open, drain valve closed
      autoValve = true;
    } else {
      // Water is between High and Low:
      if (effectiveFreeze) {
        // Freeze Sensor ON (<40°F) -> Relay OFF, Line Valve closed, Drain Valve open
        autoValve = false;
      } else {
        // Freeze Sensor OFF (>=40°F Warm) -> Relay ON, Line Valve open, Drain Valve closed
        autoValve = true;
      }
    }

    // Line Valve Overrides
    if (this.state.valveOverride === 1) this.state.lineValve = true;
    else if (this.state.valveOverride === 2) this.state.lineValve = false;
    else this.state.lineValve = autoValve;

    // Shared Relay (GPIO 2) powers both Line Valve and Drain Valve:
    this.state.relayPower = this.state.lineValve;
    this.state.drainValve = !this.state.lineValve;

    // Track elapsed time since Line Valve opened (for 5s booster pump start delay)
    if (this.state.lineValve) {
      this.lineValveOpenSec = (this.lineValveOpenSec || 0) + 1;
    } else {
      this.lineValveOpenSec = 0;
    }

    const lineValveReady = this.state.lineValve && (this.lineValveOpenSec >= 5);

    // 4. Booster Pump Timers, 5-Second Start Delay & Protection
    let autoPump = false;

    if (hasSafetyTrip) {
      if (this.state.pumpTimingState === 1) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
        this.state.pumpTimingState = 0;
        this.state.pumpRunElapsedSec = 0;
      }
      autoPump = false;
    } else if (this.state.fillCycleActive && effectiveLow && lineValveReady) {
      if (this.state.pumpTimingState === 0) {
        this.state.pumpTimingState = 1;
        this.state.pumpRunElapsedSec = 0;
        autoPump = true;
      } else if (this.state.pumpTimingState === 1) {
        this.state.pumpRunElapsedSec++;
        if (this.state.pumpRunElapsedSec >= this.state.pumpRunMaxSec) {
          // Timeout reached (25 minutes)
          this.state.pumpTimingState = 2; // Cooldown
          this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
          this.state.pumpCooldownRemainingSec = this.state.pumpCooldownTotalSec;
          autoPump = false;
        } else {
          autoPump = true;
        }
      } else if (this.state.pumpTimingState === 2) {
        if (this.state.pumpCooldownRemainingSec > 0) {
          this.state.pumpCooldownRemainingSec--;
          autoPump = false;
        } else {
          this.state.pumpTimingState = 0;
          autoPump = true;
        }
      }
    } else {
      if (this.state.pumpTimingState === 1) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
        this.state.pumpTimingState = 0;
        this.state.pumpRunElapsedSec = 0;
      } else if (this.state.pumpTimingState === 2 && this.state.pumpCooldownRemainingSec > 0) {
        this.state.pumpCooldownRemainingSec--;
      }
      autoPump = false;
    }

    this.state.pumpTimedOut = (this.state.pumpTimingState === 2);

    // 5. Booster Pump Manual Overrides
    if (hasSafetyTrip) {
      this.state.pump = false;
    } else if (this.state.pumpOverride === 1) {
      this.state.pump = true;
      if (this.state.pumpTimingState !== 1) {
        this.state.pumpTimingState = 1;
      }
      this.state.pumpRunElapsedSec++;
    } else if (this.state.pumpOverride === 2) {
      if (this.state.pump) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
      }
      this.state.pump = false;
    } else {
      this.state.pump = autoPump;
    }

    if (this.onTelemetry) {
      this.onTelemetry(this.state, "simulator");
    }
  }

  processCommand(cmd) {
    // Validate password for protected override commands if supplied
    const hasOverride = (cmd.setValveOverride !== undefined || cmd.setPumpOverride !== undefined ||
                         cmd.setTankHighOverride !== undefined || cmd.setTankLowOverride !== undefined ||
                         cmd.setTankEmptyOverride !== undefined || cmd.setOvercurrentOverride !== undefined ||
                         cmd.setUndercurrentOverride !== undefined || cmd.setFreezeOverride !== undefined ||
                         cmd.resetAllOverrides);
    if (hasOverride) {
      const p = cmd.password || cmd.pin;
      if (p !== undefined && p !== "5100" && p !== "tweed123") {
        console.warn("[Simulator] Unauthorized override command rejected (invalid password/PIN).");
        return;
      }
    }

    if (cmd.silenceAlarm) {
      this.state.alarmSilenced = true;
      this.state.alarm = false;
      this.state.alarmPulsing = false;
    }
    if (cmd.resetPumpTimeout || cmd.resetPumpFault) {
      this.state.pumpTimingState = 0;
      this.state.pumpTimedOut = false;
      this.state.pumpRunElapsedSec = 0;
      this.state.pumpCooldownRemainingSec = 0;
      this.state.pumpOvercurrentTrip = false;
      this.state.pumpUndercurrentTrip = false;
      this.state.municipalPressureTrip = false;
      this.state.pumpCurrentFaultPending = false;
      this.state.pumpCurrentFaultRemainingSec = 0;
      this.state.municipalPressureFaultPending = false;
      this.state.municipalPressureFaultRemainingSec = 0;
      this.state.isOvercurrentPending = false;
      this.state.isUndercurrentPending = false;
      this.state.alarmPulsing = false;
      this.state.alarmSilenced = false;
      this.state.currentOverrideAmps = -1.0;
      this.state.simCurrentOverrideAmps = null;
    }
    if (cmd.setValveOverride !== undefined) {
      this.state.valveOverride = cmd.setValveOverride;
    }
    if (cmd.setPumpOverride !== undefined) {
      this.state.pumpOverride = cmd.setPumpOverride;
    }
    if (cmd.setTankHighOverride !== undefined) {
      this.state.tankHighOverride = cmd.setTankHighOverride;
    }
    if (cmd.setTankLowOverride !== undefined) {
      this.state.tankLowOverride = cmd.setTankLowOverride;
    }
    if (cmd.setTankEmptyOverride !== undefined) {
      this.state.tankEmptyOverride = cmd.setTankEmptyOverride;
    }
    if (cmd.setOvercurrentOverride !== undefined) {
      this.state.overcurrentOverride = cmd.setOvercurrentOverride;
    }
    if (cmd.setUndercurrentOverride !== undefined) {
      this.state.undercurrentOverride = cmd.setUndercurrentOverride;
    }
    if (cmd.setFreezeOverride !== undefined) {
      this.state.freezeOverride = cmd.setFreezeOverride;
    }
    if (cmd.setCurrentOverride !== undefined || cmd.setPumpCurrentAmps !== undefined) {
      const val = (cmd.setCurrentOverride !== undefined) ? cmd.setCurrentOverride : cmd.setPumpCurrentAmps;
      this.state.currentOverrideAmps = val;
      this.state.simCurrentOverrideAmps = (val >= 0) ? val : null;
    }
    if (cmd.resetAllOverrides) {
      this.state.valveOverride = 0;
      this.state.pumpOverride = 0;
      this.state.tankHighOverride = 0;
      this.state.tankLowOverride = 0;
      this.state.tankEmptyOverride = 0;
      this.state.overcurrentOverride = 0;
      this.state.undercurrentOverride = 0;
      this.state.freezeOverride = 0;
      this.state.currentOverrideAmps = -1.0;
      this.state.simCurrentOverrideAmps = null;
    }
    if (cmd.emergencyStop) {
      this.state.valveOverride = 2;
      this.state.pumpOverride = 2;
      this.state.lineValve = false;
      this.state.pump = false;
      this.state.fillCycleActive = false;
      this.lineValveOpenSec = 0;
    }
    if (cmd.setHexapodMouth !== undefined) {
      this.state.hexapodMouth = Boolean(cmd.setHexapodMouth);
    }
    if (cmd.setHexapodEyes !== undefined) {
      this.state.hexapodEyes = Boolean(cmd.setHexapodEyes);
    }
    if (cmd.setHexapodSpeechSync !== undefined) {
      this.state.hexapodSpeechSync = Boolean(cmd.setHexapodSpeechSync);
    }
    if (cmd.setAudioVolume !== undefined) {
      this.state.audioVolume = Math.max(0, Math.min(100, parseInt(cmd.setAudioVolume, 10)));
    }
    if (cmd.setAudioMute !== undefined) {
      this.state.audioMuted = Boolean(cmd.setAudioMute);
    }
    if (cmd.toggleAudioMute) {
      this.state.audioMuted = !this.state.audioMuted;
    }
    if (cmd.playAudioChime !== undefined) {
      this.state.audioPlaying = true;
      setTimeout(() => { if (this.isRunning) this.state.audioPlaying = false; }, 800);
    }
    if (cmd.playAudioSiren !== undefined) {
      this.state.audioPlaying = true;
    }
    if (cmd.speakPhrase !== undefined) {
      this.state.audioPlaying = true;
      this.state.hexapodMouth = true;
      setTimeout(() => {
        if (this.isRunning) {
          this.state.audioPlaying = false;
          this.state.hexapodMouth = false;
        }
      }, 1200);
    }
    if (cmd.stopAudio) {
      this.state.audioPlaying = false;
      this.state.hexapodMouth = false;
    }
  }
}
