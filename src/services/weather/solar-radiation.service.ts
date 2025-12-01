/**
 * Solar Radiation Service - Enhanced Data Fetching System
 *
 * Implements tiered solar radiation data with a single API call:
 * - Tier 1 (observational): *_satellite_radiation_seamless
 * - Tier 2 (model): *_archive_best_match
 *
 * Uses satellite-api.open-meteo.com with models=satellite_radiation_seamless,best_match
 * and past_days=3 to handle recent dates in a single request.
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
  source?: 'satellite_seamless' | 'satellite_model' | 'archive_reanalysis' | 'forecast_model';
  error?: string;
}

// Response type for the combined satellite API call
interface SatelliteAPIResponse {
  hourly: {
    time: string[];
    // Tier 1: Observational satellite data
    shortwave_radiation_instant_satellite_radiation_seamless?: number[];
    direct_radiation_instant_satellite_radiation_seamless?: number[];
    diffuse_radiation_instant_satellite_radiation_seamless?: number[];
    // Tier 2: Archive best match model data
    shortwave_radiation_instant_archive_best_match?: number[];
    direct_radiation_instant_archive_best_match?: number[];
    diffuse_radiation_instant_archive_best_match?: number[];
  };
}

/**
 * Solar Radiation Service with tiered data fetching
 */
export class SolarRadiationService {
  private static readonly SATELLITE_API_BASE = 'https://satellite-api.open-meteo.com/v1/archive';

  /**
   * Fetch solar radiation data with tiered approach using single API call
   *
   * Returns both Tier 1 (satellite_radiation_seamless) and Tier 2 (best_match) data
   * Prefers Tier 1 when available, falls back to Tier 2
   */
  static async fetchSolarRadiation(options: SolarRadiationOptions): Promise<SolarRadiationResult> {
    const { latitude, longitude, date, timezone = 'auto' } = options;

    try {
      // Single API call with both models and past_days=3 for recent date coverage
      const url = new URL(this.SATELLITE_API_BASE);
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
      url.searchParams.set('hourly', 'shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant');
      url.searchParams.set('models', 'satellite_radiation_seamless,best_match');
      url.searchParams.set('timezone', timezone);
      url.searchParams.set('past_days', '3');

      console.log(`[SolarRadiation] Fetching tiered solar data: ${url.toString()}`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Satellite API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as SatelliteAPIResponse;

      // Check if we have Tier 1 (observational satellite) data
      const hasTier1Data = this.hasValidTier1Data(data, date);

      if (hasTier1Data) {
        console.log('[SolarRadiation] Using Tier 1 (satellite_radiation_seamless) observational data');
        return {
          success: true,
          data: this.extractTier1Data(data, date),
          source: 'satellite_seamless'
        };
      }

      // Check if we have Tier 2 (archive best match) data
      const hasTier2Data = this.hasValidTier2Data(data, date);

      if (hasTier2Data) {
        console.log('[SolarRadiation] Tier 1 unavailable, using Tier 2 (archive_best_match) model data');
        return {
          success: true,
          data: this.extractTier2Data(data, date),
          source: 'satellite_model'
        };
      }

      // No valid data from either tier
      console.warn('[SolarRadiation] No valid solar radiation data available from satellite API');
      return {
        success: false,
        error: 'No solar radiation data available for this date'
      };

    } catch (error) {
      console.error('[SolarRadiation] Error fetching solar radiation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if Tier 1 (satellite_radiation_seamless) has valid data for the target date
   */
  private static hasValidTier1Data(data: SatelliteAPIResponse, targetDate: string): boolean {
    const times = data.hourly?.time || [];
    const radiation = data.hourly?.shortwave_radiation_instant_satellite_radiation_seamless || [];

    // Find indices for the target date
    const targetIndices = times
      .map((t, i) => t.startsWith(targetDate) ? i : -1)
      .filter(i => i >= 0);

    if (targetIndices.length === 0) return false;

    // Check if we have non-null radiation values for the target date
    return targetIndices.some(i => radiation[i] !== null && radiation[i] !== undefined);
  }

  /**
   * Check if Tier 2 (archive_best_match) has valid data for the target date
   */
  private static hasValidTier2Data(data: SatelliteAPIResponse, targetDate: string): boolean {
    const times = data.hourly?.time || [];
    const radiation = data.hourly?.shortwave_radiation_instant_archive_best_match || [];

    // Find indices for the target date
    const targetIndices = times
      .map((t, i) => t.startsWith(targetDate) ? i : -1)
      .filter(i => i >= 0);

    if (targetIndices.length === 0) return false;

    // Check if we have non-null radiation values for the target date
    return targetIndices.some(i => radiation[i] !== null && radiation[i] !== undefined);
  }

  /**
   * Extract Tier 1 (satellite_radiation_seamless) data for the target date
   */
  private static extractTier1Data(data: SatelliteAPIResponse, targetDate: string): {
    shortwave_radiation_instant: number[];
    direct_radiation_instant: number[];
    diffuse_radiation_instant: number[];
    time: string[];
  } {
    const times = data.hourly?.time || [];
    const shortwave = data.hourly?.shortwave_radiation_instant_satellite_radiation_seamless || [];
    const direct = data.hourly?.direct_radiation_instant_satellite_radiation_seamless || [];
    const diffuse = data.hourly?.diffuse_radiation_instant_satellite_radiation_seamless || [];

    // Filter for target date
    const targetIndices = times
      .map((t, i) => t.startsWith(targetDate) ? i : -1)
      .filter(i => i >= 0);

    return {
      time: targetIndices.map(i => times[i]),
      shortwave_radiation_instant: targetIndices.map(i => shortwave[i] ?? 0),
      direct_radiation_instant: targetIndices.map(i => direct[i] ?? 0),
      diffuse_radiation_instant: targetIndices.map(i => diffuse[i] ?? 0)
    };
  }

  /**
   * Extract Tier 2 (archive_best_match) data for the target date
   */
  private static extractTier2Data(data: SatelliteAPIResponse, targetDate: string): {
    shortwave_radiation_instant: number[];
    direct_radiation_instant: number[];
    diffuse_radiation_instant: number[];
    time: string[];
  } {
    const times = data.hourly?.time || [];
    const shortwave = data.hourly?.shortwave_radiation_instant_archive_best_match || [];
    const direct = data.hourly?.direct_radiation_instant_archive_best_match || [];
    const diffuse = data.hourly?.diffuse_radiation_instant_archive_best_match || [];

    // Filter for target date
    const targetIndices = times
      .map((t, i) => t.startsWith(targetDate) ? i : -1)
      .filter(i => i >= 0);

    return {
      time: targetIndices.map(i => times[i]),
      shortwave_radiation_instant: targetIndices.map(i => shortwave[i] ?? 0),
      direct_radiation_instant: targetIndices.map(i => direct[i] ?? 0),
      diffuse_radiation_instant: targetIndices.map(i => diffuse[i] ?? 0)
    };
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
