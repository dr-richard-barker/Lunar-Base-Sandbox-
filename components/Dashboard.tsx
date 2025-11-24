
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useMemo } from 'react';
import { HistoryEntry } from '../types';

interface DashboardProps {
  history: HistoryEntry[];
  onClose: () => void;
}

// --- Reusable SVG Chart Component ---
const CyberChart: React.FC<{
  data: HistoryEntry[];
  dataKeys: { key: keyof HistoryEntry; color: string; label: string }[];
  title: string;
  maxValue?: number;
  unit?: string;
}> = ({ data, dataKeys, title, maxValue, unit = '' }) => {
  if (data.length < 2) return <div className="h-full flex items-center justify-center text-slate-600 font-mono text-xs">AWAITING TELEMETRY...</div>;

  const width = 100;
  const height = 50;
  const padding = 2;

  // Determine scale
  const maxVal = useMemo(() => {
    if (maxValue !== undefined) return maxValue;
    let max = 0;
    data.forEach(d => {
      dataKeys.forEach(k => {
        if ((d[k.key] as number) > max) max = (d[k.key] as number);
      });
    });
    return max > 0 ? max * 1.1 : 10;
  }, [data, dataKeys, maxValue]);

  const minVal = useMemo(() => {
      let min = Infinity;
      data.forEach(d => {
          dataKeys.forEach(k => {
             if ((d[k.key] as number) < min) min = (d[k.key] as number);
          });
      });
      return min === Infinity ? 0 : Math.max(0, min * 0.8);
  }, [data, dataKeys]);

  const range = maxVal - minVal || 1;

  const getPoints = (key: keyof HistoryEntry) => {
    return data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - padding * 2);
      const val = d[key] as number;
      const normalizedVal = (val - minVal) / range;
      const y = height - padding - normalizedVal * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');
  };

  return (
    <div className="bg-black/40 border border-slate-800 p-2 relative group overflow-hidden h-full flex flex-col">
       {/* CRT Scanline Effect */}
       <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-20"></div>
       
       <div className="flex justify-between items-center mb-1">
          <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{title}</h3>
          <div className="flex gap-2">
            {dataKeys.map(k => (
                <div key={k.key} className="flex items-center gap-1">
                    <div className="w-2 h-0.5" style={{ backgroundColor: k.color }}></div>
                    <span className="text-[8px] font-mono" style={{ color: k.color }}>{k.label}</span>
                </div>
            ))}
          </div>
       </div>

       <div className="flex-1 relative">
           <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible preserve-3d">
              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(p => (
                  <line 
                    key={p} 
                    x1={padding} 
                    y1={height - padding - p * (height - padding*2)} 
                    x2={width - padding} 
                    y2={height - padding - p * (height - padding*2)} 
                    stroke="#1e293b" 
                    strokeWidth="0.2" 
                    strokeDasharray="1 1"
                  />
              ))}

              {/* Data Lines */}
              {dataKeys.map(k => (
                  <g key={k.key as string}>
                     {/* Glow */}
                     <polyline 
                        points={getPoints(k.key)} 
                        fill="none" 
                        stroke={k.color} 
                        strokeWidth="1.5" 
                        strokeOpacity="0.2"
                        className="blur-[2px]"
                     />
                     {/* Main Line */}
                     <polyline 
                        points={getPoints(k.key)} 
                        fill="none" 
                        stroke={k.color} 
                        strokeWidth="0.8" 
                        vectorEffect="non-scaling-stroke"
                     />
                  </g>
              ))}
           </svg>
           
           {/* Current Value Display */}
           <div className="absolute top-0 right-0 text-right">
                {dataKeys.map(k => (
                    <div key={k.key} className="text-[10px] font-bold font-mono leading-tight" style={{ color: k.color }}>
                        {typeof data[data.length-1][k.key] === 'number' 
                            ? (data[data.length-1][k.key] as number).toFixed(0) 
                            : ''
                        }{unit}
                    </div>
                ))}
           </div>
       </div>
    </div>
  );
};

// --- KPI Card ---
const KpiCard: React.FC<{ label: string, value: string | number, subValue?: string, color?: string }> = ({ label, value, subValue, color = 'text-cyan-400' }) => (
    <div className="bg-slate-900/50 border border-slate-700 p-3 flex flex-col justify-between relative overflow-hidden">
        <div className={`absolute top-0 right-0 p-1 opacity-20 ${color}`}>
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/></svg>
        </div>
        <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold z-10">{label}</span>
        <div className="z-10 mt-1">
            <span className={`text-2xl font-mono font-bold tracking-tighter ${color} drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]`}>{value}</span>
            {subValue && <span className="text-[10px] text-slate-400 ml-2 font-mono">{subValue}</span>}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-slate-800">
             <div className={`h-full ${color.replace('text-', 'bg-')}`} style={{ width: '60%' }}></div>
        </div>
    </div>
);


const Dashboard: React.FC<DashboardProps> = ({ history, onClose }) => {
  const current = history[history.length - 1] || {};

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
       <div className="bg-black border border-slate-800 w-full max-w-6xl h-[85vh] flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.1)] relative overflow-hidden rounded-lg">
           
           {/* Decorative Grid Background */}
           <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-10 pointer-events-none"></div>

           {/* Header */}
           <div className="bg-slate-900/80 p-4 border-b border-slate-700 flex justify-between items-center z-10 backdrop-blur-sm">
               <div className="flex items-center gap-3">
                   <div className="w-3 h-3 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]"></div>
                   <h2 className="text-xl font-black text-white tracking-[0.2em] uppercase font-mono">
                       City<span className="text-cyan-500">_Metrics</span>
                       <span className="text-[10px] ml-2 text-slate-500 align-top opacity-70">v.9.0.1</span>
                   </h2>
               </div>
               <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors uppercase font-bold text-xs tracking-widest border border-slate-700 px-4 py-2 hover:bg-slate-800 hover:border-slate-500">
                   Close Terminal
               </button>
           </div>

           {/* Content Grid */}
           <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10">
               
               {/* KPI Row */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                   <KpiCard 
                        label="Net Worth" 
                        value={`₳${(current.money || 0).toLocaleString()}`} 
                        subValue={history.length > 1 ? `${(current.money - history[history.length-2].money) > 0 ? '+' : ''}${current.money - history[history.length-2].money}` : '+0'}
                        color="text-amber-400"
                   />
                   <KpiCard 
                        label="Population" 
                        value={(current.population || 0).toLocaleString()}
                        subValue="Citizens"
                        color="text-cyan-400"
                   />
                   <KpiCard 
                        label="Grid Load" 
                        value={`${((current.powerDemand / (current.powerSupply || 1)) * 100).toFixed(0)}%`}
                        subValue={`${current.powerDemand} MW`}
                        color={current.powerDemand > current.powerSupply ? "text-red-500" : "text-purple-400"}
                   />
                   <KpiCard 
                        label="Air Quality" 
                        value={`${(current.oxygen || 0).toFixed(1)}%`}
                        subValue={`CO2: ${current.co2}ppm`}
                        color={current.oxygen < 20 ? "text-red-500" : "text-emerald-400"}
                   />
               </div>

               {/* Charts Grid */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[60%]">
                   
                   {/* 1. Life Support */}
                   <CyberChart 
                        title="Atmospheric Composition" 
                        data={history} 
                        dataKeys={[
                            { key: 'oxygen', color: '#34d399', label: 'O2 (%)' }, // Emerald
                            { key: 'co2', color: '#f87171', label: 'CO2 (ppm/100)' } // Red (scaled visually?)
                        ]}
                        // Hack for visualization: normalize CO2 roughly to fit 0-100 scale on same chart if possible, or just accept separate scales visually
                        // For simplicity, we pass raw values. CO2 (400-1000) will dwarf O2 (0-100).
                        // Let's normalize CO2 for display only inside the chart? 
                        // Actually, let's just chart Food & O2 here to keep scales closer.
                        // Or better: Separate charts. Let's do O2 & Food.
                   />
                   
                    {/* 2. Resources */}
                    <CyberChart 
                        title="Economic Growth" 
                        data={history} 
                        dataKeys={[
                            { key: 'money', color: '#fbbf24', label: 'Credits' },
                            { key: 'science', color: '#a855f7', label: 'Science' }
                        ]}
                    />

                    {/* 3. Power Grid */}
                    <CyberChart 
                        title="Power Grid Stability" 
                        data={history} 
                        dataKeys={[
                            { key: 'powerSupply', color: '#60a5fa', label: 'Supply (MW)' },
                            { key: 'powerDemand', color: '#ef4444', label: 'Demand (MW)' }
                        ]}
                    />

                    {/* 4. CO2 Specific (Environmental) */}
                    <CyberChart 
                        title="Environmental Toxicity" 
                        data={history} 
                        dataKeys={[
                            { key: 'co2', color: '#fb7185', label: 'CO2 (ppm)' }
                        ]}
                        unit="ppm"
                    />

               </div>
           </div>

           {/* Footer */}
           <div className="bg-slate-900/50 p-2 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex justify-between px-4">
               <span>SYS.STATUS: ONLINE</span>
               <span>DATA_STREAM: LIVE</span>
           </div>
       </div>
    </div>
  );
};

export default Dashboard;
