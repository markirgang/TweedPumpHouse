import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { PasswordModal } from './PasswordModal';
import {
  Activity,
  Sliders,
  PlayCircle,
  Lock,
  Unlock,
  AlertTriangle,
  Zap,
  Gauge,
  ThermometerSnowflake,
  Volume2,
  VolumeX,
  Bell,
  FileText,
  BookOpen
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'visualization' | 'controls' | 'simulation' | 'wiring' | 'instructions';
  setActiveTab: (tab: 'visualization' | 'controls' | 'simulation' | 'wiring' | 'instructions') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    sensors,
    systemState,
    activeFault,
    isAuthenticated,
    simSpeed,
    setSimSpeed,
    resetFault,
    silenceAlarm
  } = useTelemetry();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Format seconds into H:MM:SS
  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${hours}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  // Status badge color & text mapping
  const getStatusBadge = () => {
    if (activeFault) {
      return (
        <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/50 rounded-2xl text-xs font-bold">
          <div className="flex items-center space-x-1.5">
            <Bell className="w-4 h-4 text-rose-400 animate-bounce" />
            <span>ALARM RELAY ENERGIZED: {activeFault}</span>
          </div>

          {activeFault === 'MAX_RUN_TIME_EXCEEDED' && sensors.autoResetCountdownSeconds > 0 && (
            <span className="text-[10px] font-mono text-cyan-300 bg-slate-950 px-2 py-0.5 rounded border border-cyan-500/30">
              Auto-Reset in {formatCountdown(sensors.autoResetCountdownSeconds)}
            </span>
          )}

          {/* Silence Alarm Button */}
          <button
            onClick={() => {
              if (isAuthenticated) {
                silenceAlarm();
              } else {
                setIsPasswordModalOpen(true);
              }
            }}
            className={`px-2.5 py-1 rounded text-[10px] uppercase font-bold flex items-center space-x-1 transition ${
              sensors.alarmSilenced
                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
            }`}
          >
            {sensors.alarmSilenced ? (
              <>
                <VolumeX className="w-3 h-3" />
                <span>Silenced</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3 h-3" />
                <span>Silence Horn</span>
              </>
            )}
          </button>

          {/* Reset Cutoff Button */}
          <button
            onClick={() => {
              if (isAuthenticated) {
                resetFault();
              } else {
                setIsPasswordModalOpen(true);
              }
            }}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-slate-950 rounded text-[10px] uppercase font-extrabold transition shadow"
          >
            Reset Cutoff
          </button>
        </div>
      );
    }

    switch (systemState) {
      case 'PUMPING':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-bold glow-emerald">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>BOOSTER PUMP ACTIVE</span>
          </div>
        );

      case 'LOW_WATER_VALVE_OPENING':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-bold">
            <Zap className="w-3.5 h-3.5 animate-spin" />
            <span>VALVE OPENING (5s Delay)</span>
          </div>
        );

      case 'PUMP_STOPPING_DELAY':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full text-xs font-bold">
            <Zap className="w-3.5 h-3.5" />
            <span>PUMP STOPPING (5s Delay)</span>
          </div>
        );

      case 'FREEZE_DRAINED_STANDBY':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded-full text-xs font-bold">
            <ThermometerSnowflake className="w-3.5 h-3.5 text-blue-400" />
            <span>FREEZE STANDBY (Pipe Drained)</span>
          </div>
        );

      case 'WARM_PREFILL_STANDBY':
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/40 rounded-full text-xs font-bold">
            <Gauge className="w-3.5 h-3.5" />
            <span>PRE-FILL STANDBY (Valve Open)</span>
          </div>
        );

      default:
        return (
          <div className="flex items-center space-x-2 px-3 py-1 bg-slate-800 text-slate-300 border border-slate-700 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>TANK FULL (Idle)</span>
          </div>
        );
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
      {/* Top SCADA Brand & Status Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Brand Identification */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/30 glow-cyan">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-extrabold text-slate-100 text-lg tracking-tight">TWEEDPUMP</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                SCADA v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Route 9W Pumphouse <span className="text-slate-600">➔</span> Tweed Blvd Storage Tank Controller
            </p>
          </div>
        </div>

        {/* Live Status Badge */}
        <div className="flex items-center space-x-3">
          {getStatusBadge()}

          {/* Speed Multiplier */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-[10px] text-slate-400 font-mono px-1.5 uppercase font-semibold">Speed:</span>
            {[1, 5, 10, 60].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-1 rounded-lg font-mono font-bold transition ${
                  simSpeed === spd
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Password Security Unlock Button */}
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            aria-label="Toggle Password Security Lock"
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-md ${
              isAuthenticated
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            {isAuthenticated ? (
              <>
                <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Unlocked</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Passcode Lock</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/80">
        <nav className="flex space-x-2 py-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('visualization')}
            aria-label="Pump & System Visualization Tab"
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'visualization'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Pump & System Visualization</span>
          </button>

          <button
            onClick={() => setActiveTab('controls')}
            aria-label="Sensors & Telemetry Control Tab"
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'controls'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Sensors & Control</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            aria-label="Logic Simulation View Tab"
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'simulation'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PlayCircle className="w-4 h-4 text-cyan-400" />
            <span>Logic Simulation View</span>
          </button>

          <button
            onClick={() => setActiveTab('wiring')}
            aria-label="Wiring Diagram & Schematic Tab"
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'wiring'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Wiring Diagram & Schematic</span>
          </button>

          <button
            onClick={() => setActiveTab('instructions')}
            aria-label="Guide & Instructions Tab"
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === 'instructions'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Guide & Instructions</span>
          </button>
        </nav>
      </div>

      {/* Password Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
