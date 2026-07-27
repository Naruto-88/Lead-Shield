import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { X, TrendingUp, TrendingDown, Minus, Copy, ExternalLink, Eye } from 'lucide-react';

interface Client {
  client_id: string;
  business_name: string;
}

interface Lead {
  id: number;
  client_id: string;
  status: string;
  created_at: string;
  form_data: any;
  ai_reason?: string;
  channel?: string;
}

interface HistoricalLead {
  client_id: string;
  month: number;
  year: number;
  legit_count: number;
}

export default function IntelligenceMatrix({ clients, liveLeads }: { clients: Client[], liveLeads: Lead[] }) {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [historicalData, setHistoricalData] = useState<HistoricalLead[]>([]);
  
  // Custom Date Range State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isCustomRange, setIsCustomRange] = useState<boolean>(false);

  // Drilldown Modal State
  const [drilldownLeads, setDrilldownLeads] = useState<Lead[] | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState<string>('');

  useEffect(() => {
    // Fetch historical data for all years to allow YoY comparisons
    const fetchHistory = async () => {
      const { data, error } = await supabase.from('historical_monthly_leads').select('*');
      if (!error && data) {
        setHistoricalData(data);
      }
    };
    fetchHistory();
  }, []);

  // Compute Live Legit Counts for the current ongoing month
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const liveMonthCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    liveLeads.forEach(l => {
      if (l.status === 'GENUINE') {
        const d = new Date(l.created_at);
        if (d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear) {
          counts[l.client_id] = (counts[l.client_id] || 0) + 1;
        }
      }
    });
    return counts;
  }, [liveLeads, currentMonth, currentYear]);

  const getCellData = (client_id: string, m: number, y: number) => {
    if (y === currentYear && m === currentMonth) {
      return liveMonthCounts[client_id] || 0;
    }
    const h = historicalData.find(h => h.client_id === client_id && h.month === m && h.year === y);
    return h ? h.legit_count : 0;
  };

  const calculateTrend = (client_id: string, m: number, y: number) => {
    const currentCount = getCellData(client_id, m, y);
    
    // MoM
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const prevCount = getCellData(client_id, prevM, prevY);
    
    // YoY
    const yoyCount = getCellData(client_id, m, y - 1);

    return {
      momRaw: currentCount - prevCount,
      yoyRaw: currentCount - yoyCount,
    };
  };

  const handleCellClick = (client_id: string, m: number, y: number) => {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const leads = liveLeads.filter(l => {
      if (l.client_id !== client_id || l.status !== 'GENUINE') return false;
      const d = new Date(l.created_at);
      return d >= start && d < end;
    });
    const clientName = clients.find(c => c.client_id === client_id)?.business_name || client_id;
    setDrilldownTitle(`${clientName} - Legit Leads (${m}/${y})`);
    setDrilldownLeads(leads);
  };

  const handleCustomRangeClick = (client_id: string) => {
    if (!startDate || !endDate) return;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const leads = liveLeads.filter(l => {
      if (l.client_id !== client_id || l.status !== 'GENUINE') return false;
      const d = new Date(l.created_at);
      return d >= start && d <= end;
    });
    const clientName = clients.find(c => c.client_id === client_id)?.business_name || client_id;
    setDrilldownTitle(`${clientName} - Custom Range Leads`);
    setDrilldownLeads(leads);
  };

  const [selectedDrilldownLead, setSelectedDrilldownLead] = useState<Lead | null>(null);
  const [pieMonth, setPieMonth] = useState<number>(currentMonth);

  // Pie chart data
  const pieData = useMemo(() => {
    return clients.map(c => {
      let count = 0;
      if (isCustomRange && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        count = liveLeads.filter(l => l.client_id === c.client_id && l.status === 'GENUINE' && new Date(l.created_at) >= start && new Date(l.created_at) <= end).length;
      } else {
        // Fetch data specifically for the selected pieMonth in the selected year
        if (year === currentYear && pieMonth === currentMonth) {
          count = liveMonthCounts[c.client_id] || 0;
        } else {
          const h = historicalData.find(h => h.client_id === c.client_id && h.month === pieMonth && h.year === year);
          if (h) count = h.legit_count;
        }
      }
      return { name: c.business_name, value: count, client_id: c.client_id };
    }).filter(d => d.value > 0);
  }, [clients, liveMonthCounts, isCustomRange, startDate, endDate, liveLeads, historicalData, year, currentYear, currentMonth, pieMonth]);

  const COLORS = [
    '#082b36', '#096260', '#5fb4a9', '#1d4ed8', '#4338ca', '#6d28d9', '#a21caf', '#be123c',
    '#b91c1c', '#c2410c', '#b45309', '#ca8a04', '#4d7c0f', '#15803d', '#047857', '#0f766e',
    '#0369a1', '#1e3a8a', '#312e81', '#4c1d95', '#701a75', '#881337', '#7f1d1d', '#7c2d12',
    '#713f12', '#3f6212', '#14532d', '#064e3b', '#164e63', '#0c4a6e', '#1e1b4b'
  ];

  const handleCopyGlobalUrl = () => {
    const url = `${window.location.origin}/report/global`;
    navigator.clipboard.writeText(url);
    alert('Global Public Report URL copied to clipboard: ' + url);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-transparent glass-card premium-border-glow p-4 rounded-xl shadow-sm border border-[#096260]/10">
        <div className="flex items-center gap-4">
          <label className="text-xs font-bold text-white">Matrix Year:</label>
          <select 
            value={year} 
            onChange={(e) => { setYear(Number(e.target.value)); setIsCustomRange(false); }}
            className="text-xs p-2 rounded-lg border border-[#096260]/20 outline-none focus:border-[#5fb4a9] cursor-pointer"
          >
            {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-white">OR Custom Date Range:</span>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs p-1.5 rounded border border-[#096260]/20" />
          <span className="text-xs">to</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs p-1.5 rounded border border-[#096260]/20" />
          <button 
            onClick={() => setIsCustomRange(true)}
            className="text-xs bg-[#096260] text-white px-3 py-1.5 rounded-lg font-bold shadow-sm hover:bg-[#082b36] hover:scale-105 transition-all cursor-pointer"
          >
            Apply Range
          </button>
          {isCustomRange && (
            <button onClick={() => setIsCustomRange(false)} className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">Clear</button>
          )}
          
          <div className="w-px h-6 bg-white/10 mx-2"></div>
          
          <button 
            onClick={handleCopyGlobalUrl}
            className="text-xs bg-[#00ffff]/10 text-[#00ffff] px-3 py-1.5 rounded-lg font-bold hover:bg-[#00ffff]/20 hover:text-white transition-colors cursor-pointer flex items-center gap-1 border border-[#00ffff]/30 shadow-[0_0_10px_rgba(0,255,255,0.1)]"
            title="Copy Global Report URL"
          >
            <Copy size={12} />
            Copy Public URL
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Matrix Table */}
        <div className="lg:col-span-3 bg-transparent glass-card premium-border-glow rounded-xl shadow-md border border-[#096260]/10 overflow-hidden relative">
          <div className="p-4 border-b border-[#096260]/10 bg-gradient-to-r from-transparent to-black/20 flex justify-between items-center">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <TrendingUp size={16} className="text-[#5fb4a9]" /> Legit Lead Intelligence Matrix
            </h3>
            {isCustomRange && <span className="text-xs bg-yellow-100/50 border border-yellow-200 text-yellow-800 px-3 py-1 rounded-full font-bold shadow-sm animate-pulse">Custom Range Active</span>}
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b-2 border-[#096260]/20 text-[#00ffff] uppercase tracking-wider text-[10px]">
                  <th className="p-3 font-extrabold bg-white/5 rounded-tl-lg">Client</th>
                  {!isCustomRange ? (
                    Array.from({ length: 12 }, (_, i) => (
                      <th key={i} className="p-3 font-bold text-center bg-white/5">{new Date(0, i).toLocaleString('default', { month: 'short' })}</th>
                    ))
                  ) : (
                    <th className="p-3 font-bold text-center bg-white/5">Custom Range Total</th>
                  )}
                  {!isCustomRange && <th className="p-3 font-extrabold text-center border-l border-white/10 bg-white/10 rounded-tr-lg">Year Total</th>}
                </tr>
              </thead>
              <tbody>
                {clients.map(client => {
                  let yearTotal = 0;
                  let customTotal = 0;
                  
                  if (isCustomRange && startDate && endDate) {
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    customTotal = liveLeads.filter(l => l.client_id === client.client_id && l.status === 'GENUINE' && new Date(l.created_at) >= start && new Date(l.created_at) <= end).length;
                  }

                  return (
                    <tr key={client.client_id} className="border-b border-white/5 hover:bg-black/20 transition-colors group">
                      <td className="p-3 text-white font-semibold max-w-[150px] truncate group-hover:text-[#00ffff]" title={client.business_name}>
                        {client.business_name}
                      </td>
                      {!isCustomRange ? (
                        Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const val = getCellData(client.client_id, m, year);
                          yearTotal += val;
                          const isFuture = year === currentYear && m > currentMonth || year > currentYear;
                          
                          if (isFuture) return <td key={i} className="p-3 text-center text-gray-300 font-mono">-</td>;

                          const trend = calculateTrend(client.client_id, m, year);
                          
                          return (
                            <td key={i} className="p-3 text-center cursor-pointer hover:bg-[#096260]/10 rounded-lg group/cell relative transition-all" onClick={() => handleCellClick(client.client_id, m, year)}>
                              <div className={`font-bold text-sm ${val > 0 ? 'text-[#00ffff]' : 'text-gray-400'}`}>{val}</div>
                              
                              {/* Trend Tooltip */}
                              <div className="flex flex-col items-center justify-center gap-1 opacity-0 group-hover/cell:opacity-100 transition-all duration-200 absolute z-10 bg-transparent glass-card premium-border-glow/95 backdrop-blur shadow-xl border border-white/10 p-2 rounded-xl -top-12 left-1/2 -translate-x-1/2 pointer-events-none transform scale-95 group-hover/cell:scale-100 min-w-[80px]">
                                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                                  <span className="text-gray-400 w-6">MoM</span>
                                  {trend.momRaw > 0 ? <TrendingUp size={10} className="text-emerald-500" /> : trend.momRaw < 0 ? <TrendingDown size={10} className="text-rose-500" /> : <Minus size={10} className="text-gray-400" />}
                                  <span className={trend.momRaw > 0 ? 'text-emerald-600' : trend.momRaw < 0 ? 'text-rose-600' : 'text-gray-400'}>
                                    {trend.momRaw > 0 ? '+' : ''}{trend.momRaw}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] font-bold">
                                  <span className="text-gray-400 w-6">YoY</span>
                                  {trend.yoyRaw > 0 ? <TrendingUp size={10} className="text-emerald-500" /> : trend.yoyRaw < 0 ? <TrendingDown size={10} className="text-rose-500" /> : <Minus size={10} className="text-gray-400" />}
                                  <span className={trend.yoyRaw > 0 ? 'text-emerald-600' : trend.yoyRaw < 0 ? 'text-rose-600' : 'text-gray-400'}>
                                    {trend.yoyRaw > 0 ? '+' : ''}{trend.yoyRaw}
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        })
                      ) : (
                        <td className="p-3 text-center cursor-pointer hover:bg-[#096260]/10 rounded-lg font-bold text-[#00ffff] text-sm" onClick={() => handleCustomRangeClick(client.client_id)}>
                          {customTotal}
                        </td>
                      )}
                      {!isCustomRange && <td className="p-3 text-center font-extrabold border-l border-white/10 bg-white/5 text-white text-sm">{yearTotal}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual Summary */}
        <div className="bg-transparent glass-card premium-border-glow rounded-xl shadow-md border border-[#096260]/10 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#096260]/10 bg-gradient-to-r from-transparent to-black/20 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-sm">Client Share Distribution</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">{isCustomRange ? 'Custom Range' : 'Monthly Breakdown'}</p>
            </div>
            {!isCustomRange && (
              <select
                value={pieMonth}
                onChange={(e) => setPieMonth(Number(e.target.value))}
                className="text-[10px] p-1.5 rounded-lg border border-[#096260]/20 outline-none focus:border-[#5fb4a9] cursor-pointer bg-transparent glass-card premium-border-glow text-white font-bold"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'short' })}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="p-4 flex-1 min-h-[300px]">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    onClick={(entry: any) => isCustomRange ? handleCustomRangeClick(entry.payload.client_id) : handleCellClick(entry.payload.client_id, currentMonth, currentYear)}
                    className="cursor-pointer outline-none hover:opacity-80 transition-opacity drop-shadow-sm"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 text-xs italic bg-white/5 rounded-xl border border-dashed border-white/10">
                No legit leads in this period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drilldown Modal (Master-Detail View) */}
      {drilldownLeads && (
        <div className="fixed inset-0 bg-[#082b36]/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-transparent glass-card premium-border-glow rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-[#096260]/15">
            <div className="bg-[#082b36] p-5 border-b border-[#03212a] flex justify-between items-center text-white">
              <div>
                <h3 className="font-extrabold text-lg leading-none">{drilldownTitle}</h3>
                <p className="text-[10px] text-[#5fb4a9] font-bold mt-2 uppercase tracking-wider font-mono">Showing {drilldownLeads.length} genuine entries</p>
              </div>
              <button 
                onClick={() => {
                  setDrilldownLeads(null);
                  setSelectedDrilldownLead(null);
                }} 
                className="text-[#5fb4a9] hover:text-white font-extrabold text-xs bg-transparent glass-card premium-border-glow/10 w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex bg-white/5">
              {drilldownLeads.length === 0 ? (
                <div className="w-full flex items-center justify-center p-12 text-gray-400 text-sm italic">
                  No detailed lead data found for this specific period in the live database.
                </div>
              ) : (
                <>
                  {/* Master List (Sidebar) */}
                  <div className="w-1/3 border-r border-white/10 overflow-y-auto bg-transparent glass-card premium-border-glow p-4 space-y-2">
                    {drilldownLeads.map(lead => (
                      <div 
                        key={lead.id} 
                        onClick={() => setSelectedDrilldownLead(lead)}
                        className={`p-3 rounded-xl cursor-pointer border transition-all ${
                          selectedDrilldownLead?.id === lead.id 
                            ? 'bg-[#b026ff]/20 neon-glow-purple border border-[#b026ff]/40 shadow-sm' 
                            : 'bg-transparent glass-card premium-border-glow border-transparent hover:bg-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[9px] font-bold text-[#00ffff] uppercase tracking-wider font-mono">Payload #{lead.id}</span>
                          <span className="text-[9px] text-gray-400 font-medium">{new Date(lead.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="text-xs text-white font-semibold truncate">
                          {lead.form_data['email'] || lead.form_data['Email'] || lead.form_data['name'] || lead.form_data['Name'] || 'Submission Data'}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detail View (Content) */}
                  <div className="w-2/3 overflow-y-auto p-6 flex flex-col">
                    {!selectedDrilldownLead ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-400 italic text-sm">
                        <Eye size={48} className="text-gray-200 mb-4" />
                        Select a payload from the left to view raw submission details.
                      </div>
                    ) : (
                      <div className="bg-transparent glass-card premium-border-glow rounded-2xl shadow-xl overflow-hidden border border-[#096260]/10 flex flex-col w-full max-w-3xl mx-auto">
                        <div className="p-6 space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-[#096260]/10 text-xs">
                            <span className="font-extrabold text-gray-400 uppercase tracking-widest font-mono text-[9px]">Verdict classification</span>
                            <span className="font-black px-3 py-1 rounded-full uppercase text-[10px] border bg-[#00ffff]/10 text-[#00ffff] border-[#00ffff]/30 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
                              {selectedDrilldownLead.status}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest font-mono">Incoming dynamic form headers</p>
                            <div className="bg-[#082b36] text-[#d5ecea] font-mono text-[11px] p-5 rounded-2xl border border-[#096260]/30 shadow-inner overflow-x-auto leading-relaxed">
                              <div className="mb-4 text-[#5fb4a9] font-bold tracking-widest uppercase text-[10px]">Details of the Person</div>
                              <div className="space-y-1.5 whitespace-pre-wrap">
                                {Object.entries(selectedDrilldownLead.form_data).map(([k, v]) => {
                                  const keyName = k.replace(/_/g, ' ');
                                  const displayKey = keyName.charAt(0).toUpperCase() + keyName.slice(1);
                                  return (
                                    <div key={k}>
                                      <span className="text-[#5fb4a9]/80 capitalize">{displayKey}:</span> {String(v)}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-6 text-[#5fb4a9]/50 pt-4 border-t border-[#096260]/20">
                                --<br/>
                                This is a notification that a contact form was submitted on your website ({selectedDrilldownLead.client_id}).
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
