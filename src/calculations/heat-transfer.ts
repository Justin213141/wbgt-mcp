/**
 * Heat transfer coefficient calculations for WBGT
 * Includes convective, radiative, and evaporative heat transfer
 */

import {
  GLOBE_DIAMETER,
  STEFAN_BOLTZMANN,
  GLOBE_EMISSIVITY,
  WICK_DIAMETER,
  MOLECULAR_WEIGHT_AIR,
  MOLECULAR_WEIGHT_WATER,
  LATENT_HEAT_VAPORIZATION,
} from '../constants';
import { calculateVaporPressureDerivative } from './vapor-pressure';
import { calculateAirProperties } from './air-properties';

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
  const h_rw = 4 * STEFAN_BOLTZMANN * GLOBE_EMISSIVITY * Math.pow(Ta_K, 3);

  // --- Evaporative heat transfer ---
  // Mass transfer coefficient (WBGT.md line 102)
  // k̂x = (ρD/MD) × b × Re^(1-c) × Sc^(1-a)
  // Where D (in numerator) = diffusivity, MD (in denominator) = M_air × Diameter
  const kx = (rho * D / (MOLECULAR_WEIGHT_AIR * WICK_DIAMETER)) * C_cylinder * Math.pow(Re_wick, m_cylinder) * Math.pow(Sc, 1/3);

  // Psychrometric coefficient (WBGT.md line 80)
  // β̂ = k̂x × MH₂O × ΔH / P
  const beta = kx * MOLECULAR_WEIGHT_WATER * LATENT_HEAT_VAPORIZATION / P_Pa;

  // Vapor pressure derivative at mean wick temperature
  const Tw_mean = (Tw + Ta) / 2;
  const desat_dT = calculateVaporPressureDerivative(Tw_mean);

  const h_ew = beta * desat_dT;

  return { h_cg, h_rg, h_cw, h_rw, h_ew, beta };
}
