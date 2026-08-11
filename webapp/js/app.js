/**
 * Tweed Boulevard / Route 9W Water System
 * Main Web Application Controller & UI State Manager
 */

document.addEventListener('DOMContentLoaded', () => {
  // -------------------------------------------------------------------------
  // 1. Audio Alarm Synthesizer (Web Audio API)
  // -------------------------------------------------------------------------
  class AudioAlarm {
    constructor() {
      this.ctx = null;
      this.osc = null;
      this.gain = null;
      this.isPlaying = false;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    startAlarm() {
      if (this.muted || this.isPlaying) return;
      this.init();
      if (!this.ctx) return;

      this.isPlaying = true;
      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc.type = 'sawtooth';
      this.osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5

      // Pulsing frequency modulation for industrial siren sound
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 4; // 4 pulses per second
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220; // modulate between 660Hz and 1100Hz
      lfo.connect(this.osc.frequency);
      lfo.start();

      this.gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      this.osc.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.osc.start();
    }

    stopAlarm() {
      if (!this.isPlaying) return;
      try {
        if (this.osc) {
          this.osc.stop();
          this.osc.disconnect();
        }
      } catch (e) {}
      this.isPlaying = false;
    }
  }

  const alarmAudio = new AudioAlarm();

  // -------------------------------------------------------------------------
  // 2. Initialize Subsystems
  // -------------------------------------------------------------------------
  const schematic = new SystemSchematic('schematicCanvas');

  let activeMode = 'simulator'; // 'simulator', 'bluetooth', 'cloud'
  let latestTelemetry = {};

  const onTelemetryReceived = (data, source) => {
    latestTelemetry = data;
    updateUI(data, source);
    if (schematic) schematic.updateState(data);

    // Audio alarm management
    if (data.alarm && !data.alarmSilenced) {
      alarmAudio.startAlarm();
    } else {
      alarmAudio.stopAlarm();
    }
  };

  const onConnectionChanged = (connected, label) => {
    const dot = document.getElementById('connectionDot');
    const text = document.getElementById('connectionText');
    if (connected) {
      dot.className = 'status-dot ' + (activeMode === 'simulator' ? 'sim' : 'online');
      text.innerText = label;
    } else {
      dot.className = 'status-dot';
      text.innerText = 'Offline';
    }
  };

  const ble = new BleManager(onTelemetryReceived, onConnectionChanged);
  const cloud = new CloudSyncManager(onTelemetryReceived, onConnectionChanged);
  const simulator = new HardwareSimulator(onTelemetryReceived);

  // -------------------------------------------------------------------------
  // 3. UI Update Renderer
  // -------------------------------------------------------------------------
  function updateUI(t, source) {
    // 1. Critical Alarm Banners
    const alarmBanner = document.getElementById('alarmBanner');
    if (t.alarm && !t.alarmSilenced && t.tankEmpty) {
      alarmBanner.classList.add('active');
    } else {
      alarmBanner.classList.remove('active');
    }

    // Overcurrent banner
    const overcurrentBanner = document.getElementById('overcurrentBanner');
    if (t.pumpOvercurrentTrip || (t.pumpOvercurrent && (t.pump || t.pumpTimingState === 1))) {
      overcurrentBanner.classList.add('active');
    } else {
      overcurrentBanner.classList.remove('active');
    }

    // Undercurrent banner
    const undercurrentBanner = document.getElementById('undercurrentBanner');
    if (t.pumpUndercurrentTrip || (t.pumpUndercurrent && (t.pump || t.pumpTimingState === 1))) {
      undercurrentBanner.classList.add('active');
    } else {
      undercurrentBanner.classList.remove('active');
    }

    // 2. Freeze Warning Banner
    const freezeBanner = document.getElementById('freezeBanner');
    if (t.freezeSensor) {
      freezeBanner.classList.add('active');
    } else {
      freezeBanner.classList.remove('active');
    }

    // 3. Float Switches Cards
    // Tank High
    const highInd = document.getElementById('floatHighInd');
    const highState = document.getElementById('floatHighState');
    if (!t.tankHigh) {
      highInd.className = 'float-indicator active-green';
      highState.innerText = 'FLOATING (FULL)';
      highState.className = 'float-state-pill val-green';
    } else {
      highInd.className = 'float-indicator';
      highState.innerText = 'DOWN (NORMAL)';
      highState.className = 'float-state-pill val-grey';
    }

    // Tank Low
    const lowInd = document.getElementById('floatLowInd');
    const lowState = document.getElementById('floatLowState');
    if (t.tankLow) {
      lowInd.className = 'float-indicator active-yellow';
      lowState.innerText = 'DOWN (DEMAND WATER)';
      lowState.className = 'float-state-pill val-amber';
    } else {
      lowInd.className = 'float-indicator active-green';
      lowState.innerText = 'FLOATING (ADEQUATE)';
      lowState.className = 'float-state-pill val-green';
    }

    // Tank Empty
    const emptyInd = document.getElementById('floatEmptyInd');
    const emptyState = document.getElementById('floatEmptyState');
    if (t.tankEmpty) {
      emptyInd.className = 'float-indicator active-red';
      emptyState.innerText = 'DOWN (CRITICAL EMPTY)';
      emptyState.className = 'float-state-pill val-red';
    } else {
      emptyInd.className = 'float-indicator active-green';
      emptyState.innerText = 'FLOATING (OK)';
      emptyState.className = 'float-state-pill val-green';
    }

    // 4. Actuators & Shared Relay (GPIO 2)
    const relayVal = document.getElementById('valSharedRelay');
    if (relayVal) {
      if (t.lineValve) {
        relayVal.innerText = 'ON (ENERGIZED)';
        relayVal.className = 'metric-val val-green';
      } else {
        relayVal.innerText = 'OFF (UNPOWERED)';
        relayVal.className = 'metric-val val-grey';
      }
    }

    const valveVal = document.getElementById('valLineValve');
    if (valveVal) {
      if (t.lineValve) {
        valveVal.innerText = 'OPEN (ENERGIZED)';
        valveVal.className = 'metric-val val-green';
      } else {
        valveVal.innerText = 'CLOSED (OFF)';
        valveVal.className = 'metric-val val-grey';
      }
    }

    const drainVal = document.getElementById('valDrainValve');
    if (drainVal) {
      if (t.lineValve) {
        drainVal.innerText = 'CLOSED (SEALED)';
        drainVal.className = 'metric-val val-green';
      } else {
        drainVal.innerText = 'OPEN (DRAINING)';
        drainVal.className = 'metric-val val-amber';
      }
    }

    const pipeVal = document.getElementById('valPipeState');
    if (pipeVal) {
      if (t.lineValve) {
        pipeVal.innerText = 'FLOWING UPHILL';
        pipeVal.className = 'metric-val val-cyan';
      } else if (schematic && schematic.pipeWaterLevel > 0.01) {
        pipeVal.innerText = 'DRAINING TO SUMP';
        pipeVal.className = 'metric-val val-amber';
      } else if (t.freezeSensor) {
        pipeVal.innerText = 'DRAINED (FREEZE SAFE)';
        pipeVal.className = 'metric-val val-grey';
      } else {
        pipeVal.innerText = 'DRAINED / EMPTY';
        pipeVal.className = 'metric-val val-grey';
      }
    }

    const pumpVal = document.getElementById('valPump');
    if (t.pumpOvercurrentTrip) {
      pumpVal.innerText = 'OVERLOAD TRIP!';
      pumpVal.className = 'metric-val val-red';
    } else if (t.pumpUndercurrentTrip) {
      pumpVal.innerText = 'DRY RUN TRIP!';
      pumpVal.className = 'metric-val val-amber';
    } else if (t.pumpTimingState === 1 || t.pump) {
      pumpVal.innerText = 'RUNNING (ASSIST)';
      pumpVal.className = 'metric-val val-cyan';
    } else if (t.pumpTimingState === 2) {
      pumpVal.innerText = 'COOLDOWN';
      pumpVal.className = 'metric-val val-amber';
    } else {
      pumpVal.innerText = 'OFF / STANDBY';
      pumpVal.className = 'metric-val val-grey';
    }

    // 5. Pump Run Time & Timed-Out Duration
    const timerLabel = document.getElementById('pumpTimerLabel');
    const timerDigits = document.getElementById('pumpTimerDigits');
    const statusDesc = document.getElementById('pumpStatusDesc');
    const durationBadge = document.getElementById('pumpDurationBadge');
    const progressBar = document.getElementById('pumpProgressBar');

    if (t.pumpOvercurrentTrip || t.pumpUndercurrentTrip) {
      timerLabel.innerText = 'Fault Interlock:';
      timerDigits.innerText = t.pumpOvercurrentTrip ? 'OVERLOAD TRIP' : 'DRY RUN TRIP';
      statusDesc.innerText = 'Safety trip stopped pump. Press Reset Fault.';
      durationBadge.className = 'badge-pill fault';
      durationBadge.innerText = 'TRIPPED';
      progressBar.className = 'progress-bar-fill fault';
      progressBar.style.width = '100%';
    } else if (t.pumpTimingState === 1 || t.pump) {
      const elapsed = t.pumpRunElapsedSec || 0;
      const maxSec = t.pumpRunMaxSec || 1500;
      const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const ss = (elapsed % 60).toString().padStart(2, '0');
      timerLabel.innerText = 'Active On-Time:';
      timerDigits.innerText = `${mm}:${ss} / 25:00`;
      statusDesc.innerText = `Pump running for ${mm}m ${ss}s (25m Max)`;
      durationBadge.className = 'badge-pill';
      durationBadge.innerText = `${mm}:${ss} ON`;
      progressBar.className = 'progress-bar-fill';
      progressBar.style.width = Math.min(100, (elapsed / maxSec) * 100) + '%';
    } else if (t.pumpTimingState === 2 || t.pumpTimedOut) {
      const rem = t.pumpCooldownRemainingSec || 0;
      const totalSec = t.pumpCooldownTotalSec || 7200;
      const ranSec = t.pumpLastRunDurationSec || (25 * 60);
      const ranMm = Math.floor(ranSec / 60).toString().padStart(2, '0');
      const ranSs = (ranSec % 60).toString().padStart(2, '0');
      const hh = Math.floor(rem / 3600);
      const mm = Math.floor((rem % 3600) / 60).toString().padStart(2, '0');
      const ss = (rem % 60).toString().padStart(2, '0');
      
      timerLabel.innerText = 'Timed Out (Cooldown):';
      timerDigits.innerText = `${hh}h ${mm}m ${ss}s rem`;
      statusDesc.innerText = `Pump timed out after running for ${ranMm}m ${ranSs}. In cooldown.`;
      durationBadge.className = 'badge-pill cooldown';
      durationBadge.innerText = `RAN ${ranMm}m`;
      progressBar.className = 'progress-bar-fill cooldown';
      progressBar.style.width = Math.min(100, (rem / totalSec) * 100) + '%';
    } else {
      timerLabel.innerText = 'Pump Run Time:';
      timerDigits.innerText = 'STANDBY';
      if (t.pumpLastRunDurationSec && t.pumpLastRunDurationSec > 0) {
        const lastMm = Math.floor(t.pumpLastRunDurationSec / 60).toString().padStart(2, '0');
        const lastSs = (t.pumpLastRunDurationSec % 60).toString().padStart(2, '0');
        statusDesc.innerText = `Standby. Last pump on-time: ${lastMm}m ${lastSs}`;
      } else {
        statusDesc.innerText = 'Holding tank standby. Auto control armed.';
      }
      durationBadge.className = 'badge-pill';
      durationBadge.innerText = 'READY';
      progressBar.className = 'progress-bar-fill';
      progressBar.style.width = '0%';
    }

    // 6. Current Sensors Card
    const overInd = document.getElementById('currentOverInd');
    const overState = document.getElementById('currentOverState');
    if (t.pumpOvercurrentTrip || t.pumpOvercurrent) {
      overInd.className = 'float-indicator active-red';
      overState.innerText = t.pumpOvercurrentTrip ? 'FAULT (TRIPPED)' : 'ACTIVE (> LIMIT)';
      overState.className = 'float-state-pill val-red';
    } else {
      overInd.className = 'float-indicator active-green';
      overState.innerText = 'NORMAL (< LIMIT)';
      overState.className = 'float-state-pill val-green';
    }

    const underInd = document.getElementById('currentUnderInd');
    const underState = document.getElementById('currentUnderState');
    if (t.pumpUndercurrentTrip || t.pumpUndercurrent) {
      underInd.className = 'float-indicator active-yellow';
      underState.innerText = t.pumpUndercurrentTrip ? 'DRY RUN (TRIPPED)' : 'DRY RUN DETECTED';
      underState.className = 'float-state-pill val-amber';
    } else {
      underInd.className = 'float-indicator active-green';
      underState.innerText = 'NORMAL (PRIME OK)';
      underState.className = 'float-state-pill val-green';
    }

    const currentBox = document.getElementById('currentSummaryBox');
    const currentText = document.getElementById('currentSummaryText');
    if (t.pumpOvercurrentTrip) {
      currentBox.className = 'current-summary-box fault';
      currentText.innerText = 'Overcurrent trip active! Motor current exceeded safety limit.';
    } else if (t.pumpUndercurrentTrip) {
      currentBox.className = 'current-summary-box fault';
      currentText.innerText = 'Dry run / undercurrent trip active! Suction line loss of prime.';
    } else {
      currentBox.className = 'current-summary-box';
      currentText.innerText = 'Motor current within safe operating bounds.';
    }

    // 7. Climate
    document.getElementById('valTempF').innerText = (t.temperatureF || 68.0).toFixed(1) + '°F';
    document.getElementById('valHumidity').innerText = Math.round(t.humidity || 50) + '%';

    // 8. Override Buttons Active State
    updateOverrideButtons('valveOverrideGroup', t.valveOverride || 0);
    updateOverrideButtons('pumpOverrideGroup', t.pumpOverride || 0);
    updateOverrideButtons('tankHighOverrideGroup', t.tankHighOverride || 0);
    updateOverrideButtons('tankLowOverrideGroup', t.tankLowOverride || 0);
    updateOverrideButtons('tankEmptyOverrideGroup', t.tankEmptyOverride || 0);
    updateOverrideButtons('overcurrentOverrideGroup', t.overcurrentOverride || 0);
    updateOverrideButtons('undercurrentOverrideGroup', t.undercurrentOverride || 0);
    updateOverrideButtons('freezeOverrideGroup', t.freezeOverride || 0);

    // 9. Check if any override is currently active
    const activeOverrides = [];
    if (t.pumpOverride && t.pumpOverride !== 0) activeOverrides.push(t.pumpOverride === 1 ? 'Pump FORCE ON' : 'Pump FORCE OFF');
    if (t.valveOverride && t.valveOverride !== 0) activeOverrides.push(t.valveOverride === 1 ? 'Valve FORCE OPEN' : 'Valve FORCE CLOSE');
    if (t.tankHighOverride && t.tankHighOverride !== 0) activeOverrides.push(t.tankHighOverride === 1 ? 'Tank High SIM FULL' : 'Tank High SIM NORM');
    if (t.tankLowOverride && t.tankLowOverride !== 0) activeOverrides.push(t.tankLowOverride === 1 ? 'Tank Low SIM LOW' : 'Tank Low SIM OK');
    if (t.tankEmptyOverride && t.tankEmptyOverride !== 0) activeOverrides.push(t.tankEmptyOverride === 1 ? 'Tank Empty SIM ALARM' : 'Tank Empty SIM OK');
    if (t.overcurrentOverride && t.overcurrentOverride !== 0) activeOverrides.push(t.overcurrentOverride === 1 ? 'Overcurrent SIM TRIP' : 'Overcurrent SIM NORM');
    if (t.undercurrentOverride && t.undercurrentOverride !== 0) activeOverrides.push(t.undercurrentOverride === 1 ? 'Undercurrent SIM DRY' : 'Undercurrent SIM NORM');
    if (t.freezeOverride && t.freezeOverride !== 0) activeOverrides.push(t.freezeOverride === 1 ? 'Freeze SIM <40F' : 'Freeze SIM >=40F');

    const isAnyOverrideActive = activeOverrides.length > 0;
    const badgeOverride = document.getElementById('badgeOverrideActive');
    if (badgeOverride) {
      badgeOverride.style.display = isAnyOverrideActive ? 'inline-block' : 'none';
      if (isAnyOverrideActive) {
        badgeOverride.innerText = `${activeOverrides.length} OVERRIDE${activeOverrides.length > 1 ? 'S' : ''}`;
      }
    }

    const alertCard = document.getElementById('settingsAlertCard');
    const alertTitle = document.getElementById('alertTitleText');
    const alertDesc = document.getElementById('alertDescText');
    if (alertCard && alertTitle && alertDesc) {
      if (isAnyOverrideActive) {
        alertCard.className = 'settings-alert-card warning';
        alertTitle.innerText = `WARNING: ${activeOverrides.length} Manual Override${activeOverrides.length > 1 ? 's' : ''} Active`;
        alertDesc.innerText = `Active manual bypasses: ${activeOverrides.join(' • ')}. Normal autonomous logic is altered.`;
      } else {
        alertCard.className = 'settings-alert-card';
        alertTitle.innerText = 'System Mode: All Subsystems in AUTO';
        alertDesc.innerText = 'Autonomous float logic and current safety monitoring active. No manual overrides engaged.';
      }
    }
  }

  function updateOverrideButtons(groupId, activeVal) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const btns = group.querySelectorAll('.btn-toggle');
    btns.forEach(b => {
      const mode = parseInt(b.getAttribute('data-mode'), 10);
      if (mode === activeVal) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 4. Command Dispatcher
  // -------------------------------------------------------------------------
  function sendCommand(cmdObj) {
    alarmAudio.init();
    if (activeMode === 'bluetooth') {
      ble.sendCommand(cmdObj);
    } else if (activeMode === 'cloud') {
      cloud.sendCommand(cmdObj);
    } else {
      simulator.processCommand(cmdObj);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Button Event Listeners & Tab Navigation
  // -------------------------------------------------------------------------
  // Tab Switching
  document.querySelectorAll('.nav-tab').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      const targetId = tabBtn.getAttribute('data-tab');
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tabBtn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  const btnGoToSettings = document.getElementById('btnGoToSettings');
  if (btnGoToSettings) {
    btnGoToSettings.addEventListener('click', () => {
      const tabSettings = document.getElementById('tabBtnSettings');
      if (tabSettings) tabSettings.click();
    });
  }

  // Silence Alarm Buttons
  document.querySelectorAll('.btn-silence-alarm').forEach(b => {
    b.addEventListener('click', () => {
      alarmAudio.stopAlarm();
      sendCommand({ silenceAlarm: true });
    });
  });

  // Reset Pump Timeout / Fault Buttons
  const resetFaultAction = () => {
    alarmAudio.stopAlarm();
    sendCommand({ resetPumpTimeout: true, resetPumpFault: true });
  };

  document.getElementById('btnResetTimeout').addEventListener('click', resetFaultAction);
  const btnResetOc = document.getElementById('btnResetOvercurrent');
  if (btnResetOc) btnResetOc.addEventListener('click', resetFaultAction);
  const btnResetUc = document.getElementById('btnResetUndercurrent');
  if (btnResetUc) btnResetUc.addEventListener('click', resetFaultAction);

  // Emergency Stop Button
  const eStopAction = () => {
    if (confirm('Engage Emergency Stop? This will shut off all relays immediately.')) {
      sendCommand({ emergencyStop: true });
    }
  };
  document.getElementById('btnEStop').addEventListener('click', eStopAction);

  // Generic Override Toggle Group Binder
  const bindOverrideGroup = (groupId, commandKey) => {
    document.querySelectorAll(`#${groupId} .btn-toggle`).forEach(b => {
      b.addEventListener('click', () => {
        const mode = parseInt(b.getAttribute('data-mode'), 10);
        sendCommand({ [commandKey]: mode });
      });
    });
  };

  bindOverrideGroup('valveOverrideGroup', 'setValveOverride');
  bindOverrideGroup('pumpOverrideGroup', 'setPumpOverride');
  bindOverrideGroup('tankHighOverrideGroup', 'setTankHighOverride');
  bindOverrideGroup('tankLowOverrideGroup', 'setTankLowOverride');
  bindOverrideGroup('tankEmptyOverrideGroup', 'setTankEmptyOverride');
  bindOverrideGroup('overcurrentOverrideGroup', 'setOvercurrentOverride');
  bindOverrideGroup('undercurrentOverrideGroup', 'setUndercurrentOverride');
  bindOverrideGroup('freezeOverrideGroup', 'setFreezeOverride');

  // Reset All Overrides to Auto
  const resetAllAutoAction = () => {
    sendCommand({ resetAllOverrides: true });
  };
  const btnResetTop = document.getElementById('btnResetAllAutoTop');
  if (btnResetTop) btnResetTop.addEventListener('click', resetAllAutoAction);
  const btnResetBottom = document.getElementById('btnResetAllAutoBottom');
  if (btnResetBottom) btnResetBottom.addEventListener('click', resetAllAutoAction);

  // Settings Action Buttons
  const btnSetResetFault = document.getElementById('btnSettingsResetFault');
  if (btnSetResetFault) btnSetResetFault.addEventListener('click', resetFaultAction);

  const btnSetSilence = document.getElementById('btnSettingsSilence');
  if (btnSetSilence) btnSetSilence.addEventListener('click', () => {
    alarmAudio.stopAlarm();
    sendCommand({ silenceAlarm: true });
  });

  const btnSetEStop = document.getElementById('btnSettingsEStop');
  if (btnSetEStop) btnSetEStop.addEventListener('click', eStopAction);

  // -------------------------------------------------------------------------
  // 6. Connection Modal & Mode Switchers
  // -------------------------------------------------------------------------
  const modal = document.getElementById('connModal');
  document.getElementById('btnOpenConnectModal').addEventListener('click', () => {
    modal.classList.add('active');
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Connect via BLE
  document.getElementById('btnOptBLE').addEventListener('click', async () => {
    modal.classList.remove('active');
    alarmAudio.init();
    simulator.isRunning = false;
    cloud.stopPolling();
    activeMode = 'bluetooth';
    const ok = await ble.connect();
    if (!ok) {
      activeMode = 'simulator';
      simulator.isRunning = true;
      onConnectionChanged(true, 'Test Simulator');
    }
  });

  // Connect via Netlify Cloud / LAN
  document.getElementById('btnOptCloud').addEventListener('click', () => {
    const url = prompt('Enter ESP32 Local IP or Cloud URL (e.g. http://192.168.1.120/api/status):', cloud.apiUrl);
    if (url) {
      modal.classList.remove('active');
      alarmAudio.init();
      simulator.isRunning = false;
      activeMode = 'cloud';
      cloud.setApiUrl(url);
      cloud.startPolling();
    }
  });

  // Switch to Test Simulator
  document.getElementById('btnOptSim').addEventListener('click', () => {
    modal.classList.remove('active');
    ble.disconnect();
    cloud.stopPolling();
    activeMode = 'simulator';
    simulator.isRunning = true;
    onConnectionChanged(true, 'Test Simulator');
  });

  // -------------------------------------------------------------------------
  // 7. Interactive Hardware Test Bench Controls (Simulator)
  // -------------------------------------------------------------------------
  // Water Level presets
  document.getElementById('simLevelFull').addEventListener('click', () => {
    simulator.state.tankHigh = false; // Floating
    simulator.state.tankLow = false;
    simulator.state.tankEmpty = false;
    setSimBtnActive('simLevelGroup', 'simLevelFull');
  });

  document.getElementById('simLevelMid').addEventListener('click', () => {
    simulator.state.tankHigh = true;  // Down
    simulator.state.tankLow = false; // Floating
    simulator.state.tankEmpty = false;
    setSimBtnActive('simLevelGroup', 'simLevelMid');
  });

  document.getElementById('simLevelLow').addEventListener('click', () => {
    simulator.state.tankHigh = true;
    simulator.state.tankLow = true;  // Down -> start fill
    simulator.state.tankEmpty = false;
    setSimBtnActive('simLevelGroup', 'simLevelLow');
  });

  document.getElementById('simLevelEmpty').addEventListener('click', () => {
    simulator.state.tankHigh = true;
    simulator.state.tankLow = true;
    simulator.state.tankEmpty = true; // Alarm!
    setSimBtnActive('simLevelGroup', 'simLevelEmpty');
  });

  // Freeze Sensor Simulation
  document.getElementById('simFreezeWarm').addEventListener('click', () => {
    simulator.state.freezeSensor = false;
    setSimBtnActive('simFreezeGroup', 'simFreezeWarm');
  });

  document.getElementById('simFreezeCold').addEventListener('click', () => {
    simulator.state.freezeSensor = true;
    setSimBtnActive('simFreezeGroup', 'simFreezeCold');
  });

  // Overcurrent Sensor Simulation
  const btnOcNorm = document.getElementById('simOvercurrentNormal');
  const btnOcFault = document.getElementById('simOvercurrentFault');
  if (btnOcNorm && btnOcFault) {
    btnOcNorm.addEventListener('click', () => {
      simulator.state.pumpOvercurrent = false;
      simulator.state.pumpOvercurrentTrip = false;
      setSimBtnActive('simOvercurrentGroup', 'simOvercurrentNormal');
    });
    btnOcFault.addEventListener('click', () => {
      simulator.state.pumpOvercurrent = true;
      setSimBtnActive('simOvercurrentGroup', 'simOvercurrentFault');
    });
  }

  // Undercurrent Sensor Simulation
  const btnUcNorm = document.getElementById('simUndercurrentNormal');
  const btnUcFault = document.getElementById('simUndercurrentFault');
  if (btnUcNorm && btnUcFault) {
    btnUcNorm.addEventListener('click', () => {
      simulator.state.pumpUndercurrent = false;
      simulator.state.pumpUndercurrentTrip = false;
      setSimBtnActive('simUndercurrentGroup', 'simUndercurrentNormal');
    });
    btnUcFault.addEventListener('click', () => {
      simulator.state.pumpUndercurrent = true;
      setSimBtnActive('simUndercurrentGroup', 'simUndercurrentFault');
    });
  }

  function setSimBtnActive(groupId, btnId) {
    document.querySelectorAll(`#${groupId} .btn-sim`).forEach(b => b.classList.remove('active'));
    const target = document.getElementById(btnId);
    if (target) target.classList.add('active');
  }

  // Initial Simulator state
  onConnectionChanged(true, 'Test Simulator');
});
