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

  const handleExportCSV = () => {
    const csvRows = [
      ["Subsystem / Module", "Pin / Terminal", "Signal Name", "Connected Device", "Interface Range", "Function Description"],
      ["Raspberry Pi PLC", "5.0V USB Port", "5.0V DC Power In", "WYZE WiFi Smart Relay", "5.0V DC Input", "Main PLC Controller Power. WYZE relay allows remote power cycle/reboot over Wi-Fi."],
      ["FCS521 Current Sensor", "Analog In A0", "Pump AC Current (0-50A)", "2/3 Voltage Divider -> Pi GPIO", "0-3.33V DC (from 0-5V Transducer)", "Monitors booster pump motor current. Low <15A (1.00V pin) / High >30A (2.00V pin) cutoff."],
      ["Flylin Pressure Sensor 1", "Analog In A1", "City Water Pressure (0-100 PSI)", "Flylin #202216-1 (ASIN B0BM6F4QSJ)", "0.33-3.00V DC (via 2/3 Divider)", "Monitors municipal incoming pressure. Low pressure alarm <35 PSI (1.27V pin)."],
      ["Flylin Pressure Sensor 2", "Analog In A2", "Fill Pipe Pressure (0-200 PSI)", "Flylin 200 PSI Transducer", "0.33-3.00V DC (via 2/3 Divider)", "Monitors fill pipe pressure. Static 1.07V pin / Pumping 1.87V pin / Drained 0.33V pin."],
      ["SSR-1 Valve Driver", "GPIO Pin 17", "3.3VDC Trigger Out", "110VAC Solenoids (Line & Drain)", "3.3VDC In / 110VAC Out", "Solid state relay switching 110VAC to NC Line Valve & NO Drain Valve solenoids."],
      ["SSR-2 Pump Driver", "GPIO Pin 27", "3.3VDC Trigger Out", "110VAC Pump Relay Coil (K2)", "3.3VDC In / 110VAC Out", "Solid state relay energizing 110VAC Coil of Heavy-Duty Booster Pump Relay."],
      ["Heavy Duty Pump Relay", "110VAC Coil", "230V/110V Motor Contact", "Route 9W Booster Pump Motor", "230V/110V AC High Current", "Power contactor switching main AC power to 9W booster pump motor."],
      ["5V Opto-Relay Board", "GPIO Pin 22", "3.3VDC Trigger Out", "Alarm Horn / Siren", "5V DC Coil / Dry Contact", "Opto-isolated relay switching local pumphouse alarm horn."],
      ["DHT11 Temp Sensor 1", "GPIO Pin D1", "Single-Wire Digital In", "Outside Ambient Sensor", "Digital Single-Wire", "Monitors outside temperature for freeze protection (<= 45°F / 7.2°C)."],
      ["DHT11 Temp Sensor 2", "GPIO Pin D5", "Single-Wire Digital In", "Inside Pumphouse Sensor", "Digital Single-Wire", "Monitors inside pumphouse climate."],
      ["Tank Isolation Relays", "GPIO Pins D1-D5", "Isolated Dry Contacts", "110VAC Field Float Coils", "110VAC Coils / 3.3V Dry Contact", "Field float switches energize 110VAC coils, closing dry contacts connected to Pi GPIOs."]
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Tweedpump_Wiring_Pinouts_Parts_List.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            <span>Export PDF Schematic</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export CSV Spreadsheet</span>
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
                name: 'Raspberry Pi PLC Controller (5.0V USB Powered)',
                type: '3.3V DC GPIO / 5.0V USB Power Input',
                detail: 'Raspberry Pi acts directly as the main SCADA PLC controller. Powered independently by a 5.0V DC USB plug-in power supply. Controls 110VAC SSR drivers & reads transducer/relay inputs.'
              },
              {
                id: 'WYZE_RELAY',
                name: 'WYZE WiFi Relay & 5.0V Power Supply',
                type: '110VAC Line / 5.0VDC USB Output',
                detail: 'Plug-in 5.0V DC USB power supply plugged into a WYZE WiFi Smart Relay. Allows remote power cycling & hard reboot of the Raspberry Pi controller over Wi-Fi.'
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
                id: 'POWER_BUCK',
                name: '12V Power Supply & 5V Buck Converter',
                type: '12VDC Supply / 5VDC Step-Down Buck Converter',
                detail: '12V DC plug-in power adapter feeding a DC-DC buck converter that steps down 12V to regulated 5V DC to power the multichannel opto-relay boards.'
              },
              {
                id: 'BATTERY_UPS',
                name: '12V Lead-Acid Battery & AC Inverter UPS',
                type: '12V Battery / Transfer Relay / 110VAC Inverter',
                detail: 'Automatic AC failure backup system. If utility AC fails, a power transfer relay switches over to a 12V lead-acid battery driving a 110VAC inverter to keep system online.'
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
                id: 'DHT11_TEMP',
                name: 'Dual DHT11 Temperature Sensors',
                type: 'Digital Inputs D1 & D5 (Single-Wire)',
                detail: 'Two DHT11 (DH-11) digital temperature sensors. D1: Outside ambient sensor monitoring freeze protection threshold (<= 45°F / 7.2°C). D5: Pump room inside ambient sensor monitoring pumphouse interior climate.'
              },
              {
                id: 'TANK_FLOATS',
                name: 'Tweed Tank Floats & Sensor Isolation Relays',
                type: '110VAC Relay Coils / Dry Contact GPIO Inputs D1-D5',
                detail: 'Field float switches & sensors energize 110VAC Relay Coils. The isolated dry contacts on the relay output side connect directly to Raspberry Pi 3.3V DC GPIO digital inputs (D1-D5).'
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
            <span className="text-xs font-mono text-slate-400">5.0V USB Pi Power / WYZE WiFi Reboot / 110VAC Power</span>
          </div>

          {/* Graphical Schematic Diagram Canvas */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative overflow-x-auto min-h-[460px] font-mono text-xs">
            <div className="min-w-[650px] space-y-6">
              {/* Terminal Block 1: Power, 12V Battery UPS, AC Inverter & 5V Buck Converter */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB1: MAIN AC POWER, 12V BATTERY UPS, AC INVERTER & 5V BUCK CONVERTER</span>
                  <span className="text-slate-500 text-[10px]">110VAC Line / 12V Battery UPS Inverter / 5V Buck Converter</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950 border border-red-500/30 text-red-400 rounded-lg text-center">
                    <span className="block font-bold">TB1-1</span>
                    <span className="text-[9px] text-slate-400">110VAC Line / Inverter Feed</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-amber-500/30 text-amber-300 rounded-lg text-center">
                    <span className="block font-bold">TB1-2</span>
                    <span className="text-[9px] text-slate-400">12V Lead-Acid Battery & Relay</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-cyan-500/30 text-cyan-300 rounded-lg text-center">
                    <span className="block font-bold">TB1-3</span>
                    <span className="text-[9px] text-slate-400">12V Supply -&gt; 5V Buck Converter</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-emerald-500/30 text-emerald-400 rounded-lg text-center">
                    <span className="block font-bold">TB1-4</span>
                    <span className="text-[9px] text-slate-400">WYZE WiFi Relay (Pi Reboot)</span>
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

              {/* Terminal Block 3: Solid State Relays & 5V Multichannel Opto-Relay Board */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB3: OUTPUT DRIVERS (110VAC SSRs & 5V OPTO-RELAY BOARD)</span>
                  <span className="text-slate-500 text-[10px]">110VAC Solenoids & 5V Multichannel Opto Relays</span>
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
                      <span>5V Relay Board (Alarm Horn)</span>
                      <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 rounded">5V Coil Opto-Relay</span>
                    </div>
                    <p className="text-[9px] text-slate-400">GPIO Pin 22 HIGH -&gt; 5V Coil Opto Relay Channel</p>
                    <p className="text-[9px] text-rose-400">Switches Alarm Horn (No SSR - Direct 5V Relay Switch)</p>
                  </div>
                </div>
              </div>

              {/* Terminal Block 4: Digital Sensor Input Relays (110VAC Coils / Dry Contact Pi Inputs) */}
              <div className="border border-slate-800 bg-slate-900/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800 pb-1.5">
                  <span>TB4: DIGITAL SENSOR INPUT RELAYS (110VAC COILS / DRY CONTACT GPIO)</span>
                  <span className="text-slate-500 text-[10px]">110VAC Coils Energize Isolated 3.3V Pi GPIO Dry Contacts</span>
                </div>

                <div className="grid grid-cols-5 gap-2 text-[11px]">
                  <div className="p-2 bg-slate-950 border border-blue-500/40 text-blue-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D1</span>
                    <span className="text-[9px] text-slate-400">Outside DHT11 (110VAC Relay)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-amber-500/40 text-amber-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D2</span>
                    <span className="text-[9px] text-slate-400">High Float (110VAC Coil)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-rose-500/40 text-rose-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D3</span>
                    <span className="text-[9px] text-slate-400">Low Float (110VAC Coil)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-purple-500/40 text-purple-300 rounded-lg text-center">
                    <span className="block font-bold">TB4-D4</span>
                    <span className="text-[9px] text-slate-400">Bottom Float (110VAC Coil)</span>
                  </div>
                  <div className="p-2 bg-slate-950 border border-amber-400/40 text-amber-200 rounded-lg text-center">
                    <span className="block font-bold">TB4-D5</span>
                    <span className="text-[9px] text-slate-400">Indoor DHT11 (110VAC Relay)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Raspberry Pi 40-Pin GPIO Header Pinout Guide */}
          <div className="border border-slate-800 bg-slate-950 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-extrabold uppercase text-cyan-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> Raspberry Pi 40-Pin GPIO Pinout Guide (Route 9W Panel Mapping)
              </h4>
              <span className="text-[10px] font-mono text-slate-400">3.3V Logic Level • BCM Pin Numbering</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="p-2 text-right">Physical Pin</th>
                    <th className="p-2 text-right">Signal / Name</th>
                    <th className="p-2 text-center bg-slate-800/80 text-cyan-300">Connected Hardware / Wiring Function</th>
                    <th className="p-2 text-left">Signal / Name</th>
                    <th className="p-2 text-left">Physical Pin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-rose-400 font-bold">Pin 1</td>
                    <td className="p-2 text-right text-rose-300">3.3V Power</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">3.3V Reference / Pull-Up Resistor Power Rail</td>
                    <td className="p-2 text-left text-amber-400 font-bold">5.0V Power</td>
                    <td className="p-2 text-left text-amber-400 font-bold">Pin 2</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-cyan-300 font-bold">Pin 3</td>
                    <td className="p-2 text-right text-cyan-300">GPIO 2 (SDA)</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">ADS1115 ADC Sensor Bus SDA (Transducers)</td>
                    <td className="p-2 text-left text-amber-400 font-bold">5.0V Power</td>
                    <td className="p-2 text-left text-amber-400 font-bold">Pin 4</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-cyan-300 font-bold">Pin 5</td>
                    <td className="p-2 text-right text-cyan-300">GPIO 3 (SCL)</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">ADS1115 ADC Sensor Bus SCL (Transducers)</td>
                    <td className="p-2 text-left text-slate-500">Ground</td>
                    <td className="p-2 text-left text-slate-500 font-bold">Pin 6</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-emerald-400 font-bold">Pin 7</td>
                    <td className="p-2 text-right text-emerald-300">GPIO 4</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Outdoor Freeze Temp Sensor D1 (Single-Wire)</td>
                    <td className="p-2 text-left text-slate-400">GPIO 14 (TX)</td>
                    <td className="p-2 text-left text-slate-400 font-bold">Pin 8</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-slate-500">Ground</td>
                    <td className="p-2 text-right text-slate-500">Ground</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Common System Ground Rail</td>
                    <td className="p-2 text-left text-slate-400">GPIO 15 (RX)</td>
                    <td className="p-2 text-left text-slate-400 font-bold">Pin 10</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-cyan-400 font-bold">Pin 11</td>
                    <td className="p-2 text-right text-cyan-300">GPIO 17</td>
                    <td className="p-2 text-center text-emerald-400 font-bold bg-slate-900/40">SSR-1 Solenoid Valve Control (NC Line / NO Drain)</td>
                    <td className="p-2 text-left text-cyan-300 font-bold">GPIO 18</td>
                    <td className="p-2 text-left text-cyan-400 font-bold">Pin 12</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-cyan-400 font-bold">Pin 13</td>
                    <td className="p-2 text-right text-cyan-300">GPIO 27</td>
                    <td className="p-2 text-center text-cyan-400 font-bold bg-slate-900/40">SSR-2 Heavy-Duty Booster Pump Relay Pilot Output</td>
                    <td className="p-2 text-left text-slate-500">Ground</td>
                    <td className="p-2 text-left text-slate-500 font-bold">Pin 14</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-rose-400 font-bold">Pin 15</td>
                    <td className="p-2 text-right text-rose-300">GPIO 22</td>
                    <td className="p-2 text-center text-rose-400 font-bold bg-slate-900/40">5V Opto-Relay Channel (Alarm Horn Trigger)</td>
                    <td className="p-2 text-left text-amber-300 font-bold">GPIO 23</td>
                    <td className="p-2 text-left text-amber-400 font-bold">Pin 16</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-rose-400 font-bold">Pin 17</td>
                    <td className="p-2 text-right text-rose-300">3.3V Power</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">TB4 Relay Isolated Contact 3.3V DC Power Bus</td>
                    <td className="p-2 text-left text-amber-300 font-bold">GPIO 24</td>
                    <td className="p-2 text-left text-amber-400 font-bold">Pin 18</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-amber-300 font-bold">Pin 19</td>
                    <td className="p-2 text-right text-amber-300">GPIO 10</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">High Float Switch (TB4-D2 110VAC Relay Contact)</td>
                    <td className="p-2 text-left text-slate-500">Ground</td>
                    <td className="p-2 text-left text-slate-500 font-bold">Pin 20</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-rose-300 font-bold">Pin 21</td>
                    <td className="p-2 text-right text-rose-300">GPIO 9</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Low Float Switch (TB4-D3 110VAC Relay Contact)</td>
                    <td className="p-2 text-left text-purple-300 font-bold">GPIO 25</td>
                    <td className="p-2 text-left text-purple-400 font-bold">Pin 22</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-purple-300 font-bold">Pin 22</td>
                    <td className="p-2 text-right text-purple-300">GPIO 25</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Bottom Float Switch (TB4-D4 110VAC Relay Contact)</td>
                    <td className="p-2 text-left text-slate-400">GPIO 8</td>
                    <td className="p-2 text-left text-slate-400 font-bold">Pin 24</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-slate-500">Ground</td>
                    <td className="p-2 text-right text-slate-500">Ground</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Common Ground Return</td>
                    <td className="p-2 text-left text-amber-300 font-bold">GPIO 5</td>
                    <td className="p-2 text-left text-amber-400 font-bold">Pin 29</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50">
                    <td className="p-2 text-right text-amber-400 font-bold">Pin 29</td>
                    <td className="p-2 text-right text-amber-300">GPIO 5</td>
                    <td className="p-2 text-center text-slate-300 bg-slate-900/40">Pumphouse Indoor Temp Sensor D5 (Single-Wire)</td>
                    <td className="p-2 text-left text-slate-500">Ground</td>
                    <td className="p-2 text-left text-slate-500 font-bold">Pin 30</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
