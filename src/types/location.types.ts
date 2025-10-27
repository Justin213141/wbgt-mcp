/**
 * Location Type Definitions
 *
 * Types for geographic coordinates, locations, and bounds
 */

/**
 * Coordinate Pair
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Geographic Location
 */
export interface Location extends Coordinate {
  name?: string;
  timezone?: string;
  elevation_m?: number;
}

/**
 * Bounding Box for Geographic Region
 */
export interface BoundingBox {
  min_latitude: number;
  max_latitude: number;
  min_longitude: number;
  max_longitude: number;
}

/**
 * Timezone Information
 */
export interface TimezoneInfo {
  name: string;
  abbreviation: string;
  utc_offset_seconds: number;
  has_daylight_saving_time: boolean;
}

/**
 * Predefined locations for common use cases
 */
export const PREDEFINED_LOCATIONS = {
  SYDNEY: {
    name: 'Sydney, Australia',
    latitude: -33.8018,
    longitude: 151.1254,
    elevation_m: 58,
  },
  TOKYO: {
    name: 'Tokyo, Japan',
    latitude: 35.6762,
    longitude: 139.6503,
    elevation_m: 40,
  },
} as const;
