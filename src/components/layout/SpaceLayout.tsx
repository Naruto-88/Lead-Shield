import React from 'react';
import Sidebar from './Sidebar';

interface SpaceLayoutProps {
  children: React.ReactNode;
  activeModule: string;
  onNavigate: (module: string) => void;
  userRole?: 'admin' | 'client' | null;
  username?: string;
  onLogout?: () => void;
}

const SpaceLayout: React.FC<SpaceLayoutProps> = ({ 
  children, 
  activeModule, 
  onNavigate,
  userRole,
  username,
  onLogout
}) => {
  return (
    <div className="min-h-screen bg-[#06020b] text-white flex overflow-hidden font-sans">
      {/* 3D Mesh Background */}
      <div className="mesh-bg" />

      {/* Sidebar Navigation */}
      {userRole === 'admin' && (
        <Sidebar 
          activeModule={activeModule} 
          onNavigate={onNavigate} 
          username={username}
          onLogout={onLogout}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-white/5 bg-white/5 backdrop-blur-md flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold tracking-wider">
              {activeModule === 'analytics' && 'Interactive Analytics Dashboard'}
              {activeModule === 'tenant' && 'Tenant Onboarding & Active Workspace'}
              {activeModule === 'n8n' && 'n8n Webhook Integration Hub'}
              {activeModule === 'apilog' && 'API Controller & Live Catch Log Reader'}
              {activeModule === 'vault' && 'Virtual Vault & PHP Developer Suite'}
              {activeModule === 'cpanel' && 'cPanel Deployment Blueprints & GMB Suite'}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">System Online</span>
            </div>
            {userRole === 'client' && (
              <button 
                onClick={onLogout}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20"
              >
                Logout
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default SpaceLayout;
