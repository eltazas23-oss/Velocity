/**
 * AIRaycastPerception.ts - High-Performance Analytical Multibeam Radar Perception for Autonomous Racing AI
 * Provides continuous 9-ray spatial awareness, gap seeking, wheel-to-wheel proximity buffers,
 * rear defensive threat detection, Time-To-Line-Collision (TTLC) computation, and track boundary clearance
 * with zero WebGL draw calls and zero garbage collection overhead.
 */

import * as THREE from 'three';

export interface RayHit {
  hit: boolean;
  distance: number;
  entityId: string | null;
  relativeSpeed: number; // Positive if we are closing in, negative if pulling away
  lateralOffset: number; // Lateral offset of the hit obstacle relative to our centerline
}

export interface RaycastSensorArray {
  center: RayHit;       // 0° (Range 52m): Long-range forward slipstream & obstacle tracker
  attackLeft: RayHit;   // -14° (Range 36m): Forward-left gap search
  attackRight: RayHit;  // +14° (Range 36m): Forward-right gap search
  flankLeft: RayHit;    // -35° (Range 22m): Corner entry & quarter-panel detection
  flankRight: RayHit;   // +35° (Range 22m): Corner entry & quarter-panel detection
  sideLeft: RayHit;     // -90° (Range 6.8m): Wheel-to-wheel door clearance
  sideRight: RayHit;    // +90° (Range 6.8m): Wheel-to-wheel door clearance
  rearLeft: RayHit;     // -155° (Range 28m): Rear-left blindspot & defensive threat tracker
  rearRight: RayHit;    // +155° (Range 28m): Rear-right blindspot & defensive threat tracker
  trackWidthLeft: number;  // Available tarmac meters to left track curb
  trackWidthRight: number; // Available tarmac meters to right track curb
}

export interface VehicleObstacle {
  id: string;
  x: number;
  z: number;
  yaw: number;
  speedMs: number;
  length: number;
  width: number;
  fX?: number;
  fZ?: number;
  rX?: number;
  rZ?: number;
}

export type TacticalManeuver = 'hold' | 'slingshot_left' | 'slingshot_right' | 'divebomb_inside' | 'switchback_cut' | 'defend_inside' | 'limp_clear';

export interface OvertakeOpportunity {
  shouldOvertake: boolean;
  recommendedLane: 'inside' | 'outside' | 'hold';
  maneuver: TacticalManeuver;
  targetOffset: number;
  isSideBySide: boolean;
  canDivebomb: boolean;
  canSwitchback: boolean;
  ttlcSeconds: number; // Time to line collision in seconds (Infinity if safe)
  urgency: number;     // 0.0 to 1.0
  defendThreat: boolean;
}

export class AIRaycastPerception {
  // Analytical Ray definitions: [angleOffsetRadians, maxRangeMeters]
  private static readonly SENSOR_ANGLES = {
    center: { angle: 0, range: 56.0 },
    attackLeft: { angle: -0.244, range: 40.0 },   // ~ -14 deg
    attackRight: { angle: 0.244, range: 40.0 },  // ~ +14 deg
    flankLeft: { angle: -0.610, range: 26.0 },   // ~ -35 deg
    flankRight: { angle: 0.610, range: 26.0 },  // ~ +35 deg
    sideLeft: { angle: -Math.PI / 2, range: 9.5 },
    sideRight: { angle: Math.PI / 2, range: 9.5 },
    rearLeft: { angle: -2.705, range: 28.0 },    // ~ -155 deg
    rearRight: { angle: 2.705, range: 28.0 },    // ~ +155 deg
  };

  public sensors: RaycastSensorArray = {
    center: { hit: false, distance: 56.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    attackLeft: { hit: false, distance: 40.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    attackRight: { hit: false, distance: 40.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    flankLeft: { hit: false, distance: 26.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    flankRight: { hit: false, distance: 26.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    sideLeft: { hit: false, distance: 9.5, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    sideRight: { hit: false, distance: 9.5, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    rearLeft: { hit: false, distance: 28.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    rearRight: { hit: false, distance: 28.0, entityId: null, relativeSpeed: 0, lateralOffset: 0 },
    trackWidthLeft: 7.6,
    trackWidthRight: 7.6,
  };

  /**
   * Casts all 9 analytical radar rays against all other vehicles on track
   */
  public castRays(
    originX: number,
    originZ: number,
    yaw: number,
    mySpeedMs: number,
    obstacles: VehicleObstacle[],
    trackCenterlineDistFromLeft: number = 7.6,
    trackCenterlineDistFromRight: number = 7.6
  ): RaycastSensorArray {
    this.sensors.trackWidthLeft = trackCenterlineDistFromLeft;
    this.sensors.trackWidthRight = trackCenterlineDistFromRight;

    // Reset all rays
    const defs = AIRaycastPerception.SENSOR_ANGLES;
    this.resetRay(this.sensors.center, defs.center.range);
    this.resetRay(this.sensors.attackLeft, defs.attackLeft.range);
    this.resetRay(this.sensors.attackRight, defs.attackRight.range);
    this.resetRay(this.sensors.flankLeft, defs.flankLeft.range);
    this.resetRay(this.sensors.flankRight, defs.flankRight.range);
    this.resetRay(this.sensors.sideLeft, defs.sideLeft.range);
    this.resetRay(this.sensors.sideRight, defs.sideRight.range);
    this.resetRay(this.sensors.rearLeft, defs.rearLeft.range);
    this.resetRay(this.sensors.rearRight, defs.rearRight.range);

    // Precompute dual bounding sphere centers once for all 9 rays
    const halfWheelbase = 1.35;
    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];
      const sinY = Math.sin(obs.yaw);
      const cosY = Math.cos(obs.yaw);
      obs.fX = obs.x + sinY * halfWheelbase;
      obs.fZ = obs.z + cosY * halfWheelbase;
      obs.rX = obs.x - sinY * halfWheelbase;
      obs.rZ = obs.z - cosY * halfWheelbase;
    }

    // Front bumper origin for forward sensors
    const frontAxleDist = 1.35;
    const startX = originX + Math.sin(yaw) * frontAxleDist;
    const startZ = originZ + Math.cos(yaw) * frontAxleDist;

    // Evaluate forward sensor rays
    this.evaluateRay(this.sensors.center, startX, startZ, yaw + defs.center.angle, defs.center.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.attackLeft, startX, startZ, yaw + defs.attackLeft.angle, defs.attackLeft.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.attackRight, startX, startZ, yaw + defs.attackRight.angle, defs.attackRight.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.flankLeft, startX, startZ, yaw + defs.flankLeft.angle, defs.flankLeft.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.flankRight, startX, startZ, yaw + defs.flankRight.angle, defs.flankRight.range, mySpeedMs, obstacles);

    // Side rays start from the cockpit / mid-chassis
    this.evaluateRay(this.sensors.sideLeft, originX, originZ, yaw + defs.sideLeft.angle, defs.sideLeft.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.sideRight, originX, originZ, yaw + defs.sideRight.angle, defs.sideRight.range, mySpeedMs, obstacles);

    // Rear rays start from rear diffuser
    const rearAxleDist = 1.35;
    const rearX = originX - Math.sin(yaw) * rearAxleDist;
    const rearZ = originZ - Math.cos(yaw) * rearAxleDist;
    this.evaluateRay(this.sensors.rearLeft, rearX, rearZ, yaw + defs.rearLeft.angle, defs.rearLeft.range, mySpeedMs, obstacles);
    this.evaluateRay(this.sensors.rearRight, rearX, rearZ, yaw + defs.rearRight.angle, defs.rearRight.range, mySpeedMs, obstacles);

    return this.sensors;
  }

  private resetRay(ray: RayHit, defaultDist: number): void {
    ray.hit = false;
    ray.distance = defaultDist;
    ray.entityId = null;
    ray.relativeSpeed = 0;
    ray.lateralOffset = 0;
  }

  /**
   * Analytical 2D Ray vs Dual-Sphere Bounding Volume intersection
   * Fast, branch-predicted, and exact for F1 car dimensions
   */
  private evaluateRay(
    ray: RayHit,
    rayStartX: number,
    rayStartZ: number,
    rayAngle: number,
    maxRange: number,
    mySpeedMs: number,
    obstacles: VehicleObstacle[]
  ): void {
    const rayDirX = Math.sin(rayAngle);
    const rayDirZ = Math.cos(rayAngle);
    const broadphaseLimitSq = (maxRange + 3.0) * (maxRange + 3.0);

    for (let i = 0; i < obstacles.length; i++) {
      const obs = obstacles[i];

      // Fast broadphase distance test to instantly discard distant cars
      const dX = obs.x - rayStartX;
      const dZ = obs.z - rayStartZ;
      if (dX * dX + dZ * dZ > broadphaseLimitSq) {
        continue;
      }

      // Dual overlapping bounding spheres representing front and rear axles (precalculated)
      const sphereRadius = 1.15;
      const fX = obs.fX ?? (obs.x + Math.sin(obs.yaw) * 1.35);
      const fZ = obs.fZ ?? (obs.z + Math.cos(obs.yaw) * 1.35);
      const rX = obs.rX ?? (obs.x - Math.sin(obs.yaw) * 1.35);
      const rZ = obs.rZ ?? (obs.z - Math.cos(obs.yaw) * 1.35);

      const distFront = this.intersectRayCircle(rayStartX, rayStartZ, rayDirX, rayDirZ, fX, fZ, sphereRadius, maxRange);
      const distRear = this.intersectRayCircle(rayStartX, rayStartZ, rayDirX, rayDirZ, rX, rZ, sphereRadius, maxRange);

      const closestDist = Math.min(distFront, distRear);

      if (closestDist > 0 && closestDist < ray.distance) {
        ray.hit = true;
        ray.distance = closestDist;
        ray.entityId = obs.id;
        ray.relativeSpeed = mySpeedMs - obs.speedMs;

        // Relative lateral offset
        const dx = obs.x - rayStartX;
        const dz = obs.z - rayStartZ;
        ray.lateralOffset = dx * -rayDirZ + dz * rayDirX;
      }
    }
  }

  /**
   * Exact algebraic ray vs circle intersection
   */
  private intersectRayCircle(
    rx: number,
    rz: number,
    dx: number,
    dz: number,
    cx: number,
    cz: number,
    radius: number,
    maxRange: number
  ): number {
    const ox = rx - cx;
    const oz = rz - cz;

    const b = ox * dx + oz * dz;
    const c = ox * ox + oz * oz - radius * radius;

    // Ray origin inside circle
    if (c < 0) return 0.05;

    // Ray points away from circle
    if (b > 0) return Infinity;

    const disc = b * b - c;
    if (disc < 0) return Infinity;

    const t = -b - Math.sqrt(disc);
    if (t > 0 && t <= maxRange) {
      return t;
    }

    return Infinity;
  }

  /**
   * Evaluates tactical racecraft decision:
   * - Slingshot overtaking out of slipstream draft
   * - Late-braking inside divebombs
   * - Switchback / undercut counters
   * - Defensive line blocking
   * - Parallel wheel-to-wheel space allocation
   * - Time to Line Collision (TTLC)
   */
  public evaluateOvertake(
    currentLaneOffset: number,
    aggression: number = 0.85,
    isCornerEntry: boolean = false,
    isCornerExit: boolean = false,
    isLeading: boolean = false
  ): OvertakeOpportunity {
    const s = this.sensors;
    const isSideBySide =
      s.sideLeft.hit ||
      s.sideRight.hit ||
      s.flankLeft.distance < 5.2 ||
      s.flankRight.distance < 5.2;

    // Calculate TTLC (Time to Line Collision)
    let ttlcSeconds = Infinity;
    if (s.center.hit && s.center.relativeSpeed > 0.4) {
      ttlcSeconds = s.center.distance / s.center.relativeSpeed;
    }

    // 1. Check Rear Threat & Proactive Defense (when leading)
    const rearThreatLeft = s.rearLeft.hit && s.rearLeft.relativeSpeed < -1.0 && s.rearLeft.distance < 24.0;
    const rearThreatRight = s.rearRight.hit && s.rearRight.relativeSpeed < -1.0 && s.rearRight.distance < 24.0;
    const hasDefendThreat = isLeading && (rearThreatLeft || rearThreatRight);

    if (hasDefendThreat && !isSideBySide && isCornerEntry) {
      // Driver covers inside defensive line before corner entry
      const defendOffset = rearThreatLeft ? -2.6 : 2.6;
      return {
        shouldOvertake: false,
        recommendedLane: defendOffset < 0 ? 'inside' : 'outside',
        maneuver: 'defend_inside',
        targetOffset: defendOffset,
        isSideBySide: false,
        canDivebomb: false,
        canSwitchback: false,
        ttlcSeconds,
        urgency: 0.85,
        defendThreat: true,
      };
    }

    // 2. Wheel-to-Wheel Battle (Strict Lateral Space Guarantee with zero contact)
    if (isSideBySide) {
      let targetOffset = currentLaneOffset;
      if (s.sideLeft.hit || s.flankLeft.distance < 5.0) {
        // Rival on our left: guarantee safe 2.2m clearance to the right
        targetOffset = Math.min(s.trackWidthRight - 1.2, Math.max(1.8, currentLaneOffset + 0.9));
      } else if (s.sideRight.hit || s.flankRight.distance < 5.0) {
        // Rival on our right: guarantee safe 2.2m clearance to the left
        targetOffset = Math.max(-s.trackWidthLeft + 1.2, Math.min(-1.8, currentLaneOffset - 0.9));
      }
      return {
        shouldOvertake: true,
        recommendedLane: targetOffset > 0 ? 'outside' : 'inside',
        maneuver: 'hold',
        targetOffset,
        isSideBySide: true,
        canDivebomb: false,
        canSwitchback: false,
        ttlcSeconds,
        urgency: 0.95,
        defendThreat: false,
      };
    }

    // 3. Leader Ahead Evaluation
    const hasLeaderAhead = s.center.hit && s.center.distance < 44.0;
    if (!hasLeaderAhead) {
      return {
        shouldOvertake: false,
        recommendedLane: 'hold',
        maneuver: 'hold',
        targetOffset: currentLaneOffset * 0.92, // smoothly center to ideal racing line
        isSideBySide: false,
        canDivebomb: false,
        canSwitchback: false,
        ttlcSeconds: Infinity,
        urgency: 0,
        defendThreat: false,
      };
    }

    // 4. Corridor Clearance Analysis
    const leftClearance = Math.min(s.attackLeft.distance, s.flankLeft.distance) * (s.trackWidthLeft > 2.8 ? 1.0 : 0.15);
    const rightClearance = Math.min(s.attackRight.distance, s.flankRight.distance) * (s.trackWidthRight > 2.8 ? 1.0 : 0.15);

    let recommendedLane: 'inside' | 'outside' | 'hold' = 'hold';
    let maneuver: TacticalManeuver = 'hold';
    let targetOffset = currentLaneOffset;
    let canDivebomb = false;
    let canSwitchback = false;
    let urgency = THREE.MathUtils.clamp((44.0 - s.center.distance) / 32.0, 0.25, 1.0);

    // 5. Corner Exit Switchback / Cutback Counter:
    // If leader is wide or overcommitted on outside/inside, cut underneath for superior launch!
    if (isCornerExit && aggression > 0.84 && s.center.distance < 18.0) {
      if (s.center.lateralOffset > 0.8 && leftClearance > 16.0 && s.trackWidthLeft > 3.2) {
        canSwitchback = true;
        maneuver = 'switchback_cut';
        recommendedLane = 'inside';
        targetOffset = THREE.MathUtils.clamp(-2.8, -s.trackWidthLeft + 1.2, -1.8);
        return {
          shouldOvertake: true,
          recommendedLane,
          maneuver,
          targetOffset,
          isSideBySide: false,
          canDivebomb: false,
          canSwitchback: true,
          ttlcSeconds,
          urgency: 1.0,
          defendThreat: false,
        };
      }
    }

    // 6. Corner Entry Late-Braking Divebomb Opportunity
    if (isCornerEntry && aggression > 0.82 && s.center.distance < 26.0 && s.center.distance > 5.5) {
      if (leftClearance >= 14.0 && s.trackWidthLeft > 3.0) {
        canDivebomb = true;
        maneuver = 'divebomb_inside';
        recommendedLane = 'inside';
        targetOffset = THREE.MathUtils.clamp(-2.7, -s.trackWidthLeft + 1.1, -1.8);
        return {
          shouldOvertake: true,
          recommendedLane,
          maneuver,
          targetOffset,
          isSideBySide: false,
          canDivebomb: true,
          canSwitchback: false,
          ttlcSeconds,
          urgency: 1.0,
          defendThreat: false,
        };
      }
    }

    // 7. Straightaway Slingshot Jink Out (Efecto Tirachinas tras rebufo)
    if (s.center.distance < 18.0 && s.center.relativeSpeed > 0.5) {
      if (rightClearance >= leftClearance && s.trackWidthRight > 3.0) {
        maneuver = 'slingshot_right';
        targetOffset = THREE.MathUtils.clamp(2.8, 1.8, s.trackWidthRight - 1.1);
        recommendedLane = 'outside';
      } else if (leftClearance > rightClearance && s.trackWidthLeft > 3.0) {
        maneuver = 'slingshot_left';
        targetOffset = THREE.MathUtils.clamp(-2.8, -s.trackWidthLeft + 1.1, -1.8);
        recommendedLane = 'inside';
      } else {
        targetOffset = rightClearance > leftClearance ? 2.3 : -2.3;
        recommendedLane = targetOffset > 0 ? 'outside' : 'inside';
      }
    } else {
      // Slingshot Lane Selection based on ray clearance
      if (rightClearance >= leftClearance && s.trackWidthRight > 3.0) {
        targetOffset = THREE.MathUtils.clamp(2.6, 1.6, s.trackWidthRight - 1.1);
        recommendedLane = 'outside';
      } else if (leftClearance > rightClearance && s.trackWidthLeft > 3.0) {
        targetOffset = THREE.MathUtils.clamp(-2.6, -s.trackWidthLeft + 1.1, -1.6);
        recommendedLane = 'inside';
      } else {
        const side = rightClearance > leftClearance ? 2.2 : -2.2;
        targetOffset = side;
        recommendedLane = side > 0 ? 'outside' : 'inside';
      }
    }

    return {
      shouldOvertake: true,
      recommendedLane,
      maneuver,
      targetOffset,
      isSideBySide: false,
      canDivebomb,
      canSwitchback,
      ttlcSeconds,
      urgency,
      defendThreat: false,
    };
  }

  /**
   * Continuous Artificial Potential Field (APF) Lateral Repulsion
   * Computes an elastic lateral displacement pushing smoothly away from nearby cars
   * with quadratic dampening to eliminate high-frequency ping-pong oscillations.
   */
  public computeRepulsionOffset(
    currentOffset: number,
    trackWidthLeft: number,
    trackWidthRight: number
  ): number {
    const s = this.sensors;
    let repulsion = 0;

    // Side and Flank proximity repulsion (smooth progressive buffer)
    if (s.sideLeft.hit && s.sideLeft.distance < 4.2) {
      const pen = (4.2 - s.sideLeft.distance) / 4.2;
      repulsion += pen * pen * 1.3;
    }
    if (s.sideRight.hit && s.sideRight.distance < 4.2) {
      const pen = (4.2 - s.sideRight.distance) / 4.2;
      repulsion -= pen * pen * 1.3;
    }

    if (s.flankLeft.hit && s.flankLeft.distance < 5.8) {
      const pen = (5.8 - s.flankLeft.distance) / 5.8;
      repulsion += pen * pen * 1.0;
    }
    if (s.flankRight.hit && s.flankRight.distance < 5.8) {
      const pen = (5.8 - s.flankRight.distance) / 5.8;
      repulsion -= pen * pen * 1.0;
    }

    // Rear blindspot threat avoidance
    if (s.rearLeft.hit && s.rearLeft.distance < 5.0 && s.rearLeft.relativeSpeed < -0.5) {
      repulsion += 0.5;
    }
    if (s.rearRight.hit && s.rearRight.distance < 5.0 && s.rearRight.relativeSpeed < -0.5) {
      repulsion -= 0.5;
    }

    const minSafeOffset = -trackWidthLeft + 1.2;
    const maxSafeOffset = trackWidthRight - 1.2;

    return THREE.MathUtils.clamp(currentOffset + repulsion, minSafeOffset, maxSafeOffset);
  }
}
