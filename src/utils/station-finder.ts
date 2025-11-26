/**
 * Station Finder Utility
 *
 * Finds the nearest BOM weather station to a given latitude/longitude
 * using the Haversine formula for great-circle distance calculation.
 */

import type { BOMStation } from '../data/bom-stations';
import { ALL_BOM_STATIONS, DEFAULT_BOM_STATION } from '../data/bom-stations';
import type { WeatherZoneStation } from '../data/weatherzone-stations';
import { ALL_WEATHERZONE_STATIONS, DEFAULT_WEATHERZONE_STATION } from '../data/weatherzone-stations';

/**
 * Maximum distance (in kilometers) to search for a BOM station.
 * If no station is within this radius, we fall back to OpenMeteo only.
 */
const MAX_STATION_DISTANCE_KM = 50;

/**
 * Calculate the great-circle distance between two points on Earth
 * using the Haversine formula.
 *
 * @param lat1 Latitude of point 1 (decimal degrees)
 * @param lon1 Longitude of point 1 (decimal degrees)
 * @param lat2 Latitude of point 2 (decimal degrees)
 * @param lon2 Longitude of point 2 (decimal degrees)
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const EARTH_RADIUS_KM = 6371;

  // Convert degrees to radians
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Find the nearest BOM station to a given location.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @param maxDistanceKm Maximum search radius (default: 50km)
 * @returns Nearest station if within radius, or null if none found
 */
export function findNearestStation(
  latitude: number,
  longitude: number,
  maxDistanceKm: number = MAX_STATION_DISTANCE_KM
): { station: BOMStation; distance: number } | null {
  let nearestStation: BOMStation | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const station of ALL_BOM_STATIONS) {
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      station.latitude,
      station.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = station;
    }
  }

  // Return null if no station found within the maximum distance
  if (nearestStation === null || minDistance > maxDistanceKm) {
    return null;
  }

  return {
    station: nearestStation,
    distance: minDistance
  };
}

/**
 * Find the nearest BOM station, with fallback to default.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @returns Nearest station within 50km, or default station if none found
 */
export function findNearestStationOrDefault(
  latitude: number,
  longitude: number
): BOMStation {
  const result = findNearestStation(latitude, longitude);
  return result ? result.station : DEFAULT_BOM_STATION;
}

/**
 * Find the nearest WeatherZone station to a given location.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @param maxDistanceKm Maximum search radius (default: 50km)
 * @returns Nearest station if within radius, or null if none found
 */
export function findNearestWeatherZoneStation(
  latitude: number,
  longitude: number,
  maxDistanceKm: number = MAX_STATION_DISTANCE_KM
): { station: WeatherZoneStation; distance: number } | null {
  let nearestStation: WeatherZoneStation | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const station of ALL_WEATHERZONE_STATIONS) {
    const distance = calculateHaversineDistance(
      latitude,
      longitude,
      station.latitude,
      station.longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestStation = station;
    }
  }

  // Return null if no station found within the maximum distance
  if (nearestStation === null || minDistance > maxDistanceKm) {
    return null;
  }

  return {
    station: nearestStation,
    distance: minDistance
  };
}

/**
 * Find the nearest WeatherZone station, with fallback to default.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @returns Nearest station within 50km, or default station if none found
 */
export function findNearestWeatherZoneStationOrDefault(
  latitude: number,
  longitude: number
): WeatherZoneStation {
  const result = findNearestWeatherZoneStation(latitude, longitude);
  return result ? result.station : DEFAULT_WEATHERZONE_STATION;
}

/**
 * Determine the WeatherZone data source based on location.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @returns Object with station (if applicable) and source type
 */
export function determineWeatherZoneDataSource(
  latitude: number,
  longitude: number
): {
  station: WeatherZoneStation | null;
  source: string;
  distance?: number;
} {
  const result = findNearestWeatherZoneStation(latitude, longitude);

  if (result) {
    return {
      station: result.station,
      source: `WeatherZone ${result.station.name}`,
      distance: result.distance
    };
  }

  // No WeatherZone station within range, return null
  return {
    station: null,
    source: 'No WeatherZone station within range',
    distance: undefined
  };
}

/**
 * Determine the data source based on location.
 *
 * @param latitude Target latitude
 * @param longitude Target longitude
 * @returns Object with station (if applicable) and source type
 */
export function determineDataSource(
  latitude: number,
  longitude: number
): {
  station: BOMStation | null;
  source: string;
  distance?: number;
} {
  const result = findNearestStation(latitude, longitude);

  if (result) {
    return {
      station: result.station,
      source: result.station.name,
      distance: result.distance
    };
  }

  // No BOM station within range, use OpenMeteo only
  return {
    station: null,
    source: 'OpenMeteo',
    distance: undefined
  };
}
