import React from 'react';
import GlassCard from '../components/ui/GlassCard';
import { Terminal } from 'lucide-react';

interface ApiLogReaderProps {
  logs: any[]; // Or whatever type Dashboard uses
}

const ApiLogReader: React.FC<ApiLogReaderProps> = ({ logs }) => {
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
            <Terminal className="text-cyan-400 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">API Controller & Live Catch Log Reader</h2>
            <p className="text-xs text-gray-400">Real-time JSON Payload streams and HTTP headers</p>
          </div>
        </div>
        
        <div className="bg-black/40 rounded-xl border border-white/10 p-6 min-h-[400px] font-mono text-[10px] sm:text-xs">
          <p className="text-cyan-400 mb-4">// Live Stream Connected...</p>
          {logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-300">
                  <span className="text-purple-400 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {JSON.stringify(log)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Waiting for incoming API requests...</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
};

export default ApiLogReader;
