import React from 'react';
import { 
  TrendingUp, 
  Users, 
  Terminal, 
  Activity, 
  Database, 
  Layers, 
  LogOut,
  Shield
} from 'lucide-react';

interface SidebarProps {
  activeModule: string;
  onNavigate: (module: string) => void;
  username?: string;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeModule, onNavigate, username, onLogout }) => {
  const navItems = [
    { id: 'analytics', label: 'Analytics Dashboard', icon: TrendingUp },
    { id: 'tenant', label: 'Tenant Workspace', icon: Users },
    { id: 'n8n', label: 'n8n Webhook Hub', icon: Activity },
    { id: 'apilog', label: 'API Log Reader', icon: Terminal },
    { id: 'vault', label: 'Developer Vault', icon: Database },
    { id: 'cpanel', label: 'cPanel & GMB Suite', icon: Layers },
  ];

  return (
    <aside className="w-64 border-r border-white/5 bg-white/5 backdrop-blur-xl flex flex-col shrink-0">
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/40 shadow-[0_0_15px_rgba(0,255,255,0.2)]">
            <Shield className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-wider text-white">LEAD SHIELD</h1>
            <p className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Admin Control</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Session Active</p>
            <p className="text-sm font-bold text-white mt-0.5">{username}</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        <p className="px-2 text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4">Core Modules</p>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-medium text-sm
                ${isActive 
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(0,255,255,0.1)]' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <Icon size={18} className={isActive ? "animate-pulse" : ""} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-6 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-cyan-400 absolute animate-ping opacity-75"></div>
            <div className="w-2 h-2 rounded-full bg-cyan-400 relative"></div>
          </div>
          <p className="text-[10px] font-mono text-cyan-400 tracking-widest uppercase">Nodes Synchronized</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
