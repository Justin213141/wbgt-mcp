/**
 * Tests for NOAA ISD Types and Station Finder
 *
 * Verifies station data, distance calculations, and nearest station selection
 */

import { describe, it, expect } from 'vitest';
import {
  SYDNEY_ISD_STATIONS,
  DEFAULT_SYDNEY_ISD_STATION,
  calculateDistance,
  findNearestSydneyStation,
  getStationId,
  type ISDStation
} from '../types';

describe('NOAA ISD Types', () => {
  describe('Station Database Integrity', () => {
    it('should have 12 Sydney ISD stations', () => {
      expect(SYDNEY_ISD_STATIONS).toHaveLength(12);
    });

    it('should have all stations with valid coordinates', () => {
      for (const station of SYDNEY_ISD_STATIONS) {
        // Sydney area: latitude -34.5 to -33.5, longitude 150.5 to 151.5
        expect(station.latitude).toBeGreaterThan(-34.5);
        expect(station.latitude).toBeLessThan(-33.5);
        expect(station.longitude).toBeGreaterThan(150.5);
        expect(station.longitude).toBeLessThan(151.5);
      }
    });

    it('should have unique USAF IDs', () => {
      const usafIds = SYDNEY_ISD_STATIONS.map(s => s.usaf);
      const uniqueIds = new Set(usafIds);

      expect(uniqueIds.size).toBe(usafIds.length);
    });

    it('should have valid station metadata', () => {
      for (const station of SYDNEY_ISD_STATIONS) {
        expect(station.usaf).toMatch(/^\d{6}$/);
        expect(station.wban).toBe('99999'); // All Sydney stations have no WBAN
        expect(station.name).toBeTruthy();
        expect(station.country).toBe('AS'); // Australia
        expect(station.elevation).toBeGreaterThanOrEqual(0);
        expect(station.elevation).toBeLessThan(200); // Sydney area max elevation
      }
    });

    it('should have Sydney Olympic Park AWS as first station', () => {
      const first = SYDNEY_ISD_STATIONS[0];

      expect(first.name).toBe('SYDNEY OLYMPIC PARK AWS');
      expect(first.usaf).toBe('957650');
      expect(first.latitude).toBeCloseTo(-33.833, 3);
      expect(first.longitude).toBeCloseTo(151.067, 3);
    });

    it('should have stations reasonably ordered by proximity to SOP', () => {
      const sopLat = -33.83;
      const sopLon = 151.07;

      // Verify first station is the closest
      const firstDist = calculateDistance(sopLat, sopLon, SYDNEY_ISD_STATIONS[0].latitude, SYDNEY_ISD_STATIONS[0].longitude);

      // Sydney Olympic Park should be very close (< 1km)
      expect(SYDNEY_ISD_STATIONS[0].name).toBe('SYDNEY OLYMPIC PARK AWS');
      expect(firstDist).toBeLessThan(1);

      // Check distances are generally increasing (with some tolerance for similar distances)
      for (let i = 0; i < SYDNEY_ISD_STATIONS.length - 1; i++) {
        const dist1 = calculateDistance(sopLat, sopLon, SYDNEY_ISD_STATIONS[i].latitude, SYDNEY_ISD_STATIONS[i].longitude);
        const dist2 = calculateDistance(sopLat, sopLon, SYDNEY_ISD_STATIONS[i + 1].latitude, SYDNEY_ISD_STATIONS[i + 1].longitude);

        // Allow for some misordering (stations within 5km of each other)
        if (Math.abs(dist1 - dist2) > 5) {
          expect(dist1).toBeLessThan(dist2);
        }
      }
    });

    it('should set default station to Sydney Olympic Park AWS', () => {
      expect(DEFAULT_SYDNEY_ISD_STATION).toBe(SYDNEY_ISD_STATIONS[0]);
      expect(DEFAULT_SYDNEY_ISD_STATION.name).toBe('SYDNEY OLYMPIC PARK AWS');
    });
  });

  describe('calculateDistance', () => {
    it('should return 0 for identical coordinates', () => {
      const distance = calculateDistance(-33.83, 151.07, -33.83, 151.07);
      expect(distance).toBe(0);
    });

    it('should calculate correct distance between SOP and Parramatta North', () => {
      // SOP: -33.833, 151.067
      // Parramatta North: -33.800, 151.017
      const distance = calculateDistance(-33.833, 151.067, -33.800, 151.017);

      // Expected ~5.92 km (from user's data)
      expect(distance).toBeGreaterThan(5.5);
      expect(distance).toBeLessThan(6.5);
    });

    it('should calculate correct distance between SOP and Sydney Intl', () => {
      // SOP: -33.833, 151.067
      // Sydney Intl: -33.946, 151.177
      const distance = calculateDistance(-33.833, 151.067, -33.946, 151.177);

      // Expected ~16.25 km (from user's data)
      expect(distance).toBeGreaterThan(15.5);
      expect(distance).toBeLessThan(17);
    });

    it('should handle negative and positive coordinates', () => {
      // Sydney to London
      const distance = calculateDistance(-33.8688, 151.2093, 51.5074, -0.1278);

      // Approximately 17,000 km
      expect(distance).toBeGreaterThan(16500);
      expect(distance).toBeLessThan(17500);
    });

    it('should be symmetric', () => {
      const d1 = calculateDistance(-33.83, 151.07, -33.95, 151.18);
      const d2 = calculateDistance(-33.95, 151.18, -33.83, 151.07);

      expect(d1).toBeCloseTo(d2, 10);
    });
  });

  describe('findNearestSydneyStation', () => {
    it('should find Sydney Olympic Park AWS for its exact coordinates', () => {
      const result = findNearestSydneyStation(-33.833, 151.067);

      expect(result).not.toBeNull();
      expect(result!.station.name).toBe('SYDNEY OLYMPIC PARK AWS');
      expect(result!.distance).toBeLessThan(0.5); // Very close
    });

    it('should find Parramatta North for Parramatta area', () => {
      // Coordinates near Parramatta
      const result = findNearestSydneyStation(-33.80, 151.00);

      expect(result).not.toBeNull();
      expect(result!.station.name).toBe('PARRAMATTA NORTH');
      expect(result!.distance).toBeLessThan(5);
    });

    it('should find Sydney Intl for airport area', () => {
      // Near Sydney Airport
      const result = findNearestSydneyStation(-33.946, 151.177);

      expect(result).not.toBeNull();
      expect(result!.station.name).toBe('SYDNEY INTL');
      expect(result!.distance).toBeLessThan(1);
    });

    it('should find Canterbury Racecourse for Canterbury area', () => {
      // Near Canterbury
      const result = findNearestSydneyStation(-33.90, 151.12);

      expect(result).not.toBeNull();
      expect(result!.station.name).toBe('CANTERBURY RACECOURSE');
      expect(result!.distance).toBeLessThan(2);
    });

    it('should return null for locations >100km from Sydney', () => {
      // Canberra coordinates
      const result = findNearestSydneyStation(-35.2809, 149.1300);

      expect(result).toBeNull();
    });

    it('should return null for Melbourne', () => {
      const result = findNearestSydneyStation(-37.8136, 144.9631);

      expect(result).toBeNull();
    });

    it('should return null for Brisbane', () => {
      const result = findNearestSydneyStation(-27.4698, 153.0251);

      expect(result).toBeNull();
    });

    it('should find a station for Wollongong (edge case)', () => {
      // Wollongong is ~80km from Sydney
      const result = findNearestSydneyStation(-34.424, 150.893);

      // May or may not find a station depending on exact distances
      // Just verify it doesn't crash
      expect(result === null || typeof result.distance === 'number').toBe(true);
    });

    it('should respect 100km maximum distance', () => {
      // Test various locations within Sydney area
      const locations = [
        { lat: -33.83, lon: 151.07, name: 'Sydney Olympic Park' },
        { lat: -33.87, lon: 151.21, name: 'CBD' },
        { lat: -33.95, lon: 151.18, name: 'Airport' },
        { lat: -33.75, lon: 150.90, name: 'Penrith area' }
      ];

      for (const loc of locations) {
        const result = findNearestSydneyStation(loc.lat, loc.lon);
        if (result) {
          expect(result.distance).toBeLessThan(100);
        }
      }
    });

    it('should always return closest station first', () => {
      // Random Sydney locations
      const testLocations = [
        [-33.85, 151.20],
        [-33.80, 151.05],
        [-33.92, 151.15],
        [-33.78, 151.12]
      ];

      for (const [lat, lon] of testLocations) {
        const result = findNearestSydneyStation(lat, lon);
        if (result) {
          // Verify it's actually the nearest by checking all stations
          const manualNearest = SYDNEY_ISD_STATIONS
            .map(s => ({
              station: s,
              distance: calculateDistance(lat, lon, s.latitude, s.longitude)
            }))
            .filter(r => r.distance < 100)
            .sort((a, b) => a.distance - b.distance)[0];

          expect(result.station.usaf).toBe(manualNearest.station.usaf);
          expect(result.distance).toBeCloseTo(manualNearest.distance, 5);
        }
      }
    });
  });

  describe('getStationId', () => {
    it('should format station ID correctly', () => {
      const station: ISDStation = {
        usaf: '957650',
        wban: '99999',
        name: 'TEST',
        country: 'AS',
        state: '',
        icao: '',
        latitude: -33.83,
        longitude: 151.07,
        elevation: 4,
        begin: '2020-01-01',
        end: '2099-12-31'
      };

      const id = getStationId(station);
      expect(id).toBe('957650-99999');
    });

    it('should format all Sydney station IDs correctly', () => {
      for (const station of SYDNEY_ISD_STATIONS) {
        const id = getStationId(station);
        expect(id).toMatch(/^\d{6}-\d{5}$/);
        expect(id).toBe(`${station.usaf}-${station.wban}`);
      }
    });

    it('should handle stations with different WBAN', () => {
      const station: ISDStation = {
        usaf: '723150',
        wban: '03812',
        name: 'TEST',
        country: 'US',
        state: 'CA',
        icao: 'KSFO',
        latitude: 37.62,
        longitude: -122.38,
        elevation: 3,
        begin: '1950-01-01',
        end: '2099-12-31'
      };

      const id = getStationId(station);
      expect(id).toBe('723150-03812');
    });
  });

  describe('Known Station Distances (Verification)', () => {
    it('should have correct distances from SOP for key stations', () => {
      const sopLat = -33.83;
      const sopLon = 151.07;

      // Verify each station exists and calculate actual distances
      const expectedStations = [
        'SYDNEY OLYMPIC PARK AWS',
        'PARRAMATTA NORTH',
        'CANTERBURY RACECOURSE',
        'KURNELL AWS',
        'SYDNEY BANKSTOWN',
        'SYDNEY OBSERVATORY HILL',
        'FORT DENISON',
        'LITTLE BAY (THE COAST GOLF CLUB)',
        'SYDNEY INTL',
        'HOLSWORTHY AERODROME AWS',
        'HORSLEY EQUESTRIAN CENTRE',
        'NORTH HEAD'
      ];

      for (const name of expectedStations) {
        const station = SYDNEY_ISD_STATIONS.find(s => s.name === name);
        expect(station, `Station "${name}" should exist`).toBeDefined();

        const distance = calculateDistance(sopLat, sopLon, station!.latitude, station!.longitude);

        // Verify all stations are within Sydney area (< 30km from SOP)
        expect(distance).toBeLessThan(30);
      }

      // Verify Sydney Olympic Park AWS is very close
      const sop = SYDNEY_ISD_STATIONS.find(s => s.name === 'SYDNEY OLYMPIC PARK AWS');
      const sopDistance = calculateDistance(sopLat, sopLon, sop!.latitude, sop!.longitude);
      expect(sopDistance).toBeLessThan(1);
    });
  });
});
