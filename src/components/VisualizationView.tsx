import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import {
  Gauge,
  Zap,
  Droplet,
  ThermometerSnowflake,
  RotateCw,
  Clock,
  Waves,
  Bell,
  VolumeX,
  Volume2
} from 'lucide-react';

export const VisualizationView: React.FC = () => {
  const { sensors } = useTelemetry();

  const isFreezing = sensors.freezeSensorClosed;
  const isPumping = sensors.boosterPumpActive;
  const isLineValveOpen = sensors.lineValveOpen;
  const isDrainClosed = sensors.drainValveClosed;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top SCADA Visualizer Canvas Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl bg-grid-pattern">
        {/* Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-xl font-black tracking-tight text-slate-100 uppercase">
                System Telemetry Schematic View
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              9W Pumphouse booster line valve relay & Tweed Blvd Storage Tank telemetry
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
              <span className="text-slate-500 uppercase text-[10px] block font-sans">Outside Temp</span>
              <span className={`font-bold ${isFreezing ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {sensors.outsideTempF.toFixed(1)}°F ({isFreezing ? 'FREEZING <=45°F' : 'NORMAL'})
              </span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
              <span className="text-slate-500 uppercase text-[10px] block font-sans">Tank Level</span>
              <span className="font-bold text-cyan-400">{sensors.tankLevelPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Dynamic Topology Visualizer (SVG/HTML Canvas layout) */}
        <div className="mt-6 relative min-h-[520px] bg-slate-950/90 rounded-2xl border border-slate-800/90 p-4 sm:p-6 overflow-x-auto">
          <div className="min-w-[850px] relative h-[480px]">
            {/* Mountain Slope Contour Background */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0 450 L 320 420 L 700 120 L 850 120 L 850 480 L 0 480 Z" fill="#1e293b" />
              <path d="M 0 450 Q 250 420 400 300 T 700 120" stroke="#334155" strokeWidth="3" strokeDasharray="6 6" fill="none" />
            </svg>

            {/* LOCATION 1: ROUTE 9W PUMPHOUSE (Bottom Left) */}
            <div className="absolute left-2 bottom-4 w-72 bg-slate-900/95 border-2 border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-10">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> 9W Pumphouse
                </span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Relay: {sensors.relayState ? 'ENERGIZED (ON)' : 'DE-ENERGIZED (OFF)'}
                </span>
              </div>

              {/* Municipal Water Inlet & Sensor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-blue-400" /> City Water Pressure
                  </span>
                  <span className="font-mono font-bold text-slate-200">{sensors.municipalPressurePSI.toFixed(1)} PSI</span>
                </div>

                {/* Line Valve (Normally Closed) */}
                <div className={`p-2.5 rounded-xl border transition ${
                  isLineValveOpen 
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 glow-emerald' 
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Line Valve (Normally Closed)</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      isLineValveOpen ? 'bg-emerald-500 text-slate-950 font-black' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {isLineValveOpen ? 'OPEN (Powered)' : 'CLOSED (NC)'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isLineValveOpen ? '✓ Municipal water allowed into fill pipe' : '✕ Municipal inlet isolated'}
                  </p>
                </div>

                {/* Drain Valve (Normally Open) */}
                <div className={`p-2.5 rounded-xl border transition ${
                  !isDrainClosed 
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 glow-amber' 
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>Drain Valve (Normally Open)</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      !isDrainClosed ? 'bg-amber-500 text-slate-950 font-black' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}>
                      {!isDrainClosed ? 'OPEN (DRAINING)' : 'CLOSED (Sealed)'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {!isDrainClosed ? '💧 Fill pipe water draining out at 9W' : '✓ Pipe drain port sealed for pumping'}
                  </p>
                </div>

                <div className="text-[9px] text-slate-500 font-mono bg-slate-950 p-1.5 rounded-lg text-center border border-slate-800/80">
                  ⚡ Shared Relay: Relay ON = Line Valve OPEN & Drain CLOSED
                </div>

                {/* Alarm Relay Indicator */}
                <div className={`p-2.5 rounded-xl border transition ${
                  sensors.alarmRelayActive
                    ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 glow-rose'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <Bell className={`w-3.5 h-3.5 ${sensors.alarmRelayActive ? 'text-rose-400 animate-bounce' : 'text-slate-500'}`} />
                      Alarm Relay Output
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      sensors.alarmRelayActive
                        ? 'bg-rose-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {sensors.alarmRelayActive ? 'ENERGIZED (ALARM)' : 'DE-ENERGIZED (NORMAL)'}
                    </span>
                  </div>
                  {sensors.alarmRelayActive && (
                    <div className="mt-1 text-[10px] text-slate-300 font-mono flex items-center justify-between border-t border-rose-500/30 pt-1">
                      <span>Audio Horn: {sensors.alarmSilenced ? 'MUTED (Silenced)' : 'SOUNDING'}</span>
                      {sensors.alarmSilenced ? <VolumeX className="w-3 h-3 text-amber-400" /> : <Volume2 className="w-3 h-3 text-rose-400 animate-pulse" />}
                    </div>
                  )}
                </div>

                {/* Booster Pump Visual */}
                <div className={`p-3 rounded-xl border transition ${
                  isPumping 
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 glow-cyan' 
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1.5 rounded-lg ${isPumping ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                        <RotateCw className={`w-4 h-4 ${isPumping ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <div className="text-xs font-bold">Booster Pump</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {isPumping ? `${sensors.motorCurrentAmps.toFixed(1)} Amps` : 'OFF (0.0A)'}
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isPumping ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isPumping ? 'RUNNING' : 'STOPPED'}
                    </span>
                  </div>

                  {/* Pump Run Timer */}
                  {isPumping && (
                    <div className="mt-2 text-[10px] font-mono text-slate-300 flex items-center justify-between border-t border-cyan-500/30 pt-1.5">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-cyan-400" /> Run Time:
                      </span>
                      <span>
                        {Math.floor(sensors.pumpRunTimeSeconds / 60)}m {Math.floor(sensors.pumpRunTimeSeconds % 60)}s / 20m
                      </span>
                    </div>
                  )}
                </div>

                {/* Fill Pipe Pressure Sensor */}
                <div className="flex items-center justify-between text-xs bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Fill Pipe Line Pressure
                  </span>
                  <span className="font-mono font-bold text-cyan-300">{sensors.fillPipePressurePSI.toFixed(1)} PSI</span>
                </div>
              </div>
            </div>

            {/* OUTSIDE FREEZE SENSOR STATION (Outside Pumphouse) */}
            <div className="absolute left-72 bottom-48 bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md z-20 w-48">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2">
                <ThermometerSnowflake className={`w-4 h-4 ${isFreezing ? 'text-cyan-400 animate-pulse' : 'text-amber-400'}`} />
                <span>Outside Freeze Sensor</span>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Ambient:</span>
                  <span className="font-bold text-slate-200">{sensors.outsideTempF.toFixed(1)}°F</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Threshold:</span>
                  <span className="text-slate-400">45.0°F</span>
                </div>
                <div className={`mt-2 p-1.5 rounded text-center text-[10px] font-extrabold uppercase ${
                  isFreezing 
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  Sensor: {isFreezing ? 'CLOSED (FREEZING)' : 'OPEN (WARM)'}
                </div>
              </div>
            </div>

            {/* SVG Dynamic Pipe Routing (From 9W Pumphouse up hill to Tweed Tank) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <linearGradient id="pipeWaterGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>

              {/* Base Pipe Line */}
              <path
                d="M 280 390 L 350 390 L 650 140 L 700 140"
                fill="none"
                stroke="#1e293b"
                strokeWidth="14"
                strokeLinecap="round"
              />

              {/* Water in Fill Pipe (if line valve open or pump running) */}
              {(isLineValveOpen || isPumping) && (
                <path
                  d="M 280 390 L 350 390 L 650 140 L 700 140"
                  fill="none"
                  stroke="url(#pipeWaterGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className={isPumping ? 'animate-flow' : ''}
                />
              )}

              {/* Draining Flow Animation (if drain valve open & pipe was active) */}
              {!isDrainClosed && (
                <path
                  d="M 280 390 L 280 440"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="6"
                  strokeDasharray="4 4"
                  className="animate-flow"
                />
              )}
            </svg>

            {/* LOCATION 2: TWEED BLVD STORAGE TANK (Top Right) */}
            <div className="absolute right-4 top-4 w-72 bg-slate-900/95 border-2 border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md z-10">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5" /> Tweed Blvd Storage Tank
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {sensors.tankLevelPercent.toFixed(1)}% Full
                </span>
              </div>

              {/* Visual Tank Graphic Container */}
              <div className="relative h-40 bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden p-2">
                {/* Water Level Fill animation */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-600/90 to-blue-500/80 transition-all duration-500 border-t-2 border-cyan-300/80 flex items-center justify-center"
                  style={{ height: `${sensors.tankLevelPercent}%` }}
                >
                  <Waves className="w-12 h-12 text-cyan-200/30 animate-pulse" />
                </div>

                {/* Float Switches Position Indicators inside Tank */}
                {/* High Water Float (at ~95% level) */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t border-dashed border-cyan-500/50 pt-0.5 z-10">
                  <span className="text-slate-300 font-semibold">HIGH WATER FLOAT (95%)</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    sensors.highWaterFloat 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {sensors.highWaterFloat ? 'CLOSED (<95%)' : 'OPEN (FULL)'}
                  </span>
                </div>

                {/* Low Water Float (at 50% level - Floating UP when >= 50%) */}
                <div className="absolute top-[48%] left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t-2 border-dashed border-amber-400/70 pt-0.5 z-10">
                  <span className="text-slate-200 font-bold bg-slate-950/80 px-1 rounded">LOW FLOAT (50%)</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    sensors.lowWaterFloat 
                      ? 'bg-rose-500 text-slate-950 font-black animate-pulse' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {sensors.lowWaterFloat ? 'DROPPED DOWN (CLOSED <50%)' : 'FLOATING UP (OPEN ≥50%)'}
                  </span>
                </div>

                {/* Bottom Float Switch (at ~2% level - Tank Empty) */}
                <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t border-dashed border-rose-500/50 pt-0.5 z-10">
                  <span className="text-slate-300 font-semibold">BOTTOM FLOAT (EMPTY 0%)</span>
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    sensors.bottomFloat 
                      ? 'bg-rose-600 text-slate-950 font-black animate-ping' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {sensors.bottomFloat ? 'CLOSED (EMPTY!)' : 'OPEN'}
                  </span>
                </div>
              </div>

              {/* Tank Switch Summary */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">High</span>
                  <span className={sensors.highWaterFloat ? 'text-amber-400 font-bold' : 'text-slate-500'}>
                    {sensors.highWaterFloat ? 'CLOSED' : 'OFF'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Low</span>
                  <span className={sensors.lowWaterFloat ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                    {sensors.lowWaterFloat ? 'CLOSED' : 'OFF'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block">Bottom</span>
                  <span className={sensors.bottomFloat ? 'text-rose-500 font-bold' : 'text-slate-500'}>
                    {sensors.bottomFloat ? 'EMPTY' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telemetry Gauge & Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Municipal Water Pressure */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-blue-400" /> Municipal Pressure
            </span>
            <span className="text-[10px] font-mono text-slate-500">Flylin #202216-1 (2/3 Divider)</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-100 flex items-baseline justify-between">
            <span>{sensors.municipalPressurePSI.toFixed(1)} <span className="text-xs font-normal text-slate-400">PSI</span></span>
            <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.municipalPressureVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Alarm &lt; 35 PSI (1.27V Pin) | Normal ~58 PSI (1.88V Pin)</p>
        </div>

        {/* Card 2: Fill Pipe Pressure */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" /> Fill Pipe Pressure
            </span>
            <span className="text-[10px] font-mono text-slate-500">Flylin 200 PSI (2/3 Divider)</span>
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 flex items-baseline justify-between">
            <span>{sensors.fillPipePressurePSI.toFixed(1)} <span className="text-xs font-normal text-slate-400">PSI</span></span>
            <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.fillPipePressureVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {sensors.boosterPumpActive ? 'Active head ~115 PSI (1.87V Pin)' : sensors.lineValveOpen ? 'Municipal static ~55 PSI (1.07V Pin)' : '0 PSI (0.33V Pin)'}
          </p>
        </div>

        {/* Card 3: Booster Pump Current */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" /> Motor Amperage (FCS521)
            </span>
            <span className="text-[10px] font-mono text-slate-500">FCS521 0-50A (2/3 Divider)</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 flex items-baseline justify-between">
            <span>{sensors.motorCurrentAmps.toFixed(1)} <span className="text-xs font-normal text-slate-400">A AC</span></span>
            <span className="text-xs font-mono text-amber-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.motorCurrentVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Limits: Low &lt; 15.0A (1.00V Pin) | High &gt; 30.0A (2.00V Pin)</p>
        </div>

        {/* Card 4: Outside Temperature & Freeze */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <ThermometerSnowflake className="w-4 h-4 text-blue-400" /> Outside Temperature
            </span>
            <span className="text-[10px] font-mono text-slate-500">Pumphouse Ambient</span>
          </div>
          <div className={`text-2xl font-black font-mono ${isFreezing ? 'text-cyan-400' : 'text-emerald-400'}`}>
            {sensors.outsideTempF.toFixed(1)} <span className="text-xs font-normal text-slate-400">°F</span>
          </div>
          <p className="text-[10px] text-slate-400">
            Freeze Sensor: {isFreezing ? 'CLOSED (Freezing < 45°F)' : 'OPEN (Warm > 45°F)'}
          </p>
        </div>
      </div>
    </div>
  );
};
