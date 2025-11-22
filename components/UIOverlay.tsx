/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef } from 'react';
import { BuildingType, CityStats, AIGoal, NewsItem } from '../types';
import { BUILDINGS } from '../constants';

interface UIOverlayProps {
  stats: CityStats;
  selectedTool: BuildingType;
  onSelectTool: (type: BuildingType) => void;
  currentGoal: AIGoal | null;
  newsFeed: NewsItem[];
  onClaimReward: () => void;
  isGeneratingGoal: boolean;
  aiEnabled: boolean;
}

const tools = [
  BuildingType.None, // Bulldoze
  BuildingType.Road,
  BuildingType.Residential,
  BuildingType.Commercial,
  BuildingType.Industrial,
  BuildingType.Park,
];

const ToolButton: React.FC<{
  type: BuildingType;
  isSelected: boolean;
  onClick: () => void;
  money: number;
}> = ({ type, isSelected, onClick, money }) => {
  const config = BUILDINGS[type];
  const canAfford = money >= config.cost;
  const isBulldoze = type === BuildingType.None;
  
  // Use color from config
  const bgColor = config.color;

  return (
    <button
      onClick={onClick}
      disabled={!isBulldoze && !canAfford}
      className={`
        relative flex flex-col items-center justify-center rounded border transition-all shadow-lg backdrop-blur-sm flex-shrink-0
        w-14 h-14 md:w-16 md:h-16
        ${isSelected ? 'border-cyan-400 bg-cyan-900/50 scale-105 z-10 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'border-slate-700 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-500'}
        ${!isBulldoze && !canAfford ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
      `}
      title={config.description}
    >
      <div className="w-6 h-6 md:w-8 md:h-8 rounded-sm mb-0.5 md:mb-1 border border-black/50 shadow-inner flex items-center justify-center overflow-hidden" style={{ backgroundColor: isBulldoze ? 'transparent' : bgColor }}>
        {isBulldoze && <div className="w-full h-full bg-red-600 text-white flex justify-center items-center font-bold text-base md:text-lg">✕</div>}
        {type === BuildingType.Road && <div className="w-full h-1 bg-gray-800"></div>}
      </div>
      <span className="text-[7px] md:text-[9px] font-bold text-cyan-100 uppercase tracking-wider drop-shadow-md leading-none">{config.name}</span>
      {config.cost > 0 && (
        <span className={`text-[8px] md:text-[10px] font-mono leading-none ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>Cr {config.cost}</span>
      )}
    </button>
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
  aiEnabled
}) => {
  const newsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll news
  useEffect(() => {
    if (newsRef.current) {
      newsRef.current.scrollTop = newsRef.current.scrollHeight;
    }
  }, [newsFeed]);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 md:p-4 font-mono z-10 text-slate-200">
      
      {/* Top Bar: Stats & Goal */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start pointer-events-auto gap-2 w-full max-w-full">
        
        {/* Stats Panel */}
        <div className="bg-slate-950/90 p-2 md:p-3 rounded-lg border border-slate-700 shadow-2xl backdrop-blur-md flex gap-3 md:gap-6 items-center justify-between md:justify-start w-full md:w-auto relative overflow-hidden">
           {/* Tech deco line */}
           <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
           
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Credits</span>
            <span className="text-lg md:text-2xl font-bold text-amber-400 drop-shadow-md">₳{stats.money.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-slate-800"></div>
          <div className="flex flex-col">
            <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Crew</span>
            <span className="text-base md:text-xl font-bold text-cyan-300 drop-shadow-md">{stats.population.toLocaleString()}</span>
          </div>
          <div className="w-px h-6 md:h-8 bg-slate-800"></div>
          <div className="flex flex-col items-end">
             <span className="text-[8px] md:text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sol</span>
             <span className="text-base md:text-lg font-bold text-white">{stats.day}</span>
          </div>
        </div>

        {/* AI Goal Panel */}
        <div className={`w-full md:w-96 bg-slate-900/90 text-slate-300 rounded-lg border border-slate-600 shadow-2xl backdrop-blur-md overflow-hidden transition-all ${!aiEnabled ? 'opacity-60 grayscale-[0.5]' : ''}`}>
          <div className="bg-slate-800/80 px-3 md:px-4 py-1.5 md:py-2 flex justify-between items-center border-b border-slate-700">
            <span className="font-bold uppercase text-[10px] md:text-xs tracking-widest flex items-center gap-2 text-cyan-400">
              {aiEnabled ? (
                <>
                  <span className={`w-1.5 h-1.5 rounded-sm ${isGeneratingGoal ? 'bg-amber-400 animate-ping' : 'bg-cyan-400 animate-pulse'}`}></span>
                  LUNA-AI Uplink
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-sm bg-slate-500"></span>
                  Offline
                </>
              )}
            </span>
            {isGeneratingGoal && aiEnabled && <span className="text-[10px] animate-pulse text-amber-400">COMPUTING...</span>}
          </div>
          
          <div className="p-3 md:p-4">
            {aiEnabled ? (
              currentGoal ? (
                <>
                  <p className="text-xs md:text-sm font-normal text-slate-100 mb-3 leading-tight">"{currentGoal.description}"</p>
                  
                  <div className="flex justify-between items-center mt-2 bg-slate-950/50 p-2 rounded border border-slate-800">
                    <div className="text-[10px] md:text-xs text-slate-400">
                      Objective: <span className="font-bold text-cyan-200">
                        {currentGoal.targetType === 'building_count' ? BUILDINGS[currentGoal.buildingType!].name : 
                         currentGoal.targetType === 'money' ? 'Credits' : 'Crew'} {currentGoal.targetValue}
                      </span>
                    </div>
                    <div className="text-[10px] md:text-xs text-amber-400 font-bold border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 rounded">
                      +₳{currentGoal.reward}
                    </div>
                  </div>
  
                  {currentGoal.completed && (
                    <button
                      onClick={onClaimReward}
                      className="mt-3 w-full bg-cyan-700 hover:bg-cyan-600 text-white font-bold py-1.5 px-4 rounded shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all animate-pulse text-xs md:text-sm uppercase tracking-widest border border-cyan-500"
                    >
                      Claim Bounty
                    </button>
                  )}
                </>
              ) : (
                <div className="text-xs md:text-sm text-slate-500 py-2 flex items-center gap-2">
                  <span className="animate-spin text-cyan-500">⟳</span>
                  Scanning telemetry...
                </div>
              )
            ) : (
              <div className="text-xs md:text-sm text-slate-500 py-1">
                 <p>Manual Override Active.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar: Tools & News */}
      <div className="flex flex-col-reverse md:flex-row md:justify-between md:items-end pointer-events-auto mt-auto gap-2 w-full max-w-full">
        
        <div className="flex gap-1 md:gap-2 bg-slate-900/90 p-1 md:p-2 rounded-lg border border-slate-700 backdrop-blur-xl shadow-2xl w-full md:w-auto overflow-x-auto no-scrollbar justify-start md:justify-start">
          <div className="flex gap-1 md:gap-2 min-w-max px-1">
            {tools.map((type) => (
              <ToolButton
                key={type}
                type={type}
                isSelected={selectedTool === type}
                onClick={() => onSelectTool(type)}
                money={stats.money}
              />
            ))}
          </div>
          <div className="text-[8px] text-slate-600 uppercase writing-mode-vertical flex items-center justify-center font-bold tracking-widest border-l border-slate-800 pl-1 ml-1 select-none">Const</div>
        </div>

        {/* News Feed - Retro Terminal Style */}
        <div className="w-full md:w-96 h-32 md:h-48 bg-black text-green-500 rounded-lg border border-slate-700 shadow-2xl flex flex-col overflow-hidden relative font-mono text-[10px] md:text-xs">
          <div className="bg-slate-900 px-2 py-1 text-slate-400 border-b border-slate-800 flex justify-between items-center">
            <span className="uppercase tracking-widest">SYS.LOG</span>
            <span className={`w-1 h-1 rounded-full ${aiEnabled ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
          </div>
          
          {/* CRT Lines */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20 opacity-20"></div>
          
          <div ref={newsRef} className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
            {newsFeed.length === 0 && <div className="opacity-50">System online. Waiting for events...</div>}
            {newsFeed.map((news) => (
              <div key={news.id} className={`
                transition-opacity animate-fade-in relative pl-3
                ${news.type === 'positive' ? 'text-green-400' : ''}
                ${news.type === 'negative' ? 'text-red-400' : ''}
                ${news.type === 'neutral' ? 'text-slate-400' : ''}
              `}>
                <span className="absolute left-0 opacity-50">{'>'}</span>
                <span className="opacity-50 mr-2">[{new Date(Number(news.id.split('.')[0])).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit'})}]</span>
                {news.text}
              </div>
            ))}
          </div>
        </div>

      </div>
      
      <div className="absolute bottom-1 right-2 md:right-4 text-[8px] text-slate-600 font-mono text-right pointer-events-auto hover:text-slate-400 transition-colors">
        Luna Base OS v1.0 | <a href="https://x.com/ammaar" target="_blank" rel="noreferrer">@ammaar</a>
      </div>
    </div>
  );
};

export default UIOverlay;