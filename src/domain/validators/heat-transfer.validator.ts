/**
 * Heat Transfer Coefficient Validation
 *
 * Validators for heat transfer coefficients used in WBGT calculations
 * Ensures physically realistic values for convective, radiative, and evaporative heat transfer
 */

import { WeatherParameterError } from '../../utils/errors';

/**
 * Heat transfer coefficient validation result
 */
export interface HeatTransferValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
  warnings?: string[];
}

/**
 * All heat transfer coefficients validation result
 */
export interface AllHeatTransferValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
  values?: {
    h_cg?: number;    // Globe convective heat transfer coefficient
    h_rg?: number;    // Globe radiative heat transfer coefficient
    h_cw?: number;    // Wick convective heat transfer coefficient
    h_rw?: number;    // Wick radiative heat transfer coefficient
    h_ew?: number;    // Wick evaporative heat transfer coefficient
    beta?: number;    // Psychrometric coefficient
  };
}

/**
 * Physical limits for heat transfer coefficients [W/(m²·K)]
 */
export const HEAT_TRANSFER_LIMITS = {
  // Convective heat transfer coefficients
  CONVECTIVE_MIN: 1,        // Minimum natural convection
  CONVECTIVE_MAX: 1000,     // Maximum forced convection (high wind)

  // Radiative heat transfer coefficients
  RADIATIVE_MIN: 1,         // Minimum at low temperatures
  RADIATIVE_MAX: 10,        // Maximum at high temperatures

  // Evaporative heat transfer coefficients
  EVAPORATIVE_MIN: 0.1,     // Minimum evaporation
  EVAPORATIVE_MAX: 1000,    // Maximum evaporation (high humidity, high wind)

  // Psychrometric coefficient
  PSYCHROMETRIC_MIN: 0.0001,
  PSYCHROMETRIC_MAX: 0.01,
} as const;

/**
 * Expected ranges for different conditions
 */
export const CONDITION_RANGES = {
  // Natural convection (calm conditions, u < 0.1 m/s)
  NATURAL_CONVECTION: {
    MIN: 1,
    MAX: 15,
  },

  // Forced convection (typical outdoor conditions, u = 1-10 m/s)
  FORCED_CONVECTION: {
    MIN: 10,
    MAX: 100,
  },

  // High wind conditions (u > 10 m/s)
  HIGH_WIND: {
    MIN: 50,
    MAX: 1000,
  },
} as const;

/**
 * Validate convective heat transfer coefficient
 * @param h_c Convective heat transfer coefficient [W/(m²·K)]
 * @param windSpeed Wind speed in m/s for context validation
 * @param component Component name ('globe' or 'wick')
 * @returns Validation result
 */
export function validateConvectiveHeatTransfer(
  h_c: any,
  windSpeed?: number,
  component: 'globe' | 'wick' = 'globe'
): HeatTransferValidationResult {
  const warnings: string[] = [];

  // Basic validation
  if (h_c === null || h_c === undefined) {
    return {
      valid: false,
      error: 'Convective heat transfer coefficient is required',
    };
  }

  if (typeof h_c === 'string') {
    const parsed = parseFloat(h_c);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Convective heat transfer coefficient must be a valid number, got: "${h_c}"`,
      };
    }
    h_c = parsed;
  }

  if (typeof h_c !== 'number') {
    return {
      valid: false,
      error: `Convective heat transfer coefficient must be a number, got: ${typeof h_c}`,
    };
  }

  if (!isFinite(h_c)) {
    return {
      valid: false,
      error: 'Convective heat transfer coefficient must be a finite number',
    };
  }

  // Physical limits
  if (h_c < HEAT_TRANSFER_LIMITS.CONVECTIVE_MIN) {
    return {
      valid: false,
      error: `Convective heat transfer coefficient (${h_c.toFixed(2)} W/(m²·K)) below minimum physical limit (${HEAT_TRANSFER_LIMITS.CONVECTIVE_MIN} W/(m²·K))`,
    };
  }

  if (h_c > HEAT_TRANSFER_LIMITS.CONVECTIVE_MAX) {
    return {
      valid: false,
      error: `Convective heat transfer coefficient (${h_c.toFixed(2)} W/(m²·K)) exceeds maximum physical limit (${HEAT_TRANSFER_LIMITS.CONVECTIVE_MAX} W/(m²·K))`,
    };
  }

  // Context validation based on wind speed
  if (windSpeed !== undefined) {
    if (windSpeed < 0.1 && h_c > CONDITION_RANGES.NATURAL_CONVECTION.MAX) {
      warnings.push(`High convective coefficient (${h_c.toFixed(2)} W/(m²·K)) for very low wind speed (${windSpeed.toFixed(2)} m/s) - expected natural convection range: ${CONDITION_RANGES.NATURAL_CONVECTION.MIN}-${CONDITION_RANGES.NATURAL_CONVECTION.MAX} W/(m²·K)`);
    }

    if (windSpeed >= 0.1 && windSpeed <= 10 && (h_c < CONDITION_RANGES.FORCED_CONVECTION.MIN || h_c > CONDITION_RANGES.FORCED_CONVECTION.MAX)) {
      warnings.push(`Convective coefficient (${h_c.toFixed(2)} W/(m²·K)) outside typical range for wind speed ${windSpeed.toFixed(2)} m/s - expected: ${CONDITION_RANGES.FORCED_CONVECTION.MIN}-${CONDITION_RANGES.FORCED_CONVECTION.MAX} W/(m²·K)`);
    }

    if (windSpeed > 10 && h_c < CONDITION_RANGES.HIGH_WIND.MIN) {
      warnings.push(`Low convective coefficient (${h_c.toFixed(2)} W/(m²·K)) for high wind speed (${windSpeed.toFixed(2)} m/s) - expected high wind range: ${CONDITION_RANGES.HIGH_WIND.MIN}-${CONDITION_RANGES.HIGH_WIND.MAX} W/(m²·K)`);
    }
  }

  return {
    valid: true,
    value: h_c,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate radiative heat transfer coefficient
 * @param h_r Radiative heat transfer coefficient [W/(m²·K)]
 * @param temperature Temperature in Kelvin for context validation
 * @param component Component name ('globe' or 'wick')
 * @returns Validation result
 */
export function validateRadiativeHeatTransfer(
  h_r: any,
  temperature?: number,
  component: 'globe' | 'wick' = 'globe'
): HeatTransferValidationResult {
  const warnings: string[] = [];

  // Basic validation
  if (h_r === null || h_r === undefined) {
    return {
      valid: false,
      error: 'Radiative heat transfer coefficient is required',
    };
  }

  if (typeof h_r === 'string') {
    const parsed = parseFloat(h_r);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Radiative heat transfer coefficient must be a valid number, got: "${h_r}"`,
      };
    }
    h_r = parsed;
  }

  if (typeof h_r !== 'number') {
    return {
      valid: false,
      error: `Radiative heat transfer coefficient must be a number, got: ${typeof h_r}`,
    };
  }

  if (!isFinite(h_r)) {
    return {
      valid: false,
      error: 'Radiative heat transfer coefficient must be a finite number',
    };
  }

  // Physical limits
  if (h_r < HEAT_TRANSFER_LIMITS.RADIATIVE_MIN) {
    return {
      valid: false,
      error: `Radiative heat transfer coefficient (${h_r.toFixed(2)} W/(m²·K)) below minimum physical limit (${HEAT_TRANSFER_LIMITS.RADIATIVE_MIN} W/(m²·K))`,
    };
  }

  if (h_r > HEAT_TRANSFER_LIMITS.RADIATIVE_MAX) {
    return {
      valid: false,
      error: `Radiative heat transfer coefficient (${h_r.toFixed(2)} W/(m²·K)) exceeds maximum physical limit (${HEAT_TRANSFER_LIMITS.RADIATIVE_MAX} W/(m²·K))`,
    };
  }

  // Context validation based on temperature (h_r = 4*ε*σ*T³)
  if (temperature !== undefined && temperature > 0) {
    const expected_hr = 4 * 5.67e-8 * 0.95 * Math.pow(temperature, 3); // Using typical emissivity
    const tolerance = 0.2; // 20% tolerance

    if (Math.abs(h_r - expected_hr) > tolerance * expected_hr) {
      warnings.push(`Radiative coefficient (${h_r.toFixed(2)} W/(m²·K)) deviates significantly from theoretical value (${expected_hr.toFixed(2)} W/(m²·K)) at ${temperature.toFixed(1)} K`);
    }
  }

  return {
    valid: true,
    value: h_r,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate evaporative heat transfer coefficient
 * @param h_e Evaporative heat transfer coefficient [W/(m²·K)]
 * @param humidity Relative humidity for context validation
 * @param windSpeed Wind speed in m/s for context validation
 * @returns Validation result
 */
export function validateEvaporativeHeatTransfer(
  h_e: any,
  humidity?: number,
  windSpeed?: number
): HeatTransferValidationResult {
  const warnings: string[] = [];

  // Basic validation
  if (h_e === null || h_e === undefined) {
    return {
      valid: false,
      error: 'Evaporative heat transfer coefficient is required',
    };
  }

  if (typeof h_e === 'string') {
    const parsed = parseFloat(h_e);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Evaporative heat transfer coefficient must be a valid number, got: "${h_e}"`,
      };
    }
    h_e = parsed;
  }

  if (typeof h_e !== 'number') {
    return {
      valid: false,
      error: `Evaporative heat transfer coefficient must be a number, got: ${typeof h_e}`,
    };
  }

  if (!isFinite(h_e)) {
    return {
      valid: false,
      error: 'Evaporative heat transfer coefficient must be a finite number',
    };
  }

  // Physical limits
  if (h_e < HEAT_TRANSFER_LIMITS.EVAPORATIVE_MIN) {
    return {
      valid: false,
      error: `Evaporative heat transfer coefficient (${h_e.toFixed(2)} W/(m²·K)) below minimum physical limit (${HEAT_TRANSFER_LIMITS.EVAPORATIVE_MIN} W/(m²·K))`,
    };
  }

  if (h_e > HEAT_TRANSFER_LIMITS.EVAPORATIVE_MAX) {
    return {
      valid: false,
      error: `Evaporative heat transfer coefficient (${h_e.toFixed(2)} W/(m²·K)) exceeds maximum physical limit (${HEAT_TRANSFER_LIMITS.EVAPORATIVE_MAX} W/(m²·K))`,
    };
  }

  // Context validation based on humidity and wind speed
  if (humidity !== undefined) {
    if (humidity > 95 && h_e > 100) {
      warnings.push(`High evaporative coefficient (${h_e.toFixed(2)} W/(m²·K)) at very high humidity (${humidity.toFixed(1)}%) - evaporation should be limited`);
    }

    if (humidity < 20 && h_e < 1) {
      warnings.push(`Low evaporative coefficient (${h_e.toFixed(2)} W/(m²·K)) at very low humidity (${humidity.toFixed(1)}%) - evaporation should be enhanced`);
    }
  }

  if (windSpeed !== undefined) {
    if (windSpeed < 0.5 && h_e > 50) {
      warnings.push(`High evaporative coefficient (${h_e.toFixed(2)} W/(m²·K)) for low wind speed (${windSpeed.toFixed(2)} m/s) - check calculation inputs`);
    }
  }

  return {
    valid: true,
    value: h_e,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate psychrometric coefficient
 * @param beta Psychrometric coefficient
 * @param pressure Pressure in Pa for context validation
 * @returns Validation result
 */
export function validatePsychrometricCoefficient(
  beta: any,
  pressure?: number
): HeatTransferValidationResult {
  const warnings: string[] = [];

  // Basic validation
  if (beta === null || beta === undefined) {
    return {
      valid: false,
      error: 'Psychrometric coefficient is required',
    };
  }

  if (typeof beta === 'string') {
    const parsed = parseFloat(beta);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Psychrometric coefficient must be a valid number, got: "${beta}"`,
      };
    }
    beta = parsed;
  }

  if (typeof beta !== 'number') {
    return {
      valid: false,
      error: `Psychrometric coefficient must be a number, got: ${typeof beta}`,
    };
  }

  if (!isFinite(beta)) {
    return {
      valid: false,
      error: 'Psychrometric coefficient must be a finite number',
    };
  }

  // Physical limits
  if (beta < HEAT_TRANSFER_LIMITS.PSYCHROMETRIC_MIN) {
    return {
      valid: false,
      error: `Psychrometric coefficient (${beta.toExponential(2)}) below minimum physical limit (${HEAT_TRANSFER_LIMITS.PSYCHROMETRIC_MIN.toExponential(2)})`,
    };
  }

  if (beta > HEAT_TRANSFER_LIMITS.PSYCHROMETRIC_MAX) {
    return {
      valid: false,
      error: `Psychrometric coefficient (${beta.toExponential(2)}) exceeds maximum physical limit (${HEAT_TRANSFER_LIMITS.PSYCHROMETRIC_MAX.toExponential(2)})`,
    };
  }

  // Context validation based on pressure (psychrometric constant γ = 0.000666 * P)
  if (pressure !== undefined && pressure > 0) {
    const expected_beta = 0.000666 * pressure; // Standard psychrometric constant
    const tolerance = 0.5; // 50% tolerance

    if (Math.abs(beta - expected_beta) > tolerance * expected_beta) {
      warnings.push(`Psychrometric coefficient (${beta.toExponential(2)}) deviates from theoretical value (${expected_beta.toExponential(2)}) at pressure ${pressure.toFixed(0)} Pa`);
    }
  }

  return {
    valid: true,
    value: beta,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}

/**
 * Validate all heat transfer coefficients
 * @param coefficients Heat transfer coefficient object
 * @param context Environmental context (wind speed, temperature, humidity, pressure)
 * @returns Comprehensive validation result
 */
export function validateAllHeatTransferCoefficients(
  coefficients: Record<string, any>,
  context: {
    windSpeed?: number;
    temperature?: number;    // in Kelvin
    humidity?: number;      // relative humidity %
    pressure?: number;      // in Pa
  } = {}
): AllHeatTransferValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  const values: AllHeatTransferValidationResult['values'] = {};

  // Validate globe convective coefficient
  if (coefficients.h_cg !== undefined) {
    const result = validateConvectiveHeatTransfer(coefficients.h_cg, context.windSpeed, 'globe');
    if (!result.valid) {
      errors.h_cg = result.error!;
    } else {
      values.h_cg = result.value;
      if (result.warnings) {
        warnings.h_cg = result.warnings.join('; ');
      }
    }
  }

  // Validate globe radiative coefficient
  if (coefficients.h_rg !== undefined) {
    const result = validateRadiativeHeatTransfer(coefficients.h_rg, context.temperature, 'globe');
    if (!result.valid) {
      errors.h_rg = result.error!;
    } else {
      values.h_rg = result.value;
      if (result.warnings) {
        warnings.h_rg = result.warnings.join('; ');
      }
    }
  }

  // Validate wick convective coefficient
  if (coefficients.h_cw !== undefined) {
    const result = validateConvectiveHeatTransfer(coefficients.h_cw, context.windSpeed, 'wick');
    if (!result.valid) {
      errors.h_cw = result.error!;
    } else {
      values.h_cw = result.value;
      if (result.warnings) {
        warnings.h_cw = result.warnings.join('; ');
      }
    }
  }

  // Validate wick radiative coefficient
  if (coefficients.h_rw !== undefined) {
    const result = validateRadiativeHeatTransfer(coefficients.h_rw, context.temperature, 'wick');
    if (!result.valid) {
      errors.h_rw = result.error!;
    } else {
      values.h_rw = result.value;
      if (result.warnings) {
        warnings.h_rw = result.warnings.join('; ');
      }
    }
  }

  // Validate evaporative coefficient
  if (coefficients.h_ew !== undefined) {
    const result = validateEvaporativeHeatTransfer(coefficients.h_ew, context.humidity, context.windSpeed);
    if (!result.valid) {
      errors.h_ew = result.error!;
    } else {
      values.h_ew = result.value;
      if (result.warnings) {
        warnings.h_ew = result.warnings.join('; ');
      }
    }
  }

  // Validate psychrometric coefficient
  if (coefficients.beta !== undefined) {
    const result = validatePsychrometricCoefficient(coefficients.beta, context.pressure);
    if (!result.valid) {
      errors.beta = result.error!;
    } else {
      values.beta = result.value;
      if (result.warnings) {
        warnings.beta = result.warnings.join('; ');
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    warnings,
    values: Object.keys(errors).length === 0 ? values : undefined,
  };
}

/**
 * Validate heat transfer coefficients or throw error
 * @throws WeatherParameterError if validation fails
 */
export function validateHeatTransferCoefficientsOrThrow(
  coefficients: Record<string, any>,
  context: {
    windSpeed?: number;
    temperature?: number;
    humidity?: number;
    pressure?: number;
  } = {}
): Record<string, number> {
  const result = validateAllHeatTransferCoefficients(coefficients, context);
  if (!result.valid) {
    const errorMsg = `Heat transfer coefficient validation failed: ${Object.values(result.errors).join('; ')}`;
    if (Object.keys(result.warnings).length > 0) {
      console.warn(`Heat transfer coefficient warnings: ${Object.values(result.warnings).join('; ')}`);
    }
    throw new WeatherParameterError(errorMsg, { errors: result.errors, warnings: result.warnings });
  }

  // Log warnings if any
  if (Object.keys(result.warnings).length > 0) {
    console.warn(`Heat transfer coefficient warnings: ${Object.values(result.warnings).join('; ')}`);
  }

  return result.values!;
}