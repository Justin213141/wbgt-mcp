/**
 * NOAA ISD (Integrated Surface Database) Type Definitions
 */

export interface ISDStation {
  usaf: string;           // USAF station ID (6 digits)
  wban: string;           // WBAN station ID (5 digits, or "99999" if not available)
  name: string;           // Station name
  country: string;        // Country code (2 letters)
  state: string;          // State code (2 letters for US, empty for others)
  icao: string;           // ICAO airport code (4 letters)
  latitude: number;       // Decimal degrees
  longitude: number;      // Decimal degrees
  elevation: number;      // Meters above sea level
  begin: string;          // Begin date YYYY-MM-DD
  end: string;            // End date YYYY-MM-DD
}

export interface ISDObservation {
  timestamp: string;           // ISO format UTC timestamp
  temperature?: number;        // °C
  dew_point?: number;          // °C
  relative_humidity?: number;  // % (calculated from temp + dew point)
  sea_level_pressure?: number; // hPa
  station_pressure?: number;   // hPa
  wind_speed?: number;         // m/s
  wind_direction?: number;     // degrees
  visibility?: number;         // meters
  cloud_cover?: number;        // oktas (0-8)
  present_weather?: string;    // Weather condition code
  quality: {
    temperature: string;       // Quality flag
    dew_point: string;
    pressure: string;
    wind: string;
  };
}

export interface ISDHourlyData {
  station_id: string;          // USAF-WBAN format
  station_name: string;
  observations: ISDObservation[];
  data_quality: 'good' | 'fair' | 'poor';
  missing_count: number;
  total_count: number;
}

/**
 * Hardcoded Sydney area stations for quick prototype
 * Focus on 99% use case (Sydney area)
 */
export const SYDNEY_ISD_STATIONS: ISDStation[] = [
  {
    usaf: "947670",
    wban: "99999",
    name: "SYDNEY AIRPORT",
    country: "AS",  // Australia
    state: "",
    icao: "YSSY",
    latitude: -33.946,
    longitude: 151.177,
    elevation: 6,
    begin: "1929-11-01",
    end: "2024-12-31"
  },
  {
    usaf: "947680",
    wban: "99999",
    name: "BANKSTOWN AIRPORT",
    country: "AS",
    state: "",
    icao: "YSBK",
    latitude: -33.924,
    longitude: 150.988,
    elevation: 9,
    begin: "1968-09-01",
    end: "2024-12-31"
  },
  {
    usaf: "947660",
    wban: "99999",
    name: "RICHMOND RAAF",
    country: "AS",
    state: "",
    icao: "YSRI",
    latitude: -33.600,
    longitude: 150.781,
    elevation: 20,
    begin: "1942-01-01",
    end: "2024-12-31"
  }
];

/**
 * Default station for Sydney Olympic Park area
 * Using Sydney Airport (8.3 km from SOP) as primary
 */
export const DEFAULT_SYDNEY_ISD_STATION = SYDNEY_ISD_STATIONS[0];

/**
 * Helper to format station ID for S3 path
 */
export function getStationId(station: ISDStation): string {
  return `${station.usaf}-${station.wban}`;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find nearest ISD station for Sydney area (99% use case)
 * Returns null if coordinates are too far from Sydney
 */
export function findNearestSydneyStation(
  latitude: number,
  longitude: number
): { station: ISDStation; distance: number } | null {
  // Sydney Olympic Park coordinates (reference point)
  const SYDNEY_LAT = -33.8484;
  const SYDNEY_LON = 151.0648;

  // If more than 100km from Sydney, return null (not Sydney area)
  const distFromSydney = calculateDistance(latitude, longitude, SYDNEY_LAT, SYDNEY_LON);
  if (distFromSydney > 100) {
    console.log(`[ISD] Location ${latitude},${longitude} is ${distFromSydney.toFixed(1)}km from Sydney, outside coverage area`);
    return null;
  }

  // Find nearest station
  let nearest: { station: ISDStation; distance: number } | null = null;

  for (const station of SYDNEY_ISD_STATIONS) {
    const dist = calculateDistance(latitude, longitude, station.latitude, station.longitude);
    if (!nearest || dist < nearest.distance) {
      nearest = { station, distance: dist };
    }
  }

  return nearest;
}
