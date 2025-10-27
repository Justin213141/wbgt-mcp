/**
 * Tests for Solar Geometry Calculations
 * Tests branch coverage for timezone-specific solar zenith angle calculations
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSolarZenithAngleByTimezone,
  calculateSolarZenithAngle,
  calculateSolarZenithAngleJST
} from '../solar-geometry';

describe('Solar Geometry Calculations', () => {
  describe('calculateSolarZenithAngleByTimezone', () => {
    it('should route to Sydney calculation for UTC+10 with DST', () => {
      const result = calculateSolarZenithAngleByTimezone(
        -33.8018,
        151.1254,
        '2023-06-21T12:00',
        10,
        true
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should route to JST calculation for UTC+9 without DST', () => {
      const result = calculateSolarZenithAngleByTimezone(
        35.6762,
        139.6503,
        '2023-06-21T12:00',
        9,
        false
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should throw error for unsupported timezone (UTC+8 with DST)', () => {
      expect(() => {
        calculateSolarZenithAngleByTimezone(
          1.3521,
          103.8198,
          '2023-06-21T12:00',
          8,
          true
        );
      }).toThrow('Unsupported timezone');
    });

    it('should throw error for unsupported timezone (UTC+10 without DST)', () => {
      expect(() => {
        calculateSolarZenithAngleByTimezone(
          -33.8018,
          151.1254,
          '2023-06-21T12:00',
          10,
          false
        );
      }).toThrow('Unsupported timezone');
    });

    it('should throw error for unsupported timezone (UTC+9 with DST)', () => {
      expect(() => {
        calculateSolarZenithAngleByTimezone(
          35.6762,
          139.6503,
          '2023-06-21T12:00',
          9,
          true
        );
      }).toThrow('Unsupported timezone');
    });
  });

  describe('calculateSolarZenithAngle (Sydney timezone)', () => {
    it('should handle DST calculation correctly for summer month', () => {
      // January is DST in Sydney (UTC+11)
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-01-21T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle DST calculation correctly for winter month', () => {
      // June is non-DST in Sydney (UTC+10)
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-06-21T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle DST boundary correctly for October', () => {
      // October is DST in Sydney
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-10-15T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle DST boundary correctly for March', () => {
      // March is DST in Sydney
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-03-15T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle day rollover from UTC conversion (early morning)', () => {
      // Very early morning Sydney time should cause day rollover in UTC
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-06-21T01:00' // 1 AM Sydney time = previous day UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle month rollover from UTC conversion', () => {
      // First day of month at early hour in DST
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-10-01T01:00' // 1 AM Sydney time on Oct 1 = Sept 30 UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle year rollover from UTC conversion', () => {
      // First day of year at early hour in DST
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-01-01T01:00' // 1 AM Sydney time on Jan 1 = Dec 31 previous year UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle February 29 in leap year during day rollover', () => {
      // Test the leap year calculation branch that's not covered
      // March 1 at early hour in a leap year, which should roll back to Feb 29
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2024-03-01T01:00' // 1 AM Sydney time on March 1 = Feb 29 UTC in leap year
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle leap year calculations correctly', () => {
      // February 29 in a leap year
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2024-02-29T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle edge case of maximum solar elevation (solar noon)', () => {
      // Solar noon should give lowest zenith angle
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-06-21T12:00'
      );

      expect(result).toBeLessThan(90); // Should be relatively low at solar noon
    });

    it('should handle edge case of nighttime (high zenith angle)', () => {
      // Nighttime should give high zenith angle
      const result = calculateSolarZenithAngle(
        -33.8018,
        151.1254,
        '2023-06-21T00:00' // Midnight
      );

      expect(result).toBeGreaterThan(90); // Should be high at night
    });

    it('should handle boundary values correctly', () => {
      // Test boundary conditions for zenith angle clamping
      const result1 = calculateSolarZenithAngle(90, 0, '2023-06-21T12:00'); // North pole
      const result2 = calculateSolarZenithAngle(-90, 0, '2023-06-21T12:00'); // South pole

      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result1).toBeLessThanOrEqual(180);
      expect(result2).toBeGreaterThanOrEqual(0);
      expect(result2).toBeLessThanOrEqual(180);
    });
  });

  describe('calculateSolarZenithAngleJST (Tokyo timezone)', () => {
    it('should calculate zenith angle for Tokyo coordinates', () => {
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-06-21T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle day rollover from UTC conversion in JST', () => {
      // Early morning JST should cause day rollover in UTC
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-06-21T01:00' // 1 AM JST = previous day UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle month rollover from UTC conversion in JST', () => {
      // First day of month at early hour
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-04-01T01:00' // 1 AM JST on April 1 = March 31 UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle year rollover from UTC conversion in JST', () => {
      // First day of year at early hour
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-01-01T01:00' // 1 AM JST on Jan 1 = Dec 31 previous year UTC
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle February 29 in leap year during day rollover in JST', () => {
      // Test the leap year calculation branch for JST function
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2024-03-01T01:00' // 1 AM JST on March 1 = Feb 29 UTC in leap year
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle leap year calculations correctly in JST', () => {
      // February 29 in a leap year
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2024-02-29T12:00'
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
    });

    it('should handle summer solstice (maximum solar elevation)', () => {
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-06-21T12:00' // Summer solstice in Northern Hemisphere
      );

      expect(result).toBeLessThan(60); // Should be relatively low at noon in summer
    });

    it('should handle winter solstice (minimum solar elevation)', () => {
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-12-21T12:00' // Winter solstice in Northern Hemisphere
      );

      expect(result).toBeGreaterThan(30); // Should be higher than summer solstice at noon
      expect(result).toBeLessThan(90); // Still should be above horizon at noon
    });

    it('should handle nighttime calculations in JST', () => {
      const result = calculateSolarZenithAngleJST(
        35.6762,
        139.6503,
        '2023-06-21T00:00' // Midnight JST
      );

      expect(result).toBeGreaterThan(90); // Should be high at night
    });

    it('should handle boundary values for JST', () => {
      const result1 = calculateSolarZenithAngleJST(90, 0, '2023-06-21T12:00'); // North pole
      const result2 = calculateSolarZenithAngleJST(-90, 0, '2023-06-21T12:00'); // South pole

      expect(result1).toBeGreaterThanOrEqual(0);
      expect(result1).toBeLessThanOrEqual(180);
      expect(result2).toBeGreaterThanOrEqual(0);
      expect(result2).toBeLessThanOrEqual(180);
    });
  });

  describe('Calculation consistency and validation', () => {
    it('should give same result for same conditions regardless of routing method', () => {
      // Test that both calculation methods give consistent results for same input
      const timestamp = '2023-06-21T12:00';

      const sydneyResult = calculateSolarZenithAngle(-33.8018, 151.1254, timestamp);
      const routedResult = calculateSolarZenithAngleByTimezone(-33.8018, 151.1254, timestamp, 10, true);

      expect(sydneyResult).toBeCloseTo(routedResult, 5);
    });

    it('should handle different locations correctly', () => {
      // Test different latitudes on June 21 (summer solstice Northern Hemisphere)
      const equatorResult = calculateSolarZenithAngle(0, 0, '2023-06-21T12:00');
      const sydneyResult = calculateSolarZenithAngle(-33.8018, 151.1254, '2023-06-21T12:00');
      const tokyoResult = calculateSolarZenithAngleJST(35.6762, 139.6503, '2023-06-21T12:00');

      // All results should be in valid range
      expect(equatorResult).toBeGreaterThanOrEqual(0);
      expect(equatorResult).toBeLessThanOrEqual(180);
      expect(sydneyResult).toBeGreaterThanOrEqual(0);
      expect(sydneyResult).toBeLessThanOrEqual(180);
      expect(tokyoResult).toBeGreaterThanOrEqual(0);
      expect(tokyoResult).toBeLessThanOrEqual(180);

      // On June 21, Tokyo (Northern Hemisphere summer) should have lower zenith angle than Sydney (Southern Hemisphere winter)
      expect(tokyoResult).toBeLessThan(sydneyResult);
    });

    it('should handle extreme coordinate values', () => {
      // Test at the poles and date line
      const northPole = calculateSolarZenithAngle(90, 0, '2023-06-21T12:00');
      const southPole = calculateSolarZenithAngle(-90, 0, '2023-12-21T12:00');
      const dateLine = calculateSolarZenithAngle(0, 180, '2023-06-21T12:00');

      expect(northPole).toBeGreaterThanOrEqual(0);
      expect(northPole).toBeLessThanOrEqual(180);
      expect(southPole).toBeGreaterThanOrEqual(0);
      expect(southPole).toBeLessThanOrEqual(180);
      expect(dateLine).toBeGreaterThanOrEqual(0);
      expect(dateLine).toBeLessThanOrEqual(180);
    });
  });
});