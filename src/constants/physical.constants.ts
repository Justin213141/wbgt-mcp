/**
 * Physical Constants
 *
 * Fundamental physical constants used in WBGT calculations
 */

/**
 * Stefan-Boltzmann constant [W/(m²·K⁴)]
 * Used for thermal radiation calculations
 */
export const STEFAN_BOLTZMANN = 5.67e-8;

/**
 * Gas constant for dry air [J/(kg·K)]
 */
export const GAS_CONSTANT_AIR = 287.05;

/**
 * Molecular weight of water [kg/mol]
 */
export const MOLECULAR_WEIGHT_WATER = 0.018015;

/**
 * Latent heat of vaporization at 0°C [J/kg]
 */
export const LATENT_HEAT_VAPORIZATION = 2453000;

/**
 * Gravitational acceleration [m/s²]
 */
export const GRAVITY = 9.81;

/**
 * Molecular weight of dry air [kg/kmol]
 */
export const MOLECULAR_WEIGHT_DRY_AIR = 28.97;

/**
 * Molecular weight of air [kg/mol]
 * Used in heat transfer and mass transfer calculations
 */
export const MOLECULAR_WEIGHT_AIR = 0.02897;

// === Globe Equipment Constants ===

/**
 * Globe diameter [m]
 * Standard meteorological black globe
 */
export const GLOBE_DIAMETER = 0.0508;

/**
 * Globe emissivity (dimensionless)
 * Emissive power of black-painted globe surface
 */
export const GLOBE_EMISSIVITY = 0.95;

/**
 * Globe albedo (dimensionless)
 * Solar reflectance of black-painted globe
 */
export const GLOBE_ALBEDO = 0.05;

/**
 * Globe surface area [m²]
 */
export const GLOBE_SURFACE_AREA = Math.PI * GLOBE_DIAMETER ** 2;

// === Wick Equipment Constants ===

/**
 * Wick diameter [m]
 * Standard muslin wick in natural wet bulb thermometer
 */
export const WICK_DIAMETER = 0.007;

/**
 * Wick length [m]
 */
export const WICK_LENGTH = 0.0254;

/**
 * Wick emissivity (dimensionless)
 */
export const WICK_EMISSIVITY = 0.95;

/**
 * Wick albedo (dimensionless)
 * Solar reflectance of wet muslin
 */
export const WICK_ALBEDO = 0.4;

/**
 * Wick surface area [m²]
 */
export const WICK_SURFACE_AREA = Math.PI * WICK_DIAMETER * WICK_LENGTH;

// === Surface Constants ===

/**
 * Surface/ground albedo (dimensionless)
 * Default solar reflectance of ground surface
 * Typical values: grass 0.15-0.26, asphalt 0.05-0.18, concrete 0.20-0.40
 * Use 0.20 for mixed outdoor surfaces (conservative for heat stress)
 */
export const SURFACE_ALBEDO = 0.20;

// === Air Properties Constants ===

/**
 * Prandtl number for air (dimensionless)
 * Ratio of viscous to thermal diffusivity
 */
export const PRANDTL_NUMBER = 0.71;

/**
 * Schmidt number for water vapor in air (dimensionless)
 * Ratio of viscous to mass diffusivity
 */
export const SCHMIDT_NUMBER = 0.60;

// === Cylinder Correlation Coefficients ===

/**
 * Cylinder correlation coefficient B
 * For Nusselt number calculation on cylinders
 */
export const CYLINDER_COEFFICIENT_B = 0.281;

/**
 * Cylinder correlation exponent C
 */
export const CYLINDER_EXPONENT_C = 0.4;

/**
 * Cylinder correlation coefficient A
 */
export const CYLINDER_COEFFICIENT_A = 0.56;

// === Solar Constants ===

/**
 * Solar constant [W/m²]
 * Mean solar radiation at Earth's orbital distance (top of atmosphere)
 */
export const SOLAR_CONSTANT = 1361;

/**
 * Days in year
 */
export const DAYS_PER_YEAR = 365.25;

/**
 * Earth eccentricity factor
 * Corrects for Earth's elliptical orbit
 */
export const EARTH_ECCENTRICITY = 1.00011 + 0.034221 * Math.cos(0) + 0.00128 * Math.sin(0) + 0.000719 * Math.cos(2 * 0);

// === Empirical Constants for Formulas ===

/**
 * Magnus formula constant a (dimensionless)
 * For vapor pressure calculation
 */
export const MAGNUS_A = 17.27;

/**
 * Magnus formula constant b (°C)
 * For vapor pressure calculation
 */
export const MAGNUS_B = 237.7;

/**
 * Magnus formula constant c (hPa)
 * For vapor pressure calculation
 */
export const MAGNUS_C = 610.5;

/**
 * Atmospheric emissivity constant (dimensionless)
 */
export const ATMOSPHERIC_EMISSIVITY_CONSTANT = 0.575;

/**
 * Atmospheric emissivity exponent (dimensionless)
 */
export const ATMOSPHERIC_EMISSIVITY_EXPONENT = 0.143;
