/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';

interface StartScreenProps {
  onStart: (aiEnabled: boolean) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-mono p-6 bg-black/60 backdrop-blur-sm transition-all duration-1000">
      <div className="max-w-md w-full bg-slate-950/90 p-8 rounded border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] backdrop-blur-xl relative overflow-hidden animate-fade-in">
        
        {/* Grid background effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none"></div>

        <div className="relative z-10 text-center">
            <h1 className="text-5xl font-black mb-1 text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500 tracking-tighter">
            LUNA BASE
            </h1>
            <p className="text-cyan-500 mb-8 text-xs font-bold tracking-[0.3em] uppercase">
            Alpha Colony Simulator
            </p>

            <div className="bg-slate-900/80 p-5 rounded border border-slate-800 mb-8 text-left hover:border-slate-700 transition-colors">
            <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col gap-1">
                <span className="font-bold text-base text-slate-200 group-hover:text-white transition-colors flex items-center gap-2">
                    LUNA-AI Uplink
                    {aiEnabled && <span className="flex h-2 w-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_10px_rgba(6,182,212,0.8)]"></span>}
                </span>
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors font-sans">
                    Connect to Gemini API for mission generation & events.
                </span>
                </div>
                
                <div className="relative flex-shrink-0 ml-4">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-500/40 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-900 peer-checked:after:bg-cyan-400"></div>
                </div>
            </label>
            </div>

            <button 
            onClick={() => onStart(aiEnabled)}
            className="w-full py-4 bg-slate-100 hover:bg-white text-black font-bold rounded shadow-[0_0_20px_rgba(255,255,255,0.2)] transform transition-all hover:scale-[1.02] active:scale-[0.98] text-lg tracking-widest uppercase"
            >
            Initialize
            </button>

            <div className="mt-8 text-center opacity-40 hover:opacity-80 transition-opacity">
                <a 
                    href="https://x.com/ammaar" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-[10px] text-slate-400 hover:text-white transition-colors font-mono"
                >
                    SYSTEM BY @AMMAAR
                </a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;