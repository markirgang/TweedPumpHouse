/**
 * Tweed Boulevard / Route 9W Water System
 * Interactive Animated Pipeline & Holding Tank Schematic (HTML5 Canvas)
 * 
 * Demonstrates:
 * - Fill pipe between Line Valve / Pump in Route 9W Pump Room and Tweed Blvd Tank
 * - Shared Relay (GPIO 2) controlling Line Valve & Fill Pipe Drain Valve
 * - Dynamic Draining Animation when Relay is de-energized (Line Valve Closed / Drain Valve Open)
 * - Freeze Protection & Tank High / Tank Low automated fill rules
 */

class SystemSchematic {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.particles = [];
    this.drainParticles = [];
    this.drainSplashes = [];
    this.tankSplashes = [];
    this.impellerAngle = 0;
    this.wavePhase = 0;
    this.wirePulse = 0;
    
    // Smooth fluid column level in the fill pipe (0.0 = completely dry, 1.0 = completely full)
    this.pipeWaterLevel = 0.0;
    
    // Telemetry cache
    this.state = {
      tankEmpty: false,
      tankLow: false,
      tankHigh: true,
      freezeSensor: false,
      lineValve: false,
      drainValve: true,
      relayPower: false,
      pump: false,
      alarm: false,
      temperatureF: 68.0,
      humidity: 50.0
    };
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.initParticles();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.width = rect.width;
    this.height = rect.height;
  }

  initParticles() {
    // Flow particles going uphill
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        progress: Math.random(),
        speed: 0.005 + Math.random() * 0.004,
        size: 2.5 + Math.random() * 2
      });
    }

    // Draining particles rushing downhill
    this.drainParticles = [];
    for (let i = 0; i < 25; i++) {
      this.drainParticles.push({
        progress: Math.random(),
        speed: 0.012 + Math.random() * 0.008,
        size: 2.0 + Math.random() * 2
      });
    }

    // Drain discharge splashes
    this.drainSplashes = [];
    for (let i = 0; i < 20; i++) {
      this.drainSplashes.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 2.5,
        vy: Math.random() * 2 + 1,
        life: Math.random(),
        size: 1.5 + Math.random() * 1.8
      });
    }

    // Tank inlet drop splashes
    this.tankSplashes = [];
    for (let i = 0; i < 15; i++) {
      this.tankSplashes.push({
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 2.0,
        vy: Math.random() * 1.5 + 1.0,
        life: Math.random(),
        size: 1.5 + Math.random() * 1.5
      });
    }
  }

  updateState(telemetry) {
    this.state = Object.assign(this.state, telemetry);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.wavePhase += 0.04;
    this.wirePulse = (this.wirePulse + 0.06) % (Math.PI * 2);

    // Dynamic pipe fluid level transition:
    // When Relay is energized (Line Valve OPEN / Drain Valve CLOSED), fill pipe hydrates
    if (this.state.lineValve) {
      this.pipeWaterLevel = Math.min(1.0, this.pipeWaterLevel + 0.02);
    } else {
      // When Relay is de-energized (Line Valve CLOSED / Drain Valve OPEN), fill pipe drains
      this.pipeWaterLevel = Math.max(0.0, this.pipeWaterLevel - 0.012);
    }

    // Pump impeller rotation
    if (this.state.pump) {
      this.impellerAngle += 0.20;
    }

    // Render Components
    this.drawTerrainAndPipes();
    this.drawPumpRoom();
    this.drawHoldingTank();
    this.drawWaterFlowParticles();
    this.drawDrainingDischarge();
  }

  drawTerrainAndPipes() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Mountain hill gradient profile (Route 9W at bottom left to Tweed Blvd top right)
    ctx.save();
    // Hill fill polygon
    const hillGrad = ctx.createLinearGradient(0, h, w, 0);
    hillGrad.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
    hillGrad.addColorStop(1, 'rgba(30, 41, 59, 0.4)');
    ctx.fillStyle = hillGrad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - 50);
    ctx.lineTo(w * 0.28, h - 85);
    ctx.lineTo(w * 0.72, 175);
    ctx.lineTo(w, 140);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Elevation dash line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(30, h - 45);
    ctx.lineTo(w * 0.32, h - 90);
    ctx.lineTo(w * 0.75, 170);
    ctx.lineTo(w - 30, 135);
    ctx.stroke();
    ctx.restore();

    // Elevation Elevation Tags
    ctx.save();
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('ROUTE 9W BASE (ELEVATION ~120 FT)', 50, h - 18);
    ctx.fillText('TWEED BLVD RIDGE (ELEVATION ~580 FT)', w - 240, 25);
    ctx.restore();

    // -------------------------------------------------------------
    // Define Pipe Path Coordinates
    // -------------------------------------------------------------
    const p1 = { x: 50, y: h - 100 };       // Municipal supply entry
    const p2 = { x: 125, y: h - 100 };      // Line Valve
    const pTee = { x: 175, y: h - 100 };    // Manifold Tee (Drain Valve branch)
    const p3 = { x: 250, y: h - 100 };      // Water Pump
    const p4 = { x: 330, y: h - 100 };      // Exit Pump Room
    const p5 = { x: w - 200, y: 160 };      // Base of Tweed Blvd Holding Tank
    const p6 = { x: w - 200, y: 70 };       // Riser up side of tank
    const p7 = { x: w - 165, y: 70 };       // Tank top inlet drop

    this.municipalPath = [p1, p2];
    this.fillPipePath = [p2, pTee, p3, p4, p5, p6, p7];
    this.drainBranchPath = [pTee, { x: 175, y: h - 60 }, { x: 175, y: h - 35 }];

    // 1. Draw Municipal Supply Pipe (Always connected to 9W pressure)
    ctx.save();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    // Municipal live water inside pipe
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.restore();

    // 2. Draw Fill Pipe Outer Casing (Exposed Uphill Pipeline)
    ctx.save();
    const isFreezeAlert = this.state.freezeSensor;
    ctx.strokeStyle = isFreezeAlert ? '#2563eb' : '#1e293b';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p2.x, p2.y);
    for (let i = 1; i < this.fillPipePath.length; i++) {
      ctx.lineTo(this.fillPipePath[i].x, this.fillPipePath[i].y);
    }
    ctx.stroke();

    // 3. Draw Drain Branch Pipe Casing
    ctx.beginPath();
    ctx.moveTo(pTee.x, pTee.y);
    ctx.lineTo(175, h - 35);
    ctx.stroke();
    ctx.restore();

    // 4. Draw Water Column Inside Fill Pipe Based on pipeWaterLevel
    if (this.pipeWaterLevel > 0.001) {
      this.drawFillPipeWaterColumn();
    }

    // 5. Pipe Status Overlays & Freeze Warnings
    ctx.save();
    const midX = (p4.x + p5.x) / 2 - 40;
    const midY = (p4.y + p5.y) / 2 - 18;

    if (this.state.lineValve && this.pipeWaterLevel > 0.2) {
      // Flowing
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px sans-serif';
      const modeText = this.state.pump ? '▲ FILL PIPE: WATER FLOWING UPHILL (PUMP BOOST)' : '▲ FILL PIPE: WATER FLOWING UPHILL (MUNICIPAL PRESSURE)';
      ctx.fillText(modeText, midX - 60, midY);
    } else if (!this.state.lineValve && this.pipeWaterLevel > 0.01) {
      // Draining
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('▼ FILL PIPE: DRAINING DOWN TO PUMP HOUSE DRAIN VALVE', midX - 80, midY);
    } else if (isFreezeAlert) {
      // Freeze safe / drained
      ctx.fillStyle = '#93c5fd';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('❄ FREEZE SAFE: FILL PIPE DRAINED & ISOLATED (<40°F)', midX - 80, midY);
    } else if (!this.state.tankHigh) {
      // Full / Drained
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('✔ TANK FULL: FILL PIPE DRAINED & ISOLATED', midX - 50, midY);
    } else {
      // Standby / Drained
      ctx.fillStyle = '#64748b';
      ctx.font = '9px sans-serif';
      ctx.fillText('FILL PIPE: STANDBY (DRAINED)', midX - 20, midY);
    }
    ctx.restore();
  }

  drawFillPipeWaterColumn() {
    const ctx = this.ctx;
    const path = this.fillPipePath;
    const level = this.pipeWaterLevel; // 0.0 to 1.0

    // Compute total length of fill pipe path
    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i < path.length - 1; i++) {
      const dx = path[i+1].x - path[i].x;
      const dy = path[i+1].y - path[i].y;
      const len = Math.hypot(dx, dy);
      segLens.push(len);
      totalLen += len;
    }

    const waterTargetLen = totalLen * level;
    let accumulated = 0;

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);

    for (let i = 0; i < segLens.length; i++) {
      const segLen = segLens[i];
      if (accumulated + segLen <= waterTargetLen) {
        ctx.lineTo(path[i+1].x, path[i+1].y);
        accumulated += segLen;
      } else {
        const remain = waterTargetLen - accumulated;
        const ratio = remain / segLen;
        const targetX = path[i].x + (path[i+1].x - path[i].x) * ratio;
        const targetY = path[i].y + (path[i+1].y - path[i].y) * ratio;
        ctx.lineTo(targetX, targetY);
        break;
      }
    }
    ctx.stroke();

    // If draining, also draw water in the drain vertical pipe
    if (!this.state.lineValve && this.pipeWaterLevel > 0.01) {
      ctx.beginPath();
      ctx.moveTo(175, this.height - 100);
      ctx.lineTo(175, this.height - 35);
      ctx.stroke();
    }

    ctx.restore();
  }

  drawPumpRoom() {
    const ctx = this.ctx;
    const h = this.height;

    // Pump Room Enclosure Box
    const rx = 45, ry = h - 195, rw = 300, rh = 175;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(rx, ry, rw, rh, 12);
    ctx.fill();
    ctx.stroke();

    // Room Label
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('PUMP ROOM (ROUTE 9W ELEVATION)', rx + 14, ry + 18);

    // Municipal Supply Tag
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('MUNICIPAL 9W', rx - 5, h - 114);

    // =========================================================================
    // 1. SHARED RELAY MODULE (GPIO 2)
    // =========================================================================
    const relayX = rx + 80, relayY = ry + 28, relayW = 100, relayH = 26;
    const relayOn = this.state.lineValve; // Relay powered when Line Valve is on

    ctx.fillStyle = relayOn ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.8)';
    ctx.strokeStyle = relayOn ? '#10b981' : '#475569';
    ctx.lineWidth = 1.5;
    if (relayOn) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 8;
    }
    ctx.roundRect(relayX, relayY, relayW, relayH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Relay Status LED
    ctx.fillStyle = relayOn ? '#34d399' : '#64748b';
    ctx.beginPath();
    ctx.arc(relayX + 12, relayY + relayH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // Relay Text
    ctx.fillStyle = relayOn ? '#a7f3d0' : '#94a3b8';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillText(relayOn ? 'RELAY: POWER ON' : 'RELAY: POWER OFF', relayX + 22, relayY + 16);

    // Relay GPIO 2 Subtitle
    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px sans-serif';
    ctx.fillText('GPIO 2 (SHARED)', relayX + 22, relayY + 24);

    // -------------------------------------------------------------
    // Relay Wiring Traces to Line Valve & Drain Valve
    // -------------------------------------------------------------
    ctx.save();
    ctx.strokeStyle = relayOn ? '#fbbf24' : '#475569';
    ctx.lineWidth = 1.5;
    if (relayOn) {
      ctx.setLineDash([4, 3]);
      ctx.lineDashOffset = -this.wirePulse * 4;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
    }

    // Wire 1 -> Line Valve Solenoid
    ctx.beginPath();
    ctx.moveTo(relayX + 25, relayY + relayH);
    ctx.lineTo(125, h - 122);
    ctx.stroke();

    // Wire 2 -> Drain Valve Solenoid
    ctx.beginPath();
    ctx.moveTo(relayX + 75, relayY + relayH);
    ctx.lineTo(relayX + 75, h - 70);
    ctx.lineTo(175 + 10, h - 60);
    ctx.stroke();
    ctx.restore();

    // =========================================================================
    // 2. LINE VALVE (Normally Closed Solenoid, Powered = OPEN)
    // =========================================================================
    const vx = 125, vy = h - 100;
    const valveOpen = this.state.lineValve;

    ctx.save();
    ctx.fillStyle = valveOpen ? '#10b981' : '#64748b';
    ctx.strokeStyle = valveOpen ? '#34d399' : '#94a3b8';
    ctx.lineWidth = 2;

    // Valve Bowtie
    ctx.beginPath();
    ctx.moveTo(vx - 12, vy - 12);
    ctx.lineTo(vx + 12, vy + 12);
    ctx.lineTo(vx + 12, vy - 12);
    ctx.lineTo(vx - 12, vy + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solenoid Coil on top of Line Valve
    ctx.fillStyle = valveOpen ? '#059669' : '#334155';
    ctx.fillRect(vx - 6, vy - 22, 12, 10);
    ctx.strokeStyle = valveOpen ? '#34d399' : '#64748b';
    ctx.strokeRect(vx - 6, vy - 22, 12, 10);
    ctx.restore();

    // Line Valve Text Label
    ctx.fillStyle = valveOpen ? '#34d399' : '#94a3b8';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillText(valveOpen ? 'LINE VALVE: OPEN' : 'LINE VALVE: CLOSED', vx - 36, vy + 24);
    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px sans-serif';
    ctx.fillText(valveOpen ? '(ENERGIZED)' : '(NO POWER)', vx - 20, vy + 33);

    // =========================================================================
    // 3. FILL PIPE DRAIN VALVE (Normally Open, Powered = CLOSED)
    // =========================================================================
    const dvx = 175, dvy = h - 60;
    const drainOpen = !this.state.lineValve; // Drain valve is open when relay is unpowered

    ctx.save();
    ctx.fillStyle = drainOpen ? '#f59e0b' : '#10b981';
    ctx.strokeStyle = drainOpen ? '#fbbf24' : '#34d399';
    ctx.lineWidth = 1.8;

    // Drain Valve Bowtie
    ctx.beginPath();
    ctx.moveTo(dvx - 10, dvy - 10);
    ctx.lineTo(dvx + 10, dvy + 10);
    ctx.lineTo(dvx + 10, dvy - 10);
    ctx.lineTo(dvx - 10, dvy + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solenoid Coil for Drain Valve
    ctx.fillStyle = drainOpen ? '#78350f' : '#059669';
    ctx.fillRect(dvx + 10, dvy - 5, 8, 10);
    ctx.strokeStyle = drainOpen ? '#fbbf24' : '#34d399';
    ctx.strokeRect(dvx + 10, dvy - 5, 8, 10);
    ctx.restore();

    // Drain Discharge Spout & Floor Sump
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(dvx, dvy + 10);
    ctx.lineTo(dvx, h - 35);
    ctx.stroke();

    // Floor Sump Basin
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.strokeStyle = drainOpen && this.pipeWaterLevel > 0.01 ? '#38bdf8' : '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(dvx - 22, h - 35, 44, 14, 4);
    ctx.fill();
    ctx.stroke();

    // Drain Text Label
    ctx.fillStyle = drainOpen ? '#fbbf24' : '#34d399';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(drainOpen ? 'DRAIN: OPEN' : 'DRAIN: CLOSED', dvx - 52, dvy + 2);
    ctx.fillStyle = drainOpen ? '#fde68a' : '#64748b';
    ctx.font = '7px sans-serif';
    ctx.fillText(drainOpen ? '(DRAINING PIPE)' : '(SEALED)', dvx - 52, dvy + 10);

    ctx.fillStyle = '#64748b';
    ctx.font = '7.5px sans-serif';
    ctx.fillText('DRAIN SUMP', dvx - 18, h - 24);
    ctx.restore();

    // =========================================================================
    // 4. WATER PUMP VISUAL
    // =========================================================================
    const px = 255, py = h - 100;
    const pumpOn = this.state.pump;
    const hasFault = (this.state.pumpOvercurrentTrip || this.state.pumpUndercurrentTrip);
    
    ctx.save();
    if (this.state.pumpOvercurrentTrip) {
      ctx.fillStyle = '#991b1b';
      ctx.strokeStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 12;
    } else if (this.state.pumpUndercurrentTrip) {
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
    } else {
      ctx.fillStyle = pumpOn ? '#0284c7' : '#1e293b';
      ctx.strokeStyle = pumpOn ? '#00f0ff' : '#475569';
      if (pumpOn) {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
      }
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Spinning Impeller Blades
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.impellerAngle);
    ctx.strokeStyle = pumpOn ? '#fff' : '#64748b';
    ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(13, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Pump Status Label
    ctx.save();
    ctx.font = 'bold 8.5px sans-serif';
    if (this.state.pumpOvercurrentTrip) {
      ctx.fillStyle = '#f87171';
      ctx.fillText('PUMP: OVERLOAD TRIP!', px - 36, py + 26);
    } else if (this.state.pumpUndercurrentTrip) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('PUMP: DRY RUN TRIP!', px - 34, py + 26);
    } else if (pumpOn) {
      ctx.fillStyle = '#38bdf8';
      const elapsed = this.state.pumpRunElapsedSec || 0;
      const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const ss = (elapsed % 60).toString().padStart(2, '0');
      ctx.fillText(`PUMP ON: ${mm}:${ss}`, px - 26, py + 26);
    } else if (this.state.pumpTimingState === 2) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('PUMP: TIMED OUT', px - 28, py + 26);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('PUMP: OFF', px - 18, py + 26);
    }
    ctx.restore();

    // =========================================================================
    // FCS521-SD-10V AC Current Transmitter (0-50A via ADS1115 AIN2)
    // =========================================================================
    const csx = px, csy = py - 32;
    const currAmps = (this.state.pumpCurrentAmps !== undefined) ? Number(this.state.pumpCurrentAmps) : 0.0;
    const isOverload = this.state.pumpOvercurrentTrip || (currAmps > (this.state.overcurrentThresholdAmps || 18.0));
    const isDryRun = this.state.pumpUndercurrentTrip || (pumpOn && currAmps < (this.state.undercurrentThresholdAmps || 4.5));

    ctx.save();
    // Conduit wire connecting from pump to sensor
    ctx.strokeStyle = pumpOn ? '#f59e0b' : '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px, csy + 12);
    ctx.stroke();

    // CT Toroid Doughnut Ring Core (FCS521)
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = isOverload ? '#ef4444' : (isDryRun ? '#f59e0b' : (pumpOn ? '#10b981' : '#475569'));
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(csx, csy + 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // FCS521 Transmitter Electronics Housing & Badge
    let ctBg = 'rgba(15, 23, 42, 0.92)';
    let ctBorder = 'rgba(56, 189, 248, 0.5)';
    let ctText = '#38bdf8';

    if (isOverload) {
      ctBg = 'rgba(239, 68, 68, 0.95)';
      ctBorder = '#ef4444';
      ctText = '#ffffff';
    } else if (isDryRun) {
      ctBg = 'rgba(245, 158, 11, 0.95)';
      ctBorder = '#fbbf24';
      ctText = '#000000';
    } else if (pumpOn) {
      ctBg = 'rgba(16, 185, 129, 0.90)';
      ctBorder = '#34d399';
      ctText = '#ffffff';
    }

    ctx.fillStyle = ctBg;
    ctx.strokeStyle = ctBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(csx - 30, csy - 18, 60, 20, 4);
    ctx.fill();
    ctx.stroke();

    // Badge Text
    ctx.fillStyle = ctText;
    ctx.font = 'bold 8.5px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${currAmps.toFixed(1)} A`, csx, csy - 7);

    ctx.fillStyle = isOverload ? '#fecaca' : (isDryRun ? '#451a03' : (pumpOn ? '#d1fae5' : '#94a3b8'));
    ctx.font = 'bold 6.5px sans-serif';
    ctx.fillText(isOverload ? 'OVERLOAD' : (isDryRun ? 'DRY CAVIT' : (pumpOn ? 'FCS521 LOAD' : 'FCS521 0-50A')), csx, csy - 1);
    ctx.textAlign = 'start';
    ctx.restore();

    // =========================================================================
    // 5. EXTERNAL FREEZE SENSOR
    // =========================================================================
    const fsx = rx + rw - 22, fsy = ry + 26;
    ctx.save();
    ctx.fillStyle = this.state.freezeSensor ? '#ef4444' : '#10b981';
    ctx.beginPath();
    ctx.arc(fsx, fsy, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.state.freezeSensor ? '#f87171' : '#a7f3d0';
    ctx.font = 'bold 8.5px sans-serif';
    ctx.fillText(this.state.freezeSensor ? 'FREEZE <40°F' : 'OUTSIDE >40°F', fsx - 62, fsy + 3);
    ctx.restore();

    // =========================================================================
    // 6. MUNICIPAL & FILL PIPE PRESSURE TRANSDUCERS (ADS1115 I2C ADC)
    // =========================================================================
    // Transducer 1: Municipal Water Pressure (AIN0, 0-100 PSI) at x = 85
    const mtx = 85, mty = h - 100;
    const muniPsi = (this.state.pressureMunicipalPsi !== undefined) ? this.state.pressureMunicipalPsi : 58.0;
    const isMuniTrip = this.state.municipalPressureTrip || false;
    const isMuniPending = this.state.municipalPressureFaultPending || false;
    const isMuniLow = (this.state.municipalLowPressureAlarm || (muniPsi < 20.0 && muniPsi > 0.5) || isMuniTrip || isMuniPending);

    ctx.save();
    // Pipe Thread Tap
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mtx, mty - 6);
    ctx.lineTo(mtx, mty - 16);
    ctx.stroke();

    // Sensor Body (Hex/Circular Housing)
    ctx.fillStyle = (isMuniTrip || isMuniPending) ? '#991b1b' : (isMuniLow ? '#78350f' : '#0f172a');
    ctx.strokeStyle = (isMuniTrip || isMuniPending) ? '#ef4444' : (isMuniLow ? '#f59e0b' : '#38bdf8');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mtx, mty - 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sensor PSI Badge
    ctx.fillStyle = (isMuniTrip || isMuniPending) ? 'rgba(239, 68, 68, 0.95)' : (isMuniLow ? 'rgba(245, 158, 11, 0.9)' : 'rgba(15, 23, 42, 0.9)');
    ctx.strokeStyle = (isMuniTrip || isMuniPending) ? '#ef4444' : (isMuniLow ? '#fbbf24' : 'rgba(56, 189, 248, 0.6)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mtx - 28, mty - 44, 56, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = (isMuniTrip || isMuniPending || isMuniLow) ? '#fff' : '#38bdf8';
    ctx.font = 'bold 8px monospace';
    if (isMuniTrip) {
      ctx.fillText(`OUTAGE!`, mtx - 18, mty - 33);
    } else if (isMuniPending) {
      const rem = this.state.municipalPressureFaultRemainingSec || 30;
      ctx.fillText(`CUT ${rem}s`, mtx - 16, mty - 33);
    } else {
      ctx.fillText(`${muniPsi.toFixed(1)} PSI`, mtx - 18, mty - 33);
    }

    ctx.fillStyle = (isMuniTrip || isMuniPending) ? '#f87171' : '#64748b';
    ctx.font = '6.5px sans-serif';
    ctx.fillText('9W MUNI', mtx - 13, mty - 48);
    ctx.restore();

    // Transducer 2: Fill Pipe Discharge Pressure (AIN1, 0-200 PSI) at x = 295
    const ftx = 298, fty = h - 100;
    const fillPsi = (this.state.pressureFillPipePsi !== undefined) ? this.state.pressureFillPipePsi : 0.0;
    const isFillHigh = (this.state.fillPipeHighPressureAlarm || fillPsi > 180.0);
    const isPumpingActive = (this.state.pump || this.state.pumpTimingState === 1);

    ctx.save();
    // Pipe Thread Tap
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ftx, fty - 6);
    ctx.lineTo(ftx, fty - 16);
    ctx.stroke();

    // Sensor Body
    ctx.fillStyle = isFillHigh ? '#991b1b' : (isPumpingActive ? '#0284c7' : '#0f172a');
    ctx.strokeStyle = isFillHigh ? '#ef4444' : (isPumpingActive ? '#00f0ff' : '#10b981');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ftx, fty - 22, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sensor PSI Badge
    ctx.fillStyle = isFillHigh ? 'rgba(239, 68, 68, 0.9)' : 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = isFillHigh ? '#ef4444' : (isPumpingActive ? 'rgba(0, 240, 255, 0.7)' : 'rgba(16, 185, 129, 0.6)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ftx - 26, fty - 44, 52, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isFillHigh ? '#fff' : (isPumpingActive ? '#00f0ff' : '#34d399');
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`${fillPsi.toFixed(1)} PSI`, ftx - 18, fty - 33);

    ctx.fillStyle = '#64748b';
    ctx.font = '6.5px sans-serif';
    ctx.fillText('FILL PIPE', ftx - 14, fty - 48);
    ctx.restore();

    ctx.restore();
  }

  drawHoldingTank() {
    const ctx = this.ctx;
    const w = this.width;

    // Tank dimensions (Top-right of canvas)
    const tx = w - 190, ty = 40, tw = 160, th = 220;

    ctx.save();
    // Tank Frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.roundRect(tx, ty, tw, th, 12);
    ctx.fill();
    ctx.stroke();

    // Tank Roof
    ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
    ctx.beginPath();
    ctx.moveTo(tx - 8, ty);
    ctx.lineTo(tx + tw / 2, ty - 16);
    ctx.lineTo(tx + tw + 8, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Water level calculation based on float switch states
    let waterRatio = 0.2; // default
    if (!this.state.tankHigh) {
      waterRatio = 0.92; // Tank High is floating (FULL)
    } else if (!this.state.tankLow) {
      waterRatio = 0.60; // Normal mid level
    } else if (!this.state.tankEmpty) {
      waterRatio = 0.28; // Low water
    } else {
      waterRatio = 0.08; // Critical empty
    }

    const waterHeight = (th - 20) * waterRatio;
    const waterY = ty + th - 10 - waterHeight;

    // Fluid Animation with wave effect
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx + 4, ty + 4, tw - 8, th - 14);
    ctx.clip(); // Keep water inside tank bounds

    ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(tx + 4, ty + th);
    ctx.lineTo(tx + 4, waterY);
    for (let x = tx + 4; x <= tx + tw - 4; x += 10) {
      const yWave = waterY + Math.sin((x * 0.05) + this.wavePhase) * 3;
      ctx.lineTo(x, yWave);
    }
    ctx.lineTo(tx + tw - 4, ty + th);
    ctx.closePath();
    ctx.fill();

    // Top water surface highlight
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // -------------------------------------------------------------
    // Float Switches Visual Nodes
    // -------------------------------------------------------------
    const floats = [
      { name: 'TANK HIGH', y: ty + 42, floating: !this.state.tankHigh, color: !this.state.tankHigh ? '#10b981' : '#64748b' },
      { name: 'TANK LOW',  y: ty + 115, floating: !this.state.tankLow, color: this.state.tankLow ? '#f59e0b' : '#10b981' },
      { name: 'TANK EMPTY', y: ty + 185, floating: !this.state.tankEmpty, color: this.state.tankEmpty ? '#ef4444' : '#10b981' }
    ];

    floats.forEach(f => {
      // Switch stem
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + tw - 12, f.y);
      ctx.lineTo(tx + tw - 32, f.y);
      ctx.stroke();

      // Float ball
      ctx.fillStyle = f.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const floatY = f.floating ? (f.y - 4) : (f.y + 4);
      ctx.arc(tx + tw - 38, floatY, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = f.color;
      ctx.font = 'bold 8.5px sans-serif';
      ctx.fillText(f.name, tx + 10, f.y + 3);
    });

    // Tank Header Label
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('TWEED BLVD TANK', tx + 24, ty + 18);

    ctx.restore();
  }

  drawWaterFlowParticles() {
    // Uphill flow only when Line Valve is open and water is present
    if (!this.state.lineValve || this.pipeWaterLevel < 0.1) return;

    const ctx = this.ctx;
    const path = this.fillPipePath;
    if (!path || path.length < 2) return;

    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    this.particles.forEach(p => {
      p.progress += p.speed * (this.state.pump ? 1.8 : 0.9);
      if (p.progress > this.pipeWaterLevel) p.progress = 0;

      // Calculate position along multi-segment path
      const totalSegments = path.length - 1;
      const segIndex = Math.min(Math.floor(p.progress * totalSegments), totalSegments - 1);
      const segProgress = (p.progress * totalSegments) - segIndex;

      const pStart = path[segIndex];
      const pEnd = path[segIndex + 1];

      const x = pStart.x + (pEnd.x - pStart.x) * segProgress;
      const y = pStart.y + (pEnd.y - pStart.y) * segProgress;

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Water pouring drop stream at tank inlet if full flow reached
    if (this.pipeWaterLevel > 0.9) {
      const inletX = this.width - 165;
      const inletY = 70;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.fillRect(inletX - 2, inletY, 4, 35);

      this.tankSplashes.forEach(s => {
        s.life -= 0.05;
        s.x += s.vx;
        s.y += s.vy;
        if (s.life <= 0) {
          s.life = 1.0;
          s.x = inletX + (Math.random() - 0.5) * 6;
          s.y = inletY + 35;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
  }

  drawDrainingDischarge() {
    // Downhill draining particles and sump discharge
    if (this.state.lineValve || this.pipeWaterLevel <= 0.001) return;

    const ctx = this.ctx;
    const path = this.fillPipePath;
    const h = this.height;

    ctx.save();
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 6;

    // Draw backward rushing particles along hill pipe
    this.drainParticles.forEach(p => {
      // Particles travel downwards (from high progress towards 0)
      p.progress -= p.speed;
      if (p.progress < 0 || p.progress > this.pipeWaterLevel) {
        p.progress = Math.min(this.pipeWaterLevel, 0.95);
      }

      const totalSegments = path.length - 1;
      const segIndex = Math.min(Math.floor(p.progress * totalSegments), totalSegments - 1);
      const segProgress = (p.progress * totalSegments) - segIndex;

      const pStart = path[segIndex];
      const pEnd = path[segIndex + 1];

      const x = pStart.x + (pEnd.x - pStart.x) * segProgress;
      const y = pStart.y + (pEnd.y - pStart.y) * segProgress;

      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw drain valve discharge spray into sump
    const spoutX = 175;
    const spoutY = h - 35;

    // Animated water jet down to sump
    ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
    ctx.fillRect(spoutX - 2.5, spoutY, 5, 12);

    // Splash particles
    this.drainSplashes.forEach(s => {
      s.life -= 0.04;
      s.x += s.vx;
      s.y += s.vy;
      if (s.life <= 0) {
        s.life = 1.0;
        s.x = spoutX + (Math.random() - 0.5) * 4;
        s.y = spoutY + 8;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}
