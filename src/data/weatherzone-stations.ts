/**
 * WeatherZone Weather Station Database
 *
 * This file contains metadata for WeatherZone weather observation stations.
 * Currently includes Sydney metropolitan area and surrounding regions.
 *
 * Data source: https://www.weatherzone.com.au/
 * Coverage: Hourly observations via Browser Rendering API
 * Update frequency: Real-time (10-minute intervals)
 */

export interface WeatherZoneStation {
  name: string;        // Station name (e.g., "Sydney Olympic Park")
  siteId: string;      // WeatherZone site ID (e.g., "66212")
  latitude: number;    // Latitude in decimal degrees
  longitude: number;   // Longitude in decimal degrees
  region: string;      // Geographic region (e.g., "Sydney CBD", "Western Sydney")
}

/**
 * Sydney metropolitan area and NSW weather stations on WeatherZone
 * Sorted alphabetically by station name
 */
export const WEATHERZONE_STATIONS: WeatherZoneStation[] = [
  {
    name: "Sydney Olympic Park",
    siteId: "66212",
    latitude: -33.8541,
    longitude: 151.0743,
    region: "Eastern Sydney"
  },
  // Add more WeatherZone stations as they become available
  // Format: Get site ID from WeatherZone URL: weatherzone.com.au/station/SITE/{siteId}/observations
];

/**
 * Default WeatherZone station (Sydney Olympic Park)
 */
export const DEFAULT_WEATHERZONE_STATION: WeatherZoneStation = WEATHERZONE_STATIONS[0];

/**
 * All WeatherZone stations combined
 */
export const ALL_WEATHERZONE_STATIONS: WeatherZoneStation[] = [
  ...WEATHERZONE_STATIONS,
];
