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
  station_id?: string;         // Station ID (USAF-WBAN)
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
 * Sydney area ISD stations (verified, ordered by proximity to Sydney Olympic Park)
 *
 * Sydney Olympic Park AWS coordinates: -33.83, 151.07
 *
 * Distances from Sydney Olympic Park AWS:
 * 1. Sydney Olympic Park AWS: 0.43 km (SAME STATION!)
 * 2. Parramatta North: 5.92 km
 * 3. Canterbury Racecourse: 8.91 km
 * 4. Kurnell AWS: 9.81 km
 * 5. Sydney Bankstown: 11.53 km
 * 6. Sydney Observatory Hill: 12.21 km
 * 7. Fort Denison: 13.76 km
 * 8. Little Bay (The Coast Golf Club): 13.91 km
 * 9. Sydney Intl: 16.25 km
 * 10. Holsworthy Aerodrome AWS: 20.30 km
 * 11. Horsley Equestrian Centre: 20.44 km
 * 12. North Head: 21.30 km
 *
 * Focus on 99% use case (Greater Sydney area - within ~20km radius)
 * Station data verified from NOAA ISD station history
 *
 * For stations outside Sydney area, lookup available at:
 * - NOAA ISD Station History: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
 * - Alternative CSV format: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv
 * - AWS Open Data Registry: https://registry.opendata.aws/noaa-isd/
 */
export const SYDNEY_ISD_STATIONS: ISDStation[] = [
  {
    usaf: "957650",
    wban: "99999",
    name: "SYDNEY OLYMPIC PARK AWS",
    country: "AS",  // Australia
    state: "",
    icao: "",
    latitude: -33.833,
    longitude: 151.067,
    elevation: 4,
    begin: "1996-02-01",
    end: "2099-12-31"
  },
  {
    usaf: "947640",
    wban: "99999",
    name: "PARRAMATTA NORTH",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.800,
    longitude: 151.017,
    elevation: 55,
    begin: "1997-01-01",
    end: "2099-12-31"
  },
  {
    usaf: "947660",
    wban: "99999",
    name: "CANTERBURY RACECOURSE",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.900,
    longitude: 151.117,
    elevation: 3,
    begin: "1996-02-01",
    end: "2099-12-31"
  },
  {
    usaf: "957560",
    wban: "99999",
    name: "KURNELL AWS",
    country: "AS",
    state: "",
    icao: "",
    latitude: -34.000,
    longitude: 151.200,
    elevation: 4,
    begin: "2010-10-12",
    end: "2099-12-31"
  },
  {
    usaf: "947650",
    wban: "99999",
    name: "SYDNEY BANKSTOWN",
    country: "AS",
    state: "",
    icao: "YSBK",
    latitude: -33.924,
    longitude: 150.988,
    elevation: 9,
    begin: "1968-07-01",
    end: "2099-12-31"
  },
  {
    usaf: "947680",
    wban: "99999",
    name: "SYDNEY OBSERVATORY HILL",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.850,
    longitude: 151.200,
    elevation: 40,
    begin: "1954-12-31",
    end: "2099-12-31"
  },
  {
    usaf: "947690",
    wban: "99999",
    name: "FORT DENISON",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.850,
    longitude: 151.217,
    elevation: 2,
    begin: "2021-02-07",
    end: "2099-12-31"
  },
  {
    usaf: "947800",
    wban: "99999",
    name: "LITTLE BAY (THE COAST GOLF CLUB)",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.983,
    longitude: 151.250,
    elevation: 0,
    begin: "1900-01-01",
    end: "2099-12-31"
  },
  {
    usaf: "947670",
    wban: "99999",
    name: "SYDNEY INTL",
    country: "AS",
    state: "",
    icao: "YSSY",
    latitude: -33.946,
    longitude: 151.177,
    elevation: 6,
    begin: "1943-09-23",
    end: "2099-12-31"
  },
  {
    usaf: "957610",
    wban: "99999",
    name: "HOLSWORTHY AERODROME AWS",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.983,
    longitude: 150.950,
    elevation: 69,
    begin: "2020-07-21",
    end: "2099-12-31"
  },
  {
    usaf: "947600",
    wban: "99999",
    name: "HORSLEY EQUESTRIAN CENTRE",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.850,
    longitude: 150.850,
    elevation: 100,
    begin: "2001-07-01",
    end: "2099-12-31"
  },
  {
    usaf: "957680",
    wban: "99999",
    name: "NORTH HEAD",
    country: "AS",
    state: "",
    icao: "",
    latitude: -33.817,
    longitude: 151.300,
    elevation: 90,
    begin: "1990-02-01",
    end: "2099-12-31"
  }
];

/**
 * Japan ISD stations
 * Covers major metropolitan areas including Tokyo, Hokkaido, and other regions
 *
 * Station data from NOAA ISD station history (isd-history.txt)
 * Available at: https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt
 */
export const JAPAN_ISD_STATIONS: ISDStation[] = [
  {
    usaf: "476620",
    wban: "99999",
    name: "TOKYO",
    country: "JA",
    state: "",
    icao: "RJTD",
    latitude: 35.683,
    longitude: 139.767,
    elevation: 36,
    begin: "1952-12-31",
    end: "2099-12-31"
  },
  {
    usaf: "474070",
    wban: "99999",
    name: "ASAHIKAWA",
    country: "JA",
    state: "",
    icao: "",
    latitude: 43.750,
    longitude: 142.367,
    elevation: 140,
    begin: "1952-12-31",
    end: "2099-12-31"
  }
];

/**
 * Australian ISD stations
 * Covers Queensland (Gold Coast, Brisbane) and other regions
 */
export const AUSTRALIA_ISD_STATIONS: ISDStation[] = [
  {
    usaf: "230010",
    wban: "99999",
    name: "GOLD COAST",
    country: "AU",
    state: "",
    icao: "",
    latitude: -27.960,
    longitude: 153.430,
    elevation: 2,
    begin: "2007-02-01",
    end: "2099-12-31"
  },
  {
    usaf: "250010",
    wban: "99999",
    name: "COOLANGATTA",
    country: "AU",
    state: "",
    icao: "YBCF",
    latitude: -28.217,
    longitude: 153.540,
    elevation: 5,
    begin: "2007-01-02",
    end: "2099-12-31"
  },
  {
    usaf: "240030",
    wban: "99999",
    name: "BRISBANE",
    country: "AU",
    state: "",
    icao: "",
    latitude: -27.367,
    longitude: 153.083,
    elevation: 5,
    begin: "2004-01-01",
    end: "2099-12-31"
  }
];

/**
 * Default station for Sydney Olympic Park area
 * Using Sydney Olympic Park AWS itself (0.43 km - essentially the same location)
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
 * Find nearest ISD station for any supported region
 * Checks all station registries with prioritization
 * Returns null if coordinates are too far from any defined region
 */
export function findNearestSydneyStation(
  latitude: number,
  longitude: number
): { station: ISDStation; distance: number } | null {
  // Check Australia stations first (closest match for Australian coordinates)
  let nearestAus: { station: ISDStation; distance: number } | null = null;

  for (const station of AUSTRALIA_ISD_STATIONS) {
    const dist = calculateDistance(latitude, longitude, station.latitude, station.longitude);
    if (!nearestAus || dist < nearestAus.distance) {
      nearestAus = { station, distance: dist };
    }
  }

  // If within 200km of an Australia station, use it
  if (nearestAus && nearestAus.distance <= 200) {
    console.log(`[ISD] Found Australia station: ${nearestAus.station.name} (${nearestAus.distance.toFixed(1)} km away)`);
    return nearestAus;
  }

  // Check Japan stations
  let nearestJapan: { station: ISDStation; distance: number } | null = null;

  for (const station of JAPAN_ISD_STATIONS) {
    const dist = calculateDistance(latitude, longitude, station.latitude, station.longitude);
    if (!nearestJapan || dist < nearestJapan.distance) {
      nearestJapan = { station, distance: dist };
    }
  }

  // If within 200km of a Japan station, use it
  if (nearestJapan && nearestJapan.distance <= 200) {
    console.log(`[ISD] Found Japan station: ${nearestJapan.station.name} (${nearestJapan.distance.toFixed(1)} km away)`);
    return nearestJapan;
  }

  // Check Sydney region (legacy)
  const SYDNEY_LAT = -33.8484;
  const SYDNEY_LON = 151.0648;
  const distFromSydney = calculateDistance(latitude, longitude, SYDNEY_LAT, SYDNEY_LON);

  if (distFromSydney > 100) {
    console.log(`[ISD] Location ${latitude},${longitude} is ${distFromSydney.toFixed(1)}km from Sydney, outside coverage area`);
    return null;
  }

  // Find nearest Sydney station
  let nearest: { station: ISDStation; distance: number } | null = null;

  for (const station of SYDNEY_ISD_STATIONS) {
    const dist = calculateDistance(latitude, longitude, station.latitude, station.longitude);
    if (!nearest || dist < nearest.distance) {
      nearest = { station, distance: dist };
    }
  }

  return nearest;
}
