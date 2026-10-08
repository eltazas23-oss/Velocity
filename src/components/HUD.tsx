/**
 * HUD.tsx - Clean High-Performance Racing Telemetry Heads-Up Display
 * Features:
 * - Speedometer, gear display, and dynamic RPM tachometer
 * - Mini-radar circuit track map and lap chronometer
 * - Compact & subtle Top-Right 4-wheel tire degradation widget
 * - Modern, non-invasive Next Pit Stop compound strategy selector (Soft / Medium / Hard)
 * - Fullscreen browser toggle button with responsive layout safeguarding against element clipping
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Camera, Flame, Pause, Trophy, Wrench, AlertTriangle, Disc, Maximize, Minimize, Check, Wind, LayoutGrid } from 'lucide-react';
import { GameTelemetry, RacingGameEngine } from '../game/RacingGameEngine';
import { TIRE_COMPOUNDS, TireCompoundType } from '../game/physics/TireCompound';
import { getCircuit } from '../game/circuits/CircuitRegistry';

interface HUDProps {
  telemetry: GameTelemetry;
  engine?: RacingGameEngine | null;
  carPosition?: { x: number; z: number; yaw: number };
  onSwitchCamera: () => void;
  onOpenPause: () => void;
  onReturnToModes?: () => void;
  onToggleDRS?: () => void;
  onRequestPitStop?: () => void;
  onSelectNextPitTireCompound?: (compound: TireCompoundType) => void;
  onChangeTireCompound?: (compound: TireCompoundType) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMultiplayer?: boolean;
  totalLaps?: number;
  myPlayerName?: string;
  myPlayerId?: 'p1' | 'p2';
  rivalPlayerName?: string;
  rivalLap?: number;
  raceWinner?: { id: string; name: string } | null;
}

export const HUD = React.memo<HUDProps>(({
  telemetry,
  engine,
  carPosition,
  onSwitchCamera,
  onOpenPause,
  onReturnToModes,
  onToggleDRS,
  onRequestPitStop,
  onSelectNextPitTireCompound,
  onChangeTireCompound,
  isFullscreen = false,
  onToggleFullscreen,
  isMultiplayer,
  totalLaps = 3,
  myPlayerName,
  myPlayerId = 'p1',
  rivalPlayerName,
  rivalLap = 1,
  raceWinner,
}) => {
  const [liveTelemetry, setLiveTelemetry] = useState<GameTelemetry>(telemetry);
  const telemetryData = engine ? liveTelemetry : telemetry;

  const speedValRef = useRef<HTMLSpanElement>(null);
  const gearValRef = useRef<HTMLSpanElement>(null);
  const lapTimeValRef = useRef<HTMLDivElement>(null);
  const rpmBarRef = useRef<HTMLDivElement>(null);
  const rpmValRef = useRef<HTMLSpanElement>(null);
  const radarDotRef = useRef<HTMLDivElement>(null);
  const pitProgressRef = useRef<HTMLDivElement>(null);
  const pitTimeRef = useRef<HTMLSpanElement>(null);

  const lastStateUpdateRef = useRef(0);
  const lastStateHashRef = useRef('');

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds * 1000) % 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.subscribeTelemetry((t) => {
      // 1. Direct high-frequency DOM manipulation (60/120 FPS with 0.00ms React Virtual DOM overhead)
      if (speedValRef.current) {
        speedValRef.current.textContent = String(t.speedKmh);
      }
      if (gearValRef.current) {
        gearValRef.current.textContent = t.gear === -1 ? 'R' : t.gear === 0 ? 'N' : String(t.gear);
        gearValRef.current.className = `text-sm sm:text-base font-black font-mono leading-none ${
          t.gear === -1 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
        }`;
      }
      if (lapTimeValRef.current) {
        lapTimeValRef.current.textContent = formatTime(t.lapTime);
      }
      if (rpmBarRef.current) {
        const pct = Math.min(100, Math.max(0, ((t.rpm - 1000) / 8500) * 100));
        rpmBarRef.current.style.width = `${pct}%`;
      }
      if (rpmValRef.current) {
        rpmValRef.current.textContent = `${(t.rpm / 1000).toFixed(1)}k`;
      }
      if (radarDotRef.current) {
        const cCircuit = getCircuit(t.circuitId);
        let mX = 50 + (t.carX / 130) * 42;
        let mY = 50 - (t.carZ / 130) * 42;
        if (cCircuit.id === 'speedway_gp') {
          const b = cCircuit.minimapConfig.bounds;
          mX = 10 + Math.max(0, Math.min(1, (t.carX - b.minX) / (b.maxX - b.minX))) * 80;
          mY = 10 + Math.max(0, Math.min(1, (t.carZ - b.minZ) / (b.maxZ - b.minZ))) * 80;
        }
        const deg = (t.carYaw * 180) / Math.PI;
        radarDotRef.current.style.left = `${Math.min(92, Math.max(8, mX))}%`;
        radarDotRef.current.style.top = `${Math.min(92, Math.max(8, mY))}%`;
        radarDotRef.current.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      }
      if (pitProgressRef.current) {
        pitProgressRef.current.style.width = `${Math.min(100, t.pitProgress * 100)}%`;
      }
      if (pitTimeRef.current) {
        pitTimeRef.current.textContent = t.pitPhase === 'entry_autopilot' ? '60 KM/H' : t.pitPhase === 'none' ? 'LIBRE' : `${t.pitTimeRemaining.toFixed(1)}s`;
      }

      // 2. Throttled React state update for slower-frequency UI elements (tire wear, leaderboard, banners)
      const now = performance.now();
      const stateHash = `${t.lapCount}_${t.pitPhase}_${t.isDrifting}_${t.isDrsOpen}_${t.hasAnyPuncture}_${t.isDamageLimiterActive}_${t.isTireCliffActive}_${t.tireWheelspinActive}_${t.tireCompound}_${t.nextPitTireCompound}`;
      
      const significantChange = stateHash !== lastStateHashRef.current;
      const timeElapsed = now - lastStateUpdateRef.current > 330; // 3 Hz

      if (significantChange || timeElapsed) {
        lastStateUpdateRef.current = now;
        lastStateHashRef.current = stateHash;
        setLiveTelemetry({ ...t });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [engine]);

  // RPM percentage (0% at 1000, 100% at 9500)
  const rpmPercent = Math.min(100, Math.max(0, ((telemetry.rpm - 1000) / 8500) * 100));
  const isRedline = telemetry.rpm > 8700;

  const lastDrsTriggerRef = useRef(0);
  const handleDrsTrigger = useCallback((e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastDrsTriggerRef.current < 200) return;
    lastDrsTriggerRef.current = now;
    if (onToggleDRS) {
      onToggleDRS();
    }
  }, [onToggleDRS]);

  // Active circuit metrics and Mini-map coordinates translation
  const activeCircuit = getCircuit(telemetryData.circuitId);
  const posX = carPosition ? carPosition.x : telemetryData.carX;
  const posZ = carPosition ? carPosition.z : telemetryData.carZ;
  const yaw = carPosition ? carPosition.yaw : telemetryData.carYaw;

  let mapX = 50 + (posX / 130) * 42;
  let mapY = 50 - (posZ / 130) * 42;

  if (activeCircuit.id === 'speedway_gp') {
    const b = activeCircuit.minimapConfig.bounds;
    mapX = 10 + Math.max(0, Math.min(1, (posX - b.minX) / (b.maxX - b.minX))) * 80;
    mapY = 10 + Math.max(0, Math.min(1, (posZ - b.minZ) / (b.maxZ - b.minZ))) * 80;
  }

  const carHeadingDeg = (yaw * 180) / Math.PI;

  const currentCompound = TIRE_COMPOUNDS[telemetryData.tireCompound] || TIRE_COMPOUNDS.soft;
  const nextCompoundType = telemetryData.nextPitTireCompound || telemetryData.tireCompound || 'soft';
  const hasPuncture = telemetryData.hasAnyPuncture;
  const wear = telemetryData.tireWear || [0, 0, 0, 0];
  const punctures = telemetryData.isPunctured || [false, false, false, false];
  const gripIndices = telemetryData.wheelGripIndex || [1.0, 1.0, 1.0, 1.0];
  const flatSpots = telemetryData.tireFlatSpot || [0, 0, 0, 0];
  const isTireCliff = telemetryData.isTireCliffActive;
  const isWheelspin = telemetryData.tireWheelspinActive;

  const getTireStatusBadge = (idx: number) => {
    if (punctures[idx]) {
      return {
        bg: 'bg-red-600/90 text-white border-red-400 animate-pulse',
        text: 'PINCHADO',
        isCritical: true,
      };
    }
    const w = wear[idx];
    if (w >= 78) {
      return {
        bg: 'bg-red-500/35 text-red-200 border-red-400 animate-pulse font-black',
        text: `CLIFF ${w.toFixed(1)}%`,
        isCritical: true,
      };
    }
    if (w > 60) {
      return {
        bg: 'bg-orange-500/25 text-orange-200 border-orange-500/40',
        text: `${w.toFixed(1)}%`,
        isCritical: false,
      };
    }
    if (w > 30) {
      return {
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        text: `${w.toFixed(1)}%`,
        isCritical: false,
      };
    }
    return {
      bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      text: `${w.toFixed(1)}%`,
      isCritical: false,
    };
  };

  const handleChooseNextCompound = (e: React.MouseEvent | React.TouchEvent | React.PointerEvent, comp: TireCompoundType) => {
    e.stopPropagation();
    if (onSelectNextPitTireCompound) {
      onSelectNextPitTireCompound(comp);
    }
    if (onChangeTireCompound) {
      onChangeTireCompound(comp);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-3 select-none overflow-hidden">
      {/* Top Header Section */}
      <div className="w-full flex flex-col gap-2 z-20">
        {/* Main Telemetry & Actions Navigation Bar */}
        <div className="pointer-events-auto flex items-center justify-between gap-1.5 sm:gap-2.5 w-full bg-neutral-950/90 border border-white/10 rounded-2xl px-2.5 sm:px-3.5 py-1.5 shadow-2xl">
          
          {/* Left: Compact Circuit Mini-Map & Lap Chrono */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Radar Mini-map */}
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 bg-neutral-900/90 rounded-xl border border-white/10 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
              <svg viewBox="0 0 100 100" className="w-full h-full p-0.5 opacity-80">
                {activeCircuit.id === 'speedway_gp' ? (
                  <>
                    <path
                      d={activeCircuit.minimapConfig.svgTrackPath}
                      fill="none"
                      stroke="#52525b"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={activeCircuit.minimapConfig.svgTrackPath}
                      fill="none"
                      stroke="#18181b"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line x1="48" y1="11" x2="48" y2="19" stroke="#ef4444" strokeWidth="2.5" />
                  </>
                ) : (
                  <>
                    <rect x="8" y="8" width="84" height="84" rx="14" ry="14" fill="none" stroke="#52525b" strokeWidth="6" />
                    <rect x="8" y="8" width="84" height="84" rx="14" ry="14" fill="none" stroke="#18181b" strokeWidth="4" />
                    <line x1="42" y1="92" x2="58" y2="92" stroke="#ef4444" strokeWidth="3" />
                    <line x1="40" y1="83" x2="65" y2="83" stroke="#10b981" strokeWidth="2" strokeDasharray="2,2" />
                  </>
                )}
              </svg>
              <div
                ref={radarDotRef}
                className="absolute w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm"
                style={{
                  left: `${Math.min(92, Math.max(8, mapX))}%`,
                  top: `${Math.min(92, Math.max(8, mapY))}%`,
                  transform: `translate(-50%, -50%) rotate(${carHeadingDeg}deg)`,
                }}
              >
                <div className="w-0.5 h-1 bg-white mx-auto -mt-0.5 rounded-full" />
              </div>
            </div>

            {/* Lap Counter & Chronometer */}
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1 text-[8.5px] sm:text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider">
                <span>VUELTA {telemetryData.lapCount}{totalLaps < 900 ? `/${totalLaps}` : ' (LIBRE)'}</span>
                {telemetryData.isDrifting && (
                  <span className="flex items-center gap-0.5 text-amber-400 font-black text-[8.5px] animate-pulse">
                    <Flame className="w-2.5 h-2.5" /> DRIFT
                  </span>
                )}
              </div>
              <div ref={lapTimeValRef} className="text-xs sm:text-sm font-black font-mono tracking-tight text-white tabular-nums leading-tight">
                {formatTime(telemetryData.lapTime)}
              </div>
              <div className="hidden xs:block text-[8px] sm:text-[8.5px] text-neutral-400 font-mono tabular-nums leading-none">
                Mejor: {telemetryData.bestLap ? formatTime(telemetryData.bestLap) : '--:--.---'}
              </div>
            </div>
          </div>

          {/* Center: High-Performance Speedometer & Tachometer */}
          <div className="flex items-center gap-2 sm:gap-3 bg-neutral-900/80 border border-white/10 rounded-xl px-2 sm:px-3 py-1 shadow-inner">
            {/* Gear Indicator */}
            <div className="flex items-center gap-0.5">
              <span className="text-[7.5px] sm:text-[8.5px] uppercase font-bold text-neutral-400">M</span>
              <span ref={gearValRef} className={`text-sm sm:text-base font-black font-mono leading-none ${telemetryData.gear === -1 ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`}>
                {telemetryData.gear === -1 ? 'R' : telemetryData.gear === 0 ? 'N' : telemetryData.gear}
              </span>
            </div>

            <div className="w-px h-3.5 bg-white/15" />

            {/* Speed Display */}
            <div className="flex items-baseline gap-1">
              <span ref={speedValRef} className={`text-sm sm:text-lg font-black font-mono tracking-tight tabular-nums leading-none ${
                hasPuncture
                  ? 'text-red-400 animate-pulse'
                  : telemetryData.isDamageLimiterActive && telemetryData.speedKmh >= (telemetryData.dynamicMaxSpeedKmh || 325) - 4
                  ? 'text-amber-400'
                  : 'text-white'
              }`}>
                {telemetryData.speedKmh}
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-[7.5px] sm:text-[8.5px] font-bold text-neutral-400">KM/H</span>
                {telemetryData.isDamageLimiterActive && (
                  <span className={`text-[7px] font-mono font-black ${
                    (telemetryData.structuralIntegrity || 1) <= 0.22 ? 'text-red-400 animate-pulse' : 'text-amber-400'
                  }`}>
                    MÁX:{telemetryData.dynamicMaxSpeedKmh}
                  </span>
                )}
              </div>
            </div>

            <div className="hidden sm:block w-px h-3.5 bg-white/15" />

            {/* RPM Tachometer */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-14 sm:w-20 h-1.5 bg-neutral-950 rounded-full overflow-hidden border border-white/10">
                <div
                  ref={rpmBarRef}
                  className={`h-full rounded-full ${
                    isRedline
                      ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-600 animate-pulse'
                      : 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                  }`}
                  style={{ width: `${rpmPercent}%` }}
                />
              </div>
              <span ref={rpmValRef} className={`text-[8.5px] font-mono font-bold tabular-nums ${isRedline ? 'text-red-400 animate-pulse' : 'text-neutral-400'}`}>
                {(telemetryData.rpm / 1000).toFixed(1)}k
              </span>
            </div>
          </div>

          {/* F1 DRS Cockpit Control Button (Header) */}
          {onToggleDRS && (
            <button
              type="button"
              onPointerDown={handleDrsTrigger}
              onTouchStart={handleDrsTrigger}
              onClick={handleDrsTrigger}
              title={
                telemetryData.isDrsOpen
                  ? 'Cerrar DRS (Freno automático o Tocar botón)'
                  : 'Activar DRS Manual (Boost de velocidad y aceleración)'
              }
              className={`pointer-events-auto px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1.5 select-none shadow-lg cursor-pointer touch-none ${
                telemetryData.isDrsOpen
                  ? 'bg-emerald-500 text-neutral-950 border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.85)] ring-2 ring-emerald-400 font-black scale-105'
                  : 'bg-neutral-900/90 text-cyan-300 border-cyan-400/60 shadow-[0_0_16px_rgba(6,182,212,0.3)] hover:border-cyan-300 font-extrabold ring-1 ring-cyan-400/30'
              }`}
            >
              <Wind className={`w-3.5 h-3.5 ${telemetryData.isDrsOpen ? 'animate-bounce text-neutral-950' : 'text-cyan-300'}`} />
              <div className="flex flex-col text-left leading-none">
                <div className="flex items-center gap-1">
                  <span className="text-[9.5px] sm:text-[10.5px] font-black tracking-wider uppercase">
                    DRS
                  </span>
                  {telemetryData.isDrsOpen && (
                    <span className="text-[7.5px] px-1 py-0.2 bg-neutral-950 text-emerald-400 rounded font-black tracking-tight">
                      +BOOST
                    </span>
                  )}
                </div>
                <span className={`text-[6.5px] sm:text-[7.5px] uppercase font-bold tracking-tight ${
                  telemetryData.isDrsOpen
                    ? 'text-neutral-900'
                    : 'text-cyan-200'
                }`}>
                  {telemetryData.isDrsOpen ? 'ABIERTO' : 'LISTO'}
                </span>
              </div>
            </button>
          )}

          {/* Right: Quick Action Controls (Camera, Fullscreen, Pit Stop, Pause) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Quick Camera Switcher */}
            <button
              onClick={onSwitchCamera}
              title="Cambiar vista de cámara"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/5 transition-all active:scale-95 flex items-center gap-1"
            >
              <Camera className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden md:inline text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                {telemetryData.cameraMode === 'hood' && 'Morro'}
                {telemetryData.cameraMode === 'bumper' && 'Alerón'}
                {telemetryData.cameraMode === 'orbit' && 'Aéreo'}
                {telemetryData.cameraMode === 'chase' && (telemetryData.cameraDistance === 'near' ? 'Cerca' : telemetryData.cameraDistance === 'far' ? 'Lejos' : 'Cámara')}
              </span>
            </button>

            {/* Fullscreen Toggle Button */}
            {onToggleFullscreen && (
              <button
                onClick={onToggleFullscreen}
                title={isFullscreen ? 'Salir de pantalla completa' : 'Poner juego en pantalla completa'}
                className="p-1.5 sm:px-2 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/5 transition-all active:scale-95 flex items-center gap-1"
              >
                {isFullscreen ? (
                  <Minimize className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <Maximize className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                )}
                <span className="hidden lg:inline text-[9px] font-bold uppercase tracking-wider text-neutral-300">
                  {isFullscreen ? 'Ventana' : 'Pantalla Completa'}
                </span>
              </button>
            )}

            {/* Quick Pit Stop Request Button */}
            {onRequestPitStop && (
              <button
                onClick={onRequestPitStop}
                title="Entrar a Boxes / Cambio de Neumáticos"
                disabled={telemetryData.isInPit}
                className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl border transition-all active:scale-95 flex items-center gap-1 font-bold ${
                  telemetryData.isInPit
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default'
                    : hasPuncture
                    ? 'bg-red-600 text-white border-red-400 shadow-lg shadow-red-950/80 animate-bounce'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white border-red-500/40'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-[9px] uppercase tracking-wider hidden xs:inline">
                  {telemetryData.isInPit ? 'Boxes' : hasPuncture ? '¡BOX NOW!' : 'BOX'}
                </span>
              </button>
            )}

            {/* Subtle Return to Mode Selection Button */}
            {onReturnToModes && (
              <button
                onClick={onReturnToModes}
                title="Volver a la selección de modos"
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-cyan-300 border border-white/10 transition-all active:scale-95 flex items-center gap-1"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider">
                  Modos
                </span>
              </button>
            )}

            {/* Pause Menu Trigger Button */}
            <button
              onClick={onOpenPause}
              title="Menú de Pausa"
              className="p-1.5 sm:p-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white border border-amber-500/40 transition-all active:scale-95 flex items-center justify-center font-bold"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* PROMINENT TIRE BLOWOUT / PUNCTURE WARNING BANNER */}
        {hasPuncture && !telemetryData.isInPit && (
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-600 border-2 border-red-300 text-white rounded-2xl px-3 sm:px-4 py-2 text-center shadow-2xl shadow-red-950/90 max-w-xl mx-auto flex items-center justify-center gap-2.5 pointer-events-auto animate-bounce">
            <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0 animate-pulse" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-yellow-200 leading-tight">
                ⚠️ ¡NEUMÁTICO REVENTADO / PINCHADO! MODO COJERA (MÁX 38 KM/H)
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-white leading-tight">
                Agarre comprometido y desvío lateral. Toca <strong>BOX</strong> para sustituir los neumáticos en boxes.
              </span>
            </div>
          </div>
        )}

        {/* PROMINENT DAMAGE DEGRADATION & SPEED LIMITER BANNER */}
        {!hasPuncture && !telemetryData.isInPit && telemetryData.isDamageLimiterActive && (
          <div className={`border-2 rounded-2xl px-3 sm:px-4 py-1.5 text-center shadow-2xl max-w-xl mx-auto flex items-center justify-center gap-2.5 pointer-events-auto transition-all ${
            (telemetryData.structuralIntegrity || 1) <= 0.22
              ? 'bg-gradient-to-r from-red-900 via-red-800 to-red-900 border-red-400 text-white shadow-red-950/90 animate-pulse'
              : 'bg-neutral-950/95 border-amber-500/70 text-amber-200 shadow-amber-950/60'
          }`}>
            <AlertTriangle className={`w-4 h-4 sm:w-5 sm:h-5 shrink-0 ${
              (telemetryData.structuralIntegrity || 1) <= 0.22 ? 'text-yellow-300 animate-bounce' : 'text-amber-400'
            }`} />
            <div className="flex flex-col text-left">
              <span className="text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider text-white leading-tight">
                {(telemetryData.structuralIntegrity || 1) <= 0.22
                  ? '⚠️ DAÑO CRÍTICO · MODO PROTECCIÓN MOTOR (LÍMITE ESTRICTO: 130 KM/H)'
                  : `⚠️ DAÑO ESTRUCTURAL · POTENCIA RESTRINGIDA (MÁX: ${telemetryData.dynamicMaxSpeedKmh || 325} KM/H)`}
              </span>
              <span className="text-[9px] sm:text-[10px] text-neutral-300 leading-tight">
                {(telemetryData.structuralIntegrity || 1) <= 0.22
                  ? 'Pérdida severa de prestaciones mecánicas. Entra a BOXES para reparar el vehículo.'
                  : 'Rendimiento aerodinámico y motor degradados por impacto. Toca BOX para reparar.'}
              </span>
            </div>
          </div>
        )}

        {/* PROMINENT TIRE PERFORMANCE CLIFF BANNER */}
        {!hasPuncture && !telemetryData.isInPit && isTireCliff && (
          <div className="bg-gradient-to-r from-red-900/90 via-rose-900/90 to-red-900/90 border-2 border-red-500/80 text-white rounded-2xl px-3 sm:px-4 py-1.5 text-center shadow-2xl max-w-xl mx-auto flex items-center justify-center gap-2.5 pointer-events-auto animate-pulse">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-300 shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-wider text-red-200 leading-tight">
                ⚠️ ACANTILADO DE NEUMÁTICOS (&gt;76% DESGASTE) · PÉRDIDA SEVERA DE TRACCIÓN Y FRENADA
              </span>
              <span className="text-[9px] sm:text-[10px] text-neutral-300 leading-tight">
                La goma ha colapsado. Alto riesgo de reventón y derrape. Toca <strong>BOX</strong> para cambio de neumáticos.
              </span>
            </div>
          </div>
        )}

        {/* TRACTION LOSS / WHEELSPIN BADGE */}
        {!hasPuncture && !telemetryData.isInPit && isWheelspin && (
          <div className="bg-amber-950/90 border border-amber-500 text-amber-200 rounded-xl px-3 py-1 text-center shadow-lg max-w-xs mx-auto flex items-center justify-center gap-1.5 pointer-events-auto animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-bounce" />
            <span className="text-[9px] font-black uppercase tracking-wider">
              ⚡ PÉRDIDA DE TRACCIÓN · PATINANDO EN SALIDA
            </span>
          </div>
        )}

        {/* Center: Pit Stop Telemetry Banner (when in pit) */}
        {telemetryData.isInPit && (
          <div className="bg-neutral-950/95 border-2 border-emerald-500/70 rounded-2xl px-3.5 py-1.5 sm:py-2 text-center shadow-2xl shadow-emerald-950/60 max-w-sm mx-auto flex flex-col gap-1 pointer-events-auto animate-in fade-in zoom-in-95 duration-200 transition-all">
            {telemetryData.broadcastCamName && (
              <div className="flex items-center justify-center gap-1.5 bg-red-950/60 border border-red-500/40 rounded py-0.5 px-2 text-[7.5px] font-bold text-red-200 uppercase tracking-widest transition-opacity duration-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping inline-block" />
                <span>DIRECTO · {telemetryData.broadcastCamName}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1 text-[11px] sm:text-xs">
              <span className="font-bold text-emerald-400 uppercase tracking-wide">
                {(telemetryData.pitPhase === 'entry_autopilot' || telemetryData.pitPhase === 'entry') && 'AUTOPILOT · LÍMITE 60 KM/H'}
                {telemetryData.pitPhase === 'docking' && 'COLOCANDO EN CAJÓN'}
                {(telemetryData.pitPhase === 'jacks_up' || telemetryData.pitPhase === 'jacking') && 'LEVANTANDO COCHE'}
                {(telemetryData.pitPhase === 'servicing' || telemetryData.pitPhase === 'service') && 'CAMBIO DE RUEDAS Y REPARACIÓN'}
                {telemetryData.pitPhase === 'jacks_down' && 'GATOS ABAJO · LISTO'}
                {(telemetryData.pitPhase === 'released' || telemetryData.pitPhase === 'exit') && '¡SALIDA DE BOXES!'}
                {telemetryData.pitPhase === 'none' && 'REINCORPORACIÓN A PISTA'}
              </span>
              <span ref={pitTimeRef} className="font-mono font-bold text-white tabular-nums">
                {telemetryData.pitPhase === 'entry_autopilot' ? '60 KM/H' : telemetryData.pitPhase === 'none' ? 'LIBRE' : `${telemetryData.pitTimeRemaining.toFixed(1)}s`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div
                ref={pitProgressRef}
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150"
                style={{ width: `${Math.min(100, telemetryData.pitProgress * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Victory Banner (Multiplayer Finish) */}
        {raceWinner && (
          <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 border-2 border-yellow-300 rounded-3xl px-5 py-2.5 text-center shadow-2xl shadow-amber-950/80 max-w-md mx-auto flex items-center justify-center gap-3 pointer-events-auto animate-bounce">
            <Trophy className="w-6 h-6 text-neutral-950 fill-current shrink-0" />
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-black uppercase tracking-widest text-neutral-950">
                ¡GANADOR DE LA CARRERA 1 VS 1!
              </span>
              <span className="text-base sm:text-lg font-black text-neutral-950 font-mono tracking-tight leading-none">
                {raceWinner.name} ({raceWinner.id === myPlayerId ? '¡ERES TÚ!' : 'RIVAL'})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top Left Floating Solo Free Practice / Time Trial Timing Widget */}
      {telemetryData.isFreePractice && (
        <div className="pointer-events-auto absolute top-14 sm:top-16 left-2 sm:left-3 z-10 flex flex-col gap-1.5 w-[185px] sm:w-[220px] bg-neutral-950/90 border border-cyan-500/30 rounded-2xl p-2.5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-1 text-[8px] sm:text-[8.5px] font-black tracking-widest text-cyan-400 uppercase">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping inline-block" />
              VUELTAS LIBRES · TIME TRIAL
            </span>
          </div>

          <div className="flex flex-col gap-1 font-mono text-[9px] sm:text-[10px]">
            <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-neutral-900/80 border border-white/5">
              <span className="text-neutral-400 text-[8px] uppercase font-bold">RÉCORD PERSONAL:</span>
              <span className="font-black text-amber-400 tabular-nums">
                {telemetryData.bestLap ? formatTime(telemetryData.bestLap) : '--:--,---'}
              </span>
            </div>

            <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-neutral-900/80 border border-white/5">
              <span className="text-neutral-400 text-[8px] uppercase font-bold">VUELTA ACTUAL:</span>
              <span className="font-bold text-white tabular-nums">
                {formatTime(telemetryData.lapTime)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Left Floating F1 Live Timing Tower (1v1 Duelo P1 / P2) */}
      {!telemetryData.isFreePractice && telemetryData.careerLeaderboard && telemetryData.careerLeaderboard.length > 0 && (
        <div className="pointer-events-auto absolute top-14 sm:top-16 left-2 sm:left-3 z-10 flex flex-col gap-1 w-[190px] sm:w-[230px] bg-neutral-950/90 border border-white/10 rounded-2xl p-2 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-1 text-[8px] sm:text-[8.5px] font-black tracking-widest text-neutral-400 uppercase">
            <span>TIEMPOS F1 EN VIVO</span>
            {telemetryData.careerConfig?.requiresTwoCompounds && (
              <span className="text-amber-400 text-[7px] font-bold">2 COMP OBLIG.</span>
            )}
          </div>

          {/* Drivers Rows (P1 & P2) */}
          <div className="flex flex-col gap-1">
            {telemetryData.careerLeaderboard.map((entry) => {
              const compCss = TIRE_COMPOUNDS[entry.currentCompound]?.colorCss || '#ef4444';
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-1.5 py-1 rounded-xl text-[8px] sm:text-[9px] font-mono font-bold transition-all border ${
                    entry.isPlayer
                       ? 'bg-blue-600/25 border-blue-500/50 text-white shadow-sm ring-1 ring-blue-400/30'
                      : 'bg-neutral-900/60 border-white/5 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    {/* Position */}
                    <span className={`w-3.5 text-center font-black ${entry.position === 1 ? 'text-amber-400' : 'text-neutral-400'}`}>
                      P{entry.position}
                    </span>
                    {/* Team Color Strip */}
                    <span className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.teamColorCss }} />
                    {/* Driver Code */}
                    <span className="font-black text-white tracking-wider truncate max-w-[42px] sm:max-w-[65px]">
                      {entry.driverCode}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Gap */}
                    <span className={`text-[7.5px] sm:text-[8.5px] tabular-nums font-mono ${entry.position === 1 ? 'text-amber-400 font-black' : 'text-neutral-200 font-bold'}`}>
                      {entry.gapToLeaderFormatted}
                    </span>

                    {/* Compound Badge */}
                    <span
                      className="px-1 py-0.5 rounded text-[7px] font-black uppercase border leading-none shrink-0"
                      style={{
                        backgroundColor: `${compCss}22`,
                        borderColor: `${compCss}66`,
                        color: compCss,
                      }}
                    >
                      {entry.currentCompound.charAt(0).toUpperCase()}
                    </span>

                    {/* Pit count / Box indicator */}
                    <span className="text-[7px] text-neutral-400 font-bold shrink-0">
                      {entry.isInPit ? 'BOX' : `P${entry.pitStopsCount}`}
                    </span>

                    {/* Mandatory 2-Compound Rule Status Badge */}
                    {telemetryData.careerConfig?.requiresTwoCompounds && (
                      <span title={entry.hasSatisfiedTireRule ? 'Cumple regla de 2 compuestos' : 'Pendiente usar 2º compuesto'}>
                        {entry.hasSatisfiedTireRule ? (
                          <span className="text-emerald-400 text-[8px]">✓</span>
                        ) : (
                          <span className="text-amber-400 text-[8px] animate-pulse">⚠️</span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Right Floating Compact & Subtle Tire Status & Next Pit Strategy Selector */}
      <div className="pointer-events-auto absolute top-14 sm:top-16 right-2 sm:right-3 z-40 flex flex-col items-end gap-1.5">
        <div className="bg-neutral-950/95 hover:bg-neutral-950 transition-colors border border-white/10 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5 w-[185px] sm:w-[215px]">
          
          {/* Header with Active Compound Indicator */}
          <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1">
            <div className="flex items-center gap-1">
              <Disc className="w-3 h-3" style={{ color: currentCompound.colorCss }} />
              <span className="text-[8px] sm:text-[8.5px] font-black tracking-wider uppercase text-neutral-300">
                NEUMÁTICOS
              </span>
            </div>
            <div
              className="px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider flex items-center gap-1 border"
              style={{
                backgroundColor: `${currentCompound.colorCss}18`,
                borderColor: `${currentCompound.colorCss}55`,
                color: currentCompound.colorCss,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentCompound.colorCss }} />
              <span>{currentCompound.code}</span>
            </div>
          </div>

          {/* Micro 4-Wheel Degradation Grid (FL, FR, RL, RR) */}
          <div className="grid grid-cols-2 gap-1 text-[7.5px]">
            {[
              { idx: 0, label: 'D-IZQ' },
              { idx: 1, label: 'D-DER' },
              { idx: 2, label: 'T-IZQ' },
              { idx: 3, label: 'T-DER' },
            ].map(({ idx, label }) => {
              const b = getTireStatusBadge(idx);
              const gripPct = Math.round((gripIndices[idx] || 1) * 100);
              const isFlat = (flatSpots[idx] || 0) > 0.15;

              return (
                <div key={label} className={`rounded-md border p-1 flex flex-col justify-between gap-0.5 ${b.bg}`}>
                  <div className="flex items-center justify-between font-bold leading-tight">
                    <span className="opacity-80 flex items-center gap-0.5">
                      {label}
                      {isFlat && <span className="bg-red-600 text-white rounded px-0.5 text-[6px] font-black">PLN</span>}
                    </span>
                    <span className="tabular-nums">{b.text}</span>
                  </div>
                  <div className="flex items-center justify-between text-[6.5px] leading-none mt-0.5">
                    <span className="text-neutral-400 font-medium">AGARRE</span>
                    <span className="opacity-75 font-mono">G:{gripPct}%</span>
                  </div>
                  {/* Micro Grip Meter */}
                  <div className="w-full bg-neutral-900/80 rounded-full h-1 overflow-hidden mt-0.5 border border-white/5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        gripPct > 75 ? 'bg-emerald-400' : gripPct > 45 ? 'bg-amber-400' : 'bg-red-500 animate-pulse'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, gripPct))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modern & Non-Invasive Next Pit Stop Compound Selector */}
          <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between text-[7px] uppercase font-bold tracking-wider text-neutral-400">
              <span>SIGUIENTE PARADA</span>
              <span className="font-mono text-white font-black">
                {nextCompoundType === 'soft' && 'SOFT'}
                {nextCompoundType === 'medium' && 'MED'}
                {nextCompoundType === 'hard' && 'HARD'}
              </span>
            </div>

            {/* Segmented Selector Buttons */}
            <div className="grid grid-cols-3 gap-1 bg-neutral-900/90 p-0.5 rounded-lg border border-white/5 pointer-events-auto">
              {/* Soft (C3 Red) */}
              <button
                type="button"
                onClick={(e) => handleChooseNextCompound(e, 'soft')}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Elegir compuesto Blando (C3 Rojo) para el próximo cambio"
                className={`py-1 rounded-md text-[7.5px] sm:text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer select-none touch-manipulation pointer-events-auto ${
                  nextCompoundType === 'soft'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/80 ring-1 ring-red-400'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <span>S</span>
                {nextCompoundType === 'soft' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>

              {/* Medium (C2 Yellow) */}
              <button
                type="button"
                onClick={(e) => handleChooseNextCompound(e, 'medium')}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Elegir compuesto Medio (C2 Amarillo) para el próximo cambio"
                className={`py-1 rounded-md text-[7.5px] sm:text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer select-none touch-manipulation pointer-events-auto ${
                  nextCompoundType === 'medium'
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-950/80 ring-1 ring-amber-300 font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                <span>M</span>
                {nextCompoundType === 'medium' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>

              {/* Hard (C1 White) */}
              <button
                type="button"
                onClick={(e) => handleChooseNextCompound(e, 'hard')}
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Elegir compuesto Duro (C1 Blanco) para el próximo cambio"
                className={`py-1 rounded-md text-[7.5px] sm:text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer select-none touch-manipulation pointer-events-auto ${
                  nextCompoundType === 'hard'
                    ? 'bg-neutral-100 text-neutral-950 shadow-md ring-1 ring-white font-black'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span>H</span>
                {nextCompoundType === 'hard' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
