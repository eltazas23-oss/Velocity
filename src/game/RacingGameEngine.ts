/**
 * RacingGameEngine.ts - Master 3D Game Coordinator
 * Orchestrates Scene, PBR Lighting, Soft Shadows, Physics Loop,
 * Collision Detection & Resolution, Multi-Camera Choreography, Audio and Particle Systems.
 */

import * as THREE from 'three';
import { DynamicSkySystem } from './environment/DynamicSkySystem';
import { EngineSound } from './audio/EngineSound';
import { CarModel } from './models/CarModel';
import { ParticleSystem } from './particles/ParticleSystem';
import { HeatHazeEffect } from './effects/HeatHazeEffect';
import { SpeedPostEffect } from './effects/SpeedPostEffect';
import { CinematicPostEffect } from './effects/CinematicPostEffect';
import { PitStopManager } from './pit/PitStopManager';
import { CarInputs, VehiclePhysics } from './physics/VehiclePhysics';
import { DynamicProp, StaticObstacle, TrackBuilder } from './world/TrackBuilder';
import { DistantMountainBackdropBuilder } from './world/DistantMountainBackdropBuilder';
import { RivalTelemetryData } from './multiplayer/MultiplayerClient';
import { RivalCarInterpolator } from './multiplayer/RivalCarInterpolator';
import { TireCompoundType } from './physics/TireCompound';
import { CareerRaceManager } from './career/CareerRaceManager';
import { CareerRaceConfig, DriverLeaderboardEntry, RaceDifficulty, RaceLapOption } from './career/CareerTypes';
import { AICarController } from './ai/AICarController';
import { CircuitId, ICircuitDefinition, ITrackWorld } from './circuits/ICircuit';
import { getCircuit, DEFAULT_CIRCUIT_ID } from './circuits/CircuitRegistry';

export type CameraViewMode = 'chase' | 'hood' | 'bumper' | 'orbit';
export type CameraDistanceMode = 'near' | 'medium' | 'far';

export interface GameTelemetry {
  circuitId?: CircuitId;
  speedKmh: number;
  rpm: number;
  engineTemp: number; // Engine core temperature in °C
  gear: number;
  health: number;
  engineHealth: number;
  suspLeft: number;
  suspRight: number;
  lapTime: number;
  bestLap: number | null;
  lapCount: number;
  isDrifting: boolean;
  isInPit: boolean;
  pitProgress: number;
  pitPhase: string;
  pitTimeRemaining: number;
  pitTotalTime: number;
  radioMessage: string | null;
  broadcastCamName: string | null;
  isMuted: boolean;
  cameraMode: CameraViewMode;
  cameraDistance: CameraDistanceMode;
  carName: string;
  isCustomCar: boolean;
  crewName: string;
  isCustomCrew: boolean;
  carX: number;
  carZ: number;
  carYaw: number;
  tireCompound: TireCompoundType;
  nextPitTireCompound: TireCompoundType;
  tireWear: [number, number, number, number]; // [FL, FR, RL, RR] (0-100%)
  isPunctured: [boolean, boolean, boolean, boolean];
  wheelEffectiveGrip: [number, number, number, number];
  wheelGripIndex: [number, number, number, number]; // 0.0 to 1.0 normalized
  tireFlatSpot: [number, number, number, number]; // 0.0 to 1.0
  isTireCliffActive: boolean;
  tireWheelspinActive: boolean;
  hasAnyPuncture: boolean;
  isDrsAvailable: boolean;
  isDrsOpen: boolean;
  dynamicMaxSpeedKmh: number;
  isDamageLimiterActive: boolean;
  structuralIntegrity: number;
  careerLeaderboard?: DriverLeaderboardEntry[];
  careerConfig?: CareerRaceConfig;
  isFreePractice?: boolean;
}

export class RacingGameEngine {
  public isFreePractice: boolean = false;
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Subsystems
  public audio: EngineSound;
  public physics: VehiclePhysics;
  public carModel: CarModel;
  public activeCircuit: ICircuitDefinition;
  public track: ITrackWorld;
  public particles: ParticleSystem;
  public heatHaze: HeatHazeEffect;
  public speedEffect: SpeedPostEffect;
  public cinematicOptics: CinematicPostEffect;
  public pitStop: PitStopManager;
  public careerRaceManager: CareerRaceManager;
  private cameraTrauma = 0;

  // Natural Daylight Atmosphere, Dynamic Sky & Soft Shadows
  public dynamicSky!: DynamicSkySystem;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private daySkyTexture?: THREE.Texture;
  private envMapTexture?: THREE.Texture;
  private isDisposed = false;

  // Camera tracking parameters
  public cameraMode: CameraViewMode = 'chase';
  public cameraDistance: CameraDistanceMode = 'medium';
  public isPaused = false;
  private cameraPos = new THREE.Vector3();
  private cameraTarget = new THREE.Vector3();

  // Timing & Laps
  private clock = new THREE.Clock();
  private isRunning = false;
  private animFrameId: number | null = null;

  public currentSector = 0;
  public currentLapTime = 0;
  public bestLapTime: number | null = null;
  public lapCount = 1;

  // Controls input buffer
  public inputs: CarInputs = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
  };

  // Dedicated zero-latency desktop keyboard input handling
  private activeKeys = new Set<string>();
  private keyboardInputs: CarInputs = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    drs: false,
  };
  private currentTargetFov: number = 58.0;

  // 1v1 Multiplayer State & Rival Car Model
  public isMultiplayer: boolean = false;
  public myPlayerId: 'p1' | 'p2' = 'p1';
  public rivalCarModel: CarModel | null = null;
  public rivalPhysics: VehiclePhysics = new VehiclePhysics();
  public rivalInterpolator: RivalCarInterpolator = new RivalCarInterpolator();
  private rivalLastUpdateTime: number = 0;
  public isControlsLocked: boolean = false;
  public totalRaceLaps: number = 3;
  public rivalLapCount: number = 1;
  public rivalCurrentSector: number = 0;
  public rivalSpeedKmh: number = 0;
  public rivalTelemetry: RivalTelemetryData | null = null;
  private speedBuffetingTime: number = 0;

  public onTelemetryUpdate?: (data: GameTelemetry) => void;
  private _telemetrySubscribers: Array<(data: GameTelemetry) => void> = [];

  // Pre-allocated static telemetry payload to eliminate GC allocations
  private _telemetryPayload: GameTelemetry = {
    circuitId: 'square_apex',
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
    isFreePractice: false,
    careerLeaderboard: [],
    careerConfig: undefined,
  };

  public subscribeTelemetry(listener: (data: GameTelemetry) => void): () => void {
    this._telemetrySubscribers.push(listener);
    return () => {
      const idx = this._telemetrySubscribers.indexOf(listener);
      if (idx !== -1) this._telemetrySubscribers.splice(idx, 1);
    };
  }

  public getTelemetry(): GameTelemetry {
    return this._telemetryPayload;
  }

  // Pre-allocated scratch vectors to eliminate 60 FPS GC memory churn
  private static readonly UP_VEC = new THREE.Vector3(0, 1, 0);
  private _scratchCarVel = new THREE.Vector3();
  private _scratchForward = new THREE.Vector3();
  private _scratchPos1 = new THREE.Vector3();
  private _scratchNormal = new THREE.Vector3();
  private _scratchPipeL = new THREE.Vector3();
  private _scratchPipeR = new THREE.Vector3();
  private _scratchRearDir = new THREE.Vector3();
  private _scratchLeftWheel = new THREE.Vector3();
  private _scratchRightWheel = new THREE.Vector3();
  private _scratchWheelFL = new THREE.Vector3();
  private _scratchWheelFR = new THREE.Vector3();
  private _scratchWheelRL = new THREE.Vector3();
  private _scratchWheelRR = new THREE.Vector3();
  private _scratchHoodPos = new THREE.Vector3();
  private _scratchRivalWheelL = new THREE.Vector3();
  private _scratchRivalWheelR = new THREE.Vector3();
  private _fourWheelsArray: THREE.Vector3[] = [
    this._scratchWheelFL,
    this._scratchWheelFR,
    this._scratchWheelRL,
    this._scratchWheelRR,
  ];
  private telemetryTimer = 0;
  private physicsAccumulator = 0;
  private lastFrameTimestamp = 0;
  private lastShadowPos = new THREE.Vector3(-999, -999, -999);
  private currentScrapeIntensity = 0;
  private interpolatedCarPos = new THREE.Vector3();
  private smoothedPitchSquat = 0;
  private smoothedThrottleBoost = 0;
  private currentChaseDist = 5.9;
  private smoothedCamYaw = Math.PI / 2;
  private _physicalCars: Array<{
    id: string;
    physics: VehiclePhysics;
    isPlayer: boolean;
    carModel: CarModel;
    isInPit: boolean;
    aiRef?: AICarController;
  }> = Array.from({ length: 4 }, () => ({
    id: '',
    physics: null as any,
    isPlayer: false,
    carModel: null as any,
    isInPit: false,
  }));
  private _physicalCarCount = 0;

  // Spatial Obstacle Partitioning Grid for Ultra High-Speed Zero-Allocation O(1) Collision Lookups
  private obstacleGrid: Map<number, StaticObstacle[]> = new Map();
  private _queryObstacles: StaticObstacle[] = [];
  private _queryCounter: number = 1;

  // Official F1 Delimited DRS System State
  public playerDrsEligible: boolean = false;
  public playerInDrsZone: boolean = false;
  private lastPlayerDrsDetectionId: string | null = null;
  private lastCollisionSparkTime: number = 0;
  private lastWallImpactTime: number = 0;

  constructor(container: HTMLElement, initialCircuitId: CircuitId = 'square_apex') {
    this.container = container;
    this.activeCircuit = getCircuit(initialCircuitId);

    // 1. Scene with atmospheric twilight horizon depth fog (cool slate-blue aerial perspective starting at 380m)
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x1a2638, 380, 1250);

    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const isLandscapeMobile = w > h && h < 650;

    // 2. Camera (Near clipping at 0.25 to maximize depth buffer precision and prevent Z-fighting)
    this.camera = new THREE.PerspectiveCamera(
      isLandscapeMobile ? 50 : 56,
      w / h,
      0.25,
      1200
    );
    this.camera.position.set(-45, 5, -130);

    // 3. Ultra High-Performance Renderer with Calibrated Pixel Ratio & Hardware-Accelerated PCF Filtering
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      stencil: false,
      depth: true,
    });
    const dpr = window.devicePixelRatio || 1;
    // Crisp high resolution: full native device pixel ratio (up to 2.0 on Retina/HiDPI displays)
    const initPixelRatio = Math.min(dpr, 2.0);
    this.renderer.setPixelRatio(initPixelRatio);
    this.renderer.setSize(w, h);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // Hardware-accelerated 4-tap PCF filtering
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    container.innerHTML = '';
    container.appendChild(this.renderer.domElement);

    // 4. Subsystems
    this.audio = new EngineSound();
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics = new VehiclePhysics(pPose.x, pPose.z, pPose.yaw);
    this.carModel = new CarModel();
    this.track = this.activeCircuit.createTrackBuilder();
    this.buildObstacleSpatialGrid();
    this.particles = new ParticleSystem();
    this.heatHaze = new HeatHazeEffect();
    this.speedEffect = new SpeedPostEffect(this.camera);
    this.cinematicOptics = new CinematicPostEffect(this.camera);
    this.pitStop = new PitStopManager();
    this.careerRaceManager = new CareerRaceManager(this.scene);
    this.careerRaceManager.setCircuit(this.activeCircuit);

    this.scene.add(this.track.group);
    this.scene.add(this.carModel.group);
    this.scene.add(this.particles.group);
    this.scene.add(this.heatHaze.group);
    this.scene.add(this.speedEffect.group);
    this.scene.add(this.cinematicOptics.group);
    this.scene.add(this.pitStop.group);
    this.scene.add(this.camera);

    // 5. Environmental Lighting & Sunset Skybox
    this.setupLighting();
    this.setupSkybox();

    // 6. Connect Physics sound events
    this.physics.onBackfire = (isHighRpm) => {
      this.audio.triggerBackfire(isHighRpm);
      this.carModel.triggerBackfire(isHighRpm);

      const leftPipe = this._scratchPipeL;
      const rightPipe = this._scratchPipeR;
      const rearDir = this._scratchRearDir;
      this.carModel.getExhaustWorldPositions(leftPipe, rightPipe, rearDir);
      this.particles.emitRealisticExhaust(leftPipe, rearDir, 'backfire');
      this.particles.emitRealisticExhaust(rightPipe, rearDir, 'backfire');
    };
    this.physics.onCrash = (force) => {
      this.audio.triggerCrash(force);
    };
    this.physics.onPitFinish = () => {
      this.audio.triggerPitChime();
    };
    this.physics.onTireBlowout = (wheelIdx) => {
      this.audio.triggerTireBlowout();
      this.audio.triggerPitRadio('puncture');
      this.cameraTrauma = Math.min(1.0, this.cameraTrauma + 0.65);

      this.carModel.getSingleWheelWorldPosition(wheelIdx, this._scratchPos1);
      this.particles.emitSparks(this._scratchPos1, RacingGameEngine.UP_VEC, 30);
      this.particles.emitImpactDust(this._scratchPos1, RacingGameEngine.UP_VEC);
      this.particles.emitTireSmoke(this._scratchPos1, 8, 1.0);
    };

    // 7. Window resize & desktop keyboard input handlers
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Initialize camera position behind car
    this.cameraPos.set(-25.0, 2.2, -128.0);
    this.cameraTarget.set(-10.0, 0.8, -128.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);

    // Pre-warm and compile all GPU shaders in scene graph (eliminates micro-freeze when entering pit or approaching rivals)
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {}

    // Start render loop
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  private setupLighting(): void {
    // 1. Physically-calibrated ambient twilight sky hemisphere:
    // Royal cobalt twilight skylight (0x1e365d) with neutral dark bitumen ground bounce (0x111419).
    // Calibrated to 0.52 intensity for authentic ambient fill in shadows without muddy brown contamination.
    this.hemiLight = new THREE.HemisphereLight(0x1e365d, 0x111419, 0.52);
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    // 2. High-power low-angle directional racing sun (Crisp 3800K golden-white, 3.8 intensity):
    // Angular low azimuth (~9.5° elevation) creates dramatic, elongated raking shadows across the track
    // without tinting the entire world in pumpkin orange.
    this.dirLight = new THREE.DirectionalLight(0xffeed6, 3.8);

    // Optimal F1 Grand Prix sunset solar orientation: positioned low and behind to the outfield
    // Projects dramatic, elongated architectural shadows FORWARD and ACROSS the circuit asphalt!
    const initCarX = -35;
    const initCarZ = -130;
    this.dirLight.position.set(initCarX - 52, 13.5, initCarZ - 48);
    this.dirLight.target.position.set(initCarX + 8, 0.2, initCarZ + 6);
    this.dirLight.castShadow = true;

    // Studio-grade 1024x1024 depth texture & calibrated frustum for razor-sharp low-angle shadows (4x less VRAM & fill-rate)
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 240;
    const shadowD = 95;
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.00015;
    this.dirLight.shadow.normalBias = 0.040;
    this.dirLight.shadow.camera.updateProjectionMatrix();

    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.updateMatrixWorld();

    // Sync sun vector with volumetric particle lighting and mountain backdrop
    const sunVec = new THREE.Vector3(-60, 13.3, -54).normalize();
    this.particles.setSunDirection(sunVec);
    this.cinematicOptics.setSunDirection(sunVec);
    const hazeColor = new THREE.Color(0x1a2638);
    DistantMountainBackdropBuilder.updateSunDirection(sunVec, this.dirLight.color, hazeColor);
  }

  /**
   * Physically Based Rayleigh Sky Dome & Dynamic Volumetric Clouds
   * - 100% Seamless 360° spherical projection (mathematically eliminates all seam errors)
   * - Rayleigh scattering, Mie solar corona bloom & radiant sun disc
   * - Dual-layer dynamic drifting cumulus & cirrus clouds with volumetric silver lining
   * - Compiles matching seamless 360° PBR environment map for realistic car reflections
   */
  private setupSkybox(): void {
    this.dynamicSky = new DynamicSkySystem({
      zenithColor: new THREE.Color(0x061434),
      horizonColor: new THREE.Color(0xf48838),
      sunColor: new THREE.Color(0xffeed6),
      groundHazeColor: new THREE.Color(0x121620),
      cloudCoverage: 0.44,
      cloudDensity: 0.96,
    });
    this.scene.add(this.dynamicSky.group);

    // Align sun position with directional lighting
    const sunDir = this.dirLight.position.clone().sub(this.dirLight.target.position).normalize();
    this.dynamicSky.setSunDirection(sunDir);
    const hazeColor = new THREE.Color(0x1a2638);
    DistantMountainBackdropBuilder.updateSunDirection(sunDir, this.dirLight.color, hazeColor);

    // Generate seamless 360° PBR environment map for realistic reflections
    const envMap = this.dynamicSky.generateEnvironmentMap(this.renderer);
    this.envMapTexture = envMap;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 1.15;
    this.scene.background = null; // Background rendered via dynamic sky dome with zero seams
  }

  private onResize = (): void => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const isLandscapeMobile = w > h && h < 650;
    this.camera.fov = isLandscapeMobile ? 50 : 56;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const dpr = window.devicePixelRatio || 1;
    const pixelRatio = Math.min(dpr, 2.0);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h);
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
    this.activeKeys.add(e.code);

    if (e.code === 'KeyD' || e.code === 'KeyE') {
      this.toggleDRS();
    } else if (e.code === 'KeyC') {
      this.nextCameraMode();
    }
    this.updateKeyboardInputs();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.activeKeys.delete(e.code);
    this.updateKeyboardInputs();
  };

  private updateKeyboardInputs(): void {
    const k = this.activeKeys;
    const throttle = (k.has('KeyW') || k.has('ArrowUp')) ? 1.0 : 0.0;
    const brake = (k.has('KeyS') || k.has('ArrowDown')) ? 1.0 : 0.0;
    let steering = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) steering += 1.0;
    if (k.has('KeyD') || k.has('ArrowRight')) steering -= 1.0;
    const handbrake = k.has('Space');

    this.keyboardInputs.throttle = throttle;
    this.keyboardInputs.brake = brake;
    this.keyboardInputs.steering = steering;
    this.keyboardInputs.handbrake = handbrake;
  }

  private readonly FIXED_DT: number = 1 / 60;

  private loop = (timestamp?: number): void => {
    if (!this.isRunning) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const now = typeof timestamp === 'number' ? timestamp : performance.now();
    let rawDt = this.lastFrameTimestamp > 0 ? (now - this.lastFrameTimestamp) * 0.001 : 1 / 60;
    this.lastFrameTimestamp = now;

    // Safety clamp (minimum 1ms, maximum 33.3ms to ensure at most 2 substeps per frame and prevent spiral of death)
    rawDt = Math.min(Math.max(rawDt, 0.001), 0.0333);

    const dt = this.isPaused ? 0 : rawDt;

    if (!this.isPaused) {
      const isPitAutomated = this.pitStop.phase === 'entry_autopilot' || this.pitStop.phase === 'docking' || this.pitStop.phase === 'jacks_up' || this.pitStop.phase === 'servicing' || this.pitStop.phase === 'jacks_down';

      // 1. Fixed Timestep Physics Integration (60 Hz deterministic lockstep with up to 2 substeps for silky smooth frame pacing)
      this.physicsAccumulator += dt;
      if (this.physicsAccumulator > 0.050) {
        this.physicsAccumulator = 0.050;
      }
      let substeps = 0;
      while (this.physicsAccumulator >= this.FIXED_DT && substeps < 2) {
        this.stepPhysics(this.FIXED_DT, isPitAutomated);
        this.track.updateDynamicProps(this.FIXED_DT);
        this.physicsAccumulator -= this.FIXED_DT;
        substeps++;
      }

      if (this.physicsAccumulator > this.FIXED_DT) {
        this.physicsAccumulator = this.FIXED_DT;
      }

      const alpha = Math.min(1.0, Math.max(0.0, this.physicsAccumulator / this.FIXED_DT));

      // 3.05. 60 FPS Multiplayer Rival Car Interpolation & Dead Reckoning
      if (this.isMultiplayer && this.rivalCarModel) {
        this.updateRivalCarInterpolation(dt);
      }

      // 4. Sync 3D Car Model transforms (with sub-frame visual interpolation)
      this.syncCarModel(dt, alpha);
      if (!this.isFreePractice && !this.isMultiplayer) {
        this.careerRaceManager.updateVisuals(dt, alpha);
      }

      // 5. Dynamic Props sub-frame visual interpolation & Grandstand Crowd Dynamics
      if (this.track.syncDynamicPropsVisuals) {
        this.track.syncDynamicPropsVisuals(alpha);
      }
      if (this.track.crowdSystem) {
        this.track.crowdSystem.update(dt, this.physics.position, Math.abs(this.physics.speed) * 3.6);
      }

      // 6. Particle System updates
      this.updateParticles(dt);
    }

    // 8.1. Atmospheric Heat Haze & Thermal Refraction Simulation
    this._scratchPos1.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);
    const currentSpeedKmh = Math.abs(this.physics.speed) * 3.6;
    this.heatHaze.update(rawDt, {
      engineTemp: this.physics.engineTemp,
      rpm: this.physics.rpm,
      speedKmh: currentSpeedKmh,
      throttle: this.isPaused ? 0 : this.inputs.throttle,
      carPosition: this._scratchPos1,
      carYaw: this.physics.yaw,
    });

    // 8.2. High-Speed Optical Motion Streaks & Cinematic Broadcast Optics
    this.speedEffect.update(rawDt, currentSpeedKmh, this.isPaused);
    this.cinematicOptics.update(rawDt, currentSpeedKmh, this.isPaused);

    // 9. Camera Choreography (rock-solid tracking & dynamic speed feedback)
    this.updateCamera(rawDt);

    // 10. Audio update
    const speedMs = this.isPaused ? 0 : Math.abs(this.physics.speed);
    this.audio.update(
      this.isPaused ? 800 : this.physics.rpm,
      this.isPaused ? 0 : this.inputs.throttle,
      this.isPaused ? 0 : this.physics.slipRatio,
      speedMs,
      this.physics.damage.engineHealth / 100
    );
    this.audio.updateFlatTireSound(this.physics.hasAnyPuncture, speedMs);

    // 10.5 Advance dynamic sky simulation & lock dome to camera
    if (this.dynamicSky) {
      this.dynamicSky.update(rawDt, this.camera.position);
    }

    // 11. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 12. Dispatch Telemetry (Zero-allocation in-place update)
    this.telemetryTimer += rawDt;
    if (this.telemetryTimer >= 0.050) {
      this.telemetryTimer = 0;
      const t = this._telemetryPayload;
      t.circuitId = this.activeCircuit.id;
      t.speedKmh = Math.round(speedMs * 3.6);
      t.rpm = Math.round(this.physics.rpm);
      t.engineTemp = Math.round(this.physics.engineTemp);
      t.gear = this.physics.gear;
      t.health = Math.round(this.physics.damage.overallHealth);
      t.engineHealth = Math.round(this.physics.damage.engineHealth);
      t.suspLeft = Math.round(this.physics.damage.suspensionLeft);
      t.suspRight = Math.round(this.physics.damage.suspensionRight);
      t.lapTime = this.currentLapTime;
      t.bestLap = this.bestLapTime;
      t.lapCount = this.lapCount;
      t.isDrifting = this.physics.isDrifting;
      t.isInPit = this.pitStop.phase !== 'none' || this.physics.isInPitStop;
      t.pitProgress = this.pitStop.phase !== 'none' ? this.pitStop.repairProgress : this.physics.pitRepairProgress;
      t.pitPhase = this.pitStop.phase;
      t.pitTimeRemaining = Math.max(0, this.pitStop.totalDuration - this.pitStop.elapsedTime);
      t.pitTotalTime = this.pitStop.totalDuration;
      t.radioMessage = this.pitStop.radioMessage;
      t.broadcastCamName = this.pitStop.broadcastCamName;
      t.isMuted = this.audio.getMuted();
      t.cameraMode = this.cameraMode;
      t.cameraDistance = this.cameraDistance;
      t.carName = this.carModel.currentModelName;
      t.isCustomCar = this.carModel.isCustomModel;
      t.crewName = this.pitStop.currentCrewName;
      t.isCustomCrew = this.pitStop.isCustomCrew;
      t.carX = this.physics.position.x;
      t.carZ = this.physics.position.z;
      t.carYaw = this.physics.yaw;
      t.tireCompound = this.physics.tireCompound;
      t.nextPitTireCompound = this.pitStop.nextTireCompound;
      for (let i = 0; i < 4; i++) {
        t.tireWear[i] = this.physics.tireWear[i];
        t.isPunctured[i] = this.physics.isPunctured[i];
        t.wheelEffectiveGrip[i] = this.physics.wheelEffectiveGrip[i];
        t.wheelGripIndex[i] = this.physics.wheelGripIndex[i];
        t.tireFlatSpot[i] = this.physics.tireFlatSpot[i];
      }
      t.isTireCliffActive = this.physics.isTireCliffActive;
      t.tireWheelspinActive = this.physics.tireWheelspinActive;
      t.hasAnyPuncture = this.physics.hasAnyPuncture;
      t.isDrsAvailable = this.physics.isDrsAvailable;
      t.isDrsOpen = this.physics.isDrsOpen;
      t.dynamicMaxSpeedKmh = Math.round(this.physics.dynamicMaxSpeedKmh);
      t.isDamageLimiterActive = this.physics.isDamageLimiterActive;
      t.structuralIntegrity = this.physics.structuralIntegrity;
      t.isFreePractice = this.isFreePractice;
      t.careerLeaderboard = this.isFreePractice ? [] : this.careerRaceManager.leaderboard;
      t.careerConfig = this.isFreePractice ? undefined : this.careerRaceManager.config;

      if (this.onTelemetryUpdate) {
        this.onTelemetryUpdate(t);
      }
      for (let i = 0; i < this._telemetrySubscribers.length; i++) {
        this._telemetrySubscribers[i](t);
      }
    }
  };

  private stepPhysics(fixedDt: number, isPitAutomated: boolean): void {
    let activeInputs: CarInputs;
    if (this.isControlsLocked) {
      // Allow throttle revving for launch control while clamping brakes/wheels to grid box
      activeInputs = {
        throttle: Math.max(this.inputs.throttle, this.keyboardInputs.throttle),
        brake: 1.0,
        steering: 0,
        handbrake: true,
        drs: false,
      };
    } else if (isPitAutomated) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      activeInputs = {
        throttle: 0,
        brake: 0,
        steering: 0,
        handbrake: false,
        drs: false,
      };
    } else {
      activeInputs = {
        throttle: Math.max(this.inputs.throttle, this.keyboardInputs.throttle),
        brake: Math.max(this.inputs.brake, this.keyboardInputs.brake),
        steering: Math.abs(this.keyboardInputs.steering) > 0.01 ? this.keyboardInputs.steering : this.inputs.steering,
        handbrake: this.inputs.handbrake || this.keyboardInputs.handbrake,
        drs: this.inputs.drs,
      };
    }

    // 1. Fixed timestep integration
    if (!isPitAutomated) {
      this.physics.update(fixedDt, activeInputs);
    } else {
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
    }

    if (this.isControlsLocked) {
      this.physics.speed = 0;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      const gridSlot = this.isMultiplayer
        ? (this.myPlayerId === 'p1' ? this.activeCircuit.gridSlots.player : this.activeCircuit.gridSlots.ai(1))
        : this.activeCircuit.gridSlots.player;
      this.physics.position.x = gridSlot.x;
      this.physics.position.y = 0.35;
      this.physics.position.z = gridSlot.z;
      this.physics.yaw = gridSlot.yaw;
      this.physics.gear = 1;
    }

    if (!isPitAutomated) {
      this.checkStaticCollisions(fixedDt);
      this.checkDynamicPropCollisions();
    }

    // 2. Pit stop update & Crew animations
    this.pitStop.update(fixedDt, this.physics, this.carModel, this.particles, this.audio);
    this.physics.isLockedInPit = (this.pitStop.phase === 'jacks_up' || this.pitStop.phase === 'servicing' || this.pitStop.phase === 'jacks_down');
    this.checkPitStopArea();

    // 3. Lap tracking & Career Manager simulation
    this.updateLapSector();
    this.updateDRSSystem(fixedDt);
    this.currentLapTime += fixedDt;

    if (!this.isFreePractice && !this.isMultiplayer) {
      this.careerRaceManager.update(
        fixedDt,
        this.physics,
        this.lapCount,
        this.currentSector,
        this.currentLapTime,
        this.bestLapTime,
        this.pitStop.phase !== 'none' || this.physics.isInPitStop,
        this.particles,
        this.audio,
        this.isControlsLocked
      );
    }

    // 3.1. Car-to-Car Physical Collisions (Impulse, separation & damage)
    this.checkCarToCarCollisions(fixedDt);
    this.checkAiStaticCollisions();
  }

  /**
   * Spatial Obstacle Partitioning Grid (28m x 28m cells)
   * Precomputes static barrier geometry bounds and cuts collision overhead by 90%
   */
  private buildObstacleSpatialGrid(): void {
    this.obstacleGrid.clear();
    const cellSize = 28.0;
    const obstacles = this.track.staticObstacles;

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      obs._queryId = 0;
      if (obs.isWallSegment && obs.p1 && obs.p2) {
        const x1 = obs.p1.x;
        const z1 = obs.p1.z;
        const x2 = obs.p2.x;
        const z2 = obs.p2.z;

        obs.minX = Math.min(x1, x2);
        obs.maxX = Math.max(x1, x2);
        obs.minZ = Math.min(z1, z2);
        obs.maxZ = Math.max(z1, z2);
        obs.dx = x2 - x1;
        obs.dz = z2 - z1;
        obs.lengthSq = obs.dx * obs.dx + obs.dz * obs.dz;

        const minCellX = Math.floor((obs.minX - 3.5) / cellSize);
        const maxCellX = Math.floor((obs.maxX + 3.5) / cellSize);
        const minCellZ = Math.floor((obs.minZ - 3.5) / cellSize);
        const maxCellZ = Math.floor((obs.maxZ + 3.5) / cellSize);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cz = minCellZ; cz <= maxCellZ; cz++) {
            const key = ((cx + 512) << 10) | (cz + 512);
            let list = this.obstacleGrid.get(key);
            if (!list) {
              list = [];
              this.obstacleGrid.set(key, list);
            }
            list.push(obs);
          }
        }
      } else {
        obs.minX = obs.x - obs.radius;
        obs.maxX = obs.x + obs.radius;
        obs.minZ = obs.z - obs.radius;
        obs.maxZ = obs.z + obs.radius;

        const minCellX = Math.floor((obs.minX - 3.0) / cellSize);
        const maxCellX = Math.floor((obs.maxX + 3.0) / cellSize);
        const minCellZ = Math.floor((obs.minZ - 3.0) / cellSize);
        const maxCellZ = Math.floor((obs.maxZ + 3.0) / cellSize);

        for (let cx = minCellX; cx <= maxCellX; cx++) {
          for (let cz = minCellZ; cz <= maxCellZ; cz++) {
            const key = ((cx + 512) << 10) | (cz + 512);
            let list = this.obstacleGrid.get(key);
            if (!list) {
              list = [];
              this.obstacleGrid.set(key, list);
            }
            list.push(obs);
          }
        }
      }
    }
  }

  /**
   * Fast 100% Zero-Allocation O(1) query returning obstacles in the 9 adjacent spatial grid cells
   */
  private getObstaclesNear(carX: number, carZ: number): StaticObstacle[] {
    const cellSize = 28.0;
    const cx = Math.floor(carX / cellSize);
    const cz = Math.floor(carZ / cellSize);
    const result = this._queryObstacles;
    result.length = 0;
    const qId = ++this._queryCounter;

    for (let dx = -1; dx <= 1; dx++) {
      const cellX = cx + dx + 512;
      for (let dz = -1; dz <= 1; dz++) {
        const key = (cellX << 10) | (cz + dz + 512);
        const list = this.obstacleGrid.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const obs = list[i];
            if (obs._queryId !== qId) {
              obs._queryId = qId;
              result.push(obs);
            }
          }
        }
      }
    }
    return result;
  }

  private checkStaticCollisions(fixedDt: number): void {
    const carX = this.physics.position.x;
    const carZ = this.physics.position.z;
    const carRadius = 1.35;
    const yaw = this.physics.yaw;
    const speed = this.physics.speed;

    this._scratchCarVel.set(
      Math.sin(yaw) * speed,
      0,
      Math.cos(yaw) * speed
    );

    let maxScrapeIntensity = 0;
    const candidates = this.getObstaclesNear(carX, carZ);

    for (let i = 0; i < candidates.length; i++) {
      const obs = candidates[i];

      // Fast broad-phase bounding check: skip distant obstacles with precalculated bounds
      if (obs.isWallSegment && obs.p1 && obs.p2) {
        if (
          carX < (obs.minX ?? -9999) - 3.0 ||
          carX > (obs.maxX ?? 9999) + 3.0 ||
          carZ < (obs.minZ ?? -9999) - 3.0 ||
          carZ > (obs.maxZ ?? 9999) + 3.0
        ) {
          continue;
        }

        const x1 = obs.p1.x;
        const z1 = obs.p1.z;
        const dx = obs.dx ?? (obs.p2.x - x1);
        const dz = obs.dz ?? (obs.p2.z - z1);
        const lengthSq = obs.lengthSq ?? (dx * dx + dz * dz);

        let t = ((carX - x1) * dx + (carZ - z1) * dz) / lengthSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = x1 + t * dx;
        const closestZ = z1 + t * dz;

        const distX = carX - closestX;
        const distZ = carZ - closestZ;
        const distSq = distX * distX + distZ * distZ;

        const wallThick = 0.5;
        const minDistance = carRadius + wallThick;

        if (distSq < minDistance * minDistance) {
          const dist = Math.sqrt(distSq) || 0.001;
          const normalX = distX / dist;
          const normalZ = distZ / dist;
          const penetration = minDistance - dist;

          this.physics.handleCollision(normalX, normalZ, penetration, true);

          const impactSpeedKmh = Math.abs(this.physics.speed) * 3.6;

          // Tangential sliding velocity along barrier
          const dot = this._scratchCarVel.x * normalX + this._scratchCarVel.z * normalZ;
          const tangVx = this._scratchCarVel.x - normalX * dot;
          const tangVz = this._scratchCarVel.z - normalZ * dot;
          const tangSpeed = Math.sqrt(tangVx * tangVx + tangVz * tangVz);

          // Continuous scraping intensity proportional to penetration and tangential speed
          const scrapeIntensity = Math.min(1.0, Math.max(0, (tangSpeed / 16.0) * (penetration / 0.25)));
          if (scrapeIntensity > maxScrapeIntensity) {
            maxScrapeIntensity = scrapeIntensity;
          }

          this._scratchPos1.set(closestX, 0.4, closestZ);
          this._scratchNormal.set(normalX, 0, normalZ);

          // Module 2: Continuous Tangential Wall Scraping Stream with accurate fixedDt
          if (scrapeIntensity > 0.06) {
            this.particles.emitContinuousScrapeSparks(
              this._scratchPos1,
              this._scratchNormal,
              this._scratchCarVel,
              fixedDt,
              scrapeIntensity
            );
          }

          // Hard impact burst with 75ms cooldown to prevent 120Hz burst flooding during continuous contact
          if (impactSpeedKmh > 14 && penetration > 0.04) {
            const now = performance.now();
            if (now - this.lastWallImpactTime > 75) {
              this.lastWallImpactTime = now;
              this.cameraTrauma = Math.min(0.65, this.cameraTrauma + Math.min(0.55, (impactSpeedKmh + 10) / 95));
              this.particles.emitSparks(this._scratchPos1, this._scratchNormal, Math.min(28, Math.floor(impactSpeedKmh * 1.1)));
              this.particles.emitCarbonDebrisBurst(this._scratchPos1, this._scratchNormal, this._scratchCarVel, Math.min(16, Math.floor(impactSpeedKmh * 0.50)));
            }
          }
        }
      } else {
        if (Math.abs(carX - obs.x) > 4.0 || Math.abs(carZ - obs.z) > 4.0) {
          continue;
        }
        const dx = carX - obs.x;
        const dz = carZ - obs.z;
        const distSq = dx * dx + dz * dz;
        const minDistance = carRadius + obs.radius;

        if (distSq < minDistance * minDistance) {
          const dist = Math.sqrt(distSq) || 0.001;
          const normalX = dx / dist;
          const normalZ = dz / dist;
          const penetration = minDistance - dist;

          this.physics.handleCollision(normalX, normalZ, penetration, true);

          const impactSpeedKmh = Math.abs(this.physics.speed) * 3.6;
          const now = performance.now();
          if (now - this.lastWallImpactTime > 75) {
            this.lastWallImpactTime = now;
            this.cameraTrauma = Math.min(0.65, this.cameraTrauma + Math.min(0.55, (impactSpeedKmh + 10) / 95));
            this._scratchPos1.set(obs.x + normalX * obs.radius, 0.5, obs.z + normalZ * obs.radius);
            this._scratchNormal.set(normalX, 0.2, normalZ);
            this.particles.emitSparks(this._scratchPos1, this._scratchNormal, 24);
            this.particles.emitCarbonDebrisBurst(this._scratchPos1, this._scratchNormal, this._scratchCarVel, 12);
          }
        }
      }
    }

    this.currentScrapeIntensity = maxScrapeIntensity;
    this.audio.updateScrape(this.currentScrapeIntensity, Math.abs(this.physics.speed) * 3.6);
  }

  private checkDynamicPropCollisions(): void {
    const carX = this.physics.position.x;
    const carZ = this.physics.position.z;
    const carRadius = 1.35;

    this._scratchCarVel.set(
      Math.sin(this.physics.yaw) * this.physics.speed,
      0,
      Math.cos(this.physics.yaw) * this.physics.speed
    );

    const now = performance.now() * 0.001;
    for (let i = 0; i < this.track.dynamicProps.length; i++) {
      const prop = this.track.dynamicProps[i];
      const dx = carX - prop.position.x;
      const dz = carZ - prop.position.z;
      const distSq = dx * dx + dz * dz;
      const minDist = carRadius + prop.radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        let nx = 0;
        let nz = 0;
        if (dist < 0.001) {
          nx = Math.sin(this.physics.yaw);
          nz = Math.cos(this.physics.yaw);
        } else {
          nx = dx / dist;
          nz = dz / dist;
        }
        const overlap = minDist - Math.max(dist, 0.001);
        this._scratchNormal.set(nx, 0, nz);

        // Immediate geometric separation to prevent tunneling/sticking
        prop.position.x -= nx * (overlap + 0.08);
        prop.position.z -= nz * (overlap + 0.08);

        const canHit = (prop.lastHitTime === undefined) || (now - prop.lastHitTime > 0.30);
        if (canHit) {
          prop.lastHitTime = now;
          this.track.impartImpulseToProp(prop, this._scratchCarVel, this._scratchNormal);

          if (Math.abs(this.physics.speed) > 2) {
            this.physics.speed *= 0.96;
            this.audio.triggerCrash(Math.min(6, Math.abs(this.physics.speed) * 0.3));
          }
        }
      }
    }
  }

  /**
   * Identifies whether a vehicle (Player or AI) is navigating, docking, or servicing inside the pit lane
   */
  private isVehicleInPitLane(car: { id: string; physics: VehiclePhysics; isPlayer: boolean; aiRef?: AICarController }): boolean {
    if (car.isPlayer) {
      if (this.pitStop.phase !== 'none' || this.physics.isInPitStop) return true;
    }
    const pz = this.track.pitZone || { minX: -65.0, maxX: 45.0, minZ: -120.0, maxZ: -106.0 };
    const x = car.physics.position.x;
    const z = car.physics.position.z;
    // Inside pit corridor, apron, or pit stalls (strictly separated from main track by pit barrier at z = -121.5)
    if (x >= (pz.minX - 18.0) && x <= (pz.maxX + 18.0) && z >= (pz.minZ - 0.8) && z <= (pz.maxZ + 6.0)) {
      return true;
    }
    if (car.aiRef) {
      if (car.aiRef.isInPitLane || car.aiRef.isStationaryInBox || car.aiRef.isEnteringPitTransition) return true;
    }
    return false;
  }

  /**
   * Dual-Sphere Narrowphase Collision & Physical Impulse Resolution between vehicles
   * Applies realistic momentum transfer, angular torque, structural damage and particles
   */
  private checkCarToCarCollisions(dt: number): void {
    if (this.isControlsLocked) return;
    if (this.isFreePractice && this.careerRaceManager.aiCars.length === 0 && !this.isMultiplayer) return;

    let carCount = 0;
    const cars = this._physicalCars;

    // Slot 0: Player
    const playerSlot = cars[carCount++];
    playerSlot.id = 'player';
    playerSlot.physics = this.physics;
    playerSlot.isPlayer = true;
    playerSlot.carModel = this.carModel;
    playerSlot.aiRef = undefined;
    playerSlot.isInPit = this.isVehicleInPitLane(playerSlot);

    // AI Cars
    for (let c = 0; c < this.careerRaceManager.aiCars.length; c++) {
      const ai = this.careerRaceManager.aiCars[c];
      const aiSlot = cars[carCount++];
      aiSlot.id = ai.team.id;
      aiSlot.physics = ai.physics;
      aiSlot.isPlayer = false;
      aiSlot.carModel = ai.carModel;
      aiSlot.aiRef = ai;
      aiSlot.isInPit = this.isVehicleInPitLane(aiSlot);
    }

    // Include 1v1 Multiplayer rival in real-time physical collisions
    if (this.isMultiplayer && this.rivalCarModel && this.rivalTelemetry) {
      const rivalSlot = cars[carCount++];
      rivalSlot.id = 'rival';
      rivalSlot.physics = this.rivalPhysics;
      rivalSlot.isPlayer = false;
      rivalSlot.carModel = this.rivalCarModel;
      rivalSlot.aiRef = undefined;
      rivalSlot.isInPit = this.isVehicleInPitLane(rivalSlot);
    }

    const axleOffset = 1.25;
    const sphereRadius = 0.98;
    const minDistance = sphereRadius * 2.0;
    const minDistanceSq = minDistance * minDistance;

    for (let i = 0; i < carCount; i++) {
      const carA = cars[i];
      if (carA.isInPit) continue;

      for (let j = i + 1; j < carCount; j++) {
        const carB = cars[j];
        if (carB.isInPit) continue;

        // Broadphase: fast 2D distance test
        const dx = carA.physics.position.x - carB.physics.position.x;
        const dz = carA.physics.position.z - carB.physics.position.z;
        if (dx * dx + dz * dz > 36.0) continue; // Further than 6.0m

        // Narrowphase: Dual-Sphere model (front and rear axle contact points)
        const sinA = Math.sin(carA.physics.yaw);
        const cosA = Math.cos(carA.physics.yaw);
        const sinB = Math.sin(carB.physics.yaw);
        const cosB = Math.cos(carB.physics.yaw);

        const aFrontX = carA.physics.position.x + sinA * axleOffset;
        const aFrontZ = carA.physics.position.z + cosA * axleOffset;
        const aRearX = carA.physics.position.x - sinA * axleOffset;
        const aRearZ = carA.physics.position.z - cosA * axleOffset;

        const bFrontX = carB.physics.position.x + sinB * axleOffset;
        const bFrontZ = carB.physics.position.z + cosB * axleOffset;
        const bRearX = carB.physics.position.x - sinB * axleOffset;
        const bRearZ = carB.physics.position.z - cosB * axleOffset;

        let maxPen = 0;
        let bestDist = minDistance;
        let bestAX = aFrontX;
        let bestAZ = aFrontZ;
        let bestBX = bFrontX;
        let bestBZ = bFrontZ;
        let bestIsAFront = true;
        let bestIsBFront = true;

        // 4 combinations: (0: FF, 1: FR, 2: RF, 3: RR) without per-frame object allocation
        for (let k = 0; k < 4; k++) {
          const isAFront = k < 2;
          const isBFront = k % 2 === 0;
          const pAX = isAFront ? aFrontX : aRearX;
          const pAZ = isAFront ? aFrontZ : aRearZ;
          const pBX = isBFront ? bFrontX : bRearX;
          const pBZ = isBFront ? bFrontZ : bRearZ;

          const pdx = pAX - pBX;
          const pdz = pAZ - pBZ;
          const pdistSq = pdx * pdx + pdz * pdz;
          if (pdistSq < minDistanceSq) {
            const pdist = Math.sqrt(pdistSq) || 0.001;
            const pen = minDistance - pdist;
            if (pen > maxPen) {
              maxPen = pen;
              bestDist = pdist;
              bestAX = pAX;
              bestAZ = pAZ;
              bestBX = pBX;
              bestBZ = pBZ;
              bestIsAFront = isAFront;
              bestIsBFront = isBFront;
            }
          }
        }

        if (maxPen > 0) {
          const pdx = bestAX - bestBX;
          const pdz = bestAZ - bestBZ;
          const normalX = pdx / bestDist;
          const normalZ = pdz / bestDist;

          // 1. Positional Separation (50% each)
          const sep = maxPen * 0.52;
          carA.physics.position.x += normalX * sep;
          carA.physics.position.z += normalZ * sep;
          carB.physics.position.x -= normalX * sep;
          carB.physics.position.z -= normalZ * sep;

          // 2. Compute World Velocities
          const vAx = sinA * carA.physics.speed + cosA * carA.physics.lateralSpeed;
          const vAz = cosA * carA.physics.speed - sinA * carA.physics.lateralSpeed;
          const vBx = sinB * carB.physics.speed + cosB * carB.physics.lateralSpeed;
          const vBz = cosB * carB.physics.speed - sinB * carB.physics.lateralSpeed;

          const relVx = vAx - vBx;
          const relVz = vAz - vBz;
          const normalVel = relVx * normalX + relVz * normalZ;

          // Approaching velocity resolution
          if (normalVel < 0) {
            const restitution = 0.35;
            const impulseMag = -(1 + restitution) * normalVel * 590.0;
            const impX = impulseMag * normalX;
            const impZ = impulseMag * normalZ;

            // Velocity changes on Car A
            const dSpeedA = (impX * sinA + impZ * cosA) / 1180.0;
            const dLatA = (impX * cosA - impZ * sinA) / 1180.0;
            carA.physics.speed += dSpeedA * 0.70;
            carA.physics.lateralSpeed += dLatA * 0.70;

            // Velocity changes on Car B
            const dSpeedB = (-impX * sinB - impZ * cosB) / 1180.0;
            const dLatB = (-impX * cosB + impZ * sinB) / 1180.0;
            carB.physics.speed += dSpeedB * 0.70;
            carB.physics.lateralSpeed += dLatB * 0.70;

            // Angular torque nudge: smooth glancing deflection without violent spinouts
            carA.physics.angularVelocity += THREE.MathUtils.clamp((normalX * cosA - normalZ * sinA) * 0.45, -0.45, 0.45);
            carB.physics.angularVelocity += THREE.MathUtils.clamp((-normalX * cosB + normalZ * sinB) * 0.45, -0.45, 0.45);

            // 3. Physical Structural Damage Calculation
            const impactKmh = Math.abs(normalVel) * 3.6;
            if (impactKmh > 10.0) {
              const damageAmount = Math.min(42, (impactKmh - 8) * 0.60);

              // Apply damage to Car A
              if (bestIsAFront) {
                carA.physics.damage.frontCrumple = Math.min(1.0, carA.physics.damage.frontCrumple + (impactKmh / 150));
                carA.physics.damage.engineHealth = Math.max(15, carA.physics.damage.engineHealth - damageAmount * 0.8);
                if (damageAmount > 16) carA.physics.damage.wingLoose = true;
              } else {
                carA.physics.damage.rearCrumple = Math.min(1.0, carA.physics.damage.rearCrumple + (impactKmh / 170));
                carA.physics.damage.wingLoose = true;
              }
              carA.physics.damage.overallHealth = Math.max(0, carA.physics.damage.overallHealth - damageAmount);
              if (carA.physics.damage.overallHealth <= 0) carA.physics.damage.isTotaled = true;

              // Apply damage to Car B
              if (bestIsBFront) {
                carB.physics.damage.frontCrumple = Math.min(1.0, carB.physics.damage.frontCrumple + (impactKmh / 150));
                carB.physics.damage.engineHealth = Math.max(15, carB.physics.damage.engineHealth - damageAmount * 0.8);
                if (damageAmount > 16) carB.physics.damage.wingLoose = true;
              } else {
                carB.physics.damage.rearCrumple = Math.min(1.0, carB.physics.damage.rearCrumple + (impactKmh / 170));
                carB.physics.damage.wingLoose = true;
              }
              carB.physics.damage.overallHealth = Math.max(0, carB.physics.damage.overallHealth - damageAmount);
              if (carB.physics.damage.overallHealth <= 0) carB.physics.damage.isTotaled = true;

              // Visual Sparks & Audio feedback with zero GC allocation (throttled to prevent particle flooding)
              const now = performance.now();
              if (now - this.lastCollisionSparkTime > 75) {
                this.lastCollisionSparkTime = now;
                this._scratchPos1.set(
                  (bestAX + bestBX) * 0.5,
                  0.35,
                  (bestAZ + bestBZ) * 0.5
                );
                this._scratchNormal.set(normalX, 0.2, normalZ).normalize();

                this.particles.emitSparks(this._scratchPos1, this._scratchNormal, Math.min(22, Math.floor(impactKmh * 0.9)));
                this.particles.emitCarbonDebrisBurst(this._scratchPos1, this._scratchNormal, undefined, Math.min(14, Math.floor(impactKmh * 0.5)));

                if (carA.isPlayer || carB.isPlayer) {
                  this.audio.triggerCrash(Math.abs(normalVel));
                  this.cameraTrauma = Math.min(0.55, this.cameraTrauma + Math.min(0.40, (impactKmh + 10) / 95));
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * Rebounds AI cars if they hit circuit concrete walls or tire barriers (Accelerated O(1) spatial query)
   */
  private checkAiStaticCollisions(): void {
    if (this.isControlsLocked || this.isFreePractice || this.careerRaceManager.aiCars.length === 0) return;

    const carRadius = 1.35;
    for (let a = 0; a < this.careerRaceManager.aiCars.length; a++) {
      const ai = this.careerRaceManager.aiCars[a];
      if (ai.isInPitLane || ai.isEnteringPitTransition || ai.isStationaryInBox) continue;
      const carX = ai.physics.position.x;
      const carZ = ai.physics.position.z;
      const candidates = this.getObstaclesNear(carX, carZ);

      for (let i = 0; i < candidates.length; i++) {
        const obs = candidates[i];
        if (obs.isWallSegment && obs.p1 && obs.p2) {
          if (
            carX < (obs.minX ?? -9999) - 3.0 ||
            carX > (obs.maxX ?? 9999) + 3.0 ||
            carZ < (obs.minZ ?? -9999) - 3.0 ||
            carZ > (obs.maxZ ?? 9999) + 3.0
          ) {
            continue;
          }

          const x1 = obs.p1.x;
          const z1 = obs.p1.z;
          const dx = obs.dx ?? (obs.p2.x - x1);
          const dz = obs.dz ?? (obs.p2.z - z1);
          const lengthSq = obs.lengthSq ?? (dx * dx + dz * dz);

          let t = ((carX - x1) * dx + (carZ - z1) * dz) / lengthSq;
          t = Math.max(0, Math.min(1, t));

          const closestX = x1 + t * dx;
          const closestZ = z1 + t * dz;

          const distX = carX - closestX;
          const distZ = carZ - closestZ;
          const distSq = distX * distX + distZ * distZ;

          const wallThick = 0.5;
          const minDistance = carRadius + wallThick;

          if (distSq < minDistance * minDistance) {
            const dist = Math.sqrt(distSq) || 0.001;
            const normalX = distX / dist;
            const normalZ = distZ / dist;
            const penetration = minDistance - dist;

            ai.physics.handleCollision(normalX, normalZ, penetration, true);
          }
        }
      }
    }
  }

  private checkPitStopArea(): void {
    const { x, z } = this.physics.position;
    const pz = this.track.pitZone;
    const inPit = (x >= pz.minX && x <= pz.maxX && z >= pz.minZ && z <= pz.maxZ) || this.pitStop.phase !== 'none';
    this.physics.isInPitStop = inPit;

    if (this.pitStop.phase === 'none' && this.pitStop.cooldownTimer <= 0) {
      // 1. Pit Entry Corridor: triggers automatic 60 km/h pit speed limiter & autopilot docking
      // Only triggers cleanly once committed deep inside the pit apron (z >= -119.5, leaving main track at z <= -122.0 completely free of false triggers!)
      const inEntryCorridor = x >= -65 && x <= -20 && z >= -119.5 && z <= -106.0;
      if (inEntryCorridor && this.physics.speed > 0.3) {
        this.pitStop.startPitEntryAutopilot(this.physics, this.audio);
        return;
      }

      // 2. Direct Pit Box Service Apron: triggers immediate docking & jack lift if car enters or stops in box
      const inBoxApron = x >= (this.pitStop.pitBoxX - 8.0) && x <= (this.pitStop.pitBoxX + 8.0) && z >= -119.5 && z <= -106.0;
      if (inBoxApron && Math.abs(this.physics.speed) < 10.0) {
        this.pitStop.startPitStop(this.physics, this.audio);
        return;
      }
    }
  }

  /**
   * Request / trigger Pit Stop and tire change from UI touch button
   */
  public requestPitStop(): void {
    if (this.pitStop.phase !== 'none') return;
    this.pitStop.cooldownTimer = 0;

    const { x, z } = this.physics.position;
    const inPitLane = x >= -65 && x <= 25 && z >= -121.8 && z <= -105.0;
    if (inPitLane) {
      // Already in or near the pit lane: dock immediately
      this.pitStop.startPitStop(this.physics, this.audio);
    } else {
      // Out on track: position vehicle at start of pit box docking zone for immediate service
      this.physics.position.x = this.pitStop.pitBoxX - 4.5;
      this.physics.position.y = 0.35;
      this.physics.position.z = -110.5;
      this.physics.prevPosition.x = this.physics.position.x;
      this.physics.prevPosition.y = this.physics.position.y;
      this.physics.prevPosition.z = this.physics.position.z;
      this.physics.prevYaw = Math.PI / 2;
      this.physics.yaw = Math.PI / 2;
      this.physics.speed = 1.5;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      this.physics.pitch = 0;
      this.physics.roll = 0;
      this.pitStop.startPitStop(this.physics, this.audio);
      
      // Instantly position broadcast camera near the pit box to prevent lerp jump from other side of track
      this.cameraPos.set(this.pitStop.pitBoxX + 6.2, 3.25, -116.2);
      this.cameraTarget.set(this.pitStop.pitBoxX, 0.72, -110.5);
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
    }
  }

  private updateLapSector(): void {
    const { x, z } = this.physics.position;

    if (this.activeCircuit?.checkSectorProgress) {
      const res = this.activeCircuit.checkSectorProgress(x, z, this.currentSector);
      if (res.lapCompleted) {
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
          try {
            localStorage.setItem(`apex_best_lap_${this.activeCircuit.id}`, this.bestLapTime.toString());
          } catch {}
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
      } else {
        this.currentSector = res.newSector;
      }
    } else {
      if (this.currentSector === 0 && x > 40 && z < -50) {
        this.currentSector = 1;
      } else if (this.currentSector === 1 && x > 50 && z > 40) {
        this.currentSector = 2;
      } else if (this.currentSector === 2 && x < -40 && z > 50) {
        this.currentSector = 3;
      } else if (this.currentSector === 3 && x < -50 && z < -40) {
        this.currentSector = 4;
      } else if (this.currentSector === 4 && z < -115 && x >= -15 && x <= 20) {
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
        }
        this.lapCount++;
        this.currentLapTime = 0;
        this.currentSector = 0;
      }
    }
  }

  /**
   * Driver Cockpit Action & Manual DRS Boost System
   * - 100% unrestricted: Activatable anytime, anywhere on any straight or corner
   * - Zero detection zones or gap rules
   * - Automatic closing only occurs upon heavy braking (brake > 0.05) or pit service
   */
  private updateDRSSystem(dt: number): void {
    if (this.isControlsLocked || this.physics.isInPitStop || this.pitStop.phase !== 'none') {
      this.physics.isDrsAvailable = false;
      this.physics.isDrsOpen = false;
      this.inputs.drs = false;
      return;
    }

    // DRS is always available for manual deployment
    this.playerDrsEligible = true;
    this.playerInDrsZone = true;
    this.physics.isDrsAvailable = !this.physics.damage.drsFlapBroken;

    // Automatic disengagement upon braking
    if (this.physics.isDrsOpen && this.inputs.brake > 0.05) {
      this.physics.isDrsOpen = false;
      this.inputs.drs = false;
    }
  }

  /**
   * Driver Cockpit Action: Toggle DRS Flap Manually at Any Time
   */
  public toggleDRS(): boolean {
    if (this.physics.isDrsOpen) {
      // Manual close
      this.physics.isDrsOpen = false;
      this.inputs.drs = false;
      return false;
    }

    // Manual open (allowed anytime if controls are unlocked and flap is intact)
    if (
      !this.isControlsLocked &&
      this.inputs.brake < 0.05 &&
      !this.physics.damage.drsFlapBroken &&
      !this.physics.isInPitStop &&
      this.pitStop.phase === 'none'
    ) {
      this.physics.isDrsOpen = true;
      this.inputs.drs = true;
      return true;
    }

    return false;
  }

  private syncCarModel(dt: number, alpha: number = 1.0): void {
    const p = this.physics.position;
    const prevP = this.physics.prevPosition;

    // Sub-frame interpolated render positions
    const interpX = THREE.MathUtils.lerp(prevP.x, p.x, alpha);
    const interpY = THREE.MathUtils.lerp(prevP.y, p.y, alpha);
    const interpZ = THREE.MathUtils.lerp(prevP.z, p.z, alpha);

    let dYaw = this.physics.yaw - this.physics.prevYaw;
    while (dYaw > Math.PI) dYaw -= Math.PI * 2;
    while (dYaw < -Math.PI) dYaw += Math.PI * 2;
    const interpYaw = this.physics.prevYaw + dYaw * alpha;

    // Ground-effect contact: pitch is 0 so wheels and nose are perfectly glued to the asphalt
    this.carModel.group.position.set(
      interpX,
      interpY + this.pitStop.carElevatedY,
      interpZ
    );
    this.carModel.group.rotation.set(0, interpYaw, this.physics.roll);

    // Keep underbody contact shadow cleanly on the ground when car is elevated on jacks
    // and cancel roll on the contact shadow plane so it stays 100% flush and coplanar with the track
    if (this.carModel.contactShadowMesh) {
      this.carModel.contactShadowMesh.rotation.z = -this.physics.roll;
      if (this.pitStop.carElevatedY > 0.001) {
        this.carModel.contactShadowMesh.position.y = 0.008 - this.pitStop.carElevatedY;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
          0.30,
          0.88 - this.pitStop.carElevatedY * 2.2
        );
      } else {
        this.carModel.contactShadowMesh.position.y = 0.008;
        (this.carModel.contactShadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.88;
      }
    }

    const speedKmh = Math.abs(this.physics.speed) * 3.6;
    this.carModel.setDRS(this.physics.isDrsOpen, dt, speedKmh);
    this.carModel.update(
      this.physics.visualSteerAngle,
      this.physics.wheelRotations,
      this.inputs.brake,
      speedKmh,
      this.physics.damage,
      this.physics.isShifting,
      this.physics.rpm,
      this.physics.wheelSuspensionCompression,
      this.physics.isPunctured,
      this.physics.tireWear,
      dt,
      this.inputs.throttle
    );

    // Directional shadow tracking with 0.15m spatial hysteresis to prevent redundant shadow camera matrix recalculations
    const shadowDistSq = (interpX - this.lastShadowPos.x) * (interpX - this.lastShadowPos.x) +
      (interpZ - this.lastShadowPos.z) * (interpZ - this.lastShadowPos.z);
    if (shadowDistSq > 0.0225) {
      this.lastShadowPos.set(interpX, 0, interpZ);
      this.dirLight.position.set(interpX - 52, 13.5, interpZ - 48);
      this.dirLight.target.position.set(interpX + 8, 0.2, interpZ + 6);
      this.dirLight.target.updateMatrixWorld();
      this.dirLight.updateMatrixWorld();
    }
  }

  private updateParticles(dt: number): void {
    const carPos = this.carModel.group.position;
    const yaw = this.physics.yaw;
    const speedKmh = Math.abs(this.physics.speed) * 3.6;

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    const wFL = this._scratchWheelFL;
    const wFR = this._scratchWheelFR;
    const wRL = this._scratchWheelRL;
    const wRR = this._scratchWheelRR;
    this.carModel.getFourWheelWorldPositions(wFL, wFR, wRL, wRR);

    const carForward = this._scratchForward.set(sinY, 0, cosY);
    const carVel = this._scratchCarVel.set(sinY * this.physics.speed + cosY * this.physics.lateralSpeed, 0, cosY * this.physics.speed - sinY * this.physics.lateralSpeed);

    // 4-Wheel Independent Persistent Skidmarks on asphalt
    const slips = this.physics.wheelSlipRatios;
    this.particles.addFourWheelSkidmarks(this._fourWheelsArray, slips, carForward);

    // Dynamic Tangential Tire Smoke when drifting, burnout, or rear wheelspin traction loss
    const isDriftingAtSpeed = this.physics.isDrifting && speedKmh > 10;
    const isBurnout = (this.inputs.throttle > 0.82 && speedKmh < 12 && this.physics.gear === 1) || this.physics.tireWheelspinActive;

    const slipRL = Math.max(slips[2], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);
    const slipRR = Math.max(slips[3], isDriftingAtSpeed ? 0.75 : isBurnout ? 0.95 : 0);

    this.particles.emitContinuousTireSmoke(2, wRL, slipRL, carVel, speedKmh, isBurnout);
    this.particles.emitContinuousTireSmoke(3, wRR, slipRR, carVel, speedKmh, isBurnout);

    if (this.physics.isDrifting && speedKmh > 18) {
      if (slips[0] > 0.22) this.particles.emitContinuousTireSmoke(0, wFL, slips[0] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(0);
      if (slips[1] > 0.22) this.particles.emitContinuousTireSmoke(1, wFR, slips[1] * 0.85, carVel, speedKmh, false);
      else this.particles.breakTireSmokeTrail(1);
    } else {
      this.particles.breakTireSmokeTrail(0);
      this.particles.breakTireSmokeTrail(1);
    }

    // Punctured bare rim grinding sparks on asphalt
    if (this.physics.hasAnyPuncture && speedKmh > 2.0) {
      if (this.physics.isPunctured[0]) {
        this.particles.emitContinuousScrapeSparks(wFL, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[1]) {
        this.particles.emitContinuousScrapeSparks(wFR, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wFR, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[2]) {
        this.particles.emitContinuousScrapeSparks(wRL, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRL, 1, 0.45, carVel);
      }
      if (this.physics.isPunctured[3]) {
        this.particles.emitContinuousScrapeSparks(wRR, RacingGameEngine.UP_VEC, carVel, dt, 0.75);
        if (Math.random() < 0.25) this.particles.emitTireSmoke(wRR, 1, 0.45, carVel);
      }
    }

    // Engine Damage Smoke billowing from hood only when health is severely degraded (< 45%)
    if (this.physics.damage.engineHealth < 45) {
      const hoodPos = this._scratchHoodPos.set(
        carPos.x + sinY * 1.45,
        carPos.y + 0.55,
        carPos.z + cosY * 1.45
      );
      this.particles.emitEngineDamageSmoke(hoodPos, this.physics.damage.engineHealth);
    }

    // Front Wing Floor Scraping Sparks (Uses exact 3D world tip positions with ground clamping)
    const { leftScraping, rightScraping } = this.carModel.getFrontWingScrapeWorldPositions(
      this._scratchLeftWheel,
      this._scratchRightWheel
    );

    if (speedKmh > 20) {
      this._scratchNormal.set(0, 1, 0);
      let maxWingScrape = 0;

      if (leftScraping) {
        const lIntensity = Math.min(1.0, (this.physics.damage.frontWingLeftDamage || 0.4) * 1.3 * (speedKmh / 90));
        this.particles.emitContinuousScrapeSparks(this._scratchLeftWheel, this._scratchNormal, carVel, dt, lIntensity);
        maxWingScrape = Math.max(maxWingScrape, lIntensity);
      }
      if (rightScraping) {
        const rIntensity = Math.min(1.0, (this.physics.damage.frontWingRightDamage || 0.4) * 1.3 * (speedKmh / 90));
        this.particles.emitContinuousScrapeSparks(this._scratchRightWheel, this._scratchNormal, carVel, dt, rIntensity);
        maxWingScrape = Math.max(maxWingScrape, rIntensity);
      }

      if (maxWingScrape > 0.05) {
        this.audio.updateScrape(Math.max(this.currentScrapeIntensity, maxWingScrape), speedKmh);
      }
    }

    // Formula 1 Underbody Titanium Skid Block Sparks (Bottoming out under high aerodynamic downforce & bumps)
    // Downforce increases with v^2, pushing the chassis down onto the asphalt.
    // At high speeds (>210 km/h) or under hard braking dive (>0.6g), the titanium blocks rub the ground.
    const avgSuspensionComp = (this.physics.wheelSuspensionCompression[0] + this.physics.wheelSuspensionCompression[1] + this.physics.wheelSuspensionCompression[2] + this.physics.wheelSuspensionCompression[3]) * 0.25;
    const highSpeedBottoming = (speedKmh > 210) ? Math.pow((speedKmh - 210) / 120, 1.4) * 0.85 : 0;
    const compressionBottoming = (avgSuspensionComp > 0.45 && speedKmh > 110) ? (avgSuspensionComp - 0.45) * 1.5 : 0;
    const brakeDiveBottoming = (this.inputs.brake > 0.60 && speedKmh > 160) ? 0.45 : 0;
    const totalPlankScrape = Math.max(highSpeedBottoming, compressionBottoming, brakeDiveBottoming);

    if (totalPlankScrape > 0.08) {
      this.carModel.getUnderbodyPlankWorldPosition(this._scratchPos1, this._scratchRearDir);
      this.particles.emitUnderbodyTitaniumSparks(
        this._scratchPos1,
        this._scratchRearDir,
        carVel,
        dt,
        totalPlankScrape
      );
    }

    // Module 3: Aerodynamic wake slipstream vortices & particle updates
    this.particles.update(dt, carPos, carForward, carVel);

    // Module 4: Aerodynamic Wingtip Condensation Streamer Ribbons (Sharp speed vortices)
    const leftWingtip = this._scratchLeftWheel;
    const rightWingtip = this._scratchRightWheel;
    const rearDir = this._scratchRearDir;
    this.carModel.getWingtipWorldPositions(leftWingtip, rightWingtip, rearDir);
    this.particles.updateWingtipVortices(leftWingtip, rightWingtip, rearDir, speedKmh, dt);
  }

  private updateCamera(dt: number): void {
    const carPos = this.carModel.group.position;
    // Use the sub-frame interpolated rotation heading
    const yaw = this.carModel.group.rotation.y;
    const speed = this.physics.speed;
    const speedKmh = Math.abs(speed) * 3.6;

    const forwardX = Math.sin(yaw);
    const forwardZ = Math.cos(yaw);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const isPitEntryAutopilot = this.pitStop.phase === 'entry_autopilot';
    const isStationaryPitService =
      this.pitStop.phase === 'docking' ||
      this.pitStop.phase === 'jacks_up' ||
      this.pitStop.phase === 'servicing' ||
      this.pitStop.phase === 'jacks_down';
    const isReleased = this.pitStop.phase === 'released';

    // 1. Single Unified Dynamic FOV Target Determination
    let targetFov = 58.0;
    if (isPitEntryAutopilot) {
      targetFov = 66.0;
    } else if (isStationaryPitService) {
      targetFov = 62.0;
    } else if (isReleased) {
      targetFov = 58.0;
    } else {
      const baseFov = this.cameraMode === 'hood' ? 62 : this.cameraMode === 'bumper' ? 68 : 58;
      const speedRatio = Math.min(1.0, speedKmh / 350);
      targetFov = baseFov + Math.pow(speedRatio, 1.25) * 14.0;
    }
    this.currentTargetFov = targetFov;

    // Synchronize smoothedCamYaw during pit service and non-chase modes to avoid angular snap on handover
    if (isStationaryPitService || isPitEntryAutopilot || this.cameraMode !== 'chase') {
      let preYawDiff = yaw - this.smoothedCamYaw;
      while (preYawDiff > Math.PI) preYawDiff -= Math.PI * 2;
      while (preYawDiff < -Math.PI) preYawDiff += Math.PI * 2;
      this.smoothedCamYaw += preYawDiff * Math.min(1.0, 10.0 * dt);
    }

    // =========================================================================
    // 1. DYNAMIC PIT ENTRY CHASE & TRACKING CAM
    // Smooth cinematic tracking behind and slightly elevated over the car along pit lane corridor
    // =========================================================================
    if (isPitEntryAutopilot) {
      this.pitStop.broadcastCamName = 'CÁMARA PIT LANE · SEGUIMIENTO 60 KM/H';

      const chaseDist = 5.8;
      const idealCamX = carPos.x - forwardX * chaseDist;
      const idealCamY = carPos.y + 2.25;
      const idealCamZ = carPos.z - forwardZ * chaseDist;

      const idealTargetX = carPos.x + forwardX * 4.2;
      const idealTargetY = carPos.y + 0.95;
      const idealTargetZ = carPos.z + forwardZ * 4.2;

      const camPosLerp = 1.0 - Math.exp(-9.0 * dt);
      const camTargetLerp = 1.0 - Math.exp(-10.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    // =========================================================================
    // 2. TV TRACKSIDE BROADCAST CAM: CALIBRATED PANORAMIC PIT SERVICE CHOREOGRAPHY
    // Perfectly calibrated elevated wide-angle crane-jib camera providing a cinematic,
    // immersive view of the pit box scene, all mechanics, jacks, lollipop and tires!
    // =========================================================================
    else if (isStationaryPitService) {
      this.pitStop.broadcastCamName = 'CÁMARA PIT LANE 4K · BOX APEX SCUDERIA';
      const t = this.pitStop.elapsedTime;
      const total = Math.max(2, this.pitStop.totalDuration);

      // Normalized orbit time across the entire pit stop duration
      const orbitT = Math.min(1.0, Math.max(0, t / total));
      const boxX = this.pitStop.pitBoxX; // Calibrated to Garage 01 (-22.0)

      // Elevated trackside crane-jib camera focused cleanly on the working apron of the active pit stall
      const idealCamX = boxX + THREE.MathUtils.lerp(6.2, -5.8, orbitT);
      const idealCamZ = -116.2 + Math.sin(orbitT * Math.PI) * 0.4;
      const idealCamY = 3.25 + Math.sin(t * 0.6) * 0.08;

      // Focus accurately on the central chassis and wheel mechanics at the active pit box
      const idealTargetX = boxX + THREE.MathUtils.lerp(0.5, -0.5, orbitT);
      const idealTargetY = 0.72 + this.pitStop.carElevatedY * 0.5;
      const idealTargetZ = -110.5;

      // Fluid broadcast gimbal damping
      const camPosLerp = Math.min(1.0, 5.0 * dt);
      const camTargetLerp = Math.min(1.0, 6.0 * dt);

      this.cameraPos.x += (idealCamX - this.cameraPos.x) * camPosLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * camPosLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * camPosLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * camTargetLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * camTargetLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * camTargetLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    }

    // =========================================================================
    // 3. DYNAMIC LAUNCH CAM & SEAMLESS HANDOVER (RELEASED PHASE)
    // Smoothly tracks right behind and above the launching car, so as soon as control
    // is returned to the player, the camera is ALREADY locked behind the car (ZERO lag or frozen mechanic)!
    // =========================================================================
    else if (isReleased) {
      this.pitStop.broadcastCamName = 'SALIDA DE BOXES · LANZAMIENTO';

      const distConfig = {
        near: { baseDist: 4.2, baseHeight: 1.68, lookAhead: 4.2, targetY: 0.86 },
        medium: { baseDist: 5.9, baseHeight: 2.18, lookAhead: 5.2, targetY: 0.98 },
        far: { baseDist: 8.9, baseHeight: 3.25, lookAhead: 6.8, targetY: 1.20 },
      }[this.cameraDistance];

      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;

      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation aligned with smoothedCamYaw
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.smoothedCamYaw += yawDiff * Math.min(1.0, 14.0 * dt);

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      const idealCamX = carPos.x - camForwardX * effectiveDist;
      const idealCamY = carPos.y + effectiveHeight;
      const idealCamZ = carPos.z - camForwardZ * effectiveDist;

      const idealTargetX = carPos.x + camForwardX * distConfig.lookAhead;
      const idealTargetY = carPos.y + effectiveTargetY;
      const idealTargetZ = carPos.z + camForwardZ * distConfig.lookAhead;

      const launchLerp = Math.min(1.0, 14.0 * dt);
      this.cameraPos.x += (idealCamX - this.cameraPos.x) * launchLerp;
      this.cameraPos.y += (idealCamY - this.cameraPos.y) * launchLerp;
      this.cameraPos.z += (idealCamZ - this.cameraPos.z) * launchLerp;

      this.cameraTarget.x += (idealTargetX - this.cameraTarget.x) * launchLerp;
      this.cameraTarget.y += (idealTargetY - this.cameraTarget.y) * launchLerp;
      this.cameraTarget.z += (idealTargetZ - this.cameraTarget.z) * launchLerp;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraTarget);
      return;
    } else {
      this.pitStop.broadcastCamName = null;
    }

    if (this.cameraMode === 'chase') {
      // 3 Configurable Camera Distance Presets (Cerca, Media, Lejos)
      const distConfig = {
        near: { baseDist: 4.2, baseHeight: 1.68, lookAhead: 4.2, targetY: 0.86 },
        medium: { baseDist: 5.9, baseHeight: 2.18, lookAhead: 5.2, targetY: 0.98 },
        far: { baseDist: 8.9, baseHeight: 3.25, lookAhead: 6.8, targetY: 1.20 },
      }[this.cameraDistance];

      // Mobile Portrait aspect ratio compensation:
      // When screen aspect ratio < 1.0 (vertical phone orientation), Three.js's vertical FOV
      // drastically narrows horizontal view angle (zoom effect). We dynamically scale distance
      // and elevation so the car sits comfortably in the lower third with complete view of the track ahead!
      const aspect = this.camera.aspect;
      const isPortrait = aspect < 1.0;
      const portraitDistFactor = isPortrait ? Math.max(1.30, 1.0 + (1.0 - aspect) * 0.65) : 1.0;
      const portraitHeightFactor = isPortrait ? 1.28 : 1.0;

      const effectiveDist = distConfig.baseDist * portraitDistFactor;
      const effectiveHeight = distConfig.baseHeight * portraitHeightFactor;
      const effectiveTargetY = distConfig.targetY * (isPortrait ? 1.15 : 1.0);

      // Smooth trailing yaw orientation (smoothly follows car rotation while keeping car-camera distance 100% rigid)
      let yawDiff = yaw - this.smoothedCamYaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const yawLerp = 1.0 - Math.exp((this.physics.isDrifting ? -10.0 : -14.0) * dt);
      this.smoothedCamYaw += yawDiff * yawLerp;

      const camForwardX = Math.sin(this.smoothedCamYaw);
      const camForwardZ = Math.cos(this.smoothedCamYaw);

      // Rigid distance anchoring: Camera position and lookAt target are anchored directly to car position.
      // This mathematically guarantees that the car-camera distance is 100% invariant, eliminating all longitudinal jitter/accordion!
      this.camera.position.set(
        carPos.x - camForwardX * effectiveDist,
        carPos.y + effectiveHeight,
        carPos.z - camForwardZ * effectiveDist
      );

      this.camera.lookAt(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + effectiveTargetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );

      this.cameraPos.copy(this.camera.position);
      this.cameraTarget.set(
        carPos.x + camForwardX * distConfig.lookAhead,
        carPos.y + distConfig.targetY,
        carPos.z + camForwardZ * distConfig.lookAhead
      );

    } else if (this.cameraMode === 'hood') {
      // 1. Crystal-Clear Nosecone / Bonnet Camera: 100% stable, zero vibration noise
      this.camera.position.set(
        carPos.x + forwardX * 1.35,
        carPos.y + 0.68,
        carPos.z + forwardZ * 1.35
      );
      this.camera.lookAt(
        carPos.x + forwardX * 40.0,
        carPos.y + 0.50,
        carPos.z + forwardZ * 40.0
      );

    } else if (this.cameraMode === 'bumper') {
      // 2. Front Wing Ground-Level Aero Camera (Ultra-high sense of speed, zero mesh clipping)
      this.camera.position.set(
        carPos.x + forwardX * 2.52,
        carPos.y + 0.40,
        carPos.z + forwardZ * 2.52
      );
      this.camera.lookAt(
        carPos.x + forwardX * 45.0,
        carPos.y + 0.38,
        carPos.z + forwardZ * 45.0
      );

    } else if (this.cameraMode === 'orbit') {
      // 3. Smooth High-Altitude TV Helicopter Sky Camera
      const heliX = carPos.x - forwardX * 13.0 + rightX * 8.0;
      const heliZ = carPos.z - forwardZ * 13.0 + rightZ * 8.0;
      const heliY = carPos.y + 14.0;

      const lerpFactor = Math.min(1.0, 3.5 * dt);
      this.cameraPos.x += (heliX - this.cameraPos.x) * lerpFactor;
      this.cameraPos.y += (heliY - this.cameraPos.y) * lerpFactor;
      this.cameraPos.z += (heliZ - this.cameraPos.z) * lerpFactor;

      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(carPos.x + forwardX * 3.5, carPos.y + 0.6, carPos.z + forwardZ * 3.5);
    }

    // =========================================================================
    // HIGH-SPEED AERODYNAMIC BUFFETING & COCKPIT MICRO-VIBRATION (> 200 KM/H)
    // Masterclass high-frequency (~46 Hz) tactile chassis jitter & dynamic FOV tunnel
    // =========================================================================
    let buffetingIntensity = 0;
    if (speedKmh > 200.0) {
      // Smooth linear-to-exponential crescendo starting at 200 km/h up to 335+ km/h
      const normalizedRatio = Math.min(1.0, Math.max(0.0, (speedKmh - 200.0) / 125.0));
      let baseIntensity = Math.pow(normalizedRatio, 1.35);

      // Smooth, gentle attenuation above 270 km/h to prevent excessive vibration at top speed
      if (speedKmh > 270.0) {
        const highSpeedTaper = Math.min(1.0, (speedKmh - 270.0) / 60.0);
        const attenuation = 1.0 - highSpeedTaper * 0.32; // Gentle ~32% power reduction at maximum velocity
        baseIntensity *= attenuation;
      }

      buffetingIntensity = baseIntensity;
    }

    // 1. Dynamic FOV Compression & High-Speed Optical Expansion (Smooth speed tunnel feeling)
    const dynFov = this.currentTargetFov + buffetingIntensity * 5.0; // Expands progressively with speed ratio + buffeting
    const fovDelta = (dynFov - this.camera.fov) * Math.min(1.0, 8.0 * dt);
    if (Math.abs(fovDelta) > 0.002) {
      this.camera.fov += fovDelta;
      this.camera.updateProjectionMatrix();
    }

    // 2. Refined Harmonic Pitch/Roll & High-Frequency Shake (> 200 km/h)
    if (buffetingIntensity > 0.001) {
      this.speedBuffetingTime += dt * 38.0; // Smooth harmonic turbulence
      const bt = this.speedBuffetingTime;

      // Natural organic dual-harmonic jitter
      const pitchBuffet = (Math.sin(bt * 1.0) * 0.65 + Math.sin(bt * 2.37) * 0.35) * buffetingIntensity * 0.012;
      const rollBuffet = (Math.cos(bt * 1.41) * 0.70 + Math.sin(bt * 3.14) * 0.30) * buffetingIntensity * 0.009;
      const verticalBuffet = Math.sin(bt * 1.83) * buffetingIntensity * 0.038;
      const lateralBuffet = Math.cos(bt * 2.15) * buffetingIntensity * 0.022;

      this.camera.rotation.x += pitchBuffet;
      this.camera.rotation.z += rollBuffet;
      this.camera.position.y += verticalBuffet;
      this.camera.position.x += lateralBuffet;
    }

    // Visceral Impact Camera Trauma (Only triggers on hard collisions, decays rapidly in ~120ms)
    if (this.cameraTrauma > 0.005) {
      const shake = this.cameraTrauma * this.cameraTrauma; // quadratic falloff
      this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.025;
      this.camera.rotation.x += (Math.random() - 0.5) * shake * 0.035;
      this.camera.rotation.y += (Math.random() - 0.5) * shake * 0.035;
      this.cameraTrauma *= Math.exp(-dt * 14.0);
    }
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.physicsAccumulator = 0;
    if (paused) {
      this.inputs.throttle = 0;
      this.inputs.brake = 0;
      this.inputs.steering = 0;
      this.inputs.handbrake = false;
      this.keyboardInputs.throttle = 0;
      this.keyboardInputs.brake = 0;
      this.keyboardInputs.steering = 0;
      this.keyboardInputs.handbrake = false;
      this.activeKeys.clear();
    }
  }

  public setCameraMode(mode: CameraViewMode): void {
    this.cameraMode = mode;
  }

  public setCameraDistance(distance: CameraDistanceMode): void {
    this.cameraDistance = distance;
    this.setCameraMode('chase');
  }

  public nextCameraDistance(): CameraDistanceMode {
    const distances: CameraDistanceMode[] = ['near', 'medium', 'far'];
    const idx = distances.indexOf(this.cameraDistance);
    this.cameraDistance = distances[(idx + 1) % distances.length];
    this.setCameraMode('chase');
    return this.cameraDistance;
  }

  public nextCameraMode(): CameraViewMode {
    const modes: CameraViewMode[] = ['chase', 'hood', 'bumper', 'orbit'];
    const idx = modes.indexOf(this.cameraMode);
    const next = modes[(idx + 1) % modes.length];
    this.setCameraMode(next);
    return this.cameraMode;
  }

  public repairCar(): void {
    this.physics.repairFull();
    this.audio.triggerPitChime();
  }

  public resetCarToTrack(): void {
    this.physics.reset(-35, -130, Math.PI / 2);
    this.cameraPos.set(-42, 3, -130);
    this.cameraTarget.set(-30, 1, -130);
    this.audio.triggerPitChime();
  }

  public toggleAudio(): boolean {
    return this.audio.toggleMute();
  }

  public resumeAudio(): void {
    this.audio.resume();
  }

  public async loadCustomCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.carModel.loadCustomModel(file);
  }

  public restoreDefaultCar(): void {
    this.carModel.restoreDefaultModel();
  }

  public async loadCustomCrew(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    return this.pitStop.loadCustomCrewModel(file);
  }

  public restoreDefaultCrew(): void {
    this.pitStop.restoreDefaultCrew();
  }

  public initMultiplayer(playerId: 'p1' | 'p2', laps: number = 3): void {
    this.isMultiplayer = true;
    this.isFreePractice = false;
    this.myPlayerId = playerId;
    this.totalRaceLaps = laps;
    this.currentLapTime = 0;
    this.lapCount = 1;
    this.currentSector = 0;

    // Completely clear AI grid to free CPU budget for 120 Hz multiplayer
    this.careerRaceManager.clearAiGrid();
    this.careerRaceManager.leaderboard = [];

    // Create rival car model in scene if not exists
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }

    const p1Grid = this.activeCircuit.gridSlots.player;
    const p2Grid = this.activeCircuit.gridSlots.ai(1);

    if (playerId === 'p1') {
      // P1 on Pole Position (Official starting grid)
      this.physics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalPhysics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalCarModel.group.position.set(p2Grid.x, 0.35, p2Grid.z);
      this.rivalCarModel.group.rotation.set(0, p2Grid.yaw, 0);
      this.rivalInterpolator.reset(p2Grid.x, 0.35, p2Grid.z, p2Grid.yaw);
    } else {
      // P2 on 2nd Grid Box
      this.physics.reset(p2Grid.x, p2Grid.z, p2Grid.yaw);
      this.rivalPhysics.reset(p1Grid.x, p1Grid.z, p1Grid.yaw);
      this.rivalCarModel.group.position.set(p1Grid.x, 0.35, p1Grid.z);
      this.rivalCarModel.group.rotation.set(0, p1Grid.yaw, 0);
      this.rivalInterpolator.reset(p1Grid.x, 0.35, p1Grid.z, p1Grid.yaw);
    }

    this.isControlsLocked = true;
    const p = this.physics.position;
    this.cameraPos.set(p.x - 7.0, 2.5, p.z);
    this.cameraTarget.set(p.x + 5.0, 0.8, p.z);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  public updateRivalCar(telemetry: RivalTelemetryData): void {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }

    this.rivalTelemetry = telemetry;
    this.rivalLapCount = telemetry.lapCount;
    this.rivalCurrentSector = telemetry.currentSector;
    this.rivalSpeedKmh = telemetry.speedKmh;
    this.rivalLastUpdateTime = performance.now();

    // Push into our high-precision cubic Hermite interpolation and dead reckoning engine
    this.rivalInterpolator.pushSnapshot(telemetry);
  }

  public updateRivalCarInterpolation(dt: number): void {
    if (!this.rivalCarModel) return;
    const interp = this.rivalInterpolator.sample(dt);

    // Synchronize physical collision body for real-time contact simulation
    this.rivalPhysics.position.x = interp.x;
    this.rivalPhysics.position.y = interp.y;
    this.rivalPhysics.position.z = interp.z;
    this.rivalPhysics.yaw = interp.yaw;
    this.rivalPhysics.pitch = 0;
    this.rivalPhysics.roll = interp.roll;
    this.rivalPhysics.speed = interp.speed;
    this.rivalPhysics.steerAngle = interp.steerAngle;
    this.rivalPhysics.slipRatio = interp.slipRatio;

    this.rivalCarModel.group.position.set(interp.x, interp.y, interp.z);
    this.rivalCarModel.group.rotation.set(0, interp.yaw, interp.roll);

    if (interp.damage) {
      this.rivalPhysics.damage.overallHealth = interp.damage.overallHealth ?? 100;
      this.rivalPhysics.damage.engineHealth = interp.damage.engineHealth ?? 100;
      this.rivalPhysics.damage.frontCrumple = interp.damage.frontCrumple ?? 0;
      this.rivalPhysics.damage.rearCrumple = interp.damage.rearCrumple ?? 0;
      this.rivalPhysics.damage.frontWingLeftDamage = interp.damage.frontWingLeftDamage ?? 0;
      this.rivalPhysics.damage.frontWingRightDamage = interp.damage.frontWingRightDamage ?? 0;
      this.rivalPhysics.damage.wingDamageAmount = interp.damage.wingDamageAmount ?? 0;
      this.rivalPhysics.damage.frontWingLeftDetached = !!interp.damage.frontWingLeftDetached;
      this.rivalPhysics.damage.frontWingRightDetached = !!interp.damage.frontWingRightDetached;
      this.rivalPhysics.damage.rearWingLeftDetached = !!interp.damage.rearWingLeftDetached;
      this.rivalPhysics.damage.rearWingRightDetached = !!interp.damage.rearWingRightDetached;
      this.rivalPhysics.damage.drsFlapBroken = !!interp.damage.drsFlapBroken;
      this.rivalPhysics.damage.wingLoose = !!interp.damage.wingLoose;
    }

    const wheelSpin = (interp.speed / 0.33);
    this.rivalCarModel.update(
      interp.steerAngle,
      [wheelSpin, wheelSpin, wheelSpin, wheelSpin],
      interp.brake,
      interp.speedKmh,
      this.rivalPhysics.damage,
      interp.isShifting,
      interp.rpm,
      interp.damage?.wheelSuspensionCompression,
      interp.damage?.isPunctured,
      interp.damage?.tireWear,
      dt
    );

    // If rival is slipping or drifting, render tire smoke & skidmarks
    if (interp.slipRatio > 0.18) {
      const p = this.rivalCarModel.group.position;
      const yaw = interp.yaw;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);

      const rL = this._scratchRivalWheelL.set(p.x - cosY * 0.94 - sinY * 1.35, 0.024, p.z + sinY * 0.94 - cosY * 1.35);
      const rR = this._scratchRivalWheelR.set(p.x + cosY * 0.94 - sinY * 1.35, 0.024, p.z - sinY * 0.94 - cosY * 1.35);
      this.particles.emitTireSmoke(rL, 1, interp.slipRatio);
      this.particles.emitTireSmoke(rR, 1, interp.slipRatio);
      this.particles.addSkidmark(rL, rR, interp.slipRatio);
    }
  }

  public async loadCustomRivalCar(file: File): Promise<{ success: boolean; name: string; error?: string }> {
    if (!this.rivalCarModel) {
      this.rivalCarModel = new CarModel();
      this.scene.add(this.rivalCarModel.group);
    }
    return this.rivalCarModel.loadCustomModel(file);
  }

  public restoreDefaultRivalCar(): void {
    if (this.rivalCarModel) {
      this.rivalCarModel.restoreDefaultModel();
    }
  }

  public setTireCompound(compound: TireCompoundType): void {
    this.physics.setTireCompound(compound);
    this.pitStop.nextTireCompound = compound;
    this.carModel.setTireCompoundVisuals(compound);
  }

  public setNextPitTireCompound(compound: TireCompoundType): void {
    this.pitStop.setNextTireCompound(compound);
  }

  public repairTires(): void {
    this.physics.repairTires();
    this.carModel.setTireCompoundVisuals(this.physics.tireCompound);
  }

  /**
   * Sets the active circuit, swapping 3D track geometry, obstacles, waypoints, and AI parameters
   */
  public setCircuit(circuitId: CircuitId): void {
    if (this.activeCircuit && this.activeCircuit.id === circuitId) return;
    const newCircuit = getCircuit(circuitId);
    this.activeCircuit = newCircuit;

    // Cleanly remove and dispose old track
    if (this.track) {
      this.scene.remove(this.track.group);
      if (this.track.dispose) {
        this.track.dispose();
      }
    }

    // Build and mount new track
    this.track = newCircuit.createTrackBuilder();
    this.buildObstacleSpatialGrid();
    this.scene.add(this.track.group);

    // Sync Career and AI
    this.careerRaceManager.setCircuit(newCircuit);

    this.currentSector = 0;
    this.currentLapTime = 0;
    this.lapCount = 1;

    try {
      const storedBest = localStorage.getItem(`apex_best_lap_${newCircuit.id}`);
      this.bestLapTime = storedBest ? parseFloat(storedBest) : null;
    } catch {}

    const pPose = newCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.lastShadowPos.set(-999, -999, -999);
    this.syncCarModel(0.016);

    // Align camera cleanly behind the player facing the start straight
    this.smoothedCamYaw = pPose.yaw;
    const forwardX = Math.sin(pPose.yaw);
    const forwardZ = Math.cos(pPose.yaw);
    this.cameraPos.set(pPose.x - forwardX * 7.0, 2.2, pPose.z - forwardZ * 7.0);
    this.cameraTarget.set(pPose.x + forwardX * 5.0, 0.85, pPose.z + forwardZ * 5.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);

    // Pre-warm and compile newly mounted circuit shaders & materials to prevent runtime hitches/micro-freezes
    try {
      this.renderer.compile(this.scene, this.camera);
    } catch {}
  }

  public pauseAudio(): void {
    this.audio.pause();
  }

  /**
   * Deeply pre-warms all GPU resources, compiles shaders, uploads textures and computes initial shadow maps
   * during the Loading Screen so the actual race starts with rock-solid, hitch-free framerate.
   */
  public prewarmGPU(): void {
    try {
      this.scene.updateMatrixWorld(true);
      if (this.dirLight) {
        this.dirLight.target.updateMatrixWorld();
        this.dirLight.updateMatrixWorld();
      }
      this.renderer.compile(this.scene, this.camera);
      // Perform a single warm-up render pass so textures, shadow map render targets and GPU pipelines are fully bound
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.warn('Pre-warm completed with warning:', e);
    }
  }

  public initCareerRace(laps: RaceLapOption, difficulty: RaceDifficulty, startingCompound: TireCompoundType): void {
    this.isMultiplayer = false;
    this.isFreePractice = false;
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);

    this.careerRaceManager.config.totalLaps = laps;
    this.careerRaceManager.config.difficulty = difficulty;
    this.careerRaceManager.config.startingCompound = startingCompound;
    this.careerRaceManager.config.requiresTwoCompounds = laps >= 20;

    this.careerRaceManager.setCircuit(this.activeCircuit);
    this.careerRaceManager.startRace(this.physics);
    this.lapCount = 1;
    this.currentSector = 0;
    this.currentLapTime = 0;
    this.playerDrsEligible = true;
    this.playerInDrsZone = true;
    this.lastPlayerDrsDetectionId = null;
    this.physics.isDrsAvailable = true;
    this.physics.isDrsOpen = false;
    this.inputs.drs = false;
    try {
      const stored = localStorage.getItem(`apex_best_lap_${this.activeCircuit.id}`);
      this.bestLapTime = stored ? parseFloat(stored) : null;
    } catch {
      this.bestLapTime = null;
    }
    this.totalRaceLaps = laps;

    // Lock controls for 5 Red Lights FIA starting procedure
    this.isControlsLocked = true;

    // Position camera cleanly behind the player in Grid Slot 1
    const p = this.physics.position;
    const pPose = this.activeCircuit.gridSlots.player;
    this.smoothedCamYaw = pPose.yaw;
    const forwardX = Math.sin(pPose.yaw);
    const forwardZ = Math.cos(pPose.yaw);
    this.cameraPos.set(p.x - forwardX * 7.0, 2.2, p.z - forwardZ * 7.0);
    this.cameraTarget.set(p.x + forwardX * 5.0, 0.85, p.z + forwardZ * 5.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  /**
   * Initializes Solo Free Practice / Time Trial Mode (Modo 1 Solo Jugador - Vueltas Libres)
   * Track is completely empty with no AI rivals, no 5-red-lights wait, and infinite laps.
   */
  public initFreePractice(startingCompound: TireCompoundType = 'soft'): void {
    this.isFreePractice = true;
    this.isMultiplayer = false;
    this.isControlsLocked = false;

    // Dispose AI rivals so track is 100% clear
    this.careerRaceManager.dispose();
    this.careerRaceManager.leaderboard = [];

    // Position player car on start straight ready to roll
    const pPose = this.activeCircuit.gridSlots.player;
    this.physics.reset(pPose.x, pPose.z, pPose.yaw);
    this.physics.setTireCompound(startingCompound);
    this.pitStop.setNextTireCompound(startingCompound);
    this.carModel.setTireCompoundVisuals(startingCompound);
    this.currentSector = 0;
    this.currentLapTime = 0;
    this.lapCount = 1;
    this.totalRaceLaps = 999;
    this.playerDrsEligible = true;
    this.playerInDrsZone = false;
    this.lastPlayerDrsDetectionId = null;
    this.physics.isDrsAvailable = false;
    this.physics.isDrsOpen = false;
    this.inputs.drs = false;
    try {
      const stored = localStorage.getItem(`apex_best_lap_${this.activeCircuit.id}`);
      this.bestLapTime = stored ? parseFloat(stored) : null;
    } catch {
      this.bestLapTime = null;
    }

    const p = this.physics.position;
    this.smoothedCamYaw = pPose.yaw;
    const forwardX = Math.sin(pPose.yaw);
    const forwardZ = Math.cos(pPose.yaw);
    this.cameraPos.set(p.x - forwardX * 7.0, 2.2, p.z - forwardZ * 7.0);
    this.cameraTarget.set(p.x + forwardX * 5.0, 0.85, p.z + forwardZ * 5.0);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  public setControlsLocked(locked: boolean): void {
    this.isControlsLocked = locked;
    if (!locked) {
      // Unlocked: full racing launch!
      this.physics.speed = 0.5; // subtle launch push
      this.careerRaceManager.onLightsOut();
    }
  }

  public playStartingBeep(isHighPitch: boolean = false): void {
    this.audio.triggerPitChime();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    if (this.daySkyTexture) {
      this.daySkyTexture.dispose();
      this.daySkyTexture = undefined;
    }
    if (this.dynamicSky) {
      this.dynamicSky.dispose();
    }
    if (this.envMapTexture) {
      this.envMapTexture.dispose();
      this.envMapTexture = undefined;
    }
    if (this.scene.environment && typeof (this.scene.environment as any).dispose === 'function') {
      (this.scene.environment as any).dispose();
      this.scene.environment = null;
    }

    CarModel.clearTireTextureCache();

    if (this.track && typeof this.track.dispose === 'function') {
      this.track.dispose();
    }
    if (this.carModel && typeof this.carModel.dispose === 'function') {
      this.carModel.dispose();
    }
    if (this.rivalCarModel && typeof this.rivalCarModel.dispose === 'function') {
      this.rivalCarModel.dispose();
    }
    if (this.particles && typeof this.particles.dispose === 'function') {
      this.particles.dispose();
    }
    if (this.pitStop && typeof this.pitStop.dispose === 'function') {
      this.pitStop.dispose();
    }
    if (this.careerRaceManager && typeof this.careerRaceManager.dispose === 'function') {
      this.careerRaceManager.dispose();
    }
    if (this.speedEffect && typeof this.speedEffect.dispose === 'function') {
      this.speedEffect.dispose();
    }
    if (this.cinematicOptics && typeof this.cinematicOptics.dispose === 'function') {
      this.cinematicOptics.dispose();
    }
    if (this.heatHaze && typeof this.heatHaze.dispose === 'function') {
      this.heatHaze.dispose();
    }
    if (this.audio && typeof this.audio.dispose === 'function') {
      this.audio.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
