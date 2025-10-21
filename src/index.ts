import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Sydney coordinates
const SYDNEY_LAT = -33.8018;
const SYDNEY_LON = 151.1254;
const BOM_LOCATION_ID = "r3grwp";

// Cache configuration
const FORECAST_CACHE_KEY = 'wbgt:forecast';
const FORECAST_TTL = 43200; // 12 hours

// --- Cache utility ---
async function getCachedOrFetch(
  cacheKey: string,
  ttlSeconds: number,
  fetchFn: () => Promise<any>
): Promise<any> {
  const cache = caches.default;
  const cacheUrl = `https://wbgt-cache.internal/${cacheKey}`;
  
  let response = await cache.match(cacheUrl);
  
  if (response) {
    return response.json();
  }
  
  const data = await fetchFn();
  
  const cacheResponse = new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${ttlSeconds}`,
    },
  });
  
  await cache.put(cacheUrl, cacheResponse);
  return data;
}

// --- Calculation functions ---
export function calculateVaporPressure(ta: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
}

export function calculateWBGT(ta: number, rh: number, sr: number): number {
  // WBGT = 0.62Ta - 0.007RH + 0.002SR + 0.0043(Ta×RH) - 0.078/(0.1+SR)
  return 0.62 * ta - 0.007 * rh + 0.002 * sr + 0.0043 * (ta * rh) - 0.078 / (0.1 + sr);
}

export function calculateEWBGT(ta: number, e: number): number {
  // eWBGT = 0.567 × Ta + 0.393 × e + 3.94
  return 0.567 * ta + 0.393 * e + 3.94;
}

function calculateAT(ta: number, rh: number, ws_kmh: number, sr: number): number {
  const ws = ws_kmh / 3.6;
  const vaporPressure = (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
  return ta + 0.348 * vaporPressure - 0.70 * 0.75 * ws + 0.70 * 0.02 * sr / (ws * 0.75 + 10) - 4.25;
}

function parseBOMTime(bomTime: string): string {
  return `${bomTime.slice(0,4)}-${bomTime.slice(4,6)}-${bomTime.slice(6,8)}T${bomTime.slice(8,10)}:${bomTime.slice(10,12)}`;
}

// --- Fetch functions ---
async function fetchObservations(startDate?: string, endDate?: string) {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Determine if we need recent, historical, or both
  const needsRecent = !startDate || new Date(startDate) >= threeDaysAgo;
  const needsHistorical = startDate && new Date(startDate) < threeDaysAgo;

  console.log('[FETCH] startDate:', startDate, 'endDate:', endDate);
  console.log('[FETCH] threeDaysAgo:', threeDaysAgo.toISOString());
  console.log('[FETCH] needsRecent:', needsRecent, 'needsHistorical:', needsHistorical);

  // Case 1: Only recent data needed (no startDate or startDate within last 3 days)
  if (needsRecent && !needsHistorical) {
    const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=shortwave_radiation&timezone=Australia%2FSydney&past_days=3`;
    const bomUrl = "https://www.bom.gov.au/fwo/IDN60801/IDN60801.95765.json";
    const [srResponse, bomResponse] = await Promise.all([
      fetch(srUrl),
      fetch(bomUrl)
    ]);
    return {
      type: 'recent',
      srData: await srResponse.json(),
      bomData: await bomResponse.json()
    };
  }

  // Case 2: Only historical data needed (startDate and endDate both older than 3 days)
  if (needsHistorical && (!endDate || new Date(endDate) < threeDaysAgo)) {
    const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&start_date=${startDate}&end_date=${endDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,shortwave_radiation_instant&timezone=Australia%2FSydney`;
    const weatherResponse = await fetch(weatherUrl);

    return {
      type: 'historical',
      weatherData: await weatherResponse.json()
    };
  }

  // Case 3: Need both recent and historical (startDate older than 3 days, but endDate is recent or not specified)
  const historicalEndDate = threeDaysAgo.toISOString().split('T')[0]; // End historical at 3 days ago
  const weatherUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&start_date=${startDate}&end_date=${historicalEndDate}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,shortwave_radiation_instant&timezone=Australia%2FSydney`;
  const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=shortwave_radiation&timezone=Australia%2FSydney&past_days=3`;
  const bomUrl = "https://www.bom.gov.au/fwo/IDN60801/IDN60801.95765.json";

  const [weatherResponse, srResponse, bomResponse] = await Promise.all([
    fetch(weatherUrl),
    fetch(srUrl),
    fetch(bomUrl)
  ]);

  return {
    type: 'merged',
    weatherData: await weatherResponse.json(),
    srData: await srResponse.json(),
    bomData: await bomResponse.json()
  };
}

async function fetchForecast() {
  // TODO: Re-enable caching after debugging
  return await (async () => {
      const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=cloud_cover,shortwave_radiation,uv_index&timezone=UTC&forecast_days=3`;
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=us_aqi,pm10,pm2_5&timezone=UTC&forecast_days=3`;
      const bomUrl = `https://api.weather.bom.gov.au/v1/locations/${BOM_LOCATION_ID}/forecasts/hourly`;
      
      console.log('[FETCH] Starting forecast fetch...');
      const [srResponse, aqResponse, bomResponse] = await Promise.all([
        fetch(srUrl),
        fetch(aqUrl),
        fetch(bomUrl)
      ]);
      
      console.log('[FETCH] SR response status:', srResponse.status);
      console.log('[FETCH] AQ response status:', aqResponse.status);
      console.log('[FETCH] BOM response status:', bomResponse.status);
      
      const srData = await srResponse.json();
      const aqData = await aqResponse.json();
      const bomData = await bomResponse.json();
      
      console.log('[FETCH] srData.hourly exists?', !!srData?.hourly);
      console.log('[FETCH] srData.hourly.time length:', srData?.hourly?.time?.length || 0);
      console.log('[FETCH] srData.hourly.time (first 3):', srData?.hourly?.time?.slice(0, 3));
      console.log('[FETCH] srData.hourly.shortwave_radiation (first 3):', srData?.hourly?.shortwave_radiation?.slice(0, 3));
      console.log('[FETCH] BOM data.length:', bomData?.data?.length || 0);
      
      if (srResponse.status !== 200) {
        console.log('[FETCH] SR ERROR:', JSON.stringify(srData).substring(0, 200));
      }
      
      return {
        srData,
        aqData,
        bomData
      };
    }
  )();
}

// --- Helper functions for max values ---
function getMaxInRange(data: any[], startTime: string, endTime: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  const inRange = data.filter((d: any) => {
    const t = new Date(d.timestamp);
    return t >= start && t <= end;
  });
  
  if (inRange.length === 0) return null;
  
  return {
    timestamp: `${startTime} to ${endTime}`,
    temperature: Math.max(...inRange.map((d: any) => d.temperature)),
    humidity: Math.max(...inRange.map((d: any) => d.humidity)),
    dew_point: Math.max(...inRange.map((d: any) => d.dew_point)),
    solar_radiation: Math.max(...inRange.map((d: any) => d.solar_radiation)),
    wbgt: Math.max(...inRange.map((d: any) => d.wbgt)),
    apparent_temp: Math.max(...inRange.map((d: any) => d.apparent_temp))
  };
}

function getHistoricalAtTime(weatherData: any, targetTime: string) {
  const times = weatherData?.hourly?.time || [];
  const temps = weatherData?.hourly?.temperature_2m || [];
  const humidity = weatherData?.hourly?.relative_humidity_2m || [];
  const dewpoints = weatherData?.hourly?.dew_point_2m || [];
  const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
  const radiation = weatherData?.hourly?.shortwave_radiation_instant || [];
  
  const target = new Date(targetTime);
  
  // Find surrounding hours
  let beforeIdx = -1;
  let afterIdx = -1;
  
  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t <= target) beforeIdx = i;
    if (t >= target && afterIdx === -1) afterIdx = i;
  }
  
  // If exact match
  if (beforeIdx !== -1 && times[beforeIdx] === targetTime) {
    const ta = temps[beforeIdx];
    const rh = humidity[beforeIdx];
    const dewpt = dewpoints[beforeIdx];
    const ws_ms = windSpeeds[beforeIdx];
    const sr = radiation[beforeIdx] || 0;
    const e = calculateVaporPressure(ta, rh);
    const wbgt = calculateWBGT(ta, rh, sr);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, ws_ms * 3.6, sr);

    return {
      timestamp: targetTime,
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(dewpt.toFixed(1)),
      wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
      solar_radiation: Math.round(sr),
      wbgt: parseFloat(wbgt.toFixed(1)),
      ewbgt: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat(at.toFixed(1))
    };
  }
  
  // Take max of surrounding hours
  const indices = [beforeIdx, afterIdx].filter(i => i !== -1);
  if (indices.length === 0) return null;

  const maxTemp = Math.max(...indices.map(i => temps[i]));
  const maxRh = Math.max(...indices.map(i => humidity[i]));
  const maxDewpt = Math.max(...indices.map(i => dewpoints[i]));
  const maxWs = Math.max(...indices.map(i => windSpeeds[i]));
  const maxSr = Math.max(...indices.map(i => radiation[i] || 0));

  const e = calculateVaporPressure(maxTemp, maxRh);
  const wbgt = calculateWBGT(maxTemp, maxRh, maxSr);
  const ewbgt = calculateEWBGT(maxTemp, e);
  const at = calculateAT(maxTemp, maxRh, maxWs * 3.6, maxSr);

  return {
    timestamp: `${targetTime} (interpolated)`,
    temperature: parseFloat(maxTemp.toFixed(1)),
    humidity: Math.round(maxRh),
    dew_point: parseFloat(maxDewpt.toFixed(1)),
    wind_speed_ms: parseFloat(maxWs.toFixed(1)),
    solar_radiation: Math.round(maxSr),
    wbgt: parseFloat(wbgt.toFixed(1)),
    ewbgt: parseFloat(ewbgt.toFixed(1)),
    apparent_temp: parseFloat(at.toFixed(1))
  };
}

// --- Parsing functions ---

// Normalize BOM timestamps (various formats) to ISO format for reliable parsing
function normalizeBOMTimestamp(bomTimestamp: string): string {
  try {
    // Check if BOM timestamp is in compact format (14 digits like "20251020110000")
    if (/^\d{14}$/.test(bomTimestamp)) {
      const isoFormat = parseBOMTime(bomTimestamp);
      return isoFormat;
    } else if (/^\d{2}\/\d{1,2}:\d{2}[ap]m$/i.test(bomTimestamp)) {
      // BOM short format: "20/11:00am" -> day/hour:minuteam/pm
      const match = bomTimestamp.match(/^(\d{2})\/(\d{1,2}):(\d{2})([ap]m)$/i);
      if (match) {
        const day = parseInt(match[1]);
        let hour = parseInt(match[2]);
        const minute = parseInt(match[3]);
        const ampm = match[4].toLowerCase();

        // Convert 12-hour to 24-hour
        if (ampm === 'pm' && hour !== 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        }

        // Infer year and month from current date (BOM observations are always recent)
        const now = new Date();
        const nowUTC = new Date(now.getTime() + (11 * 60 * 60 * 1000)); // Approximate Sydney time
        let year = nowUTC.getUTCFullYear();
        let month = nowUTC.getUTCMonth() + 1;

        // If day > current day in Sydney, assume it's from previous month
        if (day > nowUTC.getUTCDate()) {
          month -= 1;
          if (month < 1) {
            month = 12;
            year -= 1;
          }
        }

        // Return ISO format
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const minStr = String(minute).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}:00Z`;
      }
    }

    // If already ISO format or other format, try parsing to validate
    const date = new Date(bomTimestamp);
    if (!isNaN(date.getTime())) {
      return bomTimestamp;
    }

    // Fallback: return as-is if we can't parse
    return bomTimestamp;
  } catch (e) {
    return bomTimestamp;
  }
}

function lookupSolarRadiation(bomTimestamp: string, srMap: Map<string, number>, debugFirst: boolean = false): number {
  if (debugFirst) {
    console.log('[DEBUG LOOKUP] BOM timestamp:', bomTimestamp);
  }

  // Try exact match first
  if (srMap.has(bomTimestamp)) {
    const value = srMap.get(bomTimestamp)!;
    if (debugFirst) console.log('[DEBUG LOOKUP] Exact match found:', value);
    return value;
  }

  try {
    let bomDate: Date;
    let alreadyFormatted = false; // Flag to skip re-formatting

    // Check if BOM timestamp is in compact format (14 digits like "20251020110000")
    if (/^\d{14}$/.test(bomTimestamp)) {
      // Use parseBOMTime to convert: "20251020110000" -> "2025-10-20T11:00"
      const isoFormat = parseBOMTime(bomTimestamp);
      bomDate = new Date(isoFormat);
      if (debugFirst) {
        console.log('[DEBUG LOOKUP] Compact format detected, converted to:', isoFormat);
      }
    } else if (/^\d{2}\/\d{1,2}:\d{2}[ap]m$/i.test(bomTimestamp)) {
      // BOM short format: "20/11:00am" -> day/hour:minuteam/pm
      // Build timestamp string directly to avoid timezone issues
      const match = bomTimestamp.match(/^(\d{2})\/(\d{1,2}):(\d{2})([ap]m)$/i);
      if (match) {
        const day = parseInt(match[1]);
        let hour = parseInt(match[2]);
        const minute = parseInt(match[3]);
        const ampm = match[4].toLowerCase();

        // Convert 12-hour to 24-hour
        if (ampm === 'pm' && hour !== 12) {
          hour += 12;
        } else if (ampm === 'am' && hour === 12) {
          hour = 0;
        }

        // Infer year and month from current date (BOM observations are always recent)
        const now = new Date();
        const nowUTC = new Date(now.getTime() + (11 * 60 * 60 * 1000)); // Approximate Sydney time
        let year = nowUTC.getUTCFullYear();
        let month = nowUTC.getUTCMonth() + 1; // 1-indexed for formatting

        // If day > current day in Sydney, assume it's from previous month
        if (day > nowUTC.getUTCDate()) {
          month -= 1;
          if (month < 1) {
            month = 12;
            year -= 1;
          }
        }

        // Build timestamp string directly: "2025-10-20T11:00"
        const roundedHour = minute >= 30 ? (hour + 1) % 24 : hour;
        const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(roundedHour).padStart(2, '0')}:00`;

        if (debugFirst) {
          console.log('[DEBUG LOOKUP] Short format detected');
          console.log('[DEBUG LOOKUP] Parsed: Year', year, 'Month', month, 'Day', day, 'Hour', hour, 'Min', minute);
          console.log('[DEBUG LOOKUP] Formatted directly:', formatted);
          console.log('[DEBUG LOOKUP] srMap size:', srMap.size);
          console.log('[DEBUG LOOKUP] srMap keys (first 5):', Array.from(srMap.keys()).slice(0, 5));
          console.log('[DEBUG LOOKUP] srMap keys (last 5):', Array.from(srMap.keys()).slice(-5));
          // Show keys around the target date
          const keysArray = Array.from(srMap.keys());
          const targetIndex = keysArray.findIndex(k => k >= formatted);
          if (targetIndex >= 0) {
            console.log('[DEBUG LOOKUP] Keys around target:', keysArray.slice(Math.max(0, targetIndex - 2), targetIndex + 3));
          }
        }

        // Try exact match on formatted timestamp
        if (srMap.has(formatted)) {
          const value = srMap.get(formatted)!;
          if (debugFirst) console.log('[DEBUG LOOKUP] Direct match found:', formatted, value);
          return value;
        }

        // For fallback nearest match, we need a Date object
        bomDate = new Date(Date.UTC(year, month - 1, day, roundedHour, 0, 0, 0));
        alreadyFormatted = true; // We already tried matching, skip re-formatting

        if (debugFirst) {
          console.log('[DEBUG LOOKUP] No direct match, trying nearest match');
        }
      } else {
        if (debugFirst) console.log('[DEBUG LOOKUP] Failed to parse short format');
        return 0;
      }
    } else {
      // Regular ISO format
      bomDate = new Date(bomTimestamp);
    }

    if (isNaN(bomDate.getTime())) {
      if (debugFirst) console.log('[DEBUG LOOKUP] Invalid date');
      return 0;
    }

    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Parsed BOM date:', bomDate.toISOString());
    }

    // If not already formatted (short format path), do formatting and exact match
    if (!alreadyFormatted) {
      // Round to nearest hour (since Open-Meteo provides hourly data)
      const minutes = bomDate.getMinutes();
      if (minutes >= 30) {
        bomDate.setHours(bomDate.getHours() + 1);
      }
      bomDate.setMinutes(0);
      bomDate.setSeconds(0);
      bomDate.setMilliseconds(0);

      // Format to match Open-Meteo format: "2025-10-20T04:00"
      // Both BOM and Open-Meteo data are in Sydney timezone, formatted as naive timestamps
      const isoString = bomDate.toISOString(); // e.g., "2025-10-20T01:00:00.000Z"
      const formatted = isoString.slice(0, 16); // "2025-10-20T01:00"

      if (debugFirst) {
        console.log('[DEBUG LOOKUP] BOM date ISO:', isoString);
        console.log('[DEBUG LOOKUP] Formatted:', formatted);
        console.log('[DEBUG LOOKUP] srMap keys (first 5):', Array.from(srMap.keys()).slice(0, 5));
      }

      // Try exact match on formatted timestamp
      if (srMap.has(formatted)) {
        const value = srMap.get(formatted)!;
        if (debugFirst) console.log('[DEBUG LOOKUP] Formatted match found:', formatted, value);
        return value;
      }
    }

    // Find nearest timestamp within ±30 minutes (for hourly data)
    const bomTime = bomDate.getTime();
    let nearest = 0;
    let minDiff = Infinity;
    let matchedKey = '';

    for (const [key, value] of srMap.entries()) {
      const srDate = new Date(key);
      const diff = Math.abs(srDate.getTime() - bomTime);
      if (diff <= 30 * 60 * 1000 && diff < minDiff) {
        minDiff = diff;
        nearest = value;
        matchedKey = key;
      }
    }

    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Nearest match:', nearest, 'key:', matchedKey, 'diff:', minDiff / 60000, 'minutes');
    }

    return nearest;
  } catch (e) {
    if (debugFirst) console.log('[DEBUG LOOKUP] Error:', e);
    return 0;
  }
}

function parseObservations(data: any, startTime?: string, endTime?: string) {
  const results: any[] = [];
  
  if (data.type === 'recent') {
    // BOM observations - field names: air_temp, rel_hum, dewpt, wind_spd_kmh
    const bom = data.bomData?.observations?.data || [];

    // Build solar radiation lookup map from Open-Meteo data (hourly intervals)
    const srTimes = data.srData?.hourly?.time || [];
    const srValues = data.srData?.hourly?.shortwave_radiation || [];

    console.log('[DEBUG] srData structure:', Object.keys(data.srData || {}));
    console.log('[DEBUG] srTimes.length:', srTimes.length);
    console.log('[DEBUG] srTimes (first 3):', srTimes.slice(0, 3));
    console.log('[DEBUG] srValues (first 3):', srValues.slice(0, 3));
    console.log('[DEBUG] BOM observations count:', bom.length);
    console.log('[DEBUG] BOM timestamps (first 3):', bom.slice(0, 3).map((o: any) => o.local_date_time));

    const srMap = new Map<string, number>();
    srTimes.forEach((time: string, idx: number) => {
      srMap.set(time, srValues[idx] || 0);
    });

    console.log('[DEBUG] srMap size:', srMap.size);

    bom.forEach((obs: any, idx: number) => {
      const ta = obs.air_temp;
      const rh = obs.rel_hum;
      const dewpt = obs.dewpt;
      const ws_kmh = obs.wind_spd_kmh || 0;
      const ws_ms = ws_kmh / 3.6;
      const sr = lookupSolarRadiation(obs.local_date_time, srMap, idx === 0);

      const e = calculateVaporPressure(ta, rh);
      const wbgt = calculateWBGT(ta, rh, sr);
      const ewbgt = calculateEWBGT(ta, e);
      const at = calculateAT(ta, rh, ws_kmh, sr);

      results.push({
        timestamp: normalizeBOMTimestamp(obs.local_date_time),
        temperature: parseFloat(ta.toFixed(1)),
        humidity: Math.round(rh),
        dew_point: parseFloat(dewpt.toFixed(1)),
        wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
        solar_radiation: Math.round(sr),
        wbgt: parseFloat(wbgt.toFixed(1)),
        ewbgt: parseFloat(ewbgt.toFixed(1)),
        apparent_temp: parseFloat(at.toFixed(1))
      });
    });
  } else if (data.type === 'historical') {
    // Archive API returns in Sydney local (specified in request)
    const weatherData = data.weatherData;

    const times = weatherData?.hourly?.time || [];
    const temps = weatherData?.hourly?.temperature_2m || [];
    const humidity = weatherData?.hourly?.relative_humidity_2m || [];
    const dewpoints = weatherData?.hourly?.dew_point_2m || [];
    const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
    const radiation = weatherData?.hourly?.shortwave_radiation_instant || [];

    times.forEach((time: string, idx: number) => {
      const ta = temps[idx];
      const rh = humidity[idx];
      const dewpt = dewpoints[idx];
      const ws_ms = windSpeeds[idx];
      const sr = radiation[idx] || 0;

      const e = calculateVaporPressure(ta, rh);
      const wbgt = calculateWBGT(ta, rh, sr);
      const ewbgt = calculateEWBGT(ta, e);
      const at = calculateAT(ta, rh, ws_ms * 3.6, sr);

      // Ensure ISO format timestamp for consistent parsing
      const isoTime = time.includes('T') ? time : new Date(time).toISOString();

      results.push({
        timestamp: isoTime,
        temperature: parseFloat(ta.toFixed(1)),
        humidity: Math.round(rh),
        dew_point: parseFloat(dewpt.toFixed(1)),
        wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
        solar_radiation: Math.round(sr),
        wbgt: parseFloat(wbgt.toFixed(1)),
        ewbgt: parseFloat(ewbgt.toFixed(1)),
        apparent_temp: parseFloat(at.toFixed(1))
      });
    });
  } else if (data.type === 'merged') {
    // Merged: Historical data (older) + Recent BOM data (last 3 days)
    console.log('[DEBUG] Processing merged data');

    // First, process historical data
    const weatherData = data.weatherData;
    const times = weatherData?.hourly?.time || [];
    const temps = weatherData?.hourly?.temperature_2m || [];
    const humidity = weatherData?.hourly?.relative_humidity_2m || [];
    const dewpoints = weatherData?.hourly?.dew_point_2m || [];
    const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
    const radiation = weatherData?.hourly?.shortwave_radiation_instant || [];

    console.log('[DEBUG] Historical data count:', times.length);

    times.forEach((time: string, idx: number) => {
      const ta = temps[idx];
      const rh = humidity[idx];
      const dewpt = dewpoints[idx];
      const ws_ms = windSpeeds[idx];
      const sr = radiation[idx] || 0;

      const e = calculateVaporPressure(ta, rh);
      const wbgt = calculateWBGT(ta, rh, sr);
      const ewbgt = calculateEWBGT(ta, e);
      const at = calculateAT(ta, rh, ws_ms * 3.6, sr);

      // Ensure ISO format timestamp for consistent parsing
      const isoTime = time.includes('T') ? time : new Date(time).toISOString();

      results.push({
        timestamp: isoTime,
        temperature: parseFloat(ta.toFixed(1)),
        humidity: Math.round(rh),
        dew_point: parseFloat(dewpt.toFixed(1)),
        wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
        solar_radiation: Math.round(sr),
        wbgt: parseFloat(wbgt.toFixed(1)),
        ewbgt: parseFloat(ewbgt.toFixed(1)),
        apparent_temp: parseFloat(at.toFixed(1))
      });
    });

    // Then, process recent BOM data with solar radiation
    const bom = data.bomData?.observations?.data || [];
    const srTimes = data.srData?.hourly?.time || [];
    const srValues = data.srData?.hourly?.shortwave_radiation || [];

    console.log('[DEBUG MERGED] srData structure:', Object.keys(data.srData || {}));
    console.log('[DEBUG MERGED] srTimes.length:', srTimes.length);
    console.log('[DEBUG MERGED] srTimes (first 3):', srTimes.slice(0, 3));
    console.log('[DEBUG MERGED] srValues (first 3):', srValues.slice(0, 3));
    console.log('[DEBUG MERGED] BOM observations count:', bom.length);
    console.log('[DEBUG MERGED] BOM timestamps (first 3):', bom.slice(0, 3).map((o: any) => o.local_date_time));

    const srMap = new Map<string, number>();
    srTimes.forEach((time: string, idx: number) => {
      srMap.set(time, srValues[idx] || 0);
    });

    console.log('[DEBUG MERGED] srMap size:', srMap.size);

    bom.forEach((obs: any, idx: number) => {
      const ta = obs.air_temp;
      const rh = obs.rel_hum;
      const dewpt = obs.dewpt;
      const ws_kmh = obs.wind_spd_kmh || 0;
      const ws_ms = ws_kmh / 3.6;
      const sr = lookupSolarRadiation(obs.local_date_time, srMap, idx === 0);

      const e = calculateVaporPressure(ta, rh);
      const wbgt = calculateWBGT(ta, rh, sr);
      const ewbgt = calculateEWBGT(ta, e);
      const at = calculateAT(ta, rh, ws_kmh, sr);

      results.push({
        timestamp: normalizeBOMTimestamp(obs.local_date_time),
        temperature: parseFloat(ta.toFixed(1)),
        humidity: Math.round(rh),
        dew_point: parseFloat(dewpt.toFixed(1)),
        wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
        solar_radiation: Math.round(sr),
        wbgt: parseFloat(wbgt.toFixed(1)),
        ewbgt: parseFloat(ewbgt.toFixed(1)),
        apparent_temp: parseFloat(at.toFixed(1))
      });
    });

    console.log('[DEBUG] Total merged results:', results.length);
  }

  // Apply time range filter if specified
  if (startTime && endTime) {
    const maxInRange = getMaxInRange(results, startTime, endTime);
    return maxInRange ? [maxInRange] : [];
  }

  return results;
}

function parseForecastData(srData: any, aqData: any, bomData: any) {
  const results = [];
  const forecasts = bomData?.data || [];
  const srTimes = srData?.hourly?.time || [];
  const srClouds = srData?.hourly?.cloud_cover || [];
  const srValues = srData?.hourly?.shortwave_radiation || [];
  const srUV = srData?.hourly?.uv_index || [];
  const aqTimes = aqData?.hourly?.time || [];
  const aqAQI = aqData?.hourly?.us_aqi || [];
  const aqPM25 = aqData?.hourly?.pm2_5 || [];
  const aqPM10 = aqData?.hourly?.pm10 || [];

  // Build maps: key = "2025-10-19T14"
  const srMap: Record<string, number> = {};
  const cloudMap: Record<string, number> = {};
  const uvMap: Record<string, number> = {};
  
  srTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    srMap[hourKey] = srValues[idx];
    cloudMap[hourKey] = srClouds[idx];
    uvMap[hourKey] = srUV[idx];
  });

  console.log('[PARSE] srMap built with', Object.keys(srMap).length, 'keys');
  console.log('[PARSE] srMap keys (first 3):', Object.keys(srMap).slice(0, 3));
  console.log('[PARSE] srMap values (first 3):', Object.keys(srMap).slice(0, 3).map(k => srMap[k]));

  const aqiMap: Record<string, number> = {};
  const pm25Map: Record<string, number> = {};
  const pm10Map: Record<string, number> = {};
  
  aqTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    aqiMap[hourKey] = aqAQI[idx];
    pm25Map[hourKey] = aqPM25[idx];
    pm10Map[hourKey] = aqPM10[idx];
  });

  console.log('[PARSE] Processing', forecasts.length, 'forecasts');

  // BOM forecast times are UTC like "2025-10-19T05:00:00Z"
  forecasts.forEach((forecast: any, idx: number) => {
    const timestamp = forecast.time;  // "2025-10-19T05:00:00Z"
    const ta = forecast.temp;
    const rh = forecast.relative_humidity;
    const dewpt = forecast.dewpoint;
    const ws_kmh = forecast.wind?.speed_kilometre || 0;
    
    // Extract hour key: "2025-10-19T05"
    const hourKey = timestamp.substring(0, 13);
    
    // Direct lookup from maps
    const sr = srMap[hourKey] || 0;
    const cloud = cloudMap[hourKey] || 0;
    const uv = uvMap[hourKey] || 0;
    const aqi = aqiMap[hourKey] || 0;
    const pm25 = pm25Map[hourKey] || 0;
    const pm10 = pm10Map[hourKey] || 0;

    if (idx < 3) {
      console.log(`[PARSE] Forecast ${idx}: time=${timestamp}, hourKey=${hourKey}, sr=${sr}, found=${hourKey in srMap}`);
    }

    const e = calculateVaporPressure(ta, rh);
    const wbgt = calculateWBGT(ta, rh, sr);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, ws_kmh, sr);

    // Convert UTC to Australia/Sydney timezone for display
    const localTimestamp = new Date(timestamp).toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const result: any = {
      utcTimestamp: timestamp,
      localTimestamp,
      temperature: ta,
      humidity: rh,
      dew_point: dewpt,
      wind_speed_kmh: ws_kmh,
      solar_radiation: sr,
      cloud_cover: cloud,
      uv_index: parseFloat(uv.toFixed(1)),
      wbgt: parseFloat(wbgt.toFixed(1)),
      ewbgt: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat(at.toFixed(1)),
      rain_chance: forecast.rain?.chance || 0,
    };

    if (pm25 > 25 || pm10 > 50 || aqi > 75) {
      result.air_quality = {
        aqi: Math.round(aqi),
        pm2_5: parseFloat(pm25.toFixed(1)),
        pm10: parseFloat(pm10.toFixed(1))
      };
    }

    results.push(result);
  });

  return results;
}

// --- MCP Server wrapper ---
export class WBGTServerMCP extends McpAgent {
  server = new McpServer({
    name: "WBGT Sydney Runner",
    version: "1.0.0",
  });

  async init() {
    // Tool 1: Get current WBGT
    this.server.tool(
      "get_current_wbgt",
      {},
      async () => {
        const data = await fetchObservations();
        const observations = parseObservations(data);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              data: observations[0] || null,
              note: "Current WBGT conditions in Sydney"
            }, null, 2)
          }]
        };
      }
    );

    // Tool 2: Get WBGT forecast
    this.server.tool(
      "get_wbgt_forecast",
      {},
      async () => {
        const { srData, aqData, bomData } = await fetchForecast();
        const forecast = parseForecastData(srData, aqData, bomData);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              data: forecast,
              count: forecast.length,
              note: "WBGT forecast (72 hours)"
            }, null, 2)
          }]
        };
      }
    );

    // Tool 3: Get WBGT observations (unified recent/historical)
    this.server.tool(
      "get_wbgt_observations",
      {
        start_date: {
          type: "string",
          description: "Optional start date (YYYY-MM-DD) or datetime (ISO format). Omit for recent 24h",
        },
        end_date: {
          type: "string",
          description: "Optional end date (YYYY-MM-DD) or datetime (ISO format). Omit for recent 24h",
        },
        start_time: {
          type: "string",
          description: "Optional start time for specific activity (ISO format)",
        },
        end_time: {
          type: "string",
          description: "Optional end time for specific activity (ISO format). Returns max values in range.",
        },
      },
      async (params: any) => {
        const { start_date, end_date, start_time, end_time } = params;
        const data = await fetchObservations(start_date, end_date);
        const observations = parseObservations(data, start_time, end_time);
        
        const note = start_time 
          ? `Max WBGT conditions during activity from ${start_time} to ${end_time}`
          : start_date 
          ? `WBGT observations from ${start_date} to ${end_date || 'present'}`
          : "Recent 24-hour WBGT observations";
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              data: observations,
              count: observations.length,
              note
            }, null, 2)
          }]
        };
      }
    );
  }
}

// --- HTTP Endpoints ---
async function handleHTTPRequest(request: Request, _env: any, _ctx: any): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // GET /api/current - Current WBGT conditions
    if (pathname === '/api/current' && request.method === 'GET') {
      const data = await fetchObservations();
      const observations = parseObservations(data);
      return new Response(
        JSON.stringify({
          success: true,
          data: observations[0] || null,
          timestamp: new Date().toISOString(),
          note: 'Current WBGT conditions in Sydney'
        }, null, 2),
        { headers: corsHeaders, status: 200 }
      );
    }

    // GET /api/forecast - 72-hour WBGT forecast
    if (pathname === '/api/forecast' && request.method === 'GET') {
      const { srData, aqData, bomData } = await fetchForecast();
      const forecast = parseForecastData(srData, aqData, bomData);
      return new Response(
        JSON.stringify({
          success: true,
          data: forecast,
          count: forecast.length,
          timestamp: new Date().toISOString(),
          note: 'WBGT forecast (72 hours)'
        }, null, 2),
        { headers: corsHeaders, status: 200 }
      );
    }

    // GET /api/observations - Historical and recent observations
    // Query params: start_date, end_date, start_time, end_time (all optional)
    if (pathname === '/api/observations' && request.method === 'GET') {
      const searchParams = url.searchParams;
      const start_date = searchParams.get('start_date') || undefined;
      const end_date = searchParams.get('end_date') || undefined;
      const start_time = searchParams.get('start_time') || undefined;
      const end_time = searchParams.get('end_time') || undefined;

      const data = await fetchObservations(start_date || undefined, end_date || undefined);
      const observations = parseObservations(data, start_time || undefined, end_time || undefined);

      const note = start_time 
        ? `Max WBGT conditions during activity from ${start_time} to ${end_time}`
        : start_date 
        ? `WBGT observations from ${start_date} to ${end_date || 'present'}`
        : "Recent 24-hour WBGT observations";

      return new Response(
        JSON.stringify({
          success: true,
          data: observations,
          count: observations.length,
          timestamp: new Date().toISOString(),
          note
        }, null, 2),
        { headers: corsHeaders, status: 200 }
      );
    }

    // GET /health - Health check endpoint
    if (pathname === '/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'WBGT Sydney Runner API',
          timestamp: new Date().toISOString()
        }, null, 2),
        { headers: corsHeaders, status: 200 }
      );
    }

    // GET /api - List available endpoints
    if ((pathname === '/api' || pathname === '/') && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          service: 'WBGT Sydney Runner API',
          endpoints: {
            'GET /api/current': 'Get current WBGT conditions',
            'GET /api/forecast': 'Get 72-hour WBGT forecast',
            'GET /api/observations': 'Get historical observations (no params = last 24h)',
            'GET /api/observations?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD': 'Historical date range',
            'GET /api/observations?start_time=ISO&end_time=ISO': 'Max WBGT during activity window',
            'GET /health': 'Health check',
            'POST /sse (or /sse/message)': 'MCP Server (SSE endpoint)',
            'POST /mcp': 'MCP Server (standard endpoint)'
          },
          examples: {
            current: '/api/current',
            forecast: '/api/forecast',
            observations_24h: '/api/observations',
            historical: '/api/observations?start_date=2025-10-15&end_date=2025-10-18',
            activity_window: '/api/observations?start_time=2025-10-18T06:00:00Z&end_time=2025-10-18T07:00:00Z'
          }
        }, null, 2),
        { headers: corsHeaders, status: 200 }
      );
    }

    // Not found
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint not found',
        path: pathname,
        availableEndpoints: 'GET /api'
      }, null, 2),
      { headers: corsHeaders, status: 404 }
    );

  } catch (error: any) {
    console.error('Error handling HTTP request:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }, null, 2),
      { headers: corsHeaders, status: 500 }
    );
  }
}

// --- HTTP Handler ---
const sseAgent = WBGTServerMCP.serveSSE("/sse");
const standardAgent = WBGTServerMCP.serve("/mcp");

// Initialize tools when servers are created
(async () => {
  // The agents handle initialization internally
})();

export default {
  fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // Route to MCP server for MCP endpoints
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return sseAgent.fetch(request, env, ctx);
    }
    if (url.pathname === "/mcp") {
      return standardAgent.fetch(request, env, ctx);
    }

    // Route to HTTP handler for all other paths
    return handleHTTPRequest(request, env, ctx);
  },
};
export { WBGTServerMCP as MyMCP };
