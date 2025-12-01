/**
 * Weather Data Type Definitions
 *
 * Strongly-typed interfaces for weather data from external APIs
 * (Open-Meteo, Bureau of Meteorology)
 */

/**
 * BOM (Bureau of Meteorology) Observation Record
 * Represents a single observation data point
 */
export interface BOMObservation {
  local_date_time: string;
  local_date_time_full: string;
  air_temp?: number;
  apparent_t?: number;
  cloud?: string;
  cloud_base_m?: number;
  cloud_oktas?: number;
  cloud_type?: string;
  cloud_type_id?: number;
  dewpt?: number;
  press?: number;
  press_qnh?: number;
  press_msl?: number;
  press_tend?: string;
  rain_trace?: string;
  rel_hum?: number;
  sea_state?: string;
  swell_dir_worded?: string;
  swell_height?: number;
  swell_period?: number;
  vis_range?: number;
  vis_range_km?: string;
  weather?: string;
  wind_dir?: string;
  wind_spd_kmh?: number;
  wind_spd_kt?: number;
}

/**
 * BOM API Response Format
 */
export interface BOMData {
  observations?: {
    notice?: Array<{ copyright: string; copyright_url: string }>;
    metadata?: {
      issue_time: string;
      [key: string]: any;
    };
    data?: BOMObservation[];
  };
  data?: BOMObservation[];
}

/**
 * Open-Meteo Hourly Weather Data
 * Represents hourly weather measurements and forecasts
 */
export interface HourlyWeatherData {
  time?: string[];
  temperature_2m?: number[];
  relative_humidity_2m?: number[];
  dew_point_2m?: number[];
  wet_bulb_temperature_2m?: number[];
  surface_pressure?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
  wind_gusts_10m?: number[];
  shortwave_radiation?: number[];
  shortwave_radiation_instant?: number[];
  direct_radiation?: number[];
  direct_radiation_instant?: number[];
  diffuse_radiation?: number[];
  diffuse_radiation_instant?: number[];
  apparent_temperature?: number[];
  cloud_cover?: number[];
  cloud_cover_low?: number[];
  cloud_cover_mid?: number[];
  cloud_cover_high?: number[];
  uv_index?: number[];
  uv_index_clear_sky?: number[];
  precipitation?: number[];
  weather_code?: number[];
  is_day?: number[];
}

/**
 * Solar Radiation Data from Open-Meteo Archive API
 */
export interface SRData {
  hourly?: HourlyWeatherData;
  daily?: {
    time?: string[];
    [key: string]: any;
  };
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
}

/**
 * Solar Radiation Source Types
 */
export type SolarRadiationSource =
  | 'satellite_seamless'      // Observational satellite data (seamless model)
  | 'satellite_model'         // Model satellite data (best match)
  | 'archive_reanalysis'      // Reanalysis model data (historical)
  | 'forecast_model'          // Forecast model data (recent/current)
  | 'satellite'               // Legacy satellite (for backward compatibility)
  | 'archive'                 // Legacy archive (for backward compatibility)
  | 'standard';               // Standard/default source

/**
 * Weather Data Response from Open-Meteo API
 */
export interface WeatherData {
  hourly?: HourlyWeatherData;
  daily?: {
    time?: string[];
    [key: string]: any;
  };
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
  solarRadiationSource?: SolarRadiationSource;
}

/**
 * Air Quality Data from Open-Meteo API
 */
export interface HourlyAirQualityData {
  time?: string[];
  us_aqi?: number[];
  pm2_5?: number[];
  pm10?: number[];
  nitrogen_dioxide?: number[];
  ozone?: number[];
  sulphur_dioxide?: number[];
}

export interface AQData {
  hourly?: HourlyAirQualityData;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  utc_offset_seconds?: number;
}

/**
 * Combined Observations Response
 * Aggregates data from multiple sources (Weather, Solar Radiation, BOM)
 */
export interface ObservationsResponse {
  type: 'recent' | 'historical' | 'merged';
  weatherData?: WeatherData;
  srData?: SRData;
  bomData?: BOMData;
}

/**
 * Forecast Response
 */
export interface ForecastResponse {
  srData: SRData;
  aqData: AQData;
  bomData: BOMData;
}

/**
 * Single Weather Observation Record
 * Represents combined data from all sources for a specific timestamp
 */
export interface WeatherObservation {
  timestamp: string;
  temperature: number;
  humidity: number;
  dew_point: number;
  wind_speed_ms: number;
  solar_radiation: number;
  cloud_cover: number;
  uv_index: number;
  pressure_hPa: number;
}

/**
 * Solar Radiation Components
 */
export interface RadiationComponents {
  shortwave_radiation: number;
  direct_radiation: number;
  diffuse_radiation: number;
}
