/**
 * Historical WBGT Data Fetching - Unified with Satellite Solar Radiation Priority
 * Priority: NOAA ISD observational data (Sydney-optimized) → Open-Meteo archive (fallback)
 * Works entirely in local time (input dates in local time, output timestamps in local time)
 */

import { calculateKongWBGTPipelineByTimezone } from '../calculations/kong-wbgt';
import { ISDFetcher, ISDParser, findNearestSydneyStation } from './noaa-isd';
import type { ISDObservation } from './noaa-isd';

interface SatelliteRadiationData {
  hourly?: {
    time?: string[];
    shortwave_radiation_instant?: number[];
    direct_radiation_instant?: number[];
    diffuse_radiation_instant?: number[];
  };
}

export class HistoricalFetcher {
  /**
   * Calculate wet bulb temperature from dry bulb temp, relative humidity, and pressure
   * Using Stull (2011) approximation formula
   * Reference: https://journals.ametsoc.org/view/journals/apme/50/11/jamc-d-11-0143.1.xml
   */
  private calculateWetBulbTemperature(
    T: number,      // Dry bulb temperature (°C)
    RH: number,     // Relative humidity (%)
    P: number       // Pressure (hPa)
  ): number {
    // Stull formula (accurate to ±1°C for most conditions)
    const Tw = T * Math.atan(0.151977 * Math.pow(RH + 8.313659, 0.5))
             + Math.atan(T + RH)
             - Math.atan(RH - 1.676331)
             + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
             - 4.686035;

    return Tw;
  }

  /**
   * Try to fetch NOAA ISD observational data (Sydney-optimized for 99% use case)
   * Returns null if coordinates outside Sydney area or data unavailable
   */
  private async fetchNOAAISD(
    startDate: string,
    endDate: string,
    latitude: number,
    longitude: number,
    timezone: string
  ): Promise<{ observations: ISDObservation[]; stationName: string; distance: number } | null> {
    try {
      // Find nearest Sydney station (returns null if >100km from Sydney)
      const nearest = findNearestSydneyStation(latitude, longitude);

      if (!nearest) {
        console.log(`[ISD] Location outside Sydney coverage area, will use Open-Meteo archive`);
        return null;
      }

      console.log(`[ISD] Found station: ${nearest.station.name} (${nearest.distance.toFixed(1)} km away)`);

      // Fetch ISD files from S3
      const fetcher = new ISDFetcher();
      const fileContents = await fetcher.fetchDateRange(nearest.station, startDate, endDate);

      // Parse ISD data
      const parser = new ISDParser();
      const parsed = parser.parseISDFiles(fileContents, nearest.station, startDate, endDate);

      // Check if we have sufficient data
      if (parsed.observations.length === 0) {
        console.log(`[ISD] No observations found, will fallback to Open-Meteo archive`);
        return null;
      }

      if (parsed.data_quality === 'poor') {
        console.log(`[ISD] Data quality poor (${parsed.data_quality}), will fallback to Open-Meteo archive`);
        return null;
      }

      console.log(`[ISD] Successfully fetched ${parsed.observations.length} observations (quality: ${parsed.data_quality})`);

      return {
        observations: parsed.observations,
        stationName: nearest.station.name,
        distance: nearest.distance
      };
    } catch (error) {
      console.error('[ISD] Error fetching NOAA ISD data:', error);
      return null;
    }
  }

  /**
   * Convert ISD observations to Open-Meteo-like hourly format
   * This allows seamless integration with existing WBGT pipeline
   */
  private convertISDToHourlyArrays(
    observations: ISDObservation[],
    timezone: string
  ): {
    times: string[];
    temps: number[];
    humidity: number[];
    dewpoints: number[];
    pressures: number[];
    windSpeeds: number[];
    cloudCovers: number[];
  } {
    // Sort by timestamp
    const sorted = [...observations].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const times: string[] = [];
    const temps: number[] = [];
    const humidity: number[] = [];
    const dewpoints: number[] = [];
    const pressures: number[] = [];
    const windSpeeds: number[] = [];
    const cloudCovers: number[] = [];

    for (const obs of sorted) {
      // Convert UTC timestamp to local time based on timezone
      const utcDate = new Date(obs.timestamp);
      const localTime = utcDate.toLocaleString('en-CA', {
        timeZone: timezone === 'auto' ? 'Australia/Sydney' : timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Format as YYYY-MM-DDTHH:MM
      const [datePart, timePart] = localTime.split(', ');
      const formattedTime = `${datePart}T${timePart}`;

      times.push(formattedTime);
      temps.push(obs.temperature || 0);
      humidity.push(obs.relative_humidity || 0);
      dewpoints.push(obs.dew_point || 0);
      pressures.push(obs.sea_level_pressure || 1013.25);
      windSpeeds.push(obs.wind_speed || 0);
      cloudCovers.push(obs.cloud_cover || 0);
    }

    return { times, temps, humidity, dewpoints, pressures, windSpeeds, cloudCovers };
  }

  /**
   * Validates satellite solar radiation data by checking for zeros during expected daylight hours
   * Returns true if data appears valid (has non-zero values during daylight)
   */
  private validateSatelliteRadiation(times: string[], srInstant: number[]): boolean {
    if (!times.length || !srInstant.length) return false;

    // Check if we have any non-zero radiation during typical daylight hours (6 AM - 6 PM)
    let daylightSamples = 0;
    let nonZeroDaylight = 0;

    for (let i = 0; i < times.length; i++) {
      const hour = parseInt(times[i].split('T')[1]?.split(':')[0] || '0');

      // Check hours 6-18 (6 AM - 6 PM)
      if (hour >= 6 && hour <= 18) {
        daylightSamples++;
        if (srInstant[i] > 0) {
          nonZeroDaylight++;
        }
      }
    }

    // If we have daylight samples but all are zero, validation fails
    if (daylightSamples > 0 && nonZeroDaylight === 0) {
      console.log(`[SAT-VALIDATE] Satellite data invalid: ${daylightSamples} daylight hours all have 0 W/m²`);
      return false;
    }

    // Require at least 10% of daylight hours to have non-zero radiation
    const validRatio = daylightSamples > 0 ? (nonZeroDaylight / daylightSamples) : 0;
    const isValid = validRatio >= 0.1;

    console.log(`[SAT-VALIDATE] Satellite data validation: ${nonZeroDaylight}/${daylightSamples} daylight hours with radiation (${(validRatio * 100).toFixed(1)}%) - ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  }

  /**
   * Fetches satellite solar radiation data with validation
   * Returns null if data is invalid or unavailable
   */
  private async fetchSatelliteRadiation(
    startDate: string,
    endDate: string,
    latitude: number,
    longitude: number
  ): Promise<SatelliteRadiationData | null> {
    const satelliteUrl = `https://satellite-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&hourly=shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant&models=satellite_radiation_seamless&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

    try {
      console.log(`[SAT-FETCH] Fetching satellite solar radiation...`);
      const response = await fetch(satelliteUrl);

      if (!response.ok) {
        console.log(`[SAT-FETCH] Satellite API returned ${response.status}, will fallback to archive API`);
        return null;
      }

      const data = await response.json() as SatelliteRadiationData;
      const times = data?.hourly?.time || [];
      const srInstant = data?.hourly?.shortwave_radiation_instant || [];

      // Validate the data
      if (!this.validateSatelliteRadiation(times, srInstant)) {
        console.log(`[SAT-FETCH] Satellite data validation failed, will fallback to archive API`);
        return null;
      }

      console.log(`[SAT-FETCH] Satellite data validated successfully`);
      return data;
    } catch (error) {
      console.error(`[SAT-FETCH] Error fetching satellite data:`, error);
      return null;
    }
  }

  async fetchKongWBGTByTimezone(
    startDate: string,
    endDate: string,
    latitude: number,
    longitude: number,
    timezone: string = 'auto'
  ): Promise<any[]> {
    // Validate that endDate is not today (data not uploaded yet)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const endDateObj = new Date(endDate);
    const todayObj = new Date(todayStr);

    if (endDateObj >= todayObj) {
      throw new Error(`Invalid date range: end_date cannot be today (${todayStr}) or in the future. Data is only available for past dates.`);
    }

    console.log(`[HISTORIC] Fetching data for ${startDate} to ${endDate} (timezone: ${timezone})`);

    // Priority 1a: Try NOAA ISD observational data (Sydney-optimized, 99% use case)
    const isdData = await this.fetchNOAAISD(startDate, endDate, latitude, longitude, timezone);
    let weatherSource = 'none';
    let stationInfo: { name: string; distance: number } | null = null;

    // Parallel fetch: Satellite radiation (Priority 1b) + weather data
    const satelliteData = await this.fetchSatelliteRadiation(startDate, endDate, latitude, longitude);

    let times: string[];
    let temps: number[];
    let humidity: number[];
    let dewpoints: number[];
    let wetBulbs: number[];
    let pressures: number[];
    let windSpeeds: number[];
    let apparentTemps: number[];
    let cloudCovers: number[];

    if (isdData) {
      // Use NOAA ISD observational data
      console.log(`[HISTORIC] Using NOAA ISD observational data from ${isdData.stationName}`);
      weatherSource = 'isd';
      stationInfo = { name: isdData.stationName, distance: isdData.distance };

      const arrays = this.convertISDToHourlyArrays(isdData.observations, timezone);
      times = arrays.times;
      temps = arrays.temps;
      humidity = arrays.humidity;
      dewpoints = arrays.dewpoints;
      pressures = arrays.pressures;
      windSpeeds = arrays.windSpeeds;
      cloudCovers = arrays.cloudCovers;

      // Calculate wet bulb temperature from temp, humidity, and pressure
      wetBulbs = temps.map((temp, i) =>
        this.calculateWetBulbTemperature(temp, humidity[i], pressures[i])
      );

      // Apparent temp placeholder (not critical for WBGT calculation)
      apparentTemps = temps.map(() => 0);
    } else {
      // Fallback to Open-Meteo archive (model data)
      console.log(`[HISTORIC] Falling back to Open-Meteo archive (model data)`);
      weatherSource = 'archive';

      const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wet_bulb_temperature_2m,surface_pressure,wind_speed_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,cloud_cover&timezone=${timezone}`;

      try {
        const response = await fetch(weatherUrl);
        if (!response.ok) {
          console.error('[HISTORIC] Failed to fetch from OpenMeteo archive:', response.status);
          throw new Error(`OpenMeteo archive API error: ${response.status}`);
        }

        const weatherData = await response.json() as any;

        // Extract weather data arrays
        times = weatherData?.hourly?.time || [];
        temps = weatherData?.hourly?.temperature_2m || [];
        humidity = weatherData?.hourly?.relative_humidity_2m || [];
        dewpoints = weatherData?.hourly?.dew_point_2m || [];
        wetBulbs = weatherData?.hourly?.wet_bulb_temperature_2m || [];
        pressures = weatherData?.hourly?.surface_pressure || [];
        windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
        apparentTemps = weatherData?.hourly?.apparent_temperature || [];
        cloudCovers = weatherData?.hourly?.cloud_cover || [];
      } catch (error) {
        console.error('[HISTORIC] Error fetching Open-Meteo archive:', error);
        throw error;
      }
    }

    try {
      const results: any[] = [];

      // Solar radiation: prioritize satellite, fallback to archive
      let srInstant: number[];
      let srDirect: number[];
      let srDiffuse: number[];
      let solarSource: string;

      if (satelliteData) {
        // Use satellite data (already validated)
        srInstant = satelliteData.hourly?.shortwave_radiation_instant || [];
        srDirect = satelliteData.hourly?.direct_radiation_instant || [];
        srDiffuse = satelliteData.hourly?.diffuse_radiation_instant || [];
        solarSource = 'satellite';
        console.log(`[HISTORIC] Using SATELLITE solar radiation data`);
      } else {
        // Fallback to archive API
        srInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
        srDirect = weatherData?.hourly?.direct_radiation_instant || [];
        srDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];
        solarSource = 'archive';
        console.log(`[HISTORIC] Using ARCHIVE solar radiation data (fallback)`);
      }

      console.log(`[HISTORIC] Processing ${times.length} hourly records (solar source: ${solarSource})`);

      times.forEach((time: string, idx: number) => {
        const Ta = temps[idx];
        const RH = humidity[idx];
        const Tdew = dewpoints[idx];
        const Tw = wetBulbs[idx];
        const P_hPa = pressures[idx];
        const u10m = windSpeeds[idx];
        const SRdown = srInstant[idx] || 0;
        const SRdirect = srDirect[idx] || 0;
        const SRdiffuse = srDiffuse[idx] || 0;

        try {
          // Calculate Kong WBGT (timezone=auto means data is already in local time)
          const kongCalc = calculateKongWBGTPipelineByTimezone(
            Ta,
            Tw,
            RH,
            P_hPa,
            u10m,
            SRdown,
            SRdirect,
            SRdiffuse,
            latitude,
            longitude,
            time,
            0,  // utcOffset not needed with timezone=auto
            false  // hasDST not needed with timezone=auto
          );

          // Time format from API: "2025-10-24T11:00" (already in local time)
          // Convert to DD/MM/YYYY, HH:MM:SS format
          const [datePart, timePart] = time.split('T');
          const [year, month, day] = datePart.split('-');
          const localTimestamp = `${day}/${month}/${year}, ${timePart}:00`;

          const result: any = {
            timestamp: localTimestamp,
            temperature: parseFloat(Ta.toFixed(1)),
            humidity: Math.round(RH),
            dew_point: parseFloat(Tdew.toFixed(1)),
            wind_speed_ms: parseFloat(u10m.toFixed(2)),
            solar_radiation: parseFloat(SRdown.toFixed(1)),
            cloud_cover: parseFloat((cloudCovers[idx] || 0).toFixed(1)),
            wbgt: parseFloat(kongCalc.kong_wbgt.toFixed(1)),
            esi: parseFloat(kongCalc.esi.toFixed(1)),
            apparent_temp: parseFloat((apparentTemps[idx] || 0).toFixed(1)),
            weather_source: weatherSource,
            solar_source: solarSource
          };

          // Add station info if using ISD
          if (stationInfo) {
            result.station = stationInfo.name;
            result.station_distance_km = parseFloat(stationInfo.distance.toFixed(1));
          }

          results.push(result);
        } catch (error) {
          console.error(`[HISTORIC] Error processing record at ${time}:`, error);
        }
      });

      console.log(`[HISTORIC] Successfully processed ${results.length} records (weather: ${weatherSource}, solar: ${solarSource})`);
      return results;
    } catch (error) {
      console.error('[HISTORIC] Error fetching Kong WBGT data:', error);
      throw error;
    }
  }
}
