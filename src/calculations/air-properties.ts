/**
 * Air properties calculations for WBGT
 * Includes density, viscosity, thermal properties
 */

import { GAS_CONSTANT_AIR } from '../constants';

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
