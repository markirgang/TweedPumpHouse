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
  Volume2,
  ArrowRight,
  ArrowDown,
  Activity,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Flame,
  Info
} from 'lucide-react';

export const VisualizationView: React.FC = () => {
  const { sensors, systemState, activeFault } = useTelemetry();

  const isFreezing = sensors.freezeSensorClosed;
  const isPumping = sensors.boosterPumpActive;
  const isLineValveOpen = sensors.lineValveOpen;
  const isDrainClosed = sensors.drainValveClosed;
  const isWaterFlowingToTank = isPumping || (isLineValveOpen && sensors.tankLevelPercent < 95);
  const isDraining = !isDrainClosed;

  // Pressure differential across pump
  const pressureBeforePump = sensors.municipalPressurePSI;
  const pressureAfterPump = sensors.fillPipePressurePSI;
  const pressureDelta = isPumping ? Math.max(0, pressureAfterPump - pressureBeforePump) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top SCADA Visualizer Canvas Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 relative overflow-hidden shadow-2xl bg-grid-pattern">
        {/* Title Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-xl font-black tracking-tight text-slate-100 uppercase flex items-center gap-2">
                P&ID Process Flow & Telemetry Schematic
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Interactive 9W Pumphouse hydraulics, booster pump motor telemetry, dual solenoid line/drain valves, and uphill Tweed tank feed
            </p>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* System Mode / State Badge */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
              activeFault 
                ? 'bg-rose-500/15 border-rose-500/50 text-rose-300 animate-pulse' 
                : isPumping 
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300' 
                  : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}>
              <Activity className={`w-3.5 h-3.5 ${isPumping ? 'text-cyan-400 animate-spin' : activeFault ? 'text-rose-400' : 'text-slate-500'}`} />
              <span className="text-[10px] uppercase font-sans text-slate-400">STATE:</span>
              <span className="font-bold">{systemState.replace(/_/g, ' ')}</span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
              <span className="text-slate-500 uppercase text-[10px] block font-sans">Pump Room Temp</span>
              <span className="font-bold text-amber-400">{sensors.insideTempF.toFixed(1)}°F</span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
              <span className="text-slate-500 uppercase text-[10px] block font-sans">Outside Temp</span>
              <span className={`font-bold ${isFreezing ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {sensors.outsideTempF.toFixed(1)}°F ({isFreezing ? 'FREEZING' : 'NORMAL'})
              </span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300">
              <span className="text-slate-500 uppercase text-[10px] block font-sans">Tank Level</span>
              <span className="font-bold text-cyan-400">{sensors.tankLevelPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Process Flow Status Legend / Callout Banner */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Hydraulic Flow Status */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between ${
            isWaterFlowingToTank 
              ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200' 
              : isDraining 
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' 
                : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`p-2 rounded-xl ${
                isWaterFlowingToTank ? 'bg-cyan-500 text-slate-950' : isDraining ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
              }`}>
                <Droplet className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold uppercase text-[11px] text-slate-300">Hydraulic Line Status</div>
                <div className="font-mono text-xs font-semibold">
                  {isPumping 
                    ? 'BOOSTER PUMPING (115 PSI)' 
                    : isLineValveOpen 
                      ? 'STATIC PRE-FILL (55 PSI)' 
                      : isDraining 
                        ? 'DRAINING TO ATMOSPHERE (0 PSI)' 
                        : 'ISOLATED / SEALED'}
                </div>
              </div>
            </div>
            {isWaterFlowingToTank && <ArrowRight className="w-4 h-4 text-cyan-400 animate-pulse" />}
          </div>

          {/* Motor Electrical Status */}
          <div className={`p-3 rounded-2xl border flex items-center justify-between ${
            isPumping 
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' 
              : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className={`p-2 rounded-xl ${isPumping ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold uppercase text-[11px] text-slate-300">Pump Motor Electrical Feed</div>
                <div className="font-mono text-xs font-semibold">
                  {isPumping 
                    ? `${sensors.motorCurrentAmps.toFixed(1)}A AC (${sensors.motorCurrentVolts.toFixed(2)} VDC)` 
                    : 'MOTOR OFF (0.0A AC)'}
                </div>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 font-bold font-mono rounded ${
              isPumping ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500'
            }`}>
              {isPumping ? 'ENERGIZED' : 'DE-ENERGIZED'}
            </span>
          </div>

          {/* Pressure Differential Status */}
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between text-slate-300">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl">
                <Gauge className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold uppercase text-[11px] text-slate-300">Pump Differential Pressure</div>
                <div className="font-mono text-xs font-semibold text-cyan-300">
                  MUNICIPAL: {pressureBeforePump.toFixed(1)} PSI ➔ FILL PIPE: {pressureAfterPump.toFixed(1)} PSI
                </div>
              </div>
            </div>
            <span className="font-mono text-xs font-black text-emerald-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              ΔP +{pressureDelta.toFixed(1)} PSI
            </span>
          </div>
        </div>

        {/* Dynamic SCADA P&ID Process Diagram Canvas */}
        <div className="mt-4 relative min-h-[580px] bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 overflow-x-auto">
          <div className="min-w-[920px] relative h-[530px]">
            {/* Terrain Background Contour */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
              <path d="M 0 490 L 400 460 L 720 120 L 920 120 L 920 530 L 0 530 Z" fill="#1e293b" />
              <path d="M 0 490 Q 280 460 440 310 T 720 120" stroke="#334155" strokeWidth="3" strokeDasharray="6 6" fill="none" />
            </svg>

            {/* SVG Hydraulic Pipes & Electrical Wiring Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <linearGradient id="activeWaterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>

                <linearGradient id="electricGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {/* 1. MUNICIPAL WATER INLET PIPE (From City Main to Solenoid Line Valve) */}
              <path d="M 20 340 L 110 340" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
              {/* Active water in municipal inlet pipe */}
              <path d="M 20 340 L 110 340" fill="none" stroke="#0284c7" strokeWidth="10" strokeLinecap="round" opacity="0.8" />
              <path d="M 20 340 L 110 340" fill="none" stroke="#38bdf8" strokeWidth="6" strokeDasharray="6 6" className="animate-flow" />

              {/* 2. PIPE BETWEEN LINE VALVE AND BOOSTER PUMP */}
              <path d="M 180 340 L 250 340" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
              {isLineValveOpen && (
                <>
                  <path d="M 180 340 L 250 340" fill="none" stroke="url(#activeWaterGradient)" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 180 340 L 250 340" fill="none" stroke="#e0f2fe" strokeWidth="6" strokeDasharray="6 6" className="animate-flow" />
                </>
              )}

              {/* 3. PIPE BETWEEN BOOSTER PUMP AND T-JUNCTION (Out of Pump to Outlet Transducer & Drain Valve) */}
              <path d="M 320 340 L 400 340" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" />
              {(isPumping || isLineValveOpen) && (
                <>
                  <path d="M 320 340 L 400 340" fill="none" stroke="url(#activeWaterGradient)" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 320 340 L 400 340" fill="none" stroke="#ffffff" strokeWidth="6" strokeDasharray="8 6" className={isPumping ? 'animate-flow' : ''} />
                </>
              )}

              {/* 4. DRAIN PIPE LINE (From T-Junction 400,340 downwards to 400,470) */}
              <path d="M 400 340 L 400 460" fill="none" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" />
              {/* Draining Water Flow Animation when Drain Valve is OPEN */}
              {isDraining && (
                <>
                  <path d="M 400 340 L 400 460" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
                  <path d="M 400 340 L 400 460" fill="none" stroke="#bae6fd" strokeWidth="5" className="animate-drain" />
                </>
              )}

              {/* 5. UPHILL MAIN FILL PIPE (From T-Junction 400,340 up slope to Tweed Tank 740,110) */}
              <path d="M 400 340 L 440 340 L 700 130 L 750 130" fill="none" stroke="#1e293b" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
              {isWaterFlowingToTank && (
                <>
                  <path d="M 400 340 L 440 340 L 700 130 L 750 130" fill="none" stroke="url(#activeWaterGradient)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M 400 340 L 440 340 L 700 130 L 750 130" fill="none" stroke="#e0f2fe" strokeWidth="6" className={isPumping ? 'animate-flow' : 'animate-flow-reverse'} />
                </>
              )}

              {/* ELECTRICAL POWER WIRING FROM CONTROL RELAY TO PUMP MOTOR */}
              {/* Conduit wire from Relay Block (140, 190) down to Pump Motor (285, 300) */}
              <path d="M 140 220 L 140 280 L 285 280 L 285 305" fill="none" stroke="#334155" strokeWidth="5" strokeDasharray="4 2" />
              {isPumping && (
                <path d="M 140 220 L 140 280 L 285 280 L 285 305" fill="none" stroke="#f59e0b" strokeWidth="5" className="animate-electric" />
              )}
            </svg>

            {/* NODE 1: CITY MUNICIPAL WATER SUPPLY (Far Left Inlet) */}
            <div className="absolute left-1 top-[300px] z-10 bg-slate-900 border-2 border-slate-700 rounded-2xl p-2.5 shadow-xl w-32 text-center">
              <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider">City Main Supply</div>
              <div className="text-xs font-mono font-extrabold text-slate-100 mt-0.5">Municipal Inlet</div>
              <div className="mt-1 text-[9px] font-mono bg-slate-950 p-1 rounded text-cyan-300 border border-slate-800">
                ~58.0 PSI Feed
              </div>
            </div>

            {/* NODE 2: MUNICIPAL PRESSURE (Inlet Flylin Transducer) */}
            <div className="absolute left-[38px] top-[220px] z-20 bg-slate-900/95 border-2 border-blue-500/60 rounded-xl p-2 shadow-xl w-38 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 border-b border-slate-800 pb-1">
                <span className="flex items-center gap-1 text-blue-400">
                  <Gauge className="w-3 h-3" /> MUNICIPAL PRESSURE
                </span>
                <span className="text-[9px] text-slate-500">City Main</span>
              </div>
              <div className="mt-1 text-center font-mono">
                <span className="text-base font-black text-slate-100">{pressureBeforePump.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-normal"> PSI</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                <span>Pin:</span>
                <span className="text-cyan-300 font-bold">{sensors.municipalPressureVolts.toFixed(2)} VDC</span>
              </div>
            </div>

            {/* NODE 3: SOLENOID LINE VALVE (Normally Closed - 110px to 180px) */}
            <div className={`absolute left-[110px] top-[285px] z-20 w-[72px] bg-slate-900 border-2 rounded-2xl p-2 shadow-2xl transition-all ${
              isLineValveOpen ? 'border-emerald-500 bg-emerald-950/30 glow-emerald' : 'border-rose-500/80 bg-slate-950'
            }`}>
              {/* Solenoid Coil Graphic */}
              <div className={`mx-auto w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black font-mono transition ${
                isLineValveOpen ? 'bg-emerald-500 text-slate-950 animate-pulse' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
              }`}>
                SOL
              </div>
              <div className="text-[10px] font-extrabold text-center text-slate-200 mt-1 uppercase tracking-tight">Line Valve</div>
              <div className="text-[9px] text-center text-slate-400 font-mono">NC Type</div>
              <div className={`mt-1 py-0.5 rounded text-center text-[9px] font-black uppercase ${
                isLineValveOpen ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {isLineValveOpen ? 'OPEN' : 'CLOSED'}
              </div>
            </div>

            {/* FLOW DIRECTION ARROW 1: Between Line Valve & Pump */}
            <div className="absolute left-[195px] top-[328px] z-10 flex items-center gap-0.5 text-cyan-400 font-bold text-xs bg-slate-950/90 px-1 rounded border border-slate-800">
              {isLineValveOpen ? (
                <>
                  <span className="text-[10px] text-slate-300 font-mono">FLOW</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                </>
              ) : (
                <span className="text-[9px] text-rose-400 font-mono">BLOCKED</span>
              )}
            </div>

            {/* CONTROL RELAY & FCS521 CURRENT SENSOR WIRING BLOCK (Above Pump) */}
            <div className="absolute left-[90px] top-[140px] z-20 bg-slate-900 border-2 border-slate-700 rounded-2xl p-3 shadow-xl w-52">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> 9W Shared Relay
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                  sensors.relayState ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {sensors.relayState ? 'ENERGIZED' : 'OFF'}
                </span>
              </div>

              {/* FCS521 Current Transducer Block */}
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[10px] bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">FCS521 Current:</span>
                  <span className={`font-bold ${isPumping ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`}>
                    {sensors.motorCurrentAmps.toFixed(1)} A AC
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Pi GPIO Pin (2/3):</span>
                  <span className="text-amber-300">{sensors.motorCurrentVolts.toFixed(2)} VDC</span>
                </div>
              </div>
            </div>

            {/* NODE 4: BOOSTER PUMP MOTOR & IMPELLER (250px to 320px) */}
            <div className={`absolute left-[245px] top-[270px] z-20 w-24 bg-slate-900 border-2 rounded-2xl p-2.5 shadow-2xl transition-all ${
              isPumping ? 'border-cyan-400 bg-cyan-950/40 glow-cyan' : 'border-slate-700 bg-slate-950'
            }`}>
              <div className="flex items-center justify-center mb-1">
                <div className={`p-2 rounded-full transition-all ${
                  isPumping ? 'bg-cyan-500 text-slate-950 glow-cyan animate-pump-spin' : 'bg-slate-800 text-slate-500'
                }`}>
                  <RotateCw className="w-6 h-6" />
                </div>
              </div>
              <div className="text-[11px] font-black text-center text-slate-100 uppercase tracking-tight">Booster Pump</div>
              <div className="text-[9px] text-center font-mono text-cyan-300 font-bold mt-0.5">
                {isPumping ? `${sensors.motorCurrentAmps.toFixed(1)}A` : 'OFF'}
              </div>
              <div className={`mt-1 py-0.5 rounded text-center text-[9px] font-black uppercase ${
                isPumping ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-500'
              }`}>
                {isPumping ? 'RUNNING' : 'STOPPED'}
              </div>
            </div>

            {/* FLOW DIRECTION ARROW 2: Out of Pump */}
            <div className="absolute left-[330px] top-[328px] z-10 flex items-center gap-0.5 text-cyan-400 font-bold text-xs bg-slate-950/90 px-1 rounded border border-slate-800">
              {isPumping ? (
                <>
                  <span className="text-[10px] text-slate-300 font-mono">BOOST</span>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                </>
              ) : isLineValveOpen ? (
                <>
                  <span className="text-[9px] text-slate-400 font-mono">PASS</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </>
              ) : (
                <span className="text-[9px] text-slate-500 font-mono">NO FLOW</span>
              )}
            </div>

            {/* NODE 5: FILL PIPE PRESSURE (Discharge / Fill Pipe Flylin Transducer) */}
            <div className="absolute left-[335px] top-[220px] z-20 bg-slate-900/95 border-2 border-cyan-500/60 rounded-xl p-2 shadow-xl w-40 backdrop-blur-sm">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-300 border-b border-slate-800 pb-1">
                <span className="flex items-center gap-1 text-cyan-400">
                  <Gauge className="w-3 h-3" /> FILL PIPE PRESSURE
                </span>
                <span className="text-[9px] text-slate-500">Fill Line</span>
              </div>
              <div className="mt-1 text-center font-mono">
                <span className="text-base font-black text-cyan-300">{pressureAfterPump.toFixed(1)}</span>
                <span className="text-xs text-slate-400 font-normal"> PSI</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
                <span>Pin:</span>
                <span className="text-cyan-300 font-bold">{sensors.fillPipePressureVolts.toFixed(2)} VDC</span>
              </div>
            </div>

            {/* NODE 6: SOLENOID DRAIN VALVE (Normally Open - Downward T-Junction) */}
            <div className={`absolute left-[364px] top-[390px] z-20 w-[72px] bg-slate-900 border-2 rounded-2xl p-2 shadow-2xl transition-all ${
              !isDrainClosed ? 'border-amber-500 bg-amber-950/40 glow-amber' : 'border-emerald-500/80 bg-slate-950'
            }`}>
              {/* Solenoid Coil Graphic */}
              <div className={`mx-auto w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black font-mono transition ${
                !isDrainClosed ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                SOL
              </div>
              <div className="text-[10px] font-extrabold text-center text-slate-200 mt-1 uppercase tracking-tight">Drain Valve</div>
              <div className="text-[9px] text-center text-slate-400 font-mono">NO Type</div>
              <div className={`mt-1 py-0.5 rounded text-center text-[9px] font-black uppercase ${
                !isDrainClosed ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {!isDrainClosed ? 'OPEN' : 'CLOSED'}
              </div>
            </div>

            {/* DRAIN DISCHARGE PORT (Bottom of Drain Line) */}
            <div className="absolute left-[360px] top-[475px] z-10 bg-slate-900/90 border border-slate-800 rounded-lg px-2 py-1 text-center w-20">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Drain Discharge</div>
              <div className={`text-[9px] font-mono font-bold flex items-center justify-center gap-0.5 ${
                isDraining ? 'text-amber-400 animate-pulse' : 'text-slate-500'
              }`}>
                {isDraining ? (
                  <>
                    <span>DRAINING</span>
                    <ArrowDown className="w-3 h-3 text-amber-400 animate-bounce" />
                  </>
                ) : (
                  <span>SEALED</span>
                )}
              </div>
            </div>

            {/* FLOW DIRECTION ARROWS UPHILL TO TANK */}
            <div className="absolute left-[520px] top-[240px] z-10 bg-slate-950/90 border border-slate-800 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-slate-200 shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 uppercase">Main Fill Line:</span>
                {isWaterFlowingToTank ? (
                  <span className="text-cyan-400 flex items-center gap-1">
                    UPHILL FEED <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                  </span>
                ) : isDraining ? (
                  <span className="text-amber-400">DRAINED (0 PSI)</span>
                ) : (
                  <span className="text-slate-500">STATIC / STOPPED</span>
                )}
              </div>
            </div>

            {/* PUMP ROOM INSIDE TEMPERATURE STATION (Inside Pumphouse - DHT11 #2) */}
            <div className="absolute left-[10px] top-[40px] z-20 bg-slate-900/95 border-2 border-amber-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md w-52">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ThermometerSnowflake className="w-4 h-4 text-amber-400" />
                  Pump Room DHT11 #2
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  INSIDE
                </span>
              </div>
              <div className="text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Indoor Ambient:</span>
                  <span className="font-bold text-amber-300">
                    {sensors.insideTempF.toFixed(1)}°F
                  </span>
                </div>
                <div className="text-[9px] text-slate-400 bg-slate-950 p-1 rounded text-center mt-1 border border-slate-800">
                  🏠 9W Pumphouse Interior
                </div>
              </div>
            </div>

            {/* OUTSIDE FREEZE SENSOR STATION (Along Mountain Slope - DHT11 #1) */}
            <div className="absolute left-[470px] top-[60px] z-20 bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl backdrop-blur-md w-52">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ThermometerSnowflake className={`w-4 h-4 ${isFreezing ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'}`} />
                  Outside DHT11 #1
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                  isFreezing ? 'bg-cyan-500 text-slate-950' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {isFreezing ? 'FREEZING' : 'NORMAL'}
                </span>
              </div>
              <div className="text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Outside Temp:</span>
                  <span className={`font-bold ${isFreezing ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {sensors.outsideTempF.toFixed(1)}°F
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500">Threshold:</span>
                  <span className="text-slate-400">&le; 45.0°F (7.2°C)</span>
                </div>
                <div className="text-[9px] text-slate-400 bg-slate-950 p-1 rounded text-center mt-1 border border-slate-800">
                  {isFreezing 
                    ? '❄ Freezing: Keeps line valve CLOSED & drain OPEN when idle' 
                    : '✓ Warm: Allows static pre-fill line valve OPEN'}
                </div>
              </div>
            </div>

            {/* NODE 7: TWEED BLVD STORAGE TANK (Far Right Top) */}
            <div className="absolute right-2 top-2 z-20 w-72 bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-black uppercase text-cyan-400 tracking-wider flex items-center gap-1">
                  <Droplet className="w-3.5 h-3.5" /> Tweed Blvd Tank
                </span>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {sensors.tankLevelPercent.toFixed(1)}% Full
                </span>
              </div>

              {/* Visual Tank Graphic Container */}
              <div className="relative h-44 bg-slate-950 border-2 border-slate-800 rounded-xl overflow-hidden p-2">
                {/* Top Fill Pipe Nozzle & Spray Animation when Water is Pumping into Tank */}
                {isWaterFlowingToTank && (
                  <div className="absolute top-0 right-6 z-20 flex flex-col items-center">
                    <div className="w-3 h-3 bg-cyan-400 rounded-b border border-cyan-200"></div>
                    <div className="w-1.5 h-8 bg-gradient-to-b from-cyan-300 to-blue-500 opacity-90 animate-pulse"></div>
                  </div>
                )}

                {/* Animated Water Reservoir Fill */}
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-700/90 via-cyan-600/80 to-sky-400/70 transition-all duration-500 border-t-2 border-cyan-300/90 flex items-center justify-center"
                  style={{ height: `${sensors.tankLevelPercent}%` }}
                >
                  <Waves className="w-12 h-12 text-cyan-200/30 animate-pulse" />
                </div>

                {/* Float Switch Position Markers */}
                {/* High Water Float Switch (95% Level) */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t border-dashed border-cyan-400/60 pt-0.5 z-10 bg-slate-950/70 px-1 rounded">
                  <span className="text-slate-300 font-semibold">HIGH FLOAT (95%)</span>
                  <span className={`px-1 rounded font-bold text-[9px] ${
                    sensors.highWaterFloat 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {sensors.highWaterFloat ? 'CLOSED (<95%)' : 'OPEN (FULL)'}
                  </span>
                </div>

                {/* Low Water Float Switch (50% Level - Floating UP when >= 50%) */}
                <div className="absolute top-[48%] left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t-2 border-dashed border-amber-400/80 pt-0.5 z-10 bg-slate-950/80 px-1 rounded">
                  <span className="text-slate-200 font-bold">LOW FLOAT (50%)</span>
                  <span className={`px-1 rounded font-bold text-[9px] ${
                    sensors.lowWaterFloat 
                      ? 'bg-rose-500 text-slate-950 animate-pulse font-black' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {sensors.lowWaterFloat ? 'DROPPED (<50%)' : 'UP (≥50%)'}
                  </span>
                </div>

                {/* Bottom Float Switch (2% Level - Empty Tank) */}
                <div className="absolute bottom-1 left-2 right-2 flex items-center justify-between text-[10px] font-mono border-t border-dashed border-rose-500/60 pt-0.5 z-10 bg-slate-950/80 px-1 rounded">
                  <span className="text-slate-300 font-semibold">BOTTOM FLOAT (0%)</span>
                  <span className={`px-1 rounded font-bold text-[9px] ${
                    sensors.bottomFloat 
                      ? 'bg-rose-600 text-slate-950 font-black animate-ping' 
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {sensors.bottomFloat ? 'EMPTY!' : 'OK'}
                  </span>
                </div>
              </div>

              {/* Tank Switch Summary Badges */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] font-mono">
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">High Float</span>
                  <span className={sensors.highWaterFloat ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                    {sensors.highWaterFloat ? 'CLOSED' : 'OPEN'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Low Float</span>
                  <span className={sensors.lowWaterFloat ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {sensors.lowWaterFloat ? 'CLOSED' : 'OPEN'}
                  </span>
                </div>
                <div className="p-1.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-slate-500 block">Bottom</span>
                  <span className={sensors.bottomFloat ? 'text-rose-500 font-bold' : 'text-slate-500'}>
                    {sensors.bottomFloat ? 'EMPTY' : 'NORMAL'}
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold">
              <Gauge className="w-4 h-4" /> Municipal Pressure
            </span>
            <span className="text-[10px] font-mono text-slate-500">Flylin #202216-1</span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-100 flex items-baseline justify-between">
            <span>{sensors.municipalPressurePSI.toFixed(1)} <span className="text-xs font-normal text-slate-400">PSI</span></span>
            <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.municipalPressureVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            City Main Pressure | Low Pressure Alarm Limit: &lt; 35.0 PSI (1.27 VDC GPIO)
          </p>
        </div>

        {/* Card 2: Fill Pipe Pressure */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Gauge className="w-4 h-4" /> Fill Pipe Pressure
            </span>
            <span className="text-[10px] font-mono text-slate-500">Flylin 200 PSI</span>
          </div>
          <div className="text-2xl font-black font-mono text-cyan-300 flex items-baseline justify-between">
            <span>{sensors.fillPipePressurePSI.toFixed(1)} <span className="text-xs font-normal text-slate-400">PSI</span></span>
            <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.fillPipePressureVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            {isPumping 
              ? 'Active Pumping Head ~115 PSI (1.87 VDC)' 
              : isLineValveOpen 
                ? 'Municipal Static Feed ~55 PSI (1.07 VDC)' 
                : 'Drained Line 0 PSI (0.33 VDC)'}
          </p>
        </div>

        {/* Card 3: Booster Pump Current Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Zap className="w-4 h-4" /> Pump Current (FCS521)
            </span>
            <span className="text-[10px] font-mono text-slate-500">0-50A Transducer</span>
          </div>
          <div className="text-2xl font-black font-mono text-amber-300 flex items-baseline justify-between">
            <span>{sensors.motorCurrentAmps.toFixed(1)} <span className="text-xs font-normal text-slate-400">A AC</span></span>
            <span className="text-xs font-mono text-amber-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
              {sensors.motorCurrentVolts.toFixed(2)} VDC
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            Normal ~21.5A | Low Current Limit &lt; 15.0A | High Current Limit &gt; 30.0A
          </p>
        </div>

        {/* Card 4: Dual DHT11 Ambient Temperature Sensors */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-blue-400 font-bold">
              <ThermometerSnowflake className="w-4 h-4" /> Dual DHT11 Temp Sensors
            </span>
            <span className="text-[10px] font-mono text-slate-500">2x DHT11 Digital</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center pt-1 font-mono">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Pump Room</span>
              <span className="text-xl font-black text-amber-300">{sensors.insideTempF.toFixed(1)}°F</span>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-sans block">Outside</span>
              <span className={`text-xl font-black ${isFreezing ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {sensors.outsideTempF.toFixed(1)}°F
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Freeze Protection: {isFreezing ? 'FREEZING (\u2264 45°F) - Drained' : 'NORMAL (> 45°F) - Warm'}
          </p>
        </div>
      </div>
    </div>
  );
};
