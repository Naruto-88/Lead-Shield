import React from 'react';
import GlassCard from '../components/ui/GlassCard';
import { Layers } from 'lucide-react';

interface CpanelGmbSuiteProps {
  gmbMetrics: any[];
}

const CpanelGmbSuite: React.FC<CpanelGmbSuiteProps> = ({ gmbMetrics }) => {
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-[#096260]/20 flex items-center justify-center border border-[#5fb4a9]/30">
            <Layers className="text-[#5fb4a9] w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">cPanel Deployment Blueprints & GMB Suite</h2>
            <p className="text-xs text-gray-400">Setup wiki documentation and manual tracker logs</p>
          </div>
        </div>
        
        <div className="text-center py-12 text-gray-400 font-mono text-sm">
          // Module ported from Dashboard.tsx
          <br/>
          [Waiting for Full Data Hydration]
        </div>
      </GlassCard>
    </div>
  );
};

export default CpanelGmbSuite;
