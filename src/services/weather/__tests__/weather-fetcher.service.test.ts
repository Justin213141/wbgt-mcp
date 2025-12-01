/**
 * Tests for Weather Fetcher Service
 * Tests the enhanced weather fetching with tiered solar radiation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WeatherFetcherService } from '../weather-fetcher.service';

// Mock fetch and SolarRadiationService
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockSolarRadiationService = vi.hoisted(() => ({
  fetchSolarRadiation: vi.fn(),
  extractRadiationForDate: vi.fn()
}));

vi.mock('../solar-radiation.service', () => ({
  SolarRadiationService: mockSolarRadiationService
}));

describe('WeatherFetcherService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockOptions = {
    latitude: -33.8018,
    longitude: 151.1254,
    startDate: '2023-06-20',
    endDate: '2023-06-22',
    timezone: 'Australia/Sydney'
  };

  describe('fetchWeather', () => {
    it('should fetch standard weather data without enhancement', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          temperature_2m: [25],
          relative_humidity_2m: [60],
          shortwave_radiation_instant: [500],
          direct_radiation_instant: [300],
          diffuse_radiation_instant: [200]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      const result = await WeatherFetcherService.fetchWeather({
        ...mockOptions,
        useEnhancedSolarRadiation: false
      });

      expect(result.solarRadiationSource).toBe('standard');
      expect(result.hourly?.temperature_2m).toEqual([25]);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockSolarRadiationService.fetchSolarRadiation).not.toHaveBeenCalled();
    });

    it('should enhance weather data with solar radiation service', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-20T12:00:00', '2023-06-21T12:00:00', '2023-06-22T12:00:00'],
          temperature_2m: [20, 25, 22],
          relative_humidity_2m: [65, 60, 70],
          shortwave_radiation_instant: [400, 500, 300],
          direct_radiation_instant: [250, 300, 200],
          diffuse_radiation_instant: [150, 200, 100]
        }
      };

      const mockEnhancedRadiation = {
        success: true,
        data: {
          time: ['2023-06-21T12:00:00'],
          shortwave_radiation_instant: [800],
          direct_radiation_instant: [600],
          diffuse_radiation_instant: [200]
        },
        source: 'satellite'
      };

      const mockExtractedRadiation = {
        time: ['2023-06-21T12:00:00'],
        shortwave_radiation_instant: [800],
        direct_radiation_instant: [600],
        diffuse_radiation_instant: [200]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      mockSolarRadiationService.fetchSolarRadiation.mockResolvedValue(mockEnhancedRadiation);
      mockSolarRadiationService.extractRadiationForDate.mockReturnValue(mockExtractedRadiation);

      const result = await WeatherFetcherService.fetchWeather({
        ...mockOptions,
        useEnhancedSolarRadiation: true
      });

      expect(result.solarRadiationSource).toBe('satellite');
      expect(mockSolarRadiationService.fetchSolarRadiation).toHaveBeenCalled();
      expect(result.hourly?.shortwave_radiation_instant?.[1]).toBe(800); // Enhanced value
    });

    it('should handle multiple dates for enhancement', async () => {
      const mockWeatherData = {
        hourly: {
          time: [
            '2023-06-20T12:00:00',
            '2023-06-21T12:00:00',
            '2023-06-22T12:00:00'
          ],
          temperature_2m: [20, 25, 22],
          shortwave_radiation_instant: [400, 500, 300]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      // Mock different results for different dates
      mockSolarRadiationService.fetchSolarRadiation
        .mockResolvedValueOnce({
          success: true,
          data: { time: ['2023-06-20T12:00:00'], shortwave_radiation_instant: [600] },
          source: 'archive'
        })
        .mockResolvedValueOnce({
          success: true,
          data: { time: ['2023-06-21T12:00:00'], shortwave_radiation_instant: [800] },
          source: 'satellite'
        })
        .mockResolvedValueOnce({
          success: true,
          data: { time: ['2023-06-22T12:00:00'], shortwave_radiation_instant: [700] },
          source: 'archive'
        });

      mockSolarRadiationService.extractRadiationForDate
        .mockReturnValueOnce({ time: ['2023-06-20T12:00:00'], shortwave_radiation_instant: [600] })
        .mockReturnValueOnce({ time: ['2023-06-21T12:00:00'], shortwave_radiation_instant: [800] })
        .mockReturnValueOnce({ time: ['2023-06-22T12:00:00'], shortwave_radiation_instant: [700] });

      const result = await WeatherFetcherService.fetchWeather(mockOptions);

      expect(mockSolarRadiationService.fetchSolarRadiation).toHaveBeenCalledTimes(3);
      expect(result.hourly?.shortwave_radiation_instant).toEqual([600, 800, 700]);
    });

    it('should continue with standard data if enhancement fails', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          temperature_2m: [25],
          shortwave_radiation_instant: [500]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      mockSolarRadiationService.fetchSolarRadiation.mockRejectedValue(new Error('API failed'));

      const result = await WeatherFetcherService.fetchWeather(mockOptions);

      expect(result.solarRadiationSource).toBe('standard');
      expect(result.hourly?.shortwave_radiation_instant).toEqual([500]);
    });
  });

  describe('fetchCurrentDayWeather', () => {
    it('should fetch current day weather with enhancement', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          temperature_2m: [25],
          shortwave_radiation_instant: [500]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      const result = await WeatherFetcherService.fetchCurrentDayWeather({
        latitude: mockOptions.latitude,
        longitude: mockOptions.longitude,
        date: '2023-06-21',
        timezone: mockOptions.timezone
      });

      expect(result.hourly?.temperature_2m).toEqual([25]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2023-06-21&end_date=2023-06-21')
      );
    });
  });

  describe('fetchHistoricalWeather', () => {
    it('should fetch historical weather with enhancement', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-20T12:00:00', '2023-06-21T12:00:00'],
          temperature_2m: [20, 25],
          shortwave_radiation_instant: [400, 500]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      const result = await WeatherFetcherService.fetchHistoricalWeather(mockOptions);

      expect(result.hourly?.temperature_2m).toEqual([20, 25]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2023-06-20&end_date=2023-06-22')
      );
    });
  });

  describe('error handling', () => {
    it('should handle weather API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(WeatherFetcherService.fetchWeather(mockOptions)).rejects.toThrow('Weather fetch failed');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(WeatherFetcherService.fetchWeather(mockOptions)).rejects.toThrow('Weather fetch failed');
    });
  });

  describe('date range handling', () => {
    it('should handle single day requests', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-21T12:00:00'],
          temperature_2m: [25]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      await WeatherFetcherService.fetchWeather({
        ...mockOptions,
        startDate: '2023-06-21',
        endDate: '2023-06-21'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2023-06-21&end_date=2023-06-21')
      );
    });

    it('should handle multi-day requests', async () => {
      const mockWeatherData = {
        hourly: {
          time: ['2023-06-20T12:00:00', '2023-06-21T12:00:00', '2023-06-22T12:00:00'],
          temperature_2m: [20, 25, 22]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      await WeatherFetcherService.fetchWeather({
        ...mockOptions,
        startDate: '2023-06-20',
        endDate: '2023-06-22'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('start_date=2023-06-20&end_date=2023-06-22')
      );
    });
  });

  describe('URL construction', () => {
    it('should construct correct API URL', async () => {
      const mockWeatherData = { hourly: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockWeatherData
      });

      await WeatherFetcherService.fetchWeather(mockOptions);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('archive-api.open-meteo.com/v1/archive');
      expect(callUrl).toContain('latitude=-33.8018');
      expect(callUrl).toContain('longitude=151.1254');
      expect(callUrl).toContain('start_date=2023-06-20');
      expect(callUrl).toContain('end_date=2023-06-22');
      expect(callUrl).toContain('timezone=Australia%2FSydney');
    });
  });
});