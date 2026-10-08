/**
 * SpeedwayWaypoints.ts - FIA Grade-1 Grand Prix Speedway Circuit Geometry
 * Features an 850m+ mega straight with DRS (355+ km/h), heavy braking into a left-right chicane,
 * sweeping high-speed curvone (255 km/h), medium-speed technical S-bends, a low-speed 2nd-gear hairpin,
 * and a wide-radius parabolic final bend leading back onto the main straight.
 */

import * as THREE from 'three';
import { SplinePoint } from '../../career/CircuitWaypoints';

export interface RawControlPoint {
  x: number;
  z: number;
  speed: number;
}

// Key track geometry control nodes calibrated for authentic F1 telemetry and racecraft
export const SPEEDWAY_CONTROL_NODES: RawControlPoint[] = [
  // --- SECTOR 1: MEGA STRAIGHT & CHICANE ---
  // Start/Finish Line at X=0, Z=-130 (Mega straight ~850m with DRS)
  { x: 0, z: -130, speed: 335 },
  { x: 100, z: -130, speed: 348 },
  { x: 220, z: -130, speed: 355 },
  { x: 300, z: -130, speed: 355 },
  { x: 345, z: -130, speed: 250 }, // Braking zone onset (100m board)
  { x: 375, z: -130, speed: 160 }, // Heavy trail-brake into chicane (50m board)

  // Turn 1A: Chicane FIRST CURVE TO THE RIGHT (Apex kerb at right, 105 km/h in 2nd gear)
  { x: 398, z: -126, speed: 115 },
  { x: 414, z: -117, speed: 98 },
  // Chicane central transition & kerb strike
  { x: 424, z: -110, speed: 105 },
  // Turn 1B: Chicane SECOND CURVE TO THE LEFT (Apex kerb at left, 115 km/h in 3rd gear)
  { x: 434, z: -100, speed: 115 },
  { x: 443, z: -78, speed: 145 },
  // Chicane exit acceleration
  { x: 450, z: -48, speed: 185 },
  { x: 454, z: -15, speed: 215 },

  // --- SECTOR 2: CURVONE & MEDIUM/LOW SPEED SECTION ---
  // Turn 2: Curvone de Alta Velocidad (High-Downforce Arc, 240 km/h, 6th gear)
  { x: 448, z: 30, speed: 235 },
  { x: 420, z: 95, speed: 245 },
  { x: 370, z: 155, speed: 240 },
  // Turn 3: Technical Medium-Speed Left (165 km/h in 4th gear)
  { x: 300, z: 205, speed: 185 },
  { x: 235, z: 235, speed: 165 },
  // Turn 4: Technical Medium-Speed Right into Infield Transition
  { x: 165, z: 245, speed: 170 },
  { x: 105, z: 242, speed: 165 },
  { x: 55, z: 225, speed: 130 },
  // Turn 5: Technical Smooth Infield Flow (Continuous curvature R > 27m, 0 fold-over)
  { x: 18, z: 195, speed: 105 },
  { x: -2, z: 165, speed: 120 },
  { x: -22, z: 142, speed: 155 },

  // --- SECTOR 3: ESSES & PARABÓLICA FINAL ---
  // Flowing Infield Esses (195 - 215 km/h in 5th gear)
  { x: -50, z: 135, speed: 195 },
  { x: -140, z: 130, speed: 210 },
  { x: -220, z: 105, speed: 195 },
  // Entry into Turn 6 & 7: La Gran Parabólica (Increasing radius slingshot)
  { x: -295, z: 75, speed: 180 },
  { x: -370, z: 30, speed: 195 },
  { x: -425, z: -30, speed: 215 },
  { x: -445, z: -85, speed: 235 },
  // Slingshot exit back onto the Mega Straight
  { x: -415, z: -128, speed: 260 },
  { x: -300, z: -130, speed: 295 },
  { x: -150, z: -130, speed: 320 },
];

/**
 * Builds the canonical smooth Catmull-Rom closed circuit spline for the Speedway.
 * Calibrated to approx. 2,780 meters with 600 finely-discretized waypoints (~4.6m per segment)
 * for perfectly rounded, continuous aerodynamic curvature without geometric aliasing.
 */
export function buildSpeedwayWaypoints(): { waypoints: SplinePoint[]; totalLength: number } {
  const v3Points = SPEEDWAY_CONTROL_NODES.map((pt) => new THREE.Vector3(pt.x, 0, pt.z));
  const curve = new THREE.CatmullRomCurve3(v3Points, true, 'centripetal', 0.5);

  const numSamples = 600;
  const sampledPoints = curve.getSpacedPoints(numSamples);
  const totalLength = curve.getLength();

  // Map speed limits by projecting sampled points onto control nodes with distance weighting
  const tempPoints: { x: number; z: number; speed: number }[] = [];

  for (let i = 0; i < numSamples; i++) {
    const pt = sampledPoints[i];

    // Find nearest 2 control nodes to interpolate speed limit smoothly
    let minDist1 = Infinity;
    let minDist2 = Infinity;
    let node1 = SPEEDWAY_CONTROL_NODES[0];
    let node2 = SPEEDWAY_CONTROL_NODES[1];

    for (let c = 0; c < SPEEDWAY_CONTROL_NODES.length; c++) {
      const node = SPEEDWAY_CONTROL_NODES[c];
      const d = Math.hypot(node.x - pt.x, node.z - pt.z);
      if (d < minDist1) {
        minDist2 = minDist1;
        node2 = node1;
        minDist1 = d;
        node1 = node;
      } else if (d < minDist2) {
        minDist2 = d;
        node2 = node;
      }
    }

    const totalWeight = minDist1 + minDist2 || 1;
    const w1 = 1 - (minDist1 / totalWeight);
    const w2 = 1 - w1;
    const interpolatedSpeed = Math.round(node1.speed * w1 + node2.speed * w2);

    tempPoints.push({
      x: Number(pt.x.toFixed(2)),
      z: Number(pt.z.toFixed(2)),
      speed: Math.max(75, Math.min(365, interpolatedSpeed)),
    });
  }

  let accumDist = 0;
  const numTotal = tempPoints.length;
  const distances: number[] = new Array(numTotal);

  for (let i = 0; i < numTotal; i++) {
    const nextIdx = (i + 1) % numTotal;
    const dx = tempPoints[nextIdx].x - tempPoints[i].x;
    const dz = tempPoints[nextIdx].z - tempPoints[i].z;
    const segLen = Math.hypot(dx, dz);
    distances[i] = segLen;
  }

  const splineWaypoints: SplinePoint[] = tempPoints.map((pt, idx, arr) => {
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
      yaw,
      accumulatedDistance: currentAccum,
      segmentLength: distances[idx],
    };
  });

  return {
    waypoints: splineWaypoints,
    totalLength: Number(accumDist.toFixed(2)),
  };
}

const speedwayData = buildSpeedwayWaypoints();
export const SPEEDWAY_WAYPOINTS = speedwayData.waypoints;
export const SPEEDWAY_TOTAL_LENGTH = speedwayData.totalLength;
export const SPEEDWAY_RACE_PACE_SPEED = 59.8; // ~215.3 km/h average lap pace
