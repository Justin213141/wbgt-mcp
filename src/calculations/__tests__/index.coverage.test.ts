/**
 * Tests for calculations index file to ensure coverage
 * Simple tests to verify the barrel export works
 */

import { describe, it, expect } from 'vitest';

// Test importing from the calculations barrel export
import * as Calculations from '../index';

describe('Calculations Index Coverage', () => {
  it('should export calculations object', () => {
    expect(typeof Calculations).toBe('object');
  });

  it('should have multiple calculation function exports', () => {
    const exportCount = Object.keys(Calculations).length;
    expect(exportCount).toBeGreaterThan(10);
  });

  it('should export expected calculation categories', () => {
    // Should have solar, vapor pressure, air properties, WBGT calculations
    const hasSolarCalculations = Object.keys(Calculations).some(key =>
      key.toLowerCase().includes('solar')
    );
    const hasVaporPressureCalculations = Object.keys(Calculations).some(key =>
      key.toLowerCase().includes('vapor')
    );
    const hasWBGTCalculations = Object.keys(Calculations).some(key =>
      key.toLowerCase().includes('wbgt') || key.toLowerCase().includes('esi')
    );

    expect(hasSolarCalculations).toBe(true);
    expect(hasVaporPressureCalculations).toBe(true);
    expect(hasWBGTCalculations).toBe(true);
  });

  it('should export functions that are callable', () => {
    const functionNames = Object.keys(Calculations).filter(key =>
      typeof Calculations[key as keyof typeof Calculations] === 'function'
    );

    expect(functionNames.length).toBeGreaterThan(5);

    // Test a few functions to ensure they're callable
    functionNames.slice(0, 3).forEach(funcName => {
      const func = Calculations[funcName as keyof typeof Calculations];
      expect(typeof func).toBe('function');
    });
  });
});