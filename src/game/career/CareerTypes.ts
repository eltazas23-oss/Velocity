/**
 * CareerTypes.ts - Multi-Car Grand Prix Race Definitions & Teams
 */

import { TireCompoundType } from '../physics/TireCompound';

export type RaceDifficulty = 'easy' | 'medium' | 'hard';
export type RaceLapOption = 9 | 20 | 50;

export interface TeamLiveryConfig {
  id: string;
  driverNumber: string;
  driverName: string;
  driverCode: string;
  teamName: string;
  primaryColor: string;       // Hex string e.g. '#1d4ed8'
  secondaryColor: string;     // Accent / Pods e.g. '#ef4444'
  accentColor: string;        // Stripes / Endplates
  haloColor: string;
  sponsorName: string;
  teamColorHex: number;
  teamColorCss: string;
  pitStallX: number;          // Pit lane X dock position (-24, -12, 0, 12, 24)
  pitStallZ: number;          // Pit lane Z dock position (-116.0)
}

export const RACE_TEAMS: TeamLiveryConfig[] = [
  {
    id: 'player',
    driverNumber: '1',
    driverName: 'M. Verstappen',
    driverCode: 'VER',
    teamName: 'Oracle Red Bull Racing',
    primaryColor: '#040814',     // Authentic Red Bull Matte Midnight Navy Blue
    secondaryColor: '#cc0022',   // Charging Bull Crimson Red
    accentColor: '#fec008',      // Sunburst Solar Yellow
    haloColor: '#0c0f16',
    sponsorName: 'ORACLE RED BULL',
    teamColorHex: 0x050a16,
    teamColorCss: '#050a16',
    pitStallX: -22.0,
    pitStallZ: -116.0,
  },
  {
    id: 'scuderia',
    driverNumber: '16',
    driverName: 'C. Leclerc',
    driverCode: 'LEC',
    teamName: 'Scuderia Corsa',
    primaryColor: '#dc2626',     // Rosso Corsa
    secondaryColor: '#facc15',   // Modena Yellow
    accentColor: '#ffffff',
    haloColor: '#0f172a',
    sponsorName: 'SANTANDER',
    teamColorHex: 0xdc2626,
    teamColorCss: '#dc2626',
    pitStallX: 22.0,
    pitStallZ: -116.0,
  },
];

export interface DriverLeaderboardEntry {
  id: string;
  position: number;
  driverCode: string;
  driverName: string;
  driverNumber: string;
  teamName: string;
  teamColorCss: string;
  currentLap: number;
  currentSector: number;
  currentCompound: TireCompoundType;
  compoundsUsed: TireCompoundType[];
  hasSatisfiedTireRule: boolean;
  tireWearAvg: number;
  pitStopsCount: number;
  isInPit: boolean;
  gapToLeaderFormatted: string;
  gapToAheadFormatted: string;
  lastLapTime: number | null;
  bestLapTime: number | null;
  currentLapTime: number;
  totalRaceTime: number;
  isPlayer: boolean;
  isFinished: boolean;
  finishPosition?: number;
  hasPenalty: boolean;
  penaltySeconds: number;
}

export interface CareerRaceConfig {
  totalLaps: RaceLapOption;
  difficulty: RaceDifficulty;
  startingCompound: TireCompoundType;
  requiresTwoCompounds: boolean; // True for 20 and 50 laps
}
