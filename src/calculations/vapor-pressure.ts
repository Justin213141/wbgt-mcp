/**
 * Vapor pressure calculations for WBGT
 * Includes Magnus formula and derivatives
 */

/**
 * Calculate vapor pressure from temperature and relative humidity
 * @param ta Air temperature in Celsius
 * @param rh Relative humidity in percent (0-100)
 * @returns Vapor pressure in Pa
 */
export function calculateVaporPressure(ta: number, rh: number): number {
  return (rh / 100) * 6.105 * Math.exp((17.27 * ta) / (237.7 + ta));
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
