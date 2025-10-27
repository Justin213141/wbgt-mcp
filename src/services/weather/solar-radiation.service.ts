/**
 * Solar Radiation Service - Enhanced Data Fetching System
 * Implements the tiered approach for solar radiation observations:
 *
 * Current day preferences:
 * 1. satellite-api.open-meteo.com with Himawari models
 * 2. satellite-api.open-meteo.com with best model
 * 3. archive-api.open-meteo.com solar radiation instant
 *
 * Historical days:
 * 1. archive-api.open-meteo.com solar radiation instant
 */

import type { WeatherData } from '../../types/weather-data.types';

export interface SolarRadiationOptions {
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD format
  timezone?: string;
}

export interface SolarRadiationResult {
  success: boolean;
  data?: {
    shortwave_radiation_instant?: number[];
    direct_radiation_instant?: number[];
    diffuse_radiation_instant?: number[];
    time?: string[];
  };
  source?: 'satellite_himawari' | 'satellite_best' | 'archive_current' | 'archive_historical';
  error?: string;
}

/**
 * Solar Radiation Service with enhanced fetching strategy
 */
export class SolarRadiationService {
  private static readonly SATELLITE_API_BASE = 'https://satellite-api.open-meteo.com/v1/archive';
  private static readonly ARCHIVE_API_BASE = 'https://archive-api.open-meteo.com/v1/archive';

  /**
   * Check if a date is the current day (changes at midnight)
   */
  private static isCurrentDay(date: string): boolean {
    const today = new Date();
    const targetDate = new Date(date);

    // Compare year, month, and day only (ignore time)
    return (
      today.getFullYear() === targetDate.getFullYear() &&
      today.getMonth() === targetDate.getMonth() &&
      today.getDate() === targetDate.getDate()
    );
  }

  /**
   * Fetch solar radiation data with tiered approach
   */
  static async fetchSolarRadiation(options: SolarRadiationOptions): Promise<SolarRadiationResult> {
    const { latitude, longitude, date, timezone = 'auto' } = options;

    try {
      if (this.isCurrentDay(date)) {
        console.log(`[SolarRadiation] Current day detected (${date}), trying satellite APIs first`);

        // Tier 1a: Try satellite API with Himawari models
        console.log(`[SolarRadiation] Trying satellite API with Himawari models`);
        const himawariResult = await this.fetchFromSatelliteAPI({
          latitude,
          longitude,
          date,
          timezone,
          models: 'jma_jaxa_himawari',
          includePastDays: 2
        });

        if (himawariResult.success && this.hasValidDaytimeData(himawariResult.data)) {
          console.log('[SolarRadiation] Satellite API with Himawari models returned valid data');
          return {
            ...himawariResult,
            source: 'satellite_himawari'
          };
        }

        // Tier 1b: Try satellite API with best model
        console.log(`[SolarRadiation] Himawari data invalid, trying satellite API with best model`);
        const bestModelResult = await this.fetchFromSatelliteAPI({
          latitude,
          longitude,
          date,
          timezone,
          models: 'best_match',
          includePastDays: 2
        });

        if (bestModelResult.success && this.hasValidDaytimeData(bestModelResult.data)) {
          console.log('[SolarRadiation] Satellite API with best model returned valid data');
          return {
            ...bestModelResult,
            source: 'satellite_best'
          };
        }

        // Tier 1c: Fallback to archive API for current day
        console.log(`[SolarRadiation] Satellite APIs failed, falling back to archive API for current day`);
        const archiveResult = await this.fetchFromArchiveAPI({
          latitude,
          longitude,
          date,
          timezone,
          models: undefined,
          includePastDays: 0
        });

        return {
          ...archiveResult,
          source: 'archive_current'
        };

      } else {
        // Tier 2: Historical days - use archive API directly
        console.log(`[SolarRadiation] Historical date detected (${date}), using archive API`);
        const historicalResult = await this.fetchFromArchiveAPI({
          latitude,
          longitude,
          date,
          timezone,
          models: undefined,
          includePastDays: 0
        });

        return {
          ...historicalResult,
          source: 'archive_historical'
        };
      }

    } catch (error) {
      console.error('[SolarRadiation] Error fetching solar radiation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fetch from Archive API with configurable models
   */
  private static async fetchFromArchiveAPI(options: {
    latitude: number;
    longitude: number;
    date: string;
    timezone: string;
    models?: string;
    includePastDays?: number;
  }): Promise<SolarRadiationResult> {
    const { latitude, longitude, date, timezone, models, includePastDays } = options;

    // Calculate date range
    let startDate = date;
    let endDate = date;

    if (includePastDays) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - includePastDays);
      startDate = pastDate.toISOString().split('T')[0];
    }

    const url = new URL(this.ARCHIVE_API_BASE);
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('hourly', 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant');
    url.searchParams.set('timezone', timezone);

    // Add models parameter if specified
    if (models) {
      url.searchParams.set('models', models);
    }

    console.log(`[SolarRadiation] Fetching from Archive API with models ${models || 'default'}: ${url.toString()}`);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Archive API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WeatherData;

      return {
        success: true,
        data: {
          shortwave_radiation_instant: data.hourly?.shortwave_radiation_instant || [],
          direct_radiation_instant: data.hourly?.direct_radiation_instant || [],
          diffuse_radiation_instant: data.hourly?.diffuse_radiation_instant || [],
          time: data.hourly?.time || []
        }
      };
    } catch (error) {
      console.error('[SolarRadiation] Archive API fetch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Archive API fetch failed'
      };
    }
  }

  /**
   * Fetch from Satellite API with configurable models
   */
  private static async fetchFromSatelliteAPI(options: {
    latitude: number;
    longitude: number;
    date: string;
    timezone: string;
    models: string;
    includePastDays?: number;
  }): Promise<SolarRadiationResult> {
    const { latitude, longitude, date, timezone, models, includePastDays } = options;

    // Calculate date range
    let startDate = date;
    let endDate = date;

    if (includePastDays) {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - includePastDays);
      startDate = pastDate.toISOString().split('T')[0];
    }

    const url = new URL(this.SATELLITE_API_BASE);
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('hourly', 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant');
    url.searchParams.set('timezone', timezone);
    url.searchParams.set('models', models);

    console.log(`[SolarRadiation] Fetching from Satellite API with models ${models}: ${url.toString()}`);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Satellite API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as WeatherData;

      return {
        success: true,
        data: {
          shortwave_radiation_instant: data.hourly?.shortwave_radiation_instant || [],
          direct_radiation_instant: data.hourly?.direct_radiation_instant || [],
          diffuse_radiation_instant: data.hourly?.diffuse_radiation_instant || [],
          time: data.hourly?.time || []
        }
      };
    } catch (error) {
      console.error('[SolarRadiation] Satellite API fetch failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Satellite API fetch failed'
      };
    }
  }

  /**
   * Check if the data contains valid daytime radiation values
   * Himawari data is considered valid if it shows non-zero values during typical daylight hours
   */
  private static hasValidDaytimeData(data?: {
    shortwave_radiation_instant?: number[];
    direct_radiation_instant?: number[];
    diffuse_radiation_instant?: number[];
    time?: string[];
  }): boolean {
    if (!data || !data.time || !data.shortwave_radiation_instant) {
      return false;
    }

    // Check for non-zero radiation values during daylight hours (6 AM - 6 PM)
    const hasDaytimeRadiation = data.time.some((timeStr, index) => {
      const hour = new Date(timeStr).getHours();
      const radiation = data.shortwave_radiation_instant?.[index] || 0;

      // During daylight hours (6 AM - 6 PM), we should see some radiation
      return hour >= 6 && hour <= 18 && radiation > 0;
    });

    return hasDaytimeRadiation;
  }

  /**
   * Extract radiation data for a specific date from the result
   */
  static extractRadiationForDate(
    result: SolarRadiationResult,
    targetDate: string
  ): {
    shortwave_radiation_instant: number[];
    direct_radiation_instant: number[];
    diffuse_radiation_instant: number[];
    time: string[];
  } {
    if (!result.success || !result.data) {
      return {
        shortwave_radiation_instant: [],
        direct_radiation_instant: [],
        diffuse_radiation_instant: [],
        time: []
      };
    }

    const { time = [], shortwave_radiation_instant = [], direct_radiation_instant = [], diffuse_radiation_instant = [] } = result.data;

    // Filter data for the target date
    const targetIndices: number[] = [];
    time.forEach((timeStr, index) => {
      if (timeStr.startsWith(targetDate)) {
        targetIndices.push(index);
      }
    });

    return {
      time: targetIndices.map(i => time[i]),
      shortwave_radiation_instant: targetIndices.map(i => shortwave_radiation_instant[i] || 0),
      direct_radiation_instant: targetIndices.map(i => direct_radiation_instant[i] || 0),
      diffuse_radiation_instant: targetIndices.map(i => diffuse_radiation_instant[i] || 0),
    };
  }
}