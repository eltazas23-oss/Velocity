/**
 * MainMenuDashboard.tsx
 * Ultra-Premium AAA Racing Operations Hub for Apex GT.
 * Built with a clean 3-column studio layout inspired by Gran Turismo 7 and F1 24:
 * 1. Column 1: Primary Mode Cards (Gran Premio, Time Trial, Multijugador 1v1, Garaje 3D).
 * 2. Column 2: Dynamic Session Configurator (Circuit selector with SVG maps, Laps, Difficulty, Tire Strategy).
 * 3. Column 3: Telemetry Dossier & Launch Station (Driver ID, Camera presets, and Launch CTA).
 */

import React, { useState } from 'react';
import {
  Trophy,
  Timer,
  Users,
  Wrench,
  Play,
  ArrowLeft,
  Check,
  Copy,
  Upload,
  Zap,
  Compass,
  Flag,
  Car,
  HelpCircle,
  AlertCircle,
  Sparkles,
  ChevronRight,
  Sliders,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Radio,
} from 'lucide-react';
import { CameraDistanceMode, CameraViewMode } from '../game/RacingGameEngine';
import { MultiplayerRoomState } from '../game/multiplayer/MultiplayerClient';
import { RaceDifficulty, RaceLapOption } from '../game/career/CareerTypes';
import { TireCompoundType } from '../game/physics/TireCompound';
import { playUiClick, playUiHover, playModeSelectChime } from '../utils/uiAudio';
import { CircuitId } from '../game/circuits/ICircuit';
import { AVAILABLE_CIRCUITS } from '../game/circuits/CircuitRegistry';

interface MainMenuDashboardProps {
  onStartSolo: (
    cameraDistance: CameraDistanceMode,
    cameraMode: CameraViewMode,
    laps: RaceLapOption,
    difficulty: RaceDifficulty,
    startingCompound: TireCompoundType,
    circuitId?: CircuitId
  ) => void;
  onStartFreePractice?: (
    cameraDistance: CameraDistanceMode,
    cameraMode: CameraViewMode,
    startingCompound: TireCompoundType,
    circuitId?: CircuitId
  ) => void;
  selectedCircuit?: CircuitId;
  onSelectCircuit?: (circuitId: CircuitId) => void;
  onCreateRoom: (options: {
    playerName: string;
    laps: number;
    car1Name: string;
    car2Name: string;
    crewName: string;
    cameraDistance: CameraDistanceMode;
    cameraMode: CameraViewMode;
    car1Data?: string;
    car2Data?: string;
    crewData?: string;
  }) => Promise<void>;
  onJoinRoom: (code: string, playerName: string, cameraDistance: CameraDistanceMode, cameraMode: CameraViewMode) => Promise<void>;
  onStartMultiplayerRace: () => void;
  onSetReady: (isReady: boolean) => void;
  onLeaveRoom: () => void;
  onBackToTitle: () => void;
  roomState: MultiplayerRoomState | null;
  playerId: 'p1' | 'p2' | null;
  isConnecting: boolean;
  errorMessage: string | null;
  onOpenModelUpload: (target: 'car1' | 'car2' | 'crew') => void;
  car1Name: string;
  car2Name: string;
  crewName: string;
}

export const MainMenuDashboard: React.FC<MainMenuDashboardProps> = ({
  onStartSolo,
  onStartFreePractice,
  selectedCircuit: initialCircuit,
  onSelectCircuit,
  onCreateRoom,
  onJoinRoom,
  onStartMultiplayerRace,
  onSetReady,
  onLeaveRoom,
  onBackToTitle,
  roomState,
  playerId,
  isConnecting,
  errorMessage,
  onOpenModelUpload,
  car1Name,
  car2Name,
  crewName,
}) => {
  // Primary Game Mode Selection
  const [activeMode, setActiveMode] = useState<'grand_prix' | 'time_trial' | 'multiplayer' | 'garage'>('grand_prix');

  // Pilot Dossier
  const [playerName, setPlayerName] = useState<string>('PILOTO APEX');
  const [carNumber, setCarNumber] = useState<string>('33');

  // Session Tuning
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>(initialCircuit || 'square_apex');
  const [careerLaps, setCareerLaps] = useState<RaceLapOption>(9);
  const [difficulty, setDifficulty] = useState<RaceDifficulty>('medium');
  const [startingCompound, setStartingCompound] = useState<TireCompoundType>('soft');

  // Camera Ergonomics
  const [cameraDistance, setCameraDistance] = useState<CameraDistanceMode>('medium');
  const [cameraMode, setCameraMode] = useState<CameraViewMode>('chase');

  // Multiplayer sub-views
  const [mpSubView, setMpSubView] = useState<'create' | 'join'>('create');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [mpLaps, setMpLaps] = useState<number>(3);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);

  // Controls Guide Modal
  const [showControlsModal, setShowControlsModal] = useState<boolean>(false);

  const handleModeSwitch = (mode: 'grand_prix' | 'time_trial' | 'multiplayer' | 'garage') => {
    setActiveMode(mode);
    playModeSelectChime();
  };

  const handleLaunch = () => {
    playUiClick(950);
    if (activeMode === 'grand_prix') {
      onStartSolo(cameraDistance, cameraMode, careerLaps, difficulty, startingCompound, selectedCircuit);
    } else if (activeMode === 'time_trial' || activeMode === 'garage') {
      if (onStartFreePractice) {
        onStartFreePractice(cameraDistance, cameraMode, startingCompound, selectedCircuit);
      } else {
        onStartSolo(cameraDistance, cameraMode, 9, 'easy', startingCompound, selectedCircuit);
      }
    }
  };

  const currentCircuit = AVAILABLE_CIRCUITS.find((c) => c.id === selectedCircuit) || AVAILABLE_CIRCUITS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto overflow-x-hidden select-none text-white font-mono bg-[#0a0d14]"
      style={{
        backgroundColor: '#0a0d14',
      }}
    >
      {/* ========================================================================= */}
      {/* 1. TOP STATUS BAR                                                        */}
      {/* ========================================================================= */}
      <header className="w-full border-b border-neutral-800 bg-[#0d111a] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40">
        {/* Left: Back to Title & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              playUiClick(750);
              onBackToTitle();
            }}
            onMouseEnter={playUiHover}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-500 text-neutral-200 hover:text-white transition-all text-xs font-semibold tracking-wider cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">INICIO</span>
          </button>

          <div className="h-4 w-px bg-neutral-700" />

          <div className="flex items-center gap-2">
            <span className="font-black text-sm tracking-widest text-neutral-100">APEX GT</span>
            <span className="text-[11px] text-red-400 font-bold tracking-widest hidden sm:inline">
              // OPERACIONES DE PADDOCK
            </span>
          </div>
        </div>

        {/* Center: Season Badge */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-950/80 border border-red-600/50 text-red-300 text-[10px] font-bold tracking-[0.25em] uppercase">
          <Sparkles className="w-3 h-3 text-red-400" />
          <span>CAMPEONATO MUNDIAL 2026</span>
        </div>

        {/* Right: Driver Pill & Controls Dialog */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-xs">
            <span className="text-amber-400 font-black">#{carNumber}</span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.toUpperCase().slice(0, 14))}
              className="bg-transparent border-none outline-none text-white font-bold text-xs tracking-wider w-24 sm:w-28 uppercase"
              placeholder="PILOTO"
            />
          </div>

          <button
            onClick={() => {
              playUiClick(800);
              setShowControlsModal(true);
            }}
            onMouseEnter={playUiHover}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 hover:text-white transition-all cursor-pointer"
            title="Guía de Controles"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. MAIN 3-COLUMN STUDIO OPERATIONS WORKSPACE                             */}
      {/* ========================================================================= */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 1: PRIMARY GAME MODE SELECTOR (3 COLS)                          */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase">
            <Sliders className="w-3.5 h-3.5 text-red-400" />
            <span>MODOS DE JUEGO</span>
          </div>

          {/* Mode Card 1: Gran Premio */}
          <button
            onClick={() => handleModeSwitch('grand_prix')}
            onMouseEnter={playUiHover}
            className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border flex flex-col gap-2 relative overflow-hidden cursor-pointer ${
              activeMode === 'grand_prix'
                ? 'bg-[#1e1315] border-red-500 shadow-[0_0_25px_rgba(220,38,38,0.35)] ring-2 ring-red-500/50'
                : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-red-400 uppercase">01 // CARRERA</span>
              <Trophy className={`w-4 h-4 ${activeMode === 'grand_prix' ? 'text-amber-400' : 'text-neutral-400'}`} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider text-white">GRAN PREMIO</h2>
              <p className="text-xs text-neutral-300 font-normal leading-relaxed mt-0.5">
                Duelo 1 vs 1 contra coche rival de IA, estrategia de gomas y parada en boxes.
              </p>
            </div>
          </button>

          {/* Mode Card 2: Time Trial / Vuelta Rápida */}
          <button
            onClick={() => handleModeSwitch('time_trial')}
            onMouseEnter={playUiHover}
            className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border flex flex-col gap-2 relative overflow-hidden cursor-pointer ${
              activeMode === 'time_trial'
                ? 'bg-[#101828] border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.35)] ring-2 ring-blue-500/50'
                : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-blue-400 uppercase">02 // SOLITARIO</span>
              <Timer className={`w-4 h-4 ${activeMode === 'time_trial' ? 'text-blue-400' : 'text-neutral-400'}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-wider text-white">TIME TRIAL</h3>
              <p className="text-xs text-neutral-300 font-normal leading-relaxed mt-0.5">
                Vueltas libres sin tráfico. Optimiza tu trazada y pulveriza el récord de vuelta.
              </p>
            </div>
          </button>

          {/* Mode Card 3: Multijugador 1v1 */}
          <button
            onClick={() => handleModeSwitch('multiplayer')}
            onMouseEnter={playUiHover}
            className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border flex flex-col gap-2 relative overflow-hidden cursor-pointer ${
              activeMode === 'multiplayer'
                ? 'bg-[#191124] border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.35)] ring-2 ring-purple-500/50'
                : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-purple-400 uppercase">03 // ONLINE</span>
              <Users className={`w-4 h-4 ${activeMode === 'multiplayer' ? 'text-purple-400' : 'text-neutral-400'}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-wider text-white">MULTIJUGADOR 1v1</h3>
              <p className="text-xs text-neutral-300 font-normal leading-relaxed mt-0.5">
                Duelo en tiempo real con salas privadas por código de invitación instantáneo.
              </p>
            </div>
          </button>

          {/* Mode Card 4: Garaje & Modelos 3D */}
          <button
            onClick={() => handleModeSwitch('garage')}
            onMouseEnter={playUiHover}
            className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border flex flex-col gap-2 relative overflow-hidden cursor-pointer ${
              activeMode === 'garage'
                ? 'bg-[#1f1910] border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/50'
                : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 hover:border-neutral-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold tracking-[0.25em] text-amber-400 uppercase">04 // TALLER</span>
              <Wrench className={`w-4 h-4 ${activeMode === 'garage' ? 'text-amber-400' : 'text-neutral-400'}`} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-wider text-white">GARAJE & MODELOS 3D</h3>
              <p className="text-xs text-neutral-300 font-normal leading-relaxed mt-0.5">
                Personaliza los coches y el equipo de mecánicos subiendo archivos GLB/GLTF.
              </p>
            </div>
          </button>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 2: DYNAMIC SESSION CONFIGURATOR (6 COLS)                        */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          {/* Mode: Gran Premio or Time Trial Session Setup */}
          {(activeMode === 'grand_prix' || activeMode === 'time_trial') && (
            <>
              {/* Circuit Selection Deck */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-red-400" />
                    <span>CIRCUITO OFICIAL</span>
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold">{currentCircuit.name}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {AVAILABLE_CIRCUITS.map((circ) => {
                    const isSelected = selectedCircuit === circ.id;
                    return (
                      <button
                        key={circ.id}
                        onClick={() => {
                          setSelectedCircuit(circ.id);
                          onSelectCircuit?.(circ.id);
                          playUiClick(850);
                        }}
                        onMouseEnter={playUiHover}
                        className={`p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden flex flex-col gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-[#1e1315] border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] ring-2 ring-red-500/40'
                            : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 hover:border-neutral-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base">{circ.flagEmoji}</span>
                          <span className="text-[10px] font-bold tracking-widest text-neutral-300 uppercase">
                            {circ.totalLength}M
                          </span>
                        </div>

                        {/* Track SVG Vector Silhouette */}
                        <div className="w-full h-16 flex items-center justify-center py-1 bg-[#090c12] rounded-xl border border-neutral-800">
                          <svg viewBox={circ.minimapConfig.viewBox} className="w-full h-full max-h-14 overflow-visible p-1">
                            <path
                              d={circ.minimapConfig.svgTrackPath}
                              fill="none"
                              stroke={isSelected ? '#ef4444' : '#6b7280'}
                              strokeWidth="5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="transition-colors duration-300"
                            />
                            {circ.minimapConfig.pitLaneSvgPath && (
                              <path
                                d={circ.minimapConfig.pitLaneSvgPath}
                                fill="none"
                                stroke={isSelected ? '#f59e0b' : '#4b5563'}
                                strokeWidth="3"
                                strokeDasharray="3 3"
                              />
                            )}
                          </svg>
                        </div>

                        <div>
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-black tracking-wider text-white">{circ.name}</h4>
                            {isSelected && <Check className="w-4 h-4 text-red-400 font-bold" />}
                          </div>
                          <p className="text-[11px] text-neutral-300 font-medium line-clamp-1 mt-0.5">{circ.tagline}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Race Length Selection (Only in Gran Premio) */}
              {activeMode === 'grand_prix' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase flex items-center gap-2">
                      <Flag className="w-3.5 h-3.5 text-amber-400" />
                      <span>DURACIÓN DE CARRERA</span>
                    </span>
                    <span className="text-[11px] text-amber-400 font-bold">{careerLaps} VUELTAS</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {([9, 20, 50] as RaceLapOption[]).map((laps) => (
                      <button
                        key={laps}
                        onClick={() => {
                          setCareerLaps(laps);
                          playUiClick(800);
                        }}
                        onMouseEnter={playUiHover}
                        className={`py-3 rounded-xl border text-center transition-all cursor-pointer font-black text-xs ${
                          careerLaps === laps
                            ? 'bg-amber-600 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                            : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 text-neutral-200'
                        }`}
                      >
                        {laps} VUELTAS
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Difficulty Selection (Only in Gran Premio) */}
              {activeMode === 'grand_prix' && (
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                      <span>NIVEL DE RIVALES IA</span>
                    </span>
                    <span className="text-[11px] text-red-400 font-bold uppercase">{difficulty}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'easy', label: 'NOVATO', desc: 'Ritmo suave' },
                      { id: 'medium', label: 'COMPETITIVO', desc: 'Ritmo estándar' },
                      { id: 'hard', label: 'LEYENDA F1', desc: 'Máxima exigencia' },
                    ].map((diff) => (
                      <button
                        key={diff.id}
                        onClick={() => {
                          setDifficulty(diff.id as RaceDifficulty);
                          playUiClick(800);
                        }}
                        onMouseEnter={playUiHover}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                          difficulty === diff.id
                            ? 'bg-red-700 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                            : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 text-neutral-200'
                        }`}
                      >
                        <span className="font-bold text-xs text-white">{diff.label}</span>
                        <span className={`text-[10px] font-medium ${difficulty === diff.id ? 'text-red-100' : 'text-neutral-300'}`}>{diff.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Starting Tire Strategy Selection */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase flex items-center gap-2">
                    <Car className="w-3.5 h-3.5 text-neutral-300" />
                    <span>NEUMÁTICO DE SALIDA (ESTRATEGIA)</span>
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold uppercase">{startingCompound}</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'soft', name: 'SOFT C3', color: 'text-red-400', border: 'border-red-500', bg: 'bg-red-900/90', dot: 'bg-red-500', desc: 'Máximo agarre' },
                    { id: 'medium', name: 'MEDIUM C2', color: 'text-amber-400', border: 'border-amber-400', bg: 'bg-amber-900/90', dot: 'bg-amber-400', desc: 'Equilibrado' },
                    { id: 'hard', name: 'HARD C1', color: 'text-neutral-100', border: 'border-neutral-300', bg: 'bg-neutral-800', dot: 'bg-white', desc: 'Larga duración' },
                  ].map((tire) => {
                    const isSelected = startingCompound === tire.id;
                    return (
                      <button
                        key={tire.id}
                        onClick={() => {
                          setStartingCompound(tire.id as TireCompoundType);
                          playUiClick(800);
                        }}
                        onMouseEnter={playUiHover}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          isSelected
                            ? `${tire.bg} ${tire.border} text-white shadow-lg ring-1 ring-white/30`
                            : 'bg-[#121722] hover:bg-[#181f2e] border-neutral-700 text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${tire.dot}`} />
                          <span className="font-bold text-xs text-white">{tire.name}</span>
                        </div>
                        <span className="text-[10px] text-neutral-300 font-medium">{tire.desc}</span>
                      </button>
                    );
                  })}
                </div>

                {activeMode === 'grand_prix' && (
                  <p className="text-[11px] text-neutral-300 px-1 italic">
                    * Regla FIA: Es obligatorio realizar al menos 1 parada en boxes y usar 2 compuestos diferentes.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Mode: Multiplayer Room Lobby */}
          {activeMode === 'multiplayer' && (
            <div className="flex flex-col gap-4 bg-[#121722] border border-neutral-700 rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-neutral-700 pb-3">
                <span className="text-xs font-bold text-purple-400 tracking-widest uppercase flex items-center gap-2">
                  <Radio className="w-4 h-4 text-purple-400" />
                  <span>SALA MULTIJUGADOR 1v1</span>
                </span>
                {roomState && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    SALA: {roomState.code}
                  </span>
                )}
              </div>

              {!roomState ? (
                /* Room Creation / Join Tabs */
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMpSubView('create')}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        mpSubView === 'create'
                          ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                          : 'bg-[#0d111a] border-neutral-700 text-neutral-300 hover:text-white'
                      }`}
                    >
                      CREAR SALA
                    </button>
                    <button
                      onClick={() => setMpSubView('join')}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        mpSubView === 'join'
                          ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                          : 'bg-[#0d111a] border-neutral-700 text-neutral-300 hover:text-white'
                      }`}
                    >
                      UNIRSE A SALA
                    </button>
                  </div>

                  {mpSubView === 'create' ? (
                    <div className="flex flex-col gap-4 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-neutral-200 uppercase font-bold flex items-center justify-between">
                          <span>Circuito del Duelo:</span>
                          <span className="text-amber-400 font-black">{currentCircuit.name}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {AVAILABLE_CIRCUITS.map((circ) => {
                            const isSel = selectedCircuit === circ.id;
                            return (
                              <button
                                key={circ.id}
                                onClick={() => {
                                  setSelectedCircuit(circ.id);
                                  onSelectCircuit?.(circ.id);
                                  playUiClick(850);
                                }}
                                className={`py-2 px-3 rounded-lg border text-left flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                  isSel
                                    ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                                    : 'bg-[#0d111a] border-neutral-700 text-neutral-300 hover:text-white'
                                }`}
                              >
                                <span>{circ.name}</span>
                                <span className="text-[10px] text-neutral-300 font-mono">{circ.totalLength}m</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-neutral-200 uppercase font-bold">Vueltas del Duelo:</label>
                        <div className="flex gap-2">
                          {[1, 3, 5].map((laps) => (
                            <button
                              key={laps}
                              onClick={() => setMpLaps(laps)}
                              className={`flex-1 py-2 rounded-lg border text-xs font-bold ${
                                mpLaps === laps
                                  ? 'bg-purple-600 border-purple-400 text-white'
                                  : 'bg-[#0d111a] border-neutral-700 text-neutral-300'
                              }`}
                            >
                              {laps} VUELTAS
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          onCreateRoom({
                            playerName,
                            laps: mpLaps,
                            car1Name,
                            car2Name,
                            crewName,
                            cameraDistance,
                            cameraMode,
                          })
                        }
                        disabled={isConnecting}
                        className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs tracking-widest uppercase transition-all shadow-lg cursor-pointer"
                      >
                        {isConnecting ? 'CONECTANDO AL PADDOCK...' : 'CREAR SALA Y OBTENER CÓDIGO'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 mt-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-neutral-200 uppercase font-bold">Código de Sala (6 letras):</label>
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          placeholder="EJ: APEX99"
                          maxLength={8}
                          className="w-full px-4 py-3 rounded-xl bg-[#0d111a] border border-neutral-700 text-white font-mono text-center tracking-widest text-base focus:border-purple-500 outline-none uppercase"
                        />
                      </div>

                      <button
                        onClick={() => onJoinRoom(joinCodeInput, playerName, cameraDistance, cameraMode)}
                        disabled={isConnecting || !joinCodeInput.trim()}
                        className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs tracking-widest uppercase transition-all shadow-lg cursor-pointer disabled:opacity-50"
                      >
                        {isConnecting ? 'CONECTANDO...' : 'ENTRAR A LA SALA'}
                      </button>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3 rounded-lg bg-red-900/80 border border-red-500 text-red-200 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Live Room Grid Lobby */
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-950/80 border border-purple-500">
                    <div>
                      <span className="text-[10px] text-neutral-300 tracking-wider">CÓDIGO DE INVITACIÓN:</span>
                      <p className="text-xl font-black tracking-widest text-purple-300">{roomState.code}</p>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(roomState.code);
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer text-white"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'COPIADO' : 'COPIAR'}</span>
                    </button>
                  </div>

                  {/* Player slots */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-[#0d111a] border border-neutral-700 flex flex-col gap-1">
                      <span className="text-[10px] text-neutral-300 uppercase font-bold">P1 (HOST):</span>
                      <span className="text-sm font-black text-white">{roomState.players.p1?.name || 'Esperando...'}</span>
                      <span className="text-xs text-emerald-400 font-bold">
                        {roomState.players.p1?.isReady ? '● LISTO' : '○ NO LISTO'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0d111a] border border-neutral-700 flex flex-col gap-1">
                      <span className="text-[10px] text-neutral-300 uppercase font-bold">P2 (RIVAL):</span>
                      <span className="text-sm font-black text-white">{roomState.players.p2?.name || 'Esperando rival...'}</span>
                      <span className="text-xs text-emerald-400 font-bold">
                        {roomState.players.p2?.isReady ? '● LISTO' : '○ NO LISTO'}
                      </span>
                    </div>
                  </div>

                  {/* Circuit & Laps Information */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0d111a] border border-neutral-700 text-xs">
                    <div className="flex items-center gap-2">
                      <Compass className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-neutral-300 font-bold uppercase">CIRCUITO:</span>
                      <span className="text-white font-black">{roomState.circuitId === 'speedway_gp' ? 'Circuit 2' : 'Circuit 1'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-300 font-bold uppercase">VUELTAS:</span>
                      <span className="text-amber-400 font-black">{roomState.laps}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newReady = !isReady;
                        setIsReady(newReady);
                        onSetReady(newReady);
                      }}
                      className={`flex-1 py-3 rounded-xl border text-xs font-bold tracking-wider uppercase transition-all cursor-pointer ${
                        isReady
                          ? 'bg-emerald-600 border-emerald-400 text-white'
                          : 'bg-neutral-800 border-neutral-600 text-white hover:bg-neutral-700'
                      }`}
                    >
                      {isReady ? 'LISTO ✓' : 'MARCAR LISTO'}
                    </button>

                    {playerId === 'p1' && (
                      <button
                        onClick={onStartMultiplayerRace}
                        disabled={!roomState.players.p2?.isReady || !roomState.players.p1?.isReady}
                        className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs tracking-wider uppercase transition-all cursor-pointer disabled:opacity-40"
                      >
                        INICIAR DUELO
                      </button>
                    )}

                    <button
                      onClick={onLeaveRoom}
                      className="px-3.5 py-3 rounded-xl bg-red-800 hover:bg-red-700 border border-red-500 text-white text-xs font-bold cursor-pointer"
                      title="Salir de la Sala"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mode: Garage 3D Model Manager */}
          {activeMode === 'garage' && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>MODELOS 3D & EQUIPO DE BOXES</span>
                </span>
                <span className="text-[10px] text-neutral-300 font-bold">FORMATO GLB / GLTF</span>
              </div>

              {[
                { id: 'car1', title: 'MONOPLAZA JUGADOR (HOST)', name: car1Name, target: 'car1' as const, badge: 'AUTO #1' },
                { id: 'car2', title: 'MONOPLAZA RIVAL (GUEST)', name: car2Name, target: 'car2' as const, badge: 'AUTO #2' },
                { id: 'crew', title: 'EQUIPO DE PIT STOP (MECÁNICOS)', name: crewName, target: 'crew' as const, badge: 'CREW' },
              ].map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#121722] border border-neutral-700 flex items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-amber-400 tracking-wider uppercase">{item.badge}</span>
                    <h4 className="text-sm font-black text-white">{item.title}</h4>
                    <p className="text-xs text-neutral-300 font-medium">{item.name}</p>
                  </div>

                  <button
                    onClick={() => {
                      playUiClick(850);
                      onOpenModelUpload(item.target);
                    }}
                    onMouseEnter={playUiHover}
                    className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 border border-amber-400 text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shrink-0 shadow-md"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>CAMBIAR</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* COLUMN 3: TELEMETRY DOSSIER & LAUNCH STATION (3 COLS)                  */}
        {/* ----------------------------------------------------------------------- */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1 text-[11px] font-bold text-neutral-300 tracking-[0.2em] uppercase">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>ESTACIÓN DE LANZAMIENTO</span>
          </div>

          {/* Dossier Card */}
          <div className="p-4 rounded-2xl bg-[#121722] border border-neutral-700 flex flex-col gap-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-700 pb-2">
              <span className="text-[10px] font-bold text-neutral-300 tracking-wider uppercase">FICHA TÉCNICA</span>
              <span className="text-xs text-emerald-400 font-black">SISTEMAS OK</span>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-300 font-semibold">PILOTO:</span>
                <span className="font-bold text-white">{playerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-300 font-semibold">DORSAL:</span>
                <span className="font-bold text-amber-400">#{carNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-300 font-semibold">CIRCUITO:</span>
                <span className="font-bold text-white">{currentCircuit.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-300 font-semibold">MODO:</span>
                <span className="font-bold text-red-400 uppercase">
                  {activeMode === 'grand_prix' ? 'GRAN PREMIO' : activeMode === 'time_trial' ? 'TIME TRIAL' : activeMode === 'multiplayer' ? '1v1 ONLINE' : 'GARAJE 3D'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Camera Preference */}
          <div className="p-4 rounded-2xl bg-[#121722] border border-neutral-700 flex flex-col gap-2.5 shadow-lg">
            <span className="text-[10px] font-bold text-neutral-300 tracking-wider uppercase">CÁMARA PREFERIDA</span>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
              {[
                { id: 'chase', label: 'PERSECUCIÓN' },
                { id: 'hood', label: 'MORRO / CAPÓ' },
                { id: 'bumper', label: 'ALERÓN RASANTE' },
                { id: 'orbit', label: 'TV HELICÓPTERO' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCameraMode(c.id as CameraViewMode)}
                  className={`py-2 rounded-lg border text-center transition-all cursor-pointer font-bold ${
                    cameraMode === c.id
                      ? 'bg-neutral-100 border-white text-neutral-950 font-black shadow'
                      : 'bg-[#0a0d14] border-neutral-700 text-neutral-300 hover:text-white hover:bg-[#181f2e]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {cameraMode === 'chase' && (
              <div className="flex gap-1.5 mt-1">
                {(['near', 'medium', 'far'] as CameraDistanceMode[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setCameraDistance(d)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-bold border transition-all cursor-pointer uppercase ${
                      cameraDistance === d
                        ? 'bg-red-600 border-red-400 text-white font-black shadow'
                        : 'bg-[#0a0d14] border-neutral-700 text-neutral-300 hover:text-white'
                    }`}
                  >
                    {d === 'near' ? 'CERCA' : d === 'medium' ? 'MEDIA' : 'LEJOS'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* THE GIANT LAUNCH ACTION BUTTON */}
          {activeMode !== 'multiplayer' && (
            <button
              onClick={handleLaunch}
              onMouseEnter={playUiHover}
              className="w-full py-4.5 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-black text-sm tracking-[0.25em] uppercase transition-all duration-300 shadow-[0_8px_32px_rgba(220,38,38,0.6)] hover:shadow-[0_12px_45px_rgba(239,68,68,0.85)] active:scale-95 cursor-pointer flex items-center justify-center gap-3 border border-red-400/50 mt-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{activeMode === 'garage' ? 'PROBAR EN PISTA' : activeMode === 'time_trial' ? 'INICIAR TIME TRIAL' : 'INICIAR CARRERA'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTROLS GUIDE MODAL                                                  */}
      {/* ========================================================================= */}
      {showControlsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="max-w-lg w-full p-6 rounded-3xl bg-[#121722] border border-neutral-700 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-700 pb-3">
              <h4 className="text-base font-black tracking-wider text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-400" />
                <span>GUÍA DE CONTROLES TÁCTILES MÓVILES</span>
              </h4>
              <button
                onClick={() => setShowControlsModal(false)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-neutral-700">
                <span className="text-[10px] text-cyan-400 font-bold block mb-1">DIRECCIÓN (IZQUIERDA)</span>
                <p className="font-bold text-white">Pad Táctil Izquierdo</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">Toca o desliza en IZQ / DER para girar con precisión instantánea.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-neutral-700">
                <span className="text-[10px] text-emerald-400 font-bold block mb-1">PEDALES (DERECHA)</span>
                <p className="font-bold text-white">Gas & Freno</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">Pedal verde para acelerar a fondo y rojo para frenar / marcha atrás.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-neutral-700">
                <span className="text-[10px] text-amber-400 font-bold block mb-1">DRS / AERO BOOST</span>
                <p className="font-bold text-white">Botones DRS (Izq & Der)</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">Apertura de alerón y potencia híbrida en rectas para máxima velocidad.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0d14] border border-neutral-700">
                <span className="text-[10px] text-rose-400 font-bold block mb-1">DRIFT & CÁMARA</span>
                <p className="font-bold text-white">Botón Drift / Cámara</p>
                <p className="text-[10px] text-neutral-300 mt-0.5">Derrape controlado en curvas y cambio de ángulo de cámara en cabina.</p>
              </div>
            </div>

            <button
              onClick={() => setShowControlsModal(false)}
              className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase cursor-pointer border border-neutral-600"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
