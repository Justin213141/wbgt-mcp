/**
 * Tests for Solar Radiation Service
 * Tests the tiered solar radiation data fetching system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolarRadiationService, type SolarRadiationOptions } from '../solar-radiation.service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('SolarRadiationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isCurrentDay', () => {
    it('should identify current day correctly', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      expect(SolarRadiationService['isCurrentDay'](todayStr)).toBe(true);
    });

    it('should identify past day correctly', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      expect(SolarRadiationService['isCurrentDay'](yesterdayStr)).toBe(false);
    });

    it('should identify future day correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      expect(SolarRadiationService['isCurrentDay'](tomorrowStr)).toBe(false);
    });
  });

  describe('fetchSolarRadiation', () => {
    const mockOptions: SolarRadiationOptions = {
      latitude: -33.8018,
      longitude: 151.1254,
      date: '2023-06-21',
      timezone: 'Australia/Sydney'
    };

    it('should use satellite API for current day', async () => {
      // Mock current day
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentDayOptions = { ...mockOptions, date: todayStr };

      // Mock satellite API response with valid daytime data
      const mockSatelliteResponse = {
        hourly: {
          time: [`${todayStr}T12:00:00`],
          shortwave_radiation_instant: [800],
          direct_radiation_instant: [600],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSatelliteResponse
      });

      const result = await SolarRadiationService.fetchSolarRadiation(currentDayOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('satellite_himawari');
      expect(result.data?.shortwave_radiation_instant).toEqual([800]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('satellite-api.open-meteo.com')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('models=jma_jaxa_himawari')
      );
    });

    it('should use archive API for historical day', async () => {
      // Mock archive API response
      const mockArchiveResponse = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          shortwave_radiation_instant: [750],
          direct_radiation_instant: [550],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockArchiveResponse
      });

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('archive_historical');
      expect(result.data?.shortwave_radiation_instant).toEqual([750]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('archive-api.open-meteo.com')
      );
    });

    it('should fall back to archive API if satellite data is invalid', async () => {
      // Mock current day
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentDayOptions = { ...mockOptions, date: todayStr };

      // Mock satellite API response with invalid data (no daytime radiation)
      const mockSatelliteResponse = {
        hourly: {
          time: [`${todayStr}T12:00:00`, `${todayStr}T00:00:00`],
          shortwave_radiation_instant: [0, 0], // All zeros, invalid for daytime
          direct_radiation_instant: [0, 0],
          diffuse_radiation_instant: [0, 0]
        }
      };

      // Mock archive API response for fallback
      const mockArchiveResponse = {
        hourly: {
          time: [`${todayStr}T12:00:00`],
          shortwave_radiation_instant: [800],
          direct_radiation_instant: [600],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSatelliteResponse // Himawari fails (invalid data)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSatelliteResponse // Best model also fails (invalid data)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockArchiveResponse // Archive fallback succeeds
        });

      const result = await SolarRadiationService.fetchSolarRadiation(currentDayOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('archive_current');
      expect(mockFetch).toHaveBeenCalledTimes(3); // Himawari, best_model, then archive fallback
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Archive API error: 500');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('hasValidDaytimeData', () => {
    it('should detect valid daytime radiation data', () => {
      const validData = {
        time: ['2023-06-21T12:00:00', '2023-06-21T15:00:00'],
        shortwave_radiation_instant: [800, 600]
      };

      expect(SolarRadiationService['hasValidDaytimeData'](validData)).toBe(true);
    });

    it('should reject data with no daytime radiation', () => {
      const invalidData = {
        time: ['2023-06-21T12:00:00', '2023-06-21T15:00:00'],
        shortwave_radiation_instant: [0, 0] // All zeros, even during daytime
      };

      expect(SolarRadiationService['hasValidDaytimeData'](invalidData)).toBe(false);
    });

    it('should accept nighttime zeros as valid', () => {
      const dataWithNighttime = {
        time: ['2023-06-21T02:00:00', '2023-06-21T12:00:00'],
        shortwave_radiation_instant: [0, 800] // Zero at night, non-zero during day
      };

      expect(SolarRadiationService['hasValidDaytimeData'](dataWithNighttime)).toBe(true);
    });

    it('should handle empty data', () => {
      expect(SolarRadiationService['hasValidDaytimeData']()).toBe(false);
      expect(SolarRadiationService['hasValidDaytimeData']({})).toBe(false);
    });
  });

  describe('extractRadiationForDate', () => {
    const mockResult = {
      success: true,
      data: {
        time: [
          '2023-06-20T23:00:00',
          '2023-06-21T00:00:00',
          '2023-06-21T12:00:00',
          '2023-06-21T23:00:00',
          '2023-06-22T00:00:00'
        ],
        shortwave_radiation_instant: [0, 50, 800, 100, 0],
        direct_radiation_instant: [0, 30, 600, 80, 0],
        diffuse_radiation_instant: [0, 20, 200, 20, 0]
      }
    };

    it('should extract data for specific date', () => {
      const result = SolarRadiationService.extractRadiationForDate(mockResult, '2023-06-21');

      expect(result.time).toEqual([
        '2023-06-21T00:00:00',
        '2023-06-21T12:00:00',
        '2023-06-21T23:00:00'
      ]);
      expect(result.shortwave_radiation_instant).toEqual([50, 800, 100]);
      expect(result.direct_radiation_instant).toEqual([30, 600, 80]);
      expect(result.diffuse_radiation_instant).toEqual([20, 200, 20]);
    });

    it('should return empty arrays for non-existent date', () => {
      const result = SolarRadiationService.extractRadiationForDate(mockResult, '2023-06-25');

      expect(result.time).toEqual([]);
      expect(result.shortwave_radiation_instant).toEqual([]);
      expect(result.direct_radiation_instant).toEqual([]);
      expect(result.diffuse_radiation_instant).toEqual([]);
    });

    it('should handle unsuccessful result', () => {
      const unsuccessfulResult = {
        success: false,
        error: 'API error'
      };

      const result = SolarRadiationService.extractRadiationForDate(unsuccessfulResult, '2023-06-21');

      expect(result.time).toEqual([]);
      expect(result.shortwave_radiation_instant).toEqual([]);
    });
  });

  describe('API URL construction', () => {
    it('should construct satellite API URL correctly', async () => {
      const mockOptions = {
        latitude: -33.8018,
        longitude: 151.1254,
        date: '2023-06-21',
        timezone: 'Australia/Sydney'
      };

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const currentDayOptions = { ...mockOptions, date: todayStr };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          hourly: {
            time: [`${todayStr}T12:00:00`],
            shortwave_radiation_instant: [800], // Valid daytime data
            direct_radiation_instant: [600],
            diffuse_radiation_instant: [200]
          }
        })
      });

      await SolarRadiationService.fetchSolarRadiation(currentDayOptions);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('satellite-api.open-meteo.com/v1/archive');
      expect(callUrl).toContain('latitude=-33.8018');
      expect(callUrl).toContain('longitude=151.1254');
      expect(callUrl).toContain('models=jma_jaxa_himawari');
      expect(callUrl).toContain('shortwave_radiation_instant%2Cdirect_radiation_instant%2Cdiffuse_radiation_instant');
    });

    it('should construct archive API URL correctly', async () => {
      const mockOptions = {
        latitude: -33.8018,
        longitude: 151.1254,
        date: '2023-06-21',
        timezone: 'Australia/Sydney'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hourly: {} })
      });

      await SolarRadiationService.fetchSolarRadiation(mockOptions);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('archive-api.open-meteo.com/v1/archive');
      expect(callUrl).toContain('start_date=2023-06-21');
      expect(callUrl).toContain('end_date=2023-06-21');
      expect(callUrl).toContain('shortwave_radiation_instant%2Cdirect_radiation_instant%2Cdiffuse_radiation_instant');
    });
  });
});