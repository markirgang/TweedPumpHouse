import React from 'react';
import {
  BookOpen,
  Activity,
  Sliders,
  PlayCircle,
  FileText,
  Shield,
  Zap,
  Gauge,
  ThermometerSnowflake,
  Bell,
  CheckCircle2,
  Printer,
  Download,
  Droplet
} from 'lucide-react';

export const GuideInstructionsView: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30 glow-cyan">
            <BookOpen className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
              <span>TWEEDPUMP SCADA OPERATING MANUAL & SYSTEM GUIDE</span>
              <span className="text-xs font-mono px-2 py-0.5 bg-slate-800 text-cyan-400 rounded border border-slate-700">
                Rev 2.4
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Complete Operational Procedures, Logic Sequences, Telemetry Control, Alarm Cutoffs, and Maintenance Safety Reference
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Manual</span>
          </button>
        </div>
      </div>

      {/* Grid of Instructions Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Step 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 1
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Pump & System Visualization</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Real-Time Pipeline Digital Twin:</strong> Monitor live water flow animated along the 2.4 mile pipeline from Route 9W Pumphouse to Tweed Blvd Storage Tank.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Tank Elevation & Capacity:</strong> Inspect the 50,000 Gallon storage tank level transmitter readout (0% to 100%).</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Flow Rate Gauge:</strong> Observe booster pump discharge flow rate (GPM) and dynamic head pressure (PSI).</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 2
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Automated State Machine Logic</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Low Water Trigger (&lt;25%):</strong> Opens motor-operated low water valve with a mandatory 5-second priming delay before booster pump ignition.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>High Water Stop (&gt;90%):</strong> Triggers pump deceleration followed by a 5-second controlled valve closure sequence.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span><strong>Freeze Protection Drain (&lt;32°F):</strong> Drains exposed above-ground pipe sections during standby to prevent line freeze bursts.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 3
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Sensors & Telemetry Controls</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Manual Overrides:</strong> Unlock controls with security passcode to force manual PUMP RUN or VALVE OPEN modes.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Environmental Simulators:</strong> Adjust ambient temperature (°F) and suction supply pressure sliders to test cold weather or low pressure cutoffs.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Level Calibration:</strong> Adjust storage tank fill percentage manually for SCADA testing.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 4 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 4
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-400" />
                <span>Alarm Cutoffs & Auto-Reset</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Max Run Time Cutoff (60m):</strong> Protects motor against continuous running in case of pipe leaks.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Alarm Horn Silence & Reset:</strong> Click <strong className="text-amber-400">Silence Horn</strong> or <strong className="text-rose-400">Reset Cutoff</strong> from the top status header.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span><strong>Auto-Reset Countdown:</strong> Automated 2-hour recovery timer resets over-run faults automatically.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 5 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 5
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Electrical Wiring & Schematics</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Wiring Tab:</strong> Switch to <strong className="text-cyan-300">Wiring Diagram & Schematic</strong> view to inspect terminal block pinouts for FCS521 level switch, MOV-102 motor valve, and 120V relay contacts.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>Interactive Component Highlights:</strong> Click any wiring component or terminal to inspect specifications and signal types.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span><strong>CSV Wire Export:</strong> Download full electrical wiring manifest for field technician deployment.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Step 6 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-mono font-bold">
                SECTION 6
              </span>
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Security & Simulation Controls</span>
              </h3>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 leading-relaxed font-sans">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Passcode Lock Protection:</strong> Requires operator PIN authorization before modifying setpoints or resetting trip locks.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Simulation Speed Multiplier:</strong> Toggle speed (1x, 5x, 10x, 60x) in header bar to accelerate tank filling and drainage testing.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>SCADA Logging:</strong> Logic Simulation View records timestamped state transitions and relay contacts for audit trail compliance.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
