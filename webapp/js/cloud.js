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
      alarmSilenced: false,
      pumpOvercurrentTrip: false,
      pumpUndercurrentTrip: false,
      
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
      
      fillCycleActive: false
    };

    this.timer = setInterval(() => this.tick(), 1000);
  }

  tick() {
    if (!this.isRunning) return;

    // Apply software sensor overrides
    let effectiveHigh = (this.state.tankHighOverride === 1) ? false : ((this.state.tankHighOverride === 2) ? true : this.state.tankHigh);
    let effectiveLow = (this.state.tankLowOverride === 1) ? true : ((this.state.tankLowOverride === 2) ? false : this.state.tankLow);
    let effectiveEmpty = (this.state.tankEmptyOverride === 1) ? true : ((this.state.tankEmptyOverride === 2) ? false : this.state.tankEmpty);
    let effectiveFreeze = (this.state.freezeOverride === 1) ? true : ((this.state.freezeOverride === 2) ? false : this.state.freezeSensor);
    let effectiveOvercurrent = (this.state.overcurrentOverride === 1) ? true : ((this.state.overcurrentOverride === 2) ? false : this.state.pumpOvercurrent);
    let effectiveUndercurrent = (this.state.undercurrentOverride === 1) ? true : ((this.state.undercurrentOverride === 2) ? false : this.state.pumpUndercurrent);

    // 0. Current Fault Tripping Logic
    const isPumpAttempting = (this.state.pump || this.state.pumpTimingState === 1 || this.state.pumpOverride === 1);
    if (isPumpAttempting) {
      if (effectiveOvercurrent) {
        this.state.pumpOvercurrentTrip = true;
      }
      if (effectiveUndercurrent) {
        this.state.pumpUndercurrentTrip = true;
      }
    }

    const hasCurrentFault = this.state.pumpOvercurrentTrip || this.state.pumpUndercurrentTrip;

    // 1. Alarm Logic
    if (effectiveEmpty || this.state.pumpOvercurrentTrip) {
      this.state.alarm = !this.state.alarmSilenced;
    } else {
      this.state.alarm = false;
      this.state.alarmSilenced = false;
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

    // 3. Pump Timers & Protection
    let autoPump = false;

    if (hasCurrentFault) {
      if (this.state.pumpTimingState === 1) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
        this.state.pumpTimingState = 0;
        this.state.pumpRunElapsedSec = 0;
      }
      autoPump = false;
    } else if (this.state.fillCycleActive && effectiveLow) {
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

    // 4. Shared Relay (GPIO 2) Line Valve & Drain Valve Automation & Freeze Logic
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

    // 5. Overrides
    if (this.state.valveOverride === 1) this.state.lineValve = true;
    else if (this.state.valveOverride === 2) this.state.lineValve = false;
    else this.state.lineValve = autoValve;

    // Shared Relay (GPIO 2) powers both Line Valve and Drain Valve:
    this.state.relayPower = this.state.lineValve;
    this.state.drainValve = !this.state.lineValve;

    if (hasCurrentFault) {
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
    if (cmd.silenceAlarm) {
      this.state.alarmSilenced = true;
      this.state.alarm = false;
    }
    if (cmd.resetPumpTimeout || cmd.resetPumpFault) {
      this.state.pumpTimingState = 0;
      this.state.pumpTimedOut = false;
      this.state.pumpRunElapsedSec = 0;
      this.state.pumpCooldownRemainingSec = 0;
      this.state.pumpOvercurrentTrip = false;
      this.state.pumpUndercurrentTrip = false;
      this.state.alarm = false;
      this.state.alarmSilenced = false;
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
    if (cmd.resetAllOverrides) {
      this.state.valveOverride = 0;
      this.state.pumpOverride = 0;
      this.state.tankHighOverride = 0;
      this.state.tankLowOverride = 0;
      this.state.tankEmptyOverride = 0;
      this.state.overcurrentOverride = 0;
      this.state.undercurrentOverride = 0;
      this.state.freezeOverride = 0;
    }
    if (cmd.emergencyStop) {
      this.state.valveOverride = 2;
      this.state.pumpOverride = 2;
      this.state.lineValve = false;
      this.state.pump = false;
      this.state.fillCycleActive = false;
    }
  }
}
