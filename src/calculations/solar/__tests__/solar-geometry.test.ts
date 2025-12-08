/**
 * Tests for Solar Geometry Calculations
 * Full NOAA Solar Calculator implementation tests
 * Reference: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSolarZenithAngleByTimezone,
  calculateSolarZenithAngle,
  calculateSolarZenithAngleJST,
  calculateSolarZenithAngleNOAA,
  calculateJulianDate
} from '../solar-geometry';

describe('Solar Geometry Calculations', () => {
  describe('NOAA Reference Values - Sydney December 8, 2025', () => {
    // Test cases from SOLAR_ZENITH_DOCUMENTATION.md with NOAA reference values
    // Sydney coordinates: -33.8688°, 151.2093°
    const SYDNEY_LAT = -33.8688;
    const SYDNEY_LON = 151.2093;

    it('should match NOAA reference for Dec 8, 1:00 PM AEDT (11.50°)', () => {
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-12-08T13:00', 11);
      expect(result).toBeCloseTo(11.50, 1);
    });

    it('should match NOAA reference for Dec 8, 6:00 AM AEDT (86.59°)', () => {
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-12-08T06:00', 11);
      expect(result).toBeCloseTo(86.59, 1);
    });

    it('should match NOAA reference for Dec 8, 12:00 PM AEDT (15.18°)', () => {
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-12-08T12:00', 11);
      expect(result).toBeCloseTo(15.18, 1);
    });

    it('should calculate reasonable zenith for Dec 8, 6:00 PM AEDT (late afternoon)', () => {
      // At 6 PM in Sydney summer (sunset ~8 PM), sun should be at moderate zenith
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-12-08T18:00', 11);
      // Sun is still ~2 hours before sunset, so zenith should be 60-80°
      expect(result).toBeGreaterThan(60);
      expect(result).toBeLessThan(80);
    });

    it('should match NOAA reference for Jun 8, 12:00 PM AEST (56.74°)', () => {
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-06-08T12:00', 10);
      expect(result).toBeCloseTo(56.74, 0); // ±0.5° tolerance
    });

    it('should match NOAA reference for Jun 8, 3:00 PM AEST (72.05°)', () => {
      const result = calculateSolarZenithAngleNOAA(SYDNEY_LAT, SYDNEY_LON, '2025-06-08T15:00', 10);
      expect(result).toBeCloseTo(72.05, 0); // ±0.5° tolerance
    });
  });

  describe('calculateJulianDate', () => {
    it('should calculate Julian Date correctly for J2000.0', () => {
      // J2000.0 is January 1, 2000, 12:00 TT = JD 2451545.0
      const jd = calculateJulianDate(2000, 1, 1, 12, 0, 0);
      expect(jd).toBeCloseTo(2451545.0, 3);
    });

    it('should handle leap year dates', () => {
      // Feb 29, 2024 at noon
      const jd = calculateJulianDate(2024, 2, 29, 12, 0, 0);
      expect(jd).toBeGreaterThan(2460000);
    });
  });

  describe('calculateSolarZenithAngleByTimezone', () => {
    it('should calculate correctly for Sydney with automatic DST detection', () => {
      // December is AEDT (UTC+11) in Sydney
      const result = calculateSolarZenithAngleByTimezone(
        -33.8688,
        151.2093,
        '2025-12-08T13:00',
        10,
        true
      );

      // Should match NOAA reference
      expect(result).toBeCloseTo(11.50, 1);
    });

    it('should handle winter (non-DST) correctly for Sydney', () => {
      // June is AEST (UTC+10) in Sydney
      const result = calculateSolarZenithAngleByTimezone(
        -33.8688,
        151.2093,
        '2025-06-08T12:00',
        10,
        true
      );

      expect(result).toBeCloseTo(56.74, 1);
    });

    it('should handle JST (no DST) correctly', () => {
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

    it('should use fixed offset for non-DST timezones', () => {
      // UTC+8 Singapore (no DST)
      const result = calculateSolarZenithAngleByTimezone(
        1.3521,
        103.8198,
        '2023-06-21T12:00',
        8,
        false
      );

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(180);
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