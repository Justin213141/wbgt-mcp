/**
 * Kong WBGT calculation and pipeline
 * Comprehensive Kong heat stress index implementation
 */

import { STEFAN_BOLTZMANN, GLOBE_EMISSIVITY, WICK_EMISSIVITY } from '../constants/physical.constants';
import {
  calculateSolarZenithAngle,
  calculateSolarZenithAngleJST,
  calculateSolarZenithAngleByTimezone
} from './solar/solar-geometry';
import { calculateBuckSaturationVaporPressure } from './vapor-pressure';
import { calculateWindAt2m, calculateAirProperties } from './air-properties';
import { calculateRadiationComponents } from './radiation';
import { calculateHeatTransferCoefficients } from './heat-transfer';

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
  const T_nw = T_nw_K - 273.15;

  // Physical constraint validation: natural wet bulb cannot exceed air temperature
  // Allow small margin for measurement and calculation errors
  const PHYSICAL_CONSTRAINT_MARGIN = 2.0; // °C

  if (T_nw > Ta + PHYSICAL_CONSTRAINT_MARGIN) {
    console.warn(`Physical constraint violation: Natural wet bulb temperature (${T_nw.toFixed(1)}°C) exceeds air temperature (${Ta.toFixed(1)}°C) by more than ${PHYSICAL_CONSTRAINT_MARGIN}°C. Clamping to air temperature.`);
    return Ta;
  }

  // Additional sanity check: wet bulb shouldn't be unreasonably low
  const MIN_REASONABLE_WET_BULB = Ta - 30; // Maximum 30°C below air temperature
  if (T_nw < MIN_REASONABLE_WET_BULB) {
    console.warn(`Natural wet bulb temperature (${T_nw.toFixed(1)}°C) unreasonably low for air temperature (${Ta.toFixed(1)}°C). Clamping to minimum reasonable value.`);
    return MIN_REASONABLE_WET_BULB;
  }

  return T_nw;
}

/**
 * Calculate psychrometric wet bulb temperature from dry bulb temp, relative humidity, and pressure
 * Using Kong's zero-iteration psychrometric method
 * This is the wet bulb temperature in a ventilated environment (no radiation)
 *
 * @param T Dry bulb temperature (°C)
 * @param RH Relative humidity (%)
 * @param P Pressure (hPa)
 * @returns Psychrometric wet bulb temperature (°C)
 */
export function calculatePsychrometricWetBulb(
  T: number,      // Dry bulb temperature (°C)
  RH: number,     // Relative humidity (%)
  P: number       // Pressure (hPa)
): number {
  // Calculate actual vapor pressure from relative humidity
  const e_sat_T = calculateBuckSaturationVaporPressure(T);
  const e_a = (RH / 100) * e_sat_T;

  // Psychrometric constant (γ) in Pa/K
  const P_Pa = P * 100;  // Convert hPa to Pa
  const psychrometric_constant = 0.000666 * P_Pa;

  // Solve for Tw using the psychrometric equation:
  // e_a = e_sat(Tw) - γ * (T - Tw)
  // We need to find Tw where f(Tw) = e_sat(Tw) - γ * (T - Tw) - e_a = 0

  // Use simple iterative approach - start with reasonable bounds
  // Wet bulb must be between dew point (approx) and dry bulb
  let Tw_low = Math.min(T - 15, T);  // Lower bound (can't be more than 15°C below T)
  let Tw_high = T;                    // Upper bound (can't exceed dry bulb)

  // Bisection method for 20 iterations (more than enough for convergence)
  for (let i = 0; i < 20; i++) {
    const Tw_mid = (Tw_low + Tw_high) / 2;
    const e_sat_mid = calculateBuckSaturationVaporPressure(Tw_mid);
    const f_mid = e_sat_mid - psychrometric_constant * (T - Tw_mid) - e_a;

    if (f_mid > 0) {
      // Wet bulb too low, need higher Tw to increase e_sat(Tw)
      Tw_low = Tw_mid;
    } else {
      // Wet bulb too high, need lower Tw
      Tw_high = Tw_mid;
    }
  }

  return (Tw_low + Tw_high) / 2;
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
  return 0.62 * Ta - 0.007 * RH + 0.002 * SR + 0.0043 * (Ta * RH) - 0.078 / (0.1 + SR);
}

/**
 * Complete Kong WBGT calculation pipeline (timezone-agnostic)
 * Automatically handles solar zenith calculation based on timezone parameters
 */
export function calculateKongWBGTPipelineByTimezone(
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
  timestamp: string,
  utcOffset: number = 10,
  hasDST: boolean = true
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
  // Step 1: Solar geometry (timezone-aware)
  const theta_deg = calculateSolarZenithAngleByTimezone(lat, lon, timestamp, utcOffset, hasDST);

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
  const totalSR = SRdirect_valid + SRdiffuse_valid;
  const fdir = totalSR > 0 ? SRdirect_valid / totalSR : 0;

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
  const totalSR = SRdirect_valid + SRdiffuse_valid;
  const fdir = totalSR > 0 ? SRdirect_valid / totalSR : 0;

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

/**
 * Complete Kong WBGT calculation pipeline (JST/Tokyo timezone)
 */
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
  const totalSR = SRdirect_valid + SRdiffuse_valid;
  const fdir = totalSR > 0 ? SRdirect_valid / totalSR : 0;

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
