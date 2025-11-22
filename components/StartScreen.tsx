
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState } from 'react';
import { MAP_SIZES } from '../constants';

interface StartScreenProps {
  onStart: (aiEnabled: boolean, mapSize: number) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onStart }) => {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [selectedSize, setSelectedSize] = useState<keyof typeof MAP_SIZES>('Medium');

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50 text-white font-mono p-6 bg-black/70 backdrop-blur-md transition-all duration-1000">
      <div className="max-w-md w-full bg-slate-950/90 p-8 rounded border border-slate-800 shadow-[0_0_100px_rgba(59,130,246,0.1)] backdrop-blur-xl relative overflow-hidden animate-fade-in">
        
        {/* Grid background effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px] opacity-10 pointer-events-none"></div>

        <div className="relative z-10 text-center">
            <h1 className="text-6xl font-black mb-2 text-white tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            LUNA
            </h1>
            <p className="text-cyan-500 mb-8 text-xs font-bold tracking-[0.4em] uppercase">
            Titan Industrial Complex
            </p>

            {/* Map Size Selection */}
            <div className="mb-6 text-left">
              <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Colony Site Size</label>
              <div className="grid grid-cols-3 gap-2">
                 {(Object.keys(MAP_SIZES) as Array<keyof typeof MAP_SIZES>).map((size) => (
                   <button
                     key={size}
                     onClick={() => setSelectedSize(size)}
                     className={`
                       py-2 text-xs font-bold border transition-all
                       ${selectedSize === size 
                         ? 'bg-cyan-900/50 border-cyan-500 text-cyan-100 shadow-[0_0_10px_rgba(6,182,212,0.3)]' 
                         : 'bg-black/40 border-slate-800 text-slate-500 hover:border-slate-600'}
                     `}
                   >
                     {size}
                   </button>
                 ))}
              </div>
            </div>

            <div className="bg-black/40 p-5 rounded border border-slate-800/60 mb-8 text-left hover:border-slate-600 transition-colors group">
            <label className="flex items-center justify-between cursor-pointer">
                <div className="flex flex-col gap-1">
                <span className="font-bold text-sm text-slate-300 group-hover:text-white transition-colors flex items-center gap-2">
                    AI DIRECTOR (GEMINI)
                    {aiEnabled && <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">
                    Enable procedural missions & mining events.
                </span>
                </div>
                
                <div className="relative flex-shrink-0 ml-4">
                <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-900 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-900 peer-checked:after:bg-cyan-400"></div>
                </div>
            </label>
            </div>

            <button 
            onClick={() => onStart(aiEnabled, MAP_SIZES[selectedSize])}
            className="w-full py-4 bg-white hover:bg-slate-200 text-black font-bold rounded-sm shadow-[0_0_30px_rgba(255,255,255,0.15)] transform transition-all hover:scale-[1.01] active:scale-[0.99] text-sm tracking-[0.2em] uppercase"
            >
            Initiate Landing
            </button>
        </div>
      </div>
    </div>
  );
};

export default StartScreen;
