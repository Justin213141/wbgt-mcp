import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import calculation functions from modular architecture
import {
  calculateVaporPressure,
  calculateBuckSaturationVaporPressure,
  calculateVaporPressureDerivative,
  calculateSolarZenithAngle,
  calculateSolarZenithAngleJST,
  calculateSolarZenithAngleByTimezone,
  calculateAirProperties,
  calculateWindAt2m,
  calculateRadiationComponents,
  calculateHeatTransferCoefficients,
  calculateKongBlackGlobe,
  calculateKongNaturalWetBulb,
  calculateKongWBGT,
  calculateESI,
  calculateKongWBGTPipeline,
  calculateKongWBGTPipelineJST,
  calculateKongWBGTPipelineByTimezone,
  calculatePsychrometricWetBulb,
  calculateWBGT,
  calculateEWBGT,
  calculateAT,
} from './calculations';

// Import station finder utilities
import { determineDataSource, determineWeatherZoneDataSource, findNearestWeatherZoneStationOrDefault } from './utils/station-finder';
import { DEFAULT_BOM_STATION } from './data/bom-stations';

// Import Visual Crossing fetcher for 3-90 day observational data
import { VisualCrossingFetcher } from './utils/visual-crossing-fetcher';
import type { VisualCrossingObservation, HourlyWeatherArrays } from './utils/visual-crossing-fetcher';

// --- Type Definitions ---
interface Env {
  BROWSER?: Fetcher;
  VISUAL_CROSSING_API_KEY?: string;
  MCP_OBJECT?: DurableObjectNamespace;
}

interface SRData {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    dew_point_2m?: number[];
    surface_pressure?: number[];
    wind_speed_10m?: number[];
    shortwave_radiation?: number[];
    shortwave_radiation_instant?: number[];
    direct_radiation_instant?: number[];
    diffuse_radiation_instant?: number[];
    apparent_temperature?: number[];
    cloud_cover?: number[];
    uv_index?: number[];
  };
}

interface BOMData {
  observations?: {
    data?: any[];
  };
  data?: any[];
}

interface WeatherData {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    dew_point_2m?: number[];
    surface_pressure?: number[];
    wind_speed_10m?: number[];
    shortwave_radiation?: number[];
    shortwave_radiation_instant?: number[];
    direct_radiation?: number[];
    direct_radiation_instant?: number[];
    diffuse_radiation?: number[];
    diffuse_radiation_instant?: number[];
    apparent_temperature?: number[];
    cloud_cover?: number[];
  };
}

interface AQData {
  hourly?: {
    time?: string[];
    us_aqi?: number[];
    pm2_5?: number[];
    pm10?: number[];
  };
}

interface ObservationsResponse {
  type: 'recent' | 'historical' | 'merged';
  weatherData?: WeatherData;
  srData?: SRData;
  bomData?: BOMData;
}

// Sydney coordinates
const SYDNEY_LAT = -33.8018;
const SYDNEY_LON = 151.1254;
const BOM_LOCATION_ID = "r3grwp";

// Import unified fetcher to eliminate duplicate Kong WBGT functions
import { HistoricalFetcher } from './utils/historical-fetcher';
import { fetchWeatherZoneObservations } from './utils/weatherzone-fetcher';

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

// --- Constants ---
const STEFAN_BOLTZMANN = 5.67e-8;  // W/(m²·K⁴)
const GAS_CONSTANT_AIR = 287.05;   // J/(kg·K)
const MOLECULAR_WEIGHT_WATER = 0.018015;  // kg/mol
const MOLECULAR_WEIGHT_AIR = 0.02897;  // kg/mol (dry air)
const LATENT_HEAT = 2453000;  // J/kg

// Globe constants
const GLOBE_DIAMETER = 0.0508;  // m
const GLOBE_EMISSIVITY = 0.95;
const GLOBE_ALBEDO = 0.05;

// Wick constants
const WICK_DIAMETER = 0.007;  // m
const WICK_LENGTH = 0.0254;  // m
const WICK_EMISSIVITY = 0.95;
const WICK_ALBEDO = 0.4;

// Surface constants
const SURFACE_ALBEDO = 0.45;


// --- Helper functions for data parsing ---
// Note: All calculation functions (vapor pressure, Kong WBGT, etc.) are imported from ./calculations
// This eliminates ~800 lines of duplicate code that was previously maintained in this file

function parseBOMTime(bomTime: string): string {
  return `${bomTime.slice(0,4)}-${bomTime.slice(4,6)}-${bomTime.slice(6,8)}T${bomTime.slice(8,10)}:${bomTime.slice(10,12)}`;
}

// --- Kong WBGT Data Fetching ---
// Unified wrapper function for historical WBGT data (works in local time)
async function fetchKongWBGT(
  startDate: string,
  endDate: string,
  latitude: number = SYDNEY_LAT,
  longitude: number = SYDNEY_LON,
  timezone: string = 'auto'
): Promise<any[]> {
  const fetcher = new HistoricalFetcher();
  return fetcher.fetchKongWBGTByTimezone(startDate, endDate, latitude, longitude, timezone);
}

// --- Fetch functions ---
async function fetchObservations(
  startDate?: string,
  endDate?: string,
  latitude?: number,
  longitude?: number,
  bomUrl?: string | null
): Promise<ObservationsResponse> {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Use provided coordinates or default to Sydney
  const lat = latitude ?? SYDNEY_LAT;
  const lon = longitude ?? SYDNEY_LON;

  // Observations endpoint only returns past 72 hours - always fetch recent with Kong parameters
  // Use forecast_days=1 to include current day (needed to match BOM observations)
  const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,cloud_cover,shortwave_radiation,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,uv_index&timezone=Australia%2FSydney&past_days=3&forecast_days=1`;

  // Use provided BOM URL or default station
  const defaultBomUrl = DEFAULT_BOM_STATION.jsonUrl;
  const finalBomUrl = bomUrl !== null ? (bomUrl ?? defaultBomUrl) : null;

  // Fetch OpenMeteo data and optionally BOM data
  const fetchPromises: Promise<Response>[] = [
    fetch(srUrl, {
      cf: {
        cacheTtl: 300, // 5 minutes cache
        cacheEverything: true
      }
    })
  ];

  // Only fetch BOM data if we have a URL (station within range)
  if (finalBomUrl) {
    fetchPromises.push(fetch(finalBomUrl));
  }

  const responses = await Promise.all(fetchPromises);
  const srResponse = responses[0];
  const bomResponse = responses[1] ?? null;

  if (srResponse.status !== 200) {
    console.error(`[FETCH] Open-Meteo fetch failed with status ${srResponse.status}`);
  }
  if (bomResponse && bomResponse.status !== 200) {
    console.error(`[FETCH] BOM fetch failed with status ${bomResponse.status} for URL: ${finalBomUrl}`);
  }
  if (!bomResponse) {
    console.warn(`[FETCH] No BOM data requested (bomUrl was null)`);
  }

  const bomData = bomResponse && bomResponse.status === 200 ? await bomResponse.json() as BOMData : undefined;

  if (bomData?.observations?.data) {
    console.log(`[FETCH] ✓ Successfully fetched ${bomData.observations.data.length} BOM observations from ${finalBomUrl}`);
  } else if (bomResponse) {
    console.warn(`[FETCH] ✗ BOM response received but no observation data found`);
  }

  return {
    type: 'recent',
    srData: srResponse.status === 200 ? await srResponse.json() as SRData : undefined,
    bomData
  };
}

async function fetchForecast(): Promise<{ srData: SRData | null; aqData: AQData | null; bomData: BOMData | null; responseStatuses: { sr: number; aq: number; bom: number } }> {
  return await (async () => {
      const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,surface_pressure,wind_speed_10m,cloud_cover,shortwave_radiation,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,uv_index&timezone=Australia%2FSydney&forecast_days=3`;
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=us_aqi,pm10,pm2_5&timezone=Australia%2FSydney&forecast_days=3`;
      const bomUrl = `https://api.weather.bom.gov.au/v1/locations/${BOM_LOCATION_ID}/forecasts/hourly`;

      const [srResponse, aqResponse, bomResponse] = await Promise.all([
        fetch(srUrl, {
          cf: {
            cacheTtl: 300, // 5 minutes cache
            cacheEverything: true
          }
        }),
        fetch(aqUrl, {
          cf: {
            cacheTtl: 300,
            cacheEverything: true
          }
        }),
        fetch(bomUrl)
      ]);

      let srData: SRData | null = null;
      let aqData: AQData | null = null;
      let bomData: BOMData | null = null;

      if (srResponse.status === 200) {
        srData = await srResponse.json() as SRData;
      } else {
        const errorText = await srResponse.text();
      }

      if (aqResponse.status === 200) {
        aqData = await aqResponse.json() as AQData;
      }

      if (bomResponse.status === 200) {
        bomData = await bomResponse.json() as BOMData;
      }


      if (srResponse.status !== 200) {
      }

      return {
        srData,
        aqData,
        bomData,
        responseStatuses: {
          sr: srResponse.status,
          aq: aqResponse.status,
          bom: bomResponse.status
        }
      };
    })();
}

// --- Helper functions for max values ---
function getMaxInRange(data: any[], startTime: string, endTime: string) {
  if (data.length > 0) {
  }

  // Convert ISO timestamps (Sydney local time) to DD/MM/YYYY, HH:MM:SS format for consistent comparison
  const convertISOToLocalFormat = (isoStr: string): string => {
    const [datePart, timePart] = isoStr.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}, ${timePart}`;
  };

  const startFormatted = convertISOToLocalFormat(startTime);
  const endFormatted = convertISOToLocalFormat(endTime);


  const inRange = data.filter((d: any) => {
    // Both timestamps are now in same format, compare as strings
    // This works because YYYY-MM-DD format is lexicographically sortable
    const matches = d.timestamp >= startFormatted && d.timestamp <= endFormatted;
    if (matches || data.indexOf(d) < 3) {
    }
    return matches;
  });

  if (inRange.length === 0) {
    return null;
  }

  // Get unique sources from the range (most records should have same source)
  const sources = [...new Set(inRange.map((d: any) => d.source).filter(Boolean))];
  const sourceSummary = sources.length > 0 ? sources.join(' + ') : 'unknown';

  return {
    timestamp: `${startTime} to ${endTime}`,
    temperature: Math.max(...inRange.map((d: any) => d.temperature)),
    humidity: Math.max(...inRange.map((d: any) => d.humidity)),
    dew_point: Math.max(...inRange.map((d: any) => d.dew_point)),
    wind_speed_ms: Math.max(...inRange.map((d: any) => d.wind_speed_ms)),
    solar_radiation: Math.max(...inRange.map((d: any) => d.solar_radiation)),
    cloud_cover: Math.max(...inRange.map((d: any) => d.cloud_cover)),
    uv_index: Math.max(...inRange.map((d: any) => d.uv_index)),
    wbgt: Math.max(...inRange.map((d: any) => d.wbgt)),
    esi: Math.max(...inRange.map((d: any) => d.esi)),
    apparent_temp: Math.max(...inRange.map((d: any) => d.apparent_temp)),
    source: sourceSummary
  };
}

/**
 * Interpolation fallback: When no data exists in the requested time range,
 * find the closest observations before and after the range, and return the one
 * with higher WBGT (conservative approach for athlete safety).
 */
function getInterpolatedMaxInRange(data: any[], startTime: string, endTime: string) {

  if (data.length === 0) {
    return null;
  }

  // Convert ISO timestamps to comparable format
  const convertISOToLocalFormat = (isoStr: string): string => {
    const [datePart, timePart] = isoStr.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}, ${timePart}`;
  };

  const startFormatted = convertISOToLocalFormat(startTime);
  const endFormatted = convertISOToLocalFormat(endTime);

  // Find closest observation before start_time
  let closestBefore: any = null;
  let closestAfter: any = null;

  for (const obs of data) {
    if (obs.timestamp < startFormatted) {
      // This observation is before the range
      if (!closestBefore || obs.timestamp > closestBefore.timestamp) {
        closestBefore = obs;
      }
    } else if (obs.timestamp > endFormatted) {
      // This observation is after the range
      if (!closestAfter || obs.timestamp < closestAfter.timestamp) {
        closestAfter = obs;
      }
    }
  }


  // If we have both, pick the one with higher WBGT
  if (closestBefore && closestAfter) {
    const result = closestBefore.wbgt >= closestAfter.wbgt ? closestBefore : closestAfter;
    return {
      ...result,
      timestamp: `${result.timestamp} (interpolated from range ${startTime} to ${endTime})`,
      interpolated: true
    };
  }

  // If we only have one, use that
  if (closestBefore) {
    return {
      ...closestBefore,
      timestamp: `${closestBefore.timestamp} (interpolated from range ${startTime} to ${endTime})`,
      interpolated: true
    };
  }

  if (closestAfter) {
    return {
      ...closestAfter,
      timestamp: `${closestAfter.timestamp} (interpolated from range ${startTime} to ${endTime})`,
      interpolated: true
    };
  }

  return null;
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
    const solarRadiation = radiation[beforeIdx] || 0;
    const e = calculateVaporPressure(ta, rh);
    const wbgt = calculateWBGT(ta, rh, solarRadiation);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, ws_ms * 3.6, solarRadiation);

    return {
      timestamp: targetTime,
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(dewpt.toFixed(1)),
      wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
      solar_radiation: Math.round(solarRadiation),
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

        // Return ISO format (Sydney local time, no Z)
        const monthStr = String(month).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const hourStr = String(hour).padStart(2, '0');
        const minStr = String(minute).padStart(2, '0');
        return `${year}-${monthStr}-${dayStr}T${hourStr}:${minStr}:00`;
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
  // Import the helper function
  const { lookupSolarRadiationLegacy } = require('./utils/solar-radiation-helpers');

  // Use the refactored helper function
  return lookupSolarRadiationLegacy(bomTimestamp, srMap, debugFirst);
}

// Helper function to parse recent BOM observations with Open-Meteo data
function parseRecentObservations(data: ObservationsResponse): any[] {
  const results: any[] = [];
  const bom = data.bomData?.observations?.data || [];

  // Build maps from Open-Meteo data (hourly intervals)
  const srTimes = data.srData?.hourly?.time || [];
  const omTemps = data.srData?.hourly?.temperature_2m || [];
  const omHumidity = data.srData?.hourly?.relative_humidity_2m || [];
  const omDewpoints = data.srData?.hourly?.dew_point_2m || [];
  const omPressures = data.srData?.hourly?.surface_pressure || [];
  const omWindSpeeds = data.srData?.hourly?.wind_speed_10m || [];
  const omSRInstant = data.srData?.hourly?.shortwave_radiation_instant || [];
  const omSRDirect = data.srData?.hourly?.direct_radiation_instant || [];
  const omSRDiffuse = data.srData?.hourly?.diffuse_radiation_instant || [];
  const omApparentTemps = data.srData?.hourly?.apparent_temperature || [];
  const srClouds = data.srData?.hourly?.cloud_cover || [];
  const srUV = data.srData?.hourly?.uv_index || [];

  // Calculate psychrometric wet bulb from temperature, humidity, and pressure
  const omWetBulbs = omTemps.map((temp, i) =>
    calculatePsychrometricWetBulb(temp, omHumidity[i], omPressures[i])
  );

  // Build maps: key = "2025-10-19T14" for Open-Meteo data
  const omMap: Record<string, { idx: number; omData: any }> = {};
  const cloudMap: Record<string, number> = {};
  const uvMap: Record<string, number> = {};

  srTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    omMap[hourKey] = {
      idx,
      omData: {
        temp: omTemps[idx],
        humidity: omHumidity[idx],
        dewpoint: omDewpoints[idx],
        wet_bulb: omWetBulbs[idx],
        pressure: omPressures[idx],
        wind_speed: omWindSpeeds[idx],
        sr_instant: omSRInstant[idx],
        sr_direct: omSRDirect[idx],
        sr_diffuse: omSRDiffuse[idx],
        apparent_temp: omApparentTemps[idx]
      }
    };
    cloudMap[hourKey] = srClouds[idx];
    uvMap[hourKey] = srUV[idx];
  });

  bom.forEach((obs: any) => {
    const timestamp = normalizeBOMTimestamp(obs.local_date_time);
    // Convert to Sydney timezone for key matching with Open-Meteo data
    const sydneyTime = new Date(timestamp).toLocaleString('en-CA', {
      timeZone: 'Australia/Sydney',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const [datePart, timePart] = sydneyTime.split(', ');
    const hourPart = timePart.substring(0, 2);
    const hourKey = `${datePart}T${hourPart}`;

    const omData = omMap[hourKey]?.omData || {};
    const ta = obs.air_temp;
    const rh = obs.rel_hum;
    const ws_kmh = obs.wind_spd_kmh || 0;
    const ws_ms = ws_kmh / 3.6;

    const e = calculateVaporPressure(ta, rh);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, ws_kmh, omData.sr_instant || 0);

    let wbgt = calculateWBGT(ta, rh, omData.sr_instant || 0);
    if (omData.wet_bulb !== undefined && omData.pressure !== undefined) {
      try {
        const kongCalc = calculateKongWBGTPipeline(
          ta, omData.wet_bulb, rh, omData.pressure, omData.wind_speed || ws_ms * 3.6,
          omData.sr_instant || 0, omData.sr_direct || 0, omData.sr_diffuse || 0,
          SYDNEY_LAT, SYDNEY_LON, timestamp
        );
        wbgt = kongCalc.kong_wbgt;
      } catch (error) {
        console.error(`[DEBUG] Error calculating Kong WBGT for ${timestamp}:`, error);
      }
    }

    results.push({
      timestamp,
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(obs.dewpt.toFixed(1)),
      wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
      solar_radiation: parseFloat((omData.sr_instant || 0).toFixed(1)),
      cloud_cover: parseFloat((cloudMap[hourKey] || 0).toFixed(1)),
      uv_index: parseFloat((uvMap[hourKey] || 0).toFixed(1)),
      wbgt: parseFloat(wbgt.toFixed(1)),
      esi: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat(at.toFixed(1))
    });
  });

  return results;
}

// Helper function to parse historical observations
function parseHistoricalObservations(weatherData: WeatherData): any[] {
  const results: any[] = [];
  const times = weatherData?.hourly?.time || [];
  const temps = weatherData?.hourly?.temperature_2m || [];
  const humidity = weatherData?.hourly?.relative_humidity_2m || [];
  const dewpoints = weatherData?.hourly?.dew_point_2m || [];
  const pressures = weatherData?.hourly?.surface_pressure || [];
  const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
  const srInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
  const srDirect = weatherData?.hourly?.direct_radiation_instant || [];
  const srDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];
  const apparentTemps = weatherData?.hourly?.apparent_temperature || [];
  const cloudCovers = weatherData?.hourly?.cloud_cover || [];

  // Calculate psychrometric wet bulb from temperature, humidity, and pressure
  const wetBulbs = temps.map((temp, i) =>
    calculatePsychrometricWetBulb(temp, humidity[i], pressures[i])
  );

  times.forEach((time: string, idx: number) => {
    const ta = temps[idx];
    const rh = humidity[idx];
    const solarRadiation = srInstant[idx] || 0;
    const isoTime = time.includes('T') ? time : new Date(time).toISOString();

    const e = calculateVaporPressure(ta, rh);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, windSpeeds[idx] * 3.6, solarRadiation);

    let wbgt = calculateWBGT(ta, rh, solarRadiation);
    try {
      const kongCalc = calculateKongWBGTPipeline(
        ta, wetBulbs[idx], rh, pressures[idx], windSpeeds[idx],
        solarRadiation, srDirect[idx] || 0, srDiffuse[idx] || 0,
        SYDNEY_LAT, SYDNEY_LON, isoTime
      );
      wbgt = kongCalc.kong_wbgt;
    } catch (error) {
      console.error(`[DEBUG] Error calculating Kong WBGT for ${isoTime}:`, error);
    }

    results.push({
      timestamp: isoTime,
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(dewpoints[idx].toFixed(1)),
      wind_speed_ms: parseFloat(windSpeeds[idx].toFixed(1)),
      solar_radiation: parseFloat(solarRadiation.toFixed(1)),
      cloud_cover: parseFloat((cloudCovers[idx] || 0).toFixed(1)),
      wbgt: parseFloat(wbgt.toFixed(1)),
      esi: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat((apparentTemps[idx] || 0).toFixed(1))
    });
  });

  return results;
}

// Helper function to parse OpenMeteo historical observations with custom lat/lon for Kong calculations
async function parseHistoricalObservationsWithSolar(
  weatherData: WeatherData,
  latitude: number,
  longitude: number
): Promise<any[]> {
  const results: any[] = [];
  const times = weatherData?.hourly?.time || [];
  const temps = weatherData?.hourly?.temperature_2m || [];
  const humidity = weatherData?.hourly?.relative_humidity_2m || [];
  const dewpoints = weatherData?.hourly?.dew_point_2m || [];
  const pressures = weatherData?.hourly?.surface_pressure || [];
  const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
  const srInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
  const srDirect = weatherData?.hourly?.direct_radiation_instant || [];
  const srDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];
  const apparentTemps = weatherData?.hourly?.apparent_temperature || [];
  const cloudCovers = weatherData?.hourly?.cloud_cover || [];
  const uvIndexes = weatherData?.hourly?.uv_index || [];

  // Calculate psychrometric wet bulb from temperature, humidity, and pressure
  const wetBulbs = temps.map((temp, i) =>
    calculatePsychrometricWetBulb(temp, humidity[i], pressures[i])
  );

  times.forEach((time: string, idx: number) => {
    const ta = temps[idx];
    const rh = humidity[idx];
    const solarRadiation = srInstant[idx] || 0;
    const isoTime = time.includes('T') ? time : new Date(time).toISOString();

    const e = calculateVaporPressure(ta, rh);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, windSpeeds[idx] * 3.6, solarRadiation);

    let wbgt = calculateWBGT(ta, rh, solarRadiation);
    try {
      const kongCalc = calculateKongWBGTPipelineByTimezone(
        ta, wetBulbs[idx], rh, pressures[idx], windSpeeds[idx],
        solarRadiation, srDirect[idx] || 0, srDiffuse[idx] || 0,
        latitude, longitude, isoTime,
        10,   // Base UTC offset
        true  // has DST
      );
      wbgt = kongCalc.kong_wbgt;
    } catch (error) {
      console.error(`[DEBUG] Tier 2 - Error calculating Kong WBGT for ${isoTime}:`, error);
    }

    results.push({
      timestamp: isoTime,
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(dewpoints[idx].toFixed(1)),
      wind_speed_ms: parseFloat(windSpeeds[idx].toFixed(1)),
      solar_radiation: parseFloat(solarRadiation.toFixed(1)),
      cloud_cover: parseFloat((cloudCovers[idx] || 0).toFixed(1)),
      uv_index: parseFloat((uvIndexes[idx] || 0).toFixed(1)),
      wbgt: parseFloat(wbgt.toFixed(1)),
      esi: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat((apparentTemps[idx] || 0).toFixed(1)),
      data_source: 'OpenMeteo + OpenMeteo Solar',
      tier: 'tier_2'
    });
  });

  return results;
}

// Helper function to parse merged observations (historical + recent)
function parseMergedObservations(data: ObservationsResponse): any[] {
  const results: any[] = [];

  // Parse historical data
  if (data.weatherData) {
    results.push(...parseHistoricalObservations(data.weatherData));
  }

  // Parse recent BOM data
  const bom = data.bomData?.observations?.data || [];
  const srTimes = data.srData?.hourly?.time || [];
  const srValues = data.srData?.hourly?.shortwave_radiation || [];
  const srMap = new Map<string, number>();

  srTimes.forEach((time: string, idx: number) => {
    srMap.set(time, srValues[idx] || 0);
  });

  bom.forEach((obs: any) => {
    const ta = obs.air_temp;
    const rh = obs.rel_hum;
    const ws_kmh = obs.wind_spd_kmh || 0;
    const ws_ms = ws_kmh / 3.6;
    const solarRadiation = lookupSolarRadiation(obs.local_date_time, srMap);

    const e = calculateVaporPressure(ta, rh);
    const wbgt = calculateWBGT(ta, rh, solarRadiation);
    const ewbgt = calculateEWBGT(ta, e);
    const at = calculateAT(ta, rh, ws_kmh, solarRadiation);

    results.push({
      timestamp: normalizeBOMTimestamp(obs.local_date_time),
      temperature: parseFloat(ta.toFixed(1)),
      humidity: Math.round(rh),
      dew_point: parseFloat(obs.dewpt.toFixed(1)),
      wind_speed_ms: parseFloat(ws_ms.toFixed(1)),
      solar_radiation: Math.round(solarRadiation),
      wbgt: parseFloat(wbgt.toFixed(1)),
      ewbgt: parseFloat(ewbgt.toFixed(1)),
      apparent_temp: parseFloat(at.toFixed(1))
    });
  });

  return results;
}

function parseObservations(data: ObservationsResponse, startTime?: string, endTime?: string): any[] {
  let results: any[] = [];

  switch (data.type) {
    case 'recent':
      results = parseRecentObservations(data);
      break;
    case 'historical':
      results = data.weatherData ? parseHistoricalObservations(data.weatherData) : [];
      break;
    case 'merged':
      results = parseMergedObservations(data);
      break;
  }

  // Apply time range filter if specified
  if (startTime && endTime) {
    const maxInRange = getMaxInRange(results, startTime, endTime);
    return maxInRange ? [maxInRange] : [];
  }

  return results;
}

// Helper function to build maps from Open-Meteo solar radiation data
function buildOpenMeteoMaps(srData: SRData | null): { omMap: Record<string, any>; cloudMap: Record<string, number>; uvMap: Record<string, number> } {
  const omMap: Record<string, { idx: number; omData: any }> = {};
  const cloudMap: Record<string, number> = {};
  const uvMap: Record<string, number> = {};
  const srTimes = srData?.hourly?.time || [];

  // Extract all Open-Meteo fields
  const omTemps = srData?.hourly?.temperature_2m || [];
  const omHumidity = srData?.hourly?.relative_humidity_2m || [];
  const omDewpoints = srData?.hourly?.dew_point_2m || [];
  const omPressures = srData?.hourly?.surface_pressure || [];
  const omWindSpeeds = srData?.hourly?.wind_speed_10m || [];
  const omSRInstant = srData?.hourly?.shortwave_radiation_instant || [];
  const omSRDirect = srData?.hourly?.direct_radiation_instant || [];
  const omSRDiffuse = srData?.hourly?.diffuse_radiation_instant || [];
  const omApparentTemps = srData?.hourly?.apparent_temperature || [];
  const srClouds = srData?.hourly?.cloud_cover || [];
  const srUV = srData?.hourly?.uv_index || [];

  // Calculate psychrometric wet bulb from temperature, humidity, and pressure
  const omWetBulbs = omTemps.map((temp, i) =>
    calculatePsychrometricWetBulb(temp, omHumidity[i], omPressures[i])
  );

  srTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    omMap[hourKey] = {
      idx,
      omData: {
        temp: omTemps[idx], humidity: omHumidity[idx], dewpoint: omDewpoints[idx],
        wet_bulb: omWetBulbs[idx], pressure: omPressures[idx], wind_speed: omWindSpeeds[idx],
        sr_instant: omSRInstant[idx], sr_direct: omSRDirect[idx], sr_diffuse: omSRDiffuse[idx],
        apparent_temp: omApparentTemps[idx]
      }
    };
    cloudMap[hourKey] = srClouds[idx];
    uvMap[hourKey] = srUV[idx];
  });

  return { omMap, cloudMap, uvMap };
}

// Helper function to process single BOM observation with Kong WBGT
function processBOMObservationKong(obs: any, timestamp: string, omMap: Record<string, any>, cloudMap: Record<string, number>, uvMap: Record<string, number>, idx: number): any | null {
  const hourKey = timestamp.substring(0, 13);
  const omEntry = findOpenMeteoEntry(hourKey, omMap);

  if (!omMap || Object.keys(omMap).length === 0) {
    // Continue with BOM-only data
  } else if (!omEntry) {
    return null;
  }

  const omData = omEntry?.omData;
  const ta = obs.air_temp || omData?.temp || 0;
  const rh = obs.rel_hum || omData?.humidity || 0;
  const ws_kmh = obs.wind_spd_kmh || (omData?.wind_speed * 3.6) || 0;
  let solar_radiation = omData?.sr_instant || 0;

  // If no Open-Meteo data, estimate solar radiation based on time of day
  if (!omData) {
    const hour = parseInt(hourKey.split('T')[1]);
    solar_radiation = estimateSolarRadiation(hour);
  }

  const e = calculateVaporPressure(ta, rh);
  const esi = calculateESI(ta, rh, solar_radiation);
  const at = calculateAT(ta, rh, ws_kmh, solar_radiation);

  // Always calculate Kong WBGT
  let wbgt_kong: number;
  try {
    const kongCalc = calculateKongWBGTPipeline(
      ta, omData?.wet_bulb || 0, rh, omData?.pressure || 1013.25, omData?.wind_speed || (ws_kmh / 3.6),
      solar_radiation, omData?.sr_direct || 0, omData?.sr_diffuse || 0,
      SYDNEY_LAT, SYDNEY_LON, timestamp
    );
    wbgt_kong = kongCalc.kong_wbgt;
  } catch (error) {
    console.error(`[PARSE OBS] Error calculating Kong WBGT for ${timestamp}:`, error);
    // If Kong calculation fails, use simple calculation as emergency fallback
    wbgt_kong = calculateWBGT(ta, rh, solar_radiation);
  }

  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-');

  // Build source field in pattern: "weather_source: station + solar_source"
  const weatherSource = 'BOM';
  const stationName = obs.name || 'Unknown';
  const solarSource = solar_radiation > 0 ? (omData ? 'satellite' : 'estimated') : 'night';
  const source = `${weatherSource}: ${stationName} + ${solarSource}`;

  return {
    timestamp: `${day}/${month}/${year}, ${timePart}`,
    temperature: parseFloat(ta.toFixed(1)),
    humidity: Math.round(rh),
    dew_point: parseFloat((obs.dewpt || omData?.dewpoint || 0).toFixed(1)),
    wind_speed_ms: parseFloat((ws_kmh / 3.6 || omData?.wind_speed || 0).toFixed(2)),
    solar_radiation: parseFloat((solar_radiation || omData?.sr_instant || 0).toFixed(1)),
    cloud_cover: parseFloat((cloudMap[hourKey] || 0).toFixed(1)),
    uv_index: parseFloat((uvMap[hourKey] || 0).toFixed(1)),
    wbgt: parseFloat(wbgt_kong.toFixed(1)),
    esi: parseFloat(esi.toFixed(1)),
    apparent_temp: parseFloat(at.toFixed(1)),
    source
  };
}

function parseObservationsKong(srData: SRData | null, bomData: BOMData | null, startTime?: string, endTime?: string): any[] {
  const bomObs = bomData?.observations?.data || [];
  const { omMap, cloudMap, uvMap } = buildOpenMeteoMaps(srData);

  let results: any[] = [];

  // Try to process BOM observations first if available
  if (bomObs.length > 0) {
    console.log(`[PARSE] Processing ${bomObs.length} BOM observations`);

    results = bomObs
      .map((obs: any, idx: number) => {
        const timestamp = normalizeBOMTimestamp(obs.local_date_time);
        return processBOMObservationKong(obs, timestamp, omMap, cloudMap, uvMap, idx);
      })
      .filter((result): result is any => result !== null);

    // BOM observations are actual observations (no future data), so no need to filter
    console.log(`[PARSE] Processed ${results.length} BOM observations (BOM data contains no future forecasts)`);
  }

  // Fallback to Open-Meteo data if BOM data is unavailable
  if (results.length === 0 && srData?.hourly?.time) {
    console.log(`[PARSE] No BOM data available, falling back to Open-Meteo data (${srData.hourly.time.length} observations)`);

    const times = srData.hourly.time || [];
    const temps = srData.hourly.temperature_2m || [];
    const humidity = srData.hourly.relative_humidity_2m || [];
    const dewpoints = srData.hourly.dew_point_2m || [];
    const pressures = srData.hourly.surface_pressure || [];
    const windSpeeds = srData.hourly.wind_speed_10m || [];
    const srInstant = srData.hourly.shortwave_radiation_instant || [];
    const srDirect = srData.hourly.direct_radiation_instant || [];
    const srDiffuse = srData.hourly.diffuse_radiation_instant || [];
    const apparentTemps = srData.hourly.apparent_temperature || [];
    const cloudCovers = srData.hourly.cloud_cover || [];
    const uvIndexes = srData.hourly.uv_index || [];

    // Calculate psychrometric wet bulb from temperature, humidity, and pressure
    const wetBulbs = temps.map((temp, i) =>
      calculatePsychrometricWetBulb(temp, humidity[i], pressures[i])
    );

    const now = new Date();
    let futureDataSkipped = 0;

    times.forEach((time: string, idx: number) => {
      const isoTime = time.includes('T') ? time : new Date(time).toISOString();
      const timeDate = new Date(isoTime);

      // IMPORTANT: Only include past observations, not future forecasts
      if (timeDate > now) {
        futureDataSkipped++;
        return; // Skip future data
      }

      const ta = temps[idx];
      const rh = humidity[idx];
      const solarRadiation = srInstant[idx] || 0;

      const e = calculateVaporPressure(ta, rh);
      const ewbgt = calculateEWBGT(ta, e);
      const at = calculateAT(ta, rh, windSpeeds[idx] * 3.6, solarRadiation);

      let wbgt = calculateWBGT(ta, rh, solarRadiation);
      try {
        const kongCalc = calculateKongWBGTPipeline(
          ta, wetBulbs[idx], rh, pressures[idx], windSpeeds[idx],
          solarRadiation, srDirect[idx] || 0, srDiffuse[idx] || 0,
          SYDNEY_LAT, SYDNEY_LON, isoTime
        );
        wbgt = kongCalc.kong_wbgt;
      } catch (error) {
        console.error(`[DEBUG] Error calculating Kong WBGT for ${isoTime}:`, error);
      }

      // Convert ISO timestamp to DD/MM/YYYY, HH:MM:SS format for consistency with BOM data
      const [datePart, timePart] = isoTime.split('T');
      const [year, month, day] = datePart.split('-');
      const formattedTime = timePart.split('.')[0]; // Remove milliseconds and Z

      results.push({
        timestamp: `${day}/${month}/${year}, ${formattedTime}`,
        temperature: parseFloat(ta.toFixed(1)),
        humidity: Math.round(rh),
        dew_point: parseFloat(dewpoints[idx].toFixed(1)),
        wind_speed_ms: parseFloat(windSpeeds[idx].toFixed(2)),
        solar_radiation: parseFloat(solarRadiation.toFixed(1)),
        cloud_cover: parseFloat((cloudCovers[idx] || 0).toFixed(1)),
        uv_index: parseFloat((uvIndexes[idx] || 0).toFixed(1)),
        wbgt: parseFloat(wbgt.toFixed(1)),
        esi: parseFloat(ewbgt.toFixed(1)),
        apparent_temp: parseFloat((apparentTemps[idx] || 0).toFixed(1))
      });
    });

    if (futureDataSkipped > 0) {
      console.log(`[PARSE] Filtered out ${futureDataSkipped} future forecast data points, kept ${results.length} past observations`);
    }
  }

  // Apply time range filter if specified
  if (startTime && endTime) {
    const maxInRange = getMaxInRange(results, startTime, endTime);

    // If no exact data in range, try interpolation fallback
    if (!maxInRange) {
      const interpolated = getInterpolatedMaxInRange(results, startTime, endTime);
      return interpolated ? [interpolated] : [];
    }

    return [maxInRange];
  }

  return results;
}

// Helper function to build air quality maps from AQ data
function buildAirQualityMaps(aqData: AQData): { aqiMap: Record<string, number>; pm25Map: Record<string, number>; pm10Map: Record<string, number> } {
  const aqiMap: Record<string, number> = {};
  const pm25Map: Record<string, number> = {};
  const pm10Map: Record<string, number> = {};
  const aqTimes = aqData?.hourly?.time || [];
  const aqAQI = aqData?.hourly?.us_aqi || [];
  const aqPM25 = aqData?.hourly?.pm2_5 || [];
  const aqPM10 = aqData?.hourly?.pm10 || [];

  aqTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    aqiMap[hourKey] = aqAQI[idx];
    pm25Map[hourKey] = aqPM25[idx];
    pm10Map[hourKey] = aqPM10[idx];
  });

  return { aqiMap, pm25Map, pm10Map };
}

// Helper function to convert UTC timestamp to Sydney timezone for key matching
function convertUtcToSydneyKey(utcTimestamp: string): string {
  // BOM returns UTC timestamps like "2025-11-08T02:00:00Z"
  // Open-Meteo with timezone=Australia/Sydney returns like "2025-11-08T13:00"
  // We need to convert UTC to Sydney time for the hourKey lookup
  const date = new Date(utcTimestamp);
  const sydneyTime = date.toLocaleString('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  // Convert "2025-11-08, 13:00" to "2025-11-08T13"
  const [datePart, timePart] = sydneyTime.split(', ');
  const hourPart = timePart.substring(0, 2);
  return `${datePart}T${hourPart}`;
}

// Helper function to find matching or fallback Open-Meteo data for Sydney hour
function findOpenMeteoEntry(sydneyHourKey: string, omMap: Record<string, any>): any | null {
  // If no Open-Meteo data available, return null to trigger fallback behavior
  if (!omMap || Object.keys(omMap).length === 0) {
    return null;
  }

  // Try exact match first
  if (omMap[sydneyHourKey]) {
    return omMap[sydneyHourKey];
  }

  // If no exact match, try to find the closest previous hour (fallback for timezone mismatches)
  const hourKeyNum = parseInt(sydneyHourKey.split('T')[1]);
  let fallbackHour = hourKeyNum - 1;

  while (fallbackHour >= 0) {
    const fallbackKey = `${sydneyHourKey.split('T')[0]}T${fallbackHour.toString().padStart(2, '0')}`;
    if (omMap[fallbackKey]) {
      return omMap[fallbackKey];
    }
    fallbackHour--;
  }

  return null;
}

// Helper function to estimate solar radiation when Open-Meteo data is unavailable
function estimateSolarRadiation(hour: number): number {
  // Simple solar radiation estimation based on time of day for Sydney
  // Returns approximate solar radiation in W/m²

  if (hour < 5 || hour > 19) {
    return 0; // Night time
  }

  // Peak solar radiation around 13:00 (1 PM)
  if (hour >= 12 && hour <= 14) {
    return 1000 + (hour === 13 ? 100 : 0); // Peak: 1100 at 1 PM
  }

  // Morning ramp up
  if (hour >= 5 && hour <= 11) {
    return 50 + ((hour - 5) * 150); // Gradual increase
  }

  // Evening ramp down
  if (hour >= 15 && hour <= 19) {
    return 1000 - ((hour - 14) * 200); // Gradual decrease
  }

  return 0;
}

// Helper function to process single forecast with Kong WBGT
function processForecast(forecast: any, timestamp: string, omMap: Record<string, any>, cloudMap: Record<string, number>, uvMap: Record<string, number>): any | null {
  // Convert BOM's UTC timestamp to Sydney timezone for key matching
  const hourKey = convertUtcToSydneyKey(timestamp);
  const omEntry = findOpenMeteoEntry(hourKey, omMap);

  const ta = forecast.temp || omEntry?.omData?.temp || 0;
  const rh = forecast.relative_humidity || omEntry?.omData?.humidity || 0;
  const ws_kmh = forecast.wind?.speed_kilometre || (omEntry?.omData?.wind_speed * 3.6) || 0;
  let solar_radiation = omEntry?.omData?.sr_instant || 0;

  // If no Open-Meteo data, estimate solar radiation based on time of day
  if (!omEntry && hourKey) {
    const hour = parseInt(hourKey.split('T')[1]);
    solar_radiation = estimateSolarRadiation(hour);
  }

  const esi = calculateESI(ta, rh, solar_radiation);
  const at = calculateAT(ta, rh, ws_kmh, solar_radiation);

  // Always calculate Kong WBGT
  let wbgt_kong: number;
  try {
    const sydneyTimestamp = hourKey + ':00';
    const kongCalc = calculateKongWBGTPipeline(
      ta, omEntry?.omData?.wet_bulb || 0, rh, omEntry?.omData?.pressure || 1013.25, omEntry?.omData?.wind_speed || (ws_kmh / 3.6),
      solar_radiation, omEntry?.omData?.sr_direct || 0, omEntry?.omData?.sr_diffuse || 0,
      SYDNEY_LAT, SYDNEY_LON, sydneyTimestamp
    );
    wbgt_kong = kongCalc.kong_wbgt;
  } catch (error) {
    console.error(`[PARSE] Error calculating Kong WBGT for ${timestamp}:`, error);
    // If Kong calculation fails, use simple calculation as emergency fallback
    wbgt_kong = calculateWBGT(ta, rh, solar_radiation);
  }

  const localTimestamp = new Date(timestamp).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  // Build source field showing data provenance
  const weatherSource = omEntry?.omData ? 'BOM + Open-Meteo' : 'BOM only';
  const solarSource = solar_radiation > 0 ? (omEntry?.omData ? 'satellite' : 'estimated') : 'night';
  const source = `${weatherSource} + ${solarSource}`;

  return {
    localTimestamp,
    temperature: parseFloat(ta.toFixed(1)),
    humidity: Math.round(rh),
    dew_point: parseFloat((forecast.dewpoint || omEntry?.omData?.dewpoint || 0).toFixed(1)),
    wind_speed_ms: parseFloat((omEntry?.omData?.wind_speed || ws_kmh/3.6 || 0).toFixed(2)),
    solar_radiation: parseFloat(solar_radiation.toFixed(1)),
    cloud_cover: parseFloat((cloudMap[hourKey] || 0).toFixed(1)),
    uv_index: parseFloat((uvMap[hourKey] || 0).toFixed(1)),
    wbgt: parseFloat(wbgt_kong.toFixed(1)),
    esi: parseFloat(esi.toFixed(1)),
    apparent_temp: parseFloat(at.toFixed(1)),
    rain_chance: forecast.rain?.chance || 0,
    source
  };
}

function parseForecastData(srData: SRData | null, aqData: AQData | null, bomData: BOMData | null): any[] {
  const forecasts = bomData?.data || [];
  const { omMap, cloudMap, uvMap } = buildOpenMeteoMaps(srData);


  return forecasts
    .map((forecast: any) => processForecast(forecast, forecast.time, omMap, cloudMap, uvMap))
    .filter((result): result is any => result !== null);
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
      "Get current WBGT (Wet Bulb Globe Temperature) conditions in Sydney",
      async () => {
        try {
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
        } catch (error: any) {
          console.error('[MCP Tool] get_current_wbgt error:', error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error?.message || 'Failed to fetch current WBGT data',
                note: "Error occurred while fetching current WBGT conditions"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Tool 2: Get WBGT forecast
    this.server.tool(
      "get_wbgt_forecast",
      "Get 72-hour WBGT forecast for Sydney including solar radiation, cloud cover, UV index, and air quality",
      async () => {
        try {
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
        } catch (error: any) {
          console.error('[MCP Tool] get_wbgt_forecast error:', error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error?.message || 'Failed to fetch WBGT forecast',
                note: "Error occurred while fetching WBGT forecast"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Tool 3: Get WBGT observations (past 72 hours using Kong method)
    const observationsSchema: Record<string, any> = {
      start_time: z.string()
        .optional()
        .describe("Optional start time in ISO format for activity-specific WBGT maximum"),
      end_time: z.string()
        .optional()
        .describe("Optional end time in ISO format. When both start_time and end_time provided, returns max WBGT values during the activity window"),
      latitude: z.number()
        .optional()
        .describe("Optional latitude (default: Sydney Olympic Park). Automatically selects nearest BOM station within 50km, or uses OpenMeteo if none available"),
      longitude: z.number()
        .optional()
        .describe("Optional longitude (default: Sydney Olympic Park). Automatically selects nearest BOM station within 50km, or uses OpenMeteo if none available"),
    };

    this.server.tool(
      "get_observations",
      "Get past 72 hours of WBGT observations using Kong method. Supports custom locations - automatically selects nearest BOM station within 50km or uses OpenMeteo. Can also calculate maximum WBGT during a specific activity time window",
      observationsSchema,
      async (params: any) => {
        try {
          const { start_time, end_time, latitude, longitude } = params;

          // Determine data source based on location
          let dataSource: { station: any; source: string; distance?: number } | null = null;
          let bomUrl: string | null = null;

          if (latitude !== undefined && longitude !== undefined) {
            dataSource = determineDataSource(latitude, longitude);
            bomUrl = dataSource.station?.jsonUrl ?? null;
          } else {
            // No coordinates specified - use default Sydney Olympic Park station
            bomUrl = DEFAULT_BOM_STATION.jsonUrl;
            dataSource = {
              station: DEFAULT_BOM_STATION,
              source: DEFAULT_BOM_STATION.name,
              distance: undefined
            };
          }

          const data = await fetchObservations(
            undefined,
            undefined,
            latitude,
            longitude,
            bomUrl
          );

          if (!data.srData) {
            throw new Error('Missing OpenMeteo weather data');
          }

          // BOM data is optional (may not be available if no station in range)
          const observations = parseObservationsKong(data.srData, data.bomData ?? null, start_time, end_time);

          const note = start_time
            ? `Max WBGT conditions during activity from ${start_time} to ${end_time}`
            : "Past 72-hour WBGT observations (Kong method)";

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: observations,
                count: observations.length,
                source: dataSource?.source ?? DEFAULT_BOM_STATION.name,
                distance_km: dataSource?.distance,
                note
              }, null, 2)
            }]
          };
        } catch (error: any) {
          console.error('[MCP Tool] get_observations error:', error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error?.message || 'Failed to fetch observations',
                note: "Error occurred while fetching WBGT observations"
              }, null, 2)
            }]
          };
        }
      }
    );

    // Tool 4: Get historical WBGT observations
    const historicObservationsSchema: Record<string, any> = {
      start_date: z.string()
        .describe("Start date in YYYY-MM-DD format (required)"),
      end_date: z.string()
        .describe("End date in YYYY-MM-DD format (required, cannot be today - data not uploaded yet)"),
      start_time: z.string()
        .optional()
        .describe("Optional start time in ISO format (YYYY-MM-DDTHH:MM:SS) for filtering to specific time window. If provided with end_time, returns max values during that window."),
      end_time: z.string()
        .optional()
        .describe("Optional end time in ISO format (YYYY-MM-DDTHH:MM:SS) for filtering to specific time window. If provided with start_time, returns max values during that window."),
      latitude: z.number()
        .optional()
        .describe("Optional latitude (default: -33.8018 for Sydney)"),
      longitude: z.number()
        .optional()
        .describe("Optional longitude (default: 151.1254 for Sydney)"),
      timezone: z.string()
        .optional()
        .describe("Optional timezone (default: 'auto' for local time based on coordinates). Use 'auto' for automatic timezone detection, or specify IANA timezone like 'Australia/Sydney', 'Asia/Tokyo', 'America/New_York', etc."),
    };

    this.server.tool(
      "get_historic_observations",
      "Get historical WBGT observations using Kong method with satellite solar radiation priority and archive fallback. Supports global locations with automatic timezone detection. All timestamps returned in local time. Optionally filter to specific time window with start_time/end_time parameters.",
      historicObservationsSchema,
      async (params: any) => {
        const { start_date, end_date, start_time, end_time, latitude, longitude, timezone } = params;
        const lat = latitude || SYDNEY_LAT;
        const lon = longitude || SYDNEY_LON;
        const tz = timezone || 'auto';

        try {
          let kongData = await fetchKongWBGT(start_date, end_date, lat, lon, tz);

          // If start_time and end_time are provided, filter to that window and return max values
          if (start_time && end_time) {
            const filtered = getMaxInRange(kongData, start_time, end_time);
            if (filtered) {
              kongData = [filtered];
            } else {
              // Try interpolation fallback
              const interpolated = getInterpolatedMaxInRange(kongData, start_time, end_time);
              kongData = interpolated ? [interpolated] : [];
            }
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: kongData,
                count: kongData.length,
                location: { latitude: lat, longitude: lon },
                timezone: tz,
                note: start_time && end_time
                  ? `Max WBGT values during time window ${start_time} to ${end_time}. All timestamps in local time.`
                  : "Kong WBGT historical observations with satellite solar radiation (observational) prioritized over archive (model). All timestamps in local time."
              }, null, 2)
            }]
          };
        } catch (error: any) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: false,
                error: error?.message || 'Failed to fetch historic observations'
              }, null, 2)
            }]
          };
        }
      }
    );
  }
}

// --- HTTP Endpoints ---
// Helper function: Create CORS headers
function createCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

// Helper function: Create JSON response
function jsonResponse(data: any, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(data, null, 2), { headers: corsHeaders, status });
}

// Helper function: Create enhanced error response
interface ErrorDetails {
  field?: string;
  value?: any;
  constraint?: string;
  [key: string]: any;
}

interface EnhancedErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
  timestamp: string;
  path?: string;
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  details?: ErrorDetails,
  path?: string
): Response {
  const response: EnhancedErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details })
    },
    timestamp: new Date().toISOString(),
    ...(path && { path })
  };
  return jsonResponse(response, status, corsHeaders);
}

// Handler: GET /api/current
async function handleGetCurrent(corsHeaders: Record<string, string>): Promise<Response> {
  const data = await fetchObservations(undefined, undefined, undefined, undefined, undefined);
  const observations = parseObservations(data);
  return jsonResponse({
    success: true,
    data: observations[0] || null,
    timestamp: new Date().toISOString(),
    note: 'Current WBGT conditions in Sydney'
  }, 200, corsHeaders);
}

// Handler: GET /api/forecast
async function handleGetForecast(corsHeaders: Record<string, string>): Promise<Response> {
  const result = await fetchForecast();
  const forecast = parseForecastData(result.srData, result.aqData, result.bomData);

  return jsonResponse({
    success: true,
    data: forecast,
    count: forecast.length,
    timestamp: new Date().toISOString(),
    note: 'WBGT forecast (72 hours)'
  }, 200, corsHeaders);
}

// Helper: Fetch satellite solar radiation data from Open-Meteo
async function fetchSatelliteRadiation(
  startDate: string,
  endDate: string,
  latitude: number,
  longitude: number
): Promise<SRData | null> {
  const satelliteUrl = `https://satellite-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&hourly=shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant&models=satellite_radiation_seamless&timezone=auto&start_date=${startDate}&end_date=${endDate}`;

  try {
    console.log(`[SOLAR] Fetching satellite solar radiation for ${startDate} to ${endDate}...`);
    const response = await fetch(satelliteUrl);

    if (!response.ok) {
      console.log(`[SOLAR] Satellite API returned ${response.status}, will return null`);
      return null;
    }

    const data = await response.json() as SRData;
    const times = data?.hourly?.time || [];
    const srInstant = data?.hourly?.shortwave_radiation_instant || [];

    if (times.length === 0 || srInstant.length === 0) {
      console.log(`[SOLAR] No solar radiation data available`);
      return null;
    }

    console.log(`[SOLAR] Retrieved ${times.length} solar radiation data points`);
    return data;
  } catch (error) {
    console.error(`[SOLAR] Error fetching satellite data:`, error);
    return null;
  }
}

// Helper: Combine Visual Crossing weather data with solar radiation to calculate Kong WBGT
async function combineVisualCrossingWithSolar(
  vcData: VisualCrossingObservation[],
  solarData: SRData | null,
  latitude: number,
  longitude: number,
  timezone: string = 'Australia/Sydney'
): Promise<any[]> {
  const results: any[] = [];

  // Convert Visual Crossing observations to hourly arrays
  const vcFetcher = new VisualCrossingFetcher('dummy'); // API key not needed for conversion
  const arrays = vcFetcher.convertToHourlyArrays(vcData, timezone);

  // Build solar radiation time-indexed map
  const solarMap: Record<string, { sr: number; direct: number; diffuse: number }> = {};
  if (solarData?.hourly) {
    const times = solarData.hourly.time || [];
    const srInstant = solarData.hourly.shortwave_radiation_instant || [];
    const srDirect = solarData.hourly.direct_radiation_instant || [];
    const srDiffuse = solarData.hourly.diffuse_radiation_instant || [];

    times.forEach((time: string, idx: number) => {
      // Use hour key for matching (e.g., "2025-11-19T14")
      const hourKey = time.substring(0, 13);
      solarMap[hourKey] = {
        sr: srInstant[idx] || 0,
        direct: srDirect[idx] || 0,
        diffuse: srDiffuse[idx] || 0
      };
    });
  }

  console.log(`[VC-SOLAR] Combining ${arrays.times.length} Visual Crossing observations with solar data`);

  // Combine weather data with solar radiation and calculate WBGT
  arrays.times.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    const solar = solarMap[hourKey] || { sr: 0, direct: 0, diffuse: 0 };

    const Ta = arrays.temps[idx];           // Air temperature (°C)
    const RH = arrays.humidity[idx];        // Relative humidity (%)
    const Tdew = arrays.dewpoints[idx];     // Dew point (°C)
    const Tw = arrays.wetBulbs[idx];        // Wet bulb (°C) - pre-calculated
    const P = arrays.pressures[idx];        // Pressure (hPa)
    const u = arrays.windSpeeds[idx];       // Wind speed (m/s) - already converted from km/h
    const cloudCover = arrays.cloudCovers[idx]; // Cloud cover (%)

    // Calculate Kong WBGT using the pipeline
    const kongCalc = calculateKongWBGTPipelineByTimezone(
      Ta, Tw, RH, P, u,
      solar.sr, solar.direct, solar.diffuse,
      latitude, longitude, time,
      10,   // UTC offset for Sydney (AEDT = UTC+11, AEST = UTC+10, using 10 as base)
      true  // has DST
    );

    results.push({
      timestamp: time,
      temperature: parseFloat(Ta.toFixed(1)),
      humidity: Math.round(RH),
      dew_point: parseFloat(Tdew.toFixed(1)),
      wet_bulb: parseFloat(Tw.toFixed(1)),
      wind_speed_ms: parseFloat(u.toFixed(2)),
      pressure_hpa: parseFloat(P.toFixed(1)),
      solar_radiation: parseFloat(solar.sr.toFixed(1)),
      solar_direct: parseFloat(solar.direct.toFixed(1)),
      solar_diffuse: parseFloat(solar.diffuse.toFixed(1)),
      cloud_cover: parseFloat(cloudCover.toFixed(1)),
      wbgt: parseFloat(kongCalc.kong_wbgt.toFixed(1)),
      esi: parseFloat(kongCalc.esi.toFixed(1)),
      black_globe_temp: parseFloat(kongCalc.black_globe_temp.toFixed(1)),
      natural_wet_bulb: parseFloat(kongCalc.natural_wet_bulb_temp.toFixed(1)),
      solar_zenith_angle: parseFloat(kongCalc.solar_zenith_angle.toFixed(1)),
      weather_source: 'Visual Crossing',
      solar_source: solar.sr > 0 ? 'satellite' : 'none'
    });
  });

  console.log(`[VC-SOLAR] Calculated WBGT for ${results.length} observations`);
  return results;
}

// Handler: GET /api/observations (with 3-tier routing)
async function handleGetObservations(url: URL, corsHeaders: Record<string, string>, env?: Env): Promise<Response> {
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined;

  // Use default Sydney coordinates if not specified
  const lat = latitude ?? SYDNEY_LAT;
  const lon = longitude ?? SYDNEY_LON;

  // **3-TIER ROUTING LOGIC**
  // Determine which data source to use based on data age
  let dataSourceName: string;
  let observations: any[];
  let additionalInfo: any = {};

  if (start_time) {
    // Calculate age of requested data
    const now = new Date();
    const startDate = new Date(start_time);
    const ageInDays = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    console.log(`[OBSERVATIONS] Data age: ${ageInDays.toFixed(1)} days (start_time: ${start_time})`);

    if (ageInDays <= 3) {
      // **TIER 1: Recent data (0-3 days ago) - Use BOM + Open-Meteo**
      console.log(`[OBSERVATIONS] TIER 1: Using BOM + Open-Meteo for recent data`);
      dataSourceName = 'BOM + Open-Meteo';

      // Determine BOM station based on location
      let dataSource: { station: any; source: string; distance?: number } | null = null;
      let bomUrl: string | null = null;

      if (latitude !== undefined && longitude !== undefined) {
        dataSource = determineDataSource(latitude, longitude);
        bomUrl = dataSource.station?.jsonUrl ?? null;
      } else {
        bomUrl = DEFAULT_BOM_STATION.jsonUrl;
        dataSource = {
          station: DEFAULT_BOM_STATION,
          source: DEFAULT_BOM_STATION.name,
          distance: undefined
        };
      }

      const data = await fetchObservations(undefined, undefined, latitude, longitude, bomUrl);
      observations = parseObservationsKong(data.srData!, data.bomData ?? null, start_time, end_time);

      additionalInfo = {
        station: dataSource?.source ?? DEFAULT_BOM_STATION.name,
        distance_km: dataSource?.distance
      };

    } else if (ageInDays <= 90) {
      // **TIER 2: Medium-term data (3-90 days ago) - Use Open-Meteo Only**
      console.log(`[OBSERVATIONS] TIER 2: Using Open-Meteo only for ${ageInDays.toFixed(1)} day old data`);

      dataSourceName = 'Open-Meteo Only';

      try {
        // Extract date range from start_time and end_time
        const startDateStr = start_time.split('T')[0];  // "YYYY-MM-DD"
        const endDateStr = end_time ? end_time.split('T')[0] : new Date().toISOString().split('T')[0];

        // Use enhanced weather fetcher to get Open-Meteo data with solar radiation
        const { WeatherFetcherService } = await import('./services/weather/weather-fetcher.service');
        const weatherData = await WeatherFetcherService.fetchWeather({
          latitude: lat,
          longitude: lon,
          startDate: startDateStr,
          endDate: endDateStr,
          timezone: 'auto',
          useEnhancedSolarRadiation: true
        });

        // Parse weather data with Kong WBGT calculations (similar to parseHistoricalObservations)
        observations = await parseHistoricalObservationsWithSolar(weatherData, lat, lon);

        // Filter to requested time window if both start_time and end_time provided
        if (start_time && end_time) {
          const filtered = getMaxInRange(observations, start_time, end_time);
          observations = filtered ? [filtered] : [];

          // Try interpolation fallback if no exact match
          if (!filtered) {
            const interpolated = getInterpolatedMaxInRange(observations, start_time, end_time);
            observations = interpolated ? [interpolated] : [];
          }
        }

        additionalInfo = {
          location: { latitude: lat, longitude: lon },
          date_range: { start: startDateStr, end: endDateStr },
          solar_radiation_source: weatherData.solarRadiationSource || 'standard'
        };

      } catch (error: any) {
        return errorResponse(
          'OPENMETEO_FETCH_FAILED',
          'Failed to fetch Open-Meteo data for tier 2',
          500,
          corsHeaders,
          {
            reason: error?.message || 'Unknown error',
            data_age_days: ageInDays.toFixed(1),
            tier: 'tier_2',
            location: { latitude: lat, longitude: lon }
          },
          url.pathname
        );
      }

    } else {
      // **TIER 3: Long-term historical data (90+ days ago) - Redirect to /historic_observations**
      console.log(`[OBSERVATIONS] TIER 3: Data too old (${ageInDays.toFixed(1)} days), redirecting to /historic_observations`);

      return errorResponse(
        'USE_HISTORIC_ENDPOINT',
        'For data older than 90 days, use /api/historic_observations endpoint',
        400,
        corsHeaders,
        {
          data_age_days: ageInDays.toFixed(1),
          tier: 'tier_3',
          requested_date: start_time,
          recommendation: {
            endpoint: '/api/historic_observations',
            parameters: {
              start_date: start_time.split('T')[0],
              end_date: end_time ? end_time.split('T')[0] : start_time.split('T')[0],
              start_time: start_time,
              end_time: end_time,
              latitude: lat,
              longitude: lon
            }
          }
        },
        url.pathname
      );
    }

  } else {
    // **No time filter: Use existing recent data logic (Tier 1 - BOM + Open-Meteo)**
    console.log(`[OBSERVATIONS] No start_time specified, using TIER 1 (recent data)`);
    dataSourceName = 'BOM + Open-Meteo (recent)';

    // Determine BOM station based on location
    let dataSource: { station: any; source: string; distance?: number } | null = null;
    let bomUrl: string | null = null;

    if (latitude !== undefined && longitude !== undefined) {
      dataSource = determineDataSource(latitude, longitude);
      bomUrl = dataSource.station?.jsonUrl ?? null;
    } else {
      bomUrl = DEFAULT_BOM_STATION.jsonUrl;
      dataSource = {
        station: DEFAULT_BOM_STATION,
        source: DEFAULT_BOM_STATION.name,
        distance: undefined
      };
    }

    const data = await fetchObservations(undefined, undefined, latitude, longitude, bomUrl);
    observations = parseObservationsKong(data.srData!, data.bomData ?? null, undefined, undefined);

    additionalInfo = {
      station: dataSource?.source ?? DEFAULT_BOM_STATION.name,
      distance_km: dataSource?.distance
    };
  }

  // Return unified response
  return jsonResponse({
    success: true,
    data: observations,
    count: observations.length,
    source: dataSourceName,
    ...additionalInfo,
    timestamp: new Date().toISOString(),
    note: start_time && end_time
      ? `WBGT observations from ${start_time} to ${end_time} (${dataSourceName})`
      : "Past 72-hour WBGT observations (Kong method)"
  }, 200, corsHeaders);
}

// Helper: Combine Meteostat weather data with solar radiation to calculate Kong WBGT
async function combineMeteostatWithSolar(
  meteostatData: import('./utils/meteostat-fetcher').MeteostatHourlyObservation[],
  solarData: SRData | null,
  latitude: number,
  longitude: number,
  timezone: string = 'Australia/Sydney'
): Promise<any[]> {
  const results: any[] = [];

  // Build solar radiation time-indexed map
  const solarMap: Record<string, { sr: number; direct: number; diffuse: number }> = {};
  if (solarData?.hourly) {
    const times = solarData.hourly.time || [];
    const srInstant = solarData.hourly.shortwave_radiation_instant || [];
    const srDirect = solarData.hourly.direct_radiation_instant || [];
    const srDiffuse = solarData.hourly.diffuse_radiation_instant || [];

    times.forEach((time: string, idx: number) => {
      // Use hour key for matching (e.g., "2025-11-19T14")
      const hourKey = time.substring(0, 13);
      solarMap[hourKey] = {
        sr: srInstant[idx] || 0,
        direct: srDirect[idx] || 0,
        diffuse: srDiffuse[idx] || 0
      };
    });
  }

  console.log(`[METEOSTAT-SOLAR] Combining ${meteostatData.length} Meteostat observations with solar data`);

  const vcFetcher = new VisualCrossingFetcher('dummy'); // For wet bulb calculation

  // Combine weather data with solar radiation and calculate WBGT
  meteostatData.forEach((obs) => {
    // Extract hour key from Meteostat timestamp (ISO format: "2025-11-19T14:00:00")
    const hourKey = obs.time.substring(0, 13);
    const solar = solarMap[hourKey] || { sr: 0, direct: 0, diffuse: 0 };

    const Ta = obs.temperature;           // Air temperature (°C)
    const RH = obs.humidity;              // Relative humidity (%)
    const Tdew = obs.dew_point;           // Dew point (°C)
    const P = obs.pressure;               // Pressure (hPa)
    const u = obs.wind_speed;             // Wind speed (m/s) - already converted from km/h

    // Calculate wet bulb temperature using Stull (2011) approximation
    const Tw = vcFetcher['calculateWetBulb']?.(Ta, RH, P) || 0;

    // Calculate Kong WBGT using the pipeline
    const kongCalc = calculateKongWBGTPipelineByTimezone(
      Ta, Tw, RH, P, u,
      solar.sr, solar.direct, solar.diffuse,
      latitude, longitude, obs.time,
      10,   // UTC offset for Sydney (AEDT = UTC+11, AEST = UTC+10, using 10 as base)
      true  // has DST
    );

    results.push({
      timestamp: obs.time,
      temperature: parseFloat(Ta.toFixed(1)),
      humidity: Math.round(RH),
      dew_point: parseFloat(Tdew.toFixed(1)),
      wind_speed_ms: parseFloat(u.toFixed(2)),
      pressure_hpa: parseFloat(P.toFixed(1)),
      solar_radiation: parseFloat(solar.sr.toFixed(1)),
      solar_direct: parseFloat(solar.direct.toFixed(1)),
      solar_diffuse: parseFloat(solar.diffuse.toFixed(1)),
      wbgt: parseFloat(kongCalc.kong_wbgt.toFixed(1)),
      esi: parseFloat(kongCalc.esi.toFixed(1)),
      black_globe_temp: parseFloat(kongCalc.black_globe_temp.toFixed(1)),
      natural_wet_bulb: parseFloat(kongCalc.natural_wet_bulb_temp.toFixed(1)),
      solar_zenith_angle: parseFloat(kongCalc.solar_zenith_angle.toFixed(1)),
      weather_source: 'Meteostat',
      solar_source: solar.sr > 0 ? 'satellite' : 'none',
      precipitation: obs.precipitation,
      snow_depth: obs.snow_depth || 0
    });
  });

  console.log(`[METEOSTAT-SOLAR] Calculated WBGT for ${results.length} observations`);
  return results;
}

// Handler: GET /api/VC_observations (Visual Crossing + OpenMeteo Solar)
async function handleGetVC_Observations(url: URL, corsHeaders: Record<string, string>, env?: Env): Promise<Response> {
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined;

  // Use default Sydney coordinates if not specified
  const lat = latitude ?? SYDNEY_LAT;
  const lon = longitude ?? SYDNEY_LON;

  // Check if Visual Crossing API key is available
  const vcApiKey = env?.VISUAL_CROSSING_API_KEY;
  if (!vcApiKey) {
    return errorResponse(
      'VISUAL_CROSSING_API_KEY_MISSING',
      'Visual Crossing API key not configured. This endpoint requires Visual Crossing data.',
      500,
      corsHeaders,
      {
        endpoint: '/api/VC_observations',
        data_source: 'Visual Crossing + OpenMeteo Solar'
      },
      url.pathname
    );
  }

  // Extract date range from start_time and end_time
  const startDateStr = start_time ? start_time.split('T')[0] : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDateStr = end_time ? end_time.split('T')[0] : new Date().toISOString().split('T')[0];

  console.log(`[VC_OBSERVATIONS] Using Visual Crossing + OpenMeteo Solar for ${startDateStr} to ${endDateStr} at (${lat}, ${lon})`);

  try {
    // Fetch Visual Crossing weather data (observational data from NOAA ISD)
    const vcFetcher = new VisualCrossingFetcher(vcApiKey);
    const vcResponse = await vcFetcher.fetchObservations(lat, lon, startDateStr, endDateStr);

    // Fetch solar radiation from Open-Meteo satellite API
    const solarData = await fetchSatelliteRadiation(startDateStr, endDateStr, lat, lon);

    // Combine Visual Crossing weather + Open-Meteo solar → Kong WBGT
    const observations = await combineVisualCrossingWithSolar(vcResponse.observations, solarData, lat, lon);

    // Filter to requested time window if both start_time and end_time provided
    let filteredObservations = observations;
    if (start_time && end_time) {
      filteredObservations = observations.filter(obs => {
        const obsTime = new Date(obs.timestamp).getTime();
        const startMs = new Date(start_time).getTime();
        const endMs = new Date(end_time).getTime();
        return obsTime >= startMs && obsTime <= endMs;
      });

      // If no exact data in range, try max range filter
      if (filteredObservations.length === 0) {
        const maxInRange = getMaxInRange(observations, start_time, end_time);
        filteredObservations = maxInRange ? [maxInRange] : [];

        // If still no data, try interpolation fallback
        if (!maxInRange) {
          const interpolated = getInterpolatedMaxInRange(observations, start_time, end_time);
          filteredObservations = interpolated ? [interpolated] : [];
        }
      }
    }

    // Get usage stats from fetcher
    const usageStats = vcFetcher.getUsageStats();

    // Format station information for response
    const stationInfo = vcResponse.stations ? Object.entries(vcResponse.stations).map(([id, station]) => ({
      id,
      name: station.name,
      distance_km: parseFloat(station.distance.toFixed(1)),
      latitude: station.latitude,
      longitude: station.longitude
    })) : [];

    return jsonResponse({
      success: true,
      data: filteredObservations,
      count: filteredObservations.length,
      source: 'Visual Crossing + OpenMeteo Solar',
      visual_crossing: {
        records_used: usageStats.recordsUsed,
        records_remaining: usageStats.recordsRemaining,
        reset_time: usageStats.resetTime,
        resolved_address: vcResponse.resolvedAddress,
        data_type: stationInfo.length > 0 ? 'observational' : 'model',
        contributing_stations: stationInfo
      },
      location: { latitude: lat, longitude: lon },
      date_range: { start: startDateStr, end: endDateStr },
      timestamp: new Date().toISOString(),
      note: start_time && end_time
        ? `WBGT observations from ${start_time} to ${end_time} (Visual Crossing + OpenMeteo Solar)`
        : `WBGT observations from ${startDateStr} to ${endDateStr} (Visual Crossing + OpenMeteo Solar)`
    }, 200, corsHeaders);

  } catch (error: any) {
    return errorResponse(
      'VC_OBSERVATIONS_FETCH_FAILED',
      'Failed to fetch Visual Crossing observations',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        location: { latitude: lat, longitude: lon },
        date_range: { start: startDateStr, end: endDateStr }
      },
      url.pathname
    );
  }
}

// Handler: GET /api/meteostat_observations (Meteostat + OpenMeteo Solar)
async function handleGetMeteostatObservations(url: URL, corsHeaders: Record<string, string>, env?: Env): Promise<Response> {
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : undefined;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : undefined;

  // Use default Sydney coordinates if not specified
  const lat = latitude ?? SYDNEY_LAT;
  const lon = longitude ?? SYDNEY_LON;

  // Extract date range from start_time and end_time
  const startDateStr = start_time ? start_time.split('T')[0] : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDateStr = end_time ? end_time.split('T')[0] : new Date().toISOString().split('T')[0];

  console.log(`[METEOSTAT_OBSERVATIONS] Using Meteostat + OpenMeteo Solar for ${startDateStr} to ${endDateStr} at (${lat}, ${lon})`);

  try {
    // Dynamically import Meteostat fetcher to avoid circular dependencies
    const { MeteostatFetcher } = await import('./utils/meteostat-fetcher');

    // Fetch Meteostat weather data (observational data from weather stations)
    const meteostatFetcher = new MeteostatFetcher();
    const meteostatResponse = await meteostatFetcher.fetchObservations(lat, lon, startDateStr, endDateStr);

    // Fetch solar radiation from Open-Meteo satellite API
    const solarData = await fetchSatelliteRadiation(startDateStr, endDateStr, lat, lon);

    // Combine Meteostat weather + Open-Meteo solar → Kong WBGT
    const observations = await combineMeteostatWithSolar(meteostatResponse.observations, solarData, lat, lon);

    // Filter to requested time window if both start_time and end_time provided
    let filteredObservations = observations;
    if (start_time && end_time) {
      filteredObservations = observations.filter(obs => {
        const obsTime = new Date(obs.timestamp).getTime();
        const startMs = new Date(start_time).getTime();
        const endMs = new Date(end_time).getTime();
        return obsTime >= startMs && obsTime <= endMs;
      });

      // If no exact data in range, try max range filter
      if (filteredObservations.length === 0) {
        const maxInRange = getMaxInRange(observations, start_time, end_time);
        filteredObservations = maxInRange ? [maxInRange] : [];

        // If still no data, try interpolation fallback
        if (!maxInRange) {
          const interpolated = getInterpolatedMaxInRange(observations, start_time, end_time);
          filteredObservations = interpolated ? [interpolated] : [];
        }
      }
    }

    return jsonResponse({
      success: true,
      data: filteredObservations,
      count: filteredObservations.length,
      source: 'Meteostat + OpenMeteo Solar',
      meteostat: {
        station: {
          id: meteostatResponse.station.id,
          name: meteostatResponse.station.name,
          latitude: meteostatResponse.station.latitude,
          longitude: meteostatResponse.station.longitude,
          elevation: meteostatResponse.station.elevation,
          distance_km: meteostatResponse.station.distance
            ? parseFloat(meteostatResponse.station.distance.toFixed(1))
            : undefined
        },
        generated_at: meteostatResponse.generated_at
      },
      location: { latitude: lat, longitude: lon },
      date_range: { start: startDateStr, end: endDateStr },
      timestamp: new Date().toISOString(),
      note: start_time && end_time
        ? `WBGT observations from ${start_time} to ${end_time} (Meteostat + OpenMeteo Solar)`
        : `WBGT observations from ${startDateStr} to ${endDateStr} (Meteostat + OpenMeteo Solar)`
    }, 200, corsHeaders);

  } catch (error: any) {
    return errorResponse(
      'METEOSTAT_OBSERVATIONS_FETCH_FAILED',
      'Failed to fetch Meteostat observations',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        location: { latitude: lat, longitude: lon },
        date_range: { start: startDateStr, end: endDateStr }
      },
      url.pathname
    );
  }
}

// Handler: GET /api/historic_observations
async function handleGetHistoricObservations(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : SYDNEY_LAT;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : SYDNEY_LON;
  const timezone = url.searchParams.get('timezone') || 'auto';

  if (!start_date || !end_date) {
    return errorResponse(
      'MISSING_REQUIRED_PARAMETERS',
      'Missing required parameters: start_date and end_date',
      400,
      corsHeaders,
      {
        required: ['start_date', 'end_date'],
        optional: ['start_time', 'end_time', 'latitude', 'longitude', 'timezone'],
        format: 'YYYY-MM-DD for dates, YYYY-MM-DDTHH:MM:SS for times',
        note: 'end_date cannot be today. If start_time and end_time provided, returns max values during that window. timezone defaults to "auto" (local time for coordinates).',
        examples: {
          'Sydney full day': 'start_date=2025-11-15&end_date=2025-11-15&latitude=-33.8018&longitude=151.1254',
          'Sydney time window': 'start_date=2025-11-15&end_date=2025-11-15&start_time=2025-11-15T12:00:00&end_time=2025-11-15T14:00:00&latitude=-33.8018&longitude=151.1254'
        }
      },
      url.pathname
    );
  }

  try {
    let kongData = await fetchKongWBGT(start_date, end_date, latitude, longitude, timezone);

    // If start_time and end_time are provided, filter to that window and return max values
    if (start_time && end_time) {
      const filtered = getMaxInRange(kongData, start_time, end_time);
      if (filtered) {
        kongData = [filtered];
      } else {
        // Try interpolation fallback
        const interpolated = getInterpolatedMaxInRange(kongData, start_time, end_time);
        kongData = interpolated ? [interpolated] : [];
      }
    }

    return jsonResponse({
      success: true,
      data: kongData,
      count: kongData.length,
      timestamp: new Date().toISOString(),
      location: { latitude, longitude },
      timezone: timezone,
      note: start_time && end_time
        ? `Max WBGT values during time window ${start_time} to ${end_time}. All timestamps in local time.`
        : 'All timestamps in local time. Solar radiation prioritizes satellite data with archive fallback.'
    }, 200, corsHeaders);
  } catch (error: any) {
    return errorResponse(
      'FETCH_FAILED',
      'Failed to fetch historic observations',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        location: { latitude, longitude },
        dateRange: { start_date, end_date },
        timeWindow: start_time && end_time ? { start_time, end_time } : undefined,
        timezone: timezone
      },
      url.pathname
    );
  }
}

// Handler: GET /api/experimental/weatherzone_observations
async function handleGetWeatherZoneObservations(url: URL, corsHeaders: Record<string, string>, env: Env): Promise<Response> {
  // Support location-based and default selection
  const latitude = url.searchParams.get('latitude') || url.searchParams.get('lat');
  const longitude = url.searchParams.get('longitude') || url.searchParams.get('lon');
  const observation_date = url.searchParams.get('observation_date') || url.searchParams.get('date');

  // Determine the station to use
  let selectedStation: any;
  let stationSelectionInfo: any;

  if (latitude && longitude) {
    // Use location-based selection
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return errorResponse(
        'INVALID_COORDINATES',
        'Invalid latitude or longitude values',
        400,
        corsHeaders,
        {
          provided: { latitude, longitude },
          expected: 'Valid decimal coordinates (e.g., latitude=-33.85&longitude=151.21)'
        },
        url.pathname
      );
    }

    const stationResult = determineWeatherZoneDataSource(lat, lon);
    if (stationResult.station) {
      selectedStation = stationResult.station;
      stationSelectionInfo = {
        method: 'location_based',
        coordinates: { latitude: lat, longitude: lon },
        station: stationResult.station,
        distance: stationResult.distance,
        source: stationResult.source
      };
    } else {
      return errorResponse(
        'NO_STATION_FOUND',
        'No WeatherZone station found within 50km of provided coordinates',
        404,
        corsHeaders,
        {
          coordinates: { latitude: lat, longitude: lon },
          max_distance: '50km',
          available_stations: 'Sydney Olympic Park (66212) - default location',
          suggestion: 'Try coordinates near Sydney Olympic Park or omit coordinates to use default station'
        },
        url.pathname
      );
    }
  } else {
    // Use default station (no location parameters provided)
    const defaultStation = findNearestWeatherZoneStationOrDefault(-33.8541, 151.0743); // Sydney Olympic Park
    selectedStation = defaultStation;
    stationSelectionInfo = {
      method: 'default',
      station: defaultStation,
      note: 'Using default WeatherZone station (Sydney Olympic Park)'
    };
  }

  if (!observation_date) {
    return errorResponse(
      'MISSING_REQUIRED_PARAMETERS',
      'Missing required parameter: observation_date',
      400,
      corsHeaders,
      {
        required: ['observation_date'],
        optional: ['latitude/longitude for location-based selection'],
        format: {
          observation_date: 'Date in YYYY-MM-DD format (e.g., "2025-11-25")',
          latitude: 'Decimal degrees latitude (e.g., "-33.85")',
          longitude: 'Decimal degrees longitude (e.g., "151.21")'
        },
        examples: {
          'Location-based': 'latitude=-33.85&longitude=151.21&observation_date=2025-11-25',
          'Default station': 'observation_date=2025-11-25'
        },
        note: 'EXPERIMENTAL: This endpoint attempts direct HTTP fetch of WeatherZone data. WeatherZone may require JavaScript rendering, in which case results will be limited.'
      },
      url.pathname
    );
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(observation_date)) {
    return errorResponse(
      'INVALID_DATE_FORMAT',
      'observation_date must be in YYYY-MM-DD format',
      400,
      corsHeaders,
      {
        provided: observation_date,
        expected: 'YYYY-MM-DD (e.g., 2025-11-25)'
      },
      url.pathname
    );
  }

  try {
    const usedSiteId = selectedStation.siteId;
    console.log(`[WEATHERZONE API] Fetching observations for site ${usedSiteId} on ${observation_date} (${stationSelectionInfo.method})`);

    // Fetch from WeatherZone with browser rendering
    const result = await fetchWeatherZoneObservations(
      usedSiteId,
      observation_date,
      env?.BROWSER
    );

    return jsonResponse({
      success: result.success,
      data: result.observations,
      count: result.observations.length,
      source: result.source,
      cached: result.cached || false,
      site_id: usedSiteId,
      observation_date,
      timestamp: new Date().toISOString(),
      experimental: true,
      station_selection: stationSelectionInfo,
      note: result.success
        ? 'EXPERIMENTAL: WeatherZone observations fetched successfully'
        : `EXPERIMENTAL: ${result.error || 'Failed to fetch WeatherZone observations'}. This endpoint may require JavaScript rendering support (Cloudflare Browser Rendering API).`
    }, result.success ? 200 : 500, corsHeaders);

  } catch (error: any) {
    return errorResponse(
      'WEATHERZONE_FETCH_FAILED',
      'Failed to fetch WeatherZone observations',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        site_id: selectedStation.siteId,
        observation_date,
        station_selection: stationSelectionInfo,
        experimental: true
      },
      url.pathname
    );
  }
}

// Handler: GET /health
function handleHealth(corsHeaders: Record<string, string>): Response {
  return jsonResponse({
    status: 'ok',
    service: 'WBGT Sydney Runner API',
    timestamp: new Date().toISOString()
  }, 200, corsHeaders);
}

// Handler: GET /api/docs/openapi.yaml (OpenAPI specification)
function handleOpenAPISpec(): Response {
  // Read the OpenAPI spec from the file system would require cloudflare bindings
  // For now, return a reference to the OpenAPI spec location
  const openApiYaml = `openapi: 3.0.0
info:
  title: WBGT Sydney Runner API
  version: 1.0.0
  description: Wet Bulb Globe Temperature API providing current conditions, forecasts, and historical observations
servers:
  - url: 'https://wbgt-mcp-server.workers.dev'
    description: Production server
paths:
  /api/v1/current:
    get:
      summary: Get current WBGT conditions
      tags:
        - Current Conditions
      responses:
        '200':
          description: Current WBGT conditions retrieved successfully
  /api/v1/forecast:
    get:
      summary: Get 72-hour WBGT forecast
      tags:
        - Forecast
      responses:
        '200':
          description: WBGT forecast retrieved successfully
  /api/v1/observations:
    get:
      summary: Get past 72 hours of WBGT observations
      tags:
        - Historical Data
      parameters:
        - name: start_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional start time in ISO format for activity-specific WBGT maximum
        - name: end_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional end time in ISO format for activity window
        - name: latitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Latitude for location (automatically selects nearest BOM station within 50km or uses OpenMeteo)
        - name: longitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Longitude for location (automatically selects nearest BOM station within 50km or uses OpenMeteo)
      responses:
        '200':
          description: WBGT observations retrieved successfully
  /api/v1/historic_observations:
    get:
      summary: Get historical WBGT observations with optional timezone
      tags:
        - Historical Data
      parameters:
        - name: start_date
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: end_date
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: latitude
          in: query
          required: false
          schema:
            type: number
        - name: longitude
          in: query
          required: false
          schema:
            type: number
        - name: timezone
          in: query
          required: false
          schema:
            type: string
            default: auto
      responses:
        '200':
          description: Historical WBGT observations retrieved successfully
  /api/v1/VC_observations:
    get:
      summary: Get Visual Crossing observations with OpenMeteo solar radiation (1970-present)
      tags:
        - Historical Data
      parameters:
        - name: start_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional start time in ISO format (defaults to 3 days ago)
        - name: end_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional end time in ISO format (defaults to now)
        - name: latitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Latitude for location
        - name: longitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Longitude for location
      responses:
        '200':
          description: Visual Crossing observations retrieved successfully
  /api/v1/meteostat_observations:
    get:
      summary: Get Meteostat observations with OpenMeteo solar radiation (1943-present)
      tags:
        - Historical Data
      parameters:
        - name: start_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional start time in ISO format (defaults to 3 days ago)
        - name: end_time
          in: query
          required: false
          schema:
            type: string
            format: date-time
          description: Optional end time in ISO format (defaults to now)
        - name: latitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Latitude for location
        - name: longitude
          in: query
          required: false
          schema:
            type: number
            format: double
          description: Longitude for location
      responses:
        '200':
          description: Meteostat observations retrieved successfully`;

  return new Response(openApiYaml, {
    headers: {
      'Content-Type': 'application/yaml',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'max-age=86400'
    },
    status: 200
  });
}

// Handler: GET /api (Primary API)
function handleApiRoot(corsHeaders: Record<string, string>): Response {
  return jsonResponse({
    service: 'WBGT Sydney Runner API',
    version: '1.0.0',
    deprecated: false,
    endpoints: {
      'GET /api/current': 'Current WBGT conditions in Sydney (< 3 days: BOM + OpenMeteo)',
      'GET /api/forecast': '72-hour WBGT forecast for Sydney',
      'GET /api/observations': '3-tier observations: BOM for <3d, OpenMeteo for 3d-90d, redirects to historic for >90d',
      'GET /api/VC_observations': 'Visual Crossing observations (1970-present) + OpenMeteo solar (observational weather data)',
      'GET /api/meteostat_observations': 'Meteostat observations (1943-present) + OpenMeteo solar (station-based weather data)',
      'GET /api/historic_observations': 'Historical WBGT data (Kong method) with timezone support (90+ days: NOAA ISD + OpenMeteo solar)',
      'GET /api/experimental/weatherzone_observations': 'EXPERIMENTAL: WeatherZone hourly observations (requires site_id and observation_date)',
      'GET /api/health': 'Health check'
    },
    documentation: {
      note: 'This is the recommended API version. historic_observations now supports global locations with timezone=auto parameter.',
      endpoint: '/api (primary)',
      openapi: 'GET /api/docs/openapi.yaml or /api/docs/openapi.json'
    }
  }, 200, corsHeaders);
}

// Handler: GET /api/v1 (Legacy - deprecated)
function handleApiRootV1(corsHeaders: Record<string, string>): Response {
  return jsonResponse({
    service: 'WBGT Sydney Runner API',
    version: '1.0.0 (legacy path)',
    deprecated: true,
    note: 'The /api/v1 path is deprecated. Please use /api instead. The historic_observations_japan endpoint has been consolidated into historic_observations with timezone parameter.',
    endpoints: {
      'GET /api/current': 'Current WBGT conditions (RECOMMENDED)',
      'GET /api/forecast': '72-hour WBGT forecast (RECOMMENDED)',
      'GET /api/observations': 'Past 72-hour observations (RECOMMENDED)',
      'GET /api/historic_observations': 'Historical WBGT data with timezone support (RECOMMENDED)',
      'GET /api/v1/current': 'Current WBGT conditions (deprecated)',
      'GET /api/v1/forecast': '72-hour WBGT forecast (deprecated)',
      'GET /api/v1/observations': 'Past 72-hour observations (deprecated)',
      'GET /api/v1/historic_observations': 'Historical WBGT data (deprecated)',
      'GET /api/health': 'Health check'
    },
    migration: 'Update your integration to use /api instead of /api/v1. Use timezone parameter for location-specific timezones.'
  }, 200, corsHeaders);
}

// Helper function: Add deprecation warning header
function addDeprecationHeader(corsHeaders: Record<string, string>, version: string = '2'): Record<string, string> {
  const message = version === '2'
    ? 'This endpoint uses /api/v1 path which is deprecated. Please migrate to /api to avoid future deprecation'
    : 'This endpoint uses legacy API. Please migrate to /api to avoid future deprecation';

  return {
    ...corsHeaders,
    'Deprecation': 'true',
    'Sunset': 'Sun, 31 Dec 2025 23:59:59 GMT',
    'X-API-Warn': message,
  };
}

async function handleHTTPRequest(request: Request, env: Env, _ctx: any): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const corsHeaders = createCorsHeaders();

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    // API Routes (Primary)
    if (pathname === '/api/current' && request.method === 'GET') return await handleGetCurrent(corsHeaders);
    if (pathname === '/api/forecast' && request.method === 'GET') return await handleGetForecast(corsHeaders);
    if (pathname === '/api/observations' && request.method === 'GET') return await handleGetObservations(url, corsHeaders, env);
    if (pathname === '/api/VC_observations' && request.method === 'GET') return await handleGetVC_Observations(url, corsHeaders, env);
    if (pathname === '/api/meteostat_observations' && request.method === 'GET') return await handleGetMeteostatObservations(url, corsHeaders, env);
    if (pathname === '/api/historic_observations' && request.method === 'GET') return await handleGetHistoricObservations(url, corsHeaders);
    if (pathname === '/api/experimental/weatherzone_observations' && request.method === 'GET') return await handleGetWeatherZoneObservations(url, corsHeaders, env);
    if (pathname === '/api/health' && request.method === 'GET') return handleHealth(corsHeaders);
    if (pathname === '/api' && request.method === 'GET') return handleApiRoot(corsHeaders);

    // Documentation endpoints
    if (pathname === '/api/docs/openapi.yaml' && request.method === 'GET') return handleOpenAPISpec();
    if (pathname === '/api/docs/openapi.json' && request.method === 'GET') {
      // Return OpenAPI spec in JSON format
      return new Response(JSON.stringify({
        openapi: '3.0.0',
        info: {
          title: 'WBGT Sydney Runner API',
          version: '1.0.0',
          description: 'Wet Bulb Globe Temperature API providing current conditions, forecasts, and historical observations'
        },
        servers: [
          { url: 'https://wbgt-mcp-server.workers.dev', description: 'Production server' }
        ],
        paths: {
          '/api/current': { get: { summary: 'Get current WBGT conditions', tags: ['Current Conditions'] } },
          '/api/forecast': { get: { summary: 'Get 72-hour WBGT forecast', tags: ['Forecast'] } },
          '/api/observations': { get: { summary: 'Get past 72 hours of WBGT observations', tags: ['Historical Data'] } },
          '/api/historic_observations': { get: { summary: 'Get historical WBGT observations with timezone support', tags: ['Historical Data'] } }
        }
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=86400'
        },
        status: 200
      });
    }

    // Legacy v1 routes (Deprecated - kept for backward compatibility only)
    if (pathname === '/api/v1/current' && request.method === 'GET') {
      const response = await handleGetCurrent(addDeprecationHeader(corsHeaders, '2'));
      return response;
    }
    if (pathname === '/api/v1/forecast' && request.method === 'GET') {
      const response = await handleGetForecast(addDeprecationHeader(corsHeaders, '2'));
      return response;
    }
    if (pathname === '/api/v1/observations' && request.method === 'GET') {
      const response = await handleGetObservations(url, addDeprecationHeader(corsHeaders, '2'), env);
      return response;
    }
    if (pathname === '/api/v1/historic_observations' && request.method === 'GET') {
      const response = await handleGetHistoricObservations(url, addDeprecationHeader(corsHeaders, '2'));
      return response;
    }
    if (pathname === '/api/v1/health' && request.method === 'GET') return handleHealth(corsHeaders);
    if (pathname === '/api/v1' && request.method === 'GET') return handleApiRootV1(corsHeaders);

    if (pathname === '/health' && request.method === 'GET') return handleHealth(corsHeaders);
    if (pathname === '/' && request.method === 'GET') return handleApiRoot(corsHeaders);

    // Not found
    return errorResponse(
      'ENDPOINT_NOT_FOUND',
      'The requested endpoint does not exist',
      404,
      corsHeaders,
      {
        requestedPath: pathname,
        availableVersions: ['v1', 'v0 (deprecated)'],
        suggestedEndpoint: '/api/v1'
      },
      pathname
    );

  } catch (error: any) {
    console.error('Error handling HTTP request:', error);
    return errorResponse(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while processing your request',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        type: error?.constructor?.name || 'Error'
      },
      pathname
    );
  }
}

// --- HTTP Handler ---
const sseAgent = WBGTServerMCP.serveSSE("/sse");
const standardAgent = WBGTServerMCP.serveSSE("/mcp");

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
    if (url.pathname === "/mcp" || url.pathname === "/mcp/message") {
      return standardAgent.fetch(request, env, ctx);
    }

    // Route to HTTP handler for all other paths
    return handleHTTPRequest(request, env, ctx);
  },
};
export { WBGTServerMCP as MyMCP };
