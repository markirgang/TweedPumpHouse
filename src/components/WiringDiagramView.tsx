import React, { useState } from 'react';
import {
  FileText,
  Zap,
  Cpu,
  Layers,
  CheckCircle2,
  Printer,
  Download,
  Shield,
  Gauge,
  ThermometerSnowflake,
  Bell,
  Droplet
} from 'lucide-react';

export const WiringDiagramView: React.FC = () => {
  const [selectedComponent, setSelectedComponent] = useState<string>('FCS521');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">
              Electrical Wiring Schematic & Terminal Pinouts
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Route 9W Pumphouse Panel, FCS521 current transducer, 2/3 resistor voltage divider for 3.3V Pi GPIO, Flylin pressure sensors, shared valve relay, and Tweed Blvd tank telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Schematic</span>
          </button>
        </div>
      </div>

      {/* Main Terminal & Component Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Component Inspector List */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
            Panel Subsystems & Wiring Details
          </h3>

          <div className="space-y-2">
            {[
              {
                id: 'RASPBERRY_PI',
                name: 'Raspberry Pi Controller (3.3VDC GPIO)',
                type: '3.3V DC Digital Logic',
                detail: 'Raspberry Pi core controller. Outputs 3.3V DC GPIO signals to drive Solid State Relays (SSRs). Inputs read float switches & ADC transducer voltages.'
              },
              {
                id: 'VALVE_SSR',
                name: '110VAC SSR - Valve Driver',
                type: 'SSR-1 (3.3VDC In / 110VAC Out)',
                detail: 'Solid State Relay triggered by Raspberry Pi 3.3V DC GPIO Pin 17. Directly switches 110V AC power to drive both the 110VAC Line Valve & 110VAC Drain Valve solenoids.'
              },
              {
                id: 'PUMP_SSR',
                name: '110VAC SSR - Pump Relay Pilot',
                type: 'SSR-2 (3.3VDC In / 110VAC Out)',
                detail: 'Solid State Relay triggered by Raspberry Pi 3.3V DC GPIO Pin 27. Switches 110V AC to energize the 110V AC Coil of the Heavy-Duty Booster Pump Relay.'
              },
              {
                id: 'PUMP_RELAY',
                name: 'Heavy-Duty Pump Relay (110VAC Coil)',
                type: 'Relay K2 (110VAC Coil)',
                detail: 'Heavy-duty power relay with 110V AC Coil energized by SSR-2. Switches 230V/110V AC main power to the Route 9W booster pump motor.'
              },
              {
                id: 'FCS521',
                name: 'FCS521 Current Sensor (0-50A AC)',
                type: 'Analog Input A0 (2/3 Divider: 0-3.33V)',
                detail: 'Monitors pump motor AC current. Transducer 0-5V DC scaled by 2/3 resistor divider to 0-3.33V DC for 3.3V Pi GPIO. Undercurrent cutoff <15A (1.00V pin), Overcurrent cutoff >30A (2.00V pin).'
              },
              {
                id: 'PRESSURE_SENSORS',
                name: 'Flylin Pressure Transducers',
                type: 'Analog Inputs A1 & A2 (2/3 Divider: 0.33-3.00V)',
                detail: 'Flylin 5V transducers scaled by 2/3 resistor divider for 3.3V Pi GPIO. A1: Municipal (Flylin #202216-1, ASIN B0BM6F4QSJ, low alarm <35 PSI / 1.27V pin). A2: Fill Pipe (Flylin 200 PSI, 0.33V-3.00V pin).'
              },
              {
                id: 'TANK_FLOATS',
                name: 'Tweed Blvd Storage Tank Floats',
                type: 'Digital Inputs D2, D3, D4',
                detail: 'D2: High Float (95%). D3: Low Float (50% - Floating UP when >= 50%). D4: Bottom Float (0% Empty).'
              }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedComponent(item.id)}
                className={`w-full p-3 rounded-2xl border text-left transition space-y-1 ${
                  selectedComponent === item.id
                    ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200 glow-cyan ring-1 ring-cyan-500'
                    : 'bg-slate-950 border-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{item.name}</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {item.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">{item.detail}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Schematic Diagram & Pinout Visualizer */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" /> Route 9W Control Panel Wiring Schematic
            </h3>
            <span className="text-xs font-mono text-slate-400">24V DC Logic / 230V AC Power</span>
          </div>

          {/* Graphical Schematic Diagram Canvas */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-x-auto min-h-[460px] font-mono text-xs">
            <div className="min-w-[650px] space-y-6">
              {/* Terminal Block 1: Power & Controller Board */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB1: MAIN POWER & PLC CONTROLLER TERMINALS</span>
                  <span className="text-slate-500 text-[10px]">230VAC / 24VDC / 5VDC</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950 border border-red-500/30 text-red-400 rounded-lg text-center">
                    <span className="block font-bold">TB1-1</span>
                    <span className="text-[9px] text-slate-400">+24V DC</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-slate-700 text-slate-300 rounded-lg text-center">
                    <span className="block font-bold">TB1-2</span>
                    <span className="text-[9px] text-slate-400">GND (24V)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-amber-500/30 text-amber-400 rounded-lg text-center">
                    <span className="block font-bold">TB1-3</span>
                    <span className="text-[9px] text-slate-400">+5V DC (Transducers)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-emerald-500/30 text-emerald-400 rounded-lg text-center">
                    <span className="block font-bold">TB1-4</span>
                    <span className="text-[9px] text-slate-400">EARTH GND</span>
                  </div>
                </div>
              </div>

              {/* Terminal Block 2: Analog Transducer Inputs */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB2: ANALOG TRANSDUCER INPUTS (2/3 DIVIDER -&gt; 3.3V Pi GPIO)</span>
                  <span className="text-slate-500 text-[10px]">FCS521 & Flylin Pressure Sensors</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-950 border border-amber-500/40 text-amber-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>TB2-A0</span>
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 rounded">FCS521</span>
                    </div>
                    <p className="text-[9px] text-slate-400">Pump Current (0-50A AC = 0-3.33V Pin via 2/3 Divider)</p>
                    <p className="text-[9px] text-cyan-400">Low &lt;1.00V (15A) | High &gt;2.00V (30A)</p>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-blue-500/40 text-blue-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>TB2-A1</span>
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1 rounded">Flylin 202216-1</span>
                    </div>
                    <p className="text-[9px] text-slate-400">City Water Pressure (Flylin 0.33-3.00V Pin via 2/3 Divider)</p>
                    <p className="text-[9px] text-cyan-400">Low Pressure Alarm &lt;1.27V (35 PSI)</p>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-cyan-500/40 text-cyan-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>TB2-A2</span>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">Flylin 200 PSI</span>
                    </div>
                    <p className="text-[9px] text-slate-400">Fill Pipe Line Pressure (Flylin 0.33-3.00V Pin via 2/3 Divider)</p>
                    <p className="text-[9px] text-cyan-400">0.33V Drained | 1.07V Static | 1.87V Pump</p>
                  </div>
                </div>
              </div>

              {/* Terminal Block 3: Solid State Relays & Actuator Drivers */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB3: SOLID STATE RELAYS (3.3VDC GPIO CONTROL / 110VAC POWER)</span>
                  <span className="text-slate-500 text-[10px]">110VAC Solenoids & 110VAC Relay Coil</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2.5 bg-slate-950 border border-emerald-500/40 text-emerald-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>SSR-1 (Valves)</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">3.3VDC / 110VAC</span>
                    </div>
                    <p className="text-[9px] text-slate-400">GPIO Pin 17 (3.3VDC) -&gt; 110VAC SSR Output</p>
                    <p className="text-[9px] text-emerald-400">Drives 110VAC Solenoids: NC Line & NO Drain</p>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-cyan-500/40 text-cyan-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>SSR-2 (Pump)</span>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 rounded">3.3VDC / 110VAC</span>
                    </div>
                    <p className="text-[9px] text-slate-400">GPIO Pin 27 (3.3VDC) -&gt; 110VAC SSR Output</p>
                    <p className="text-[9px] text-cyan-400">Energizes 110VAC Coil Heavy Duty Pump Relay</p>
                  </div>

                  <div className="p-2.5 bg-slate-950 border border-rose-500/40 text-rose-300 rounded-xl space-y-1">
                    <div className="font-bold flex justify-between">
                      <span>SSR-3 (Alarm)</span>
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded">3.3VDC / 110VAC</span>
                    </div>
                    <p className="text-[9px] text-slate-400">GPIO Pin 22 (3.3VDC) -&gt; 110VAC Alarm Relay</p>
                    <p className="text-[9px] text-rose-400">Horn/Siren (Silenceable with 5100 auth)</p>
                  </div>
                </div>
              </div>

              {/* Terminal Block 4: Digital Sensor Inputs (Freeze & Tank Floats) */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB4: DIGITAL SENSOR INPUTS (DRY CONTACTS)</span>
                  <span className="text-slate-500 text-[10px]">Pumphouse Ambient & Tweed Blvd Tank</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950 border border-blue-500/40 text-blue-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D1</span>
                    <span className="text-[9px] text-slate-400">Outside Freeze (45°F)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-amber-500/40 text-amber-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D2</span>
                    <span className="text-[9px] text-slate-400">High Float (95% Full)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-rose-500/40 text-rose-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D3</span>
                    <span className="text-[9px] text-slate-400">Low Float (50% Level)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-purple-500/40 text-purple-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D4</span>
                    <span className="text-[9px] text-slate-400">Bottom Float (0% Empty)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
