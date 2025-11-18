/**
 * Tests for Station Finder Utility
 *
 * Verifies Haversine distance calculations and nearest station selection
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHaversineDistance,
  findNearestStation,
  findNearestStationOrDefault,
  determineDataSource
} from '../src/utils/station-finder';
import { DEFAULT_BOM_STATION, SYDNEY_BOM_STATIONS, ALL_BOM_STATIONS } from '../src/data/bom-stations';

describe('Station Finder Utility', () => {
  describe('calculateHaversineDistance', () => {
    it('should calculate distance between Sydney Olympic Park and Observatory Hill', () => {
      // Sydney Olympic Park: -33.83, 151.07
      // Observatory Hill: -33.86, 151.20
      const distance = calculateHaversineDistance(-33.83, 151.07, -33.86, 151.20);

      // Expected distance ~11-12 km
      expect(distance).toBeGreaterThan(10);
      expect(distance).toBeLessThan(13);
    });

    it('should return 0 for identical coordinates', () => {
      const distance = calculateHaversineDistance(-33.83, 151.07, -33.83, 151.07);
      expect(distance).toBe(0);
    });

    it('should calculate correct distance for known locations', () => {
      // Sydney to Melbourne (approx 714 km)
      const distance = calculateHaversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);

      // Allow 1% margin of error
      expect(distance).toBeGreaterThan(700);
      expect(distance).toBeLessThan(730);
    });

    it('should handle negative and positive coordinates', () => {
      // Test with different hemispheres
      const distance = calculateHaversineDistance(40.7128, -74.0060, 51.5074, -0.1278);

      // New York to London (approx 5570 km)
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });
  });

  describe('findNearestStation', () => {
    it('should find Sydney Olympic Park as nearest to its own coordinates', () => {
      const result = findNearestStation(-33.83, 151.07);

      expect(result).not.toBeNull();
      expect(result!.station.name).toBe('Sydney Olympic Park AWS (Archery Centre)');
      expect(result!.distance).toBeLessThan(0.1); // Very close
    });

    it('should find Observatory Hill for Circular Quay area', () => {
      // Circular Quay coordinates (approximately)
      const result = findNearestStation(-33.8612, 151.2110);

      expect(result).not.toBeNull();
      expect(result!.station.name).toContain('Observatory Hill');
      expect(result!.distance).toBeLessThan(5); // Within 5 km
    });

    it('should find Parramatta station for Parramatta coordinates', () => {
      // Parramatta area
      const result = findNearestStation(-33.8166, 151.0010);

      expect(result).not.toBeNull();
      expect(result!.station.name).toContain('Parramatta');
      expect(result!.distance).toBeLessThan(5);
    });

    it('should find Sydney Airport for airport coordinates', () => {
      // Sydney Airport area
      const result = findNearestStation(-33.946, 151.177);

      expect(result).not.toBeNull();
      expect(result!.station.name).toContain('Sydney Airport');
      expect(result!.distance).toBeLessThan(2);
    });

    it('should return null for locations far outside Sydney (>50km)', () => {
      // Canberra coordinates
      const result = findNearestStation(-35.2809, 149.1300);

      expect(result).toBeNull();
    });

    it('should return null for Melbourne coordinates', () => {
      // Melbourne
      const result = findNearestStation(-37.8136, 144.9631);

      expect(result).toBeNull();
    });

    it('should respect custom maximum distance', () => {
      // Use a very small max distance
      const result = findNearestStation(-33.85, 151.05, 1); // 1 km limit

      // Should find a station but very close, or possibly null depending on exact locations
      if (result) {
        expect(result.distance).toBeLessThan(1);
      }
    });
  });

  describe('findNearestStationOrDefault', () => {
    it('should return nearest station for Sydney coordinates', () => {
      const station = findNearestStationOrDefault(-33.83, 151.07);

      expect(station.name).toBe('Sydney Olympic Park AWS (Archery Centre)');
    });

    it('should return default station for locations outside 50km', () => {
      // Canberra
      const station = findNearestStationOrDefault(-35.2809, 149.1300);

      expect(station).toEqual(DEFAULT_BOM_STATION);
      expect(station.name).toBe('Sydney Olympic Park AWS (Archery Centre)');
    });
  });

  describe('determineDataSource', () => {
    it('should return BOM station for Sydney coordinates', () => {
      const result = determineDataSource(-33.83, 151.07);

      expect(result.station).not.toBeNull();
      expect(result.source).toBe('Sydney Olympic Park AWS (Archery Centre)');
      expect(result.distance).toBeDefined();
      expect(result.distance).toBeLessThan(0.1);
    });

    it('should return OpenMeteo for locations outside Sydney', () => {
      // Canberra
      const result = determineDataSource(-35.2809, 149.1300);

      expect(result.station).toBeNull();
      expect(result.source).toBe('OpenMeteo');
      expect(result.distance).toBeUndefined();
    });

    it('should include distance for nearby stations', () => {
      // Circular Quay
      const result = determineDataSource(-33.8612, 151.2110);

      expect(result.station).not.toBeNull();
      expect(result.distance).toBeDefined();
      expect(result.distance!).toBeGreaterThan(0);
      expect(result.distance!).toBeLessThan(50);
    });

    it('should return appropriate station for Penrith area', () => {
      // Penrith coordinates
      const result = determineDataSource(-33.75, 150.69);

      expect(result.station).not.toBeNull();
      expect(result.source).toContain('Penrith');
    });

    it('should return appropriate station for Newcastle area', () => {
      // Newcastle coordinates (should be within range)
      const result = determineDataSource(-32.93, 151.78);

      expect(result.station).not.toBeNull();
      expect(result.source).toContain('Newcastle');
    });

    it('should return Ulladulla for Lake Conjola area', () => {
      // Lake Conjola coordinates
      const result = determineDataSource(-35.265, 150.474);

      expect(result.station).not.toBeNull();
      expect(result.source).toBe('Ulladulla AWS');
      expect(result.distance).toBeDefined();
      expect(result.distance!).toBeGreaterThan(10);
      expect(result.distance!).toBeLessThan(12);
    });
  });

  describe('Station Database Integrity', () => {
    it('should have all stations with valid coordinates', () => {
      for (const station of SYDNEY_BOM_STATIONS) {
        expect(station.latitude).toBeGreaterThan(-40);
        expect(station.latitude).toBeLessThan(-30);
        expect(station.longitude).toBeGreaterThan(145);
        expect(station.longitude).toBeLessThan(155);
      }
    });

    it('should have unique station codes across all stations', () => {
      const codes = ALL_BOM_STATIONS.map(s => s.code);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
      expect(codes.length).toBe(32); // 31 Sydney + 1 South Coast
    });

    it('should have valid JSON URLs for all stations', () => {
      for (const station of ALL_BOM_STATIONS) {
        expect(station.jsonUrl).toMatch(/^http:\/\/www\.bom\.gov\.au\/fwo\/IDN60[89]01\/IDN60[89]01\.\d+\.json$/);
      }
    });

    it('should have default station in the database', () => {
      const found = SYDNEY_BOM_STATIONS.find(s => s.code === DEFAULT_BOM_STATION.code);
      expect(found).toBeDefined();
      expect(found).toEqual(DEFAULT_BOM_STATION);
    });
  });
});
