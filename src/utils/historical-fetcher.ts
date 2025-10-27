/**
 * Historical WBGT Data Fetching - Timezone Unified
 * Consolidates fetchKongWBGT (Sydney) and fetchKongWBGTJapan (Tokyo)
 */

import { calculateKongWBGTPipelineByTimezone } from '../calculations/kong-wbgt';

export class HistoricalFetcher {
  async fetchKongWBGTByTimezone(
    startDate: string,
    endDate: string,
    latitude: number,
    longitude: number,
    utcOffset: number = 10,
    hasDST: boolean = true,
    timezone: string = 'Australia/Sydney'
  ): Promise<any[]> {
    // Validate that endDate is not today (data not uploaded yet)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const endDateObj = new Date(endDate);
    const todayObj = new Date(todayStr);

    if (endDateObj >= todayObj) {
      throw new Error(`Invalid date range: end_date cannot be today (${todayStr}) or in the future. Data is only available for past dates.`);
    }

    console.log(`[KONG-TZ] Validated date range: ${startDate} to ${endDate} (timezone: ${timezone}, before today: ${todayStr})`);

    // Build URL with proper timezone parameter
    const encodedTimezone = encodeURIComponent(timezone);
    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wet_bulb_temperature_2m,surface_pressure,wind_speed_10m,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,cloud_cover&timezone=${encodedTimezone}`;

    try {
      const response = await fetch(weatherUrl);
      if (!response.ok) {
        console.error('[KONG-TZ] Failed to fetch from OpenMeteo:', response.status);
        throw new Error(`OpenMeteo API error: ${response.status}`);
      }

      const weatherData = await response.json() as any;
      const results: any[] = [];

      // Extract all arrays from hourly data (same pattern as both original functions)
      const times = weatherData?.hourly?.time || [];
      const temps = weatherData?.hourly?.temperature_2m || [];
      const humidity = weatherData?.hourly?.relative_humidity_2m || [];
      const dewpoints = weatherData?.hourly?.dew_point_2m || [];
      const wetBulbs = weatherData?.hourly?.wet_bulb_temperature_2m || [];
      const pressures = weatherData?.hourly?.surface_pressure || [];
      const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
      const srInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
      const srDirect = weatherData?.hourly?.direct_radiation_instant || [];
      const srDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];
      const apparentTemps = weatherData?.hourly?.apparent_temperature || [];
      const cloudCovers = weatherData?.hourly?.cloud_cover || [];

      console.log(`[KONG-TZ] Processing ${times.length} hourly records for ${timezone}`);

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
          // Use the timezone-unified Kong WBGT calculation
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

          // Archive API with timezone parameter already returns local time
          // Format directly from ISO string without Date object timezone handling
          // time format: "2025-10-24T11:00" (local time for specified timezone)
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
            apparent_temp: parseFloat((apparentTemps[idx] || 0).toFixed(1))
          });
        } catch (error) {
          console.error(`[KONG-TZ] Error processing record at ${time}:`, error);
        }
      });

      console.log(`[KONG-TZ] Successfully processed ${results.length} records for ${timezone}`);
      return results;
    } catch (error) {
      console.error('[KONG-TZ] Error fetching Kong WBGT data:', error);
      throw error;
    }
  }
}
