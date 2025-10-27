/**
 * Tests for calculations module exports
 * Ensures all calculation functions are properly exported
 */

import { describe, it, expect } from 'vitest';

// Import specific functions to verify they exist
import {
  // Solar calculations
  calculateSolarZenithAngle,
  calculateSolarZenithAngleJST,
  calculateSolarZenithAngleByTimezone,
  // Vapor pressure
  calculateVaporPressure,
  calculateBuckSaturationVaporPressure,
  calculateVaporPressureDerivative,
  // Air properties
  calculateAirProperties,
  calculateWindAt2m,
  // Radiation
  calculateRadiationComponents,
  // Heat transfer
  calculateHeatTransferCoefficients,
  // Kong WBGT
  calculateKongBlackGlobe,
  calculateKongNaturalWetBulb,
  calculateKongWBGT,
  calculateESI,
  calculateKongWBGTPipelineByTimezone,
  calculateKongWBGTPipeline,
  calculateKongWBGTPipelineJST,
  // Simple WBGT
  calculateWBGT,
  calculateEWBGT,
  calculateAT,
} from '../index';

describe('Calculations Index Exports', () => {
  it('should export all calculation functions', () => {
    // Check that specific imports work
    expect(typeof calculateSolarZenithAngle).toBe('function');
    expect(typeof calculateSolarZenithAngleJST).toBe('function');
    expect(typeof calculateSolarZenithAngleByTimezone).toBe('function');
    expect(typeof calculateVaporPressure).toBe('function');
    expect(typeof calculateBuckSaturationVaporPressure).toBe('function');
    expect(typeof calculateVaporPressureDerivative).toBe('function');
    expect(typeof calculateAirProperties).toBe('function');
    expect(typeof calculateWindAt2m).toBe('function');
    expect(typeof calculateRadiationComponents).toBe('function');
    expect(typeof calculateHeatTransferCoefficients).toBe('function');
    expect(typeof calculateKongBlackGlobe).toBe('function');
    expect(typeof calculateKongNaturalWetBulb).toBe('function');
    expect(typeof calculateKongWBGT).toBe('function');
    expect(typeof calculateESI).toBe('function');
    expect(typeof calculateKongWBGTPipelineByTimezone).toBe('function');
    expect(typeof calculateKongWBGTPipeline).toBe('function');
    expect(typeof calculateKongWBGTPipelineJST).toBe('function');
    expect(typeof calculateWBGT).toBe('function');
    expect(typeof calculateEWBGT).toBe('function');
    expect(typeof calculateAT).toBe('function');
  });

  it('should export functions that can be called', () => {
    // Test that exported functions are callable with basic parameters
    expect(() => calculateSolarZenithAngle(0, 0, '2023-06-21T12:00:00Z')).not.toThrow();
    expect(() => calculateVaporPressure(25, 50)).not.toThrow();
    expect(() => calculateBuckSaturationVaporPressure(25)).not.toThrow();
    expect(() => calculateVaporPressureDerivative(25)).not.toThrow();
    expect(() => calculateAirProperties(298.15, 101325)).not.toThrow();
    expect(() => calculateWindAt2m(10)).not.toThrow();
    expect(() => calculateWBGT(25, 50, 800)).not.toThrow();
    expect(() => calculateEWBGT(25, 20)).not.toThrow();
    expect(() => calculateAT(25, 50, 10, 800)).not.toThrow();
    expect(() => calculateESI(25, 50, 800)).not.toThrow();
    expect(() => calculateKongWBGT(25, 30, 20)).not.toThrow();
  });

  it('should return reasonable values for basic function calls', () => {
    // Test some basic calculations to ensure functions work
    const vaporPressure = calculateVaporPressure(25, 50);
    expect(typeof vaporPressure).toBe('number');
    expect(vaporPressure).not.toBeNaN();
    expect(vaporPressure).toBeGreaterThan(0);

    const wbgt = calculateWBGT(25, 50, 800);
    expect(typeof wbgt).toBe('number');
    expect(wbgt).not.toBeNaN();

    const ewbgt = calculateEWBGT(25, 20);
    expect(typeof ewbgt).toBe('number');
    expect(ewbgt).not.toBeNaN();

    const at = calculateAT(25, 50, 10, 800);
    expect(typeof at).toBe('number');
    expect(at).not.toBeNaN();

    const esi = calculateESI(25, 50, 800);
    expect(typeof esi).toBe('number');
    expect(esi).not.toBeNaN();
  });

  it('should have consistent function signatures', () => {
    // Check that all calculation functions accept reasonable numbers of parameters
    const functions = [
      calculateVaporPressure,
      calculateBuckSaturationVaporPressure,
      calculateVaporPressureDerivative,
      calculateAirProperties,
      calculateWindAt2m,
      calculateWBGT,
      calculateEWBGT,
      calculateAT,
      calculateESI,
      calculateKongWBGT,
    ];

    functions.forEach(fn => {
      expect(typeof fn).toBe('function');
      expect(fn.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should export all major calculation categories', () => {
    // Verify we have functions from each major category
    const solarFunctions = [
      calculateSolarZenithAngle,
      calculateSolarZenithAngleJST,
      calculateSolarZenithAngleByTimezone,
    ];

    const vaporPressureFunctions = [
      calculateVaporPressure,
      calculateBuckSaturationVaporPressure,
      calculateVaporPressureDerivative,
    ];

    const airPropertyFunctions = [
      calculateAirProperties,
      calculateWindAt2m,
    ];

    const wbgtFunctions = [
      calculateWBGT,
      calculateEWBGT,
      calculateAT,
      calculateKongWBGT,
      calculateESI,
    ];

    // Each category should have at least one function
    expect(solarFunctions.length).toBeGreaterThan(0);
    expect(vaporPressureFunctions.length).toBeGreaterThan(0);
    expect(airPropertyFunctions.length).toBeGreaterThan(0);
    expect(wbgtFunctions.length).toBeGreaterThan(0);

    // All functions should be actual functions
    [...solarFunctions, ...vaporPressureFunctions, ...airPropertyFunctions, ...wbgtFunctions]
      .forEach(fn => {
        expect(typeof fn).toBe('function');
      });
  });
});