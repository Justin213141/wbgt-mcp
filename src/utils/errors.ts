/**
 * Custom Error Classes
 *
 * Strongly-typed error handling for the application
 */

/**
 * Base application error
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.context,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Validation error - Input parameter validation failed
 */
export class ValidationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Coordinate validation error
 */
export class CoordinateError extends ValidationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, {
      field: 'coordinates',
      ...context,
    });
    this.name = 'CoordinateError';
    Object.setPrototypeOf(this, CoordinateError.prototype);
  }
}

/**
 * Date range validation error
 */
export class DateRangeError extends ValidationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, {
      field: 'dateRange',
      ...context,
    });
    this.name = 'DateRangeError';
    Object.setPrototypeOf(this, DateRangeError.prototype);
  }
}

/**
 * Weather parameter validation error
 */
export class WeatherParameterError extends ValidationError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, {
      field: 'weatherParameters',
      ...context,
    });
    this.name = 'WeatherParameterError';
    Object.setPrototypeOf(this, WeatherParameterError.prototype);
  }
}

/**
 * WBGT Calculation error
 */
export class WBGTCalculationError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'WBGT_CALCULATION_ERROR', 500, context);
    this.name = 'WBGTCalculationError';
    Object.setPrototypeOf(this, WBGTCalculationError.prototype);
  }
}

/**
 * External API error
 */
export class APIError extends AppError {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly statusCode: number,
    context?: Record<string, any>
  ) {
    super(message, 'API_ERROR', statusCode, {
      endpoint,
      ...context,
    });
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Open-Meteo API error
 */
export class OpenMeteoError extends APIError {
  constructor(message: string, statusCode: number, context?: Record<string, any>) {
    super(message, 'https://api.open-meteo.com', statusCode, context);
    this.name = 'OpenMeteoError';
    Object.setPrototypeOf(this, OpenMeteoError.prototype);
  }
}

/**
 * BOM (Bureau of Meteorology) API error
 */
export class BOMError extends APIError {
  constructor(message: string, statusCode: number, context?: Record<string, any>) {
    super(message, 'http://www.bom.gov.au/', statusCode, context);
    this.name = 'BOMError';
    Object.setPrototypeOf(this, BOMError.prototype);
  }
}

/**
 * Data parsing error
 */
export class DataParsingError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'DATA_PARSING_ERROR', 500, context);
    this.name = 'DataParsingError';
    Object.setPrototypeOf(this, DataParsingError.prototype);
  }
}

/**
 * Cache error
 */
export class CacheError extends AppError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CACHE_ERROR', 500, context);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number = 60) {
    super(
      'Rate limit exceeded. Please try again later.',
      'RATE_LIMIT_EXCEEDED',
      429,
      { retryAfterSeconds }
    );
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: any): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is an APIError
 */
export function isAPIError(error: any): error is APIError {
  return error instanceof APIError;
}

/**
 * Safely convert any error to AppError
 */
export function toAppError(error: any): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', 500, {
      originalError: error.name,
    });
  }

  return new AppError(String(error), 'UNKNOWN_ERROR', 500);
}

/**
 * Generic Result type for error handling
 */
export type Result<T, E extends AppError = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Create successful result
 */
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Create error result
 */
export function err<E extends AppError>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Map result to another type
 */
export function mapResult<T, U, E extends AppError>(
  result: Result<T, E>,
  fn: (data: T) => U
): Result<U, E> {
  if (result.success) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Flatten nested results
 */
export function flatMapResult<T, U, E extends AppError>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (result.success) {
    return fn(result.data);
  }
  return result;
}
