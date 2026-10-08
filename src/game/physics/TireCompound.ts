/**
 * TireCompound.ts - Authentic Formula 1 Style Tire Compounds & Degradation Models
 * 
 * Compounds:
 * 1. SOFT (C3 - Red Stripe): Maximum mechanical & aerodynamic cornering grip (1.15x), fastest lap time.
 * 2. MEDIUM (C2 - Yellow Stripe): Balanced grip (1.00x), medium wear rate.
 * 3. HARD (C1 - White Stripe): High durability, consistent long stints.
 */

export type TireCompoundType = 'soft' | 'medium' | 'hard';

export interface CompoundConfig {
  id: TireCompoundType;
  name: string;
  code: string;
  colorHex: number;
  colorCss: string;
  stripeColorHex: number;
  gripMultiplier: number;      // Multiplier on base lateral cornering force
  maxCorneringG: number;       // Peak lateral G threshold before progressive sliding
  wearRateMultiplier: number;  // Multiplier on tire degradation speed
  cliffThreshold: number;      // Wear percentage (0-100) where the performance cliff begins
  description: string;
}

export const TIRE_COMPOUNDS: Record<TireCompoundType, CompoundConfig> = {
  soft: {
    id: 'soft',
    name: 'Blando (Soft)',
    code: 'SOFT · C3',
    colorHex: 0xef4444,
    colorCss: '#ef4444',
    stripeColorHex: 0xef4444,
    gripMultiplier: 1.25,
    maxCorneringG: 3.40,
    wearRateMultiplier: 1.8,
    cliffThreshold: 76,
    description: 'Máximo agarre instantáneo y vuelta rápida con mayor degradación.',
  },
  medium: {
    id: 'medium',
    name: 'Medio (Medium)',
    code: 'MEDIUM · C2',
    colorHex: 0xeab308,
    colorCss: '#eab308',
    stripeColorHex: 0xeab308,
    gripMultiplier: 1.10,
    maxCorneringG: 3.00,
    wearRateMultiplier: 1.0,
    cliffThreshold: 82,
    description: 'Equilibrio perfecto entre velocidad de curva y durabilidad en tandas medias.',
  },
  hard: {
    id: 'hard',
    name: 'Duro (Hard)',
    code: 'HARD · C1',
    colorHex: 0xf8fafc,
    colorCss: '#f8fafc',
    stripeColorHex: 0xf8fafc,
    gripMultiplier: 1.00,
    maxCorneringG: 2.70,
    wearRateMultiplier: 0.45,
    cliffThreshold: 88,
    description: 'Gran resistencia al desgaste para tandas largas y máxima consistencia.',
  },
};

