import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { SystemState } from '../types/telemetry';
import {
  PlayCircle,
  FastForward,
  Activity,
  Clock,
  Trash2,
  Copy,
  Check
} from 'lucide-react';

export const LogicSimulationView: React.FC = () => {
  const {
    systemState,
    simSpeed,
    setSimSpeed,
    eventLogs,
    clearEventLogs,
    triggerScenario
  } = useTelemetry();

  const [copiedLogs, setCopiedLogs] = useState(false);
  const [filterType, setFilterType] = useState<string>('ALL');

  const copyLogHistory = () => {
    const text = eventLogs
      .map((l) => `[${l.timestamp}] [${l.type}] [${l.state}]: ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const filteredLogs = eventLogs.filter((log) => {
    if (filterType === 'ALL') return true;
    return log.type === filterType;
  });

  // State Machine Node definitions for Visualizer
  const stateNodes: { id: SystemState; name: string; description: string }[] = [
    {
      id: 'IDLE_FULL',
      name: '1. Tank Full (Idle)',
      description: 'Tank level >= 95%. Line valve closed, drain valve open, pipe drained.'
    },
    {
      id: 'LOW_WATER_VALVE_OPENING',
      name: '2. Valve Opening Delay',
      description: 'Low float switch closed (< 50%). Relay energized, 5s booster pump delay.'
    },
    {
      id: 'PUMPING',
      name: '3. Booster Pumping',
      description: 'Booster pump active. Water ascending 9W fill pipe to Tweed tank.'
    },
    {
      id: 'PUMP_STOPPING_DELAY',
      name: '4. Pump Stopping Delay',
      description: 'High float opened (>= 95%). Pump stopped, 5s line valve close delay.'
    },
    {
      id: 'WARM_PREFILL_STANDBY',
      name: '5. Non-Freezing Pre-Fill',
      description: 'Level < 95%, Temp > 45°F (Warm). Line valve open for pre-fill.'
    },
    {
      id: 'FREEZE_DRAINED_STANDBY',
      name: '6. Freezing Pipe Drained',
      description: 'Level < 95%, Temp <= 45°F (Freezing). Line valve closed, pipe drained.'
    },
    {
      id: 'FAULT_TRIPPED',
      name: '7. Fault Alarm Tripped',
      description: 'Pump protection cutoff (20m timeout, undercurrent <15A, or overcurrent >30A).'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Scenario Presets */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <PlayCircle className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">
                Interactive Logic Simulation Suite
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Test 5s line valve delays, 20-min timeouts, anti-freeze pipe drainage, and fault cutoffs.
            </p>
          </div>

          {/* Speed Controls */}
          <div className="flex items-center space-x-2 bg-slate-950 p-2 rounded-2xl border border-slate-800">
            <FastForward className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-300 mr-2">Sim Speed:</span>
            {[1, 5, 10, 60].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                  simSpeed === spd
                    ? 'bg-cyan-500 text-slate-950 font-black shadow'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Preset Simulation Scenarios */}
        <div>
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-3">
            One-Click Scenario Preset Triggers
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Scenario 1 */}
            <button
              onClick={() => triggerScenario('NORMAL_FILL_CYCLE')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-cyan-400 group-hover:text-cyan-300 block">
                1. Normal Tank Fill Sequence
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Ambient 65°F (Warm). Tank level drops below 50% (Low Float drops down). Valve opens, 5s delay, pump fills tank to High Float (95%), 5s delay, valve closes.
              </p>
            </button>

            {/* Scenario 2 */}
            <button
              onClick={() => triggerScenario('FREEZE_DROPDOWN_PREVENTION')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 block">
                2. Freeze Drop Prevention (&lt;= 45°F)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Ambient 34°F (Freezing). Tank drops below 95%. Line valve remains CLOSED and drain stays OPEN to prevent standing pipe freeze.
              </p>
            </button>

            {/* Scenario 3 */}
            <button
              onClick={() => triggerScenario('WARM_DROPDOWN_PREFILL')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-emerald-400 group-hover:text-emerald-300 block">
                3. Non-Freezing Pre-Fill (&gt; 45°F)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Ambient 58°F (Warm). Tank drops below 95%. Line valve REOPENS to allow municipal pressure top-off without pump.
              </p>
            </button>

            {/* Scenario 4 */}
            <button
              onClick={() => triggerScenario('PUMP_TIMEOUT_TEST')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300 block">
                4. 20m Overrun Cutoff & 2h Auto-Reset
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Simulates pump running 19m 55s. Triggers 20-min cutoff. Authorized operator can reset immediately, or system auto-resets in 2 hours.
              </p>
            </button>

            {/* Scenario 5 */}
            <button
              onClick={() => triggerScenario('UNDERCURRENT_DRYRUN_TEST')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-rose-400 group-hover:text-rose-300 block">
                5. Low Current Dry Run (&lt; 15.0A)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Simulates loss of water suction / air lock while pumping (10.5A). Energizes Alarm Relay and trips undercurrent shutdown.
              </p>
            </button>

            {/* Scenario 6 */}
            <button
              onClick={() => triggerScenario('OVERCURRENT_STALL_TEST')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-purple-400 group-hover:text-purple-300 block">
                6. Motor Overload Stall (&gt; 30.0A)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Simulates motor rotor stall or deadhead overpressure (35.2A). Energizes Alarm Relay and trips overcurrent shutdown.
              </p>
            </button>

            {/* Scenario 7 */}
            <button
              onClick={() => triggerScenario('LOW_MUNICIPAL_PRESSURE_TEST')}
              className="p-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 rounded-2xl text-left transition group space-y-1"
            >
              <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 block">
                7. Low Municipal Pressure (&lt; 35 PSI)
              </span>
              <p className="text-[11px] text-slate-400 leading-normal">
                Simulates city main supply pressure drop to 22 PSI. Energizes Alarm Relay and isolates pump & line valve.
              </p>
            </button>
          </div>
        </div>
      </div>

      {/* Logic State Machine Visualizer */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" /> State Machine Execution Flow
          </h3>
          <span className="text-xs font-mono font-bold text-cyan-400">
            Current State: {systemState}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {stateNodes.map((node) => {
            const isActive = systemState === node.id;
            return (
              <div
                key={node.id}
                className={`p-3.5 rounded-2xl border transition relative overflow-hidden ${
                  isActive
                    ? node.id === 'FAULT_TRIPPED'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-200 glow-rose ring-2 ring-rose-500'
                      : 'bg-cyan-500/20 border-cyan-400 text-cyan-100 glow-cyan ring-2 ring-cyan-400'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400 opacity-70'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400 animate-pulse" />
                )}
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>{node.name}</span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 bg-cyan-400 text-slate-950 text-[9px] font-black uppercase rounded">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="text-[10px] leading-relaxed text-slate-400">{node.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* SCADA Telemetry Stream Event Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100">SCADA Real-Time Telemetry Event Log</h3>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            {/* Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-xl font-mono focus:outline-none"
            >
              <option value="ALL">All Event Types</option>
              <option value="SEQUENCE">SEQUENCE</option>
              <option value="ALERT">ALERT / FAULT</option>
              <option value="WARNING">WARNING</option>
              <option value="USER_ACTION">USER ACTION</option>
            </select>

            <button
              onClick={copyLogHistory}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold rounded-xl flex items-center space-x-1 transition"
            >
              {copiedLogs ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLogs ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={clearEventLogs}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-rose-400 font-semibold rounded-xl flex items-center space-x-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Console Event Feed */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 font-mono text-xs max-h-80 overflow-y-auto space-y-2">
          {filteredLogs.length === 0 ? (
            <p className="text-slate-600 text-center py-4">No event logs recorded yet.</p>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start space-x-3 p-2 rounded-xl border border-slate-900 bg-slate-900/50 hover:bg-slate-900 transition"
              >
                <span className="text-slate-500 text-[10px] shrink-0 mt-0.5">{log.timestamp}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                    log.type === 'ALERT'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : log.type === 'WARNING'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : log.type === 'SEQUENCE'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {log.type}
                </span>
                <span className="text-slate-300 leading-relaxed text-[11px]">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
