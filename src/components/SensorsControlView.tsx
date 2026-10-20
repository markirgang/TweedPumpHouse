import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { ControlOverrides, SystemMode } from '../types/telemetry';
import {
  Lock,
  Unlock,
  Sliders,
  Zap,
  Key,
  ShieldAlert,
  Droplet,
  Bell,
  Volume2,
  VolumeX
} from 'lucide-react';

export const SensorsControlView: React.FC = () => {
  const {
    sensors,
    overrides,
    updateOverride,
    resetAllOverrides,
    isAuthenticated,
    authenticate,
    setTankLevel,
    setOutsideTemp,
    setInsideTemp,
    activeFault,
    resetFault,
    simulateFault
  } = useTelemetry();

  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (!authenticate(passwordInput)) {
      setPasswordError('Invalid passcode! Default passcode is 5100.');
    } else {
      setPasswordInput('');
    }
  };

  const renderTriStateSwitch = (
    label: string,
    description: string,
    overrideKey: keyof ControlOverrides,
    currentValue: SystemMode
  ) => {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-100">{label}</h4>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
          <span
            className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border ${
              currentValue === 'AUTO'
                ? 'bg-slate-800 text-cyan-300 border-cyan-500/30'
                : currentValue === 'MANUAL_ON'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            }`}
          >
            {currentValue}
          </span>
        </div>

        {/* Tri-State Radio Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          {(['AUTO', 'MANUAL_ON', 'MANUAL_OFF'] as SystemMode[]).map((mode) => (
            <button
              key={mode}
              disabled={!isAuthenticated}
              onClick={() => updateOverride(overrideKey, mode)}
              className={`py-2 px-3 rounded-xl text-xs font-bold font-mono transition border ${
                !isAuthenticated
                  ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                  : currentValue === mode
                    ? mode === 'AUTO'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold shadow-md'
                      : mode === 'MANUAL_ON'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold shadow-md'
                        : 'bg-rose-500 text-slate-950 border-rose-400 font-extrabold shadow-md'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              {mode === 'MANUAL_ON' ? 'ON' : mode === 'MANUAL_OFF' ? 'OFF' : 'AUTO'}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">
              Sensors & Actuators Control Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manual override panel for switches, line valve relay, booster pump, and telemetry simulation.
          </p>
        </div>

        {/* Password Security Status Banner */}
        {isAuthenticated ? (
          <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-2xl">
            <Unlock className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="text-xs font-bold text-emerald-400 block">Overrides Unlocked</span>
              <span className="text-[10px] text-slate-400 font-mono">Authenticated Operator Session</span>
            </div>
            <button
              onClick={resetAllOverrides}
              className="ml-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold rounded-xl border border-slate-700 transition"
            >
              Reset to AUTO
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3 bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-2xl">
            <Lock className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-xs font-bold text-amber-400 block">Overrides Locked</span>
              <span className="text-[10px] text-slate-400">Passcode required to toggle switches</span>
            </div>
          </div>
        )}
      </div>

      {/* Security Lock Prompt (If not authenticated) */}
      {!isAuthenticated && (
        <div className="bg-slate-900/90 border-2 border-amber-500/30 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Key className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-100">Passcode Authentication Required</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter security passcode to gain manual override access to line valves, booster pump, and float switches.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto pt-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter security passcode"
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-center tracking-widest text-base focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-cyan-600/20"
              >
                Unlock Overrides
              </button>
            </form>

            {passwordError && (
              <p className="text-xs text-rose-400 font-semibold animate-in fade-in">
                {passwordError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Switch Override Controls Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" /> Actuators & Relay Switch Overrides
          </h3>
          <span className="text-xs font-mono text-slate-400">Select AUTO / ON / OFF</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Switch 1: Line & Drain Valve Relay */}
          {renderTriStateSwitch(
            'Line Valve & Drain Relay',
            'Relay ON = Line Valve OPEN & Drain Valve CLOSED',
            'relayOverride',
            overrides.relayOverride
          )}

          {/* Switch 2: Booster Pump */}
          {renderTriStateSwitch(
            'Booster Pump Motor',
            'Booster Pump on Route 9W fill pipe',
            'pumpOverride',
            overrides.pumpOverride
          )}

          {/* Switch 3: High Water Float */}
          {renderTriStateSwitch(
            'High Water Float Switch',
            'Closed when level < 95% (tank needs water)',
            'highFloatOverride',
            overrides.highFloatOverride
          )}

          {/* Switch 4: Low Water Float */}
          {renderTriStateSwitch(
            'Low Water Float Switch',
            'Floating UP (OPEN) when level ≥ 50%. Closed when < 50%',
            'lowFloatOverride',
            overrides.lowFloatOverride
          )}

          {/* Switch 5: Bottom Float Switch */}
          {renderTriStateSwitch(
            'Bottom Float Switch (Empty)',
            'Closed when tank level falls to 0%',
            'bottomFloatOverride',
            overrides.bottomFloatOverride
          )}

          {/* Switch 6: Freeze Sensor Override */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-100">Freeze Sensor Override</h4>
                <p className="text-xs text-slate-400 mt-0.5">Threshold &le; 45°F (Outside Pumphouse)</p>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg border bg-slate-800 text-cyan-300 border-cyan-500/30">
                {overrides.freezeSensorOverride}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { id: 'AUTO', label: 'AUTO' },
                { id: 'FORCE_FREEZING', label: 'FREEZE' },
                { id: 'FORCE_WARM', label: 'WARM' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  disabled={!isAuthenticated}
                  onClick={() => updateOverride('freezeSensorOverride', opt.id as any)}
                  className={`py-2 px-2 rounded-xl text-[11px] font-bold font-mono transition border ${
                    !isAuthenticated
                      ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                      : overrides.freezeSensorOverride === opt.id
                        ? opt.id === 'FORCE_FREEZING'
                          ? 'bg-blue-500 text-slate-950 border-blue-400 font-extrabold'
                          : opt.id === 'FORCE_WARM'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                            : 'bg-cyan-500 text-slate-950 border-cyan-400 font-extrabold'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Environment Sensor Controls & Fault Testing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environmental Physics Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <Droplet className="w-4 h-4 text-cyan-400" /> Environmental Telemetry Simulation
          </h3>

          {/* Slider 1: Tank Water Level */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Tweed Blvd Tank Water Level</span>
              <span className="font-mono text-cyan-400 font-bold">{sensors.tankLevelPercent.toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={sensors.tankLevelPercent}
              onChange={(e) => setTankLevel(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0% (Bottom Float)</span>
              <span>50% (Low Float UP)</span>
              <span>95% (High Float)</span>
              <span>100% (Full)</span>
            </div>
          </div>

          {/* Slider 2: Outside Temperature (DHT11 #1) */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Outside Ambient Temperature (DHT11 #1)</span>
              <span className={`font-mono font-bold ${sensors.freezeSensorClosed ? 'text-cyan-400' : 'text-emerald-400'}`}>
                {sensors.outsideTempF.toFixed(1)}°F
              </span>
            </div>
            <input
              type="range"
              min="-10"
              max="90"
              step="1"
              value={sensors.outsideTempF}
              onChange={(e) => setOutsideTemp(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-10°F</span>
              <span className="text-cyan-400 font-bold">45°F Threshold</span>
              <span>90°F</span>
            </div>
          </div>

          {/* Slider 3: Pump Room Inside Temperature (DHT11 #2) */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-300">Pump Room Inside Temperature (DHT11 #2)</span>
              <span className="font-mono font-bold text-amber-300">
                {sensors.insideTempF.toFixed(1)}°F
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="110"
              step="1"
              value={sensors.insideTempF}
              onChange={(e) => setInsideTemp(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>20°F</span>
              <span>65°F (Normal)</span>
              <span>110°F</span>
            </div>
          </div>
        </div>

        {/* Fault Simulation & Protection Testing */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> Pump Protection Cutoff Testing
          </h3>

          <p className="text-xs text-slate-400">
            Simulate motor protection faults to test auto-shutoff logic:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => simulateFault('LOW_CURRENT_UNDERCURRENT')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-2xl text-left transition space-y-1"
            >
              <span className="text-xs font-bold text-amber-400 block">Undercurrent (&lt;15.0A)</span>
              <span className="text-[10px] text-slate-400 block">Dry run / air bound pump</span>
            </button>

            <button
              onClick={() => simulateFault('HIGH_CURRENT_OVERCURRENT')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/40 rounded-2xl text-left transition space-y-1"
            >
              <span className="text-xs font-bold text-rose-400 block">Overcurrent (&gt;30.0A)</span>
              <span className="text-[10px] text-slate-400 block">Motor stall / deadhead</span>
            </button>

            <button
              onClick={() => simulateFault('MAX_RUN_TIME_EXCEEDED')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 rounded-2xl text-left transition space-y-1"
            >
              <span className="text-xs font-bold text-cyan-400 block">20m Overrun Cutoff</span>
              <span className="text-[10px] text-slate-400 block">Auto-resets in 2 hours</span>
            </button>

            <button
              onClick={() => simulateFault('LOW_MUNICIPAL_PRESSURE')}
              className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/40 rounded-2xl text-left transition space-y-1"
            >
              <span className="text-xs font-bold text-blue-400 block">Low Pressure (&lt;35 PSI)</span>
              <span className="text-[10px] text-slate-400 block">City main drop alarm</span>
            </button>
          </div>

          {activeFault && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-rose-400 block flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-rose-400 animate-bounce" />
                  ALARM RELAY ENERGIZED: {activeFault}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {activeFault === 'MAX_RUN_TIME_EXCEEDED' && sensors.autoResetCountdownSeconds > 0
                    ? `Auto-resetting in ${Math.floor(sensors.autoResetCountdownSeconds / 3600)}h ${Math.floor((sensors.autoResetCountdownSeconds % 3600) / 60)}m ${Math.floor(sensors.autoResetCountdownSeconds % 60)}s (or reset manually with authorization code).`
                    : 'System isolated. Authorized operator required to reset fault.'}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  disabled={!isAuthenticated}
                  onClick={useTelemetry().silenceAlarm}
                  className={`px-3 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-1.5 ${
                    !isAuthenticated
                      ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                      : sensors.alarmSilenced
                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                  }`}
                >
                  {sensors.alarmSilenced ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{sensors.alarmSilenced ? 'Silenced' : 'Silence Horn'}</span>
                </button>

                <button
                  disabled={!isAuthenticated}
                  onClick={useTelemetry().resetFault}
                  className={`px-4 py-2 text-xs font-bold rounded-xl transition border ${
                    !isAuthenticated
                      ? 'opacity-50 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-600'
                      : 'bg-rose-600 hover:bg-rose-500 text-slate-950 border-rose-500 font-extrabold shadow-lg'
                  }`}
                >
                  Reset Cutoff
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
