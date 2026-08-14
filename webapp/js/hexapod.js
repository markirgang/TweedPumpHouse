/**
 * Tweed Boulevard / Route 9W Water System
 * Hexapod Robot Assistant & Speech Lip-Sync Animation Controller
 * 
 * Features:
 * - 6-legged articulating mechanical cyber-hexapod avatar
 * - Real-time Lip-Sync with AI Python Audio Stream (ws://localhost:8765)
 * - Physical & Virtual Mouth Output (GPIO 11) & LED Eyes Output (GPIO 12)
 * - Natural randomized Eye Blinking engine (every 2.8 - 5.5 seconds)
 * - Dynamic SVG mouth aperture & 5-band audio frequency visualizer
 * - Speech Audio Synchronization On/Off Switch with localStorage persistence
 * - Web Audio API AnalyserNode real-time volume & spectral analysis
 * - Telemetry state observer with voice announcements & sound effects
 */

class HexapodAssistant {
  constructor() {
    this.enabled = localStorage.getItem('hexapod_enabled') !== 'false'; // default true
    this.voiceEnabled = localStorage.getItem('hexapod_voice') !== 'false'; // default true
    this.speechSyncEnabled = localStorage.getItem('hexapod_speech_sync') !== 'false'; // default true
    this.isMinimized = localStorage.getItem('hexapod_minimized') === 'true';
    this.audioStreamUrl = localStorage.getItem('hexapod_audio_ws_url') || 'ws://localhost:8765';
    
    this.isTalking = false;
    this.talkTimeout = null;
    this.speechQueue = [];
    this.lastSpokenText = '';
    this.lastSpokenTime = 0;

    // Real-time Actuator States
    this.mouthState = false;   // false = Closed/Off, true = Open/Speaking
    this.eyesState = true;     // true = Illuminated/On, false = Blinking/Off
    this.isBlinking = false;
    this.blinkTimeout = null;
    this.nextBlinkTimer = null;
    
    // Audio Context & Analyser
    this.audioCtx = null;
    this.analyser = null;
    this.analyserDataArray = null;
    this.analyserAnimFrame = null;
    this.speechSynth = window.speechSynthesis || null;

    // Python Audio Stream WebSocket
    this.ws = null;
    this.wsConnected = false;
    this.audioLevel = 0.0;
    
    // Hardware communication callback (wired by app.js)
    this.onHardwareOutputChange = null;

    // Telemetry state tracker to detect transitions
    this.prevState = {
      pump: null,
      lineValve: null,
      tankHigh: null,
      tankLow: null,
      tankEmpty: null,
      freezeSensor: null,
      pumpTimingState: null,
      overcurrentTrip: null,
      undercurrentTrip: null,
      alarm: null
    };

    this.initDOM();
    this.initEventListeners();
    this.initAudioAnalyser();
    this.startEyeBlinkingLoop();
    this.updateUIState();
  }

  // -------------------------------------------------------------------------
  // 1. DOM Initialization & SVG Avatar Injection
  // -------------------------------------------------------------------------
  initDOM() {
    if (!document.getElementById('hexapodWidget')) {
      const widget = document.createElement('aside');
      widget.id = 'hexapodWidget';
      widget.className = `hexapod-widget ${this.enabled ? 'active' : 'disabled'} ${this.isMinimized ? 'minimized' : ''}`;
      widget.setAttribute('aria-label', 'Hexapod Water System Assistant');

      widget.innerHTML = `
        <!-- Speech Bubble -->
        <div class="hexapod-speech-bubble" id="hexapodBubble">
          <div class="speech-header">
            <div class="speech-bot-tag">
              <span class="pulse-dot"></span>
              <span class="bot-name">HEXABOT AI</span>
            </div>
            <div class="speech-wave-bars" id="speechWaveBars">
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
              <span class="wave-bar"></span>
            </div>
            <button class="btn-close-speech" id="btnCloseSpeech" title="Dismiss speech">✕</button>
          </div>
          <div class="speech-text" id="hexapodSpeechText">
            Online &amp; monitoring Tweed Blvd Water System. Tap me for a status report!
          </div>
        </div>

        <!-- Hexapod Avatar Container -->
        <div class="hexapod-avatar-wrap" id="hexapodAvatar" title="Click Hexapod for status report">
          
          <!-- Animated SVG Hexapod -->
          <svg class="hexapod-svg" id="hexapodSvg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <!-- Glowing Gradients -->
              <radialGradient id="reactorGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#00f0ff" stop-opacity="1"/>
                <stop offset="70%" stop-color="#0284c7" stop-opacity="0.8"/>
                <stop offset="100%" stop-color="#0284c7" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="armorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b"/>
                <stop offset="50%" stop-color="#0f172a"/>
                <stop offset="100%" stop-color="#020617"/>
              </linearGradient>
              <linearGradient id="legGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#0369a1"/>
              </linearGradient>
              <filter id="cyanNeon" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <!-- Ground Shadow -->
            <ellipse class="hex-shadow" cx="100" cy="165" rx="55" ry="10" fill="rgba(0,0,0,0.5)"/>

            <!-- 6 ARTICULATING ROBOTIC LEGS -->
            <!-- Left Legs (3) -->
            <g class="hex-leg leg-l1">
              <path d="M 72 90 Q 40 65 24 82" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="24" cy="82" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 24 82 Q 12 120 20 155" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="20" cy="155" r="3" fill="#38bdf8"/>
            </g>

            <g class="hex-leg leg-l2">
              <path d="M 70 102 Q 35 95 16 112" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="16" cy="112" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 16 112 Q 8 138 28 162" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="28" cy="162" r="3" fill="#38bdf8"/>
            </g>

            <g class="hex-leg leg-l3">
              <path d="M 76 116 Q 45 130 32 145" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="32" cy="145" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 32 145 Q 26 160 48 168" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="48" cy="168" r="3" fill="#38bdf8"/>
            </g>

            <!-- Right Legs (3) -->
            <g class="hex-leg leg-r1">
              <path d="M 128 90 Q 160 65 176 82" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="176" cy="82" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 176 82 Q 188 120 180 155" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="180" cy="155" r="3" fill="#38bdf8"/>
            </g>

            <g class="hex-leg leg-r2">
              <path d="M 130 102 Q 165 95 184 112" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="184" cy="112" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 184 112 Q 192 138 172 162" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="172" cy="162" r="3" fill="#38bdf8"/>
            </g>

            <g class="hex-leg leg-r3">
              <path d="M 124 116 Q 155 130 168 145" stroke="url(#legGrad)" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle cx="168" cy="145" r="4" fill="#00f0ff" filter="url(#cyanNeon)"/>
              <path d="M 168 145 Q 174 160 152 168" stroke="url(#legGrad)" stroke-width="4" fill="none" stroke-linecap="round"/>
              <circle cx="152" cy="168" r="3" fill="#38bdf8"/>
            </g>

            <!-- CENTRAL CHASSIS / BODY -->
            <g class="hex-body" id="hexBody">
              <!-- Armored Torso Shell -->
              <polygon points="100,56 138,76 138,124 100,144 62,124 62,76" fill="url(#armorGrad)" stroke="#38bdf8" stroke-width="2.5" filter="url(#cyanNeon)"/>

              <!-- Mechanical Seam Lines -->
              <line x1="62" y1="76" x2="100" y2="100" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
              <line x1="138" y1="76" x2="100" y2="100" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
              <line x1="100" y1="144" x2="100" y2="100" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>

              <!-- Holographic Reactor Core -->
              <circle class="reactor-pulse" id="reactorCore" cx="100" cy="100" r="15" fill="url(#reactorGlow)"/>
              <polygon points="100,90 108,95 108,105 100,110 92,105 92,95" fill="none" stroke="#00f0ff" stroke-width="2"/>

              <!-- Dual Mechanical Antennas -->
              <g class="hex-antennas">
                <line x1="84" y1="58" x2="72" y2="34" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                <circle class="antenna-tip" cx="72" cy="34" r="3.5" fill="#00f0ff" filter="url(#cyanNeon)"/>
                
                <line x1="116" y1="58" x2="128" y2="34" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
                <circle class="antenna-tip" cx="128" cy="34" r="3.5" fill="#00f0ff" filter="url(#cyanNeon)"/>
              </g>

              <!-- HEAD & OCULAR SCANNER VISOR WITH EYELID BLINKING -->
              <g class="hex-head" id="hexHead">
                <!-- Visor Base Frame -->
                <rect x="76" y="66" width="48" height="15" rx="7.5" fill="#020617" stroke="#00f0ff" stroke-width="1.5"/>
                <!-- Scanning Eye Light (GPIO 12 Output) -->
                <ellipse class="visor-eye" id="visorEye" cx="100" cy="73.5" rx="14" ry="4.5" fill="#00f0ff" filter="url(#cyanNeon)"/>
                <!-- Upper & Lower Mechanical Eyelids -->
                <path class="visor-eyelid eyelid-top" id="eyelidTop" d="M 76 66 Q 100 66 124 66 L 124 66 Q 100 66 76 66 Z" fill="#1e293b"/>
                <path class="visor-eyelid eyelid-bot" id="eyelidBot" d="M 76 81 Q 100 81 124 81 L 124 81 Q 100 81 76 81 Z" fill="#1e293b"/>
              </g>

              <!-- TALKING MOUTH / SONIC EQUALIZER APERTURE (GPIO 11 Output) -->
              <g class="hex-mouth-aperture" id="hexMouth">
                <rect class="mouth-frame" x="85" y="122" width="30" height="10" rx="3" fill="#020617" stroke="rgba(56,189,248,0.6)" stroke-width="1.2"/>
                <!-- Equalizer Frequency Bars -->
                <line class="mouth-bar bar-1" id="mBar1" x1="89" y1="127" x2="89" y2="127" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
                <line class="mouth-bar bar-2" id="mBar2" x1="94" y1="127" x2="94" y2="127" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
                <line class="mouth-bar bar-3" id="mBar3" x1="100" y1="127" x2="100" y2="127" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
                <line class="mouth-bar bar-4" id="mBar4" x1="106" y1="127" x2="106" y2="127" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
                <line class="mouth-bar bar-5" id="mBar5" x1="111" y1="127" x2="111" y2="127" stroke="#00f0ff" stroke-width="2.5" stroke-linecap="round"/>
              </g>

              <!-- Front Robotic Pincer Claws -->
              <path class="front-claw claw-left" id="clawLeft" d="M 80 134 Q 74 148 86 154" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round"/>
              <path class="front-claw claw-right" id="clawRight" d="M 120 134 Q 126 148 114 154" stroke="#38bdf8" stroke-width="3" fill="none" stroke-linecap="round"/>
            </g>
          </svg>

          <!-- Status Beacon Badge -->
          <div class="hexapod-status-beacon" id="hexBeacon">
            <span class="beacon-dot"></span>
            <span class="beacon-label">HEXA-BOT</span>
          </div>

          <!-- Quick Floating Controls -->
          <div class="hexapod-dock-controls">
            <button class="btn-hex-dock" id="btnHexMute" title="Toggle voice audio">🔊</button>
            <button class="btn-hex-dock" id="btnHexMinimize" title="Minimize Hexapod">🔽</button>
          </div>
        </div>
      `;

      document.body.appendChild(widget);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Event Listeners & UI Controls
  // -------------------------------------------------------------------------
  initEventListeners() {
    // Header Toggle Button
    const btnHeaderToggle = document.getElementById('btnHexapodToggle');
    if (btnHeaderToggle) {
      btnHeaderToggle.addEventListener('click', () => {
        this.toggleEnabled();
      });
    }

    // Settings Page Switches
    const switchAnim = document.getElementById('switchHexapodAnim');
    if (switchAnim) {
      switchAnim.checked = this.enabled;
      switchAnim.addEventListener('change', (e) => {
        this.setEnabled(e.target.checked);
      });
    }

    // Speech Synchronization Switch (Mouth & Eyes Sync)
    const switchSpeechSync = document.getElementById('switchHexapodSpeechSync');
    if (switchSpeechSync) {
      switchSpeechSync.checked = this.speechSyncEnabled;
      switchSpeechSync.addEventListener('change', (e) => {
        this.setSpeechSyncEnabled(e.target.checked);
      });
    }

    const switchVoice = document.getElementById('switchHexapodVoice');
    if (switchVoice) {
      switchVoice.checked = this.voiceEnabled;
      switchVoice.addEventListener('change', (e) => {
        this.setVoiceEnabled(e.target.checked);
      });
    }

    // Python Audio Stream Connect/Disconnect Button
    const btnToggleStream = document.getElementById('btnToggleAudioStream');
    if (btnToggleStream) {
      btnToggleStream.addEventListener('click', () => {
        if (this.wsConnected) {
          this.disconnectAudioStream();
        } else {
          const inputUrl = document.getElementById('inputAudioStreamUrl');
          const url = inputUrl ? inputUrl.value.trim() : this.audioStreamUrl;
          this.connectAudioStream(url);
        }
      });
    }

    // Stream AI Speech Test Button
    const btnAiSpeech = document.getElementById('btnTriggerAiSpeechTest');
    if (btnAiSpeech) {
      btnAiSpeech.addEventListener('click', () => {
        this.triggerAiSpeechTest();
      });
    }

    // Settings Test Button
    const btnTestHexapod = document.getElementById('btnTestHexapodSpeech');
    if (btnTestHexapod) {
      btnTestHexapod.addEventListener('click', () => {
        this.poke();
      });
    }

    // Click / Poke on Hexapod Avatar
    const avatar = document.getElementById('hexapodAvatar');
    if (avatar) {
      avatar.addEventListener('click', (e) => {
        if (e.target.closest('.hexapod-dock-controls')) return;
        this.poke();
      });
    }

    // Close Speech Bubble Button
    const btnCloseSpeech = document.getElementById('btnCloseSpeech');
    if (btnCloseSpeech) {
      btnCloseSpeech.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideSpeechBubble();
      });
    }

    // Floating Mute Button
    const btnMute = document.getElementById('btnHexMute');
    if (btnMute) {
      btnMute.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleVoice();
      });
    }

    // Floating Minimize Button
    const btnMin = document.getElementById('btnHexMinimize');
    if (btnMin) {
      btnMin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      });
    }
  }

  // -------------------------------------------------------------------------
  // 3. Web Audio API Analyser & Real-Time Lip-Sync Visualizer
  // -------------------------------------------------------------------------
  initAudioAnalyser() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (!this.analyser) {
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.6;
        this.analyserDataArray = new Uint8Array(this.analyser.frequencyBinCount);
      }
      this.startAnalyserLoop();
    } catch (e) {}
  }

  startAnalyserLoop() {
    const updateLoop = () => {
      if (this.analyser && this.speechSyncEnabled) {
        this.analyser.getByteFrequencyData(this.analyserDataArray);
        
        // Calculate average RMS amplitude across frequency spectrum
        let sum = 0;
        for (let i = 0; i < this.analyserDataArray.length; i++) {
          sum += this.analyserDataArray[i];
        }
        const avg = sum / this.analyserDataArray.length;
        const normalized = avg / 255.0; // 0.0 to 1.0
        this.audioLevel = normalized;

        // If audio is actively playing through Web Audio API
        if (normalized > 0.035) {
          this.setMouthState(true);
          this.updateEqualizerBars(this.analyserDataArray);
          this.updateStreamLevelMeter(normalized);
        } else if (!this.wsConnected) {
          // If not overridden by Python WebSocket stream, close mouth
          if (this.mouthState && !this.isTalking) {
            this.setMouthState(false);
            this.resetEqualizerBars();
            this.updateStreamLevelMeter(0);
          }
        }
      }
      this.analyserAnimFrame = requestAnimationFrame(updateLoop);
    };
    this.analyserAnimFrame = requestAnimationFrame(updateLoop);
  }

  updateEqualizerBars(freqData) {
    if (!freqData || freqData.length < 5) return;
    const bars = [
      document.getElementById('mBar1'),
      document.getElementById('mBar2'),
      document.getElementById('mBar3'),
      document.getElementById('mBar4'),
      document.getElementById('mBar5')
    ];

    const step = Math.floor(freqData.length / 5);
    bars.forEach((bar, idx) => {
      if (bar) {
        const val = (freqData[idx * step] || 0) / 255.0;
        const halfHeight = Math.max(1, Math.min(6, val * 6.5));
        bar.setAttribute('y1', (127 - halfHeight).toFixed(1));
        bar.setAttribute('y2', (127 + halfHeight).toFixed(1));
      }
    });
  }

  resetEqualizerBars() {
    const bars = [
      document.getElementById('mBar1'),
      document.getElementById('mBar2'),
      document.getElementById('mBar3'),
      document.getElementById('mBar4'),
      document.getElementById('mBar5')
    ];
    bars.forEach(bar => {
      if (bar) {
        bar.setAttribute('y1', '127');
        bar.setAttribute('y2', '127');
      }
    });
  }

  updateStreamLevelMeter(level) {
    const bar = document.getElementById('audioStreamLevelBar');
    const text = document.getElementById('audioStreamLevelText');
    const pct = Math.round(Math.min(100, level * 100));
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.innerText = `${pct}%`;
  }

  // -------------------------------------------------------------------------
  // 4. Natural Eye Blinking Engine (Occasional Blinks every 2.8 - 5.5s)
  // -------------------------------------------------------------------------
  startEyeBlinkingLoop() {
    const scheduleNextBlink = () => {
      if (this.nextBlinkTimer) clearTimeout(this.nextBlinkTimer);
      // Random interval between 2800ms and 5500ms
      const interval = 2800 + Math.random() * 2700;
      this.nextBlinkTimer = setTimeout(() => {
        this.triggerEyeBlink(() => {
          scheduleNextBlink();
        });
      }, interval);
    };
    scheduleNextBlink();
  }

  triggerEyeBlink(callback) {
    if (!this.enabled) {
      if (callback) callback();
      return;
    }

    // Set Eyes to OFF/BLINKING
    this.setEyesState(false);

    // After 140ms, restore eyes to ILLUMINATED
    setTimeout(() => {
      this.setEyesState(true);
      if (callback) callback();
    }, 140);
  }

  setEyesState(illuminated) {
    this.eyesState = illuminated;
    const widget = document.getElementById('hexapodWidget');
    const visorEye = document.getElementById('visorEye');
    const badge = document.getElementById('badgeHexEyesStatus');

    if (illuminated) {
      if (widget) widget.classList.remove('eye-blink');
      if (visorEye) visorEye.classList.remove('blink-closed');
      if (badge) {
        badge.className = 'float-state-pill val-cyan';
        badge.innerText = 'ILLUMINATED';
      }
    } else {
      if (widget) widget.classList.add('eye-blink');
      if (visorEye) visorEye.classList.add('blink-closed');
      if (badge) {
        badge.className = 'float-state-pill val-amber';
        badge.innerText = 'BLINKING';
      }
    }

    // Notify hardware / BLE
    if (this.onHardwareOutputChange) {
      this.onHardwareOutputChange('eyes', illuminated);
    }
  }

  setMouthState(open) {
    if (this.mouthState === open) return;
    this.mouthState = open;

    const widget = document.getElementById('hexapodWidget');
    const mouth = document.getElementById('hexMouth');
    const badge = document.getElementById('badgeHexMouthStatus');

    if (open) {
      if (widget) widget.classList.add('mouth-open');
      if (mouth) mouth.classList.add('active');
      if (badge) {
        badge.className = 'float-state-pill val-green';
        badge.innerText = 'OPEN (ACTIVE)';
      }
    } else {
      if (widget) widget.classList.remove('mouth-open');
      if (mouth) mouth.classList.remove('active');
      if (badge) {
        badge.className = 'float-state-pill val-grey';
        badge.innerText = 'CLOSED';
      }
      this.resetEqualizerBars();
    }

    // Notify hardware / BLE
    if (this.onHardwareOutputChange) {
      this.onHardwareOutputChange('mouth', open);
    }
  }

  // -------------------------------------------------------------------------
  // 5. Python Audio Stream Bridge (WebSocket Client)
  // -------------------------------------------------------------------------
  connectAudioStream(url = 'ws://localhost:8765') {
    this.audioStreamUrl = url;
    localStorage.setItem('hexapod_audio_ws_url', url);

    const badge = document.getElementById('badgeAudioStreamStatus');
    const btn = document.getElementById('btnToggleAudioStream');
    if (badge) {
      badge.className = 'float-state-pill val-amber';
      badge.innerText = 'CONNECTING...';
    }

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.wsConnected = true;
        if (badge) {
          badge.className = 'float-state-pill val-green';
          badge.innerText = 'STREAMING ONLINE';
        }
        if (btn) {
          btn.innerText = 'Disconnect Stream';
          btn.className = 'btn-action-small active-red';
        }
        this.speak("Connected to AI Python audio stream bridge.", { mood: 'happy', priority: true });
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'lip_sync' && this.speechSyncEnabled) {
              this.setMouthState(data.mouth);
              if (data.eyes !== undefined && !data.eyes) {
                this.setEyesState(false);
                setTimeout(() => this.setEyesState(true), 140);
              }
              this.updateStreamLevelMeter(data.rms || 0.0);
              if (data.mouth) {
                // Simulate equalizer activity from RMS
                const fakeFreq = new Uint8Array([
                  Math.min(255, (data.rms || 0.5) * 300),
                  Math.min(255, (data.rms || 0.6) * 320),
                  Math.min(255, (data.rms || 0.7) * 360),
                  Math.min(255, (data.rms || 0.5) * 280),
                  Math.min(255, (data.rms || 0.4) * 250)
                ]);
                this.updateEqualizerBars(fakeFreq);
              }
            }
          } catch (e) {}
        } else if (event.data instanceof ArrayBuffer) {
          // Play binary PCM chunk through Web Audio API
          this.playAudioChunk(event.data);
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        if (badge) {
          badge.className = 'float-state-pill val-grey';
          badge.innerText = 'DISCONNECTED';
        }
        if (btn) {
          btn.innerText = 'Connect Audio Stream';
          btn.className = 'btn-action-small';
        }
        this.setMouthState(false);
      };

      this.ws.onerror = () => {
        this.disconnectAudioStream();
      };
    } catch (e) {
      if (badge) {
        badge.className = 'float-state-pill val-red';
        badge.innerText = 'ERROR / OFFLINE';
      }
    }
  }

  disconnectAudioStream() {
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }
    this.wsConnected = false;
    const badge = document.getElementById('badgeAudioStreamStatus');
    const btn = document.getElementById('btnToggleAudioStream');
    if (badge) {
      badge.className = 'float-state-pill val-grey';
      badge.innerText = 'DISCONNECTED';
    }
    if (btn) {
      btn.innerText = 'Connect Audio Stream';
      btn.className = 'btn-action-small';
    }
    this.setMouthState(false);
  }

  playAudioChunk(arrayBuffer) {
    if (!this.audioCtx) this.initAudioAnalyser();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    // Decode 16-bit PCM mono @ 16kHz
    try {
      const pcm16 = new Int16Array(arrayBuffer);
      const audioBuffer = this.audioCtx.createBuffer(1, pcm16.length, 16000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
      }
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      } else {
        source.connect(this.audioCtx.destination);
      }
      source.start();
    } catch (e) {}
  }

  triggerAiSpeechTest() {
    if (this.wsConnected && this.ws) {
      this.ws.send(JSON.stringify({
        action: "speak",
        text: "Tweed Boulevard holding tank system online. Hexapod mouth and eye synchronization verified."
      }));
    } else {
      // Connect to Python server or run local fallback TTS
      this.speak("Tweed Boulevard water system nominal. Physical mouth output and ocular LED eyes synchronized.", { priority: true });
    }
  }

  // -------------------------------------------------------------------------
  // 6. State & Toggle Controls
  // -------------------------------------------------------------------------
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('hexapod_enabled', this.enabled ? 'true' : 'false');
    this.updateUIState();
    
    if (this.enabled) {
      this.speak("Hexapod assistant enabled! Systems fully operational.", { mood: 'happy', priority: true });
    } else {
      this.stopSpeaking();
      this.hideSpeechBubble();
      this.setMouthState(false);
    }
  }

  toggleEnabled() {
    this.setEnabled(!this.enabled);
  }

  setSpeechSyncEnabled(enabled) {
    this.speechSyncEnabled = enabled;
    localStorage.setItem('hexapod_speech_sync', this.speechSyncEnabled ? 'true' : 'false');
    this.updateUIState();

    // Notify hardware / BLE
    if (this.onHardwareOutputChange) {
      this.onHardwareOutputChange('speechSync', enabled);
    }

    if (this.speechSyncEnabled) {
      this.speak("Speech audio synchronization enabled. Mouth and eyes synced.", { mood: 'happy', priority: true });
    } else {
      this.setMouthState(false);
    }
  }

  setVoiceEnabled(voiceEnabled) {
    this.voiceEnabled = voiceEnabled;
    localStorage.setItem('hexapod_voice', this.voiceEnabled ? 'true' : 'false');
    this.updateUIState();

    if (this.voiceEnabled && this.enabled) {
      this.speak("Audio voice synthesis active.", { mood: 'happy', priority: true });
    }
  }

  toggleVoice() {
    this.setVoiceEnabled(!this.voiceEnabled);
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    localStorage.setItem('hexapod_minimized', this.isMinimized ? 'true' : 'false');
    const widget = document.getElementById('hexapodWidget');
    if (widget) {
      widget.classList.toggle('minimized', this.isMinimized);
    }
    const btnMin = document.getElementById('btnHexMinimize');
    if (btnMin) {
      btnMin.innerText = this.isMinimized ? '🔼' : '🔽';
      btnMin.title = this.isMinimized ? 'Expand Hexapod' : 'Minimize Hexapod';
    }
  }

  updateUIState() {
    // 1. Update Widget Container
    const widget = document.getElementById('hexapodWidget');
    if (widget) {
      if (this.enabled) {
        widget.classList.add('active');
        widget.classList.remove('disabled');
      } else {
        widget.classList.remove('active');
        widget.classList.add('disabled');
      }
    }

    // 2. Update Header Switch Button
    const btnHeaderToggle = document.getElementById('btnHexapodToggle');
    if (btnHeaderToggle) {
      if (this.enabled) {
        btnHeaderToggle.className = 'btn-header-hexapod active';
        btnHeaderToggle.innerHTML = `
          <span class="hex-icon">🕷️</span>
          <span class="hex-label">Hexapod: ON</span>
          <span class="hex-dot on"></span>
        `;
      } else {
        btnHeaderToggle.className = 'btn-header-hexapod off';
        btnHeaderToggle.innerHTML = `
          <span class="hex-icon">🕷️</span>
          <span class="hex-label">Hexapod: OFF</span>
          <span class="hex-dot off"></span>
        `;
      }
    }

    // 3. Update Settings Switches
    const switchAnim = document.getElementById('switchHexapodAnim');
    if (switchAnim) switchAnim.checked = this.enabled;

    const switchSpeechSync = document.getElementById('switchHexapodSpeechSync');
    if (switchSpeechSync) switchSpeechSync.checked = this.speechSyncEnabled;

    const switchVoice = document.getElementById('switchHexapodVoice');
    if (switchVoice) switchVoice.checked = this.voiceEnabled;

    // 4. Update Dock Mute Button
    const btnMute = document.getElementById('btnHexMute');
    if (btnMute) {
      btnMute.innerText = this.voiceEnabled ? '🔊' : '🔇';
      btnMute.title = this.voiceEnabled ? 'Mute voice audio' : 'Unmute voice audio';
    }
  }

  // -------------------------------------------------------------------------
  // 7. Talking Animations & Robotic Voice Synthesis
  // -------------------------------------------------------------------------
  speak(text, options = {}) {
    if (!this.enabled) return;

    const {
      mood = 'normal',        // 'normal' | 'alert' | 'pumping' | 'freeze' | 'happy'
      durationMs = 5000,
      priority = false
    } = options;

    const now = Date.now();
    if (!priority && text === this.lastSpokenText && (now - this.lastSpokenTime < 3000)) {
      return;
    }
    this.lastSpokenText = text;
    this.lastSpokenTime = now;

    // 1. Show Speech Bubble
    const bubble = document.getElementById('hexapodBubble');
    const speechEl = document.getElementById('hexapodSpeechText');
    const widget = document.getElementById('hexapodWidget');

    if (bubble && speechEl) {
      bubble.classList.add('visible');
      speechEl.innerText = text;
    }

    if (widget) {
      widget.classList.remove('mood-alert', 'mood-pumping', 'mood-freeze', 'mood-happy');
      if (mood !== 'normal') {
        widget.classList.add(`mood-${mood}`);
      }
      widget.classList.add('is-talking');
    }

    this.isTalking = true;

    // 2. Synthesize Robotic Voice Audio
    if (this.voiceEnabled) {
      this.playChirpSound(mood);
      this.speakTTS(text);
    }

    // 3. Fallback reset after duration
    if (this.talkTimeout) clearTimeout(this.talkTimeout);
    this.talkTimeout = setTimeout(() => {
      this.stopTalkingAnimation();
    }, Math.max(durationMs, text.length * 75));
  }

  stopTalkingAnimation() {
    this.isTalking = false;
    const widget = document.getElementById('hexapodWidget');
    if (widget) {
      widget.classList.remove('is-talking');
    }
    if (!this.wsConnected) {
      this.setMouthState(false);
      this.resetEqualizerBars();
    }
  }

  hideSpeechBubble() {
    const bubble = document.getElementById('hexapodBubble');
    if (bubble) bubble.classList.remove('visible');
    this.stopTalkingAnimation();
    if (this.speechSynth) {
      this.speechSynth.cancel();
    }
  }

  stopSpeaking() {
    this.stopTalkingAnimation();
    if (this.speechSynth) {
      try { this.speechSynth.cancel(); } catch(e) {}
    }
  }

  playChirpSound(mood) {
    try {
      if (!this.audioCtx) this.initAudioAnalyser();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      let startFreq = 440;
      let endFreq = 880;

      if (mood === 'alert') {
        startFreq = 880;
        endFreq = 1200;
        osc.type = 'square';
      } else if (mood === 'freeze') {
        startFreq = 600;
        endFreq = 300;
      } else if (mood === 'happy' || mood === 'pumping') {
        startFreq = 523;
        endFreq = 1046;
      }

      osc.frequency.setValueAtTime(startFreq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, this.audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.15);

      if (this.analyser) {
        osc.connect(gain);
        gain.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      } else {
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
      }

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  speakTTS(text) {
    if (!this.speechSynth) return;
    try {
      this.speechSynth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.08;
      utterance.pitch = 1.15;

      const voices = this.speechSynth.getVoices();
      const roboticVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Robot')));
      if (roboticVoice) {
        utterance.voice = roboticVoice;
      }

      // Syllable / boundary phoneme lip-sync animation
      utterance.onboundary = () => {
        if (this.speechSyncEnabled) {
          this.setMouthState(true);
          const fakeFreq = new Uint8Array([180, 240, 220, 190, 150]);
          this.updateEqualizerBars(fakeFreq);
          setTimeout(() => {
            if (!this.isTalking) this.setMouthState(false);
          }, 90);
        }
      };

      utterance.onend = () => {
        this.stopTalkingAnimation();
      };
      utterance.onerror = () => {
        this.stopTalkingAnimation();
      };

      this.speechSynth.speak(utterance);
    } catch (e) {}
  }

  // -------------------------------------------------------------------------
  // 8. Interactive Avatar Poke / Tap Reaction
  // -------------------------------------------------------------------------
  poke() {
    if (!this.enabled) {
      this.setEnabled(true);
      return;
    }

    // Play reactive poke animation and quick eye wink
    const avatar = document.getElementById('hexapodAvatar');
    if (avatar) {
      avatar.classList.add('poked');
      setTimeout(() => avatar.classList.remove('poked'), 600);
    }
    this.triggerEyeBlink();

    // Generate comprehensive system status report
    const t = window.latestTelemetry || {};
    let report = "";

    if (t.tankEmpty) {
      report = "Critical alert! Tweed holding tank is empty. Siren active!";
    } else if (t.pumpOvercurrentTrip) {
      report = "Motor overload fault tripped! Booster pump locked out.";
    } else if (t.pumpUndercurrentTrip) {
      report = "Dry run fault detected! Municipal suction prime lost.";
    } else if (t.pumpCurrentFaultPending) {
      report = "Warning! Motor current abnormal. Pre-trip alarm pulsing.";
    } else if (t.pump) {
      report = "Booster pump is running, charging Tweed holding tank uphill.";
    } else if (!t.tankHigh) {
      report = "Holding tank is 100% full. All actuators standby.";
    } else if (t.freezeSensor) {
      report = "Freeze sensor is active (<40°F). Fill line is safely drained.";
    } else {
      report = "All systems nominal. Holding tank secure and automated.";
    }

    this.speak(report, { mood: (t.alarm || t.pumpOvercurrentTrip) ? 'alert' : 'happy', priority: true });
  }

  // -------------------------------------------------------------------------
  // 9. Telemetry Event Observer & System Commentary
  // -------------------------------------------------------------------------
  onTelemetryUpdate(t) {
    if (!t || !this.enabled) return;
    window.latestTelemetry = t;

    // Detect state transitions
    const prev = this.prevState;

    // 1. Tank Empty Critical Alarm
    if (t.tankEmpty && prev.tankEmpty === false) {
      this.speak("EMERGENCY! Holding tank is critically empty! Siren sounding!", { mood: 'alert', priority: true });
    }

    // 2. Motor Overcurrent Trip
    else if (t.pumpOvercurrentTrip && prev.overcurrentTrip === false) {
      this.speak("CRITICAL FAULT! Motor overload trip detected. Booster pump shut off for safety.", { mood: 'alert', priority: true });
    }

    // 3. Dry Run / Loss of Prime Trip
    else if (t.pumpUndercurrentTrip && prev.undercurrentTrip === false) {
      this.speak("WARNING! Dry run cavitation detected. Pump stopped to protect mechanical seals.", { mood: 'alert', priority: true });
    }

    // 4. Overcurrent / Undercurrent 1-minute Warning (Pulsing Alarm)
    else if (t.pumpCurrentFaultPending && prev.pumpCurrentFaultPending === false) {
      this.speak("CAUTION! Abnormal motor load detected. Warning pulse alarm active.", { mood: 'alert', priority: true });
    }

    // 5. Booster Pump Started
    else if (t.pump && prev.pump === false) {
      this.speak("Booster water pump engaged. Pumping municipal water uphill to Tweed Boulevard.", { mood: 'pumping' });
    }

    // 6. Tank High / Full Shutoff (Floating -> Full)
    else if (!t.tankHigh && prev.tankHigh === true) {
      this.speak("Tweed holding tank reached 100% full capacity. Shutting off pump and closing line valve.", { mood: 'happy' });
    }

    // 6B. Tank High Float Dropped Back Down (Not Floating -> Below Full)
    else if (t.tankHigh && prev.tankHigh === false) {
      if (t.freezeSensor) {
        this.speak("Tweed holding tank high level float switch dropped back down. Outside freeze sensor is active below 40 degrees: keeping Line Valve CLOSED and fill pipe DRAINED to prevent freezing until water reaches Low Float.", { mood: 'freeze', priority: true });
      } else {
        this.speak("Tweed holding tank high level float switch dropped back down. Outside temperature is above 40 degrees: opening Line Valve and closing Drain so municipal line pressure can naturally top off the tank without starting the booster pump.", { mood: 'normal' });
      }
    }

    // 7. Tank Low / Fill Demand Started
    else if (t.tankLow && prev.tankLow === false && !t.pump) {
      this.speak("Water level low in Tweed tank. Opening line valve with 5-second priming delay before booster pump start.", { mood: 'normal' });
    }

    // 8. Freeze Hazard Activated (<40°F)
    else if (t.freezeSensor && prev.freezeSensor === false) {
      this.speak("ALERT: Outside freeze hazard detected below 40 degrees! Closing Line Valve and opening Drain to empty the exposed fill pipe to the sump.", { mood: 'freeze', priority: true });
    }

    // 8B. Freeze Hazard Cleared (>=40°F)
    else if (!t.freezeSensor && prev.freezeSensor === true) {
      this.speak("Outside freeze condition cleared: temperature is above 40 degrees. Opening Line Valve and closing Drain to resume natural top-off filling.", { mood: 'happy' });
    }

    // 9. Cooldown Initiated
    else if (t.pumpTimingState === 2 && prev.pumpTimingState !== 2) {
      this.speak("Pump 25-minute duty cycle reached. 2-hour motor cooldown initiated.", { mood: 'normal' });
    }

    // 10. Pump Room Low Temp Alarm (<55°F)
    else if (t.pumpRoomLowTempAlarm && prev.pumpRoomLowTempAlarm === false) {
      this.speak(`CRITICAL ALARM! Pump room temperature dropped to ${(t.temperatureF !== undefined ? t.temperatureF : 50).toFixed(0)} degrees, below the 55 degree safety threshold! Inspect pump house heating immediately!`, { mood: 'alert', priority: true });
    }

    // Save previous state for transition detection
    this.prevState = {
      pump: t.pump,
      lineValve: t.lineValve,
      tankHigh: t.tankHigh,
      tankLow: t.tankLow,
      tankEmpty: t.tankEmpty,
      freezeSensor: t.freezeSensor,
      pumpTimingState: t.pumpTimingState,
      overcurrentTrip: t.pumpOvercurrentTrip,
      undercurrentTrip: t.pumpUndercurrentTrip,
      pumpCurrentFaultPending: t.pumpCurrentFaultPending,
      pumpRoomLowTempAlarm: t.pumpRoomLowTempAlarm,
      alarm: t.alarm
    };
  }
}

// Instantiate global singleton
window.hexapodManager = new HexapodAssistant();
