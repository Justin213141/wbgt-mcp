/**
 * Tests for location constants
 * Tests timezone configurations and location definitions
 */

import { describe, it, expect } from 'vitest';
import {
  SYDNEY_TIMEZONE,
  JST_TIMEZONE,
  UTC_TIMEZONE,
  SYDNEY_LOCATION,
  TOKYO_LOCATION,
  NEW_YORK_LOCATION,
  DEFAULT_LOCATION,
  BOM_SYDNEY_LOCATION_ID,
  SUPPORTED_LOCATIONS,
} from '../location.constants';

describe('Location Constants', () => {
  describe('Timezone Configurations', () => {
    it('should export Sydney timezone configuration', () => {
      expect(SYDNEY_TIMEZONE).toHaveProperty('name', 'Australia/Sydney');
      expect(SYDNEY_TIMEZONE).toHaveProperty('abbreviation', 'AEDT/AEST');
      expect(SYDNEY_TIMEZONE).toHaveProperty('hasDST', true);
      expect(typeof SYDNEY_TIMEZONE.getOffset).toBe('function');
    });

    it('should export JST timezone configuration', () => {
      expect(JST_TIMEZONE).toHaveProperty('name', 'Asia/Tokyo');
      expect(JST_TIMEZONE).toHaveProperty('abbreviation', 'JST');
      expect(JST_TIMEZONE).toHaveProperty('hasDST', false);
      expect(typeof JST_TIMEZONE.getOffset).toBe('function');
    });

    it('should export UTC timezone configuration', () => {
      expect(UTC_TIMEZONE).toHaveProperty('name', 'UTC');
      expect(UTC_TIMEZONE).toHaveProperty('abbreviation', 'UTC');
      expect(UTC_TIMEZONE).toHaveProperty('hasDST', false);
      expect(typeof UTC_TIMEZONE.getOffset).toBe('function');
    });

    it('should calculate timezone offsets correctly', () => {
      // Test UTC
      const utcDate = new Date('2023-06-21T12:00:00Z');
      expect(UTC_TIMEZONE.getOffset(utcDate)).toBe(0);

      // Test JST (always UTC+9)
      expect(JST_TIMEZONE.getOffset(utcDate)).toBe(9 * 3600);

      // Test Sydney in June (should be UTC+10, no DST)
      const sydneyWinter = new Date('2023-06-21T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(sydneyWinter)).toBe(10 * 3600);

      // Test Sydney in December (should be UTC+11, DST active)
      const sydneySummer = new Date('2023-12-21T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(sydneySummer)).toBe(11 * 3600);
    });

    it('should handle Sydney DST transitions correctly', () => {
      // Test just before DST starts (first Sunday in October 2023)
      const beforeDST = new Date('2023-09-30T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(beforeDST)).toBe(10 * 3600);

      // Test just after DST starts
      const afterDST = new Date('2023-10-02T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(afterDST)).toBe(11 * 3600);

      // Test just before DST ends (first Sunday in April 2023)
      const beforeDSTEnd = new Date('2023-04-01T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(beforeDSTEnd)).toBe(11 * 3600);

      // Test just after DST ends
      const afterDSTEnd = new Date('2023-04-03T12:00:00Z');
      expect(SYDNEY_TIMEZONE.getOffset(afterDSTEnd)).toBe(10 * 3600);
    });
  });

  describe('Location Configurations', () => {
    it('should export Sydney location configuration', () => {
      expect(SYDNEY_LOCATION).toHaveProperty('name', 'Sydney, Australia');
      expect(SYDNEY_LOCATION).toHaveProperty('latitude', -33.8018);
      expect(SYDNEY_LOCATION).toHaveProperty('longitude', 151.1254);
      expect(SYDNEY_LOCATION).toHaveProperty('timezone', SYDNEY_TIMEZONE);
    });

    it('should export Tokyo location configuration', () => {
      expect(TOKYO_LOCATION).toHaveProperty('name', 'Tokyo, Japan');
      expect(TOKYO_LOCATION).toHaveProperty('latitude', 35.6762);
      expect(TOKYO_LOCATION).toHaveProperty('longitude', 139.6503);
      expect(TOKYO_LOCATION).toHaveProperty('timezone', JST_TIMEZONE);
    });

    it('should export New York location configuration', () => {
      expect(NEW_YORK_LOCATION).toHaveProperty('name', 'New York, USA');
      expect(NEW_YORK_LOCATION).toHaveProperty('latitude', 40.7128);
      expect(NEW_YORK_LOCATION).toHaveProperty('longitude', -74.006);
      expect(NEW_YORK_LOCATION).toHaveProperty('timezone', UTC_TIMEZONE);
    });

    it('should have valid coordinate ranges', () => {
      // Test latitude ranges (-90 to 90)
      expect(SYDNEY_LOCATION.latitude).toBeGreaterThanOrEqual(-90);
      expect(SYDNEY_LOCATION.latitude).toBeLessThanOrEqual(90);
      expect(TOKYO_LOCATION.latitude).toBeGreaterThanOrEqual(-90);
      expect(TOKYO_LOCATION.latitude).toBeLessThanOrEqual(90);
      expect(NEW_YORK_LOCATION.latitude).toBeGreaterThanOrEqual(-90);
      expect(NEW_YORK_LOCATION.latitude).toBeLessThanOrEqual(90);

      // Test longitude ranges (-180 to 180)
      expect(SYDNEY_LOCATION.longitude).toBeGreaterThanOrEqual(-180);
      expect(SYDNEY_LOCATION.longitude).toBeLessThanOrEqual(180);
      expect(TOKYO_LOCATION.longitude).toBeGreaterThanOrEqual(-180);
      expect(TOKYO_LOCATION.longitude).toBeLessThanOrEqual(180);
      expect(NEW_YORK_LOCATION.longitude).toBeGreaterThanOrEqual(-180);
      expect(NEW_YORK_LOCATION.longitude).toBeLessThanOrEqual(180);
    });
  });

  describe('Default Location', () => {
    it('should set Sydney as default location', () => {
      expect(DEFAULT_LOCATION).toBe(SYDNEY_LOCATION);
      expect(DEFAULT_LOCATION.name).toBe('Sydney, Australia');
    });
  });

  describe('BOM Location ID', () => {
    it('should export BOM Sydney location ID', () => {
      expect(BOM_SYDNEY_LOCATION_ID).toBe('r3grwp');
      expect(typeof BOM_SYDNEY_LOCATION_ID).toBe('string');
    });
  });

  describe('Supported Locations', () => {
    it('should export supported locations mapping', () => {
      expect(typeof SUPPORTED_LOCATIONS).toBe('object');
      expect(SUPPORTED_LOCATIONS).toHaveProperty('sydney', SYDNEY_LOCATION);
      expect(SUPPORTED_LOCATIONS).toHaveProperty('tokyo', TOKYO_LOCATION);
      expect(SUPPORTED_LOCATIONS).toHaveProperty('new-york', NEW_YORK_LOCATION);
    });

    it('should have correct location keys', () => {
      const keys = Object.keys(SUPPORTED_LOCATIONS);
      expect(keys).toContain('sydney');
      expect(keys).toContain('tokyo');
      expect(keys).toContain('new-york');
      expect(keys.length).toBe(3);
    });

    it('should have valid location objects in supported locations', () => {
      Object.values(SUPPORTED_LOCATIONS).forEach(location => {
        expect(location).toHaveProperty('name');
        expect(location).toHaveProperty('latitude');
        expect(location).toHaveProperty('longitude');
        expect(location).toHaveProperty('timezone');
        expect(typeof location.name).toBe('string');
        expect(typeof location.latitude).toBe('number');
        expect(typeof location.longitude).toBe('number');
        expect(typeof location.timezone).toBe('object');
      });
    });
  });

  describe('Type Consistency', () => {
    it('should have consistent location object structure', () => {
      const locations = [SYDNEY_LOCATION, TOKYO_LOCATION, NEW_YORK_LOCATION];

      locations.forEach(location => {
        expect(typeof location.name).toBe('string');
        expect(typeof location.latitude).toBe('number');
        expect(typeof location.longitude).toBe('number');
        expect(typeof location.timezone).toBe('object');
        expect(location.name.length).toBeGreaterThan(0);
        expect(Number.isFinite(location.latitude)).toBe(true);
        expect(Number.isFinite(location.longitude)).toBe(true);
      });
    });

    it('should have consistent timezone object structure', () => {
      const timezones = [SYDNEY_TIMEZONE, JST_TIMEZONE, UTC_TIMEZONE];

      timezones.forEach(timezone => {
        expect(typeof timezone.name).toBe('string');
        expect(typeof timezone.abbreviation).toBe('string');
        expect(typeof timezone.hasDST).toBe('boolean');
        expect(typeof timezone.getOffset).toBe('function');
        expect(timezone.name.length).toBeGreaterThan(0);
        expect(timezone.abbreviation.length).toBeGreaterThan(0);
      });
    });
  });
});