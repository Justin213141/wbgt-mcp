/**
 * Meteostat Weather API Integration
 * Provides historical weather data from weather stations for 3-90 day observational ranges
 *
 * Data Source: Meteostat API (https://dev.meteostat.net/)
 * - Uses weather station observational data
 * - 1-3 day latency (suitable for 3-90 day historical range)
 * - Free tier: 500 requests/day, 10 requests/minute
 * - No credit card required for basic tier
 * - Higher limits available with API key (not required for basic usage)
 */

export interface MeteostatConfig {
  apiKey?: string;  // Optional API key for higher limits
  baseUrl: string;
}

export interface MeteostatHourlyObservation {
  time: string;           // ISO 8601 timestamp (YYYY-MM-DDTHH:MM:SS)
  temperature: number;    // °C
  humidity: number;       // %
  dew_point: number;      // °C
  wind_speed: number;     // m/s (converted from km/h)
  pressure: number;       // hPa (sea level pressure)
  precipitation: number;  // mm
  snow_depth?: number;    // mm (if applicable)
}

export interface MeteostatStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  distance?: number;  // Distance from requested location in km
}

export interface MeteostatResponse {
  data: MeteostatHourlyObservation[];
  meta: {
    station: MeteostatStation;
    generated_at: string;
    query_time: number;
  };
}

/**
 * MeteostatFetcher - Fetch weather observations from Meteostat API
 *
 * Provides observational weather data from weather stations with 1-3 day latency.
 */
export class MeteostatFetcher {
  private config: MeteostatConfig;

  constructor(apiKey?: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://api.meteostat.net/v2/point/hourly'
    };
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
    observations: MeteostatHourlyObservation[];
    station: MeteostatStation;
    generated_at: string;
  }> {
    console.log(`[METEOSTAT] Fetching data for ${startDate} to ${endDate} at (${latitude}, ${longitude})`);

    const url = this.buildUrl(latitude, longitude, startDate, endDate);

    try {
      const response = await fetch(url, {
        headers: this.config.apiKey ? { 'X-API-Key': this.config.apiKey } : {}
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Meteostat API rate limit exceeded (429). Please wait and try again.');
        }
        if (response.status === 401) {
          throw new Error('Meteostat API authentication failed (401). Check API key.');
        }
        if (response.status === 400) {
          const errorText = await response.text();
          throw new Error(`Meteostat API bad request (400): ${errorText}`);
        }
        throw new Error(`Meteostat API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as {
        data?: Array<{
          time: string;
          temp: number | null;
          rhum: number | null;
          dwpt: number | null;
          wspd: number | null;  // km/h
          pres: number | null;  // hPa
          prcp: number | null;  // mm
          snow?: number | null; // mm
        }>;
        meta: {
          station: MeteostatStation;
          generated_at: string;
          query_time: number;
        };
      };

      if (!data.data || data.data.length === 0) {
        throw new Error('No data returned from Meteostat for the specified date range');
      }

      // Parse response into observations
      const observations = this.parseResponse(data);

      console.log(`[METEOSTAT] Retrieved ${observations.length} hourly observations`);
      console.log(`[METEOSTAT] Station: ${data.meta.station.name} (${data.meta.station.id}) at ${data.meta.station.distance?.toFixed(1) || 'unknown'}km`);
      console.log(`[METEOSTAT] Time range: ${observations[0]?.time} to ${observations[observations.length - 1]?.time}`);

      return {
        observations,
        station: data.meta.station,
        generated_at: data.meta.generated_at
      };
    } catch (error) {
      console.error('[METEOSTAT] Error fetching data:', error);
      throw error;
    }
  }

  /**
   * Convert Meteostat hourly data to structured observations
   *
   * @param data Raw API response data
   * @returns Array of parsed observations
   */
  private parseResponse(data: {
    data?: Array<{
      time: string;
      temp: number | null;
      rhum: number | null;
      dwpt: number | null;
      wspd: number | null;
      pres: number | null;
      prcp: number | null;
      snow?: number | null;
    }>;
    meta: {
      station: MeteostatStation;
      generated_at: string;
      query_time: number;
    };
  }): MeteostatHourlyObservation[] {
    const observations: MeteostatHourlyObservation[] = [];
    const rawData = data.data || [];

    for (const record of rawData) {
      // Skip records with missing critical data (temp, humidity, pressure)
      if (record.temp == null || record.rhum == null || record.pres == null) {
        continue;
      }

      // Convert wind speed from km/h to m/s (divide by 3.6)
      // Default to 0 if missing
      const windSpeedMs = record.wspd != null ? record.wspd / 3.6 : 0;

      // Calculate dew point if not provided (approximation from temp and RH)
      let dewPoint = record.dwpt;
      if (dewPoint == null && record.temp != null && record.rhum != null) {
        // Magnus formula approximation
        const a = 17.27;
        const b = 237.7;
        const alpha = (a * record.temp) / (b + record.temp) + Math.log(record.rhum / 100);
        dewPoint = (b * alpha) / (a - alpha);
      }

      observations.push({
        time: record.time,
        temperature: record.temp,
        humidity: record.rhum,
        dew_point: dewPoint || 0,
        wind_speed: windSpeedMs,
        pressure: record.pres,
        precipitation: record.prcp || 0,
        snow_depth: record.snow || 0
      });
    }

    // Sort by timestamp (should already be sorted, but ensure)
    return observations.sort((a, b) =>
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );
  }

  /**
   * Build Meteostat API URL with parameters
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
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      start: startDate,
      end: endDate
    });

    return `${this.config.baseUrl}?${params}`;
  }
}
