/**
 * LoadingScreen.tsx
 * Ultra-Modern Pure Black Circuit Loading Screen for Apex GT.
 *
 * Requirements:
 * 1. 100% Solid Pure Black Screen (#000000) with zero distracting background clutter.
 * 2. Centered ultra-fluid kinetic loading animation with modern styling.
 * 3. Modern, stylized "CARGANDO" typography with neon/shimmer effects.
 * 4. Silky-smooth 60/120 FPS progress interpolation & GPU pre-warm stage feedback.
 * 5. Cinematic fade-out transition into the 3D circuit.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { CircuitId } from '../game/circuits/ICircuit';
import { getCircuit } from '../game/circuits/CircuitRegistry';
import { TireCompoundType } from '../game/physics/TireCompound';
import { RaceDifficulty, RaceLapOption } from '../game/career/CareerTypes';

export interface LoadingScreenProps {
  circuitId: CircuitId;
  mode: 'career' | 'practice' | 'multiplayer';
  compound?: TireCompoundType;
  laps?: RaceLapOption | number;
  difficulty?: RaceDifficulty;
  progress: number; // 0 to 100
  stageText: string;
  isFadingOut?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  circuitId,
  mode,
  progress,
  stageText,
  isFadingOut = false,
}) => {
  const circuit = useMemo(() => getCircuit(circuitId), [circuitId]);

  // Ultra-fluid progress interpolation via requestAnimationFrame (butter-smooth at 60/120 FPS)
  const [displayProgress, setDisplayProgress] = useState(0);

  useEffect(() => {
    let animId: number;
    const updateProgress = () => {
      setDisplayProgress((prev) => {
        const target = Math.min(100, Math.max(0, progress));
        const diff = target - prev;
        if (Math.abs(diff) < 0.1) return target;
        // Ease towards target with smooth responsive factor
        return prev + diff * 0.18;
      });
      animId = requestAnimationFrame(updateProgress);
    };
    animId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animId);
  }, [progress]);

  const roundedProgress = Math.min(100, Math.max(0, Math.round(displayProgress)));

  const modeName =
    mode === 'career'
      ? 'GRAN PREMIO'
      : mode === 'practice'
      ? 'ENTRENAMIENTO LIBRE'
      : 'MULTIJUGADOR 1V1';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center select-none overflow-hidden bg-black transition-opacity duration-1000 ease-in-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#000000' }}
    >
      {/* Central Modern Loading Module */}
      <div className="relative flex flex-col items-center justify-center px-6 py-8 max-w-md w-full">
        {/* Kinetic Orbital Ring Animation */}
        <div className="relative w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center mb-8">
          {/* Subtle Deep Ambient Red Bloom Behind Center */}
          <div className="absolute inset-0 rounded-full bg-red-600/15 blur-2xl pointer-events-none animate-pulse" />

          {/* Outer Segmented High-Tech Tech Ring (Slow Counter-Clockwise) */}
          <div className="absolute inset-0 rounded-full border border-neutral-800/80 anim-spin-reverse">
            {/* Cardinal Tick Marks */}
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-neutral-600" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-0.5 bg-neutral-600" />
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-0.5 h-2 bg-neutral-600" />
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-0.5 h-2 bg-neutral-600" />
          </div>

          {/* Middle Dashed Ring */}
          <svg className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] anim-spin-reverse opacity-40">
            <circle
              cx="50%"
              cy="50%"
              r="46%"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeDasharray="6 14"
            />
          </svg>

          {/* Primary Ultra-Fluid Glowing Arc (Smooth Accelerated Spin) */}
          <svg className="absolute inset-0 w-full h-full anim-spin-smooth drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]">
            <circle
              cx="50%"
              cy="50%"
              r="47%"
              fill="none"
              stroke="url(#crimsonGradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="140 280"
            />
            <defs>
              <linearGradient id="crimsonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#ef4444" />
                <stop offset="100%" stopColor="#991b1b" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>

          {/* Core Numerical Progress Display */}
          <div className="relative flex flex-col items-center justify-center">
            <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]">
              {roundedProgress}
              <span className="text-base sm:text-lg text-red-500 font-sans ml-0.5">%</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.25em] text-neutral-500 uppercase mt-0.5">
              BUFFER GPU
            </span>
          </div>
        </div>

        {/* Modern "CARGANDO" Typography & Shimmer */}
        <div className="flex flex-col items-center gap-2.5 w-full text-center">
          {/* Main CARGANDO Headline */}
          <div className="flex items-center justify-center gap-3">
            <span className="text-red-500 font-black text-sm tracking-widest animate-pulse">
              //
            </span>
            <h1 className="text-xl sm:text-2xl font-black font-mono tracking-[0.45em] uppercase text-white anim-text-glow">
              CARGANDO
            </h1>
            <span className="text-red-500 font-black text-sm tracking-widest animate-pulse">
              //
            </span>
          </div>

          {/* Ultra-Slim Modern Laser Progress Bar */}
          <div className="relative w-64 sm:w-72 h-1.5 rounded-full bg-neutral-900 border border-neutral-800/80 overflow-hidden my-1">
            {/* Smooth Dynamic Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-red-600 via-rose-500 to-white rounded-full transition-all duration-150 ease-out relative"
              style={{ width: `${displayProgress}%` }}
            >
              {/* Animated Laser Sweep Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent anim-laser-sweep" />
            </div>
          </div>

          {/* Dynamic Stage Text (Engine & Geometry Status) */}
          <p className="text-xs font-mono text-neutral-400 font-medium tracking-wide max-w-xs truncate min-h-[18px]">
            {stageText || 'Iniciando pipeline gráfico WebGL...'}
          </p>

          {/* Circuit & Mode Modern Sub-Badge */}
          <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-950 border border-neutral-900 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
            <span className="text-neutral-300 font-semibold">{circuit.name}</span>
            <span>•</span>
            <span className="text-red-400 font-semibold">{modeName}</span>
          </div>
        </div>
      </div>

      {/* Subtle Corner Telemetry Indicator (Ultra-Minimalist) */}
      <div className="absolute bottom-5 right-6 hidden sm:flex items-center gap-2 text-[9px] font-mono text-neutral-600 uppercase tracking-widest">
        <span>60/120 FPS TARGET</span>
        <span>•</span>
        <span>WEBGL 2.0 ZERO-JANK PIPELINE</span>
      </div>
    </div>
  );
};
