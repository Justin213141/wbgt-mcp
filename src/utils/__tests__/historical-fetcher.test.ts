/**
 * Tests for HistoricalFetcher class
 * Tests timezone-unified historical WBGT data fetching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HistoricalFetcher } from '../historical-fetcher';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('HistoricalFetcher', () => {
  let fetcher: HistoricalFetcher;

  beforeEach(() => {
    fetcher = new HistoricalFetcher();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchKongWBGTByTimezone', () => {
    const mockWeatherData = {
      hourly: {
        time: ['2023-01-01T00:00', '2023-01-01T01:00'],
        temperature_2m: [25.0, 24.5],
        relative_humidity_2m: [60, 65],
        dew_point_2m: [18.0, 17.8],
        wet_bulb_temperature_2m: [20.0, 19.8],
        surface_pressure: [1013.25, 1013.50],
        wind_speed_10m: [3.0, 2.8],
        shortwave_radiation_instant: [0, 0],
        direct_radiation_instant: [0, 0],
        diffuse_radiation_instant: [0, 0],
        apparent_temperature: [26.0, 25.5],
        cloud_cover: [30, 35]
      }
    };

    beforeEach(() => {
      // Mock successful fetch response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockWeatherData
      });
    });

    it('should fetch and process data for Sydney timezone', async () => {
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-01-01',
        '2023-01-02',
        -33.8018,
        151.1254,
        10,
        true,
        'Australia/Sydney'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('timestamp', '01/01/2023, 00:00:00');
      expect(result[0]).toHaveProperty('temperature', 25.0);
      expect(result[0]).toHaveProperty('humidity', 60);
      expect(result[0]).toHaveProperty('wbgt');
      expect(result[0]).toHaveProperty('esi');

      // Verify correct API call was made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timezone=Australia%2FSydney')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('shortwave_radiation_instant')
      );
    });

    it('should fetch and process data for Tokyo timezone', async () => {
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-01-01',
        '2023-01-02',
        35.6762,
        139.6503,
        9,
        false,
        'Asia/Tokyo'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('timestamp', '01/01/2023, 00:00:00');
      expect(result[0]).toHaveProperty('temperature', 25.0);

      // Verify correct API call was made
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timezone=Asia%2FTokyo')
      );
    });

    it('should handle default timezone parameters', async () => {
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-06-01',
        '2023-06-02',
        -33.8018,
        151.1254
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('temperature', 25.0);

      // Verify default timezone was used
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timezone=Australia%2FSydney')
      );
    });

    it('should accept valid date ranges', async () => {
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-01-01',
        '2023-01-31',
        35.6762,
        139.6503,
        9,
        false,
        'Asia/Tokyo'
      );

      expect(result).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timezone=Asia%2FTokyo')
      );
    });

    it('should handle single day requests', async () => {
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-06-21',
        '2023-06-21',
        -33.8018,
        151.1254,
        10,
        true,
        'Australia/Sydney'
      );

      expect(result).toHaveLength(2);
    });

    it('should handle extreme latitude values', async () => {
      // Arctic location (using Sydney timezone)
      const arcticResult = await fetcher.fetchKongWBGTByTimezone(
        '2023-12-01',
        '2023-12-02',
        85.0,
        0.0,
        10,
        true,
        'Australia/Sydney'
      );

      expect(arcticResult).toHaveLength(2);

      // Antarctic location (using Tokyo timezone)
      const antarcticResult = await fetcher.fetchKongWBGTByTimezone(
        '2023-12-01',
        '2023-12-02',
        -85.0,
        0.0,
        9,
        false,
        'Asia/Tokyo'
      );

      expect(antarcticResult).toHaveLength(2);
    });

    it('should handle different UTC offsets', async () => {
      // Test only supported UTC offsets (Sydney and Tokyo)
      const supportedConfigs = [
        { offset: 10, hasDST: true, timezone: 'Australia/Sydney' },
        { offset: 9, hasDST: false, timezone: 'Asia/Tokyo' }
      ];

      for (const config of supportedConfigs) {
        const result = await fetcher.fetchKongWBGTByTimezone(
          '2023-06-01',
          '2023-06-02',
          0.0,
          0.0,
          config.offset,
          config.hasDST,
          config.timezone
        );

        expect(result).toHaveLength(2);
      }
    });

    it('should return Promise that resolves to array', async () => {
      const promise = fetcher.fetchKongWBGTByTimezone(
        '2023-01-01',
        '2023-01-02',
        -33.8018,
        151.1254
      );

      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(
        fetcher.fetchKongWBGTByTimezone(
          '2023-01-01',
          '2023-01-02',
          -33.8018,
          151.1254
        )
      ).rejects.toThrow('OpenMeteo API error: 500');
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(
        fetcher.fetchKongWBGTByTimezone(
          '2023-01-01',
          '2023-01-02',
          -33.8018,
          151.1254
        )
      ).rejects.toThrow('Network error');
    });

    it('should validate date range (reject future dates)', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      await expect(
        fetcher.fetchKongWBGTByTimezone(
          tomorrowStr,
          tomorrowStr,
          -33.8018,
          151.1254
        )
      ).rejects.toThrow('Invalid date range: end_date cannot be today');
    });

    it('should handle coordinates just south of Sydney region boundary', async () => {
      // Coordinates at -35.73 (just outside old -35 boundary, inside new -40 boundary)
      const result = await fetcher.fetchKongWBGTByTimezone(
        '2023-01-26',
        '2023-01-26',
        -35.734748840332,
        150.191177368164
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('class instantiation', () => {
    it('should create instance of HistoricalFetcher', () => {
      const fetcherInstance = new HistoricalFetcher();
      expect(fetcherInstance).toBeInstanceOf(HistoricalFetcher);
    });

    it('should have fetchKongWBGTByTimezone method', () => {
      const fetcherInstance = new HistoricalFetcher();
      expect(typeof fetcherInstance.fetchKongWBGTByTimezone).toBe('function');
    });
  });
});