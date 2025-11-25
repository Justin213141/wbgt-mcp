/**
 * Radiation component calculations for WBGT
 * Computes shortwave and longwave radiation received by globe and wick
 */

import {
  SURFACE_ALBEDO,
  STEFAN_BOLTZMANN,
  GLOBE_ALBEDO,
  GLOBE_EMISSIVITY,
  WICK_ALBEDO,
  WICK_LENGTH,
  WICK_EMISSIVITY,
} from '../constants';

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

  // Handle edge case: when sun is at/below horizon (zenith >= 85°), use diffuse-only approximation
  // This prevents mathematical singularities from tan(90°) → ∞ and division by near-zero cos(90°)
  if (theta_deg >= 85) {
    // Sun is at/below horizon - use only diffuse and reflected radiation
    const SRg = 0.5 * (1 - GLOBE_ALBEDO) * (SRdown + SRup);
    const LRg = 0.5 * GLOBE_EMISSIVITY * (LRdown + LRup);

    const SRw = (1 - WICK_ALBEDO) * (
      (1 + 0.007 / (4 * WICK_LENGTH)) * SRdown +
      SRup
    );
    const LRw = 0.5 * WICK_EMISSIVITY * (LRdown + LRup);

    return { SRg, LRg, SRw, LRw };
  }

  // Normal case: sun is above horizon
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
  // From Kong paper equation (tan(theta) is finite when theta < 85°)
  const SRw = (1 - WICK_ALBEDO) * [
    (1 + 0.007 / (4 * WICK_LENGTH)) * (1 - fdir) * SRdown,
    (Math.tan(theta_rad) / Math.PI + 0.007 / (4 * WICK_LENGTH)) * fdir * SRdown,
    SRup
  ].reduce((a, b) => a + b, 0);

  // Longwave on wick
  const LRw = 0.5 * WICK_EMISSIVITY * (LRdown + LRup);

  return { SRg, LRg, SRw, LRw };
}
