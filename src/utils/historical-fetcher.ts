/**
 * Historical WBGT Data Fetching - Unified with Satellite Solar Radiation Priority
 * Works entirely in local time (input dates in local time, output timestamps in local time)
 */

import { calculateKongWBGTPipelineByTimezone } from '../calculations/kong-wbgt';

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

    // Fetch satellite radiation data (with validation and fallback)
    const satelliteData = await this.fetchSatelliteRadiation(startDate, endDate, latitude, longitude);

    // Build weather URL with timezone=auto (works entirely in local time)
    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wet_bulb_temperature_2m,surface_pressure,wind_speed_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,cloud_cover&timezone=${timezone}`;

    try {
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        console.error('[HISTORIC] Failed to fetch from OpenMeteo archive:', response.status);
        throw new Error(`OpenMeteo archive API error: ${response.status}`);
      }

      const weatherData = await response.json() as any;
      const results: any[] = [];

      // Extract weather data arrays
      const times = weatherData?.hourly?.time || [];
      const temps = weatherData?.hourly?.temperature_2m || [];
      const humidity = weatherData?.hourly?.relative_humidity_2m || [];
      const dewpoints = weatherData?.hourly?.dew_point_2m || [];
      const wetBulbs = weatherData?.hourly?.wet_bulb_temperature_2m || [];
      const pressures = weatherData?.hourly?.surface_pressure || [];
      const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
      const apparentTemps = weatherData?.hourly?.apparent_temperature || [];
      const cloudCovers = weatherData?.hourly?.cloud_cover || [];

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

          results.push({
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
            solar_source: solarSource
          });
        } catch (error) {
          console.error(`[HISTORIC] Error processing record at ${time}:`, error);
        }
      });

      console.log(`[HISTORIC] Successfully processed ${results.length} records (solar: ${solarSource})`);
      return results;
    } catch (error) {
      console.error('[HISTORIC] Error fetching Kong WBGT data:', error);
      throw error;
    }
  }
}
