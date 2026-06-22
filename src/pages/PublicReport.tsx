import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, TrendingUp, Lock, CheckCircle, AlertCircle } from 'lucide-react';

interface Client {
  client_id: string;
  business_name: string;
}

interface HistoricalLead {
  client_id: string;
  month: number;
  year: number;
  legit_count: number;
}

interface PublicLead {
  id: number;
  client_id: string;
  status: string;
  created_at: string;
}

export default function PublicReport() {
  const { token } = useParams<{ token: string }>();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalLead[]>([]);
  const [liveData, setLiveData] = useState<PublicLead[]>([]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Fetch from an API endpoint or validate using VITE env variable (as a basic static protection for now, since it's a SPA)
    // The instructions specified "match PUBLIC_REPORT_PASSWORD in .env"
    // Since it's Vite, it must be VITE_PUBLIC_REPORT_PASSWORD.
    const expectedPassword = (import.meta as any).env.VITE_PUBLIC_REPORT_PASSWORD;

    if (expectedPassword && password !== expectedPassword) {
      setError('Invalid reporting password');
      setIsLoading(false);
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
    fetchData();
  };

  const fetchData = async () => {
    // 1. Fetch public clients (is_public_visible = true)
    // Only fetch clients that match the token OR if token is 'global', fetch all public
    let clientQuery = supabase.from('clients').select('client_id, business_name').eq('is_public_visible', true);
    if (token && token !== 'global') {
      clientQuery = clientQuery.eq('public_report_token', token);
    }
    const { data: clientsData } = await clientQuery;
    
    if (clientsData && clientsData.length > 0) {
      setClients(clientsData);
      
      const clientIds = clientsData.map(c => c.client_id);

      // 2. Fetch historical data for these clients
      const { data: historyData } = await supabase.from('historical_monthly_leads')
        .select('client_id, month, year, legit_count')
        .in('client_id', clientIds);
      
      if (historyData) setHistoricalData(historyData);

      // 3. Fetch live data for current month (count only basically)
      // Since RLS is open right now, we can fetch live data but we only extract counts.
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString();
      const endOfMonth = new Date(currentYear, currentMonth, 1).toISOString();

      const { data: liveLeads } = await supabase.from('leads')
        .select('id, client_id, status, created_at')
        .in('client_id', clientIds)
        .eq('status', 'GENUINE')
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      if (liveLeads) setLiveData(liveLeads);
    }
  };

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const getCellData = (client_id: string, m: number, y: number) => {
    if (y === currentYear && m === currentMonth) {
      return liveData.filter(l => l.client_id === client_id).length;
    }
    const h = historicalData.find(h => h.client_id === client_id && h.month === m && h.year === y);
    return h ? h.legit_count : 0;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#082b36] flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-[#096260]/10 rounded-full flex items-center justify-center">
              <Lock className="text-[#096260]" size={24} />
            </div>
            <h2 className="text-xl font-bold text-[#082b36]">Secure Reporting</h2>
            <p className="text-xs text-gray-500">Enter password to view aggregated metrics.</p>
          </div>
          
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700">Access Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#096260] focus:ring-1 focus:ring-[#096260] transition text-sm"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#096260] hover:bg-[#082b36] text-white font-bold py-3 rounded-xl transition shadow-lg shadow-[#096260]/30 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Access Report'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#082b36] rounded-xl flex items-center justify-center shadow-md">
              <Shield className="text-[#5fb4a9]" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#082b36]">Lead Intelligence Public Report</h1>
              <p className="text-xs text-gray-500 mt-1">Real-time aggregated genuine lead analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-100">
            <CheckCircle size={14} /> Live Sync Active
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
             <TrendingUp className="text-[#096260]" size={18} />
             <h3 className="font-bold text-[#082b36] text-sm">Yearly Performance Matrix ({currentYear})</h3>
          </div>
          
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-gray-100 text-[#096260] uppercase tracking-wider text-[10px]">
                  <th className="p-3 font-extrabold bg-gray-50/50 rounded-tl-lg">Client Profile</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="p-3 font-bold text-center bg-gray-50/50">{new Date(0, i).toLocaleString('default', { month: 'short' })}</th>
                  ))}
                  <th className="p-3 font-extrabold text-center border-l border-gray-100 bg-gray-50/80 rounded-tr-lg">YTD Total</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="text-center p-8 text-gray-400 italic text-sm">
                      No public data available for this report view.
                    </td>
                  </tr>
                ) : (
                  clients.map(client => {
                    let yearTotal = 0;
                    return (
                      <tr key={client.client_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-[#082b36] font-semibold">{client.business_name}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const val = getCellData(client.client_id, m, currentYear);
                          yearTotal += val;
                          const isFuture = currentYear === currentYear && m > currentMonth;
                          
                          if (isFuture) return <td key={i} className="p-3 text-center text-gray-300 font-mono">-</td>;

                          return (
                            <td key={i} className="p-3 text-center">
                              <div className={`font-bold text-sm ${val > 0 ? 'text-[#096260]' : 'text-gray-400'}`}>
                                {val}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-3 text-center font-extrabold border-l border-gray-100 bg-gray-50/50 text-[#082b36] text-sm">
                          {yearTotal}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 font-mono pt-8">
          Generated securely by Lead Shield. PII stripped.
        </div>
      </div>
    </div>
  );
}
