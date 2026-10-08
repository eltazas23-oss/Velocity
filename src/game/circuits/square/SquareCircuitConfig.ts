/**
 * SquareCircuitConfig.ts - Original Square Apex Circuit Definition
 * Encapsulates the existing 974.76m square track layout into the ICircuitDefinition standard.
 * Retains 100% backward compatibility and identical gameplay physics.
 */

import { ICircuitDefinition, ITrackWorld } from '../ICircuit';
import { TrackBuilder } from '../../world/TrackBuilder';
import { SHARED_CIRCUIT_WAYPOINTS, CIRCUIT_TOTAL_LENGTH, CIRCUIT_RACE_PACE_SPEED } from '../../career/CircuitWaypoints';

export const SquareCircuitConfig: ICircuitDefinition = {
  id: 'square_apex',
  name: 'Circuit 1',
  tagline: 'Circuito urbano técnico de 4 vértices de 90° con alta exigencia de tracción',
  country: 'Monaco / Urban',
  flagEmoji: '🇲🇨',
  totalLength: CIRCUIT_TOTAL_LENGTH,
  racePaceSpeed: CIRCUIT_RACE_PACE_SPEED,
  expectedLapTimeSec: 16.8,
  cornersCount: 4,
  topSpeedKmh: 345,
  drsZonesCount: 0,
  drsZones: [],
  waypoints: SHARED_CIRCUIT_WAYPOINTS,
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
    // Exact original sector trigger bounds
    if (currentSector === 0 && x > 40 && z < -50) {
      return { newSector: 1, lapCompleted: false };
    } else if (currentSector === 1 && x > 50 && z > 40) {
      return { newSector: 2, lapCompleted: false };
    } else if (currentSector === 2 && x < -40 && z > 50) {
      return { newSector: 3, lapCompleted: false };
    } else if (currentSector === 3 && x < -50 && z < -40) {
      return { newSector: 4, lapCompleted: false };
    } else if (currentSector === 4 && z < -110 && x >= -95 && x <= -55) {
      return { newSector: 0, lapCompleted: true };
    }
    return { newSector: currentSector, lapCompleted: false };
  },
  minimapConfig: {
    viewBox: '0 0 100 100',
    svgTrackPath: 'M 22 8 L 78 8 Q 92 8 92 22 L 92 78 Q 92 92 78 92 L 22 92 Q 8 92 8 78 L 8 22 Q 8 8 22 8 Z',
    pitLaneSvgPath: 'M 35 17 L 65 17',
    bounds: {
      minX: -140,
      maxX: 140,
      minZ: -140,
      maxZ: 140,
    },
  },
  createTrackBuilder: (): ITrackWorld => {
    return new TrackBuilder();
  },
};
