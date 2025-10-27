/**
 * WBGT Calculation Type Definitions
 *
 * Type definitions for WBGT (Wet Bulb Globe Temperature) calculations
 * and related heat stress indices
 */

/**
 * Results from Kong WBGT Calculation
 * Kong et al. zero-iteration method
 */
export interface KongWBGTResult {
  kong_wbgt: number;
  black_globe_temp: number;
  natural_wet_bulb_temp: number;
  solar_zenith_angle: number;
  esi?: number;
  components: {
    air_temp: number;
    solar_radiation: number;
    direct_radiation: number;
    diffuse_radiation: number;
    vapor_pressure: number;
  };
}

/**
 * Simplified WBGT Result
 */
export interface SimplifiedWBGTResult {
  wbgt: number;
  esi?: number;
  apparent_temp?: number;
}

/**
 * Air Properties at Given Temperature and Pressure
 */
export interface AirProperties {
  density: number;           // kg/m³
  viscosity: number;         // Pa·s
  thermal_conductivity: number; // W/(m·K)
  prandtl_number: number;    // Dimensionless
  schmidt_number: number;    // Dimensionless
  diffusivity: number;       // m²/s
}

/**
 * Heat Transfer Coefficients
 */
export interface HeatTransferCoefficients {
  // Globe
  convective_globe: number;  // W/(m²·K)
  radiative_globe: number;   // W/(m²·K)

  // Wick
  convective_wick: number;   // W/(m²·K)
  radiative_wick: number;    // W/(m²·K)
  evaporative_wick: number;  // W/(m²·K)
}

/**
 * Radiation Components (W/m²)
 */
export interface RadiationBalance {
  shortwave_down: number;    // Global Horizontal Irradiance
  shortwave_up: number;      // Reflected shortwave
  longwave_down: number;     // Atmospheric longwave
  longwave_up: number;       // Surface longwave

  // On globe surface
  globe_shortwave: number;
  globe_longwave: number;

  // On wick surface
  wick_shortwave: number;
  wick_longwave: number;
}

/**
 * WBGT Observation with Calculated Values
 */
export interface WBGTObservation {
  timestamp: string;

  // Input measurements
  inputs: {
    air_temperature: number;
    relative_humidity: number;
    dew_point: number;
    wet_bulb_temperature: number;
    surface_pressure: number;
    wind_speed_10m: number;
    wind_speed_2m: number;
    shortwave_radiation: number;
    direct_radiation: number;
    diffuse_radiation: number;
    apparent_temperature: number;
    cloud_cover: number;
  };

  // Calculated outputs
  outputs: {
    kong_wbgt: number;
    black_globe_temp: number;
    natural_wet_bulb_temp: number;
    air_temp: number;
    solar_zenith_angle: number;
    esi?: number;
    apparent_temp?: number;
  };

  // Intermediate values (for debugging/analysis)
  intermediates?: {
    vapor_pressure: number;
    atmospheric_emissivity: number;
    direct_beam_fraction: number;
    air_properties: AirProperties;
    heat_transfer_coefficients: HeatTransferCoefficients;
    radiation_balance: RadiationBalance;
  };
}

/**
 * WBGT Forecast Entry
 */
export interface WBGTForecastEntry extends WBGTObservation {
  // Forecast-specific fields
  is_forecast: true;
}

/**
 * WBGT Request Parameters
 */
export interface WBGTCalculationParams {
  latitude: number;
  longitude: number;
  timestamp: string;
  air_temperature: number;
  relative_humidity: number;
  dew_point: number;
  wet_bulb_temperature: number;
  surface_pressure: number;
  wind_speed_10m: number;
  shortwave_radiation: number;
  direct_radiation: number;
  diffuse_radiation: number;
}

/**
 * Date Range for Historical Queries
 */
export interface DateRange {
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
}

/**
 * Query Parameters for Observations
 */
export interface ObservationQueryParams {
  start_time?: string;  // ISO 8601
  end_time?: string;    // ISO 8601
  latitude?: number;
  longitude?: number;
}

/**
 * Query Parameters for Historic Observations
 */
export interface HistoricObservationQueryParams extends DateRange {
  latitude?: number;
  longitude?: number;
}

/**
 * WBGT Response DTO
 */
export interface WBGTResponseDTO {
  success: boolean;
  data?: WBGTObservation | WBGTObservation[] | WBGTForecastEntry[];
  count?: number;
  timestamp?: string;
  error?: string;
  message?: string;
}

/**
 * Calculation Method Options
 */
export type WBGTCalculationMethod = 'kong' | 'simplified' | 'esi' | 'apparent_temp';

/**
 * Timezone Configuration
 */
export interface TimezoneConfig {
  name: string;
  abbreviation: string;
  getOffset: (date: Date) => number;
  hasDST: boolean;
}

/**
 * Location Configuration
 */
export interface LocationConfig {
  name: string;
  latitude: number;
  longitude: number;
  timezone: TimezoneConfig;
}
