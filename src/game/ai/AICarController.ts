/**
 * AICarController.ts - Professional Multi-Car AI Racing Pilot with Real Rigid Body Physics
 * Controls autonomous F1 cars with dynamic racing lines, long-range predictive braking,
 * realistic Pacejka physics, structural damage simulation, multi-compound pit stop strategies,
 * 9-ray multibeam radar perception, active slipstream slingshot overtaking, switchback counters,
 * proactive defense, and emergency in-lap pit stop protocols.
 */

import * as THREE from 'three';
import { CarModel } from '../models/CarModel';
import { TeamLiveryConfig, RaceDifficulty, DriverLeaderboardEntry } from '../career/CareerTypes';
import { TireCompoundType, TIRE_COMPOUNDS } from '../physics/TireCompound';
import { ParticleSystem } from '../particles/ParticleSystem';
import { DamageState, VehiclePhysics, CarInputs } from '../physics/VehiclePhysics';
import { AIRaycastPerception, VehicleObstacle, TacticalManeuver } from './AIRaycastPerception';
import {
  SplinePoint,
  SHARED_CIRCUIT_WAYPOINTS,
  CIRCUIT_TOTAL_LENGTH,
  CIRCUIT_RACE_PACE_SPEED,
  formatF1TimeGap,
} from '../career/CircuitWaypoints';
import { ICircuitDefinition } from '../circuits/ICircuit';

export type { SplinePoint };

export type AIRacingState = 'RACING' | 'ATTACKING' | 'DEFENDING' | 'SWITCHBACK' | 'IN_LAP_EMERGENCY';

function getNearestAngle(currentAngle: number, targetAngle: number): number {
  let diff = (targetAngle - currentAngle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return currentAngle + diff;
}

export class AICarController {
  public team: TeamLiveryConfig;
  public carModel: CarModel;
  public difficulty: RaceDifficulty;

  // Real Vehicle Physics Engine for this AI Car
  public physics: VehiclePhysics;

  // Analytical 9-beam Radar Raycasting Sensor
  public radar = new AIRaycastPerception();

  // Current Tactical Racecraft State
  public raceState: AIRacingState = 'RACING';
  public currentManeuver: TacticalManeuver = 'hold';

  // F1 Driver Personality & Racecraft Attributes
  public aggression: number = 0.88;
  public brakeSkill: number = 1.05;
  public trailBrakeAbility: number = 0.90;
  public defenseSkill: number = 0.88;

  // Track position & metrics
  public distanceAlongTrack: number = 0; // 0 to TrackLength
  public trackProgressNormalized: number = 0; // 0.0 to 1.0 per lap
  public currentLap: number = 1;
  public currentSector: number = 0;
  public lateralOffset: number = 0; // Smooth offset from optimal racing line (-3.5 to +3.5)
  public targetLateralOffset: number = 0;

  // Starting Grid Anchor & Lane Discipline
  public gridStartX: number = -26.0;
  public gridStartZ: number = -132.0;
  public initialLaneOffset: number = 0;

  // Cached vector for external systems
  public position = new THREE.Vector3();

  // Starting Procedure & Reaction Time
  public hasReactedToLights: boolean = false;
  public reactionTimer: number = 0;

  // Autonomous Stuck Detection & Recovery State Machine
  public stuckTimer: number = 0;
  public recoveryPhase: 'none' | 'reverse' | 'turn_in' = 'none';
  public recoveryTimer: number = 0;

  // Active Overtaking, Slipstream & Official F1 DRS State
  public isOvertaking: boolean = false;
  public overtakeTimer: number = 0;
  public slipstreamActive: boolean = false;
  public switchbackTimer: number = 0;
  public defenseTimer: number = 0;
  public isDrsEligible: boolean = false;
  public isDrsZoneActive: boolean = false;
  public lastDetectionPassed: string | null = null;

  // Tire Compound & Degradation
  public currentCompound: TireCompoundType = 'medium';
  public nextPitCompound: TireCompoundType = 'hard';
  public compoundsUsed: Set<TireCompoundType> = new Set();
  public pitStopsCount: number = 0;

  // Emergency Damage & Pit Stop State
  public isInEmergencyPitLap: boolean = false;
  public isEnteringPitTransition: boolean = false;
  public isInPitLane: boolean = false;
  public isStationaryInBox: boolean = false;
  public hasServicedInBox: boolean = false;
  public pitProgress: number = 0;
  public pitTimer: number = 0;
  public readonly pitDuration: number = 4.0; // Calibrated 4.0s pit service duration
  public plannedPitLaps: number[] = [];
  public hasPlannedStops: boolean = false;

  // Timing & Telemetry
  public totalLaps: number = 20;
  public currentLapTime: number = 0;
  public lastLapTime: number | null = null;
  public bestLapTime: number | null = null;
  public totalRaceTime: number = 0;
  public isFinished: boolean = false;
  public finishTime: number = 0;

  // Track geometry metrics
  public totalTrackLength: number = 974.76;
  public waypoints: SplinePoint[] = [];
  public activeCircuit?: ICircuitDefinition;
  private lastClosestIdx: number = 0;
  public currentInputs: CarInputs = {
    throttle: 0,
    brake: 0,
    steering: 0,
    handbrake: false,
    drs: false,
  };
  private perceptionTimer: number = 0;
  private controlTimer: number = 0;
  private strategyTimer: number = 0;
  private cachedTargetSpeedMs: number = 60.0;
  private static _obstaclesPool: VehicleObstacle[] = Array.from({ length: 4 }, () => ({
    id: '',
    x: 0,
    z: 0,
    yaw: 0,
    speedMs: 0,
    length: 4.8,
    width: 2.0,
  }));
  private static _activeObstacles: VehicleObstacle[] = [];

  constructor(
    team: TeamLiveryConfig,
    difficulty: RaceDifficulty = 'hard',
    startingCompound: TireCompoundType = 'medium',
    totalRaceLaps: number = 20
  ) {
    this.team = team;
    this.difficulty = difficulty;
    this.totalLaps = totalRaceLaps;
    this.currentCompound = startingCompound;
    this.compoundsUsed.add(startingCompound);
    this.carModel = new CarModel(team, true);
    this.carModel.setTireCompoundVisuals(startingCompound);

    // Initialize dedicated vehicle physics instance
    this.physics = new VehiclePhysics(-26.0, -132.0, Math.PI / 2);
    this.physics.setTireCompound(startingCompound);

    // Calibrate Authentic Driver Personalities & World-Class F1 Racecraft Styles
    if (team.id === 'scuderia') {
      // Charles Leclerc (#16 Scuderia Corsa): Ultra-aggressive, fearless inside divebomber, blistering apex pace
      this.aggression = 0.96;
      this.brakeSkill = 1.15;
      this.trailBrakeAbility = 0.94;
      this.defenseSkill = 0.88;
    } else {
      // Default 1v1 Rival Configuration
      this.aggression = 0.92;
      this.brakeSkill = 1.12;
      this.trailBrakeAbility = 0.90;
      this.defenseSkill = 0.88;
    }

    this.waypoints = SHARED_CIRCUIT_WAYPOINTS;
    this.totalTrackLength = CIRCUIT_TOTAL_LENGTH;
    this.planPitStrategy(totalRaceLaps);
  }

  /**
   * Sets the active circuit topology and waypoints for the AI
   */
  public setCircuit(circuit: ICircuitDefinition): void {
    this.activeCircuit = circuit;
    this.waypoints = circuit.waypoints;
    this.totalTrackLength = circuit.totalLength;
  }

  public get speedKmh(): number {
    return Math.abs(this.physics.speed) * 3.6;
  }

  public get speedMs(): number {
    return Math.abs(this.physics.speed);
  }

  public get yaw(): number {
    return this.physics.yaw;
  }

  public get damage(): DamageState {
    return this.physics.damage;
  }

  public get tireWear(): [number, number, number, number] {
    return this.physics.tireWear;
  }

  /**
   * Plans realistic AI pit stop strategy based on race length and compound rules
   */
  public planPitStrategy(totalLaps: number): void {
    this.hasPlannedStops = true;
    if (totalLaps === 9) {
      if (this.currentCompound === 'soft') {
        this.plannedPitLaps = [4];
        this.nextPitCompound = 'medium';
      } else {
        this.plannedPitLaps = [];
      }
    } else if (totalLaps === 20) {
      const pitLap = 8 + Math.floor(Math.random() * 4);
      this.plannedPitLaps = [pitLap];
      if (this.currentCompound === 'soft') {
        this.nextPitCompound = 'medium';
      } else if (this.currentCompound === 'medium') {
        this.nextPitCompound = 'hard';
      } else {
        this.nextPitCompound = 'soft';
      }
    } else {
      this.plannedPitLaps = [16, 33];
      this.nextPitCompound = this.currentCompound === 'soft' ? 'medium' : 'hard';
    }
  }

  /**
   * Sets vehicle cleanly on its designated F1 Starting Grid slot (1 to 5)
   */
  public setGridPosition(gridSlot: number): void {
    let gridX = -18.0;
    let gridZ = -132.0;
    let gridYaw = Math.PI / 2;
    const isLeft = gridSlot % 2 === 1;

    if (this.activeCircuit?.gridSlots) {
      const slotPose = this.activeCircuit.gridSlots.ai(gridSlot);
      gridX = slotPose.x;
      gridZ = slotPose.z;
      gridYaw = slotPose.yaw;
    } else {
      gridX = -18.0 - (gridSlot - 1) * 8.0;
      gridZ = isLeft ? -128.0 : -132.0;
      gridYaw = Math.PI / 2;
    }

    this.physics.reset(gridX, gridZ, gridYaw);
    this.gridStartX = gridX;
    this.gridStartZ = gridZ;
    this.initialLaneOffset = isLeft ? 2.0 : -2.0;
    this.lateralOffset = this.initialLaneOffset;
    this.targetLateralOffset = this.initialLaneOffset;

    this.position.set(gridX, 0.35, gridZ);
    this.carModel.group.position.copy(this.position);
    this.carModel.group.rotation.set(0, gridYaw, 0);

    const startProgressX = gridX - (-92.0);
    this.distanceAlongTrack = Math.max(0, startProgressX);
    this.trackProgressNormalized = this.distanceAlongTrack / this.totalTrackLength;

    // F1 Starting Reaction Times (Hard mode: 0.08s - 0.12s)
    const reactionBase = {
      easy: 0.28,
      medium: 0.18,
      hard: 0.08,
    }[this.difficulty];
    this.reactionTimer = reactionBase + Math.random() * 0.05;
    this.hasReactedToLights = false;
    this.stuckTimer = 0;
    this.recoveryPhase = 'none';
    this.isInEmergencyPitLap = false;
    this.isInPitLane = false;
    this.isStationaryInBox = false;
    this.hasServicedInBox = false;
    this.isOvertaking = false;
    this.overtakeTimer = 0;
    this.raceState = 'RACING';
  }

  /**
   * Called when starting lights go out
   */
  public onLightsOut(): void {
    this.hasReactedToLights = false;
  }

  /**
   * Main AI Update Loop: Autonomous Master Driver AI with Multibeam Raycasting, G-G Trail Braking,
   * Slingshot Overtakes, Switchback Counters, Defense, and Emergency In-Lap Pit Stops
   */
  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerSpeedKmh: number,
    otherAiCars: AICarController[],
    particles: ParticleSystem,
    isRaceActive: boolean,
    isControlsLocked: boolean = false,
    playerYaw: number = 0
  ): void {
    // 1. Grid Locked State (Revving in place during 5 Red Lights sequence)
    if (!isRaceActive || isControlsLocked) {
      this.physics.speed = 0;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      this.physics.position.x = this.gridStartX;
      this.physics.position.y = 0.35;
      this.physics.position.z = this.gridStartZ;
      this.physics.yaw = Math.PI / 2;
      this.physics.gear = 1;

      this.physics.update(dt, {
        throttle: 0.65 + Math.sin(performance.now() * 0.008) * 0.25, // aggressive revving
        brake: 1.0,
        steering: 0,
        handbrake: true,
      });

      this.physics.position.x = this.gridStartX;
      this.physics.position.y = 0.35;
      this.physics.position.z = this.gridStartZ;
      this.physics.speed = 0;
      this.physics.lateralSpeed = 0;
      this.physics.angularVelocity = 0;
      this.physics.yaw = Math.PI / 2;
      this.physics.gear = 1;

      this.position.set(this.gridStartX, 0.35, this.gridStartZ);
      this.currentInputs.throttle = 0.65;
      this.currentInputs.brake = 1.0;
      this.currentInputs.steering = 0;
      this.currentInputs.handbrake = true;
      return;
    }

    // Reaction delay after lights out before launch
    if (!this.hasReactedToLights) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) {
        this.hasReactedToLights = true;
      } else {
        this.physics.speed = 0;
        this.physics.lateralSpeed = 0;
        this.physics.position.x = this.gridStartX;
        this.physics.position.y = 0.35;
        this.physics.position.z = this.gridStartZ;
        this.physics.yaw = Math.PI / 2;
        this.physics.gear = 1;

        this.physics.update(dt, { throttle: 0.95, brake: 1.0, steering: 0, handbrake: true });

        this.physics.position.x = this.gridStartX;
        this.physics.position.y = 0.35;
        this.physics.position.z = this.gridStartZ;
        this.physics.speed = 0;
        this.physics.lateralSpeed = 0;
        this.physics.gear = 1;

        this.position.set(this.gridStartX, 0.35, this.gridStartZ);
        this.currentInputs.throttle = 0.95;
        this.currentInputs.brake = 1.0;
        this.currentInputs.steering = 0;
        this.currentInputs.handbrake = true;
        return;
      }
    }

    // 2. Autonomous Collision Recovery State Machine (Reversing & Turn-in)
    if (this.recoveryPhase !== 'none') {
      const numPts = this.waypoints.length;
      const cPt = this.waypoints[this.lastClosestIdx % numPts];
      const nextPt = this.waypoints[(this.lastClosestIdx + 3) % numPts];
      const targetYaw = Math.atan2(nextPt.x - cPt.x, nextPt.z - cPt.z);
      let headingErr = targetYaw - this.physics.yaw;
      while (headingErr > Math.PI) headingErr -= Math.PI * 2;
      while (headingErr < -Math.PI) headingErr += Math.PI * 2;

      if (this.recoveryPhase === 'reverse') {
        this.recoveryTimer -= dt;
        this.physics.gear = -1;
        this.currentInputs.throttle = 0;
        this.currentInputs.brake = 0.85;
        this.currentInputs.steering = -THREE.MathUtils.clamp(headingErr * 1.5, -1.0, 1.0);
        this.currentInputs.handbrake = false;
        this.physics.update(dt, this.currentInputs);

        if (this.recoveryTimer <= 0) {
          this.recoveryPhase = 'turn_in';
          this.recoveryTimer = 1.0;
          this.physics.gear = 1;
        }
      } else if (this.recoveryPhase === 'turn_in') {
        this.recoveryTimer -= dt;
        this.physics.gear = 1;
        this.currentInputs.throttle = 0.85;
        this.currentInputs.brake = 0;
        this.currentInputs.steering = THREE.MathUtils.clamp(headingErr * 1.5, -1.0, 1.0);
        this.currentInputs.handbrake = false;
        this.physics.update(dt, this.currentInputs);

        if (this.recoveryTimer <= 0 || (this.speedKmh > 18.0 && Math.abs(headingErr) < 0.35)) {
          this.recoveryPhase = 'none';
          this.stuckTimer = 0;
        }
      }

      this.position.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);
      return;
    }

    // 3. Pit Lane Trajectory & Timed Stop
    if (this.isInPitLane) {
      this.updatePitLane(dt, particles);
      return;
    }

    if (this.isEnteringPitTransition) {
      if (this.updatePitEntryTransition(dt)) {
        return;
      }
    }

    const myX = this.physics.position.x;
    const myZ = this.physics.position.z;
    const mySpeed = Math.abs(this.physics.speed);
    const mySpeedKmh = mySpeed * 3.6;

    // Check emergency damage: only true disabling damage triggers an emergency pit lap
    const hasCriticalDamage =
      this.physics.damage.engineHealth < 40 ||
      this.physics.damage.overallHealth < 30 ||
      this.physics.isPunctured.some((p) => p) ||
      this.physics.damage.frontWingLeftDetached ||
      this.physics.damage.frontWingRightDetached;

    const needsPit =
      hasCriticalDamage ||
      this.plannedPitLaps.includes(this.currentLap) ||
      (this.physics.tireWear[0] > 78 && this.pitStopsCount < 2);

    if (hasCriticalDamage) {
      this.isInEmergencyPitLap = true;
      this.raceState = 'IN_LAP_EMERGENCY';
    }

    // Dynamic Pit Lane Entry Navigation using active circuit topology
    const pz = this.activeCircuit?.pitZone || { minX: -65.0, maxX: 45.0, minZ: -120.0, maxZ: -106.0 };

    if (needsPit && !this.isInPitLane) {
      // In final sector or approaching main straight, proactively move to the pit entry side
      if ((this.currentSector === 4 || (myZ < -85.0 && myX < 15.0)) && myX < 5.0) {
        this.targetLateralOffset = 2.4;
      }

      // Smooth pit entry transition approach: ONLY when entering the pit lane apron (Z >= -122.0)
      const inPitApproach = myX >= (pz.minX - 10.0) && myX <= (pz.minX + 12.0) && myZ >= (pz.minZ - 0.5) && myZ <= (pz.maxZ + 5.0);
      if (inPitApproach) {
        this.isEnteringPitTransition = true;
        this.updatePitEntryTransition(dt);
        return;
      }

      // Inside pit lane fast lane past entry gantry
      const inPitCorridor = myX > (pz.minX + 12.0) && myX <= (pz.maxX + 5.0) && myZ >= (pz.minZ - 0.5) && myZ <= (pz.maxZ + 5.0);
      if (inPitCorridor && this.isEnteringPitTransition) {
        this.isInPitLane = true;
        this.isEnteringPitTransition = false;
        this.isStationaryInBox = false;
        this.hasServicedInBox = false;
        this.pitTimer = 0;
        this.plannedPitLaps = this.plannedPitLaps.filter((l) => l !== this.currentLap);
        this.isInEmergencyPitLap = false;
        this.updatePitLane(dt, particles);
        return;
      }
    }

    // 4. Autonomous Pilot Navigation (High-Performance Pure Pursuit with Dynamic Curvature Lookahead)
    const numPts = this.waypoints.length;
    let closestIdx = this.lastClosestIdx;
    let closestDistSq = Infinity;

    // Check 30 points ahead and 8 behind current position (O(1) localized search)
    for (let offset = -8; offset <= 30; offset++) {
      const idx = (this.lastClosestIdx + offset + numPts) % numPts;
      const pt = this.waypoints[idx];
      const dx = pt.x - myX;
      const dz = pt.z - myZ;
      const dsq = dx * dx + dz * dz;
      if (dsq < closestDistSq) {
        closestDistSq = dsq;
        closestIdx = idx;
      }
    }

    // Safety fallback full search if displaced
    if (closestDistSq > 1600) {
      for (let i = 0; i < numPts; i++) {
        const pt = this.waypoints[i];
        const dx = pt.x - myX;
        const dz = pt.z - myZ;
        const dsq = dx * dx + dz * dz;
        if (dsq < closestDistSq) {
          closestDistSq = dsq;
          closestIdx = i;
        }
      }
    }
    this.lastClosestIdx = closestIdx;

    // 4.1 Compute Local Track Curvature
    const pPrev = this.waypoints[(closestIdx - 3 + numPts) % numPts];
    const pCurr = this.waypoints[closestIdx];
    const pNext = this.waypoints[(closestIdx + 3) % numPts];

    const d1x = pCurr.x - pPrev.x;
    const d1z = pCurr.z - pPrev.z;
    const d2x = pNext.x - pCurr.x;
    const d2z = pNext.z - pCurr.z;

    const len1 = Math.hypot(d1x, d1z) || 1;
    const len2 = Math.hypot(d2x, d2z) || 1;
    const crossProduct = Math.abs(d1x * d2z - d1z * d2x);
    const localCurvature = crossProduct / (len1 * len2);

    // Speed-adaptive lookahead distance:
    // Tight corners (high curvature): 7.0m to 10.0m for crisp apex clipping
    // High-speed straights: 14.0m to 22.0m for straight-line tracking stability
    const curvatureFactor = THREE.MathUtils.clamp(localCurvature * 45.0, 0, 1);
    const lookaheadDist = THREE.MathUtils.lerp(
      THREE.MathUtils.clamp(14.0 + mySpeed * 0.12, 14.0, 22.0),
      THREE.MathUtils.clamp(7.0 + mySpeed * 0.04, 7.0, 10.0),
      curvatureFactor
    );

    let accumulatedDist = 0;
    let targetIdx = closestIdx;

    while (accumulatedDist < lookaheadDist) {
      const nextIdx = (targetIdx + 1) % numPts;
      const p1 = this.waypoints[targetIdx];
      const p2 = this.waypoints[nextIdx];
      const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      accumulatedDist += segLen;
      targetIdx = nextIdx;
    }

    const targetPt = this.waypoints[targetIdx];

    // Compute authentic RIGHT normal vector at target waypoint (+offset = driver's right, -offset = driver's left)
    const nextPt = this.waypoints[(targetIdx + 1) % numPts];
    const tDx = nextPt.x - targetPt.x;
    const tDz = nextPt.z - targetPt.z;
    const tLen = Math.hypot(tDx, tDz) || 1;
    // Normalized right-hand normal vector:
    const normX = -tDz / tLen;
    const normZ = tDx / tLen;

    const isApproachingCornerZone = targetPt.speedLimitKmh < 225;
    const isExitingCornerZone = targetPt.speedLimitKmh >= 225 && mySpeedKmh < 260;

    // 5. Multibeam Radar Raycasting Perception & Tactical Overtaking (Tiered at 25 Hz / 40ms)
    this.perceptionTimer -= dt;
    if (this.perceptionTimer <= 0) {
      this.perceptionTimer = 0.040;

      const isStartingStraight = this.currentLap === 1 && myX < 65 && myZ < -115;
      const baseOffset = isStartingStraight ? this.initialLaneOffset : 0;

      // Static obstacles pool reuse with zero GC allocation & spatial culling (< 55m)
      const activeObstacles = AICarController._activeObstacles;
      activeObstacles.length = 0;
      let poolIdx = 0;

      // Player obstacle check (if within 55m)
      const pDx = playerPos.x - myX;
      const pDz = playerPos.z - myZ;
      const playerDistSq = pDx * pDx + pDz * pDz;
      let playerRelLateral = 0;

      if (playerDistSq <= 3025) { // 55m * 55m
        const slot = AICarController._obstaclesPool[poolIdx++];
        slot.id = 'player';
        slot.x = playerPos.x;
        slot.z = playerPos.z;
        slot.yaw = playerYaw;
        slot.speedMs = playerSpeedKmh / 3.6;
        slot.length = 4.8;
        slot.width = 2.0;
        activeObstacles.push(slot);

        // Relative lateral position of player
        playerRelLateral = (pDx * normX + pDz * normZ);
      }

      // In 1v1 duel, check if AI is ahead of the player or leading
      let amLeading = true;
      if (playerDistSq <= 3025) {
        const fwdX = Math.sin(this.physics.yaw);
        const fwdZ = Math.cos(this.physics.yaw);
        const dotFwd = pDx * fwdX + pDz * fwdZ;
        if (dotFwd > 0.5) {
          amLeading = false;
        }
      }

      // Tarmac width available (16m wide circuit -> max safe offset +/-2.2m from center)
      const maxSafeLateral = 2.2;
      const availLeft = maxSafeLateral + this.lateralOffset;
      const availRight = maxSafeLateral - this.lateralOffset;

      // Cast 9-beam radar array against nearby track entities
      const radar = this.radar.castRays(myX, myZ, this.physics.yaw, mySpeed, activeObstacles, availLeft, availRight);

      // Evaluate tactical racecraft state
      const overtakeDecision = this.radar.evaluateOvertake(
        this.lateralOffset,
        this.aggression,
        isApproachingCornerZone,
        isExitingCornerZone,
        amLeading
      );

      this.currentManeuver = overtakeDecision.maneuver;

      // Tactical Maneuver State Execution
      if (this.isInEmergencyPitLap || (needsPit && (this.currentSector === 4 || myZ < -85.0))) {
        this.raceState = 'IN_LAP_EMERGENCY';
        this.targetLateralOffset = 2.0;
      } else if (overtakeDecision.shouldOvertake) {
        this.targetLateralOffset = THREE.MathUtils.clamp(overtakeDecision.targetOffset, -maxSafeLateral, maxSafeLateral);
        this.isOvertaking = true;
        this.overtakeTimer = 1.6;
        this.raceState = overtakeDecision.canSwitchback ? 'SWITCHBACK' : 'ATTACKING';
      } else if (overtakeDecision.defendThreat) {
        this.targetLateralOffset = THREE.MathUtils.clamp(overtakeDecision.targetOffset, -maxSafeLateral, maxSafeLateral);
        this.raceState = 'DEFENDING';
        this.defenseTimer = 1.0;
      } else if (radar.center.hit && radar.center.distance > 14.0 && radar.center.distance < 40.0 && !isApproachingCornerZone) {
        // Slipstream Tow Suction Mode: lock into low-pressure pocket behind car ahead
        this.targetLateralOffset = THREE.MathUtils.clamp(playerRelLateral, -maxSafeLateral, maxSafeLateral);
        this.raceState = 'ATTACKING';
      } else if (this.overtakeTimer > 0) {
        this.overtakeTimer -= 0.040;
        if (this.overtakeTimer <= 0) {
          this.isOvertaking = false;
          this.targetLateralOffset = baseOffset;
          this.raceState = 'RACING';
        }
      } else {
        this.targetLateralOffset = baseOffset;
        this.raceState = 'RACING';
      }

      // Apply continuous Artificial Potential Field (APF) elastic lateral repulsion
      this.targetLateralOffset = THREE.MathUtils.clamp(
        this.radar.computeRepulsionOffset(this.targetLateralOffset, availLeft, availRight),
        -maxSafeLateral,
        maxSafeLateral
      );

      // Active Slipstream Bonus
      this.slipstreamActive = false;
      if (radar.center.hit && radar.center.distance < 38.0 && mySpeed > 26.0 && !overtakeDecision.isSideBySide) {
        this.slipstreamActive = true;
      }
    }

    const maxSafeLateral = 2.2;
    // Smooth lateral transition
    const lateralShiftSpeed = 4.5 * this.aggression;
    this.lateralOffset += (this.targetLateralOffset - this.lateralOffset) * Math.min(1.0, lateralShiftSpeed * dt);
    this.lateralOffset = THREE.MathUtils.clamp(this.lateralOffset, -maxSafeLateral, maxSafeLateral);

    // Target destination world coordinates
    const destX = targetPt.x + normX * this.lateralOffset;
    const destZ = targetPt.z + normZ * this.lateralOffset;

    // 6 & 7. Steering and Predictive Strategic Speed Control (Tiered at 60 Hz)
    this.controlTimer -= dt;
    this.strategyTimer -= dt;

    if (this.strategyTimer <= 0) {
      this.strategyTimer = 0.080; // 12.5 Hz strategic horizon scanning

      const diffSpeedScale = {
        easy: 0.92,
        medium: 0.98,
        hard: 1.01,
      }[this.difficulty];

      const compoundConfig = TIRE_COMPOUNDS[this.currentCompound] || TIRE_COMPOUNDS.soft;
      const wearP = Math.min(0.30, (this.physics.tireWear[0] / 100) * 0.30);
      const gripFactor = compoundConfig.gripMultiplier * (1.0 - wearP);
      const engineHealthFactor = Math.pow(Math.max(0.1, this.physics.damage.engineHealth / 100), 0.35);
      const emergencyHealthFactor = this.isInEmergencyPitLap ? 0.65 : 1.0;
      const slipstreamBonus = this.slipstreamActive ? 1.08 : 1.0;

      // Realistic Deceleration Capacity Model
      const baseDecel = 17.5 * gripFactor * this.brakeSkill;
      const aeroDecel = (0.00035 * mySpeed * mySpeed) * baseDecel + (0.00025 * mySpeed * mySpeed);
      let brakeDecel = baseDecel + aeroDecel;

      // Current waypoint target speed
      const baseWaypointLimit = this.waypoints[closestIdx].speedLimitKmh;
      let minAllowedSpeedMs = (baseWaypointLimit / 3.6) * diffSpeedScale * gripFactor * engineHealthFactor * slipstreamBonus * emergencyHealthFactor;

      // Scan ahead up to 280 meters along track from current car position (45 steps)
      let scanDist = 0;
      let scanIdx = closestIdx;
      const maxScanDist = 280.0;

      for (let s = 1; s <= 45; s++) {
        const nextScanIdx = (scanIdx + 1) % numPts;
        const sp1 = this.waypoints[scanIdx];
        const sp2 = this.waypoints[nextScanIdx];
        const stepLen = Math.hypot(sp2.x - sp1.x, sp2.z - sp1.z);
        scanDist += stepLen;
        scanIdx = nextScanIdx;

        if (scanDist > maxScanDist) break;

        const futureTargetMs = (sp2.speedLimitKmh / 3.6) * diffSpeedScale * gripFactor * engineHealthFactor * emergencyHealthFactor;
        const allowedSpeedMs = Math.sqrt(futureTargetMs * futureTargetMs + 2.0 * brakeDecel * scanDist);
        if (allowedSpeedMs < minAllowedSpeedMs) {
          minAllowedSpeedMs = allowedSpeedMs;
        }
      }

      this.cachedTargetSpeedMs = minAllowedSpeedMs;

      // Official F1 DRS Zone & Detection Point Evaluation
      let inAnyDrsZone = false;
      const trackDist = (closestIdx / numPts) * this.totalTrackLength;

      if (this.activeCircuit?.drsZones && this.activeCircuit.drsZones.length > 0 && isRaceActive && !isControlsLocked) {
        for (let z = 0; z < this.activeCircuit.drsZones.length; z++) {
          const zone = this.activeCircuit.drsZones[z];
          let inZone = false;
          if (zone.startDistance <= zone.endDistance) {
            inZone = trackDist >= zone.startDistance && trackDist <= zone.endDistance;
          } else {
            inZone = trackDist >= zone.startDistance || trackDist <= zone.endDistance;
          }

          if (inZone) {
            inAnyDrsZone = true;
            this.isDrsZoneActive = true;
            break;
          }
        }
      }

      if (!inAnyDrsZone) {
        this.isDrsZoneActive = false;
        this.physics.isDrsOpen = false;
      } else if (
        !this.isInPitLane &&
        !this.physics.damage.drsFlapBroken &&
        !this.physics.isDamageLimiterActive &&
        mySpeedKmh > 120
      ) {
        this.physics.isDrsOpen = true;
      } else {
        this.physics.isDrsOpen = false;
      }
    }

    let throttleInput = this.currentInputs.throttle;
    let brakeInput = this.currentInputs.brake;
    let steeringInput = this.currentInputs.steering;

    if (this.controlTimer <= 0) {
      this.controlTimer = 0.0166; // 60 Hz Pure Pursuit & control input integration

      // Pure Pursuit Steering Controller
      const frontAxleOffset = 1.35;
      const frontX = myX + Math.sin(this.physics.yaw) * frontAxleOffset;
      const frontZ = myZ + Math.cos(this.physics.yaw) * frontAxleOffset;

      const toDestX = destX - frontX;
      const toDestZ = destZ - frontZ;
      const distToTarget = Math.hypot(toDestX, toDestZ) || 1.0;
      const targetHeading = Math.atan2(toDestX, toDestZ);

      let headingError = targetHeading - this.physics.yaw;
      while (headingError > Math.PI) headingError -= Math.PI * 2;
      while (headingError < -Math.PI) headingError += Math.PI * 2;

      const ppSteerAngle = Math.atan2(2.0 * this.physics.wheelbase * Math.sin(headingError), distToTarget);
      const speedNorm = Math.min(1.0, mySpeedKmh / 280);
      const maxLock = THREE.MathUtils.lerp(0.52, 0.145, Math.pow(speedNorm, 0.65));

      let counterSteerCorrection = 0;
      const rearSlip = this.physics.slipAngleRear || 0;
      if (Math.abs(rearSlip) > 0.08 || Math.abs(this.physics.angularVelocity) > 1.2) {
        counterSteerCorrection = -0.28 * this.physics.angularVelocity - 0.35 * rearSlip;
      }

      const rawSteeringDemand = (ppSteerAngle / maxLock) - (this.physics.angularVelocity * 0.08) + counterSteerCorrection;
      steeringInput = THREE.MathUtils.clamp(rawSteeringDemand, -1.0, 1.0);

      // Speed & Longitudinal Inputs
      const targetSpeedMs = this.cachedTargetSpeedMs;
      throttleInput = 0;
      brakeInput = 0;

      if (mySpeed > targetSpeedMs + 0.8) {
        const excessSpeed = mySpeed - targetSpeedMs;
        throttleInput = 0.0;
        brakeInput = THREE.MathUtils.clamp(excessSpeed / 2.5, 0.45, 1.0);
      } else if (mySpeed > targetSpeedMs - 0.5) {
        throttleInput = THREE.MathUtils.clamp((targetSpeedMs / (mySpeed + 0.1)) * 0.45, 0.20, 0.55);
        brakeInput = 0.0;
      } else {
        const deficit = targetSpeedMs - mySpeed;
        throttleInput = THREE.MathUtils.clamp(0.70 + (deficit / 2.0) * 0.30, 0.70, 1.0);
        brakeInput = 0.0;
      }

      if (brakeInput > 0.05) {
        const steerLockRatio = THREE.MathUtils.clamp(Math.abs(steeringInput), 0, 1);
        const trailMultiplier = 1.0 - (0.45 * this.trailBrakeAbility * steerLockRatio);
        brakeInput *= THREE.MathUtils.clamp(trailMultiplier, 0.35, 1.0);
      }

      if (this.isFinished) {
        throttleInput = 0;
        brakeInput = 0.6;
      }

      this.currentInputs.throttle = throttleInput;
      this.currentInputs.brake = brakeInput;
      this.currentInputs.steering = steeringInput;
      this.currentInputs.drs = this.physics.isDrsOpen;
    }

    // 11. Stuck / Collision Detection & Autonomous Recovery Trigger
    if (isRaceActive && !isControlsLocked && !this.isInPitLane) {
      if (this.speedKmh < 4.0 && throttleInput > 0.35) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.0) {
          this.recoveryPhase = 'reverse';
          this.recoveryTimer = 1.5;
        }
      } else {
        this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2.5);
      }
    }

    // 12. Step Real Physics Engine for this AI Car (120 Hz deterministic physics integration)
    this.currentInputs.throttle = throttleInput;
    this.currentInputs.brake = brakeInput;
    this.currentInputs.steering = steeringInput;
    this.currentInputs.drs = this.physics.isDrsOpen;

    this.physics.update(dt, this.currentInputs);

    // Synchronize world coordinates
    this.position.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);

    // 12. Distance Along Track & Lap Timing
    if (this.activeCircuit?.checkSectorProgress) {
      const res = this.activeCircuit.checkSectorProgress(myX, myZ, this.currentSector);
      if (res.lapCompleted) {
        this.lastLapTime = this.currentLapTime;
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
        }
        this.currentLap++;
        this.currentLapTime = 0;
        this.currentSector = 0;
      } else {
        this.currentSector = res.newSector;
      }
    } else {
      if (this.currentSector === 0 && myX > 40 && myZ < -50) this.currentSector = 1;
      else if (this.currentSector === 1 && myX > 50 && myZ > 40) this.currentSector = 2;
      else if (this.currentSector === 2 && myX < -40 && myZ > 50) this.currentSector = 3;
      else if (this.currentSector === 3 && myX < -50 && myZ < -40) this.currentSector = 4;
      else if (this.currentSector === 4 && myZ < -115 && myX >= -20 && myX <= 20) {
        this.lastLapTime = this.currentLapTime;
        if (!this.bestLapTime || this.currentLapTime < this.bestLapTime) {
          this.bestLapTime = this.currentLapTime;
        }
        this.currentLap++;
        this.currentLapTime = 0;
        this.currentSector = 0;
      }
    }

    this.currentLapTime += dt;
    this.totalRaceTime += dt;

    const p1 = this.waypoints[closestIdx];
    const p2 = this.waypoints[(closestIdx + 1) % numPts];
    const segDx = p2.x - p1.x;
    const segDz = p2.z - p1.z;
    const segLenSq = segDx * segDx + segDz * segDz;
    let segT = 0;
    if (segLenSq > 0.0001) {
      segT = THREE.MathUtils.clamp(((myX - p1.x) * segDx + (myZ - p1.z) * segDz) / segLenSq, 0, 1);
    }
    const baseDist = p1.accumulatedDistance ?? ((closestIdx / numPts) * this.totalTrackLength);
    const segLen = p1.segmentLength ?? (Math.hypot(segDx, segDz) || (this.totalTrackLength / numPts));
    this.distanceAlongTrack = (baseDist + segT * segLen) % this.totalTrackLength;
    this.trackProgressNormalized = this.distanceAlongTrack / this.totalTrackLength;
  }

  /**
   * Smooth pit entry transition approach
   * Prevents teleports and sudden snaps by progressively braking down to 60 km/h
   * and smoothly guiding the vehicle from track edge into Fast Lane at Z = -119.0.
   */
  private updatePitEntryTransition(dt: number): boolean {
    const pz = this.activeCircuit?.pitZone || { minX: -65.0, maxX: 45.0, minZ: -120.0, maxZ: -106.0 };
    const pitSpeedMs = 60.0 / 3.6;
    const fastLaneZ = -119.0;

    // Smooth braking deceleration towards pit limiter speed
    this.physics.speed = THREE.MathUtils.damp(this.physics.speed, pitSpeedMs, 4.0, dt);
    // Smooth lateral alignment towards fast lane
    this.physics.position.z = THREE.MathUtils.damp(this.physics.position.z, fastLaneZ, 4.8, dt);
    // Smooth yaw alignment
    const targetYaw = getNearestAngle(this.physics.yaw, Math.PI / 2);
    this.physics.yaw += (targetYaw - this.physics.yaw) * Math.min(1.0, 6.0 * dt);

    this.physics.position.x += this.physics.speed * dt;
    this.position.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);

    const rotSpeed = this.physics.speed / (2.05 / (2 * Math.PI));
    for (let w = 0; w < 4; w++) this.physics.wheelRotations[w] += rotSpeed * dt;
    this.currentInputs.brake = 0.35;
    this.currentInputs.throttle = 0.15;
    this.currentInputs.steering = 0;

    // Handover to main pit lane sequence once entering the gantry area
    if (this.physics.position.x >= pz.minX + 8.0) {
      this.isEnteringPitTransition = false;
      this.isInPitLane = true;
      this.isStationaryInBox = false;
      this.hasServicedInBox = false;
      this.pitTimer = 0;
      this.plannedPitLaps = this.plannedPitLaps.filter((l) => l !== this.currentLap);
      this.isInEmergencyPitLap = false;
    }

    return true;
  }

  /**
   * Dedicated Pit Lane Trajectory & Complete Emergency Mechanical Pit Stop Service
   * Moves along Fast Lane at Z = -119.0, peels off into team's dedicated pit box at Z = -110.5,
   * repairs 100% of damage, replaces tires, and launches back into the race.
   */
  private updatePitLane(dt: number, particles: ParticleSystem): void {
    const stallX = this.team.pitStallX;
    const fastLaneZ = -119.0;
    const pitBoxZ = -110.5;
    const pitSpeedMs = 60.0 / 3.6; // 60 km/h pit limiter
    const peelOffStartX = stallX - 12.0;

    if (!this.isStationaryInBox) {
      if (!this.hasServicedInBox) {
        // Phase 1: Fast Lane Cruise and Smooth S-Curve Peel-off
        this.physics.speed = pitSpeedMs;
        this.physics.position.x += this.physics.speed * dt;

        if (this.physics.position.x < peelOffStartX) {
          this.physics.position.z = THREE.MathUtils.damp(this.physics.position.z, fastLaneZ, 5.0, dt);
          const targetYaw = getNearestAngle(this.physics.yaw, Math.PI / 2);
          this.physics.yaw += (targetYaw - this.physics.yaw) * Math.min(1.0, 6.0 * dt);
        } else {
          const progress = Math.max(0, Math.min(1.0, (this.physics.position.x - peelOffStartX) / 12.0));
          const smoothS = progress * progress * (3 - 2 * progress);
          this.physics.position.z = THREE.MathUtils.lerp(fastLaneZ, pitBoxZ, smoothS);

          const steerOffset = Math.sin(progress * Math.PI) * 0.20;
          const targetYaw = getNearestAngle(this.physics.yaw, (Math.PI / 2) - steerOffset);
          this.physics.yaw += (targetYaw - this.physics.yaw) * Math.min(1.0, 7.0 * dt);
        }

        // Arrived at team's specific pit box
        if (Math.abs(this.physics.position.x - stallX) < 1.0 || (this.physics.position.x >= stallX && this.physics.position.x < stallX + 2.5)) {
          this.physics.position.x = stallX;
          this.physics.position.z = pitBoxZ;
          this.physics.yaw = Math.PI / 2;
          this.physics.speed = 0;
          this.isStationaryInBox = true;
          this.pitTimer = 0;
        }
      } else {
        // Phase 2: Post-service launch and S-curve merge back into Fast Lane
        this.physics.speed = pitSpeedMs;
        this.physics.position.x += this.physics.speed * dt;

        const mergeEndX = stallX + 12.0;
        if (this.physics.position.x < mergeEndX) {
          const exitProg = Math.max(0, Math.min(1.0, (this.physics.position.x - stallX) / 12.0));
          const smoothExit = exitProg * exitProg * (3 - 2 * exitProg);
          this.physics.position.z = THREE.MathUtils.lerp(pitBoxZ, fastLaneZ, smoothExit);

          const steerExitYaw = getNearestAngle(this.physics.yaw, (Math.PI / 2) + Math.sin(exitProg * Math.PI) * 0.16);
          this.physics.yaw += (steerExitYaw - this.physics.yaw) * Math.min(1.0, 7.0 * dt);
        } else {
          this.physics.position.z = THREE.MathUtils.damp(this.physics.position.z, fastLaneZ, 5.0, dt);
          const targetYaw = getNearestAngle(this.physics.yaw, Math.PI / 2);
          this.physics.yaw += (targetYaw - this.physics.yaw) * Math.min(1.0, 6.0 * dt);
        }

        // Pit exit transition back onto the main straight
        if (this.physics.position.x > 38.0) {
          this.physics.position.z += (-128.0 - this.physics.position.z) * Math.min(1.0, 3.5 * dt);
        }

        if (this.physics.position.x >= 48.0) {
          // Rejoin main track smoothly at racing speed
          this.isInPitLane = false;
          this.hasServicedInBox = false;
          this.physics.speed = 120.0 / 3.6;
          this.lastClosestIdx = 0;
          particles.emitTireSmoke(this.position, 4, 0.75);
        }
      }
    } else {
      // Stationary in box getting serviced by pit crew
      this.physics.speed = 0;
      this.physics.position.x = stallX;
      this.physics.position.z = pitBoxZ;
      this.physics.yaw = Math.PI / 2;
      this.pitTimer += dt;
      this.pitProgress = Math.min(1.0, this.pitTimer / this.pitDuration);

      // Midway through stop: Full vehicle repair (bodywork, wings, engine, suspension, tires)
      if (this.pitTimer >= this.pitDuration * 0.5 && !this.hasServicedInBox) {
        if (this.currentCompound !== this.nextPitCompound) {
          this.currentCompound = this.nextPitCompound;
        } else {
          this.currentCompound = this.currentCompound === 'soft' ? 'medium' : 'soft';
        }
        this.compoundsUsed.add(this.currentCompound);
        this.carModel.setTireCompoundVisuals(this.currentCompound);
        this.physics.setTireCompound(this.currentCompound);
        this.physics.repairFull();
        this.carModel.repairWingVisuals();
        this.isInEmergencyPitLap = false;
      }

      if (this.pitTimer >= this.pitDuration) {
        this.isStationaryInBox = false;
        this.hasServicedInBox = true;
        this.pitStopsCount++;
      }
    }

    this.position.set(this.physics.position.x, this.physics.position.y, this.physics.position.z);
    this.currentInputs.brake = this.isStationaryInBox ? 0 : 0.45;
    this.currentInputs.throttle = 0;
    this.currentInputs.steering = 0;
  }

  /**
   * Exports live data for F1 leaderboard
   */
  public getLeaderboardData(position: number, leaderScore: number): DriverLeaderboardEntry {
    const avgWear = (this.physics.tireWear[0] + this.physics.tireWear[1] + this.physics.tireWear[2] + this.physics.tireWear[3]) / 4;
    const myScore = (this.currentLap - 1) * this.totalTrackLength + this.distanceAlongTrack;
    const scoreDelta = Math.max(0, leaderScore - myScore);
    const gapSeconds = scoreDelta / CIRCUIT_RACE_PACE_SPEED;
    const lapsBehind = Math.floor(scoreDelta / this.totalTrackLength);

    const gapFormatted = position === 1 ? 'LÍDER' : lapsBehind >= 1 ? `+${lapsBehind} ${lapsBehind === 1 ? 'VTA' : 'VTAS'}` : formatF1TimeGap(gapSeconds);

    return {
      id: this.team.id,
      position,
      driverCode: this.team.driverCode,
      driverName: this.team.driverName,
      driverNumber: this.team.driverNumber,
      teamName: this.team.teamName,
      teamColorCss: this.team.teamColorCss,
      currentLap: this.currentLap,
      currentSector: this.currentSector,
      currentCompound: this.currentCompound,
      compoundsUsed: Array.from(this.compoundsUsed),
      hasSatisfiedTireRule: this.compoundsUsed.size >= 2,
      tireWearAvg: avgWear,
      pitStopsCount: this.pitStopsCount,
      isInPit: this.isInPitLane,
      gapToLeaderFormatted: gapFormatted,
      gapToAheadFormatted: position === 1 ? '-' : formatF1TimeGap(gapSeconds * 0.5),
      lastLapTime: this.lastLapTime,
      bestLapTime: this.bestLapTime,
      currentLapTime: this.currentLapTime,
      totalRaceTime: this.totalRaceTime,
      isPlayer: false,
      isFinished: this.isFinished,
      hasPenalty: false,
      penaltySeconds: 0,
    };
  }

  /**
   * Synchronizes 3D mesh transforms and dynamic visuals once per render frame with sub-frame interpolation
   */
  public syncVisuals(dt: number, alpha: number = 1.0): void {
    const clampedAlpha = THREE.MathUtils.clamp(alpha, 0, 1);
    const prevPos = this.physics.prevPosition;
    const curPos = this.physics.position;

    const x = THREE.MathUtils.lerp(prevPos.x, curPos.x, clampedAlpha);
    const y = THREE.MathUtils.lerp(prevPos.y, curPos.y, clampedAlpha);
    const z = THREE.MathUtils.lerp(prevPos.z, curPos.z, clampedAlpha);

    let yawDiff = this.physics.yaw - this.physics.prevYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const yaw = this.physics.prevYaw + yawDiff * clampedAlpha;

    const roll = THREE.MathUtils.lerp(this.physics.prevRoll, this.physics.roll, clampedAlpha);

    this.position.set(x, y, z);
    this.carModel.group.position.set(x, y, z);
    this.carModel.group.rotation.set(0, yaw, roll);

    const speedKmh = Math.abs(this.physics.speed) * 3.6;
    this.carModel.setDRS(this.physics.isDrsOpen, dt, speedKmh);
    this.carModel.update(
      this.physics.visualSteerAngle,
      this.physics.wheelRotations,
      this.currentInputs.brake,
      speedKmh,
      this.physics.damage,
      this.physics.isShifting,
      this.physics.rpm,
      this.physics.wheelSuspensionCompression,
      this.physics.isPunctured,
      this.physics.tireWear,
      dt,
      this.currentInputs.throttle
    );
  }
}
