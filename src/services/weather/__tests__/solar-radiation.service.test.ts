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

  describe('isRecentDate', () => {
    it('should identify recent date within 3 days correctly', () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      expect(SolarRadiationService['isRecentDate'](todayStr)).toBe(true);
    });

    it('should identify past date beyond 3 days correctly', () => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
      const fourDaysAgoStr = fourDaysAgo.toISOString().split('T')[0];

      expect(SolarRadiationService['isRecentDate'](fourDaysAgoStr)).toBe(false);
    });

    it('should identify future date correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      expect(SolarRadiationService['isRecentDate'](tomorrowStr)).toBe(false);
    });
  });

  describe('fetchSolarRadiation', () => {
    const mockOptions: SolarRadiationOptions = {
      latitude: -33.8018,
      longitude: 151.1254,
      date: '2023-06-21',
      timezone: 'Australia/Sydney'
    };

    it('should use satellite API with satellite_radiation_seamless for any day', async () => {
      // Mock satellite API response with valid data
      const mockSatelliteResponse = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          shortwave_radiation_instant: [800],
          direct_radiation_instant: [600],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSatelliteResponse
      });

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('satellite_seamless');
      expect(result.data?.shortwave_radiation_instant).toEqual([800]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('satellite-api.open-meteo.com')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('models=satellite_radiation_seamless')
      );
    });

    it('should fall back to archive API when satellite APIs fail', async () => {
      // Mock satellite API responses that fail
      const emptyResponse = {
        hourly: {
          time: [],
          shortwave_radiation_instant: [],
          direct_radiation_instant: [],
          diffuse_radiation_instant: []
        }
      };

      // Mock archive API response
      const mockArchiveResponse = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          shortwave_radiation_instant: [750],
          direct_radiation_instant: [550],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // Tier 1: satellite_radiation_seamless fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // Tier 2: best_match fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockArchiveResponse }); // Tier 3: archive succeeds

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('archive_reanalysis');
      expect(result.data?.shortwave_radiation_instant).toEqual([750]);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should use forecast API for recent dates when all others fail', async () => {
      // Mock recent date within past 3 days
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const recentDateOptions = { ...mockOptions, date: yesterdayStr };

      // Mock empty responses for all satellite and archive APIs
      const emptyResponse = {
        hourly: {
          time: [],
          shortwave_radiation_instant: [],
          direct_radiation_instant: [],
          diffuse_radiation_instant: []
        }
      };

      // Mock forecast API response
      const mockForecastResponse = {
        hourly: {
          time: [`${yesterdayStr}T12:00:00`],
          shortwave_radiation_instant: [800],
          direct_radiation_instant: [600],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // Tier 1: satellite_seamless fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // Tier 2: best_match fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // Tier 3: archive fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockForecastResponse }); // Tier 4: forecast succeeds

      const result = await SolarRadiationService.fetchSolarRadiation(recentDateOptions);

      expect(result.success).toBe(true);
      expect(result.source).toBe('forecast_model');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Satellite API error: 500');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await SolarRadiationService.fetchSolarRadiation(mockOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('hasValidData', () => {
    it('should detect valid radiation data', () => {
      const validData = {
        time: ['2023-06-21T12:00:00', '2023-06-21T15:00:00'],
        shortwave_radiation_instant: [800, 600]
      };

      expect(SolarRadiationService['hasValidData'](validData)).toBe(true);
    });

    it('should reject data with no radiation arrays', () => {
      const invalidData = {
        time: ['2023-06-21T12:00:00', '2023-06-21T15:00:00']
      };

      expect(SolarRadiationService['hasValidData'](invalidData as any)).toBe(false);
    });

    it('should accept data with zero values', () => {
      const dataWithZeros = {
        time: ['2023-06-21T02:00:00', '2023-06-21T12:00:00'],
        shortwave_radiation_instant: [0, 800] // Zero at night, non-zero during day
      };

      expect(SolarRadiationService['hasValidData'](dataWithZeros)).toBe(true);
    });

    it('should handle empty data', () => {
      expect(SolarRadiationService['hasValidData']()).toBe(false);
      expect(SolarRadiationService['hasValidData']({})).toBe(false);
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          hourly: {
            time: ['2023-06-21T12:00:00'],
            shortwave_radiation_instant: [800],
            direct_radiation_instant: [600],
            diffuse_radiation_instant: [200]
          }
        })
      });

      await SolarRadiationService.fetchSolarRadiation(mockOptions);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('satellite-api.open-meteo.com/v1/archive');
      expect(callUrl).toContain('latitude=-33.8018');
      expect(callUrl).toContain('longitude=151.1254');
      expect(callUrl).toContain('models=satellite_radiation_seamless');
      expect(callUrl).toContain('shortwave_radiation_instant');
    });

    it('should construct archive API URL correctly when satellites fail', async () => {
      const mockOptions = {
        latitude: -33.8018,
        longitude: 151.1254,
        date: '2023-06-21',
        timezone: 'Australia/Sydney'
      };

      const emptyResponse = { hourly: { time: [], shortwave_radiation_instant: [] } };
      const validResponse = { hourly: { time: ['2023-06-21T12:00:00'], shortwave_radiation_instant: [800], direct_radiation_instant: [600], diffuse_radiation_instant: [200] } };

      mockFetch
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // satellite_seamless fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => emptyResponse }) // best_match fails
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => validResponse }); // archive succeeds

      await SolarRadiationService.fetchSolarRadiation(mockOptions);

      const archiveCallUrl = mockFetch.mock.calls[2][0];
      expect(archiveCallUrl).toContain('archive-api.open-meteo.com/v1/archive');
      expect(archiveCallUrl).toContain('start_date=2023-06-21');
      expect(archiveCallUrl).toContain('end_date=2023-06-21');
      expect(archiveCallUrl).toContain('shortwave_radiation_instant');
    });
  });
});