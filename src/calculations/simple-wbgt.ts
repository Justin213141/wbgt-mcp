/**
 * Simple WBGT and related index calculations
 * Includes ESI, eWBGT, and Apparent Temperature formulas
 */

/**
 * Calculate simple WBGT using ESI formula
 * WBGT = 0.62*Ta - 0.007*RH + 0.002*SR + 0.0043*(Ta*RH) - 0.078/(0.1+SR)
 * @param ta Air temperature in Celsius
 * @param rh Relative humidity in percent (0-100)
 * @param sr Solar radiation in W/m²
 * @returns Simplified WBGT in Celsius
 */
export function calculateWBGT(ta: number, rh: number, sr: number): number {
  return 0.62 * ta - 0.007 * rh + 0.002 * sr + 0.0043 * (ta * rh) - 0.078 / (0.1 + sr);
}

/**
 * Calculate enhanced WBGT (eWBGT) using vapor pressure
 * eWBGT = 0.567 × Ta + 0.393 × e + 3.94
 * @param ta Air temperature in Celsius
 * @param e Vapor pressure in hPa
 * @returns Enhanced WBGT in Celsius
 */
export function calculateEWBGT(ta: number, e: number): number {
  return 0.567 * ta + 0.393 * e + 3.94;
}

/**
 * Calculate Apparent Temperature (AT)
 * Used in some heat stress indices
 * @param ta Air temperature in Celsius
 * @param rh Relative humidity in percent (0-100)
 * @param ws_kmh Wind speed in km/h
 * @param sr Solar radiation in W/m²
 * @returns Apparent Temperature in Celsius
 */
export function calculateAT(ta: number, rh: number, ws_kmh: number, sr: number): number {
  const ws = ws_kmh / 3.6;
  const vaporPressure = (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
  return ta + 0.348 * vaporPressure - 0.70 * 0.75 * ws + 0.70 * 0.02 * sr / (ws * 0.75 + 10) - 4.25;
}
