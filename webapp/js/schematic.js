/**
 * Tweed Boulevard / Route 9W Water System
 * Interactive Animated Pipeline & Holding Tank Schematic (HTML5 Canvas)
 */

class SystemSchematic {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    this.particles = [];
    this.impellerAngle = 0;
    this.wavePhase = 0;
    
    // Telemetry cache
    this.state = {
      tankEmpty: false,
      tankLow: false,
      tankHigh: true,
      freezeSensor: false,
      lineValve: false,
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
    this.particles = [];
    for (let i = 0; i < 28; i++) {
      this.particles.push({
        progress: Math.random(),
        speed: 0.004 + Math.random() * 0.003,
        size: 3 + Math.random() * 2
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

    // Pump impeller rotation
    if (this.state.pump) {
      this.impellerAngle += 0.15;
    }

    // Render Components
    this.drawTerrainAndPipes();
    this.drawPumpRoom();
    this.drawHoldingTank();
    this.drawWaterFlowParticles();
  }

  drawTerrainAndPipes() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Hillside gradient line (Route 9W bottom left to Tweed Blvd top right)
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(30, h - 40);
    ctx.lineTo(w * 0.45, h - 80);
    ctx.lineTo(w - 60, 80);
    ctx.stroke();
    ctx.restore();

    // The Water Fill Pipe Path
    const p1 = { x: 90, y: h - 90 };      // Municipal supply entry
    const p2 = { x: 170, y: h - 90 };     // Valve
    const p3 = { x: 250, y: h - 90 };     // Pump
    const p4 = { x: 310, y: h - 90 };     // Exit Pump Room
    const p5 = { x: w - 170, y: 150 };    // Base of Holding Tank

    this.pipePath = [p1, p2, p3, p4, p5];

    // Draw Main Pipe Body
    ctx.save();
    ctx.strokeStyle = this.state.freezeSensor ? '#3b82f6' : '#1e293b';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.lineTo(p5.x, p5.y);
    ctx.lineTo(p5.x + 30, p5.y - 30);
    ctx.stroke();

    // Pipe Interior Glow if Water is Flowing
    const isWaterFlowing = this.state.lineValve;
    if (isWaterFlowing) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 8;
      ctx.stroke();
    }
    ctx.restore();

    // Pipe Freeze Warning crystals if freeze sensor active
    if (this.state.freezeSensor) {
      ctx.save();
      ctx.fillStyle = '#93c5fd';
      ctx.font = '11px sans-serif';
      ctx.fillText('❄ FREEZE HAZARD: <40°F (PIPE ISOLATED)', (p4.x + p5.x) / 2 - 80, (p4.y + p5.y) / 2 - 14);
      ctx.restore();
    }
  }

  drawPumpRoom() {
    const ctx = this.ctx;
    const h = this.height;

    // Pump Room Enclosure
    const rx = 60, ry = h - 165, rw = 265, rh = 135;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(rx, ry, rw, rh, 10);
    ctx.fill();
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('PUMP ROOM (ROUTE 9W ELEVATION)', rx + 14, ry + 20);

    // Municipal Main Tag
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('MUNICIPAL SUPPLY 9W', rx - 10, ry + rh + 18);

    // 1. Line Valve Visual
    const vx = 170, vy = h - 90;
    const valveOpen = this.state.lineValve;
    ctx.save();
    ctx.fillStyle = valveOpen ? '#10b981' : '#64748b';
    ctx.strokeStyle = valveOpen ? '#34d399' : '#94a3b8';
    ctx.lineWidth = 2;
    // Valve Bowtie
    ctx.beginPath();
    ctx.moveTo(vx - 14, vy - 14);
    ctx.lineTo(vx + 14, vy + 14);
    ctx.lineTo(vx + 14, vy - 14);
    ctx.lineTo(vx - 14, vy + 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Solenoid actuator on top of valve
    ctx.fillStyle = valveOpen ? '#059669' : '#334155';
    ctx.fillRect(vx - 6, vy - 24, 12, 10);
    ctx.restore();

    ctx.fillStyle = valveOpen ? '#34d399' : '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.fillText(valveOpen ? 'VALVE: OPEN' : 'VALVE: CLOSED', vx - 26, vy + 28);

    // 2. Water Pump Visual
    const px = 250, py = h - 90;
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
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Spinning Impeller Blades
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.impellerAngle);
    ctx.strokeStyle = pumpOn ? '#fff' : '#64748b';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Pump Status Label & On-Time Ticker
    ctx.save();
    ctx.font = '9px sans-serif';
    if (this.state.pumpOvercurrentTrip) {
      ctx.fillStyle = '#f87171';
      ctx.fillText('PUMP: OVERLOAD TRIP!', px - 38, py + 34);
    } else if (this.state.pumpUndercurrentTrip) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('PUMP: DRY RUN TRIP!', px - 36, py + 34);
    } else if (pumpOn) {
      ctx.fillStyle = '#38bdf8';
      const elapsed = this.state.pumpRunElapsedSec || 0;
      const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const ss = (elapsed % 60).toString().padStart(2, '0');
      ctx.fillText(`PUMP ON: ${mm}:${ss}`, px - 28, py + 34);
    } else if (this.state.pumpTimingState === 2) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('PUMP: TIMED OUT', px - 30, py + 34);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('PUMP: OFF', px - 20, py + 34);
    }
    ctx.restore();

    // 2B. Pump Current Monitor Module (Above Pump)
    const csx = px, csy = py - 36;
    ctx.save();
    ctx.fillStyle = hasFault ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)';
    ctx.strokeStyle = hasFault ? '#ef4444' : '#10b981';
    ctx.lineWidth = 1;
    ctx.roundRect(csx - 24, csy - 10, 48, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = hasFault ? '#fca5a5' : '#a7f3d0';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText(hasFault ? 'CURRENT !' : 'CURRENT OK', csx - 21, csy + 2);
    ctx.restore();

    // 3. Freeze Sensor (Exterior)
    const fsx = rx + rw - 20, fsy = ry + 25;
    ctx.save();
    ctx.fillStyle = this.state.freezeSensor ? '#ef4444' : '#10b981';
    ctx.beginPath();
    ctx.arc(fsx, fsy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = this.state.freezeSensor ? '#f87171' : '#a7f3d0';
    ctx.font = '9px sans-serif';
    ctx.fillText(this.state.freezeSensor ? 'FREEZE <40°F' : 'OUTSIDE >40°F', fsx - 65, fsy + 4);

    ctx.restore();
  }

  drawHoldingTank() {
    const ctx = this.ctx;
    const w = this.width;

    // Tank dimensions (Top-right of canvas)
    const tx = w - 210, ty = 40, tw = 170, th = 220;

    ctx.save();
    // Tank Frame
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.roundRect(tx, ty, tw, th, 12);
    ctx.fill();
    ctx.stroke();

    // Tank Roof / Hat
    ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.beginPath();
    ctx.moveTo(tx - 10, ty);
    ctx.lineTo(tx + tw / 2, ty - 18);
    ctx.lineTo(tx + tw + 10, ty);
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
      { name: 'TANK HIGH', y: ty + 40, floating: !this.state.tankHigh, color: !this.state.tankHigh ? '#10b981' : '#64748b' },
      { name: 'TANK LOW',  y: ty + 115, floating: !this.state.tankLow, color: this.state.tankLow ? '#f59e0b' : '#10b981' },
      { name: 'TANK EMPTY', y: ty + 185, floating: !this.state.tankEmpty, color: this.state.tankEmpty ? '#ef4444' : '#10b981' }
    ];

    floats.forEach(f => {
      // Switch stem
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + tw - 12, f.y);
      ctx.lineTo(tx + tw - 34, f.y);
      ctx.stroke();

      // Float ball
      ctx.fillStyle = f.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const floatY = f.floating ? (f.y - 4) : (f.y + 4);
      ctx.arc(tx + tw - 40, floatY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle = f.color;
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(f.name, tx + 12, f.y + 3);
    });

    // Tank Header Label
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('TWEED BLVD TANK', tx + 28, ty + 18);

    ctx.restore();
  }

  drawWaterFlowParticles() {
    if (!this.state.lineValve) return; // Flow only when valve open

    const ctx = this.ctx;
    const path = this.pipePath;
    if (!path || path.length < 2) return;

    ctx.save();
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;

    this.particles.forEach(p => {
      p.progress += p.speed * (this.state.pump ? 1.8 : 0.8);
      if (p.progress > 1) p.progress = 0;

      // Calculate position along multi-segment pipe path
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

    ctx.restore();
  }
}
