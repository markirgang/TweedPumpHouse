import React, { useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/Header';
import { VisualizationView } from './components/VisualizationView';
import { SensorsControlView } from './components/SensorsControlView';
import { LogicSimulationView } from './components/LogicSimulationView';
import { WiringDiagramView } from './components/WiringDiagramView';

export const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'visualization' | 'controls' | 'simulation' | 'wiring'>('visualization');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top SCADA Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'visualization' && <VisualizationView />}
        {activeTab === 'controls' && <SensorsControlView />}
        {activeTab === 'simulation' && <LogicSimulationView />}
        {activeTab === 'wiring' && <WiringDiagramView />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800/80 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 font-mono">
          <div>
            Tweedpump Telemetry & SCADA Water Controller &copy; {new Date().getFullYear()}
          </div>
          <div>
            Route 9W Pumphouse <span className="text-cyan-500">➔</span> Fill Pipe <span className="text-cyan-500">➔</span> Tweed Blvd Storage Tank
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TelemetryProvider>
      <AppContent />
    </TelemetryProvider>
  );
};

export default App;
