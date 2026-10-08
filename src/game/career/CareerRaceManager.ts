/**
 * CareerRaceManager.ts - 2-Car 1v1 Grand Prix Race Coordinator (Player vs Rival)
 * Manages grid positions, authentic 5-red-lights start countdown, live 1v1 telemetry leaderboard,
 * FIA mandatory 2-compound rules enforcement, and podium finish.
 */

import * as THREE from 'three';
import { AICarController } from '../ai/AICarController';
import {
  RACE_TEAMS,
  RaceDifficulty,
  RaceLapOption,
  CareerRaceConfig,
  DriverLeaderboardEntry,
} from './CareerTypes';
import {
  CIRCUIT_TOTAL_LENGTH,
  CIRCUIT_RACE_PACE_SPEED,
  getTrackDistanceAtPosition,
  getPreciseTrackDistanceAtPosition,
  formatF1TimeGap,
  formatF1LapTime,
} from './CircuitWaypoints';
import { ICircuitDefinition } from '../circuits/ICircuit';
import { getCircuit } from '../circuits/CircuitRegistry';
import { VehiclePhysics } from '../physics/VehiclePhysics';
import { ParticleSystem } from '../particles/ParticleSystem';
import { EngineSound } from '../audio/EngineSound';
import { TireCompoundType } from '../physics/TireCompound';

export class CareerRaceManager {
  public scene: THREE.Scene;
  public config: CareerRaceConfig;
  public aiCars: AICarController[] = [];
  public activeCircuit: ICircuitDefinition = getCircuit('square_apex');

  // Race Progress
  public isRaceStarted: boolean = false;
  public isRaceFinished: boolean = false;
  public isControlsLocked: boolean = true;
  public totalRaceTime: number = 0;
  public playerTotalDistance: number = 0;
  public playerCompoundsUsed: Set<TireCompoundType> = new Set();
  public playerPitStopsCount: number = 0;

  // Stored Leaderboard (Pre-allocated pool for 100% zero GC allocations in 1v1 duel)
  public leaderboard: DriverLeaderboardEntry[] = [];
  public raceWinner: DriverLeaderboardEntry | null = null;
  public playerFinishPosition: number | null = null;
  private leaderboardTimer: number = 0;
  private _cachedCompoundsArray: TireCompoundType[] = [];

  // Final Results
  public isShowingPodium: boolean = false;
  private _scratchPlayerPos: THREE.Vector3 = new THREE.Vector3();
  private lastPlayerClosestIdx: number = 0;
  private _playerProjScratch = { distanceAlongTrack: 0, closestIdx: 0 };
  private _competitorsPool: Array<{
    id: string;
    isPlayer: boolean;
    score: number;
    ai?: AICarController;
  }> = Array.from({ length: 2 }, () => ({
    id: '',
    isPlayer: false,
    score: 0,
    ai: undefined,
  }));
  private _leaderboardPool: DriverLeaderboardEntry[] = [];

  constructor(scene: THREE.Scene, config?: Partial<CareerRaceConfig>) {
    this.scene = scene;
    this.config = {
      totalLaps: config?.totalLaps || 20,
      difficulty: config?.difficulty || 'medium',
      startingCompound: config?.startingCompound || 'soft',
      requiresTwoCompounds: (config?.totalLaps || 20) >= 20,
    };

    this.playerCompoundsUsed.add(this.config.startingCompound);
  }

  /**
   * Ensures AI rival car exists in scene only when required for Career Grand Prix mode
   */
  public ensureAiGrid(): void {
    if (this.aiCars.length > 0) return;
    this.initAiGrid();
  }

  /**
   * Cleans up AI rival car 3D model and controller from the scene when entering Practice or Multiplayer
   */
  public clearAiGrid(): void {
    for (const car of this.aiCars) {
      this.scene.remove(car.carModel.group);
      if (car.carModel && typeof car.carModel.dispose === 'function') {
        car.carModel.dispose();
      }
    }
    this.aiCars = [];
    this.leaderboard = [];
    this.isRaceStarted = false;
  }

  /**
   * Initializes the AI Rival Car (Scuderia Leclerc #16) for 1v1 Grand Prix
   */
  private initAiGrid(): void {
    // Clear existing AI cars if any
    for (const car of this.aiCars) {
      this.scene.remove(car.carModel.group);
      if (car.carModel && typeof car.carModel.dispose === 'function') {
        car.carModel.dispose();
      }
    }
    this.aiCars = [];

    // AI Rival Team: Scuderia Corsa (#16, C. Leclerc)
    const rivalTeam = RACE_TEAMS[1] || RACE_TEAMS[0];
    const ai = new AICarController(
      rivalTeam,
      this.config.difficulty,
      'medium',
      this.config.totalLaps
    );

    ai.setCircuit(this.activeCircuit);
    // Grid Slot 2 (P2, alongside Pole Player)
    ai.setGridPosition(2);

    this.scene.add(ai.carModel.group);
    this.aiCars.push(ai);
  }

  /**
   * Sets the active circuit for Career Grand Prix mode
   */
  public setCircuit(circuit: ICircuitDefinition): void {
    this.activeCircuit = circuit;
    this.aiCars.forEach((ai) => {
      ai.setCircuit(circuit);
      ai.setGridPosition(2);
    });
  }

  /**
   * Resets and starts the Grand Prix on official F1 Grid
   */
  public startRace(playerPhysics: VehiclePhysics): void {
    this.isRaceStarted = true;
    this.isRaceFinished = false;
    this.isControlsLocked = true;
    this.totalRaceTime = 0;
    this.playerTotalDistance = 0;
    this.playerCompoundsUsed.clear();
    this.playerCompoundsUsed.add(playerPhysics.tireCompound);
    this.playerPitStopsCount = 0;
    this.playerFinishPosition = null;
    this.raceWinner = null;
    this.isShowingPodium = false;

    // Set player to Pole Position based on active circuit grid slots
    if (this.activeCircuit?.gridSlots) {
      const pPose = this.activeCircuit.gridSlots.player;
      playerPhysics.reset(pPose.x, pPose.z, pPose.yaw);
    } else {
      playerPhysics.reset(-18.0, -128.0, Math.PI / 2);
    }
    playerPhysics.speed = 0;
    playerPhysics.gear = 1;

    // Ensure AI rival car exists if previously disposed (e.g. after Free Practice)
    if (this.aiCars.length === 0) {
      this.initAiGrid();
    }

    // Reset AI rival on F1 grid slot 2 (P2)
    this.aiCars.forEach((ai) => {
      ai.difficulty = this.config.difficulty;
      ai.totalLaps = this.config.totalLaps;
      ai.planPitStrategy(this.config.totalLaps);
      ai.setCircuit(this.activeCircuit);
      ai.setGridPosition(2);
    });
  }

  /**
   * Triggered when starting lights go out
   */
  public onLightsOut(): void {
    this.isControlsLocked = false;
    this.aiCars.forEach((ai) => {
      ai.onLightsOut();
    });
  }

  /**
   * Registers a pit stop compound change for the player
   */
  public registerPlayerPitStop(newCompound: TireCompoundType): void {
    this.playerCompoundsUsed.add(newCompound);
    this.playerPitStopsCount++;
  }

  /**
   * Main Frame Update: Simulation of 1v1 AI Rival pilot and live race standings calculation
   */
  public update(
    dt: number,
    playerPhysics: VehiclePhysics,
    playerLapCount: number,
    playerCurrentSector: number,
    playerCurrentLapTime: number,
    playerBestLapTime: number | null,
    playerIsInPit: boolean,
    particles: ParticleSystem,
    audio?: EngineSound,
    isControlsLocked: boolean = false
  ): void {
    if (!this.isRaceStarted) return;

    this.isControlsLocked = isControlsLocked;
    if (!isControlsLocked) {
      this.totalRaceTime += dt;
    }

    // Dynamic player distance along track based on active circuit
    const totalTrackLength = this.activeCircuit ? this.activeCircuit.totalLength : 974.76;
    const playerSpeedKmh = Math.abs(playerPhysics.speed) * 3.6;
    this._scratchPlayerPos.set(playerPhysics.position.x, playerPhysics.position.y, playerPhysics.position.z);
    const pPos = this._scratchPlayerPos;

    // 1. Update 1v1 AI Rival Car
    for (const ai of this.aiCars) {
      ai.update(
        dt,
        pPos,
        playerSpeedKmh,
        this.aiCars,
        particles,
        this.isRaceStarted,
        this.isControlsLocked,
        playerPhysics.yaw
      );

      // Tactical Pit Stop Intelligence (Reactive Undercut / Overcut):
      // If player enters pits and AI is within 4 laps of planned stop, AI can either:
      // Overcut (push in clean air with 100% pace) or Undercut next lap if trailing
      if (playerPhysics.isInPitStop && !ai.isInPitLane && ai.pitStopsCount < 1 && this.config.totalLaps >= 20) {
        if (!ai.plannedPitLaps.includes(ai.currentLap) && !ai.plannedPitLaps.includes(ai.currentLap + 1)) {
          // Trigger reactive overcut/undercut next lap
          ai.plannedPitLaps.push(ai.currentLap + 1);
        }
      }

      // Check AI Finish
      if (!ai.isFinished && ai.currentLap > this.config.totalLaps) {
        ai.isFinished = true;
        ai.finishTime = this.totalRaceTime;
      }
    }

    // 2. Player Finish Check
    if (!this.isRaceFinished && playerLapCount > this.config.totalLaps) {
      this.isRaceFinished = true;
      if (audio) {
        audio.triggerPitChime();
      }
    }

    // 3. Compute Live F1 Leaderboard & Real-Time Positions (P1 vs P2 1v1 Duel) - Throttled to 10 Hz
    this.leaderboardTimer += dt;
    if (this.leaderboardTimer < 0.10 && this.leaderboard.length > 0) {
      return;
    }
    this.leaderboardTimer = 0;

    // Synchronize Player track progress on the exact same circuit waypoint spline as AI (O(1) Localized Search)
    const pts = this.activeCircuit.waypoints;
    const trackLen = this.activeCircuit.totalLength;
    const paceSpeed = this.activeCircuit.racePaceSpeed;

    const playerProj = getPreciseTrackDistanceAtPosition(
      playerPhysics.position.x,
      playerPhysics.position.z,
      this.lastPlayerClosestIdx,
      pts,
      trackLen,
      this._playerProjScratch
    );
    this.lastPlayerClosestIdx = playerProj.closestIdx;
    const playerDistOnLap = playerProj.distanceAlongTrack;
    const playerProgressScore = (playerLapCount - 1) * trackLen + playerDistOnLap;

    let compCount = 0;

    // Slot 0: Player
    const playerComp = this._competitorsPool[compCount++];
    playerComp.id = 'player';
    playerComp.isPlayer = true;
    playerComp.score = playerProgressScore;
    playerComp.ai = undefined;

    // AI Cars
    for (let i = 0; i < this.aiCars.length; i++) {
      const ai = this.aiCars[i];
      const aiComp = this._competitorsPool[compCount++];
      aiComp.id = ai.team.id;
      aiComp.isPlayer = false;
      aiComp.score = (ai.currentLap - 1) * trackLen + ai.distanceAlongTrack;
      aiComp.ai = ai;
    }

    const competitors = this._competitorsPool.slice(0, compCount);

    // Sort descending by real accumulated race progress (P1 leader = furthest progress)
    competitors.sort((a, b) => b.score - a.score);

    const leaderScore = competitors[0].score;

    // Build finalized leaderboard entries with official F1 millisecond gaps and comma format in-place
    const outLeaderboard = this._leaderboardPool;
    outLeaderboard.length = competitors.length;

    for (let idx = 0; idx < competitors.length; idx++) {
      const comp = competitors[idx];
      const position = idx + 1;
      const scoreDelta = Math.max(0, leaderScore - comp.score);
      const gapSeconds = scoreDelta / paceSpeed;
      const aheadScore = idx === 0 ? leaderScore : competitors[idx - 1].score;
      const intervalSeconds = Math.max(0, (aheadScore - comp.score) / paceSpeed);
      const lapsBehind = Math.floor(scoreDelta / trackLen);

      let gapFormatted = 'LÍDER';
      let aheadFormatted = '-';

      if (position > 1) {
        if (lapsBehind >= 1) {
          gapFormatted = `+${lapsBehind} ${lapsBehind === 1 ? 'VTA' : 'VTAS'}`;
          aheadFormatted = `+${lapsBehind} ${lapsBehind === 1 ? 'VTA' : 'VTAS'}`;
        } else {
          gapFormatted = formatF1TimeGap(gapSeconds);
          aheadFormatted = formatF1TimeGap(intervalSeconds);
        }
      }

      if (comp.isPlayer) {
        if (this._cachedCompoundsArray.length !== this.playerCompoundsUsed.size) {
          this._cachedCompoundsArray = Array.from(this.playerCompoundsUsed);
        }
        const compoundsArray = this._cachedCompoundsArray;
        const hasSatisfied = !this.config.requiresTwoCompounds || compoundsArray.length >= 2;
        const avgWear = (playerPhysics.tireWear[0] + playerPhysics.tireWear[1] + playerPhysics.tireWear[2] + playerPhysics.tireWear[3]) / 4;

        if (this.isRaceFinished && this.playerFinishPosition === null) {
          this.playerFinishPosition = position;
        }

        let entry = outLeaderboard[idx];
        if (!entry) {
          entry = {} as DriverLeaderboardEntry;
          outLeaderboard[idx] = entry;
        }

        entry.id = 'player';
        entry.position = position;
        entry.driverCode = 'YOU';
        entry.driverName = 'Tú (Player)';
        entry.driverNumber = '1';
        entry.teamName = 'Apex Racing GP';
        entry.teamColorCss = '#3b82f6';
        entry.currentLap = Math.min(this.config.totalLaps, playerLapCount);
        entry.currentSector = playerCurrentSector;
        entry.currentCompound = playerPhysics.tireCompound;
        entry.compoundsUsed = compoundsArray;
        entry.hasSatisfiedTireRule = hasSatisfied;
        entry.tireWearAvg = avgWear;
        entry.pitStopsCount = this.playerPitStopsCount;
        entry.isInPit = playerIsInPit;
        entry.gapToLeaderFormatted = gapFormatted;
        entry.gapToAheadFormatted = aheadFormatted;
        entry.lastLapTime = null;
        entry.bestLapTime = playerBestLapTime;
        entry.currentLapTime = playerCurrentLapTime;
        entry.totalRaceTime = this.totalRaceTime;
        entry.isPlayer = true;
        entry.isFinished = this.isRaceFinished;
        entry.finishPosition = this.playerFinishPosition || undefined;
        entry.hasPenalty = this.isRaceFinished && this.config.requiresTwoCompounds && compoundsArray.length < 2;
        entry.penaltySeconds = this.config.requiresTwoCompounds && compoundsArray.length < 2 ? 30 : 0;
      } else {
        const ai = comp.ai!;
        const aiData = ai.getLeaderboardData(position, leaderScore);
        aiData.gapToLeaderFormatted = gapFormatted;
        aiData.gapToAheadFormatted = aheadFormatted;
        outLeaderboard[idx] = aiData;
      }
    }

    this.leaderboard = outLeaderboard;
    this.raceWinner = outLeaderboard[0] || null;
  }

  /**
   * Synchronizes AI car 3D mesh transforms, wheels, suspension, and visuals once per render frame
   */
  public updateVisuals(frameDt: number, alpha: number = 1.0): void {
    for (let i = 0; i < this.aiCars.length; i++) {
      this.aiCars[i].syncVisuals(frameDt, alpha);
    }
  }

  public dispose(): void {
    for (const car of this.aiCars) {
      this.scene.remove(car.carModel.group);
      if (car.carModel && typeof car.carModel.dispose === 'function') {
        car.carModel.dispose();
      }
    }
    this.aiCars = [];
  }
}
