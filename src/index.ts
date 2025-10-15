import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Sydney coordinates
const SYDNEY_LAT = -33.8018;
const SYDNEY_LON = 151.1254;
const BOM_LOCATION_ID = "r3grwp";

// --- Calculation functions ---
function calculateESI(ta: number, rh: number, sr: number): number {
  return 0.62 * ta - 0.007 * rh + 0.002 * sr + 0.0043 * (ta * rh) - 0.078 / (0.1 + sr);
}

function calculateWBGT(esi: number): number {
  return esi * 1.086 - 1.846;
}

function calculateAT(ta: number, rh: number, ws_kmh: number, sr: number): number {
  const ws = ws_kmh / 3.6;
  const vaporPressure = (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
  return ta + 0.348 * vaporPressure - 0.70 * 0.75 * ws + 0.70 * 0.02 * sr / (ws * 0.75 + 10) - 4.25;
}

function parseBOMTime(bomTime: string): string {
  return `${bomTime.slice(0,4)}-${bomTime.slice(4,6)}-${bomTime.slice(6,8)}T${bomTime.slice(8,10)}:${bomTime.slice(10,12)}`;
}

function findClosestSR(targetTime: string, srMap: Record<string, number>): number {
  if (srMap[targetTime]) return srMap[targetTime];
  const target = new Date(targetTime);
  for (let offset of [-15, 15, -30, 30]) {
    const adjusted = new Date(target.getTime() + offset * 60000);
    const key = adjusted.toISOString().slice(0, 19);
    if (srMap[key]) return srMap[key];
  }
  return 0;
}

// --- Fetch functions ---
async function fetchPastObservations() {
  const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&minutely_15=shortwave_radiation_instant&timezone=Australia%2FSydney&past_days=3`;
  const bomUrl = "https://www.bom.gov.au/fwo/IDN60801/IDN60801.95765.json";
  const [srResponse, bomResponse] = await Promise.all([
    fetch(srUrl),
    fetch(bomUrl)
  ]);
  return {
    srData: await srResponse.json(),
    bomData: await bomResponse.json()
  };
}

async function fetchForecast() {
  const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=cloud_cover,shortwave_radiation,uv_index&timezone=GMT&forecast_days=3`;
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=us_aqi,pm10,pm2_5&timezone=GMT&forecast_days=3`;
  const bomUrl = `https://api.weather.bom.gov.au/v1/locations/${BOM_LOCATION_ID}/forecasts/hourly`;
  const [srResponse, aqResponse, bomResponse] = await Promise.all([
    fetch(srUrl),
    fetch(aqUrl),
    fetch(bomUrl)
  ]);
  return {
    srData: await srResponse.json(),
    aqData: await aqResponse.json(),
    bomData: await bomResponse.json()
  };
}

// --- Parsing functions ---
function parsePastData(srData: any, bomData: any) {
  const results = [];
  const observations = bomData?.observations?.data || [];
  const srTimes = srData?.minutely_15?.time || [];
  const srValues = srData?.minutely_15?.shortwave_radiation_instant || [];

  const srMap: Record<string, number> = {};
  srTimes.forEach((time: string, idx: number) => {
    srMap[time] = srValues[idx];
  });

  const recentObs = observations.slice(0, 24);

  recentObs.forEach((obs: any) => {
    const timestamp = obs.local_date_time_full;
    const ta = obs.air_temp;
    const rh = obs.rel_hum;
    const ws_kmh = obs.wind_spd_kmh || 0;
    const isoTime = parseBOMTime(timestamp);
    const sr = findClosestSR(isoTime, srMap);

    const esi = calculateESI(ta, rh, sr);
    const wbgt = calculateWBGT(esi);
    const at = calculateAT(ta, rh, ws_kmh, sr);

    results.push({
      timestamp: isoTime,
      temperature: ta,
      humidity: rh,
      wind_speed_kmh: ws_kmh,
      solar_radiation: sr,
      esi: parseFloat(esi.toFixed(2)),
      wbgt: parseFloat(wbgt.toFixed(2)),
      apparent_temp: parseFloat(at.toFixed(2))
    });
  });

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

  const srMap: Record<string, number> = {};
  const cloudMap: Record<string, number> = {};
  const uvMap: Record<string, number> = {};
  srTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    srMap[hourKey] = srValues[idx];
    cloudMap[hourKey] = srClouds[idx];
    uvMap[hourKey] = srUV[idx];
  });

  const aqiMap: Record<string, number> = {};
  const pm25Map: Record<string, number> = {};
  const pm10Map: Record<string, number> = {};
  aqTimes.forEach((time: string, idx: number) => {
    const hourKey = time.substring(0, 13);
    aqiMap[hourKey] = aqAQI[idx];
    pm25Map[hourKey] = aqPM25[idx];
    pm10Map[hourKey] = aqPM10[idx];
  });

  forecasts.forEach((forecast: any) => {
    const timestamp = forecast.time;
    const ta = forecast.temp;
    const rh = forecast.relative_humidity;
    const ws_kmh = forecast.wind?.speed_kilometre || 0;
    const hourKey = timestamp.substring(0, 13);
    const sr = srMap[hourKey] || 0;
    const cloud = cloudMap[hourKey] || 0;
    const uv = uvMap[hourKey] || 0;

    const aqi = aqiMap[hourKey] || 0;
    const pm25 = pm25Map[hourKey] || 0;
    const pm10 = pm10Map[hourKey] || 0;

    const esi = calculateESI(ta, rh, sr);
    const wbgt = calculateWBGT(esi);
    const at = calculateAT(ta, rh, ws_kmh, sr);

    const result: any = {
      timestamp,
      temperature: ta,
      humidity: rh,
      wind_speed_kmh: ws_kmh,
      solar_radiation: sr,
      cloud_cover: cloud,
      uv_index: parseFloat(uv.toFixed(1)),
      wbgt: parseFloat(wbgt.toFixed(1)),
      apparent_temp: parseFloat(at.toFixed(1)),
      rain_amount: forecast.rain?.amount || 0,
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
      {}, // no parameters
      async () => {
        const { srData, bomData } = await fetchPastObservations();
        const observations = parsePastData(srData, bomData);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              data: observations[0],
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

    // Tool 3: Get WBGT observations (past 24h)
    this.server.tool(
      "get_wbgt_observations",
      {},
      async () => {
        const { srData, bomData } = await fetchPastObservations();
        const observations = parsePastData(srData, bomData);
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              data: observations,
              count: observations.length,
              note: "Past 24-hour WBGT observations"
            }, null, 2)
          }]
        };
      }
    );
  }
}

// --- HTTP Handler ---
export default {
  fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // Claude expects this /sse endpoint for remote MCP servers
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return WBGTServerMCP.serveSSE("/sse").fetch(request, env, ctx);
    }
    if (url.pathname === "/mcp") {
      return WBGTServerMCP.serve("/mcp").fetch(request, env, ctx);
    }
    return new Response("Not found", { status: 404 });
  },
};
