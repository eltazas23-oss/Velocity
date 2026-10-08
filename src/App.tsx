/**
 * App.tsx - Apex GT: Square Circuit 3D Racing
 * High performance WebGL 3D racing simulator with realistic damage physics,
 * 1v1 Private Multiplayer Rooms, Host 3D Model Manager, FIA 5-Red-Lights Gantry,
 * synthesized engine audio, dynamic soft lighting and responsive mobile controls.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RacingGameEngine, GameTelemetry, CameraDistanceMode, CameraViewMode } from './game/RacingGameEngine';
import { HUD } from './components/HUD';
import { PauseMenu } from './components/PauseMenu';
import { TouchControls } from './components/TouchControls';
import { StartScreen } from './components/StartScreen';
import { StartingLights } from './components/StartingLights';
import { LoadingScreen } from './components/LoadingScreen';
import { MultiplayerClient, MultiplayerRoomState, RivalTelemetryData } from './game/multiplayer/MultiplayerClient';
import { CarInputs } from './game/physics/VehiclePhysics';
import { X, Upload, CheckCircle2, AlertCircle, RefreshCw, Car, Users, Wrench } from 'lucide-react';

import { TireCompoundType } from './game/physics/TireCompound';
import { RaceDifficulty, RaceLapOption } from './game/career/CareerTypes';
import { CircuitId } from './game/circuits/ICircuit';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RacingGameEngine | null>(null);
  const multiplayerRef = useRef<MultiplayerClient | null>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  // Game UI & Start States
  const [hasStarted, setHasStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isStartingLightsActive, setIsStartingLightsActive] = useState(false);
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitId>('square_apex');

  // Phased Navigation & Loading States
  const [menuPhase, setMenuPhase] = useState<'title' | 'dashboard'>('title');
  const [isLoadingRace, setIsLoadingRace] = useState(false);
  const [isFadingOutLoading, setIsFadingOutLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStageText, setLoadingStageText] = useState('Inicializando motor 3D y renderizador WebGL2...');
  const [pendingRaceConfig, setPendingRaceConfig] = useState<{
    circuitId: CircuitId;
    mode: 'career' | 'practice' | 'multiplayer';
    dist: CameraDistanceMode;
    cameraMode: CameraViewMode;
    laps: RaceLapOption | number;
    difficulty: RaceDifficulty;
    startingCompound: TireCompoundType;
  } | null>(null);

  const customFilesRef = useRef<{ car1?: File; car2?: File; crew?: File }>({});

  // 1v1 Multiplayer State
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState<'p1' | 'p2' | null>(null);
  const [myPlayerName, setMyPlayerName] = useState('Piloto');
  const [roomState, setRoomState] = useState<MultiplayerRoomState | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [raceWinner, setRaceWinner] = useState<{ id: string; name: string } | null>(null);
  const [totalRaceLaps, setTotalRaceLaps] = useState(3);
  const [rivalLap, setRivalLap] = useState(1);

  // 3D Model Management
  const [car1Name, setCar1Name] = useState('F1 Turbo GP (Host)');
  const [car2Name, setCar2Name] = useState('F1 Turbo GP (Rival)');
  const [crewName, setCrewName] = useState('Pit Crew Apex Scuderia');
  const [showModelModal, setShowModelModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'car1' | 'car2' | 'crew'>('car1');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [telemetry, setTelemetry] = useState<GameTelemetry>({
    speedKmh: 0,
    rpm: 1000,
    engineTemp: 85,
    gear: 1,
    health: 100,
    engineHealth: 100,
    suspLeft: 100,
    suspRight: 100,
    lapTime: 0,
    bestLap: null,
    lapCount: 1,
    isDrifting: false,
    isInPit: false,
    pitProgress: 0,
    pitPhase: 'none',
    pitTimeRemaining: 0,
    pitTotalTime: 0,
    radioMessage: null,
    broadcastCamName: null,
    isMuted: false,
    cameraMode: 'chase',
    cameraDistance: 'medium',
    carName: 'F1 Turbo GP',
    isCustomCar: false,
    crewName: 'Pit Crew Apex Scuderia',
    isCustomCrew: false,
    carX: -35,
    carZ: -130,
    carYaw: Math.PI / 2,
    tireCompound: 'soft',
    nextPitTireCompound: 'soft',
    tireWear: [0, 0, 0, 0],
    isPunctured: [false, false, false, false],
    wheelEffectiveGrip: [1.0, 1.0, 1.0, 1.0],
    wheelGripIndex: [1.0, 1.0, 1.0, 1.0],
    tireFlatSpot: [0, 0, 0, 0],
    isTireCliffActive: false,
    tireWheelspinActive: false,
    hasAnyPuncture: false,
    isDrsAvailable: true,
    isDrsOpen: false,
    dynamicMaxSpeedKmh: 325,
    isDamageLimiterActive: false,
    structuralIntegrity: 1.0,
  });

  const [drsStatus, setDrsStatus] = useState({ isOpen: false, isAvailable: true });

  const handleToggleDRS = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.toggleDRS();
  }, []);

  const startRaceWithLoadingScreenRef = useRef<
    (config: {
      circuitId: CircuitId;
      mode: 'career' | 'practice' | 'multiplayer';
      dist: CameraDistanceMode;
      cameraMode: CameraViewMode;
      laps: RaceLapOption | number;
      difficulty: RaceDifficulty;
      startingCompound: TireCompoundType;
    }) => Promise<void>
  >(null!);

  // Multiplayer Client (mounted once, persistent lifecycle)
  const selectedCircuitRef = useRef<CircuitId>(selectedCircuit);
  selectedCircuitRef.current = selectedCircuit;

  const handleRequestPitStop = useCallback(() => {
    engineRef.current?.requestPitStop();
  }, []);

  const handleSelectNextPitTireCompound = useCallback((comp: TireCompoundType) => {
    engineRef.current?.setNextPitTireCompound(comp);
    setTelemetry((prev) => ({ ...prev, nextPitTireCompound: comp }));
  }, []);

  // Initialize Multiplayer Client once on mount
  useEffect(() => {
    const client = new MultiplayerClient();
    multiplayerRef.current = client;

    // Client Events
    client.onRoomCreated = (room, pid) => {
      setRoomState(room);
      setMyPlayerId(pid as 'p1');
      setIsConnecting(false);
      setMultiplayerError(null);
    };

    client.onRoomJoined = (room, pid) => {
      setRoomState(room);
      setMyPlayerId(pid as 'p2');
      setIsConnecting(false);
      setMultiplayerError(null);
      if (room.circuitId) {
        setSelectedCircuit(room.circuitId as CircuitId);
        if (engineRef.current) {
          engineRef.current.setCircuit(room.circuitId as CircuitId);
        }
      }
    };

    client.onRoomUpdated = (room) => {
      setRoomState(room);
      if (room.circuitId) {
        setSelectedCircuit(room.circuitId as CircuitId);
        if (engineRef.current) {
          engineRef.current.setCircuit(room.circuitId as CircuitId);
        }
      }
      if (room.car1Name) setCar1Name(room.car1Name);
      if (room.car2Name) setCar2Name(room.car2Name);
      if (room.crewName) setCrewName(room.crewName);
    };

    client.onRaceStarting = (room) => {
      setRoomState(room);
      setRaceWinner(null);
      const cId = (room.circuitId as CircuitId) || selectedCircuitRef.current;
      startRaceWithLoadingScreenRef.current?.({
        circuitId: cId,
        mode: 'multiplayer',
        dist: 'medium',
        cameraMode: 'chase',
        laps: room.laps || 3,
        difficulty: 'medium',
        startingCompound: 'soft',
      });
    };

    client.onRivalTelemetry = (data) => {
      if (engineRef.current) {
        engineRef.current.updateRivalCar(data);
      }
      setRivalLap(data.lapCount);
    };

    client.onRaceWinner = (winnerId, winnerName) => {
      setRaceWinner({ id: winnerId, name: winnerName });
    };

    client.onPlayerLeft = (_pid, room) => {
      setRoomState(room);
      setMultiplayerError('El otro jugador ha abandonado la sala.');
    };

    client.onError = (msg) => {
      setIsConnecting(false);
      setMultiplayerError(msg);
    };

    return () => {
      client.dispose();
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      multiplayerRef.current = null;
    };
  }, []);

  // Real-time Ultra-Low Latency Telemetry Broadcast Loop (50 Hz / 20ms)
  useEffect(() => {
    if (!isMultiplayer || !hasStarted) return;

    let seq = 0;
    const interval = setInterval(() => {
      if (!engineRef.current || !multiplayerRef.current?.isConnected) return;
      const eng = engineRef.current;
      const p = eng.physics;

      const cosY = Math.cos(p.yaw);
      const sinY = Math.sin(p.yaw);
      const vx = sinY * p.speed + cosY * p.lateralSpeed;
      const vy = 0;
      const vz = cosY * p.speed - sinY * p.lateralSpeed;

      const data: RivalTelemetryData = {
        timestamp: performance.now(),
        seq: ++seq,
        x: Number(p.position.x.toFixed(3)),
        y: Number(p.position.y.toFixed(3)),
        z: Number(p.position.z.toFixed(3)),
        vx: Number(vx.toFixed(3)),
        vy: Number(vy.toFixed(3)),
        vz: Number(vz.toFixed(3)),
        yaw: Number(p.yaw.toFixed(4)),
        yawRate: Number((p.angularVelocity ?? 0).toFixed(4)),
        roll: Number(p.roll.toFixed(4)),
        speed: Number(p.speed.toFixed(3)),
        speedKmh: Math.round(Math.abs(p.speed) * 3.6),
        steerAngle: Number(p.visualSteerAngle.toFixed(4)),
        rpm: Math.round(p.rpm),
        gear: p.gear,
        slipRatio: Number(p.slipRatio.toFixed(3)),
        isDrifting: p.isDrifting,
        brake: Number(eng.inputs.brake.toFixed(2)),
        lapCount: eng.lapCount,
        lapTime: Number(eng.currentLapTime.toFixed(3)),
        currentSector: eng.currentSector,
        isShifting: p.isShifting,
        damage: {
          overallHealth: Math.round(p.damage.overallHealth),
          engineHealth: Math.round(p.damage.engineHealth),
          frontCrumple: Number(p.damage.frontCrumple.toFixed(2)),
          rearCrumple: Number(p.damage.rearCrumple.toFixed(2)),
          frontWingLeftDamage: Number(p.damage.frontWingLeftDamage.toFixed(2)),
          frontWingRightDamage: Number(p.damage.frontWingRightDamage.toFixed(2)),
          wingDamageAmount: Number(p.damage.wingDamageAmount.toFixed(2)),
          frontWingLeftDetached: p.damage.frontWingLeftDetached,
          frontWingRightDetached: p.damage.frontWingRightDetached,
          rearWingLeftDetached: p.damage.rearWingLeftDetached,
          rearWingRightDetached: p.damage.rearWingRightDetached,
          drsFlapBroken: p.damage.drsFlapBroken,
          wingLoose: p.damage.wingLoose,
          isPunctured: [p.isPunctured[0], p.isPunctured[1], p.isPunctured[2], p.isPunctured[3]],
          wheelSuspensionCompression: [p.wheelSuspensionCompression[0], p.wheelSuspensionCompression[1], p.wheelSuspensionCompression[2], p.wheelSuspensionCompression[3]],
          tireWear: [p.tireWear[0], p.tireWear[1], p.tireWear[2], p.tireWear[3]],
        },
      };

      multiplayerRef.current.sendTelemetry(data);

      // Check race victory condition
      if (eng.lapCount > totalRaceLaps && !raceWinner) {
        multiplayerRef.current.notifyRaceFinished(myPlayerName);
        setRaceWinner({ id: myPlayerId || 'p1', name: myPlayerName });
      }
    }, 35); // Optimized ~28.5 Hz network rate; client-side interpolator smoothly updates at 60/120 Hz

    return () => clearInterval(interval);
  }, [isMultiplayer, hasStarted, totalRaceLaps, raceWinner, myPlayerName, myPlayerId]);

  // Fullscreen Change Event Synchronization
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if ((el as any).webkitRequestFullscreen) {
        (el as any).webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  // Touch input handler
  const handleTouchInput = useCallback((inputs: Partial<CarInputs>) => {
    if (!engineRef.current || !hasStarted) return;
    if (inputs.throttle !== undefined) engineRef.current.inputs.throttle = inputs.throttle;
    if (inputs.brake !== undefined) engineRef.current.inputs.brake = inputs.brake;
    if (inputs.steering !== undefined) engineRef.current.inputs.steering = inputs.steering;
    if (inputs.handbrake !== undefined) engineRef.current.inputs.handbrake = inputs.handbrake;
    if (inputs.drs !== undefined) {
      if (inputs.drs) {
        engineRef.current.inputs.drs = true;
        engineRef.current.physics.isDrsOpen = true;
      } else {
        engineRef.current.inputs.drs = false;
        engineRef.current.physics.isDrsOpen = false;
      }
    }
  }, [hasStarted]);

  // Staged Circuit & Shaders Pre-warm Pipeline
  const startRaceWithLoadingScreen = useCallback(
    async (config: {
      circuitId: CircuitId;
      mode: 'career' | 'practice' | 'multiplayer';
      dist: CameraDistanceMode;
      cameraMode: CameraViewMode;
      laps: RaceLapOption | number;
      difficulty: RaceDifficulty;
      startingCompound: TireCompoundType;
    }) => {
      setSelectedCircuit(config.circuitId);
      setPendingRaceConfig(config);
      setIsFadingOutLoading(false);
      setIsLoadingRace(true);
      setLoadingProgress(6);
      setLoadingStageText('Preparando trazado oficial de competición...');

      // Yield frame so browser renders the pure black LoadingScreen UI immediately
      await new Promise((r) => setTimeout(r, 120));

      try {
        setLoadingProgress(20);
        setLoadingStageText('Inicializando motor 3D y renderizador WebGL2...');
        await new Promise((r) => setTimeout(r, 120));

        let eng = engineRef.current;
        if (!eng && containerRef.current) {
          eng = new RacingGameEngine(containerRef.current, config.circuitId);
          engineRef.current = eng;

          eng.onTelemetryUpdate = (data) => {
            setDrsStatus((prev) => {
              if (prev.isOpen === data.isDrsOpen && prev.isAvailable === data.isDrsAvailable) {
                return prev;
              }
              return { isOpen: data.isDrsOpen, isAvailable: data.isDrsAvailable };
            });
          };
        } else if (eng && eng.activeCircuit.id !== config.circuitId) {
          eng.setCircuit(config.circuitId);
        } else if (eng) {
          const pPose = eng.activeCircuit.gridSlots.player;
          eng.physics.reset(pPose.x, pPose.z, pPose.yaw);
          eng.currentSector = 0;
          eng.currentLapTime = 0;
          eng.lapCount = 1;
        }

        setLoadingProgress(45);
        setLoadingStageText('Generando trazado geométrico, bordillos PBR y guardarraíles...');
        await new Promise((r) => setTimeout(r, 140));

        if (eng) {
          eng.setCameraDistance(config.dist);
          eng.setCameraMode(config.cameraMode);

          // Custom models if provided
          if (customFilesRef.current.car1) {
            try { await eng.loadCustomCar(customFilesRef.current.car1); } catch {}
          }
          if (customFilesRef.current.car2) {
            try { await eng.loadCustomRivalCar(customFilesRef.current.car2); } catch {}
          }
          if (customFilesRef.current.crew) {
            try { await eng.loadCustomCrew(customFilesRef.current.crew); } catch {}
          }

          setLoadingProgress(68);
          setLoadingStageText('Instanciando vegetación orgánica, gradas y boxes...');
          await new Promise((r) => setTimeout(r, 140));

          // Race Mode Setup
          if (config.mode === 'career') {
            setIsMultiplayer(false);
            setTotalRaceLaps(config.laps as number);
            eng.initCareerRace(config.laps as RaceLapOption, config.difficulty, config.startingCompound);
          } else if (config.mode === 'practice') {
            setIsMultiplayer(false);
            setTotalRaceLaps(999);
            eng.initFreePractice(config.startingCompound);
          } else if (config.mode === 'multiplayer') {
            setIsMultiplayer(true);
            setTotalRaceLaps((config.laps as number) || 3);
            const pid = multiplayerRef.current?.playerId || 'p1';
            eng.initMultiplayer(pid, (config.laps as number) || 3);
          }

          setLoadingProgress(88);
          setLoadingStageText('Pre-calentando sombreadores GPU (Shaders) y mapas de sombras...');
          await new Promise((r) => setTimeout(r, 120));

          // Prewarm GPU shaders and shadow pass (forces driver compilation ahead of time)
          eng.prewarmGPU();

          setLoadingProgress(98);
          setLoadingStageText('Sincronizando telemetría y cuadrícula de salida FIA...');
          await new Promise((r) => setTimeout(r, 160));

          setLoadingProgress(100);
          setLoadingStageText('¡Circuito listo! Entrando a pista...');
          await new Promise((r) => setTimeout(r, 350));

          // 1. Scene is completely prepared and pre-rendered! Mount 3D scene and resume audio behind the black screen
          setHasStarted(true);
          eng.resumeAudio();

          // 2. Trigger smooth cinematic fade-out of the black loading screen (900ms)
          setIsFadingOutLoading(true);
          await new Promise((r) => setTimeout(r, 900));

          // 3. Unmount loading screen cleanly once fade transition is completed
          setIsLoadingRace(false);
          setIsFadingOutLoading(false);

          if (config.mode === 'career' || config.mode === 'multiplayer') {
            setIsStartingLightsActive(true);
          } else {
            setIsStartingLightsActive(false);
            eng.setControlsLocked(false);
          }
        }
      } catch (err) {
        console.error('Error during circuit loading:', err);
        setIsFadingOutLoading(false);
        setIsLoadingRace(false);
        setHasStarted(true);
      }
    },
    []
  );

  startRaceWithLoadingScreenRef.current = startRaceWithLoadingScreen;

  // Start Grand Prix / Career Mode
  const handleStartSolo = (
    dist: CameraDistanceMode,
    mode: CameraViewMode,
    laps: RaceLapOption = 20,
    difficulty: RaceDifficulty = 'medium',
    startingCompound: TireCompoundType = 'soft',
    circuitId?: CircuitId
  ) => {
    startRaceWithLoadingScreen({
      circuitId: circuitId || selectedCircuit,
      mode: 'career',
      dist,
      cameraMode: mode,
      laps,
      difficulty,
      startingCompound,
    });
  };

  // Start Free Practice / Time Trial Solo Mode (Modo 1 Solo Jugador - Vueltas Libres)
  const handleStartFreePractice = (
    dist: CameraDistanceMode,
    mode: CameraViewMode,
    startingCompound: TireCompoundType = 'soft',
    circuitId?: CircuitId
  ) => {
    startRaceWithLoadingScreen({
      circuitId: circuitId || selectedCircuit,
      mode: 'practice',
      dist,
      cameraMode: mode,
      laps: 999,
      difficulty: 'medium',
      startingCompound,
    });
  };

  // Create Multiplayer Private Room
  const handleCreateRoom = async (options: {
    playerName: string;
    laps: number;
    car1Name: string;
    car2Name: string;
    crewName: string;
    cameraDistance: CameraDistanceMode;
    cameraMode: CameraViewMode;
  }) => {
    setMyPlayerName(options.playerName);
    setIsConnecting(true);
    setMultiplayerError(null);
    if (engineRef.current) {
      engineRef.current.setCircuit(selectedCircuit);
      engineRef.current.setCameraDistance(options.cameraDistance);
      engineRef.current.setCameraMode(options.cameraMode);
    }
    await multiplayerRef.current?.createRoom({
      ...options,
      circuitId: selectedCircuit,
    });
  };

  // Join Multiplayer Private Room
  const handleJoinRoom = async (
    code: string,
    name: string,
    dist: CameraDistanceMode,
    mode: CameraViewMode
  ) => {
    setMyPlayerName(name);
    setIsConnecting(true);
    setMultiplayerError(null);
    if (engineRef.current) {
      engineRef.current.setCameraDistance(dist);
      engineRef.current.setCameraMode(mode);
    }
    await multiplayerRef.current?.joinRoom(code, name, dist, mode);
  };

  // Start Multiplayer Race (Host Only)
  const handleStartMultiplayerRace = () => {
    multiplayerRef.current?.startRace();
  };

  // Set Ready Status (Guest Only)
  const handleSetReady = (isReady: boolean) => {
    multiplayerRef.current?.setReady(isReady);
  };

  // Leave Room
  const handleLeaveRoom = () => {
    multiplayerRef.current?.leaveRoom();
    setRoomState(null);
    setMyPlayerId(null);
    setIsMultiplayer(false);
    setMultiplayerError(null);
  };

  // Lights Out -> Unlock Controls Instantly!
  const handleLightsOut = useCallback(() => {
    engineRef.current?.setControlsLocked(false);
    setTimeout(() => {
      setIsStartingLightsActive(false);
    }, 1500);
  }, []);

  const handlePlayAudioBeep = useCallback((isHighPitch: boolean) => {
    engineRef.current?.playStartingBeep(isHighPitch);
  }, []);

  const handleSwitchCamera = useCallback(() => {
    engineRef.current?.nextCameraMode();
  }, []);

  const handleSelectCameraDistance = useCallback((dist: CameraDistanceMode) => {
    engineRef.current?.setCameraDistance(dist);
  }, []);

  const handleSelectCameraMode = useCallback((mode: CameraViewMode) => {
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleSetPaused = useCallback((paused: boolean) => {
    setIsPaused(paused);
    if (paused && engineRef.current) {
      setTelemetry({ ...engineRef.current.getTelemetry() });
    }
    engineRef.current?.setPaused(paused);
  }, []);

  const handleOpenPause = useCallback(() => {
    handleSetPaused(true);
  }, [handleSetPaused]);

  // Global Keyboard Shortcuts (Escape / P to toggle pause)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (hasStarted) {
          handleSetPaused(!isPaused);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasStarted, isPaused, handleSetPaused]);

  const handleRepair = useCallback(() => {
    engineRef.current?.repairCar();
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.resetCarToTrack();
  }, []);

  const handleToggleAudio = useCallback(() => {
    engineRef.current?.toggleAudio();
  }, []);

  const handlePhaseChange = useCallback((phase: 'title' | 'dashboard') => {
    setMenuPhase(phase);
    if (phase === 'title' && engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
  }, []);

  const handleExitToMenu = useCallback(() => {
    setIsPaused(false);
    setHasStarted(false);
    setIsStartingLightsActive(false);
    setIsLoadingRace(false);
    setIsFadingOutLoading(false);
    setMenuPhase('dashboard'); // Return directly to selectors dashboard
    if (isMultiplayer) {
      multiplayerRef.current?.leaveRoom();
      setRoomState(null);
      setMyPlayerId(null);
      setIsMultiplayer(false);
    }
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
  }, [isMultiplayer]);

  const handleSelectCircuit = useCallback((circuitId: CircuitId) => {
    setSelectedCircuit(circuitId);
    // Instant menu selection without freezing the main thread.
    // The circuit will load completely during the black loading screen when user launches.
  }, []);

  // 3D Model File Upload Handler
  const handleModelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    customFilesRef.current[uploadTarget] = file;

    // Lazily instantiate engine if needed to parse and validate 3D model
    if (!engineRef.current && containerRef.current) {
      const eng = new RacingGameEngine(containerRef.current, selectedCircuit);
      engineRef.current = eng;
      eng.onTelemetryUpdate = (data) => {
        setDrsStatus({ isOpen: data.isDrsOpen, isAvailable: data.isDrsAvailable });
      };
    }

    if (!engineRef.current) return;

    setIsLoadingFile(true);
    setUploadMessage({ type: 'info', text: `Procesando y cargando modelo 3D "${file.name}"...` });

    try {
      if (uploadTarget === 'car1') {
        const res = await engineRef.current.loadCustomCar(file);
        if (res.success) {
          setCar1Name(res.name);
          setUploadMessage({ type: 'success', text: `¡Coche J1 "${res.name}" asignado con éxito!` });
          multiplayerRef.current?.updateLobbyConfig({ car1Name: res.name });
          setTimeout(() => {
            setShowModelModal(false);
            setUploadMessage(null);
          }, 2000);
        } else {
          setUploadMessage({ type: 'error', text: res.error || 'Error al procesar el archivo 3D.' });
        }
      } else if (uploadTarget === 'car2') {
        const res = await engineRef.current.loadCustomRivalCar(file);
        if (res.success) {
          setCar2Name(res.name);
          setUploadMessage({ type: 'success', text: `¡Coche J2 "${res.name}" asignado para el rival!` });
          multiplayerRef.current?.updateLobbyConfig({ car2Name: res.name });
          setTimeout(() => {
            setShowModelModal(false);
            setUploadMessage(null);
          }, 2000);
        } else {
          setUploadMessage({ type: 'error', text: res.error || 'Error al procesar el archivo 3D.' });
        }
      } else {
        const res = await engineRef.current.loadCustomCrew(file);
        if (res.success) {
          setCrewName(res.name);
          setUploadMessage({ type: 'success', text: `¡Mecánicos "${res.name}" asignados al pit crew!` });
          multiplayerRef.current?.updateLobbyConfig({ crewName: res.name });
          setTimeout(() => {
            setShowModelModal(false);
            setUploadMessage(null);
          }, 2000);
        } else {
          setUploadMessage({ type: 'error', text: res.error || 'Error al procesar el archivo 3D.' });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadMessage({ type: 'error', text: msg });
    } finally {
      setIsLoadingFile(false);
      e.target.value = '';
    }
  };

  const handleOpenModelUpload = (target: 'car1' | 'car2' | 'crew') => {
    setUploadTarget(target);
    setShowModelModal(true);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 font-sans select-none touch-none">
      {/* Hidden File Input for 3D Models */}
      <input
        ref={modelFileInputRef}
        type="file"
        accept=".zip,.glb,.gltf,.obj"
        className="hidden"
        onChange={handleModelFileUpload}
      />

      {/* 3D WebGL Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Modern AAA Loading & Shader Pre-compilation Screen */}
      {isLoadingRace && pendingRaceConfig && (
        <LoadingScreen
          circuitId={pendingRaceConfig.circuitId}
          mode={pendingRaceConfig.mode}
          compound={pendingRaceConfig.startingCompound}
          laps={pendingRaceConfig.laps}
          difficulty={pendingRaceConfig.difficulty}
          progress={loadingProgress}
          stageText={loadingStageText}
          isFadingOut={isFadingOutLoading}
        />
      )}

      {/* Start Screen & Lobby Overlay */}
      {!hasStarted && !isLoadingRace && (
        <StartScreen
          phase={menuPhase}
          onPhaseChange={handlePhaseChange}
          onStartSolo={handleStartSolo}
          onStartFreePractice={handleStartFreePractice}
          selectedCircuit={selectedCircuit}
          onSelectCircuit={handleSelectCircuit}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onStartMultiplayerRace={handleStartMultiplayerRace}
          onSetReady={handleSetReady}
          onLeaveRoom={handleLeaveRoom}
          roomState={roomState}
          playerId={myPlayerId}
          isConnecting={isConnecting}
          errorMessage={multiplayerError}
          onOpenModelUpload={handleOpenModelUpload}
          car1Name={car1Name}
          car2Name={car2Name}
          crewName={crewName}
        />
      )}

      {/* FIA 5-Red-Light Starting Gantry */}
      <StartingLights
        isActive={isStartingLightsActive && !isLoadingRace}
        onLightsOut={handleLightsOut}
        playAudioBeep={handlePlayAudioBeep}
      />

      {/* Racing Telemetry HUD */}
      {hasStarted && !isLoadingRace && (
        <HUD
          telemetry={telemetry}
          engine={engineRef.current}
          onSwitchCamera={handleSwitchCamera}
          onOpenPause={handleOpenPause}
          onReturnToModes={handleExitToMenu}
          onToggleDRS={handleToggleDRS}
          onRequestPitStop={handleRequestPitStop}
          onSelectNextPitTireCompound={handleSelectNextPitTireCompound}
          onChangeTireCompound={handleSelectNextPitTireCompound}
          isFullscreen={isFullscreen}
          onToggleFullscreen={handleToggleFullscreen}
          isMultiplayer={isMultiplayer}
          totalLaps={totalRaceLaps}
          myPlayerName={myPlayerName}
          myPlayerId={myPlayerId || 'p1'}
          rivalPlayerName={myPlayerId === 'p1' ? roomState?.players['p2']?.name : roomState?.players['p1']?.name}
          rivalLap={rivalLap}
          raceWinner={raceWinner}
        />
      )}

      {/* Pause Menu Modal */}
      <PauseMenu
        isOpen={isPaused}
        telemetry={telemetry}
        onResume={() => handleSetPaused(false)}
        onSelectCameraDistance={handleSelectCameraDistance}
        onSelectCameraMode={handleSelectCameraMode}
        onOpenCarUpload={() => {
          setUploadTarget('car1');
          setShowModelModal(true);
        }}
        onOpenCrewUpload={() => {
          setUploadTarget('crew');
          setShowModelModal(true);
        }}
        onRepair={handleRepair}
        onReset={handleReset}
        onToggleAudio={handleToggleAudio}
        onExitToMenu={handleExitToMenu}
        onChangeTireCompound={(cmp) => engineRef.current?.setTireCompound(cmp)}
      />

      {/* Mobile Touch Controls */}
      {hasStarted && (
        <TouchControls
          onInputChange={handleTouchInput}
          isDrsOpen={drsStatus.isOpen}
          isDrsAvailable={drsStatus.isAvailable}
          onToggleDRS={handleToggleDRS}
        />
      )}

      {/* Custom 3D Model Importer Modal */}
      {showModelModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-neutral-900/95 border border-white/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-neutral-950/90">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${uploadTarget === 'car1' ? 'bg-amber-600/20 border-amber-500/40 text-amber-400' : uploadTarget === 'car2' ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-400' : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'} border flex items-center justify-center`}>
                  {uploadTarget === 'crew' ? <Users className="w-4 h-4" /> : <Car className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white tracking-wide">
                    {uploadTarget === 'car1' ? 'MODELO 3D COCHE J1 (ANFITRIÓN)' : uploadTarget === 'car2' ? 'MODELO 3D COCHE J2 (RIVAL)' : 'MODELO 3D EQUIPO DE MECÁNICOS'}
                  </h3>
                  <p className="text-[11px] text-neutral-400">Archivos .zip, .glb, .gltf u .obj</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModelModal(false);
                  setUploadMessage(null);
                }}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div
                onClick={() => modelFileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-500/40 hover:border-amber-500/80 bg-amber-950/20 hover:bg-amber-950/30 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center gap-3 active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm text-white">
                    Toca aquí para seleccionar el archivo 3D
                  </span>
                  <span className="text-xs text-neutral-300">
                    Soporta <strong className="text-amber-400">.ZIP</strong> (con texturas), <strong className="text-amber-400">.GLB</strong>, <strong className="text-amber-400">.GLTF</strong> u <strong className="text-amber-400">.OBJ</strong>
                  </span>
                </div>

                <button
                  type="button"
                  className="mt-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs tracking-wider transition-colors shadow-lg shadow-amber-950/50"
                >
                  SELECCIONAR ARCHIVO
                </button>
              </div>

              {isLoadingFile && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-xs text-cyan-200 animate-pulse">
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  <span>Cargando geometría 3D, texturas y sombreadores PBR...</span>
                </div>
              )}

              {uploadMessage && !isLoadingFile && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl text-xs border ${
                    uploadMessage.type === 'success'
                      ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : uploadMessage.type === 'error'
                      ? 'bg-red-950/50 border-red-500/40 text-red-200'
                      : 'bg-neutral-800/80 border-white/10 text-neutral-300'
                  }`}
                >
                  {uploadMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : uploadMessage.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  ) : (
                    <Upload className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                  )}
                  <span>{uploadMessage.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
