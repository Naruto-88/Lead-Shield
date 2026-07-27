import React, { useMemo } from 'react';
import GlassCard from '../components/ui/GlassCard';
import { TrendingUp, Users, Shield, AlertTriangle, Download, Activity } from 'lucide-react';

interface AnalyticsDashboardProps {
  clients: any[];
  leads: any[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ clients, leads }) => {
  const totalActiveClients = clients.filter(c => c.status === 'active').length;
  const totalLeads = leads.length;
  const totalGenuine = leads.filter(l => l.status === 'GENUINE').length;
  const totalSpam = leads.filter(l => l.status === 'SPAM').length;
  const genuineRate = totalLeads > 0 ? Math.round((totalGenuine / totalLeads) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Counters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Users className="text-cyan-400 w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">Live Nodes</span>
          </div>
          <h3 className="text-4xl font-black text-white">{totalActiveClients}</h3>
          <p className="text-xs text-gray-400 mt-2 font-medium">Provisioned Client Workspaces</p>
        </GlassCard>

        <GlassCard className="flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
              <Activity className="text-purple-400 w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono text-purple-400 tracking-widest uppercase">Total Volume</span>
          </div>
          <h3 className="text-4xl font-black text-white">{totalLeads}</h3>
          <p className="text-xs text-gray-400 mt-2 font-medium">Global Webhook Ingestions</p>
        </GlassCard>

        <GlassCard className="flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#096260]/20 flex items-center justify-center border border-[#5fb4a9]/30">
              <Shield className="text-[#5fb4a9] w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono text-[#5fb4a9] tracking-widest uppercase">Validated</span>
          </div>
          <h3 className="text-4xl font-black text-white">{totalGenuine}</h3>
          <p className="text-xs text-gray-400 mt-2 font-medium">Genuine Leads Delivered</p>
          <div className="mt-4 bg-[#5fb4a9]/10 rounded-full h-1.5 w-full overflow-hidden border border-[#5fb4a9]/20">
             <div className="bg-[#5fb4a9] h-full shadow-[0_0_10px_#5fb4a9]" style={{ width: `${genuineRate}%` }}></div>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="text-red-400 w-6 h-6" />
            </div>
            <span className="text-[10px] font-mono text-red-400 tracking-widest uppercase">Quarantined</span>
          </div>
          <h3 className="text-4xl font-black text-white">{totalSpam}</h3>
          <p className="text-xs text-gray-400 mt-2 font-medium">Spam Attacks Blocked</p>
          <div className="mt-4 bg-red-500/10 rounded-full h-1.5 w-full overflow-hidden border border-red-500/20">
             <div className="bg-red-500 h-full shadow-[0_0_10px_#ef4444]" style={{ width: `${100 - genuineRate}%` }}></div>
          </div>
        </GlassCard>
      </div>

      {/* Main Graph Area */}
      <GlassCard className="min-h-[400px]">
        <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white">System Threat Matrix & Validation Trends</h2>
            <p className="text-xs text-gray-400 mt-1">Real-time charting of incoming webhook requests and AI filtering outcomes</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-medium transition-colors">
            <Download size={14} />
            Export Data
          </button>
        </div>
        
        <div className="flex items-center justify-center h-[300px] border border-white/5 rounded-xl bg-black/20">
           {/* Placeholder for Recharts. Assuming user wants dynamic trend graphs here. */}
           <div className="text-center">
             <TrendingUp className="w-12 h-12 text-cyan-500/50 mx-auto mb-4" />
             <p className="text-sm font-mono text-cyan-400/70">Connecting to Real-time Render Pipeline...</p>
           </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default AnalyticsDashboard;
