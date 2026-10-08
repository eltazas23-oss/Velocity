/**
 * SpeedwayCircuitConfig.ts - Full Definition for 2,780m Grand Prix Speedway Circuit
 * Implements the ICircuitDefinition specification.
 */

import { ICircuitDefinition, ITrackWorld } from '../ICircuit';
import { SPEEDWAY_WAYPOINTS, SPEEDWAY_TOTAL_LENGTH, SPEEDWAY_RACE_PACE_SPEED } from './SpeedwayWaypoints';
import { SpeedwayTrackBuilder } from './SpeedwayTrackBuilder';

export const SpeedwayCircuitConfig: ICircuitDefinition = {
  id: 'speedway_gp',
  name: 'Circuit 2',
  tagline: 'Autódromo de alta velocidad de 2.78km con mega recta de 355+ km/h y horquilla',
  country: 'Italia / Monza-Baku Hybrid',
  flagEmoji: '🇮🇹',
  totalLength: SPEEDWAY_TOTAL_LENGTH,
  racePaceSpeed: SPEEDWAY_RACE_PACE_SPEED,
  expectedLapTimeSec: 46.5,
  cornersCount: 8,
  topSpeedKmh: 358,
  drsZonesCount: 0,
  drsZones: [],
  waypoints: SPEEDWAY_WAYPOINTS,
  pitZone: {
    minX: -68,
    maxX: 50,
    minZ: -122.5,
    maxZ: -105.0,
  },
  gridSlots: {
    player: {
      x: -18.0,
      z: -128.0,
      yaw: Math.PI / 2,
    },
    ai: (slot: number) => {
      const isLeft = slot % 2 === 1;
      return {
        x: -18.0 - (slot - 1) * 8.0,
        z: isLeft ? -128.0 : -132.0,
        yaw: Math.PI / 2,
      };
    },
  },
  checkSectorProgress: (x: number, z: number, currentSector: number) => {
    // Sector 1: From start line along mega straight, through Chicane T1-A/B
    if (currentSector === 0 && x > 400 && z > -75) {
      return { newSector: 1, lapCompleted: false };
    }
    // Sector 2: Through Curvone, Turn 3, Turn 4, and Hairpin exit
    else if (currentSector === 1 && x < 50 && z > 120) {
      return { newSector: 2, lapCompleted: false };
    }
    // Sector 3: Through Infield Esses and La Gran Parabólica
    else if (currentSector === 2 && x < -350 && z < -110) {
      return { newSector: 3, lapCompleted: false };
    }
    // Finish Line Crossing on the Mega Straight (X: -20 to 20, Z < -115)
    else if (currentSector === 3 && z < -115 && x >= -20 && x <= 20) {
      return { newSector: 0, lapCompleted: true };
    }
    return { newSector: currentSector, lapCompleted: false };
  },
  minimapConfig: {
    viewBox: '0 0 100 100',
    // Calibrated SVG path matching the 2,780m circuit topology
    svgTrackPath: 'M 14 15 L 86 15 C 89 15 91 18 90 22 L 88 26 C 88 29 93 33 94 40 C 96 52 90 66 80 74 C 70 82 58 84 48 84 C 40 84 34 78 34 70 C 34 62 40 56 42 50 C 38 46 28 46 20 46 C 12 46 8 38 8 28 C 8 20 10 15 14 15 Z',
    pitLaneSvgPath: 'M 38 20 L 58 20',
    bounds: {
      minX: -480,
      maxX: 460,
      minZ: -160,
      maxZ: 280,
    },
  },
  createTrackBuilder: (): ITrackWorld => {
    return new SpeedwayTrackBuilder();
  },
};
