import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#d5ecea] min-h-screen font-sans text-[#082b36] flex flex-col antialiased">
      <div className="flex-1 flex items-center justify-center py-10">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-[#096260]/5 overflow-hidden">
          
          {/* Branded login card header */}
          <div className="bg-[#082b36] p-8 text-center relative border-b border-white/5">
            <div className="mx-auto w-10 h-10 bg-[#096260] rounded-xl flex items-center justify-center border border-[#5fb4a9]/30">
              <div className="w-3.5 h-3.5 bg-white rounded-full"></div>
            </div>
            <h2 className="text-white text-xl font-bold tracking-tight mt-3">Lead Shield</h2>
            <p className="text-[#5fb4a9] text-[10px] uppercase tracking-[0.2em] mt-1 font-semibold">Secure Authenticator Wall</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-4">
            
            {error && (
              <div className="bg-red-50 border border-red-500/10 text-red-950 p-4 rounded-2xl text-xs space-y-0.5 animate-pulse">
                <p className="font-bold">Access Denied</p>
                <p className="text-red-700/90 leading-tight">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-[#082b36] uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@leadshield.com"
                required
                className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#096260] text-[#082b36] placeholder-[#082b36]/35 font-medium"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#082b36] uppercase tracking-wider mb-1.5">Secure Keyphrase Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#d5ecea]/15 border border-[#096260]/10 focus:border-[#096260] rounded-xl py-2.5 px-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#096260] text-[#082b36] placeholder-[#082b36]/40 font-medium"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-[#096260] hover:bg-[#5fb4a9] text-white py-3 px-4 rounded-xl font-bold text-xs shadow-lg shadow-[#096260]/20 transition-all duration-150 mt-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Authenticate Shield Instance'}
            </button>

            <div className="bg-[#082b36]/5 border border-[#096260]/5 p-4 rounded-2xl space-y-2">
              <p className="text-[10px] text-[#096260] font-bold uppercase tracking-wider select-none">Credentials Checklist</p>
              <div className="grid grid-cols-2 gap-3 text-[10px] text-[#082b36] font-mono leading-relaxed">
                <div>
                  <p className="font-bold text-[#096260]">Super Admin</p>
                  <p className="mt-0.5">User: <span className="bg-[#d5ecea] text-[#096260] px-1 font-bold rounded">nstech</span></p>
                  <p className="mt-0.5">Pass: <span className="bg-[#d5ecea] text-[#096260] px-1 font-bold rounded">Mweerasinghe@123#</span></p>
                </div>
                <div>
                  <p className="font-bold text-[#096260]">Client Space</p>
                  <p className="mt-0.5">User: <span className="bg-[#d5ecea] text-[#096260] px-1 font-bold rounded">sydney_deck</span></p>
                  <p className="mt-0.5">Pass: <span className="bg-[#d5ecea] text-[#096260] px-1 font-bold rounded">sydney123</span></p>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
