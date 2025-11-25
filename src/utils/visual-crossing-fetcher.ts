/**
 * Visual Crossing Weather API Integration
 * Fills 3-day to 3-month observational data gap with high-quality weather station data
 *
 * Data Source: Visual Crossing Weather API
 * - Uses NOAA ISD observational data with multi-station aggregation
 * - 1-3 day latency (perfect for 3-90 day historical range)
 * - Free tier: 1000 records/day
 * - Cost: $0.0001/record after free tier
 */

export interface VisualCrossingConfig {
  apiKey: string;
  unitGroup: 'metric' | 'us';
  elements: string[];
  baseUrl: string;
}

export interface VisualCrossingObservation {
  timestamp: string;           // ISO 8601 local time (YYYY-MM-DDTHH:MM)
  temperature: number;          // °C
  humidity: number;             // %
  dew_point: number;           // °C
  wind_speed: number;          // m/s (converted from km/h)
  sea_level_pressure: number;  // hPa
  cloud_cover: number;         // %
  visibility?: number;         // km
  conditions?: string;         // Weather description
}

export interface VisualCrossingResponse {
  queryCost: number;
  latitude: number;
  longitude: number;
  resolvedAddress: string;
  timezone: string;
  days: Array<{
    datetime: string;      // YYYY-MM-DD
    tempmax?: number;
    tempmin?: number;
    temp?: number;
    hours: Array<{
      datetime: string;    // HH:MM:SS
      temp: number;
      humidity: number;
      dew: number;
      windspeed: number;
      pressure: number;    // Barometric pressure in hPa/millibars
      cloudcover: number;
      visibility?: number;
      conditions?: string;
    }>;
  }>;
  stations?: Record<string, {
    distance: number;
    latitude: number;
    longitude: number;
    name: string;
    id: string;
  }>;
}

export interface HourlyWeatherArrays {
  times: string[];          // ISO 8601 timestamps in local time
  temps: number[];          // °C
  humidity: number[];       // %
  dewpoints: number[];      // °C
  wetBulbs: number[];       // °C (calculated)
  pressures: number[];      // hPa
  windSpeeds: number[];     // m/s
  cloudCovers: number[];    // %
}

/**
 * VisualCrossingFetcher - Fetch weather observations from Visual Crossing API
 *
 * Manages API requests, rate limiting, and data parsing for Visual Crossing Weather API.
 * Provides observational weather data with 1-3 day latency for historical analysis.
 */
export class VisualCrossingFetcher {
  private config: VisualCrossingConfig;
  private requestCount: number = 0;
  private dailyResetTime: Date;

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      unitGroup: 'metric',
      elements: [
        'datetime',        // CRITICAL: Must request datetime to get hour timestamps
        'temp',
        'humidity',
        'dew',
        'windspeed',
        'pressure',        // Correct field name (not sealevelpressure)
        'cloudcover',
        'visibility',
        'conditions'
      ],
      baseUrl: 'https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline'
    };
    this.dailyResetTime = this.getNextDailyReset();
  }

  /**
   * Fetch weather observations for a date range
   *
   * @param latitude Latitude (decimal degrees)
   * @param longitude Longitude (decimal degrees)
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns Object with observations and station metadata
   */
  async fetchObservations(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): Promise<{
    observations: VisualCrossingObservation[];
    stations: Record<string, { distance: number; latitude: number; longitude: number; name: string; id: string }> | null;
    resolvedAddress: string;
  }> {
    // Check free tier limit before making request
    await this.checkRateLimit();

    const url = this.buildUrl(latitude, longitude, startDate, endDate);

    console.log(`[VISUAL-CROSSING] Fetching data for ${startDate} to ${endDate} at (${latitude}, ${longitude})`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Visual Crossing API rate limit exceeded (429). Please wait and try again.');
        }
        if (response.status === 401) {
          throw new Error('Visual Crossing API authentication failed (401). Check API key.');
        }
        if (response.status === 400) {
          const errorText = await response.text();
          throw new Error(`Visual Crossing API bad request (400): ${errorText}`);
        }
        throw new Error(`Visual Crossing API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as VisualCrossingResponse;

      // Track query cost against free tier
      console.log(`[VISUAL-CROSSING] Query cost: ${data.queryCost} records`);
      console.log(`[VISUAL-CROSSING] Daily usage: ${this.requestCount}/${1000} records (${this.requestCount + data.queryCost} after this request)`);
      this.requestCount += data.queryCost;

      // Debug: Log first day and first hour structure
      if (data.days && data.days[0]) {
        console.log(`[VISUAL-CROSSING DEBUG] First day structure:`, JSON.stringify({
          datetime: data.days[0].datetime,
          hours_count: data.days[0].hours?.length,
          first_hour: data.days[0].hours?.[0]
        }));
      }

      // Log contributing stations
      if (data.stations) {
        const stationList = Object.values(data.stations)
          .map(s => `${s.name} (${s.distance.toFixed(1)}km)`)
          .join(', ');
        console.log(`[VISUAL-CROSSING] Contributing stations: ${stationList}`);
      }

      // Parse response into observations
      const observations = this.parseResponse(data);

      console.log(`[VISUAL-CROSSING] Retrieved ${observations.length} hourly observations`);
      console.log(`[VISUAL-CROSSING] Time range: ${observations[0]?.timestamp} to ${observations[observations.length - 1]?.timestamp}`);

      return {
        observations,
        stations: data.stations || null,
        resolvedAddress: data.resolvedAddress || `${latitude},${longitude}`
      };
    } catch (error) {
      console.error('[VISUAL-CROSSING] Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Convert Visual Crossing observations to hourly arrays for Kong WBGT pipeline
   *
   * @param observations Array of Visual Crossing observations
   * @param timezone Timezone for timestamps (e.g., 'Australia/Sydney')
   * @returns Hourly weather data arrays with wet bulb temperatures
   */
  convertToHourlyArrays(
    observations: VisualCrossingObservation[],
    timezone: string = 'Australia/Sydney'
  ): HourlyWeatherArrays {
    // Sort observations by timestamp to ensure chronological order
    const sorted = [...observations].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const times: string[] = [];
    const temps: number[] = [];
    const humidity: number[] = [];
    const dewpoints: number[] = [];
    const wetBulbs: number[] = [];
    const pressures: number[] = [];
    const windSpeeds: number[] = [];
    const cloudCovers: number[] = [];

    for (const obs of sorted) {
      times.push(obs.timestamp);
      temps.push(obs.temperature);
      humidity.push(obs.humidity);
      dewpoints.push(obs.dew_point);
      pressures.push(obs.sea_level_pressure);
      windSpeeds.push(obs.wind_speed);
      cloudCovers.push(obs.cloud_cover);

      // Calculate wet bulb temperature using Stull (2011) formula
      const wetBulb = this.calculateWetBulb(
        obs.temperature,
        obs.humidity,
        obs.sea_level_pressure
      );
      wetBulbs.push(wetBulb);
    }

    return {
      times,
      temps,
      humidity,
      dewpoints,
      wetBulbs,
      pressures,
      windSpeeds,
      cloudCovers
    };
  }

  /**
   * Build Visual Crossing API URL with parameters
   *
   * @param latitude Latitude
   * @param longitude Longitude
   * @param startDate Start date (YYYY-MM-DD)
   * @param endDate End date (YYYY-MM-DD)
   * @returns Complete API URL
   */
  private buildUrl(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string
  ): string {
    const location = `${latitude},${longitude}`;
    const params = new URLSearchParams({
      unitGroup: this.config.unitGroup,
      include: 'hours',
      elements: this.config.elements.join(','),
      key: this.config.apiKey
    });

    return `${this.config.baseUrl}/${location}/${startDate}/${endDate}?${params}`;
  }

  /**
   * Parse Visual Crossing API response into observations
   *
   * @param data API response
   * @returns Array of parsed observations
   */
  private parseResponse(data: VisualCrossingResponse): VisualCrossingObservation[] {
    const observations: VisualCrossingObservation[] = [];

    for (const day of data.days) {
      // Skip days without hours data
      if (!day.hours || !Array.isArray(day.hours)) {
        console.warn(`[VISUAL-CROSSING] Day ${day.datetime} has no hourly data, skipping`);
        continue;
      }

      for (const hour of day.hours) {
        // Skip hours with missing critical data
        if (!hour.datetime) {
          console.warn(`[VISUAL-CROSSING] Hour missing datetime, skipping`);
          continue;
        }

        // Combine date + time: "2025-11-12" + "14:00:00" -> "2025-11-12T14:00"
        const timestamp = `${day.datetime}T${hour.datetime.substring(0, 5)}`;

        // Convert wind speed from km/h to m/s (divide by 3.6)
        // Default to 0 if missing
        const windSpeedMs = (hour.windspeed ?? 0) / 3.6;

        observations.push({
          timestamp,
          temperature: hour.temp ?? 0,
          humidity: hour.humidity ?? 0,
          dew_point: hour.dew ?? 0,
          wind_speed: windSpeedMs,
          sea_level_pressure: hour.pressure ?? 1013,  // Using 'pressure' field from API
          cloud_cover: hour.cloudcover ?? 0,
          visibility: hour.visibility,
          conditions: hour.conditions
        });
      }
    }

    // Sort by timestamp (should already be sorted, but ensure)
    return observations.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Calculate wet bulb temperature from temperature, humidity, and pressure
   * Using Stull (2011) approximation formula
   *
   * Reference: https://journals.ametsoc.org/view/journals/apme/50/11/jamc-d-11-0143.1.xml
   *
   * @param temp Dry bulb temperature (°C)
   * @param humidity Relative humidity (%)
   * @param pressure Sea level pressure (hPa)
   * @returns Wet bulb temperature (°C)
   */
  private calculateWetBulb(
    temp: number,
    humidity: number,
    pressure: number
  ): number {
    // Stull (2011) formula - accurate to ±1°C for most conditions
    const Tw = temp * Math.atan(0.151977 * Math.pow(humidity + 8.313659, 0.5))
             + Math.atan(temp + humidity)
             - Math.atan(humidity - 1.676331)
             + 0.00391838 * Math.pow(humidity, 1.5) * Math.atan(0.023101 * humidity)
             - 4.686035;

    return Tw;
  }

  /**
   * Check rate limit and throw error if daily free tier exceeded
   * Resets counter at midnight
   */
  private async checkRateLimit(): Promise<void> {
    const now = new Date();

    // Reset counter if past daily reset time (midnight)
    if (now >= this.dailyResetTime) {
      console.log('[VISUAL-CROSSING] Daily rate limit reset at midnight');
      this.requestCount = 0;
      this.dailyResetTime = this.getNextDailyReset();
    }

    // Warn if approaching limit (900/1000 records)
    if (this.requestCount >= 900 && this.requestCount < 1000) {
      console.warn(`[VISUAL-CROSSING] ⚠️ Approaching daily limit: ${this.requestCount}/1000 records used`);
    }

    // Throw error if limit exceeded
    if (this.requestCount >= 1000) {
      const hoursUntilReset = Math.ceil(
        (this.dailyResetTime.getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      throw new Error(
        `Visual Crossing daily free tier limit exceeded (1000 records/day). ` +
        `Resets in ${hoursUntilReset} hours at ${this.dailyResetTime.toISOString()}`
      );
    }
  }

  /**
   * Get next midnight (daily reset time)
   *
   * @returns Date object representing next midnight
   */
  private getNextDailyReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Midnight
    return tomorrow;
  }

  /**
   * Get current usage statistics
   *
   * @returns Usage info object
   */
  getUsageStats(): {
    recordsUsed: number;
    recordsRemaining: number;
    resetTime: string;
  } {
    return {
      recordsUsed: this.requestCount,
      recordsRemaining: Math.max(0, 1000 - this.requestCount),
      resetTime: this.dailyResetTime.toISOString()
    };
  }
}
