/**
 * Historical WBGT Data Fetching - Unified with Satellite Solar Radiation Priority
 * Priority: NOAA ISD observational data (Sydney-optimized) → Open-Meteo archive (fallback)
 * Works entirely in local time (input dates in local time, output timestamps in local time)
 */

import {
  calculateKongWBGTPipelineByTimezone,
  calculateKongBlackGlobe,
  calculateKongNaturalWetBulb,
  calculatePsychrometricWetBulb
} from '../calculations/kong-wbgt';
import { calculateSolarZenithAngleByTimezone } from '../calculations/solar/solar-geometry';
import { calculateBuckSaturationVaporPressure } from '../calculations/vapor-pressure';
import { calculateWindAt2m, calculateAirProperties } from '../calculations/air-properties';
import { calculateRadiationComponents } from '../calculations/radiation';
import { calculateHeatTransferCoefficients } from '../calculations/heat-transfer';
import { STEFAN_BOLTZMANN, WICK_EMISSIVITY } from '../constants';
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

/**
 * Get timezone offset and DST information for a given location and timestamp
 * Uses IANA timezone database via Intl API
 */
function getTimezoneInfo(
  latitude: number,
  longitude: number,
  timestamp: string,
  timezoneParam: string = 'auto'
): { utcOffset: number; hasDST: boolean; timezone: string } {
  // If timezone is explicitly provided (not 'auto'), use it directly
  if (timezoneParam !== 'auto') {
    try {
      const date = new Date(timestamp);
      const utcOffset = -date.getTimezoneOffset() / 60; // Convert minutes to hours

      // Check if DST is active for this timezone at this timestamp
      const january = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
      const july = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
      const hasDST = Math.max(january, july) !== Math.min(january, july);

      return { utcOffset, hasDST, timezone: timezoneParam };
    } catch (error) {
      console.warn(`[TIMEZONE] Error getting timezone info for ${timezoneParam}, falling back to Sydney`);
    }
  }

  // For 'auto', estimate based on longitude (rough approximation)
  // Each 15 degrees = 1 hour offset
  const estimatedOffset = Math.round(longitude / 15);

  // Common timezone mapping based on latitude/longitude regions
  if (latitude >= -40 && latitude <= -25 && longitude >= 140 && longitude <= 155) {
    // Sydney, Australia region (expanded to cover southeastern Australia)
    return { utcOffset: 10, hasDST: true, timezone: 'Australia/Sydney' };
  } else if (latitude >= 34 && latitude <= 46 && longitude >= 128 && longitude <= 146) {
    // Tokyo, Japan region
    return { utcOffset: 9, hasDST: false, timezone: 'Asia/Tokyo' };
  } else if (latitude >= 25 && latitude <= 50 && longitude >= -125 && longitude <= -65) {
    // North America - estimate based on longitude
    const hasDST = latitude > 24; // Approximate DST boundary
    return { utcOffset: estimatedOffset, hasDST, timezone: 'auto' };
  } else if (latitude >= 35 && latitude <= 60 && longitude >= -10 && longitude <= 40) {
    // Europe - most use DST
    return { utcOffset: estimatedOffset, hasDST: true, timezone: 'auto' };
  }

  // Default fallback: simple longitude-based calculation, no DST
  return { utcOffset: estimatedOffset, hasDST: false, timezone: 'auto' };
}

export class HistoricalFetcher {
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
      console.log(`[ISD-DEBUG] Searching for nearest station for ${latitude}, ${longitude}`);
      const nearest = findNearestSydneyStation(latitude, longitude);

      if (!nearest) {
        console.log(`[ISD-DEBUG] No station found within coverage area`);
        console.log(`[ISD] Location outside Sydney coverage area, will use Open-Meteo archive`);
        return null;
      }

      console.log(`[ISD-DEBUG] Found station: ${nearest.station.name} (ID: ${getStationId(nearest.station)}) at ${nearest.distance.toFixed(2)} km`);
      console.log(`[ISD] Found station: ${nearest.station.name} (${nearest.distance.toFixed(1)} km away)`);

      // Fetch ISD files from S3
      console.log(`[ISD-DEBUG] Attempting to fetch ISD data for ${startDate} to ${endDate}`);
      const fetcher = new ISDFetcher();
      let fileContents: string[] = [];
      try {
        fileContents = await fetcher.fetchDateRange(nearest.station, startDate, endDate);
        console.log(`[ISD-DEBUG] Fetched ${fileContents.length} files from S3`);
      } catch (error: any) {
        console.log(`[ISD-DEBUG] fetchDateRange FAILED: ${error?.message || error}`);
        console.log(`[ISD] S3 fetch failed, will fallback to Open-Meteo archive`);
        return null;
      }

      if (fileContents.length === 0) {
        console.log(`[ISD-DEBUG] No files returned from S3 for station ${getStationId(nearest.station)}`);
        console.log(`[ISD] No S3 data available, will fallback to Open-Meteo archive`);
        return null;
      }

      // Parse ISD data
      console.log(`[ISD-DEBUG] Parsing ISD files...`);
      const parser = new ISDParser();
      const parsed = parser.parseISDFiles(fileContents, nearest.station, startDate, endDate);
      console.log(`[ISD-DEBUG] Parsed: ${parsed.observations.length} observations, quality: ${parsed.data_quality}, missing: ${parsed.missing_count}/${parsed.total_count}`);

      // Check if we have sufficient data
      if (parsed.observations.length === 0) {
        console.log(`[ISD-DEBUG] Zero observations after parsing`);
        console.log(`[ISD] No observations found, will fallback to Open-Meteo archive`);
        return null;
      }

      if (parsed.data_quality === 'poor') {
        console.log(`[ISD-DEBUG] Data quality is 'poor'`);
        console.log(`[ISD] Data quality poor (${parsed.data_quality}), will fallback to Open-Meteo archive`);
        return null;
      }

      if (parsed.missing_count / parsed.total_count > 0.5) {
        console.log(`[ISD-DEBUG] Too many missing values: ${parsed.missing_count}/${parsed.total_count} (${(parsed.missing_count / parsed.total_count * 100).toFixed(1)}%)`);
        console.log(`[ISD] Too many missing observations, will fallback to Open-Meteo archive`);
        return null;
      }

      console.log(`[ISD-DEBUG] SUCCESS: ${parsed.observations.length} good observations`);
      console.log(`[ISD] Successfully fetched ${parsed.observations.length} observations (quality: ${parsed.data_quality})`);

      return {
        observations: parsed.observations,
        stationName: nearest.station.name,
        distance: nearest.distance
      };
    } catch (error) {
      console.error('[ISD-DEBUG] EXCEPTION:', error);
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

    // **PERFORMANCE OPTIMIZATION: Parallel fetching**
    // Fetch both NOAA ISD (Priority 1a) and Satellite radiation (Priority 1b) in parallel
    console.log(`[HISTORIC] Starting parallel fetch: ISD weather + satellite radiation`);
    const [isdData, satelliteData] = await Promise.all([
      this.fetchNOAAISD(startDate, endDate, latitude, longitude, timezone),
      this.fetchSatelliteRadiation(startDate, endDate, latitude, longitude)
    ]);

    let weatherSource = 'none';
    let stationInfo: { name: string; distance: number } | null = null;

    let times: string[];
    let temps: number[];
    let humidity: number[];
    let dewpoints: number[];
    let wetBulbs: number[];
    let pressures: number[];
    let windSpeeds: number[];
    let apparentTemps: number[];
    let cloudCovers: number[];
    let weatherData: any = null; // Declare here so it's accessible in solar radiation fallback

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

      // Calculate psychrometric wet bulb temperature from temp, humidity, and pressure
      wetBulbs = temps.map((temp, i) =>
        calculatePsychrometricWetBulb(temp, humidity[i], pressures[i])
      );

      // Apparent temp placeholder (not critical for WBGT calculation)
      apparentTemps = temps.map(() => 0);

      // If satellite data is unavailable, fetch archive data for solar radiation fallback
      if (!satelliteData) {
        console.log(`[HISTORIC] Fetching Open-Meteo archive for solar radiation fallback`);
        const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant&timezone=${timezone}`;

        try {
          const response = await fetch(weatherUrl);
          if (response.ok) {
            weatherData = await response.json() as any;
            console.log(`[HISTORIC] Archive solar radiation data fetched successfully`);
          }
        } catch (error) {
          console.error('[HISTORIC] Error fetching archive solar radiation:', error);
        }
      }
    } else {
      // Fallback to Open-Meteo archive (model data)
      console.log(`[HISTORIC] Falling back to Open-Meteo archive (model data)`);
      weatherSource = 'archive';

      const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,cloud_cover&timezone=${timezone}`;

      try {
        const response = await fetch(weatherUrl);
        if (!response.ok) {
          console.error('[HISTORIC] Failed to fetch from OpenMeteo archive:', response.status);
          throw new Error(`OpenMeteo archive API error: ${response.status}`);
        }

        weatherData = await response.json() as any;

        // Extract weather data arrays
        times = weatherData?.hourly?.time || [];
        temps = weatherData?.hourly?.temperature_2m || [];
        humidity = weatherData?.hourly?.relative_humidity_2m || [];
        dewpoints = weatherData?.hourly?.dew_point_2m || [];
        pressures = weatherData?.hourly?.surface_pressure || [];
        windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
        apparentTemps = weatherData?.hourly?.apparent_temperature || [];
        cloudCovers = weatherData?.hourly?.cloud_cover || [];

        // Calculate psychrometric wet bulb temperature from temp, humidity, and pressure
        wetBulbs = temps.map((temp, i) =>
          calculatePsychrometricWetBulb(temp, humidity[i], pressures[i])
        );
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
      let solarTimeMap: Record<string, { sr: number; direct: number; diffuse: number }> = {};

      // Debug: log first few time samples to understand format alignment
      console.log(`[HISTORIC] ISD time samples:`, times.slice(0, 3));
      if (satelliteData) {
        console.log(`[HISTORIC] Satellite time samples:`, satelliteData.hourly?.time?.slice(0, 3));
      }

      if (satelliteData) {
        // Use satellite data (already validated)
        const satTimes = satelliteData.hourly?.time || [];
        const satSRInstant = satelliteData.hourly?.shortwave_radiation_instant || [];
        const satSRDirect = satelliteData.hourly?.direct_radiation_instant || [];
        const satSRDiffuse = satelliteData.hourly?.diffuse_radiation_instant || [];

        // Build time-indexed map for satellite data
        satTimes.forEach((satTime: string, i: number) => {
          // Convert satellite time (ISO format) to match ISD format for lookup
          const hourKey = satTime.substring(0, 13); // "2025-06-23T10"
          solarTimeMap[hourKey] = {
            sr: satSRInstant[i] || 0,
            direct: satSRDirect[i] || 0,
            diffuse: satSRDiffuse[i] || 0
          };
        });

        solarSource = 'satellite';
        console.log(`[HISTORIC] Using SATELLITE solar radiation data with ${Object.keys(solarTimeMap).length} time entries`);
      } else {
        // Fallback to archive API - build map from archive data
        const archiveTimes = weatherData?.hourly?.time || [];
        const archiveSRInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
        const archiveSRDirect = weatherData?.hourly?.direct_radiation_instant || [];
        const archiveSRDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];

        archiveTimes.forEach((archiveTime: string, i: number) => {
          const hourKey = archiveTime.substring(0, 13); // "2025-06-23T10"
          solarTimeMap[hourKey] = {
            sr: archiveSRInstant[i] || 0,
            direct: archiveSRDirect[i] || 0,
            diffuse: archiveSRDiffuse[i] || 0
          };
        });

        solarSource = 'archive';
        console.log(`[HISTORIC] Using ARCHIVE solar radiation data with ${Object.keys(solarTimeMap).length} time entries`);
      }

      console.log(`[HISTORIC] Processing ${times.length} hourly records (solar source: ${solarSource})`);

      times.forEach((time: string, idx: number) => {
        const Ta = temps[idx];
        const RH = humidity[idx];
        const Tdew = dewpoints[idx];
        const Tw = wetBulbs[idx];
        const P_hPa = pressures[idx];
        const u10m = windSpeeds[idx];

        // Lookup solar radiation by time, not by index
        const hourKey = time.substring(0, 13); // "2025-06-23T10"
        const solarData = solarTimeMap[hourKey] || { sr: 0, direct: 0, diffuse: 0 };
        let SRdown = solarData.sr;
        let SRdirect = solarData.direct;
        let SRdiffuse = solarData.diffuse;

        // Debug: log first few lookups to verify radiation values
        if (idx < 5) {
          console.log(`[HISTORIC] Time ${time} -> hourKey ${hourKey} -> solar radiation ${SRdown} W/m²`);
        }

        // Validate solar radiation: if sun is below horizon, radiation should be 0
        // This prevents timezone mismatches from causing radiation at night
        const { utcOffset, hasDST } = getTimezoneInfo(latitude, longitude, time, timezone);
        const solarZenith = calculateSolarZenithAngleByTimezone(latitude, longitude, time, utcOffset, hasDST);

        if (solarZenith > 90) {
          // Sun is below horizon, force radiation to 0
          SRdown = 0;
          SRdirect = 0;
          SRdiffuse = 0;
        }

        try {
          // Calculate Kong WBGT
          // Use dynamic timezone calculation for accurate solar geometry
          const { utcOffset, hasDST } = getTimezoneInfo(latitude, longitude, time, timezone);

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
            utcOffset,
            hasDST
          );

          // Time format from API: "2025-10-24T11:00" (already in local time)
          // Convert to DD/MM/YYYY, HH:MM:SS format
          const [datePart, timePart] = time.split('T');
          const [year, month, day] = datePart.split('-');
          const localTimestamp = `${day}/${month}/${year}, ${timePart}:00`;

          // Build source field in pattern: "weather_source: station + solar_source"
          const stationName = stationInfo ? stationInfo.name : 'Open-Meteo location';
          const source = `${weatherSource}: ${stationName} + ${solarSource}`;

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
            source
          };

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
