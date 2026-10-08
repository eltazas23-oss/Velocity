/**
 * TitleScreen.tsx
 * Ultra-Luxurious, Clean AAA Title Screen for Apex GT.
 * Features an elite minimalist presentation with a single focal "JUGAR" button,
 * atmospheric carbon vignette, high-precision typography, and cinematic ignition transition.
 */

import React, { useEffect, useState } from 'react';
import { Play, Shield, Zap, Sparkles } from 'lucide-react';
import { playEngineIgnitionRoar, playUiHover, playUiClick } from '../utils/uiAudio';

interface TitleScreenProps {
  onEnter: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onEnter }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStart = () => {
    if (isTransitioning) return;
    playUiClick(880);
    playEngineIgnitionRoar();
    setIsTransitioning(true);
    setTimeout(() => {
      onEnter();
    }, 450);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center select-none overflow-hidden transition-all duration-500 p-6 sm:p-10 ${
        isTransitioning ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'radial-gradient(ellipse at 50% 45%, #0f172a 0%, #070a0f 55%, #020306 100%)',
      }}
    >
      {/* Top Header: Elite FIA Federation & Simulation Metadata */}
      <header className="w-full max-w-6xl flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-neutral-400 uppercase">
            FIA GRADE-1 SIMULATION
          </span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden sm:flex">
          <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
            <Zap className="w-3 h-3" /> 60 FPS ENGINE
          </span>
          <span>•</span>
          <span>PHYSICS 120HZ</span>
          <span>•</span>
          <span>PBR SHADING</span>
        </div>
      </header>

      {/* Centerpiece: Clean, Elegant, High-Definition Brand & Single Play CTA */}
      <main className="relative z-10 flex flex-col items-center text-center my-auto px-4 max-w-2xl mx-auto">
        {/* Championship Brand Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-md mb-6 shadow-inner">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.35em] text-neutral-300 uppercase">
            SEASON 2026 // GRAND PRIX
          </span>
        </div>

        {/* Masterpiece Game Title */}
        <h1 className="text-7xl sm:text-9xl font-black tracking-tighter uppercase font-mono bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent drop-shadow-[0_12px_32px_rgba(0,0,0,0.9)] select-none">
          APEX GT
        </h1>

        {/* Subtitle with High-End Letter-spacing */}
        <p className="text-xs sm:text-sm font-semibold tracking-[0.45em] uppercase text-neutral-400 mt-3 font-mono">
          ULTIMATE MOTORSPORT SIMULATOR
        </p>

        {/* The Single Focal Action Button: JUGAR */}
        <div className="mt-14 sm:mt-18 flex flex-col items-center gap-3 w-full">
          <button
            onClick={handleStart}
            onMouseEnter={playUiHover}
            className="group relative w-64 sm:w-72 py-4 sm:py-4.5 rounded-2xl bg-gradient-to-r from-red-600/90 via-red-500/90 to-amber-500/90 hover:from-red-500 hover:to-amber-400 text-white font-mono font-black text-sm sm:text-base tracking-[0.35em] uppercase transition-all duration-300 shadow-[0_8px_32px_rgba(220,38,38,0.45)] hover:shadow-[0_12px_45px_rgba(239,68,68,0.7)] active:scale-95 cursor-pointer flex items-center justify-center gap-3 border border-white/25 overflow-hidden"
          >
            {/* Ambient Internal Light Ray */}
            <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12" />

            <Play className="w-4 h-4 fill-white text-white group-hover:scale-110 transition-transform duration-300" />
            <span className="relative z-10 drop-shadow-md">COMENZAR</span>
          </button>

          {/* Clean Touch Action Hint */}
          <span className="text-[10px] tracking-[0.25em] text-neutral-400/80 font-mono mt-1 uppercase">
            TOCA EL BOTÓN PARA COMENZAR
          </span>
        </div>
      </main>

      {/* Footer: Official Simulation Badges */}
      <footer className="w-full max-w-6xl flex items-center justify-between text-[10px] font-mono text-neutral-500 z-10 border-t border-white/[0.06] pt-4">
        <span className="tracking-wider">APEX GT RACING OPERATIONS</span>
        <span className="tracking-widest hidden sm:inline text-neutral-400">
          AUTODROMO GP & SQUARE RING
        </span>
        <span className="tracking-wider text-neutral-400 font-bold">V2.8.0 PRO</span>
      </footer>
    </div>
  );
};
