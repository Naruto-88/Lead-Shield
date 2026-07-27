import React from 'react';
import GlassCard from '../components/ui/GlassCard';
import { Activity, Shield, Code, Send } from 'lucide-react';

interface N8nWebhookHubProps {
  n8nConfigs: any[];
}

const N8nWebhookHub: React.FC<N8nWebhookHubProps> = ({ n8nConfigs }) => {
  return (
    <div className="space-y-6">
      <GlassCard>
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <Activity className="text-purple-400 w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">n8n Webhook Integration Hub</h2>
            <p className="text-xs text-gray-400">AI Spam Gating Engine Configuration & Simulators</p>
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

export default N8nWebhookHub;
