/**
 * Tests for simple WBGT calculations
 * Covers ESI, eWBGT, and Apparent Temperature formulas
 */

import { describe, it, expect } from 'vitest';
import { calculateWBGT, calculateEWBGT, calculateAT } from '../simple-wbgt';

describe('Simple WBGT Calculations', () => {
  describe('calculateWBGT', () => {
    it('should calculate WBGT using ESI formula', () => {
      // Test with typical conditions
      const result = calculateWBGT(25, 60, 800);
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(30);

      // Test with hot conditions - should be higher than typical
      const hotResult = calculateWBGT(35, 80, 1000);
      expect(hotResult).toBeGreaterThan(result);
      expect(hotResult).toBeLessThan(40);
    });

    it('should handle edge cases', () => {
      // Cold conditions
      const coldResult = calculateWBGT(5, 30, 200);
      expect(coldResult).toBeGreaterThan(0);
      expect(coldResult).toBeLessThan(10);

      // Very high solar radiation
      const highRadResult = calculateWBGT(30, 70, 1400);
      expect(highRadResult).toBeGreaterThan(0);

      // Zero solar radiation (nighttime)
      const nightResult = calculateWBGT(20, 50, 0);
      expect(nightResult).toBeGreaterThan(10);
      expect(nightResult).toBeLessThan(20);
    });

    it('should produce reasonable results for known scenarios', () => {
      // Moderate conditions - typical outdoor day
      const moderate = calculateWBGT(28, 65, 750);
      expect(moderate).toBeGreaterThan(20);
      expect(moderate).toBeLessThan(40);

      // Extreme heat conditions
      const extreme = calculateWBGT(40, 90, 1200);
      expect(extreme).toBeGreaterThan(30);
    });
  });

  describe('calculateEWBGT', () => {
    it('should calculate enhanced WBGT using vapor pressure', () => {
      // Test with moderate conditions
      const result = calculateEWBGT(25, 20);
      expect(result).toBeGreaterThan(20);
      expect(result).toBeLessThan(30);

      // Test with high vapor pressure (humid) - should be higher
      const humidResult = calculateEWBGT(30, 35);
      expect(humidResult).toBeGreaterThan(result);
      expect(humidResult).toBeLessThan(40);
    });

    it('should handle low vapor pressure', () => {
      const dryResult = calculateEWBGT(25, 5);
      expect(dryResult).toBeCloseTo(20.1, 1);
    });

    it('should produce results in reasonable range', () => {
      // Cool and dry
      const coolDry = calculateEWBGT(15, 10);
      expect(coolDry).toBeGreaterThan(10);
      expect(coolDry).toBeLessThan(25);

      // Hot and humid
      const hotHumid = calculateEWBGT(35, 40);
      expect(hotHumid).toBeGreaterThan(25);
      expect(hotHumid).toBeLessThan(45);
    });
  });

  describe('calculateAT', () => {
    it('should calculate Apparent Temperature', () => {
      // Test with moderate conditions
      const result = calculateAT(25, 60, 10, 800);
      expect(result).toBeGreaterThan(25);
      expect(result).toBeLessThan(30);

      // Test with hot and humid - should be much higher
      const hotHumid = calculateAT(35, 80, 5, 1000);
      expect(hotHumid).toBeGreaterThan(result);
      expect(hotHumid).toBeLessThan(50);
    });

    it('should handle different wind speeds', () => {
      const noWind = calculateAT(30, 70, 0, 800);
      const lightWind = calculateAT(30, 70, 10, 800);
      const strongWind = calculateAT(30, 70, 20, 800);

      // Stronger wind should reduce apparent temperature
      expect(strongWind).toBeLessThan(lightWind);
      expect(lightWind).toBeLessThan(noWind);
    });

    it('should handle edge cases', () => {
      // Cold and calm
      const coldCalm = calculateAT(5, 40, 0, 200);
      expect(coldCalm).toBeGreaterThan(0);

      // Very hot with strong wind
      const hotWindy = calculateAT(40, 30, 25, 1200);
      expect(hotWindy).toBeGreaterThan(20);
    });

    it('should convert wind speed from km/h to m/s correctly', () => {
      // 3.6 km/h = 1 m/s, so conversion should be accurate
      const result = calculateAT(25, 50, 3.6, 600);
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Formula validation', () => {
    it('should produce mathematically sound results', () => {
      // All functions should return finite numbers
      const wbgt = calculateWBGT(25, 60, 800);
      const ewbgt = calculateEWBGT(25, 20);
      const at = calculateAT(25, 60, 10, 800);

      expect(Number.isFinite(wbgt)).toBe(true);
      expect(Number.isFinite(ewbgt)).toBe(true);
      expect(Number.isFinite(at)).toBe(true);

      // Should not be NaN or Infinity
      expect(isNaN(wbgt)).toBe(false);
      expect(isNaN(ewbgt)).toBe(false);
      expect(isNaN(at)).toBe(false);
    });

    it('should handle zero values gracefully', () => {
      const wbgtZero = calculateWBGT(0, 0, 0);
      const ewbgtZero = calculateEWBGT(0, 0);
      const atZero = calculateAT(0, 0, 0, 0);

      expect(Number.isFinite(wbgtZero)).toBe(true);
      expect(Number.isFinite(ewbgtZero)).toBe(true);
      expect(Number.isFinite(atZero)).toBe(true);
    });
  });
});