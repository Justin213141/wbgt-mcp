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
  calculateWBGT,
  calculateEWBGT,
  calculateAT,
} from './calculations';

// --- Type Definitions ---
interface SRData {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    relative_humidity_2m?: number[];
    dew_point_2m?: number[];
    wet_bulb_temperature_2m?: number[];
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
    wet_bulb_temperature_2m?: number[];
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

// --- Calculation functions ---
export function calculateVaporPressure(ta: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
}

// --- Kong WBGT Calculation Functions ---

/**
 * Calculate solar zenith angle using astronomical formulas
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp (in Sydney local time YYYYMMDDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngle(lat: number, lon: number, timestamp: string): number {
  // Parse Sydney local time components - timestamps from Archive API are in local time format
  // Format: "2025-10-11T08:00" (Sydney local time, NOT UTC)
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Determine Sydney DST status
  // Sydney uses EDT (UTC+11) from first Sunday in October to first Sunday in April
  // UTC+10 (EST) from first Sunday in April to first Sunday in October
  // For 2025: EDT is Oct 5 - Apr 6, so Oct 11 is EDT (UTC+11)
  const isDST = month >= 10 || month <= 3;
  const sydneyUTCOffset = isDST ? 11 : 10;

  // Convert Sydney local time to UTC
  // Sydney local = UTC + offset, so UTC = Sydney local - offset (in hours)
  let utcHour = hour - sydneyUTCOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // Days in previous month
      const isLeapYear = (utcYear % 4 === 0 && utcYear % 100 !== 0) || utcYear % 400 === 0;
      const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      utcDay = daysInMonth[utcMonth - 1];
    }
  }

  // Create UTC date
  const utcDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, minute));

  // Calculate day of year for UTC date
  const jan1UTC = new Date(Date.UTC(utcYear, 0, 1));
  const msPerDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.ceil((utcDate.getTime() - jan1UTC.getTime()) / msPerDay);

  // Decimal hour in UTC
  const decimalHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;

  // Solar declination (degrees) - using Cooper's equation
  const B = (360 / 365.25) * (dayOfYear - 81) * Math.PI / 180;
  const decl = 23.45 * Math.sin(B);

  // Equation of Time (minutes) - corrects for Earth's elliptical orbit
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Hour angle (degrees) - 15 degrees per hour from solar noon
  const solarTime = decimalHour + lon / 15 + EoT / 60; // Local solar time with EoT correction
  const hourAngle = 15 * (solarTime - 12);

  // Convert to radians
  const latRad = lat * Math.PI / 180;
  const declRad = decl * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;

  // Solar elevation angle
  const sinElev = Math.sin(latRad) * Math.sin(declRad) +
                  Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad);
  const elevRad = Math.asin(Math.max(-1, Math.min(1, sinElev)));

  // Solar zenith angle
  const zenithRad = Math.PI / 2 - elevRad;
  const zenithDeg = zenithRad * 180 / Math.PI;

  return Math.max(0, Math.min(180, zenithDeg));
}

/**
 * Calculate solar zenith angle using astronomical formulas (JST/Tokyo timezone)
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp (in Japan Standard Time YYYYMMDDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngleJST(lat: number, lon: number, timestamp: string): number {
  // Parse JST local time components - timestamps from Archive API with Asia/Tokyo timezone
  // Format: "2025-10-11T08:00" (JST local time, NOT UTC)
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Japan uses JST (UTC+9) year-round - no daylight saving time
  const jstUTCOffset = 9;

  // Convert JST local time to UTC
  // JST local = UTC + 9, so UTC = JST local - 9 (in hours)
  let utcHour = hour - jstUTCOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // Days in previous month
      const isLeapYear = (utcYear % 4 === 0 && utcYear % 100 !== 0) || utcYear % 400 === 0;
      const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      utcDay = daysInMonth[utcMonth - 1];
    }
  }

  // Create UTC date
  const utcDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, minute));

  // Calculate day of year for UTC date
  const jan1UTC = new Date(Date.UTC(utcYear, 0, 1));
  const msPerDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.ceil((utcDate.getTime() - jan1UTC.getTime()) / msPerDay);

  // Decimal hour in UTC
  const decimalHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;

  // Solar declination (degrees) - using Cooper's equation
  const B = (360 / 365.25) * (dayOfYear - 81) * Math.PI / 180;
  const declRad = (0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00111 * Math.sin(3 * B));

  // Hour angle (degrees per hour = 360/24 = 15)
  const hourAngleDeg = (decimalHour - 12) * 15 + lon;
  const hourAngleRad = hourAngleDeg * Math.PI / 180;

  // Latitude in radians
  const latRad = lat * Math.PI / 180;

  // Zenith angle calculation
  const zenithRad = Math.acos(Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad));
  const zenithDeg = zenithRad * 180 / Math.PI;

  return Math.max(0, Math.min(180, zenithDeg));
}

/**
 * Calculate saturation vapor pressure using Magnus formula
 * @param T Temperature in Celsius
 * @returns Saturation vapor pressure in Pa
 */
export function calculateBuckSaturationVaporPressure(T: number): number {
  // Magnus formula: esat(T) = 6.1121 * exp((17.502 * T) / (240.97 + T)) hPa
  // Convert to Pa by multiplying by 100
  return 6.1121 * Math.exp((17.502 * T) / (240.97 + T)) * 100;
}

/**
 * Calculate derivative of saturation vapor pressure with respect to temperature
 * d(esat)/dT in Pa/K
 */
export function calculateVaporPressureDerivative(T: number): number {
  const a = 17.502;
  const b = 240.97;
  const esat = calculateBuckSaturationVaporPressure(T);

  // d(esat)/dT = esat * a * b / (b + T)^2 in Pa/K
  return esat * a * b / Math.pow(b + T, 2);  // esat is in Pa, result in Pa/K
}

/**
 * Calculate air properties at given temperature and pressure
 * Returns: density (kg/m³), dynamic viscosity (Pa·s), thermal conductivity (W/(m·K)),
 *          Prandtl number, Schmidt number, diffusivity (m²/s)
 */
export function calculateAirProperties(Ta_K: number, P_Pa: number): {
  rho: number;
  mu: number;
  k: number;
  Pr: number;
  Sc: number;
  D: number;
} {
  // Density using ideal gas law: ρ = P / (R * T)
  const rho = P_Pa / (GAS_CONSTANT_AIR * Ta_K);

  // Dynamic viscosity using Sutherland's formula
  // μ = μ0 * (T/T0)^1.5 * (T0 + S) / (T + S)
  const T0 = 273.15;
  const mu0 = 1.73e-5; // Pa·s at 273.15 K
  const S = 110.4; // Sutherland constant for air
  const mu = mu0 * Math.pow(Ta_K / T0, 1.5) * (T0 + S) / (Ta_K + S);

  // Thermal conductivity using polynomial approximation
  // k ≈ 0.02411 + 0.0000773*(T-273.15) W/(m·K)
  const Ta_C = Ta_K - 273.15;
  const k = 0.02411 + 0.0000773 * Ta_C;

  // Prandtl number (dimensionless)
  const cp = 1005; // J/(kg·K) for air at standard conditions
  const Pr = (cp * mu) / k;

  // Thermal diffusivity
  const alpha = k / (rho * cp);

  // Schmidt number (kinematic viscosity / mass diffusivity)
  // For air-water vapor: Sc ≈ 0.6 (approximately)
  // D (mass diffusivity) = μ / (ρ * Sc)
  const Sc = 0.60;
  const D = mu / (rho * Sc);

  return { rho, mu, k, Pr, Sc, D };
}

/**
 * Calculate wind speed at 2m from wind speed at 10m
 */
export function calculateWindAt2m(u10m: number, p: number = 0.15): number {
  return u10m * Math.pow(2 / 10, p);
}

/**
 * Calculate radiation components received by globe and wick
 */
export function calculateRadiationComponents(
  Ta: number,
  SRdown: number,
  Direct: number,
  Diffuse: number,
  ea: number,
  theta_deg: number
): { SRg: number; LRg: number; SRw: number; LRw: number } {
  const theta_rad = theta_deg * Math.PI / 180;

  // Atmospheric emissivity
  const ea_hPa = ea / 100;
  const emissivity_atm = 0.575 * Math.pow(ea_hPa, 0.143);

  // Direct beam fraction
  const fdir = Direct > 0 ? Direct / (Direct + Diffuse) : 0;

  // Reflected shortwave radiation
  const SRup = SURFACE_ALBEDO * SRdown;

  // Longwave radiation
  const Ta_K = Ta + 273.15;
  const LRdown = emissivity_atm * STEFAN_BOLTZMANN * Math.pow(Ta_K, 4);
  const LRup = STEFAN_BOLTZMANN * Math.pow(Ta_K, 4);

  // Shortwave on globe (0.5 sphere, receiving from sky and ground)
  const cosTheta = Math.cos(theta_rad);
  const denom = Math.max(0.1, cosTheta);

  const SRg = 0.5 * (1 - GLOBE_ALBEDO) * [
    (1 - fdir) * SRdown,
    fdir * SRdown / (2 * denom),
    SRup
  ].reduce((a, b) => a + b, 0);

  // Longwave on globe
  const LRg = 0.5 * GLOBE_EMISSIVITY * (LRdown + LRup);

  // Shortwave on wick (0.5 cylinder with specified albedo and geometry)
  // From Kong paper equation
  const SRw = (1 - WICK_ALBEDO) * [
    (1 + 0.007 / (4 * WICK_LENGTH)) * (1 - fdir) * SRdown,
    (Math.tan(theta_rad) / Math.PI + 0.007 / (4 * WICK_LENGTH)) * fdir * SRdown,
    SRup
  ].reduce((a, b) => a + b, 0);

  // Longwave on wick
  const LRw = 0.5 * WICK_EMISSIVITY * (LRdown + LRup);

  return { SRg, LRg, SRw, LRw };
}

/**
 * Calculate heat transfer coefficients for globe and wick
 */
export function calculateHeatTransferCoefficients(
  Ta: number,
  Tw: number,
  P_Pa: number,
  u2m: number,
  airProps: ReturnType<typeof calculateAirProperties>
): {
  h_cg: number;
  h_rg: number;
  h_cw: number;
  h_rw: number;
  h_ew: number;
  beta: number;
} {
  const { rho, mu, k, Pr, Sc, D } = airProps;
  const Ta_K = Ta + 273.15;

  // --- Globe heat transfer ---
  // Reynolds number for sphere
  const Re_globe = (rho * u2m * GLOBE_DIAMETER) / mu;

  // Nusselt number (Churchill correlation for sphere)
  const Nu_globe = 2.0 + 0.6 * Math.pow(Re_globe, 0.5) * Math.pow(Pr, 1/3);

  // Convective heat transfer coefficient
  const h_cg = (k / GLOBE_DIAMETER) * Nu_globe;

  // Radiative heat transfer coefficient (linearized)
  const h_rg = 4 * STEFAN_BOLTZMANN * GLOBE_EMISSIVITY * Math.pow(Ta_K, 3);

  // --- Wick heat transfer ---
  // Reynolds number for cylinder
  const Re_wick = (rho * u2m * WICK_DIAMETER) / mu;

  // Nusselt number (Morgan correlation for cylinder)
  const C_cylinder = 0.281;
  const m_cylinder = 0.6;
  const Nu_wick = C_cylinder * Math.pow(Re_wick, m_cylinder) * Math.pow(Pr, 1/3);

  // Convective heat transfer coefficient
  const h_cw = (k / WICK_DIAMETER) * Nu_wick;

  // Radiative heat transfer coefficient
  const h_rw = 4 * STEFAN_BOLTZMANN * WICK_EMISSIVITY * Math.pow(Ta_K, 3);

  // --- Evaporative heat transfer ---
  // Mass transfer coefficient (WBGT.md line 102)
  // k̂x = (ρD/MD) × b × Re^(1-c) × Sc^(1-a)
  // Where D (in numerator) = diffusivity, MD (in denominator) = M_air × Diameter
  const kx = (rho * D / (MOLECULAR_WEIGHT_AIR * WICK_DIAMETER)) * C_cylinder * Math.pow(Re_wick, m_cylinder) * Math.pow(Sc, 1/3);

  // Psychrometric coefficient (WBGT.md line 80)
  // β̂ = k̂x × MH₂O × ΔH / P
  const beta = kx * MOLECULAR_WEIGHT_WATER * LATENT_HEAT / P_Pa;

  // Vapor pressure derivative at mean wick temperature
  const Tw_mean = (Tw + Ta) / 2;
  const desat_dT = calculateVaporPressureDerivative(Tw_mean);

  const h_ew = beta * desat_dT;

  return { h_cg, h_rg, h_cw, h_rw, h_ew, beta };
}

/**
 * Calculate Kong black globe temperature
 */
export function calculateKongBlackGlobe(
  Ta: number,
  SRg: number,
  LRg: number,
  h_cg: number,
  h_rg: number
): number {
  const Ta_K = Ta + 273.15;

  // Numerator: shortwave + longwave radiation
  const numerator = SRg + LRg - STEFAN_BOLTZMANN * GLOBE_EMISSIVITY * Math.pow(Ta_K, 4);

  // Denominator: total heat transfer coefficient
  const denominator = h_cg + h_rg;

  if (denominator === 0) return Ta;

  const T_g_K = Ta_K + numerator / denominator;
  return T_g_K - 273.15;
}

/**
 * Calculate Kong natural wet bulb temperature
 */
export function calculateKongNaturalWetBulb(
  Ta: number,
  Tw: number,
  SRw: number,
  LRw: number,
  ea: number,
  h_cw: number,
  h_rw: number,
  h_ew: number,
  beta: number,
  P_Pa: number
): number {
  const Ta_K = Ta + 273.15;
  const Tw_K = Tw + 273.15;

  // Saturation vapor pressure at air temperature and wick temperature
  const e_sat_Ta = calculateBuckSaturationVaporPressure(Ta);
  const e_sat_Tw = calculateBuckSaturationVaporPressure(Tw);

  // Psychrometric equation term
  const psych_term = beta * (e_sat_Ta - ea);

  // Radiation balance per Kong zero-iteration formula (WBGT.md line 66)
  // Uses Ta⁴ as linearization point (not Tnw⁴)
  const rad_balance = SRw + LRw - STEFAN_BOLTZMANN * WICK_EMISSIVITY * Math.pow(Ta_K, 4);

  // Numerator: net radiation minus psychrometric cooling
  const numerator = rad_balance - psych_term;

  // Denominator: total heat transfer coefficient
  const denominator = h_ew + h_cw + h_rw;

  if (denominator === 0) return Ta;

  const T_nw_K = Ta_K + numerator / denominator;
  return T_nw_K - 273.15;
}

/**
 * Calculate Kong WBGT using zero-iteration method
 */
export function calculateKongWBGT(Ta: number, T_g: number, T_nw: number): number {
  // ŴBGT = 0.7 × T̂nw + 0.2 × T̂g + 0.1 × Ta
  return 0.7 * T_nw + 0.2 * T_g + 0.1 * Ta;
}

/**
 * Calculate Environmental Stress Index (ESI)
 * ESI = 0.62*Ta - 0.007*RH + 0.002*SR + 0.0043*(Ta*RH) - 0.078/(0.1+SR)
 * @param Ta Temperature in Celsius
 * @param RH Relative humidity in percent
 * @param SR Solar radiation in W/m²
 * @returns Environmental Stress Index
 */
export function calculateESI(Ta: number, RH: number, SR: number): number {
  // ESI = 0.62*Ta - 0.007*RH + 0.002*SR + 0.0043*(Ta*RH) - 0.078/(0.1+SR)
  return 0.62 * Ta - 0.007 * RH + 0.002 * SR + 0.0043 * (Ta * RH) - 0.078 / (0.1 + SR);
}

/**
 * Complete Kong WBGT calculation pipeline for a single data point
 */
export function calculateKongWBGTPipeline(
  Ta: number,
  Tw: number,
  RH: number,
  P_hPa: number,
  u10m: number,
  SRdown: number,
  SRdirect: number,
  SRdiffuse: number,
  lat: number,
  lon: number,
  timestamp: string
): {
  kong_wbgt: number;
  black_globe_temp: number;
  natural_wet_bulb_temp: number;
  solar_zenith_angle: number;
  esi: number;
  intermediate: {
    vapor_pressure: number;
    atmospheric_emissivity: number;
    direct_fraction: number;
  };
} {
  // Step 1: Solar geometry
  const theta_deg = calculateSolarZenithAngle(lat, lon, timestamp);

  // Validation: If sun is below horizon (zenith > 90°), radiation should be zero
  const isSunAboveHorizon = theta_deg <= 90;
  const SRdown_valid = isSunAboveHorizon ? SRdown : 0;
  const SRdirect_valid = isSunAboveHorizon ? SRdirect : 0;
  const SRdiffuse_valid = isSunAboveHorizon ? SRdiffuse : 0;

  // Step 2: Atmospheric parameters
  const Ta_K = Ta + 273.15;
  const P_Pa = P_hPa * 100;

  // Actual vapor pressure from relative humidity
  const esat_Ta = calculateBuckSaturationVaporPressure(Ta);
  const ea_actual = (RH / 100) * esat_Ta;

  const ea_hPa = ea_actual / 100;
  const emissivity_atm = 0.575 * Math.pow(ea_hPa, 0.143);
  const fdir = SRdirect_valid > 0 ? SRdirect_valid / (SRdirect_valid + SRdiffuse_valid) : 0;

  // Step 3: Radiation components
  const { SRg, LRg, SRw, LRw } = calculateRadiationComponents(
    Ta,
    SRdown_valid,
    SRdirect_valid,
    SRdiffuse_valid,
    ea_actual,
    theta_deg
  );

  // Step 4: Air properties at Ta and P
  const u2m = calculateWindAt2m(u10m);
  const airProps = calculateAirProperties(Ta_K, P_Pa);

  // Step 5: Heat transfer coefficients
  const coefficients = calculateHeatTransferCoefficients(
    Ta,
    Tw,
    P_Pa,
    u2m,
    airProps
  );

  // Step 6: Temperature calculations
  const T_g = calculateKongBlackGlobe(
    Ta,
    SRg,
    LRg,
    coefficients.h_cg,
    coefficients.h_rg
  );

  const T_nw = calculateKongNaturalWetBulb(
    Ta,
    Tw,
    SRw,
    LRw,
    ea_actual,
    coefficients.h_cw,
    coefficients.h_rw,
    coefficients.h_ew,
    coefficients.beta,
    P_Pa
  );

  // Step 7: Final WBGT
  const wbgt = calculateKongWBGT(Ta, T_g, T_nw);

  // Step 8: Environmental Stress Index (ESI)
  const esi = calculateESI(Ta, RH, SRdown);

  return {
    kong_wbgt: wbgt,
    black_globe_temp: T_g,
    natural_wet_bulb_temp: T_nw,
    solar_zenith_angle: theta_deg,
    esi: esi,
    intermediate: {
      vapor_pressure: ea_actual,
      atmospheric_emissivity: emissivity_atm,
      direct_fraction: fdir
    }
  };
}

export function calculateKongWBGTPipelineJST(
  Ta: number,
  Tw: number,
  RH: number,
  P_hPa: number,
  u10m: number,
  SRdown: number,
  SRdirect: number,
  SRdiffuse: number,
  lat: number,
  lon: number,
  timestamp: string
): {
  kong_wbgt: number;
  black_globe_temp: number;
  natural_wet_bulb_temp: number;
  solar_zenith_angle: number;
  esi: number;
  intermediate: {
    vapor_pressure: number;
    atmospheric_emissivity: number;
    direct_fraction: number;
  };
} {
  // Step 1: Solar geometry (using JST timezone)
  const theta_deg = calculateSolarZenithAngleJST(lat, lon, timestamp);

  // Validation: If sun is below horizon (zenith > 90°), radiation should be zero
  const isSunAboveHorizon = theta_deg <= 90;
  const SRdown_valid = isSunAboveHorizon ? SRdown : 0;
  const SRdirect_valid = isSunAboveHorizon ? SRdirect : 0;
  const SRdiffuse_valid = isSunAboveHorizon ? SRdiffuse : 0;

  // Step 2: Atmospheric parameters
  const Ta_K = Ta + 273.15;
  const P_Pa = P_hPa * 100;

  // Actual vapor pressure from relative humidity
  const esat_Ta = calculateBuckSaturationVaporPressure(Ta);
  const ea_actual = (RH / 100) * esat_Ta;

  const ea_hPa = ea_actual / 100;
  const emissivity_atm = 0.575 * Math.pow(ea_hPa, 0.143);
  const fdir = SRdirect_valid > 0 ? SRdirect_valid / (SRdirect_valid + SRdiffuse_valid) : 0;

  // Step 3: Radiation components
  const { SRg, LRg, SRw, LRw } = calculateRadiationComponents(
    Ta,
    SRdown_valid,
    SRdirect_valid,
    SRdiffuse_valid,
    ea_actual,
    theta_deg
  );

  // Step 4: Air properties at Ta and P
  const u2m = calculateWindAt2m(u10m);
  const airProps = calculateAirProperties(Ta_K, P_Pa);

  // Step 5: Heat transfer coefficients
  const coefficients = calculateHeatTransferCoefficients(
    Ta,
    Tw,
    P_Pa,
    u2m,
    airProps
  );

  // Step 6: Temperature calculations
  const T_g = calculateKongBlackGlobe(
    Ta,
    SRg,
    LRg,
    coefficients.h_cg,
    coefficients.h_rg
  );

  const T_nw = calculateKongNaturalWetBulb(
    Ta,
    Tw,
    SRw,
    LRw,
    ea_actual,
    coefficients.h_cw,
    coefficients.h_rw,
    coefficients.h_ew,
    coefficients.beta,
    P_Pa
  );

  // Step 7: Final WBGT
  const wbgt = calculateKongWBGT(Ta, T_g, T_nw);

  // Step 8: Environmental Stress Index (ESI)
  const esi = calculateESI(Ta, RH, SRdown);

  return {
    kong_wbgt: wbgt,
    black_globe_temp: T_g,
    natural_wet_bulb_temp: T_nw,
    solar_zenith_angle: theta_deg,
    esi: esi,
    intermediate: {
      vapor_pressure: ea_actual,
      atmospheric_emissivity: emissivity_atm,
      direct_fraction: fdir
    }
  };
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

// --- Kong WBGT Data Fetching ---
// Wrapper function using unified fetcher (eliminates duplicate Sydney-specific logic)
async function fetchKongWBGT(
  startDate: string,
  endDate: string,
  latitude: number = SYDNEY_LAT,
  longitude: number = SYDNEY_LON
): Promise<any[]> {
  const fetcher = new HistoricalFetcher();
  return fetcher.fetchKongWBGTByTimezone(startDate, endDate, latitude, longitude, 10, true, 'Australia/Sydney');
}

async function fetchKongWBGTJapan(
  startDate: string,
  endDate: string,
  latitude: number,
  longitude: number
): Promise<any[]> {
  // Wrapper using unified fetcher (eliminates duplicate Japan-specific logic)
  const fetcher = new HistoricalFetcher();
  return fetcher.fetchKongWBGTByTimezone(startDate, endDate, latitude, longitude, 9, false, 'Asia/Tokyo');
}

// --- Fetch functions ---
async function fetchObservations(startDate?: string, endDate?: string): Promise<ObservationsResponse> {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  console.log('[FETCH OBS] startDate:', startDate, 'endDate:', endDate);
  console.log('[FETCH OBS] Fetching past 72 hours of observations');

  // Observations endpoint only returns past 72 hours - always fetch recent with Kong parameters
  const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wet_bulb_temperature_2m,surface_pressure,wind_speed_10m,cloud_cover,shortwave_radiation,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,uv_index&timezone=Australia%2FSydney&past_days=3`;
  const bomUrl = "https://www.bom.gov.au/fwo/IDN60801/IDN60801.95765.json";

  console.log('[FETCH OBS] Fetching from BOM and Open-Meteo...');
  const [srResponse, bomResponse] = await Promise.all([
    fetch(srUrl),
    fetch(bomUrl)
  ]);

  console.log('[FETCH OBS] Response statuses - SR:', srResponse.status, 'BOM:', bomResponse.status);

  return {
    type: 'recent',
    srData: await srResponse.json() as SRData,
    bomData: await bomResponse.json() as BOMData
  };
}

async function fetchForecast(): Promise<{ srData: SRData; aqData: AQData; bomData: BOMData }> {
  // TODO: Re-enable caching after debugging
  return await (async () => {
      const srUrl = `https://api.open-meteo.com/v1/forecast?latitude=${SYDNEY_LAT}&longitude=${SYDNEY_LON}&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,wet_bulb_temperature_2m,surface_pressure,wind_speed_10m,cloud_cover,shortwave_radiation,shortwave_radiation_instant,direct_radiation_instant,diffuse_radiation_instant,apparent_temperature,uv_index&timezone=UTC&forecast_days=3`;
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

      const srData = await srResponse.json() as SRData;
      const aqData = await aqResponse.json() as AQData;
      const bomData = await bomResponse.json() as BOMData;

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
  console.log('[GET MAX] Input - start:', startTime, 'end:', endTime);
  console.log('[GET MAX] Data count:', data.length);
  if (data.length > 0) {
    console.log('[GET MAX] First timestamp:', data[0]?.timestamp);
    console.log('[GET MAX] Last timestamp:', data[data.length - 1]?.timestamp);
  }

  // Convert ISO timestamps (Sydney local time) to DD/MM/YYYY, HH:MM:SS format for consistent comparison
  const convertISOToLocalFormat = (isoStr: string): string => {
    const [datePart, timePart] = isoStr.split('T');
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}, ${timePart}`;
  };

  const startFormatted = convertISOToLocalFormat(startTime);
  const endFormatted = convertISOToLocalFormat(endTime);

  console.log('[GET MAX] Converted start:', startFormatted);
  console.log('[GET MAX] Converted end:', endFormatted);

  const inRange = data.filter((d: any) => {
    // Both timestamps are now in same format, compare as strings
    // This works because YYYY-MM-DD format is lexicographically sortable
    const matches = d.timestamp >= startFormatted && d.timestamp <= endFormatted;
    if (matches || data.indexOf(d) < 3) {
      console.log(`[GET MAX] Record ${data.indexOf(d)}: ${d.timestamp} matches=${matches}`);
    }
    return matches;
  });

  console.log('[GET MAX] Filtered count:', inRange.length);
  if (inRange.length === 0) {
    console.log('[GET MAX] No records in range! Returning null');
    return null;
  }

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
  const omWetBulbs = data.srData?.hourly?.wet_bulb_temperature_2m || [];
  const omPressures = data.srData?.hourly?.surface_pressure || [];
  const omWindSpeeds = data.srData?.hourly?.wind_speed_10m || [];
  const omSRInstant = data.srData?.hourly?.shortwave_radiation_instant || [];
  const omSRDirect = data.srData?.hourly?.direct_radiation_instant || [];
  const omSRDiffuse = data.srData?.hourly?.diffuse_radiation_instant || [];
  const omApparentTemps = data.srData?.hourly?.apparent_temperature || [];
  const srClouds = data.srData?.hourly?.cloud_cover || [];
  const srUV = data.srData?.hourly?.uv_index || [];

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
    const bomTime = new Date(timestamp);
    const hourKey = `${bomTime.getUTCFullYear()}-${String(bomTime.getUTCMonth() + 1).padStart(2, '0')}-${String(bomTime.getUTCDate()).padStart(2, '0')}T${String(bomTime.getUTCHours()).padStart(2, '0')}`;

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
  const wetBulbs = weatherData?.hourly?.wet_bulb_temperature_2m || [];
  const pressures = weatherData?.hourly?.surface_pressure || [];
  const windSpeeds = weatherData?.hourly?.wind_speed_10m || [];
  const srInstant = weatherData?.hourly?.shortwave_radiation_instant || [];
  const srDirect = weatherData?.hourly?.direct_radiation_instant || [];
  const srDiffuse = weatherData?.hourly?.diffuse_radiation_instant || [];
  const apparentTemps = weatherData?.hourly?.apparent_temperature || [];
  const cloudCovers = weatherData?.hourly?.cloud_cover || [];

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
function buildOpenMeteoMaps(srData: SRData): { omMap: Record<string, any>; cloudMap: Record<string, number>; uvMap: Record<string, number> } {
  const omMap: Record<string, { idx: number; omData: any }> = {};
  const cloudMap: Record<string, number> = {};
  const uvMap: Record<string, number> = {};
  const srTimes = srData?.hourly?.time || [];

  // Extract all Open-Meteo fields
  const omTemps = srData?.hourly?.temperature_2m || [];
  const omHumidity = srData?.hourly?.relative_humidity_2m || [];
  const omDewpoints = srData?.hourly?.dew_point_2m || [];
  const omWetBulbs = srData?.hourly?.wet_bulb_temperature_2m || [];
  const omPressures = srData?.hourly?.surface_pressure || [];
  const omWindSpeeds = srData?.hourly?.wind_speed_10m || [];
  const omSRInstant = srData?.hourly?.shortwave_radiation_instant || [];
  const omSRDirect = srData?.hourly?.direct_radiation_instant || [];
  const omSRDiffuse = srData?.hourly?.diffuse_radiation_instant || [];
  const omApparentTemps = srData?.hourly?.apparent_temperature || [];
  const srClouds = srData?.hourly?.cloud_cover || [];
  const srUV = srData?.hourly?.uv_index || [];

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
  const omEntry = omMap[hourKey];

  if (!omEntry) {
    console.log(`[PARSE OBS] SKIPPING obs ${idx}: No Open-Meteo data for ${hourKey}`);
    return null;
  }

  const omData = omEntry.omData;
  const ta = obs.temp || omData.temp || 0;
  const rh = obs.relative_humidity || omData.humidity || 0;
  const ws_kmh = obs.wind?.speed_kilometre || (omData.wind_speed * 3.6) || 0;

  const e = calculateVaporPressure(ta, rh);
  const wbgt_esi = calculateWBGT(ta, rh, omData.sr_instant || 0);
  const at = calculateAT(ta, rh, ws_kmh, omData.sr_instant || 0);

  let wbgt_kong: number | null = null;
  try {
    const kongCalc = calculateKongWBGTPipeline(
      ta, omData.wet_bulb || 0, rh, omData.pressure || 0, omData.wind_speed || 0,
      omData.sr_instant || 0, omData.sr_direct || 0, omData.sr_diffuse || 0,
      SYDNEY_LAT, SYDNEY_LON, timestamp
    );
    wbgt_kong = kongCalc.kong_wbgt;
  } catch (error) {
    console.error(`[PARSE OBS] Error calculating Kong WBGT for ${timestamp}:`, error);
  }

  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-');

  return {
    timestamp: `${day}/${month}/${year}, ${timePart}`,
    temperature: parseFloat(ta.toFixed(1)),
    humidity: Math.round(rh),
    dew_point: parseFloat((obs.dew_point || omData.dewpoint || 0).toFixed(1)),
    wind_speed_ms: parseFloat((omData.wind_speed || 0).toFixed(2)),
    solar_radiation: parseFloat((omData.sr_instant || 0).toFixed(1)),
    cloud_cover: parseFloat((cloudMap[hourKey] || 0).toFixed(1)),
    uv_index: parseFloat((uvMap[hourKey] || 0).toFixed(1)),
    wbgt: wbgt_kong !== null ? parseFloat(wbgt_kong.toFixed(1)) : parseFloat(wbgt_esi.toFixed(1)),
    esi: parseFloat(wbgt_esi.toFixed(1)),
    apparent_temp: parseFloat(at.toFixed(1))
  };
}

function parseObservationsKong(srData: SRData, bomData: BOMData, startTime?: string, endTime?: string): any[] {
  console.log('[PARSE OBS] Called with startTime:', startTime, 'endTime:', endTime);
  const bomObs = bomData?.observations?.data || [];
  const { omMap, cloudMap, uvMap } = buildOpenMeteoMaps(srData);

  console.log('[PARSE OBS] Processing', bomObs.length, 'BOM observations');

  const results: any[] = bomObs
    .map((obs: any, idx: number) => {
      const timestamp = normalizeBOMTimestamp(obs.local_date_time);
      return processBOMObservationKong(obs, timestamp, omMap, cloudMap, uvMap, idx);
    })
    .filter((result): result is any => result !== null);

  // Apply time range filter if specified
  if (startTime && endTime) {
    const maxInRange = getMaxInRange(results, startTime, endTime);
    return maxInRange ? [maxInRange] : [];
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

// Helper function to process single forecast with Kong WBGT
function processForecast(forecast: any, timestamp: string, omMap: Record<string, any>, cloudMap: Record<string, number>, uvMap: Record<string, number>): any | null {
  const hourKey = timestamp.substring(0, 13);
  const omEntry = omMap[hourKey];

  if (!omEntry) {
    console.log(`[PARSE] Warning: No Open-Meteo data for ${hourKey}`);
    return null;
  }

  const omData = omEntry.omData;
  const ta = forecast.temp || omData.temp || 0;
  const rh = forecast.relative_humidity || omData.humidity || 0;
  const ws_kmh = forecast.wind?.speed_kilometre || (omData.wind_speed * 3.6) || 0;

  const wbgt_esi = calculateWBGT(ta, rh, omData.sr_instant || 0);
  const at = calculateAT(ta, rh, ws_kmh, omData.sr_instant || 0);

  let wbgt_kong: number | null = null;
  try {
    const kongCalc = calculateKongWBGTPipeline(
      ta, omData.wet_bulb || 0, rh, omData.pressure || 0, omData.wind_speed || 0,
      omData.sr_instant || 0, omData.sr_direct || 0, omData.sr_diffuse || 0,
      SYDNEY_LAT, SYDNEY_LON, timestamp
    );
    wbgt_kong = kongCalc.kong_wbgt;
  } catch (error) {
    console.error(`[PARSE] Error calculating Kong WBGT for ${timestamp}:`, error);
  }

  const localTimestamp = new Date(timestamp).toLocaleString('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });

  return {
    localTimestamp,
    temperature: parseFloat(ta.toFixed(1)),
    humidity: Math.round(rh),
    dew_point: parseFloat((forecast.dewpoint || omData.dewpoint || 0).toFixed(1)),
    wind_speed_ms: parseFloat((omData.wind_speed || 0).toFixed(2)),
    solar_radiation: parseFloat((omData.sr_instant || 0).toFixed(1)),
    cloud_cover: parseFloat((cloudMap[hourKey] || 0).toFixed(1)),
    uv_index: parseFloat((uvMap[hourKey] || 0).toFixed(1)),
    wbgt: wbgt_kong !== null ? parseFloat(wbgt_kong.toFixed(1)) : parseFloat(wbgt_esi.toFixed(1)),
    esi: parseFloat(wbgt_esi.toFixed(1)),
    apparent_temp: parseFloat(at.toFixed(1)),
    rain_chance: forecast.rain?.chance || 0
  };
}

function parseForecastData(srData: SRData, aqData: AQData, bomData: BOMData): any[] {
  const forecasts = bomData?.data || [];
  const { omMap, cloudMap, uvMap } = buildOpenMeteoMaps(srData);

  console.log('[PARSE] Processing', forecasts.length, 'forecasts');

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
      "Get 72-hour WBGT forecast for Sydney including solar radiation, cloud cover, UV index, and air quality",
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

    // Tool 3: Get WBGT observations (past 72 hours using Kong method)
    const observationsSchema: Record<string, any> = {
      start_time: z.string()
        .optional()
        .describe("Optional start time in ISO format for activity-specific WBGT maximum"),
      end_time: z.string()
        .optional()
        .describe("Optional end time in ISO format. When both start_time and end_time provided, returns max WBGT values during the activity window"),
    };

    this.server.tool(
      "get_observations",
      "Get past 72 hours of WBGT observations for Sydney using Kong method. Can also calculate maximum WBGT during a specific activity time window",
      observationsSchema,
      async (params: any) => {
        const { start_time, end_time } = params;
        const data = await fetchObservations();
        const observations = parseObservationsKong(data.srData!, data.bomData!, start_time, end_time);

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
              note
            }, null, 2)
          }]
        };
      }
    );

    // Tool 4: Get historical WBGT observations
    const historicObservationsSchema: Record<string, any> = {
      start_date: z.string()
        .describe("Start date in YYYY-MM-DD format (required)"),
      end_date: z.string()
        .describe("End date in YYYY-MM-DD format (required, cannot be today - data not uploaded yet)"),
      latitude: z.number()
        .optional()
        .describe("Optional latitude (default: -33.8018 for Sydney)"),
      longitude: z.number()
        .optional()
        .describe("Optional longitude (default: 151.1254 for Sydney)"),
    };

    this.server.tool(
      "get_historic_observations",
      "Get historical WBGT observations using Kong method with detailed radiation and heat transfer modeling. Supports custom locations.",
      historicObservationsSchema,
      async (params: any) => {
        const { start_date, end_date, latitude, longitude } = params;
        const lat = latitude || SYDNEY_LAT;
        const lon = longitude || SYDNEY_LON;

        try {
          const kongData = await fetchKongWBGT(start_date, end_date, lat, lon);

          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                success: true,
                data: kongData,
                count: kongData.length,
                location: { latitude: lat, longitude: lon },
                note: "Kong WBGT historical observations using zero-iteration method with detailed radiation and heat transfer modeling"
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
  const data = await fetchObservations();
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
  const { srData, aqData, bomData } = await fetchForecast();
  const forecast = parseForecastData(srData, aqData, bomData);
  return jsonResponse({
    success: true,
    data: forecast,
    count: forecast.length,
    timestamp: new Date().toISOString(),
    note: 'WBGT forecast (72 hours)'
  }, 200, corsHeaders);
}

// Handler: GET /api/observations
async function handleGetObservations(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const start_time = url.searchParams.get('start_time') || undefined;
  const end_time = url.searchParams.get('end_time') || undefined;
  const data = await fetchObservations();
  const observations = parseObservationsKong(data.srData!, data.bomData!, start_time || undefined, end_time || undefined);
  return jsonResponse({
    success: true,
    data: observations,
    count: observations.length,
    timestamp: new Date().toISOString(),
    note: start_time ? `Max WBGT conditions during activity from ${start_time} to ${end_time}` : "Past 72-hour WBGT observations (Kong method)"
  }, 200, corsHeaders);
}

// Handler: GET /api/historic_observations
async function handleGetHistoricObservations(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : SYDNEY_LAT;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : SYDNEY_LON;

  if (!start_date || !end_date) {
    return errorResponse(
      'MISSING_REQUIRED_PARAMETERS',
      'Missing required parameters: start_date and end_date',
      400,
      corsHeaders,
      {
        required: ['start_date', 'end_date'],
        optional: ['latitude', 'longitude'],
        format: 'YYYY-MM-DD',
        note: 'end_date cannot be today'
      },
      url.pathname
    );
  }

  try {
    const kongData = await fetchKongWBGT(start_date, end_date, latitude, longitude);
    return jsonResponse({
      success: true,
      data: kongData,
      count: kongData.length,
      timestamp: new Date().toISOString(),
      location: { latitude, longitude }
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
        dateRange: { start_date, end_date }
      },
      url.pathname
    );
  }
}

// Handler: GET /api/historic_observations_japan
async function handleGetHistoricJapan(url: URL, corsHeaders: Record<string, string>): Promise<Response> {
  const start_date = url.searchParams.get('start_date');
  const end_date = url.searchParams.get('end_date');
  const latitude = url.searchParams.get('latitude') ? parseFloat(url.searchParams.get('latitude')!) : null;
  const longitude = url.searchParams.get('longitude') ? parseFloat(url.searchParams.get('longitude')!) : null;

  if (!start_date || !end_date || latitude === null || longitude === null) {
    return errorResponse(
      'MISSING_REQUIRED_PARAMETERS',
      'Missing required parameters for Japan location',
      400,
      corsHeaders,
      {
        required: ['start_date', 'end_date', 'latitude', 'longitude'],
        format: 'YYYY-MM-DD for dates',
        examples: {
          latitude: 35.6762,
          longitude: 139.6503,
          start_date: '2025-10-01',
          end_date: '2025-10-26'
        }
      },
      url.pathname
    );
  }

  try {
    const kongData = await fetchKongWBGTJapan(start_date, end_date, latitude, longitude);
    return jsonResponse({
      success: true,
      data: kongData,
      count: kongData.length,
      timestamp: new Date().toISOString(),
      location: { latitude, longitude },
      timezone: 'JST (UTC+9)'
    }, 200, corsHeaders);
  } catch (error: any) {
    return errorResponse(
      'FETCH_FAILED',
      'Failed to fetch historic observations for Japan',
      500,
      corsHeaders,
      {
        reason: error?.message || 'Unknown error',
        location: { latitude, longitude },
        dateRange: { start_date, end_date },
        timezone: 'JST (UTC+9)'
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
      responses:
        '200':
          description: WBGT observations retrieved successfully
  /api/v1/historic_observations:
    get:
      summary: Get historical WBGT observations
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
      responses:
        '200':
          description: Historical WBGT observations retrieved successfully
  /api/v1/historic_observations_japan:
    get:
      summary: Get historical WBGT observations for Japan
      tags:
        - Historical Data
      responses:
        '200':
          description: Historical WBGT observations for Japan retrieved successfully`;

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
      'GET /api/current': 'Current WBGT conditions in Sydney',
      'GET /api/forecast': '72-hour WBGT forecast for Sydney',
      'GET /api/observations': 'Past 72-hour observations (Kong method)',
      'GET /api/historic_observations': 'Historical WBGT data (Kong method)',
      'GET /api/historic_observations_japan': 'Historical data for Japan (JST)',
      'GET /api/health': 'Health check'
    },
    documentation: {
      note: 'This is the recommended API version.',
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
    note: 'The /api/v1 path is deprecated. Please use /api instead.',
    endpoints: {
      'GET /api/current': 'Current WBGT conditions (RECOMMENDED)',
      'GET /api/forecast': '72-hour WBGT forecast (RECOMMENDED)',
      'GET /api/observations': 'Past 72-hour observations (RECOMMENDED)',
      'GET /api/historic_observations': 'Historical WBGT data (RECOMMENDED)',
      'GET /api/historic_observations_japan': 'Historical data for Japan (RECOMMENDED)',
      'GET /api/v1/current': 'Current WBGT conditions (deprecated)',
      'GET /api/v1/forecast': '72-hour WBGT forecast (deprecated)',
      'GET /api/v1/observations': 'Past 72-hour observations (deprecated)',
      'GET /api/v1/historic_observations': 'Historical WBGT data (deprecated)',
      'GET /api/v1/historic_observations_japan': 'Historical data for Japan (deprecated)',
      'GET /api/health': 'Health check'
    },
    migration: 'Update your integration to use /api instead of /api/v1'
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

async function handleHTTPRequest(request: Request, _env: any, _ctx: any): Promise<Response> {
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
    if (pathname === '/api/observations' && request.method === 'GET') return await handleGetObservations(url, corsHeaders);
    if (pathname === '/api/historic_observations' && request.method === 'GET') return await handleGetHistoricObservations(url, corsHeaders);
    if (pathname === '/api/historic_observations_japan' && request.method === 'GET') return await handleGetHistoricJapan(url, corsHeaders);
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
          '/api/historic_observations': { get: { summary: 'Get historical WBGT observations', tags: ['Historical Data'] } },
          '/api/historic_observations_japan': { get: { summary: 'Get historical WBGT observations for Japan', tags: ['Historical Data'] } }
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
      const response = await handleGetObservations(url, addDeprecationHeader(corsHeaders, '2'));
      return response;
    }
    if (pathname === '/api/v1/historic_observations' && request.method === 'GET') {
      const response = await handleGetHistoricObservations(url, addDeprecationHeader(corsHeaders, '2'));
      return response;
    }
    if (pathname === '/api/v1/historic_observations_japan' && request.method === 'GET') {
      const response = await handleGetHistoricJapan(url, addDeprecationHeader(corsHeaders, '2'));
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
