/**
 * Weather Parameter Validation
 *
 * Validators for weather measurements and physical constraints
 */

import { WeatherParameterError } from '../../utils/errors';
import {
  TEMPERATURE_LIMITS,
  HUMIDITY_LIMITS,
  PRESSURE_LIMITS,
  SOLAR_RADIATION_LIMITS,
  WIND_SPEED_LIMITS,
} from '../../constants/wbgt-formula.constants';

/**
 * Weather parameter validation result
 */
export interface WeatherParameterValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * All weather parameters validation result
 */
export interface AllWeatherParametersValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  values?: {
    temperature?: number;
    humidity?: number;
    dew_point?: number;
    pressure?: number;
    wind_speed?: number;
    solar_radiation?: number;
  };
}

/**
 * Validate temperature value (°C)
 * @param temperature Temperature in Celsius
 * @returns Validation result
 */
export function validateTemperature(temperature: any): WeatherParameterValidationResult {
  if (temperature === null || temperature === undefined) {
    return {
      valid: false,
      error: 'Temperature is required',
    };
  }

  if (typeof temperature === 'string') {
    const parsed = parseFloat(temperature);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Temperature must be a valid number, got: "${temperature}"`,
      };
    }
    temperature = parsed;
  }

  if (typeof temperature !== 'number') {
    return {
      valid: false,
      error: `Temperature must be a number, got: ${typeof temperature}`,
    };
  }

  if (!isFinite(temperature)) {
    return {
      valid: false,
      error: 'Temperature must be a finite number',
    };
  }

  if (
    temperature < TEMPERATURE_LIMITS.MINIMUM ||
    temperature > TEMPERATURE_LIMITS.MAXIMUM
  ) {
    return {
      valid: false,
      error: `Temperature must be between ${TEMPERATURE_LIMITS.MINIMUM}°C and ${TEMPERATURE_LIMITS.MAXIMUM}°C, got: ${temperature}°C`,
    };
  }

  return { valid: true, value: temperature };
}

/**
 * Validate relative humidity (%)
 * @param humidity Relative humidity (0-100)
 * @returns Validation result
 */
export function validateHumidity(humidity: any): WeatherParameterValidationResult {
  if (humidity === null || humidity === undefined) {
    return {
      valid: false,
      error: 'Humidity is required',
    };
  }

  if (typeof humidity === 'string') {
    const parsed = parseFloat(humidity);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Humidity must be a valid number, got: "${humidity}"`,
      };
    }
    humidity = parsed;
  }

  if (typeof humidity !== 'number') {
    return {
      valid: false,
      error: `Humidity must be a number, got: ${typeof humidity}`,
    };
  }

  if (!isFinite(humidity)) {
    return {
      valid: false,
      error: 'Humidity must be a finite number',
    };
  }

  if (humidity < HUMIDITY_LIMITS.MINIMUM || humidity > HUMIDITY_LIMITS.MAXIMUM) {
    return {
      valid: false,
      error: `Humidity must be between ${HUMIDITY_LIMITS.MINIMUM}% and ${HUMIDITY_LIMITS.MAXIMUM}%, got: ${humidity}%`,
    };
  }

  return { valid: true, value: humidity };
}

/**
 * Validate dew point (°C)
 * Must be less than or equal to air temperature
 * @param dewPoint Dew point in Celsius
 * @param temperature Air temperature in Celsius (for comparison)
 * @returns Validation result
 */
export function validateDewPoint(
  dewPoint: any,
  temperature?: number
): WeatherParameterValidationResult {
  if (dewPoint === null || dewPoint === undefined) {
    return {
      valid: false,
      error: 'Dew point is required',
    };
  }

  if (typeof dewPoint === 'string') {
    const parsed = parseFloat(dewPoint);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Dew point must be a valid number, got: "${dewPoint}"`,
      };
    }
    dewPoint = parsed;
  }

  if (typeof dewPoint !== 'number') {
    return {
      valid: false,
      error: `Dew point must be a number, got: ${typeof dewPoint}`,
    };
  }

  if (!isFinite(dewPoint)) {
    return {
      valid: false,
      error: 'Dew point must be a finite number',
    };
  }

  if (
    dewPoint < TEMPERATURE_LIMITS.MINIMUM ||
    dewPoint > TEMPERATURE_LIMITS.MAXIMUM
  ) {
    return {
      valid: false,
      error: `Dew point must be between ${TEMPERATURE_LIMITS.MINIMUM}°C and ${TEMPERATURE_LIMITS.MAXIMUM}°C, got: ${dewPoint}°C`,
    };
  }

  // Check dew point ≤ air temperature
  if (temperature !== undefined && dewPoint > temperature) {
    return {
      valid: false,
      error: `Dew point (${dewPoint}°C) cannot be greater than air temperature (${temperature}°C)`,
    };
  }

  return { valid: true, value: dewPoint };
}

/**
 * Validate surface pressure (hPa)
 * @param pressure Pressure in hectopascals
 * @returns Validation result
 */
export function validatePressure(pressure: any): WeatherParameterValidationResult {
  if (pressure === null || pressure === undefined) {
    return {
      valid: false,
      error: 'Pressure is required',
    };
  }

  if (typeof pressure === 'string') {
    const parsed = parseFloat(pressure);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Pressure must be a valid number, got: "${pressure}"`,
      };
    }
    pressure = parsed;
  }

  if (typeof pressure !== 'number') {
    return {
      valid: false,
      error: `Pressure must be a number, got: ${typeof pressure}`,
    };
  }

  if (!isFinite(pressure)) {
    return {
      valid: false,
      error: 'Pressure must be a finite number',
    };
  }

  if (pressure < PRESSURE_LIMITS.MINIMUM || pressure > PRESSURE_LIMITS.MAXIMUM) {
    return {
      valid: false,
      error: `Pressure must be between ${PRESSURE_LIMITS.MINIMUM} and ${PRESSURE_LIMITS.MAXIMUM} hPa, got: ${pressure} hPa`,
    };
  }

  return { valid: true, value: pressure };
}

/**
 * Validate wind speed (m/s)
 * @param windSpeed Wind speed in meters per second
 * @returns Validation result
 */
export function validateWindSpeed(windSpeed: any): WeatherParameterValidationResult {
  if (windSpeed === null || windSpeed === undefined) {
    return {
      valid: false,
      error: 'Wind speed is required',
    };
  }

  if (typeof windSpeed === 'string') {
    const parsed = parseFloat(windSpeed);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Wind speed must be a valid number, got: "${windSpeed}"`,
      };
    }
    windSpeed = parsed;
  }

  if (typeof windSpeed !== 'number') {
    return {
      valid: false,
      error: `Wind speed must be a number, got: ${typeof windSpeed}`,
    };
  }

  if (!isFinite(windSpeed)) {
    return {
      valid: false,
      error: 'Wind speed must be a finite number',
    };
  }

  if (windSpeed < WIND_SPEED_LIMITS.MINIMUM) {
    return {
      valid: false,
      error: `Wind speed cannot be negative, got: ${windSpeed} m/s`,
    };
  }

  if (windSpeed > WIND_SPEED_LIMITS.MAXIMUM) {
    return {
      valid: false,
      error: `Wind speed exceeds maximum valid value (${WIND_SPEED_LIMITS.MAXIMUM} m/s), got: ${windSpeed} m/s`,
    };
  }

  return { valid: true, value: windSpeed };
}

/**
 * Validate solar radiation (W/m²)
 * @param solarRadiation Solar radiation in watts per square meter
 * @returns Validation result
 */
export function validateSolarRadiation(solarRadiation: any): WeatherParameterValidationResult {
  if (solarRadiation === null || solarRadiation === undefined) {
    return {
      valid: false,
      error: 'Solar radiation is required',
    };
  }

  if (typeof solarRadiation === 'string') {
    const parsed = parseFloat(solarRadiation);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Solar radiation must be a valid number, got: "${solarRadiation}"`,
      };
    }
    solarRadiation = parsed;
  }

  if (typeof solarRadiation !== 'number') {
    return {
      valid: false,
      error: `Solar radiation must be a number, got: ${typeof solarRadiation}`,
    };
  }

  if (!isFinite(solarRadiation)) {
    return {
      valid: false,
      error: 'Solar radiation must be a finite number',
    };
  }

  if (solarRadiation < SOLAR_RADIATION_LIMITS.MINIMUM) {
    return {
      valid: false,
      error: `Solar radiation cannot be negative, got: ${solarRadiation} W/m²`,
    };
  }

  if (solarRadiation > SOLAR_RADIATION_LIMITS.MAXIMUM) {
    return {
      valid: false,
      error: `Solar radiation exceeds maximum valid value (${SOLAR_RADIATION_LIMITS.MAXIMUM} W/m²), got: ${solarRadiation} W/m²`,
    };
  }

  return { valid: true, value: solarRadiation };
}

/**
 * Validate cloud cover (%)
 * @param cloudCover Cloud cover percentage (0-100)
 * @returns Validation result
 */
export function validateCloudCover(cloudCover: any): WeatherParameterValidationResult {
  if (cloudCover === null || cloudCover === undefined) {
    // Cloud cover is optional
    return { valid: true, value: 0 };
  }

  if (typeof cloudCover === 'string') {
    const parsed = parseFloat(cloudCover);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Cloud cover must be a valid number, got: "${cloudCover}"`,
      };
    }
    cloudCover = parsed;
  }

  if (typeof cloudCover !== 'number') {
    return {
      valid: false,
      error: `Cloud cover must be a number, got: ${typeof cloudCover}`,
    };
  }

  if (!isFinite(cloudCover)) {
    return {
      valid: false,
      error: 'Cloud cover must be a finite number',
    };
  }

  if (cloudCover < 0 || cloudCover > 100) {
    return {
      valid: false,
      error: `Cloud cover must be between 0% and 100%, got: ${cloudCover}%`,
    };
  }

  return { valid: true, value: cloudCover };
}

/**
 * Validate all weather parameters at once
 * @param params Weather parameters object
 * @returns Validation result with all errors
 */
export function validateAllWeatherParameters(params: Record<string, any>): AllWeatherParametersValidationResult {
  const errors: Record<string, string> = {};
  const values: AllWeatherParametersValidationResult['values'] = {};

  // Validate temperature
  const tempResult = validateTemperature(params.temperature);
  if (!tempResult.valid) {
    errors.temperature = tempResult.error!;
  } else {
    values.temperature = tempResult.value;
  }

  // Validate humidity
  const humResult = validateHumidity(params.humidity);
  if (!humResult.valid) {
    errors.humidity = humResult.error!;
  } else {
    values.humidity = humResult.value;
  }

  // Validate dew point (with temperature constraint)
  const dewResult = validateDewPoint(params.dew_point, values.temperature);
  if (!dewResult.valid) {
    errors.dew_point = dewResult.error!;
  } else {
    values.dew_point = dewResult.value;
  }

  // Validate pressure
  const pressureResult = validatePressure(params.pressure);
  if (!pressureResult.valid) {
    errors.pressure = pressureResult.error!;
  } else {
    values.pressure = pressureResult.value;
  }

  // Validate wind speed
  const windResult = validateWindSpeed(params.wind_speed);
  if (!windResult.valid) {
    errors.wind_speed = windResult.error!;
  } else {
    values.wind_speed = windResult.value;
  }

  // Validate solar radiation
  const srResult = validateSolarRadiation(params.solar_radiation);
  if (!srResult.valid) {
    errors.solar_radiation = srResult.error!;
  } else {
    values.solar_radiation = srResult.value;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    values: Object.keys(errors).length === 0 ? values : undefined,
  };
}

/**
 * Validate weather parameters or throw error
 * @throws WeatherParameterError if validation fails
 */
export function validateWeatherParametersOrThrow(params: Record<string, any>): Record<string, number> {
  const result = validateAllWeatherParameters(params);
  if (!result.valid) {
    throw new WeatherParameterError(
      `Weather parameter validation failed: ${Object.values(result.errors).join('; ')}`,
      { errors: result.errors }
    );
  }
  return result.values!;
}
