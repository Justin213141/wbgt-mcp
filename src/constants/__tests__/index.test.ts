/**
 * Tests for constants barrel export
 * Ensures all constants are properly exported
 */

import { describe, it, expect } from 'vitest';

// Test importing from the barrel export
import * as Constants from '../index';

// Test specific imports from constant modules
import {
  // Physical constants
  STEFAN_BOLTZMANN,
  GAS_CONSTANT_AIR,
  MOLECULAR_WEIGHT_AIR,
  MOLECULAR_WEIGHT_WATER,
  LATENT_HEAT_VAPORIZATION,
  SOLAR_CONSTANT,
  // WBGT formula constants
  GLOBE_DIAMETER,
  GLOBE_EMISSIVITY,
  WICK_DIAMETER,
  WICK_EMISSIVITY,
  SURFACE_ALBEDO,
  GLOBE_ALBEDO,
  WICK_ALBEDO,
  WICK_LENGTH,
  // Location constants
  SYDNEY_LOCATION,
  TOKYO_LOCATION,
  DEFAULT_LOCATION,
  SUPPORTED_LOCATIONS,
  // Cache constants
  CACHE_PREFIX,
  FORECAST_TTL_SECONDS,
  OBSERVATIONS_TTL_SECONDS,
  HISTORIC_TTL_SECONDS,
  DEFAULT_CACHE_TTL_SECONDS,
} from '../index';

describe('Constants Index Exports', () => {
  it('should export all physical constants', () => {
    expect(typeof Constants.STEFAN_BOLTZMANN).toBe('number');
    expect(typeof Constants.GAS_CONSTANT_AIR).toBe('number');
    expect(typeof Constants.MOLECULAR_WEIGHT_AIR).toBe('number');
    expect(typeof Constants.MOLECULAR_WEIGHT_WATER).toBe('number');
    expect(typeof Constants.LATENT_HEAT_VAPORIZATION).toBe('number');
    expect(typeof Constants.SOLAR_CONSTANT).toBe('number');
  });

  it('should export all WBGT formula constants', () => {
    expect(typeof Constants.GLOBE_DIAMETER).toBe('number');
    expect(typeof Constants.GLOBE_EMISSIVITY).toBe('number');
    expect(typeof Constants.WICK_DIAMETER).toBe('number');
    expect(typeof Constants.WICK_EMISSIVITY).toBe('number');
    expect(typeof Constants.SURFACE_ALBEDO).toBe('number');
    expect(typeof Constants.GLOBE_ALBEDO).toBe('number');
    expect(typeof Constants.WICK_ALBEDO).toBe('number');
    expect(typeof Constants.WICK_LENGTH).toBe('number');
  });

  it('should export all location constants', () => {
    expect(typeof Constants.SYDNEY_LOCATION).toBe('object');
    expect(typeof Constants.TOKYO_LOCATION).toBe('object');
    expect(typeof Constants.DEFAULT_LOCATION).toBe('object');
    expect(typeof Constants.SUPPORTED_LOCATIONS).toBe('object');
  });

  it('should export all cache constants', () => {
    expect(typeof Constants.CACHE_PREFIX).toBe('string');
    expect(typeof Constants.FORECAST_TTL_SECONDS).toBe('number');
    expect(typeof Constants.OBSERVATIONS_TTL_SECONDS).toBe('number');
    expect(typeof Constants.HISTORIC_TTL_SECONDS).toBe('number');
    expect(typeof Constants.DEFAULT_CACHE_TTL_SECONDS).toBe('number');
  });

  it('should import specific constants correctly', () => {
    // Test specific imports work
    expect(typeof STEFAN_BOLTZMANN).toBe('number');
    expect(typeof GAS_CONSTANT_AIR).toBe('number');
    expect(typeof GLOBE_DIAMETER).toBe('number');
    expect(typeof GLOBE_EMISSIVITY).toBe('number');
    expect(typeof SYDNEY_LOCATION).toBe('object');
    expect(typeof TOKYO_LOCATION).toBe('object');
    expect(typeof DEFAULT_LOCATION).toBe('object');
    expect(typeof SUPPORTED_LOCATIONS).toBe('object');
    expect(typeof CACHE_PREFIX).toBe('string');
    expect(typeof FORECAST_TTL_SECONDS).toBe('number');
    expect(typeof OBSERVATIONS_TTL_SECONDS).toBe('number');
    expect(typeof HISTORIC_TTL_SECONDS).toBe('number');
    expect(typeof DEFAULT_CACHE_TTL_SECONDS).toBe('number');
  });

  it('should have valid physical constant values', () => {
    // Test that physical constants have reasonable values
    expect(STEFAN_BOLTZMANN).toBeGreaterThan(0);
    expect(GAS_CONSTANT_AIR).toBeGreaterThan(0);
    expect(MOLECULAR_WEIGHT_AIR).toBeGreaterThan(0);
    expect(MOLECULAR_WEIGHT_WATER).toBeGreaterThan(0);
    expect(LATENT_HEAT_VAPORIZATION).toBeGreaterThan(0);
    expect(SOLAR_CONSTANT).toBeGreaterThan(0);

    // Test Stefan-Boltzmann constant (should be close to 5.67e-8)
    expect(STEFAN_BOLTZMANN).toBeCloseTo(5.67e-8, 8);

    // Test gas constant for air (should be close to 287 J/(kg·K))
    expect(GAS_CONSTANT_AIR).toBeCloseTo(287, 0);
  });

  it('should have valid WBGT formula constants', () => {
    // Test dimensions and properties
    expect(GLOBE_DIAMETER).toBeGreaterThan(0);
    expect(WICK_DIAMETER).toBeGreaterThan(0);
    expect(WICK_LENGTH).toBeGreaterThan(0);

    // Test emissivity values (should be between 0 and 1)
    expect(GLOBE_EMISSIVITY).toBeGreaterThan(0);
    expect(GLOBE_EMISSIVITY).toBeLessThanOrEqual(1);
    expect(WICK_EMISSIVITY).toBeGreaterThan(0);
    expect(WICK_EMISSIVITY).toBeLessThanOrEqual(1);

    // Test albedo values (should be between 0 and 1)
    expect(SURFACE_ALBEDO).toBeGreaterThan(0);
    expect(SURFACE_ALBEDO).toBeLessThanOrEqual(1);
    expect(GLOBE_ALBEDO).toBeGreaterThan(0);
    expect(GLOBE_ALBEDO).toBeLessThanOrEqual(1);
    expect(WICK_ALBEDO).toBeGreaterThan(0);
    expect(WICK_ALBEDO).toBeLessThanOrEqual(1);
  });

  it('should have valid cache constants', () => {
    expect(typeof CACHE_PREFIX).toBe('string');
    expect(CACHE_PREFIX.length).toBeGreaterThan(0);
    expect(FORECAST_TTL_SECONDS).toBeGreaterThan(0);
    expect(OBSERVATIONS_TTL_SECONDS).toBeGreaterThan(0);
    expect(HISTORIC_TTL_SECONDS).toBeGreaterThan(0);
    expect(DEFAULT_CACHE_TTL_SECONDS).toBeGreaterThan(0);
  });

  it('should have location constants with proper structure', () => {
    expect(SYDNEY_LOCATION).toHaveProperty('name');
    expect(SYDNEY_LOCATION).toHaveProperty('latitude');
    expect(SYDNEY_LOCATION).toHaveProperty('longitude');
    expect(SYDNEY_LOCATION).toHaveProperty('timezone');

    expect(TOKYO_LOCATION).toHaveProperty('name');
    expect(TOKYO_LOCATION).toHaveProperty('latitude');
    expect(TOKYO_LOCATION).toHaveProperty('longitude');
    expect(TOKYO_LOCATION).toHaveProperty('timezone');

    expect(DEFAULT_LOCATION).toHaveProperty('name');
    expect(DEFAULT_LOCATION).toHaveProperty('latitude');
    expect(DEFAULT_LOCATION).toHaveProperty('longitude');
    expect(DEFAULT_LOCATION).toHaveProperty('timezone');

    expect(typeof SUPPORTED_LOCATIONS).toBe('object');
  });

  it('should export expected number of constants', () => {
    const constantNames = Object.keys(Constants);

    // Should have a reasonable number of exports
    expect(constantNames.length).toBeGreaterThan(10);

    // Should include major categories
    const hasPhysicalConstants = constantNames.some(name =>
      name.includes('STEFAN') || name.includes('GAS_CONSTANT')
    );
    const hasWBGTConstants = constantNames.some(name =>
      name.includes('GLOBE') || name.includes('WICK')
    );
    const hasLocationConstants = constantNames.some(name =>
      name.includes('LOCATION') || name.includes('SYDNEY')
    );

    expect(hasPhysicalConstants).toBe(true);
    expect(hasWBGTConstants).toBe(true);
    expect(hasLocationConstants).toBe(true);
  });

  it('should have immutable constants', () => {
    // Test that ES6 imports create read-only bindings
    expect(() => {
      // @ts-expect-error - Testing immutability
      Constants.STEFAN_BOLTZMANN = 999;
    }).toThrow();

    // Values should remain unchanged
    expect(STEFAN_BOLTZMANN).toBeCloseTo(5.67e-8, 8);
  });
});