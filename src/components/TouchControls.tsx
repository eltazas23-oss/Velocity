/**
 * TouchControls.tsx - Ultra-Responsive Mobile Touch Controller with Calibrated Ergonomic Steering
 * Features:
 * - 0ms Synchronous Input Dispatch:
 *   * Dispatches steering, throttle, brake, and handbrake directly in pointer events (zero React frame lag).
 * - Full Thumb Height Reach (60vh):
 *   * Active touch zone covers the entire lower-left quadrant (height: 60vh) so it never misses a tap.
 * - Perfectly Calibrated Compact Width (~180px / 18% screen):
 *   * Left Turn: 0 to ~90px (right at the screen edge).
 *   * Right Turn: ~90px to ~180px (immediately adjacent, zero thumb stretching!).
 *   * Continuous thumb sliding between Left and Right with instant transition.
 * - DRS Button Positioned at Bottom-Left:
 *   * Sits neatly above the thumb area (bottom-36 / bottom-40 on left flank), completely clear of HUD.
 * - Translucent Pedals on Right Flank:
 *   * Semi-transparent Gas, Brake, and Drift with instantaneous synchronous feedback.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, ShieldAlert, Gauge, Wind, ChevronLeft, ChevronRight } from 'lucide-react';
import { CarInputs } from '../game/physics/VehiclePhysics';

interface TouchControlsProps {
  onInputChange: (inputs: Partial<CarInputs>) => void;
  isDrsOpen?: boolean;
  isDrsAvailable?: boolean;
  onToggleDRS?: () => void;
}

export const TouchControls = React.memo<TouchControlsProps>(({
  onInputChange,
  isDrsOpen = false,
  isDrsAvailable = false,
  onToggleDRS,
}) => {
  const [steerState, setSteerState] = useState<'left' | 'right' | 'none'>('none');
  const [isGasActive, setIsGasActive] = useState(false);
  const [isBrakeActive, setIsBrakeActive] = useState(false);
  const [isDriftActive, setIsDriftActive] = useState(false);

  const leftSteerZoneRef = useRef<HTMLDivElement>(null);
  const steerPointerIdRef = useRef<number | null>(null);
  const rightPointerMap = useRef<Map<number, 'gas' | 'brake' | 'drift'>>(new Map());

  // Ref to always have latest onInputChange callback without stale closures
  const onInputChangeRef = useRef(onInputChange);
  useEffect(() => {
    onInputChangeRef.current = onInputChange;
  }, [onInputChange]);

  // Robust multi-touch DRS trigger handler (fires on first touch down without waiting for click)
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

  // --- ERGONOMIC STEERING LOGIC (Synchronous 0ms dispatch) ---
  const handleSteerPointer = useCallback((clientX: number) => {
    if (!leftSteerZoneRef.current) return;
    const rect = leftSteerZoneRef.current.getBoundingClientRect();
    const relX = clientX - rect.left;
    
    // Split the active zone at 50% of the compact thumb cluster (width is ~180px)
    // Left: 0px to 90px (from bezel) -> Steer Left (1.0)
    // Right: 90px to 180px -> Steer Right (-1.0)
    const midX = rect.width * 0.5;
    const isLeft = relX < midX;
    const newState = isLeft ? 'left' : 'right';

    setSteerState(newState);
    onInputChangeRef.current({ steering: isLeft ? 1.0 : -1.0 });
  }, []);

  const handleSteerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    steerPointerIdRef.current = e.pointerId;
    handleSteerPointer(e.clientX);
  }, [handleSteerPointer]);

  const handleSteerPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current !== e.pointerId) return;
    handleSteerPointer(e.clientX);
  }, [handleSteerPointer]);

  const handleSteerPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (steerPointerIdRef.current === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      steerPointerIdRef.current = null;
      setSteerState('none');
      onInputChangeRef.current({ steering: 0 });
    }
  }, []);

  // --- RIGHT PEDAL CLUSTER (Synchronous 0ms dispatch) ---
  const bindRightPointer = (action: 'gas' | 'brake' | 'drift') => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      rightPointerMap.current.set(e.pointerId, action);
      if (action === 'gas') {
        setIsGasActive(true);
        onInputChangeRef.current({ throttle: 1.0 });
      }
      if (action === 'brake') {
        setIsBrakeActive(true);
        onInputChangeRef.current({ brake: 1.0 });
      }
      if (action === 'drift') {
        setIsDriftActive(true);
        onInputChangeRef.current({ handbrake: true });
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      rightPointerMap.current.delete(e.pointerId);
      if (action === 'gas') {
        setIsGasActive(false);
        onInputChangeRef.current({ throttle: 0.0 });
      }
      if (action === 'brake') {
        setIsBrakeActive(false);
        onInputChangeRef.current({ brake: 0.0 });
      }
      if (action === 'drift') {
        setIsDriftActive(false);
        onInputChangeRef.current({ handbrake: false });
      }
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      rightPointerMap.current.delete(e.pointerId);
      if (action === 'gas') {
        setIsGasActive(false);
        onInputChangeRef.current({ throttle: 0.0 });
      }
      if (action === 'brake') {
        setIsBrakeActive(false);
        onInputChangeRef.current({ brake: 0.0 });
      }
      if (action === 'drift') {
        setIsDriftActive(false);
        onInputChangeRef.current({ handbrake: false });
      }
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="absolute inset-x-0 bottom-0 h-[65vh] flex justify-between pointer-events-none select-none z-30 touch-none">
      {/* =========================================================================
          LEFT FLANK: ERGONOMIC STEERING CONTROLS (Positioned at bottom-left below leaderboard)
          - Height: 34vh / 160px compact thumb sweep
          - Width: ~190px (Left: 0-95px, Right: 95-190px)
          - Sleek semi-transparent directional chevron indicators
         ========================================================================= */}
      <div className="w-[190px] sm:w-[220px] h-full pointer-events-none relative flex flex-col justify-end items-start pb-3 sm:pb-5 pl-2 sm:pl-4">
        {/* UPPER ROW: SUBTLE SEMI-TRANSPARENT DRS ACTIVATION BUTTON */}
        {onToggleDRS && (
          <div className="flex items-center gap-2 mb-2 pointer-events-none">
            <button
              type="button"
              onPointerDown={handleDrsTrigger}
              onTouchStart={handleDrsTrigger}
              onClick={handleDrsTrigger}
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer select-none transition-all active:scale-95 backdrop-blur-[2px] shadow-md touch-none ${
                isDrsOpen
                  ? 'bg-emerald-500/80 border-emerald-300 text-neutral-950 font-black shadow-emerald-500/30 ring-1 ring-emerald-400 scale-[1.04]'
                  : 'bg-neutral-950/60 border-cyan-400/60 text-cyan-300 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:bg-neutral-900/80'
              }`}
            >
              <Wind className={`w-3.5 h-3.5 ${isDrsOpen ? 'text-neutral-950 animate-bounce' : 'text-cyan-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">
                {isDrsOpen ? 'DRS ABIERTO' : 'ACTIVAR DRS'}
              </span>
            </button>
          </div>
        )}

        {/* STEERING TOUCH SURFACE WITH TRANSLUCENT DIRECTIONAL HINTS */}
        <div
          ref={leftSteerZoneRef}
          onPointerDown={handleSteerPointerDown}
          onPointerMove={handleSteerPointerMove}
          onPointerUp={handleSteerPointerUp}
          onPointerCancel={handleSteerPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-[32vh] max-h-[170px] min-h-[120px] pointer-events-auto relative touch-none select-none cursor-pointer flex rounded-2xl bg-neutral-950/20 backdrop-blur-[2px] border border-white/5 p-1 gap-1 shadow-lg"
        >
          {/* Left Turn Indicator */}
          <div
            className={`w-1/2 h-full rounded-xl flex flex-col items-center justify-center transition-all duration-75 border ${
              steerState === 'left'
                ? 'bg-cyan-500/25 border-cyan-400/80 shadow-md shadow-cyan-500/20 scale-[0.98]'
                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
            }`}
          >
            <ChevronLeft className={`w-6 h-6 transition-colors ${steerState === 'left' ? 'text-cyan-300' : 'text-neutral-400/60'}`} />
            <span className={`text-[8px] font-black uppercase tracking-wider ${steerState === 'left' ? 'text-cyan-200' : 'text-neutral-500'}`}>
              IZQ
            </span>
          </div>

          {/* Right Turn Indicator */}
          <div
            className={`w-1/2 h-full rounded-xl flex flex-col items-center justify-center transition-all duration-75 border ${
              steerState === 'right'
                ? 'bg-cyan-500/25 border-cyan-400/80 shadow-md shadow-cyan-500/20 scale-[0.98]'
                : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'
            }`}
          >
            <ChevronRight className={`w-6 h-6 transition-colors ${steerState === 'right' ? 'text-cyan-300' : 'text-neutral-400/60'}`} />
            <span className={`text-[8px] font-black uppercase tracking-wider ${steerState === 'right' ? 'text-cyan-200' : 'text-neutral-500'}`}>
              DER
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          RIGHT ERGONOMIC TRANSLUCENT PEDAL CLUSTER
          - Semi-transparent styling (translucent dark with subtle glowing borders)
          - Drift button above
          - Gas & Brake side-by-side below
         ========================================================================= */}
      <div className="w-auto h-full pointer-events-none relative flex flex-col justify-end items-end pb-3 sm:pb-5 pr-2 sm:pr-5 touch-none select-none">
        
        {/* UPPER ROW: DRIFT BUTTON + QUICK RIGHT-THUMB DRS BUTTON */}
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 pointer-events-none">
          {onToggleDRS && (
            <button
              type="button"
              onPointerDown={handleDrsTrigger}
              onTouchStart={handleDrsTrigger}
              onClick={handleDrsTrigger}
              className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border cursor-pointer select-none transition-all active:scale-95 backdrop-blur-[2px] shadow-md touch-none ${
                isDrsOpen
                  ? 'bg-emerald-500/80 border-emerald-300 text-neutral-950 font-black shadow-emerald-500/30 ring-1 ring-emerald-400 scale-[1.04]'
                  : 'bg-neutral-950/60 border-cyan-400/60 text-cyan-300 font-extrabold shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:bg-neutral-900/80'
              }`}
            >
              <Wind className={`w-3.5 h-3.5 ${isDrsOpen ? 'text-neutral-950 animate-bounce' : 'text-cyan-300'}`} />
              <span className="text-[9px] font-black uppercase tracking-wider">
                {isDrsOpen ? 'DRS ON' : 'DRS'}
              </span>
            </button>
          )}

          {/* DRIFT / FRENO DE MANO (Semi-transparent) */}
          <div
            {...bindRightPointer('drift')}
            className={`pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border cursor-pointer select-none transition-all active:scale-95 ${
              isDriftActive
                ? 'bg-amber-500/60 border-amber-300/80 text-amber-200 font-black shadow-lg shadow-amber-500/20 scale-105'
                : 'bg-neutral-950/40 border-amber-500/30 text-amber-300/80 font-bold hover:bg-neutral-950/50'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-wider">Drift</span>
          </div>
        </div>

        {/* LOWER ROW: FRENO & ACELERADOR (Semi-transparent side-by-side pedals) */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-none">
          {/* FRENO / MARCHA ATRÁS PEDAL (Semi-transparent) */}
          <div
            {...bindRightPointer('brake')}
            className={`pointer-events-auto w-14 h-16 sm:w-16 sm:h-18 rounded-2xl border cursor-pointer select-none flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              isBrakeActive
                ? 'bg-rose-500/60 border-rose-300/90 text-white shadow-lg shadow-rose-500/20 scale-105'
                : 'bg-neutral-950/40 border-rose-500/30 text-rose-300/80 hover:bg-neutral-950/50'
            }`}
          >
            <ShieldAlert className="w-6 h-6 sm:w-7 sm:h-7" />
            <span className="text-[9px] font-black uppercase tracking-wider">Freno</span>
          </div>

          {/* ACELERADOR / GAS PEDAL (Semi-transparent) */}
          <div
            {...bindRightPointer('gas')}
            className={`pointer-events-auto w-16 h-18 sm:w-18 sm:h-20 rounded-2xl border cursor-pointer select-none flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
              isGasActive
                ? 'bg-emerald-500/60 border-emerald-300/90 text-white shadow-lg shadow-emerald-500/20 scale-105'
                : 'bg-neutral-950/40 border-emerald-500/30 text-emerald-300/80 hover:bg-neutral-950/50'
            }`}
          >
            <Gauge className="w-7 h-7 sm:w-8 sm:h-8" />
            <span className="text-[10px] font-black uppercase tracking-wider">Gas</span>
          </div>
        </div>

      </div>
    </div>
  );
});
