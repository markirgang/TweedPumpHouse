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
      this.isPulsing = false;
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

    startAlarm(pulsing = false) {
      if (this.muted) return;
      if (this.isPlaying && this.isPulsing === pulsing) return;
      
      this.stopAlarm();
      this.init();
      if (!this.ctx) return;

      this.isPlaying = true;
      this.isPulsing = pulsing;
      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();

      this.osc.type = pulsing ? 'triangle' : 'sawtooth';
      this.osc.frequency.setValueAtTime(pulsing ? 660 : 880, this.ctx.currentTime); // A5

      // Pulsing frequency modulation for industrial siren / warning beeps
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = pulsing ? 2 : 4; // 2Hz for pulse warning, 4Hz for critical siren
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = pulsing ? 300 : 220;
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
      this.isPulsing = false;
    }
  }

  const alarmAudio = new AudioAlarm();

  // -------------------------------------------------------------------------
  // 2. Password Protection & Security System
  // -------------------------------------------------------------------------
  const VALID_PASSWORDS = ['5100', 'tweed123'];
  let isControlsUnlocked = false;
  let unlockTimer = null;
  let pendingProtectedAction = null;
  let activePassword = '5100';

  const passwordModal = document.getElementById('passwordModal');
  const passwordInput = document.getElementById('passwordInput');
  const authErrorMsg = document.getElementById('authErrorMsg');
  const chkKeepUnlocked = document.getElementById('chkKeepUnlocked');
  const btnLockStatus = document.getElementById('btnLockStatus');
  const lockIcon = document.getElementById('lockIcon');
  const lockText = document.getElementById('lockText');

  function updateLockUI() {
    if (btnLockStatus) {
      if (isControlsUnlocked) {
        btnLockStatus.className = 'btn-lock-status unlocked';
        if (lockIcon) lockIcon.innerText = '🔓';
        if (lockText) lockText.innerText = 'Controls Unlocked';
        btnLockStatus.title = 'Click to lock controls immediately';
      } else {
        btnLockStatus.className = 'btn-lock-status locked';
        if (lockIcon) lockIcon.innerText = '🔒';
        if (lockText) lockText.innerText = 'Controls Locked';
        btnLockStatus.title = 'Click to enter PIN and unlock controls';
      }
    }
  }

  function unlockControls(durationMs = 10 * 60 * 1000) {
    isControlsUnlocked = true;
    updateLockUI();
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = null;
    }
    if (durationMs > 0) {
      unlockTimer = setTimeout(() => {
        lockControls();
      }, durationMs);
    }
  }

  function lockControls() {
    isControlsUnlocked = false;
    if (unlockTimer) {
      clearTimeout(unlockTimer);
      unlockTimer = null;
    }
    updateLockUI();
  }

  function openPasswordModal(actionCallback) {
    pendingProtectedAction = actionCallback;
    if (passwordInput) {
      passwordInput.value = '';
    }
    if (authErrorMsg) {
      authErrorMsg.style.display = 'none';
    }
    if (passwordModal) {
      passwordModal.classList.add('active');
    }
    setTimeout(() => {
      if (passwordInput) passwordInput.focus();
    }, 100);
  }

  function closePasswordModal() {
    if (passwordModal) {
      passwordModal.classList.remove('active');
    }
    pendingProtectedAction = null;
  }

  function verifyAndAuthenticate(enteredPass) {
    const p = enteredPass.trim();
    if (VALID_PASSWORDS.includes(p)) {
      activePassword = p;
      if (chkKeepUnlocked && chkKeepUnlocked.checked) {
        unlockControls(10 * 60 * 1000); // 10 minutes session
      } else {
        unlockControls(60 * 1000); // 1 minute single-use session
      }
      
      const act = pendingProtectedAction;
      closePasswordModal();
      if (act) {
        act(activePassword);
      }
      return true;
    } else {
      if (authErrorMsg) {
        authErrorMsg.style.display = 'block';
      }
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
      return false;
    }
  }

  function requirePassword(actionCallback) {
    if (isControlsUnlocked) {
      actionCallback(activePassword);
    } else {
      openPasswordModal(actionCallback);
    }
  }

  // Password Modal Event Listeners
  if (btnLockStatus) {
    btnLockStatus.addEventListener('click', () => {
      if (isControlsUnlocked) {
        lockControls();
      } else {
        openPasswordModal(() => {});
      }
    });
  }

  const btnSubmitPassword = document.getElementById('btnSubmitPassword');
  if (btnSubmitPassword) {
    btnSubmitPassword.addEventListener('click', () => {
      verifyAndAuthenticate(passwordInput ? passwordInput.value : '');
    });
  }

  const btnCancelPassword = document.getElementById('btnCancelPassword');
  if (btnCancelPassword) {
    btnCancelPassword.addEventListener('click', () => {
      closePasswordModal();
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        verifyAndAuthenticate(passwordInput.value);
      } else if (e.key === 'Escape') {
        closePasswordModal();
      }
    });
  }

  // Password Visibility Toggle
  const btnTogglePwdVis = document.getElementById('btnTogglePwdVis');
  if (btnTogglePwdVis && passwordInput) {
    btnTogglePwdVis.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        btnTogglePwdVis.innerText = '🙈';
      } else {
        passwordInput.type = 'password';
        btnTogglePwdVis.innerText = '👁️';
      }
    });
  }

  // Touch / On-Screen Numpad Buttons
  document.querySelectorAll('.auth-numpad .btn-num').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!passwordInput) return;
      const val = btn.getAttribute('data-val');
      if (val === 'CLR') {
        passwordInput.value = '';
        if (authErrorMsg) authErrorMsg.style.display = 'none';
      } else if (val === 'DEL') {
        passwordInput.value = passwordInput.value.slice(0, -1);
      } else if (val) {
        passwordInput.value += val;
        if (authErrorMsg) authErrorMsg.style.display = 'none';
        if (passwordInput.value.length === 4) {
          // Auto-submit 4-digit PIN for slick user experience
          verifyAndAuthenticate(passwordInput.value);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. Initialize Subsystems
  // -------------------------------------------------------------------------
  const schematic = new SystemSchematic('schematicCanvas');

  let activeMode = 'simulator'; // 'simulator', 'bluetooth', 'cloud'
  let latestTelemetry = {};

  const onTelemetryReceived = (data, source) => {
    latestTelemetry = data;
    updateUI(data, source);
    if (schematic) schematic.updateState(data);
    if (window.hexapodManager) {
      window.hexapodManager.onTelemetryUpdate(data);
    }

    // Audio alarm management (supporting 1-minute pulsing warning)
    if (data.alarm && !data.alarmSilenced) {
      alarmAudio.startAlarm(Boolean(data.alarmPulsing || data.pumpCurrentFaultPending));
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
  // 4. UI Update Renderer
  // -------------------------------------------------------------------------
  function updateUI(t, source) {
    // 1A. Critical Tank Empty Alarm Banner
    const alarmBanner = document.getElementById('alarmBanner');
    if (t.alarm && !t.alarmSilenced && t.tankEmpty) {
      alarmBanner.classList.add('active');
    } else {
      alarmBanner.classList.remove('active');
    }

    // 1B-PRE. Overcurrent 1-Minute Warning Banner (Pulsing Alarm)
    const ocWarnBanner = document.getElementById('overcurrentWarningBanner');
    const ocCountdown = document.getElementById('overcurrentCountdown');
    const isOcPending = Boolean(t.pumpCurrentFaultPending && (t.isOvercurrentPending || (t.pumpOvercurrent && !t.pumpUndercurrent)));
    if (ocWarnBanner) {
      if (isOcPending) {
        ocWarnBanner.classList.add('active');
        const remSec = (t.pumpCurrentFaultRemainingSec !== undefined) 
          ? t.pumpCurrentFaultRemainingSec 
          : Math.ceil((t.pumpCurrentFaultRemainingMs || 0) / 1000);
        if (ocCountdown) ocCountdown.innerText = `${remSec}s`;
      } else {
        ocWarnBanner.classList.remove('active');
      }
    }

    // 1B. Latched Overcurrent Trip Banner
    const overcurrentBanner = document.getElementById('overcurrentBanner');
    if (overcurrentBanner) {
      if (t.pumpOvercurrentTrip) {
        overcurrentBanner.classList.add('active');
      } else {
        overcurrentBanner.classList.remove('active');
      }
    }

    // 1C-PRE. Undercurrent 1-Minute Warning Banner (Pulsing Alarm)
    const ucWarnBanner = document.getElementById('undercurrentWarningBanner');
    const ucCountdown = document.getElementById('undercurrentCountdown');
    const isUcPending = Boolean(t.pumpCurrentFaultPending && (t.isUndercurrentPending || (t.pumpUndercurrent && !t.pumpOvercurrent)));
    if (ucWarnBanner) {
      if (isUcPending) {
        ucWarnBanner.classList.add('active');
        const remSec = (t.pumpCurrentFaultRemainingSec !== undefined) 
          ? t.pumpCurrentFaultRemainingSec 
          : Math.ceil((t.pumpCurrentFaultRemainingMs || 0) / 1000);
        if (ucCountdown) ucCountdown.innerText = `${remSec}s`;
      } else {
        ucWarnBanner.classList.remove('active');
      }
    }

    // 1C. Latched Undercurrent / Dry Run Banner
    const undercurrentBanner = document.getElementById('undercurrentBanner');
    if (undercurrentBanner) {
      if (t.pumpUndercurrentTrip) {
        undercurrentBanner.classList.add('active');
      } else {
        undercurrentBanner.classList.remove('active');
      }
    }

    // 1D. Low Pump Room Temperature Alarm (<55°F) Banner
    const lowTempBanner = document.getElementById('lowTempAlarmBanner');
    if (lowTempBanner) {
      if (t.pumpRoomLowTempAlarm && t.alarm && !t.alarmSilenced) {
        lowTempBanner.classList.add('active');
        const lowTempDisplay = document.getElementById('lowTempDisplay');
        if (lowTempDisplay) {
          lowTempDisplay.innerText = `${(t.temperatureF !== undefined ? t.temperatureF : 50.0).toFixed(1)}°F`;
        }
      } else {
        lowTempBanner.classList.remove('active');
      }
    }

    // 2. Freeze Warning Banner
    const freezeBanner = document.getElementById('freezeBanner');
    if (freezeBanner) {
      if (t.freezeSensor) {
        freezeBanner.classList.add('active');
      } else {
        freezeBanner.classList.remove('active');
      }
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
    } else if (t.pumpCurrentFaultPending) {
      pumpVal.innerText = 'FAULT WARNING (PULSE)';
      pumpVal.className = 'metric-val val-amber';
    } else if (t.pumpTimingState === 1 || t.pump) {
      pumpVal.innerText = 'RUNNING (ASSIST)';
      pumpVal.className = 'metric-val val-cyan';
    } else if (t.pumpTimingState === 2) {
      pumpVal.innerText = 'COOLDOWN';
      pumpVal.className = 'metric-val val-amber';
    } else if (t.fillCycleActive && t.tankLow && t.lineValve) {
      pumpVal.innerText = 'START DELAY (5s)';
      pumpVal.className = 'metric-val val-amber';
    } else {
      pumpVal.innerText = 'OFF / STANDBY';
      pumpVal.className = 'metric-val val-grey';
    }

    const lowTempRelayVal = document.getElementById('valLowTempRelay');
    if (lowTempRelayVal) {
      if (t.relayLowTempAlarm || t.pumpRoomLowTempAlarm) {
        lowTempRelayVal.innerText = 'ACTIVE (ALARM ON)';
        lowTempRelayVal.className = 'metric-val val-red';
      } else {
        lowTempRelayVal.innerText = 'OFF (STANDBY)';
        lowTempRelayVal.className = 'metric-val val-grey';
      }
    }

    // 5. Pump Run Time & Timed-Out Duration
    const timerLabel = document.getElementById('pumpTimerLabel');
    const timerDigits = document.getElementById('pumpTimerDigits');
    const statusDesc = document.getElementById('pumpStatusDesc');
    const durationBadge = document.getElementById('pumpDurationBadge');
    const progressBar = document.getElementById('pumpProgressBar');

    if (t.municipalPressureTrip) {
      timerLabel.innerText = 'Municipal Cutout:';
      timerDigits.innerText = 'OUTAGE (<5 PSI TRIP)';
      statusDesc.innerText = 'Municipal pressure was under 5 PSI for 30s. Pump shut down to protect from dry run. Press Reset Fault.';
      durationBadge.className = 'badge-pill fault';
      durationBadge.innerText = 'TRIPPED';
      progressBar.className = 'progress-bar-fill fault';
      progressBar.style.width = '100%';
    } else if (t.municipalPressureFaultPending) {
      const remSec = (t.municipalPressureFaultRemainingSec !== undefined)
        ? t.municipalPressureFaultRemainingSec
        : Math.ceil((t.municipalPressureFaultRemainingMs || 0) / 1000);
      timerLabel.innerText = 'Municipal Low Pressure:';
      timerDigits.innerText = `SHUTDOWN IN ${remSec}s`;
      statusDesc.innerText = `Municipal pressure < 5 PSI! Counting down 30s before emergency pump cutout.`;
      durationBadge.className = 'badge-pill cooldown';
      durationBadge.innerText = `${remSec}s REM`;
      progressBar.className = 'progress-bar-fill cooldown';
      progressBar.style.width = `${Math.min(100, (remSec / 30) * 100)}%`;
    } else if (t.pumpOvercurrentTrip || t.pumpUndercurrentTrip) {
      timerLabel.innerText = 'Fault Interlock:';
      timerDigits.innerText = t.pumpOvercurrentTrip ? 'OVERLOAD TRIP' : 'DRY RUN TRIP';
      statusDesc.innerText = 'Safety trip stopped pump. Press Reset Fault.';
      durationBadge.className = 'badge-pill fault';
      durationBadge.innerText = 'TRIPPED';
      progressBar.className = 'progress-bar-fill fault';
      progressBar.style.width = '100%';
    } else if (t.pumpCurrentFaultPending) {
      const remSec = (t.pumpCurrentFaultRemainingSec !== undefined)
        ? t.pumpCurrentFaultRemainingSec
        : Math.ceil((t.pumpCurrentFaultRemainingMs || 0) / 1000);
      timerLabel.innerText = 'Pre-Trip Warning:';
      timerDigits.innerText = `PULSING ALARM (${remSec}s)`;
      statusDesc.innerText = `Transient overload/dry-run sensed. Pulsing alarm for 1 min before stopping.`;
      durationBadge.className = 'badge-pill cooldown';
      durationBadge.innerText = `${remSec}s REM`;
      progressBar.className = 'progress-bar-fill cooldown';
      progressBar.style.width = `${Math.min(100, (remSec / 60) * 100)}%`;
    } else if (t.pumpTimingState === 1 || t.pump) {
      const elapsed = t.pumpRunElapsedSec || (t.pumpRunElapsedMs ? Math.floor(t.pumpRunElapsedMs / 1000) : 0);
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
      const rem = t.pumpCooldownRemainingSec || (t.pumpCooldownRemainingMs ? Math.floor(t.pumpCooldownRemainingMs / 1000) : 0);
      const totalSec = t.pumpCooldownTotalSec || 7200;
      const ranSec = t.pumpLastRunDurationSec || (t.pumpLastRunDurationMs ? Math.floor(t.pumpLastRunDurationMs / 1000) : 25 * 60);
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
    } else if (t.fillCycleActive && t.tankLow && t.lineValve && !t.pump) {
      timerLabel.innerText = 'Booster Pump Start:';
      timerDigits.innerText = 'VALVE PRIMING';
      statusDesc.innerText = 'Line valve opened. Waiting 5s suction prime delay before pump starts.';
      durationBadge.className = 'badge-pill cooldown';
      durationBadge.innerText = '5s DELAY';
      progressBar.className = 'progress-bar-fill cooldown';
      progressBar.style.width = '20%';
    } else {
      timerLabel.innerText = 'Pump Run Time:';
      timerDigits.innerText = 'STANDBY';
      const lastRan = t.pumpLastRunDurationSec || (t.pumpLastRunDurationMs ? Math.floor(t.pumpLastRunDurationMs / 1000) : 0);
      if (lastRan > 0) {
        const lastMm = Math.floor(lastRan / 60).toString().padStart(2, '0');
        const lastSs = (lastRan % 60).toString().padStart(2, '0');
        statusDesc.innerText = `Standby. Last pump on-time: ${lastMm}m ${lastSs}`;
      } else {
        statusDesc.innerText = 'Holding tank standby. Auto control armed.';
      }
      durationBadge.className = 'badge-pill';
      durationBadge.innerText = 'READY';
      progressBar.className = 'progress-bar-fill';
      progressBar.style.width = '0%';
    }

    // 6. FCS521-SD-10V AC Current Transmitter Telemetry
    const currAmps = (t.pumpCurrentAmps !== undefined) ? Number(t.pumpCurrentAmps) : 0.0;
    const currVolts = (t.pumpCurrentVolts !== undefined) ? Number(t.pumpCurrentVolts) : ((currAmps / 50.0) * 10.0);
    const overThreshold = (t.overcurrentThresholdAmps !== undefined) ? Number(t.overcurrentThresholdAmps) : 18.0;
    const underThreshold = (t.undercurrentThresholdAmps !== undefined) ? Number(t.undercurrentThresholdAmps) : 4.5;

    const valCurrElem = document.getElementById('valPumpCurrent');
    if (valCurrElem) {
      valCurrElem.innerHTML = `${currAmps.toFixed(1)} <span class="unit">A</span>`;
    }

    const valCurrVoltsElem = document.getElementById('valPumpCurrentVolts');
    if (valCurrVoltsElem) {
      valCurrVoltsElem.innerText = `Sensor: ${currVolts.toFixed(2)}V (0-10V Linear)`;
    }

    const badgeCurrStatus = document.getElementById('badgeCurrentStatus');
    const barCurrFill = document.getElementById('barPumpCurrent');
    const needleCurr = document.getElementById('needlePumpCurrent');

    // Bar percentage: 0 to 50 Amps -> 0% to 100%
    const currPct = Math.max(0, Math.min(100, (currAmps / 50.0) * 100.0));
    if (barCurrFill) barCurrFill.style.width = `${currPct}%`;
    if (needleCurr) needleCurr.style.left = `${currPct}%`;

    if (badgeCurrStatus) {
      if (t.pumpOvercurrentTrip) {
        badgeCurrStatus.innerText = 'OVERLOAD TRIP';
        badgeCurrStatus.className = 'pressure-status-badge val-red';
      } else if (t.pumpUndercurrentTrip) {
        badgeCurrStatus.innerText = 'DRY RUN TRIP';
        badgeCurrStatus.className = 'pressure-status-badge val-amber';
      } else if (t.pumpCurrentFaultPending) {
        badgeCurrStatus.innerText = `WARN PULSE (${t.pumpCurrentFaultRemainingSec || 60}s)`;
        badgeCurrStatus.className = 'pressure-status-badge val-amber';
      } else if (t.pump || t.pumpTimingState === 1) {
        if (currAmps > overThreshold) {
          badgeCurrStatus.innerText = 'OVERLOAD (>18A)';
          badgeCurrStatus.className = 'pressure-status-badge val-red';
        } else if (currAmps < underThreshold) {
          badgeCurrStatus.innerText = 'DRY RUN (<4.5A)';
          badgeCurrStatus.className = 'pressure-status-badge val-amber';
        } else {
          badgeCurrStatus.innerText = 'RUNNING (OK)';
          badgeCurrStatus.className = 'pressure-status-badge val-green';
        }
      } else {
        badgeCurrStatus.innerText = 'STANDBY READY';
        badgeCurrStatus.className = 'pressure-status-badge val-grey';
      }
    }

    const currentBox = document.getElementById('currentSummaryBox');
    const currentText = document.getElementById('currentSummaryText');
    if (currentBox && currentText) {
      if (t.municipalPressureTrip) {
        currentBox.className = 'current-summary-box fault';
        currentText.innerText = 'Municipal water outage (<5 PSI) trip active! Booster stopped to prevent dry run.';
      } else if (t.municipalPressureFaultPending) {
        currentBox.className = 'current-summary-box fault';
        currentText.innerText = 'Municipal pressure < 5 PSI warning: Shutting down pump in ' + (t.municipalPressureFaultRemainingSec || 30) + ' seconds.';
      } else if (t.pumpOvercurrentTrip) {
        currentBox.className = 'current-summary-box fault';
        currentText.innerText = `Overload trip latched! Motor current (${currAmps.toFixed(1)}A) exceeded safety limit (${overThreshold.toFixed(1)}A).`;
      } else if (t.pumpUndercurrentTrip) {
        currentBox.className = 'current-summary-box fault';
        currentText.innerText = `Dry run / cavitation trip latched! Motor current (${currAmps.toFixed(1)}A) fell below prime threshold (${underThreshold.toFixed(1)}A).`;
      } else if (t.pumpCurrentFaultPending) {
        currentBox.className = 'current-summary-box fault';
        currentText.innerText = `Pre-trip warning active: Alarm relay pulsing (${t.pumpCurrentFaultRemainingSec || 60}s remaining) before safety shutdown.`;
      } else {
        currentBox.className = 'current-summary-box';
        currentText.innerText = `FCS521-SD-10V Current: ${currAmps.toFixed(1)}A (${currVolts.toFixed(2)}V) — Load protection healthy.`;
      }
    }

    // 6B. Water Line Pressure Transducers & ADS1115 Telemetry
    const muniPsi = (t.pressureMunicipalPsi !== undefined) ? t.pressureMunicipalPsi : 58.0;
    const fillPsi = (t.pressureFillPipePsi !== undefined) ? t.pressureFillPipePsi : 0.0;
    const muniVolts = (t.pressureMunicipalVolts !== undefined) ? t.pressureMunicipalVolts : (0.5 + (muniPsi / 100.0) * 4.0);
    const fillVolts = (t.pressureFillPipeVolts !== undefined) ? t.pressureFillPipeVolts : (0.5 + (fillPsi / 200.0) * 4.0);

    const valMuniElem = document.getElementById('valMuniPressure');
    const badgeMuniElem = document.getElementById('badgeMuniPressure');
    const barMuniElem = document.getElementById('barMuniPressure');
    const txtMuniVoltsElem = document.getElementById('txtMuniVolts');

    if (valMuniElem) {
      valMuniElem.innerHTML = `${muniPsi.toFixed(1)} <span class="unit">PSI</span>`;
      if (txtMuniVoltsElem) txtMuniVoltsElem.innerText = `Sensor: ${muniVolts.toFixed(2)}V`;
      if (barMuniElem) {
        barMuniElem.style.width = `${Math.min(100, Math.max(0, (muniPsi / 100.0) * 100))}%`;
      }
      if (t.municipalPressureTrip) {
        if (badgeMuniElem) {
          badgeMuniElem.innerText = 'OUTAGE TRIP (<5 PSI)';
          badgeMuniElem.className = 'pressure-status-badge val-red';
        }
        if (barMuniElem) barMuniElem.classList.add('alert');
      } else if (t.municipalPressureFaultPending) {
        const remSec = t.municipalPressureFaultRemainingSec || 30;
        if (badgeMuniElem) {
          badgeMuniElem.innerText = `CUTOUT IN ${remSec}s (<5 PSI)`;
          badgeMuniElem.className = 'pressure-status-badge val-amber';
        }
        if (barMuniElem) barMuniElem.classList.add('alert');
      } else if (t.municipalLowPressureAlarm || (muniPsi < 20.0 && muniPsi > 0.5)) {
        if (badgeMuniElem) {
          badgeMuniElem.innerText = 'LOW PRESSURE (<20)';
          badgeMuniElem.className = 'pressure-status-badge val-red';
        }
        if (barMuniElem) barMuniElem.classList.add('alert');
      } else if (muniPsi <= 0.5) {
        if (badgeMuniElem) {
          badgeMuniElem.innerText = 'NO PRESSURE';
          badgeMuniElem.className = 'pressure-status-badge val-grey';
        }
        if (barMuniElem) barMuniElem.classList.remove('alert');
      } else {
        if (badgeMuniElem) {
          badgeMuniElem.innerText = 'NORMAL';
          badgeMuniElem.className = 'pressure-status-badge val-green';
        }
        if (barMuniElem) barMuniElem.classList.remove('alert');
      }
    }

    const valFillElem = document.getElementById('valFillPressure');
    const badgeFillElem = document.getElementById('badgeFillPressure');
    const barFillElem = document.getElementById('barFillPressure');
    const txtFillVoltsElem = document.getElementById('txtFillVolts');

    if (valFillElem) {
      valFillElem.innerHTML = `${fillPsi.toFixed(1)} <span class="unit">PSI</span>`;
      if (txtFillVoltsElem) txtFillVoltsElem.innerText = `Sensor: ${fillVolts.toFixed(2)}V`;
      if (barFillElem) {
        barFillElem.style.width = `${Math.min(100, Math.max(0, (fillPsi / 200.0) * 100))}%`;
      }
      if (t.fillPipeHighPressureAlarm || fillPsi > 180.0) {
        if (badgeFillElem) {
          badgeFillElem.innerText = 'OVER-PRESSURE (>180)';
          badgeFillElem.className = 'pressure-status-badge val-red';
        }
        if (barFillElem) barFillElem.classList.add('alert');
      } else if (t.pumpTimingState === 1 || t.pump) {
        if (badgeFillElem) {
          badgeFillElem.innerText = 'BOOSTING UPHILL';
          badgeFillElem.className = 'pressure-status-badge val-cyan';
        }
        if (barFillElem) barFillElem.classList.remove('alert');
      } else if (t.lineValve) {
        if (badgeFillElem) {
          badgeFillElem.innerText = 'GRAVITY TOP-OFF';
          badgeFillElem.className = 'pressure-status-badge val-green';
        }
        if (barFillElem) barFillElem.classList.remove('alert');
      } else {
        if (badgeFillElem) {
          badgeFillElem.innerText = 'DRAINED (0 PSI)';
          badgeFillElem.className = 'pressure-status-badge val-grey';
        }
        if (barFillElem) barFillElem.classList.remove('alert');
      }
    }

    const badgeAdsStatus = document.getElementById('badgeAdsStatus');
    if (badgeAdsStatus) {
      if (t.ads1115Detected) {
        badgeAdsStatus.innerText = 'ADS1115 ONLINE (0x48)';
        badgeAdsStatus.style.background = 'rgba(16, 185, 129, 0.2)';
        badgeAdsStatus.style.color = '#34d399';
      } else {
        badgeAdsStatus.innerText = 'ADS1115 I2C (0x48)';
        badgeAdsStatus.style.background = '';
        badgeAdsStatus.style.color = '';
      }
    }

    // 7. Climate
    const tempElem = document.getElementById('valTempF');
    if (tempElem) {
      const tempF = (t.temperatureF !== undefined ? t.temperatureF : 68.0);
      tempElem.innerText = tempF.toFixed(1) + '°F';
      if (t.pumpRoomLowTempAlarm || tempF < 55.0) {
        tempElem.className = 'metric-val val-red';
      } else {
        tempElem.className = 'metric-val';
      }
    }
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

    // FCS521 Current Sensor Simulator Slider & Preset Badges
    const simSlider = document.getElementById('simCurrentSlider');
    const simBadge = document.getElementById('simCurrentBadge');
    const currOverride = (t.currentOverrideAmps !== undefined) ? Number(t.currentOverrideAmps) : -1.0;
    
    if (simBadge) {
      if (currOverride >= 0) {
        simBadge.innerText = `${currOverride.toFixed(1)}A (OVERRIDE)`;
        if (currOverride > 18.0) simBadge.className = 'slider-badge mode-trip';
        else if (currOverride < 4.5 && currOverride > 0.5) simBadge.className = 'slider-badge mode-dry';
        else simBadge.className = 'slider-badge';
      } else {
        simBadge.innerText = 'AUTO (DYNAMIC)';
        simBadge.className = 'slider-badge mode-auto';
      }
    }

    if (simSlider && !window._userDraggingCurrentSlider) {
      simSlider.value = (currOverride >= 0) ? currOverride : (t.pumpCurrentAmps || 0);
    }

    // Update active preset button
    document.querySelectorAll('.preset-btn-row .btn-preset').forEach(btn => {
      const pAmps = parseFloat(btn.getAttribute('data-amps'));
      if (pAmps < 0 && currOverride < 0) {
        btn.classList.add('active');
      } else if (pAmps >= 0 && Math.abs(currOverride - pAmps) < 0.2) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // 9. Check if any override is currently active
    const activeOverrides = [];
    if (t.pumpOverride && t.pumpOverride !== 0) activeOverrides.push(t.pumpOverride === 1 ? 'Pump FORCE ON' : 'Pump FORCE OFF');
    if (t.valveOverride && t.valveOverride !== 0) activeOverrides.push(t.valveOverride === 1 ? 'Valve FORCE OPEN' : 'Valve FORCE CLOSE');
    if (t.tankHighOverride && t.tankHighOverride !== 0) activeOverrides.push(t.tankHighOverride === 1 ? 'Tank High SIM FULL' : 'Tank High SIM NORM');
    if (t.tankLowOverride && t.tankLowOverride !== 0) activeOverrides.push(t.tankLowOverride === 1 ? 'Tank Low SIM LOW' : 'Tank Low SIM OK');
    if (t.tankEmptyOverride && t.tankEmptyOverride !== 0) activeOverrides.push(t.tankEmptyOverride === 1 ? 'Tank Empty SIM ALARM' : 'Tank Empty SIM OK');
    if (currOverride >= 0) activeOverrides.push(`Current SIM ${currOverride.toFixed(1)}A`);
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
        alertCard.className = 'settings-alert-card';
        alertTitle.innerText = 'System Mode: All Subsystems in AUTO';
        alertDesc.innerText = 'Autonomous float logic and current safety monitoring active. PIN required for state overrides.';
      }
    }

    // 9. Hexapod Hardware Output Status (GPIO 11 & GPIO 12)
    const badgeMouth = document.getElementById('badgeHexMouthStatus');
    const badgeEyes = document.getElementById('badgeHexEyesStatus');
    if (t.hexapodMouth !== undefined && badgeMouth && (!window.hexapodManager || !window.hexapodManager.wsConnected)) {
      badgeMouth.className = t.hexapodMouth ? 'float-state-pill val-green' : 'float-state-pill val-grey';
      badgeMouth.innerText = t.hexapodMouth ? 'OPEN (ACTIVE)' : 'CLOSED';
    }
    if (t.hexapodEyes !== undefined && badgeEyes) {
      badgeEyes.className = t.hexapodEyes ? 'float-state-pill val-cyan' : 'float-state-pill val-amber';
      badgeEyes.innerText = t.hexapodEyes ? 'ILLUMINATED' : 'BLINKING';
    }

    // 10. MAX98357A I2S Mono Audio Amplifier Telemetry
    const sliderVol = document.getElementById('sliderAudioVolume');
    const valVolText = document.getElementById('valAudioVolumeText');
    const btnMute = document.getElementById('btnAudioMuteToggle');
    const btnHdrAudio = document.getElementById('btnHeaderAudioToggle');
    const hdrAudioLabel = document.getElementById('headerAudioLabel');
    const hdrAudioDot = document.getElementById('headerAudioDot');
    const hdrAudioIcon = document.getElementById('headerAudioIcon');
    const badgeAudio = document.getElementById('badgeI2SAudioStatus');

    if (t.audioVolume !== undefined) {
      if (valVolText) valVolText.innerText = `${t.audioVolume}%`;
      if (sliderVol && !sliderVol.matches(':active')) {
        sliderVol.value = t.audioVolume;
      }
      if (hdrAudioLabel) {
        hdrAudioLabel.innerText = t.audioMuted ? 'Amp: MUTED' : `Amp: ${t.audioVolume}%`;
      }
    }

    if (t.audioMuted !== undefined) {
      if (btnMute) {
        btnMute.className = t.audioMuted ? 'btn-action-small val-red' : 'btn-action-small';
        btnMute.innerHTML = t.audioMuted ? '🔇 Muted (Tap Unmute)' : '🔊 Mute Off';
      }
      if (hdrAudioDot) {
        hdrAudioDot.className = t.audioMuted ? 'hex-dot' : 'hex-dot on';
      }
      if (hdrAudioIcon) {
        hdrAudioIcon.innerText = t.audioMuted ? '🔇' : '🔊';
      }
      if (btnHdrAudio) {
        if (t.audioMuted) {
          btnHdrAudio.classList.remove('active');
        } else {
          btnHdrAudio.classList.add('active');
        }
      }
    }

    if (badgeAudio) {
      if (t.audioMuted) {
        badgeAudio.style.background = 'rgba(239,68,68,0.15)';
        badgeAudio.style.color = '#ef4444';
        badgeAudio.style.borderColor = 'rgba(239,68,68,0.3)';
        badgeAudio.innerText = 'Amp Muted';
      } else if (t.audioPlaying) {
        badgeAudio.style.background = 'rgba(0,240,255,0.2)';
        badgeAudio.style.color = '#00f0ff';
        badgeAudio.style.borderColor = 'rgba(0,240,255,0.4)';
        badgeAudio.innerText = 'Synthesizing Audio...';
      } else {
        badgeAudio.style.background = 'rgba(34,197,94,0.15)';
        badgeAudio.style.color = '#22c55e';
        badgeAudio.style.borderColor = 'rgba(34,197,94,0.3)';
        badgeAudio.innerText = 'Amp Active (16kHz)';
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
  // 5. Command Dispatcher
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

  // Wire Hexapod mascot hardware output changes to remote controller
  if (window.hexapodManager) {
    window.hexapodManager.onHardwareOutputChange = (type, state) => {
      if (type === 'mouth') {
        sendCommand({ setHexapodMouth: state });
      } else if (type === 'eyes') {
        sendCommand({ setHexapodEyes: state });
      } else if (type === 'speechSync') {
        sendCommand({ setHexapodSpeechSync: state });
      }
    };
  }

  // -------------------------------------------------------------------------
  // 6. Button Event Listeners & Tab Navigation
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

  // Silence Alarm Buttons (Unprotected emergency action)
  document.querySelectorAll('.btn-silence-alarm').forEach(b => {
    b.addEventListener('click', () => {
      alarmAudio.stopAlarm();
      sendCommand({ silenceAlarm: true });
    });
  });

  // Reset Pump Timeout / Fault Buttons (Unprotected recovery)
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

  // Generic Override Toggle Group Binder (PIN / PASSWORD PROTECTED)
  const bindOverrideGroup = (groupId, commandKey) => {
    document.querySelectorAll(`#${groupId} .btn-toggle`).forEach(b => {
      b.addEventListener('click', () => {
        const mode = parseInt(b.getAttribute('data-mode'), 10);
        requirePassword((pwd) => {
          sendCommand({ [commandKey]: mode, password: pwd });
        });
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

  // FCS521 Current Sensor Interactive Slider (PIN / PASSWORD PROTECTED)
  const simSliderElem = document.getElementById('simCurrentSlider');
  if (simSliderElem) {
    simSliderElem.addEventListener('mousedown', () => { window._userDraggingCurrentSlider = true; });
    simSliderElem.addEventListener('touchstart', () => { window._userDraggingCurrentSlider = true; });
    simSliderElem.addEventListener('input', (e) => {
      const amps = parseFloat(e.target.value);
      const badge = document.getElementById('simCurrentBadge');
      if (badge) {
        badge.innerText = `${amps.toFixed(1)}A (SIMULATING)`;
        if (amps > 18.0) badge.className = 'slider-badge mode-trip';
        else if (amps < 4.5 && amps > 0.5) badge.className = 'slider-badge mode-dry';
        else badge.className = 'slider-badge';
      }
    });
    simSliderElem.addEventListener('change', (e) => {
      window._userDraggingCurrentSlider = false;
      const amps = parseFloat(e.target.value);
      requirePassword((pwd) => {
        sendCommand({ setCurrentOverride: amps, password: pwd });
      });
    });
  }

  // FCS521 Current Sensor Quick Preset Buttons (PIN / PASSWORD PROTECTED)
  document.querySelectorAll('.preset-btn-row .btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const amps = parseFloat(btn.getAttribute('data-amps'));
      requirePassword((pwd) => {
        sendCommand({ setCurrentOverride: amps, password: pwd });
      });
    });
  });

  // Reset All Overrides to Auto (PIN / PASSWORD PROTECTED)
  const resetAllAutoAction = () => {
    requirePassword((pwd) => {
      sendCommand({ resetAllOverrides: true, password: pwd });
    });
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

  // I2S Mono Audio Amplifier Controls
  const sliderAudioVol = document.getElementById('sliderAudioVolume');
  if (sliderAudioVol) {
    sliderAudioVol.addEventListener('input', (e) => {
      const vol = parseInt(e.target.value, 10);
      const text = document.getElementById('valAudioVolumeText');
      if (text) text.innerText = `${vol}%`;
      sendCommand({ setAudioVolume: vol });
    });
  }

  const toggleMuteAction = () => {
    sendCommand({ toggleAudioMute: true });
  };
  const btnAudioMute = document.getElementById('btnAudioMuteToggle');
  if (btnAudioMute) btnAudioMute.addEventListener('click', toggleMuteAction);
  const btnHdrAudioToggle = document.getElementById('btnHeaderAudioToggle');
  if (btnHdrAudioToggle) btnHdrAudioToggle.addEventListener('click', toggleMuteAction);

  // Sound Effects & State Chime Test Buttons
  document.querySelectorAll('.btn-chime-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const chime = btn.getAttribute('data-chime');
      sendCommand({ playAudioChime: chime });
    });
  });

  // Emergency Siren Test Buttons
  document.querySelectorAll('.btn-siren-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const siren = btn.getAttribute('data-siren');
      sendCommand({ playAudioSiren: siren, durationMs: 0 });
    });
  });

  // Stop Audio Button
  const btnStopAudio = document.getElementById('btnStopI2SAudio');
  if (btnStopAudio) {
    btnStopAudio.addEventListener('click', () => {
      sendCommand({ stopAudio: true });
    });
  }

  // Robotic Speech Phrase Buttons
  document.querySelectorAll('.btn-phrase-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const phrase = btn.getAttribute('data-phrase');
      sendCommand({ speakPhrase: phrase });
    });
  });

  // -------------------------------------------------------------------------
  // 7. Connection Modal & Mode Switchers
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
  // 8. Interactive Hardware Test Bench Controls (Simulator)
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
      simulator.state.pumpCurrentFaultPending = false;
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
      simulator.state.pumpCurrentFaultPending = false;
      setSimBtnActive('simUndercurrentGroup', 'simUndercurrentNormal');
    });
    btnUcFault.addEventListener('click', () => {
      simulator.state.pumpUndercurrent = true;
      setSimBtnActive('simUndercurrentGroup', 'simUndercurrentFault');
    });
  }

  // Pump Room Temperature (DHT11) Simulation
  const btnTempNorm = document.getElementById('simTempNorm');
  const btnTempLow = document.getElementById('simTempLow');
  const btnTempCold = document.getElementById('simTempCold');
  if (btnTempNorm && btnTempLow && btnTempCold) {
    btnTempNorm.addEventListener('click', () => {
      simulator.state.temperatureF = 68.0;
      simulator.state.temperatureC = 20.0;
      simulator.state.pumpRoomLowTempAlarm = false;
      setSimBtnActive('simTempGroup', 'simTempNorm');
    });
    btnTempLow.addEventListener('click', () => {
      simulator.state.temperatureF = 50.0;
      simulator.state.temperatureC = 10.0;
      simulator.state.pumpRoomLowTempAlarm = true;
      simulator.state.alarmSilenced = false; // Trigger audible siren
      setSimBtnActive('simTempGroup', 'simTempLow');
    });
    btnTempCold.addEventListener('click', () => {
      simulator.state.temperatureF = 35.0;
      simulator.state.temperatureC = 1.67;
      simulator.state.pumpRoomLowTempAlarm = true;
      simulator.state.alarmSilenced = false; // Trigger audible siren
      setSimBtnActive('simTempGroup', 'simTempCold');
    });
  }

  // Municipal 9W Water Pressure Simulation Controls
  const btnMuniNorm = document.getElementById('simMuniPressNorm');
  const btnMuniLow = document.getElementById('simMuniPressLow');
  const btnMuniZero = document.getElementById('simMuniPressZero');
  if (btnMuniNorm && btnMuniLow && btnMuniZero) {
    btnMuniNorm.addEventListener('click', () => {
      simulator.state.simMuniPressureOverride = null; // Auto nominal ~58 PSI
      setSimBtnActive('simMuniPressureGroup', 'simMuniPressNorm');
    });
    btnMuniLow.addEventListener('click', () => {
      simulator.state.simMuniPressureOverride = 15.0; // Low pressure warning <20 PSI
      setSimBtnActive('simMuniPressureGroup', 'simMuniPressLow');
    });
    btnMuniZero.addEventListener('click', () => {
      simulator.state.simMuniPressureOverride = 0.0; // Municipal water outage
      setSimBtnActive('simMuniPressureGroup', 'simMuniPressZero');
    });
  }

  // Fill Pipe Uphill Pressure Simulation Controls
  const btnFillAuto = document.getElementById('simFillPressAuto');
  const btnFillHigh = document.getElementById('simFillPressHigh');
  if (btnFillAuto && btnFillHigh) {
    btnFillAuto.addEventListener('click', () => {
      simulator.state.simFillPressureOverride = null; // Auto follow pump/valve state
      setSimBtnActive('simFillPressureGroup', 'simFillPressAuto');
    });
    btnFillHigh.addEventListener('click', () => {
      simulator.state.simFillPressureOverride = 190.0; // Over-pressure / blockage >180 PSI
      setSimBtnActive('simFillPressureGroup', 'simFillPressHigh');
    });
  }

  function setSimBtnActive(groupId, btnId) {
    document.querySelectorAll(`#${groupId} .btn-sim`).forEach(b => b.classList.remove('active'));
    const target = document.getElementById(btnId);
    if (target) target.classList.add('active');
  }

  // Initial Simulator state & Lock state
  updateLockUI();
  onConnectionChanged(true, 'Test Simulator');
});
