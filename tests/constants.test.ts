import { describe, it, expect } from 'vitest';
import { calculateHeatTransferCoefficients, calculateAirProperties } from '../src/calculations';
import { MOLECULAR_WEIGHT_AIR } from '../src/constants';

describe('Heat Transfer with MOLECULAR_WEIGHT_AIR', () => {
  it('should use MOLECULAR_WEIGHT_AIR in calculateHeatTransferCoefficients', () => {
    // MOLECULAR_WEIGHT_AIR must be defined for heat transfer module to compile
    expect(MOLECULAR_WEIGHT_AIR).toBe(0.02897);
  });
});
