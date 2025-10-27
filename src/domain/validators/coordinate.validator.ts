/**
 * Coordinate Validation
 *
 * Validators for latitude and longitude coordinates
 */

import { CoordinateError } from '../../utils/errors';

/**
 * Coordinate validation result
 */
export interface CoordinateValidationResult {
  valid: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}

/**
 * Valid coordinate bounds
 */
export const COORDINATE_BOUNDS = {
  LATITUDE_MIN: -90,
  LATITUDE_MAX: 90,
  LONGITUDE_MIN: -180,
  LONGITUDE_MAX: 180,
} as const;

/**
 * Validate latitude value
 * @param latitude Latitude in degrees
 * @returns Validation result with error if invalid
 */
export function validateLatitude(latitude: any): CoordinateValidationResult {
  // Check if undefined/null
  if (latitude === null || latitude === undefined) {
    return {
      valid: false,
      error: 'Latitude is required',
    };
  }

  // Check if string, try to parse
  if (typeof latitude === 'string') {
    const parsed = parseFloat(latitude);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Latitude must be a valid number, got: "${latitude}"`,
      };
    }
    latitude = parsed;
  }

  // Check if number
  if (typeof latitude !== 'number') {
    return {
      valid: false,
      error: `Latitude must be a number, got: ${typeof latitude}`,
    };
  }

  // Check for NaN
  if (isNaN(latitude)) {
    return {
      valid: false,
      error: 'Latitude is NaN',
    };
  }

  // Check for infinity
  if (!isFinite(latitude)) {
    return {
      valid: false,
      error: 'Latitude must be a finite number',
    };
  }

  // Check range
  if (latitude < COORDINATE_BOUNDS.LATITUDE_MIN || latitude > COORDINATE_BOUNDS.LATITUDE_MAX) {
    return {
      valid: false,
      error: `Latitude must be between ${COORDINATE_BOUNDS.LATITUDE_MIN} and ${COORDINATE_BOUNDS.LATITUDE_MAX}, got: ${latitude}`,
    };
  }

  return {
    valid: true,
    latitude,
  };
}

/**
 * Validate longitude value
 * @param longitude Longitude in degrees
 * @returns Validation result with error if invalid
 */
export function validateLongitude(longitude: any): CoordinateValidationResult {
  // Check if undefined/null
  if (longitude === null || longitude === undefined) {
    return {
      valid: false,
      error: 'Longitude is required',
    };
  }

  // Check if string, try to parse
  if (typeof longitude === 'string') {
    const parsed = parseFloat(longitude);
    if (isNaN(parsed)) {
      return {
        valid: false,
        error: `Longitude must be a valid number, got: "${longitude}"`,
      };
    }
    longitude = parsed;
  }

  // Check if number
  if (typeof longitude !== 'number') {
    return {
      valid: false,
      error: `Longitude must be a number, got: ${typeof longitude}`,
    };
  }

  // Check for NaN
  if (isNaN(longitude)) {
    return {
      valid: false,
      error: 'Longitude is NaN',
    };
  }

  // Check for infinity
  if (!isFinite(longitude)) {
    return {
      valid: false,
      error: 'Longitude must be a finite number',
    };
  }

  // Check range
  if (longitude < COORDINATE_BOUNDS.LONGITUDE_MIN || longitude > COORDINATE_BOUNDS.LONGITUDE_MAX) {
    return {
      valid: false,
      error: `Longitude must be between ${COORDINATE_BOUNDS.LONGITUDE_MIN} and ${COORDINATE_BOUNDS.LONGITUDE_MAX}, got: ${longitude}`,
    };
  }

  return {
    valid: true,
    longitude,
  };
}

/**
 * Validate a pair of coordinates
 * @param latitude Latitude in degrees
 * @param longitude Longitude in degrees
 * @returns Validation result with error if invalid
 */
export function validateCoordinates(
  latitude: any,
  longitude: any
): CoordinateValidationResult {
  // Validate latitude
  const latResult = validateLatitude(latitude);
  if (!latResult.valid) {
    return latResult;
  }

  // Validate longitude
  const lonResult = validateLongitude(longitude);
  if (!lonResult.valid) {
    return lonResult;
  }

  return {
    valid: true,
    latitude: latResult.latitude!,
    longitude: lonResult.longitude!,
  };
}

/**
 * Validate coordinates or throw CoordinateError
 * @throws CoordinateError if validation fails
 */
export function validateCoordinatesOrThrow(latitude: any, longitude: any): void {
  const result = validateCoordinates(latitude, longitude);
  if (!result.valid) {
    throw new CoordinateError(result.error!, {
      latitude,
      longitude,
    });
  }
}

/**
 * Validate latitude or throw CoordinateError
 * @throws CoordinateError if validation fails
 */
export function validateLatitudeOrThrow(latitude: any): number {
  const result = validateLatitude(latitude);
  if (!result.valid) {
    throw new CoordinateError(result.error!, { latitude });
  }
  return result.latitude!;
}

/**
 * Validate longitude or throw CoordinateError
 * @throws CoordinateError if validation fails
 */
export function validateLongitudeOrThrow(longitude: any): number {
  const result = validateLongitude(longitude);
  if (!result.valid) {
    throw new CoordinateError(result.error!, { longitude });
  }
  return result.longitude!;
}

/**
 * Check if coordinates are within a certain distance (simple Euclidean, not geodetic)
 * @param lat1 First latitude
 * @param lon1 First longitude
 * @param lat2 Second latitude
 * @param lon2 Second longitude
 * @param maxDistanceDegrees Maximum allowed distance in degrees
 * @returns true if within distance, false otherwise
 */
export function coordinatesAreClose(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  maxDistanceDegrees: number = 0.1
): boolean {
  const latDiff = Math.abs(lat1 - lat2);
  const lonDiff = Math.abs(lon1 - lon2);
  const distance = Math.sqrt(latDiff ** 2 + lonDiff ** 2);
  return distance <= maxDistanceDegrees;
}
