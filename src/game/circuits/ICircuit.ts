/**
 * ICircuit.ts - Standardized Interface for FIA Racing Circuits
 * Ensures 100% modular isolation between circuits with zero code pollution.
 */

import * as THREE from 'three';
import { SplinePoint } from '../career/CircuitWaypoints';
import { StaticObstacle, DynamicProp } from '../world/TrackBuilder';
import { GrandstandCrowdSystem } from '../crowd/GrandstandCrowdSystem';

export type CircuitId = 'square_apex' | 'speedway_gp';

export interface ITrackWorld {
  group: THREE.Group;
  staticObstacles: StaticObstacle[];
  dynamicProps: DynamicProp[];
  pitZone: { minX: number; maxX: number; minZ: number; maxZ: number };
  crowdSystem?: GrandstandCrowdSystem;
  dispose?: () => void;
  impartImpulseToProp: (prop: DynamicProp, vel: THREE.Vector3, normal: THREE.Vector3) => void;
  updateDynamicProps: (dt: number) => void;
  syncDynamicPropsVisuals?: (alpha: number) => void;
}

export interface MinimapConfig {
  viewBox: string;
  svgTrackPath: string;
  pitLaneSvgPath?: string;
  bounds: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

export interface DrsZoneConfig {
  id: string;
  name: string;
  detectionDistance: number; // Distance in meters along the circuit spline where the <= 1.0s gap is evaluated
  startDistance: number;     // Distance in meters where DRS activation opens
  endDistance: number;       // Distance in meters where DRS zone ends (braking onset)
  detectionPoint?: { x: number; z: number; radius: number };
}

export interface ICircuitDefinition {
  id: CircuitId;
  name: string;
  tagline: string;
  country: string;
  flagEmoji: string;
  totalLength: number;
  racePaceSpeed: number;
  expectedLapTimeSec: number;
  cornersCount: number;
  topSpeedKmh: number;
  drsZonesCount: number;
  drsZones: DrsZoneConfig[];
  waypoints: SplinePoint[];
  pitZone: { minX: number; maxX: number; minZ: number; maxZ: number };
  gridSlots: {
    player: { x: number; z: number; yaw: number };
    ai: (slot: number) => { x: number; z: number; yaw: number };
  };
  checkSectorProgress: (x: number, z: number, currentSector: number) => {
    newSector: number;
    lapCompleted: boolean;
  };
  minimapConfig: MinimapConfig;
  createTrackBuilder: () => ITrackWorld;
}
