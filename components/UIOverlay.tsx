
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState } from 'react';
import { BuildingType, CityStats, AIGoal, NewsItem } from '../types';
import { BUILDINGS, TECH_TREE } from '../constants';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
  autoGrowth: boolean;
  onToggleAutoGrowth: () => void;
  unlockedTechs: string[];
  onUnlockTech: (id: string) => void;
  unlockedBuildings: BuildingType[];
}

const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
  locked: boolean;
}> = ({ type, isSelected, onClick, money, locked }) => {
  const config = BUILDINGS[type];
  const canAfford = money >= config.cost;
  const isBulldoze = type === BuildingType.None;
  
  const bgColor = config.color;
  const sizeLabel = !isBulldoze && (config.width > 1 || config.height > 1) ? `${config.width}x${config.height}` : '';

  if (locked) return null; // Don't show locked buildings in main bar

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && !canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded-sm border transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-cyan-400 bg-cyan-900/60 scale-105 z-10 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-slate-800 bg-black/60 hover:bg-slate-900 hover:border-slate-600'}
        ${!isBulldoze && !canAfford ? 'opacity-40 cursor-not-allowed grayscale' : 'cursor-pointer'}
      `}
      title={`${config.name} - Cost: ${config.cost} - Power: ${config.powerGen > 0 ? '+' + config.powerGen : config.powerGen}`}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded-sm mb-0.5 md:mb-1 border border-white/10 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="text-red-500 font-black text-xl">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-1 bg-gray-900"></div>}
      </div>
      
      <span className="text-[7px] md:text-[9px] font-mono text-slate-300 uppercase tracking-wider leading-none truncate w-full px-1 text-center">{config.name}</span>
      
      <div className="flex justify-between w-full px-1 mt-0.5">
        {config.cost > 0 && (
            <span className={`text-[7px] md:text-[9px] font-mono leading-none ${canAfford ? 'text-emerald-400' : 'text-red-500'}`}>Cr{config.cost}</span>
        )}
        {sizeLabel && <span className="text-[7px] md:text-[9px] text-amber-400 font-mono leading-none">{sizeLabel}</span>}
      </div>
      
      {isSelected && (
        <>
          <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-cyan-400"></div>
          <div className="absolute top-0 right-0 w-1 h-1 border-t border-r border-cyan-400"></div>
          <div className="absolute bottom-0 left-0 w-1 h-1 border-b border-l border-cyan-400"></div>
          <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-cyan-400"></div>
        </>
      )}
    </button>
  );
};

const TechModal: React.FC<{
    unlockedTechs: string[];
    onUnlock: (id: string) => void;
    science: number;
    onClose: () => void;
}> = ({ unlockedTechs, onUnlock, science, onClose }) => {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-950 border border-slate-700 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 p-4 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-cyan-400 tracking-widest uppercase">Research & Development</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-purple-400 font-mono">
                            <span>🧪</span>
                            <span className="text-xl font-bold">{science}</span>
                        </div>
                        <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">✕</button>
                    </div>
                </div>
                
                {/* Tree Content */}
                <div className="p-8 overflow-y-auto relative flex-1 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
                     {/* Connectors can be drawn here with SVG if needed, but simplified list/grid for now */}
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {TECH_TREE.map(tech => {
                             const isUnlocked = unlockedTechs.includes(tech.id);
                             const canUnlock = !isUnlocked && tech.prerequisites.every(pre => unlockedTechs.includes(pre));
                             const isLocked = !isUnlocked && !canUnlock;

                             return (
                                 <div key={tech.id} className={`
                                     p-4 border rounded relative group transition-all
                                     ${isUnlocked ? 'border-cyan-500/50 bg-cyan-950/30' : ''}
                                     ${canUnlock ? 'border-slate-500 bg-slate-900/50 hover:border-purple-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]' : ''}
                                     ${isLocked ? 'border-slate-800 bg-black/50 opacity-50 grayscale' : ''}
                                 `}>
                                     <div className="flex justify-between items-start mb-2">
                                         <h3 className={`font-bold ${isUnlocked ? 'text-cyan-300' : 'text-white'}`}>{tech.name}</h3>
                                         {isUnlocked ? (
                                             <span className="text-cyan-500 text-xs uppercase font-bold">Active</span>
                                         ) : (
                                             <span className={`text-xs font-mono ${science >= tech.cost ? 'text-purple-400' : 'text-red-400'}`}>
                                                 {tech.cost} Sci
                                             </span>
                                         )}
                                     </div>
                                     <p className="text-xs text-slate-400 mb-3 h-8">{tech.description}</p>
                                     
                                     <div className="flex flex-wrap gap-1 mb-3">
                                         {tech.unlocks.map(b => (
                                             <span key={b} className="px-1.5 py-0.5 bg-slate-800 text-[8px] uppercase rounded text-slate-300">
                                                 {BUILDINGS[b].name}
                                             </span>
                                         ))}
                                     </div>

                                     {!isUnlocked && !isLocked && (
                                         <button 
                                            onClick={() => onUnlock(tech.id)}
                                            disabled={science < tech.cost}
                                            className={`w-full py-1 text-xs uppercase font-bold rounded transition-colors ${science >= tech.cost ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                         >
                                             Research
                                         </button>
                                     )}
                                     {isLocked && (
                                         <div className="text-[10px] text-red-900 uppercase font-bold mt-2">Prerequisites missing</div>
                                     )}
                                 </div>
                             )
                         })}
                     </div>
                </div>
            </div>
        </div>
    );
};


const UIOverlay: React.FC<UIOverlayProps> = ({
  stats,
  selectedTool,
  onSelectTool,
  currentGoal,
  newsFeed,
  onClaimReward,
  isGeneratingGoal,
  aiEnabled,
  autoGrowth,
  onToggleAutoGrowth,
  unlockedTechs,
  onUnlockTech,
  unlockedBuildings
}) => {
  const newsRef = useRef<HTMLDivElement>(null);
  const [showTechTree, setShowTechTree] = useState(false);

  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed]);

  // Sort tools: None first, then Roads, then others
  const allTools = Object.values(BUILDINGS).map(b => b.type);
  
  // Power Ratio for bar
  const powerRatio = stats.powerSupply > 0 ? Math.min(1, stats.powerDemand / stats.powerSupply) : 1;
  const isLowPower = stats.powerDemand > stats.powerSupply;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-mono z-10 text-slate-200">
      
      {/* Tech Tree Modal */}
      {showTechTree && (
          <div className="pointer-events-auto">
             <TechModal 
                unlockedTechs={unlockedTechs} 
                onUnlock={onUnlockTech} 
                science={stats.science} 
                onClose={() => setShowTechTree(false)} 
             />
          </div>
      )}

      {/* Top HUD */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start pointer-events-auto gap-2 w-full max-w-full">
        
        {/* Resource Bar */}
        <div className="flex flex-col gap-2">
             <div className="bg-black/80 p-2 md:p-3 rounded-none border border-slate-800 shadow-2xl backdrop-blur-md flex gap-4 md:gap-6 items-center justify-start w-full md:w-auto relative overflow-hidden">
                
                {/* Money */}
                <div className="flex flex-col min-w-[60px]">
                    <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Credits</span>
                    <span className="text-base md:text-xl font-bold text-amber-500 tracking-tighter">₳ {stats.money.toLocaleString()}</span>
                </div>

                <div className="w-px h-6 md:h-8 bg-slate-800"></div>

                {/* Pop */}
                <div className="flex flex-col min-w-[40px]">
                    <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Crew</span>
                    <span className="text-base md:text-xl font-bold text-cyan-400 tracking-tighter">{stats.population.toLocaleString()}</span>
                </div>
                
                <div className="w-px h-6 md:h-8 bg-slate-800"></div>

                {/* Power */}
                <div className="flex flex-col min-w-[80px]">
                    <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest flex justify-between">
                        Power 
                        <span className={isLowPower ? "text-red-500 animate-pulse" : "text-green-500"}>
                            {stats.powerDemand}/{stats.powerSupply} MW
                        </span>
                    </span>
                    <div className="w-full h-2 bg-slate-900 mt-1 rounded-full overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ${isLowPower ? 'bg-red-500' : 'bg-yellow-400'}`}
                            style={{ width: `${Math.min(100, (stats.powerDemand / (stats.powerSupply || 1)) * 100)}%` }}
                        ></div>
                    </div>
                </div>

                 <div className="w-px h-6 md:h-8 bg-slate-800"></div>

                {/* Science */}
                 <div className="flex flex-col min-w-[50px]">
                    <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Science</span>
                    <span className="text-base md:text-xl font-bold text-purple-400 tracking-tighter flex items-center gap-1">
                        {stats.science}
                    </span>
                </div>
                
                <button 
                    onClick={() => setShowTechTree(true)}
                    className="ml-2 px-3 py-1 bg-purple-900/50 hover:bg-purple-800/80 border border-purple-500/50 text-xs font-bold rounded text-purple-200 uppercase tracking-wider shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
                >
                    Research
                </button>

                {/* Date */}
                <div className="flex flex-col items-end ml-auto">
                    <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sol</span>
                    <span className="text-base md:text-lg font-bold text-white">{stats.day}</span>
                </div>
            </div>
        </div>


        {/* Mission Panel */}
        <div className={`w-full md:w-80 bg-slate-950/90 text-slate-300 border border-slate-700 shadow-2xl backdrop-blur-md transition-all ${!aiEnabled ? 'opacity-60 grayscale-[0.5]' : ''}`}>
          <div className="bg-slate-900/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-slate-800">
            <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 text-cyan-500">
              {aiEnabled ? (
                <>
                  <span className={`w-1.5 h-1.5 rounded-full ${isGeneratingGoal ? 'bg-amber-500 animate-ping' : 'bg-cyan-500 animate-pulse'}`}></span>
                  LUNA-AI Uplink
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  OFFLINE
                </>
              )}
            </span>
             <button 
                onClick={onToggleAutoGrowth}
                className={`text-[9px] px-2 py-0.5 border rounded uppercase font-bold ${autoGrowth ? 'bg-cyan-900 border-cyan-500 text-white' : 'border-slate-700 text-slate-500'}`}
            >
                Auto-Gov: {autoGrowth ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="p-3 md:p-4 relative">
             <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] opacity-50"></div>

            {aiEnabled ? (
              currentGoal ? (
                <>
                  <p className="text-xs md:text-sm font-normal text-slate-100 mb-3 leading-tight tracking-tight">
                    <span className="text-cyan-600 mr-2">CMD:</span>
                    "{currentGoal.description}"
                  </p>
                  
                  <div className="flex justify-between items-center mt-2 bg-black/40 p-2 border border-slate-800/50">
                    <div className="text-[10px] md:text-xs text-slate-400 uppercase">
                      Target: <span className="font-bold text-cyan-300">
                         {currentGoal.targetType === 'building_count' ? BUILDINGS[currentGoal.buildingType!].name : 
                          currentGoal.targetType === 'money' ? 'Credits' : 
                          currentGoal.targetType === 'science' ? 'Science' : 'Crew'} {currentGoal.targetValue}
                      </span>
                    </div>
                    <div className="text-[10px] md:text-xs text-amber-400 font-bold">
                      ₳{currentGoal.reward}
                    </div>
                  </div>
  
                  {currentGoal.completed && (
                    <button
                      onClick={onClaimReward}
                      className="mt-3 w-full bg-cyan-800 hover:bg-cyan-700 text-white font-bold py-1.5 px-4 shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all animate-pulse text-xs md:text-sm uppercase tracking-widest border border-cyan-600/50"
                    >
                      Claim Bounty
                    </button>
                  )}
                </>
              ) : (
                <div className="text-xs md:text-sm text-slate-500 py-2 flex items-center gap-2">
                  <span className="animate-spin text-cyan-500">⟳</span>
                  Awaiting Command...
                </div>
              )
            ) : (
              <div className="text-xs md:text-sm text-slate-500 py-1">
                 <p>Manual Control Engaged.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        
        {/* Toolbar */}
        <div className="flex gap-1 md:gap-2 bg-black/80 p-1 md:p-2 rounded-t-lg md:rounded-lg border-t md:border border-slate-800 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
          <div className="flex gap-1 md:gap-2 min-w-max px-1">
            {allTools.map((type) => (
              <ToolButton
                key={type}
                type={type}
                isSelected={selectedTool === type}
                onClick={() => onSelectTool(type)}
                money={stats.money}
                locked={!unlockedBuildings.includes(type)}
              />
            ))}
          </div>
          <div className="text-[8px] text-slate-700 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-slate-800 pl-1 ml-1 select-none">CONSTRUCT</div>
        </div>

        {/* Comms Terminal */}
        <div className="w-full md:w-96 h-32 md:h-40 bg-black text-green-500 border border-slate-800 shadow-2xl flex flex-col overflow-hidden relative font-mono text-[10px] md:text-xs">
          <div className="bg-slate-900 px-2 py-1 text-slate-500 border-b border-slate-800 flex justify-between items-center">
            <span className="uppercase tracking-widest text-[9px]">COMMS.LOG</span>
            <span className={`w-1 h-1 rounded-full ${aiEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          </div>
          
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-30"></div>
          
          <div ref={newsRef} className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
            {newsFeed.length === 0 && <div className="opacity-30">Signal clear.</div>}
            {newsFeed.map((news) => (
              <div key={news.id} className={`
                transition-opacity animate-fade-in relative pl-3
                ${news.type === 'positive' ? 'text-cyan-400' : ''}
                ${news.type === 'negative' ? 'text-red-400' : ''}
                ${news.type === 'neutral' ? 'text-slate-400' : ''}
              `}>
                <span className="absolute left-0 opacity-50 text-[8px] top-0.5">{'>'}</span>
                {news.text}
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <div className="absolute bottom-1 right-2 md:right-4 text-[8px] text-slate-800 font-mono text-right pointer-events-auto hover:text-slate-600 transition-colors">
        LUNA-OS v4.1
      </div>
    </div>
  );
};

export default UIOverlay;
