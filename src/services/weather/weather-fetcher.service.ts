/**
 * Enhanced Weather Fetcher Service
 * Integrates the tiered solar radiation system with existing weather data fetching
 */

import type { WeatherData } from '../../types/weather-data.types';
import { SolarRadiationService, type SolarRadiationOptions, type SolarRadiationResult } from './solar-radiation.service';

export interface WeatherFetchOptions {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
  timezone: string;
  useEnhancedSolarRadiation?: boolean; // Enable tiered solar radiation system (defaults to true)
}

export interface EnhancedWeatherData extends WeatherData {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    dew_point_2m: number[];
    surface_pressure: number[];
    wind_speed_10m: number[];
    shortwave_radiation_instant: number[];
    direct_radiation_instant: number[];
    diffuse_radiation_instant: number[];
    apparent_temperature: number[];
    cloud_cover: number[];
  };
  solarRadiationSource?: 'satellite' | 'archive' | 'standard';
}

/**
 * Enhanced Weather Fetcher with tiered solar radiation support
 */
export class WeatherFetcherService {
  private static readonly STANDARD_API_BASE = 'https://archive-api.open-meteo.com/v1/archive';

  /**
   * Fetch weather data with optional enhanced solar radiation
   */
  static async fetchWeather(options: WeatherFetchOptions): Promise<EnhancedWeatherData> {
    const { latitude, longitude, startDate, endDate, timezone, useEnhancedSolarRadiation = true } = options;

    try {
      // Step 1: Fetch standard weather data
      const standardWeatherData = await this.fetchStandardWeather({
        latitude,
        longitude,
        startDate,
        endDate,
        timezone
      });

      if (!useEnhancedSolarRadiation) {
        return {
          ...standardWeatherData,
          solarRadiationSource: 'standard'
        };
      }

      // Step 2: Enhance solar radiation data using tiered system
      const enhancedWeatherData = await this.enhanceSolarRadiation(
        standardWeatherData,
        { latitude, longitude, startDate, endDate, timezone }
      );

      return enhancedWeatherData;

    } catch (error) {
      console.error('[WeatherFetcher] Error fetching weather data:', error);
      throw new Error(`Weather fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch standard weather data from Open-Meteo Archive API
   */
  private static async fetchStandardWeather(options: {
    latitude: number;
    longitude: number;
    startDate: string;
    endDate: string;
    timezone: string;
  }): Promise<WeatherData> {
    const { latitude, longitude, startDate, endDate, timezone } = options;

    const url = new URL(this.STANDARD_API_BASE);
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);
    url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,cloud_cover');
    url.searchParams.set('timezone', timezone);

    console.log(`[WeatherFetcher] Fetching standard weather data: ${url.toString()}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as WeatherData;
  }

  /**
   * Enhance weather data with tiered solar radiation system
   */
  private static async enhanceSolarRadiation(
    weatherData: WeatherData,
    options: {
      latitude: number;
      longitude: number;
      startDate: string;
      endDate: string;
      timezone: string;
    }
  ): Promise<EnhancedWeatherData> {
    const { latitude, longitude, startDate, endDate, timezone } = options;

    // Get all unique dates in the range
    const dates = this.getDateRange(startDate, endDate);
    let solarRadiationSource: 'satellite' | 'archive' | 'standard' = 'standard';

    console.log(`[WeatherFetcher] Enhancing solar radiation for ${dates.length} dates`);

    // For each date, try to get enhanced solar radiation data
    for (const date of dates) {
      try {
        const solarResult = await SolarRadiationService.fetchSolarRadiation({
          latitude,
          longitude,
          date,
          timezone
        });

        if (solarResult.success && solarResult.data) {
          // Extract radiation data for this specific date
          const dateRadiation = SolarRadiationService.extractRadiationForDate(solarResult, date);

          // Find the indices in the original weather data that match this date
          const matchingIndices = this.findDateIndices(weatherData, date);

          // Update the radiation values in the weather data
          if (matchingIndices.length > 0 && dateRadiation.time.length > 0) {
            this.updateRadiationValues(weatherData, matchingIndices, dateRadiation);
            solarRadiationSource = solarResult.source || 'standard';
            console.log(`[WeatherFetcher] Enhanced solar radiation for ${date} using ${solarResult.source} API`);
          }
        }
      } catch (error) {
        console.warn(`[WeatherFetcher] Failed to enhance solar radiation for ${date}:`, error);
        // Continue with standard data for this date
      }
    }

    return {
      ...weatherData,
      solarRadiationSource
    };
  }

  /**
   * Get all dates in the range (inclusive)
   */
  private static getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
  }

  /**
   * Find indices in weather data that match a specific date
   */
  private static findDateIndices(weatherData: WeatherData, targetDate: string): number[] {
    const indices: number[] = [];
    const times = weatherData.hourly?.time || [];

    times.forEach((timeStr, index) => {
      if (timeStr.startsWith(targetDate)) {
        indices.push(index);
      }
    });

    return indices;
  }

  /**
   * Update radiation values in weather data
   */
  private static updateRadiationValues(
    weatherData: WeatherData,
    indices: number[],
    radiationData: {
      shortwave_radiation_instant: number[];
      direct_radiation_instant: number[];
      diffuse_radiation_instant: number[];
    }
  ): void {
    if (!weatherData.hourly) return;

    indices.forEach((weatherIndex, dataIndex) => {
      if (dataIndex < radiationData.shortwave_radiation_instant.length) {
        weatherData.hourly.shortwave_radiation_instant![weatherIndex] = radiationData.shortwave_radiation_instant[dataIndex];
        weatherData.hourly.direct_radiation_instant![weatherIndex] = radiationData.direct_radiation_instant[dataIndex];
        weatherData.hourly.diffuse_radiation_instant![weatherIndex] = radiationData.diffuse_radiation_instant[dataIndex];
      }
    });
  }

  /**
   * Fetch weather data for a single day (current day optimized)
   */
  static async fetchCurrentDayWeather(options: {
    latitude: number;
    longitude: number;
    date: string;
    timezone: string;
  }): Promise<EnhancedWeatherData> {
    return this.fetchWeather({
      ...options,
      startDate: options.date,
      endDate: options.date,
      useEnhancedSolarRadiation: true
    });
  }

  /**
   * Fetch weather data for historical dates (archive optimized)
   */
  static async fetchHistoricalWeather(options: {
    latitude: number;
    longitude: number;
    startDate: string;
    endDate: string;
    timezone: string;
  }): Promise<EnhancedWeatherData> {
    return this.fetchWeather({
      ...options,
      useEnhancedSolarRadiation: true
    });
  }
}