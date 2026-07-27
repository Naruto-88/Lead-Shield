import React from 'react';
import GlassCard from '../components/ui/GlassCard';
import { PlusCircle, Database } from 'lucide-react';

interface TenantWorkspaceProps {
  clients: any[];
}

const TenantWorkspace: React.FC<TenantWorkspaceProps> = ({ clients }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <GlassCard>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <PlusCircle className="text-cyan-400 w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Provision New Tenant</h2>
            </div>
            
            <form className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">Business Name</label>
                <input type="text" className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-cyan-500/50 outline-none text-white transition-colors" placeholder="e.g. Acme Corp" />
              </div>
              {/* Additional form fields would be ported here */}
              <button type="button" className="w-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-bold py-3 rounded-xl border border-cyan-500/30 transition-all mt-4 hover:shadow-[0_0_15px_rgba(0,255,255,0.2)]">
                Deploy Tenant Workspace
              </button>
            </form>
          </GlassCard>
        </div>

        <div className="lg:col-span-2">
          <GlassCard className="h-full">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                <Database className="text-purple-400 w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Provisioned Portal Spaces</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                    <th className="p-3">Tenant ID</th>
                    <th className="p-3">Business Name</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {clients.map((c) => (
                    <tr key={c.client_id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono text-cyan-400 text-xs">{c.client_id}</td>
                      <td className="p-3 font-bold text-white">{c.business_name}</td>
                      <td className="p-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          c.status === 'active' 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
                            : 'bg-red-500/10 text-red-400 border-red-500/30'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button className="text-[10px] font-mono tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-white transition-colors">INSPECT</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default TenantWorkspace;
