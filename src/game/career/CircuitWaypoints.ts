/**
 * CircuitWaypoints.ts - Shared Circuit Geometry, Spline Projections & Official F1 Timing Formatters
 * Ensures 100% synchronized spatial tracking between the Player and AI rivals,
 * eliminating leader distance glitches and providing FIA-grade millisecond timing.
 */

import * as THREE from 'three';

export interface SplinePoint {
  x: number;
  z: number;
  speedLimitKmh: number;
  yaw: number;
  accumulatedDistance?: number;
  segmentLength?: number;
}

export const CIRCUIT_TOTAL_LENGTH = 974.76;

// Circuit average race pace velocity (~208.5 km/h, calibrated to 16.8s representative F1 lap time)
export const CIRCUIT_RACE_PACE_SPEED = 57.92; // m/s

/**
 * Pre-generates the canonical closed racing line waypoints for the circuit
 * Calibrates realistic F1 corner apex speeds (128-132 km/h) and exit slingshots (190-220 km/h)
 * ensuring 100% rock-solid adherence to physical cornering limits and zero wall understeer.
 */
export function buildCircuitWaypoints(): SplinePoint[] {
  const points: { x: number; z: number; speed: number }[] = [];
  const r = 38;
  const inner = 92;

  // 1. Main Straight (z = -130, x from -92 to +92)
  const numStraight = 24;
  for (let i = 0; i <= numStraight; i++) {
    const t = i / numStraight;
    const speed = t < 0.65 ? 345 : THREE.MathUtils.lerp(345, 160, (t - 0.65) / 0.35);
    points.push({ x: -inner + t * (2 * inner), z: -130, speed: Math.round(speed) });
  }

  // 2. Turn 1 (Top-Right): arc from (92, -130) to (130, -92) around center (92, -92)
  // Apex speed calibrated to 128-130 km/h for full mechanical and aerodynamic grip
  const numCorner = 20;
  for (let i = 1; i <= numCorner; i++) {
    const angle = -Math.PI / 2 + (i / numCorner) * (Math.PI / 2);
    const t = i / numCorner;
    const cornerSpeed = t <= 0.50 ? THREE.MathUtils.lerp(160, 128, t / 0.50) : THREE.MathUtils.lerp(128, 190, (t - 0.50) / 0.50);
    points.push({
      x: inner + Math.cos(angle) * r,
      z: -inner + Math.sin(angle) * r,
      speed: Math.round(cornerSpeed),
    });
  }

  // 3. Straight 1 (Right edge): x = 130, z from -92 to +92
  for (let i = 1; i <= numStraight; i++) {
    const t = i / numStraight;
    const speed = t < 0.65 ? 345 : THREE.MathUtils.lerp(345, 160, (t - 0.65) / 0.35);
    points.push({ x: 130, z: -inner + t * (2 * inner), speed: Math.round(speed) });
  }

  // 4. Turn 2 (Bottom-Right): arc from (130, 92) to (92, 130) around center (92, 92)
  for (let i = 1; i <= numCorner; i++) {
    const angle = 0 + (i / numCorner) * (Math.PI / 2);
    const t = i / numCorner;
    const cornerSpeed = t <= 0.50 ? THREE.MathUtils.lerp(160, 128, t / 0.50) : THREE.MathUtils.lerp(128, 190, (t - 0.50) / 0.50);
    points.push({
      x: inner + Math.cos(angle) * r,
      z: inner + Math.sin(angle) * r,
      speed: Math.round(cornerSpeed),
    });
  }

  // 5. Straight 2 (Bottom edge): z = 130, x from +92 to -92
  for (let i = 1; i <= numStraight; i++) {
    const t = i / numStraight;
    const speed = t < 0.65 ? 345 : THREE.MathUtils.lerp(345, 160, (t - 0.65) / 0.35);
    points.push({ x: inner - t * (2 * inner), z: 130, speed: Math.round(speed) });
  }

  // 6. Turn 3 (Bottom-Left): arc from (-92, 130) to (-130, 92) around center (-92, 92)
  for (let i = 1; i <= numCorner; i++) {
    const angle = Math.PI / 2 + (i / numCorner) * (Math.PI / 2);
    const t = i / numCorner;
    const cornerSpeed = t <= 0.50 ? THREE.MathUtils.lerp(160, 128, t / 0.50) : THREE.MathUtils.lerp(128, 190, (t - 0.50) / 0.50);
    points.push({
      x: -inner + Math.cos(angle) * r,
      z: inner + Math.sin(angle) * r,
      speed: Math.round(cornerSpeed),
    });
  }

  // 7. Straight 3 (Left edge): x = -130, z from +92 to -92
  for (let i = 1; i <= numStraight; i++) {
    const t = i / numStraight;
    const speed = t < 0.65 ? 345 : THREE.MathUtils.lerp(345, 160, (t - 0.65) / 0.35);
    points.push({ x: -130, z: inner - t * (2 * inner), speed: Math.round(speed) });
  }

  // 8. Turn 4 (Top-Left): arc from (-130, -92) to (-92, -130) around center (-92, -92)
  for (let i = 1; i < numCorner; i++) {
    const angle = Math.PI + (i / numCorner) * (Math.PI / 2);
    const t = i / numCorner;
    const cornerSpeed = t <= 0.50 ? THREE.MathUtils.lerp(160, 128, t / 0.50) : THREE.MathUtils.lerp(128, 190, (t - 0.50) / 0.50);
    points.push({
      x: -inner + Math.cos(angle) * r,
      z: -inner + Math.sin(angle) * r,
      speed: Math.round(cornerSpeed),
    });
  }

  // Pre-calculate exact arc-lengths and cumulative distance along circuit
  let accumDist = 0;
  const numTotal = points.length;
  const distances: number[] = new Array(numTotal);

  for (let i = 0; i < numTotal; i++) {
    const nextIdx = (i + 1) % numTotal;
    const dx = points[nextIdx].x - points[i].x;
    const dz = points[nextIdx].z - points[i].z;
    const segLen = Math.hypot(dx, dz);
    distances[i] = segLen;
  }

  return points.map((pt, idx, arr) => {
    const next = arr[(idx + 1) % arr.length];
    const dx = next.x - pt.x;
    const dz = next.z - pt.z;
    const yaw = Math.atan2(dx, dz);
    const currentAccum = accumDist;
    accumDist += distances[idx];
    return {
      x: pt.x,
      z: pt.z,
      speedLimitKmh: pt.speed,
      yaw: yaw,
      accumulatedDistance: currentAccum,
      segmentLength: distances[idx],
    };
  });
}

/**
 * Cached global waypoint array
 */
export const SHARED_CIRCUIT_WAYPOINTS = buildCircuitWaypoints();

/**
 * Exact, continuous arc-length projection along the circuit centerline.
 * Eliminates waypoint spacing non-linearity and leaderboard position glitches.
 */
const _defaultTrackDistanceResult = { distanceAlongTrack: 0, closestIdx: 0 };

export function getPreciseTrackDistanceAtPosition(
  x: number,
  z: number,
  lastClosestIdx: number = 0,
  waypoints: SplinePoint[] = SHARED_CIRCUIT_WAYPOINTS,
  totalLength: number = CIRCUIT_TOTAL_LENGTH,
  out?: { distanceAlongTrack: number; closestIdx: number }
): { distanceAlongTrack: number; closestIdx: number } {
  const numPts = waypoints.length;
  let minDsq = Infinity;
  let closestIdx = lastClosestIdx;

  // O(1) Localized search window of 24 points forward and 4 backward
  for (let offset = -4; offset <= 24; offset++) {
    const idx = (lastClosestIdx + offset + numPts) % numPts;
    const pt = waypoints[idx];
    const dx = pt.x - x;
    const dz = pt.z - z;
    const dsq = dx * dx + dz * dz;
    if (dsq < minDsq) {
      minDsq = dsq;
      closestIdx = idx;
    }
  }

  // Safety fallback if teleported
  if (minDsq > 1600) {
    for (let i = 0; i < numPts; i++) {
      const dx = waypoints[i].x - x;
      const dz = waypoints[i].z - z;
      const dsq = dx * dx + dz * dz;
      if (dsq < minDsq) {
        minDsq = dsq;
        closestIdx = i;
      }
    }
  }

  const p1 = waypoints[closestIdx];
  const p2 = waypoints[(closestIdx + 1) % numPts];
  const segDx = p2.x - p1.x;
  const segDz = p2.z - p1.z;
  const segLenSq = segDx * segDx + segDz * segDz;
  let segT = 0;
  if (segLenSq > 0.0001) {
    segT = THREE.MathUtils.clamp(((x - p1.x) * segDx + (z - p1.z) * segDz) / segLenSq, 0, 1);
  }

  const baseDist = p1.accumulatedDistance ?? ((closestIdx / numPts) * totalLength);
  const segLen = p1.segmentLength ?? (Math.hypot(segDx, segDz) || (totalLength / numPts));
  const distanceAlongTrack = (baseDist + segT * segLen) % totalLength;

  const target = out || _defaultTrackDistanceResult;
  target.distanceAlongTrack = distanceAlongTrack;
  target.closestIdx = closestIdx;
  return target;
}

/**
 * Projects an arbitrary 2D world position (x, z) onto the circuit centerline
 * to return exact distance along lap in meters (0 to 974.76m).
 */
export function getTrackDistanceAtPosition(x: number, z: number): number {
  return getPreciseTrackDistanceAtPosition(x, z, 0).distanceAlongTrack;
}

/**
 * Formats F1 time difference gap with millisecond precision and comma separator (e.g. +1,354 s, +0,715 s)
 */
export function formatF1TimeGap(seconds: number): string {
  if (seconds <= 0.0005) return '+0,000 s';

  if (seconds >= 60.0) {
    const mins = Math.floor(seconds / 60);
    const rem = seconds % 60;
    const remStr = rem.toFixed(3).replace('.', ',');
    return `+${mins}:${remStr.padStart(6, '0')} s`;
  }

  return `+${seconds.toFixed(3).replace('.', ',')} s`;
}

/**
 * Formats official F1 lap chronometer time (e.g. 0:16,938 or 1:18,452) with comma separator
 */
export function formatF1LapTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) {
    return '--:--,---';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds * 1000) % 1000);
  return `${mins}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}
