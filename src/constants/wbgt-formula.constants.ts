/**
 * WBGT Formula Constants
 *
 * Coefficients and constants used in various WBGT calculation methods
 */

// === Kong WBGT Formula ===

/**
 * Kong WBGT weighting coefficients (dimensionless)
 * Final WBGT = coeff_nw * T_nw + coeff_g * T_g + coeff_ta * T_a
 */
export const KONG_WBGT = {
  /**
   * Natural wet bulb temperature weight
   * Represents the dominant contribution to thermal sensation
   */
  COEFF_NATURAL_WET_BULB: 0.7,

  /**
   * Black globe temperature weight
   * Represents solar radiation contribution
   */
  COEFF_GLOBE: 0.2,

  /**
   * Air temperature weight
   * Represents ambient temperature contribution
   */
  COEFF_AIR_TEMP: 0.1,
} as const;

// === Simplified WBGT Formula (Indoor) ===

/**
 * Simplified WBGT coefficients (for environments without direct solar radiation)
 */
export const SIMPLIFIED_WBGT = {
  COEFF_NATURAL_WET_BULB: 0.7,
  COEFF_DRY_BULB: 0.3,
} as const;

// === Environmental Stress Index (ESI) ===

/**
 * ESI calculation coefficients
 * ESI = a*Ta + b*RH + c*SR + d*Ta*RH + e/(f + SR)
 */
export const ESI_COEFFICIENTS = {
  /**
   * Temperature coefficient
   */
  TEMPERATURE: 0.62,

  /**
   * Humidity coefficient
   */
  HUMIDITY: -0.007,

  /**
   * Solar radiation coefficient
   */
  SOLAR_RADIATION: 0.002,

  /**
   * Interaction term coefficient (temperature × humidity)
   */
  INTERACTION: 0.0043,

  /**
   * Numerator constant for radiation denominator
   */
  RADIATION_NUMERATOR: -0.078,

  /**
   * Denominator constant for radiation term
   */
  RADIATION_DENOMINATOR: 0.1,
} as const;

// === Apparent Temperature Formula ===

/**
 * Apparent Temperature (AT) coefficients
 * Based on wind speed and radiation effects
 */
export const APPARENT_TEMP_COEFFICIENTS = {
  /**
   * Temperature coefficient
   */
  TEMPERATURE: 1.0,

  /**
   * Vapor pressure coefficient
   */
  VAPOR_PRESSURE: 0.0,

  /**
   * Wind speed coefficient
   */
  WIND_SPEED: 0.0,

  /**
   * Solar radiation coefficient
   */
  SOLAR_RADIATION: 0.0,
} as const;

// === eWBGT (Environmental WBGT) ===

/**
 * eWBGT calculation coefficients
 * eWBGT = a*Ta + b*RH + c*SR + d*Ta*RH + e/(f + SR)
 */
export const EWBGT_COEFFICIENTS = {
  /**
   * Temperature coefficient [°C]
   */
  TEMPERATURE: 0.567,

  /**
   * Humidity coefficient
   */
  HUMIDITY: 0.393,

  /**
   * Solar radiation coefficient [°C per W/m²]
   */
  SOLAR_RADIATION: 3.94,
} as const;

// === Radiation Absorption/Emissivity ===

/**
 * Absorption and emissivity factors
 */
export const RADIATION_FACTORS = {
  /**
   * Direct beam fraction threshold
   * If direct/(direct+diffuse) > this, consider significant direct radiation
   */
  DIRECT_FRACTION_THRESHOLD: 0.3,

  /**
   * Surface reflectance for radiation calculations
   */
  SURFACE_REFLECTANCE: 0.45,

  /**
   * Globe thermal emissivity for radiation
   */
  GLOBE_THERMAL_EMISSIVITY: 0.95,

  /**
   * Wick thermal emissivity for radiation
   */
  WICK_THERMAL_EMISSIVITY: 0.95,
} as const;

// === Wind Speed Power Law ===

/**
 * Wind speed adjustment constants
 * Wind speed at height h: u_h = u_ref * (h/h_ref)^p
 */
export const WIND_POWER_LAW = {
  /**
   * Reference height [m]
   * Usually 10m from standard weather station measurements
   */
  REFERENCE_HEIGHT: 10,

  /**
   * Target height [m]
   * Usually 2m for instrument measurements
   */
  TARGET_HEIGHT: 2,

  /**
   * Exponent p (dimensionless)
   * Depends on terrain roughness, typically 0.1-0.2 for open terrain
   */
  EXPONENT: 0.15,
} as const;

// === Heat Transfer Boundary Layer ===

/**
 * Nusselt number correlation constants for cylinders
 */
export const NUSSELT_CYLINDER = {
  /**
   * Base constant for Nusselt number
   */
  CONSTANT: 2.0,

  /**
   * Reynolds number coefficient
   */
  REYNOLDS_COEFF: 0.6,

  /**
   * Reynolds number exponent
   */
  REYNOLDS_EXPONENT: 0.5,

  /**
   * Prandtl exponent
   */
  PRANDTL_EXPONENT: 0.33,
} as const;

// === Vapor Pressure ===

/**
 * Vapor pressure calculation constants
 */
export const VAPOR_PRESSURE = {
  /**
   * Buck formula constant (reference point)
   */
  BUCK_REFERENCE: 610.5,

  /**
   * Magnus formula temperature exponent (dimensionless)
   */
  MAGNUS_A: 17.27,

  /**
   * Magnus formula temperature constant [°C]
   */
  MAGNUS_B: 237.7,
} as const;

// === Temperature Thresholds ===

/**
 * Temperature limits for physical validity
 */
export const TEMPERATURE_LIMITS = {
  /**
   * Minimum valid temperature [°C]
   */
  MINIMUM: -100,

  /**
   * Maximum valid temperature [°C]
   */
  MAXIMUM: 100,
} as const;

// === Humidity Limits ===

/**
 * Relative humidity limits [%]
 */
export const HUMIDITY_LIMITS = {
  MINIMUM: 0,
  MAXIMUM: 100,
} as const;

// === Pressure Limits ===

/**
 * Atmospheric pressure limits [hPa]
 */
export const PRESSURE_LIMITS = {
  MINIMUM: 500,
  MAXIMUM: 1100,
} as const;

// === Solar Radiation Limits ===

/**
 * Solar radiation limits [W/m²]
 */
export const SOLAR_RADIATION_LIMITS = {
  MINIMUM: 0,
  /**
   * Solar constant at Earth's surface (max at solar noon, sea level)
   */
  MAXIMUM: 1100,
} as const;

// === Wind Speed Limits ===

/**
 * Wind speed limits [m/s]
 */
export const WIND_SPEED_LIMITS = {
  MINIMUM: 0,
  /**
   * Maximum for calculation validity (hurricane-force winds)
   */
  MAXIMUM: 100,
} as const;
