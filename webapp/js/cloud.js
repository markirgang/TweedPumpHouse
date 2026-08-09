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

    // 0. Current Fault Tripping Logic
    const isPumpAttempting = (this.state.pump || this.state.pumpTimingState === 1 || this.state.pumpOverride === 1);
    if (isPumpAttempting) {
      if (this.state.pumpOvercurrent) {
        this.state.pumpOvercurrentTrip = true;
      }
      if (this.state.pumpUndercurrent) {
        this.state.pumpUndercurrentTrip = true;
      }
    }

    const hasCurrentFault = this.state.pumpOvercurrentTrip || this.state.pumpUndercurrentTrip;

    // 1. Alarm Logic
    if (this.state.tankEmpty || this.state.pumpOvercurrentTrip) {
      this.state.alarm = !this.state.alarmSilenced;
    } else {
      this.state.alarm = false;
      this.state.alarmSilenced = false;
    }

    // 2. Tank Level Transition Logic
    if (!this.state.tankHigh) {
      // Tank High is floating (FULL)
      this.state.fillCycleActive = false;
      if (this.state.pumpTimingState === 1) {
        this.state.pumpLastRunDurationSec = this.state.pumpRunElapsedSec;
        this.state.pumpTimingState = 0;
        this.state.pumpRunElapsedSec = 0;
      }
    } else if (this.state.tankLow) {
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
    } else if (this.state.fillCycleActive && this.state.tankLow) {
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

    // 4. Line Valve Automation & Freeze Logic
    let autoValve = false;
    if (!this.state.tankHigh) {
      autoValve = false; // Tank full
    } else if (this.state.fillCycleActive) {
      autoValve = true;  // Filling in progress
    } else {
      // Tank High has dropped, but Low not reached
      if (this.state.freezeSensor) {
        autoValve = false; // Freeze protection: keep closed
      } else {
        autoValve = true;  // Warm: open line valve for municipal pressure fill
      }
    }

    // 5. Overrides
    if (this.state.valveOverride === 1) this.state.lineValve = true;
    else if (this.state.valveOverride === 2) this.state.lineValve = false;
    else this.state.lineValve = autoValve;

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
    if (cmd.emergencyStop) {
      this.state.valveOverride = 2;
      this.state.pumpOverride = 2;
      this.state.lineValve = false;
      this.state.pump = false;
      this.state.fillCycleActive = false;
    }
  }
}
