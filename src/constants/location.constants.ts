/**
 * Location Constants
 *
 * Default locations and geographic configuration
 */

import type { LocationConfig, TimezoneConfig } from '../types/wbgt-calculation.types';

// === Timezone Configurations ===

/**
 * Sydney/Melbourne/Brisbane timezone configuration
 * Australian Eastern Standard Time / Australian Eastern Daylight Time
 */
export const SYDNEY_TIMEZONE: TimezoneConfig = {
  name: 'Australia/Sydney',
  abbreviation: 'AEDT/AEST',
  getOffset: (date: Date) => {
    // UTC+10 (AEST) or UTC+11 (AEDT during daylight saving)
    // Daylight saving: First Sunday in October to First Sunday in April
    const month = date.getMonth();
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();

    // October to April: daylight saving
    if (month >= 9 || month <= 3) {
      // Check first Sunday of October (DST start)
      if (month === 9) {
        const firstSunday = 1 + ((7 - new Date(date.getFullYear(), 9, 1).getDay()) % 7);
        if (dayOfMonth >= firstSunday) return 11 * 3600; // UTC+11
        else return 10 * 3600; // UTC+10
      }
      // April: Check first Sunday (DST end)
      if (month === 3) {
        const firstSunday = 1 + ((7 - new Date(date.getFullYear(), 3, 1).getDay()) % 7);
        if (dayOfMonth < firstSunday) return 11 * 3600; // UTC+11
        else return 10 * 3600; // UTC+10
      }
      return 11 * 3600; // UTC+11 (November - March)
    }
    return 10 * 3600; // UTC+10 (May - September)
  },
  hasDST: true,
};

/**
 * Japan Standard Time timezone configuration
 * No daylight saving time
 */
export const JST_TIMEZONE: TimezoneConfig = {
  name: 'Asia/Tokyo',
  abbreviation: 'JST',
  getOffset: (date: Date) => {
    return 9 * 3600; // UTC+9 year-round
  },
  hasDST: false,
};

/**
 * UTC timezone configuration
 */
export const UTC_TIMEZONE: TimezoneConfig = {
  name: 'UTC',
  abbreviation: 'UTC',
  getOffset: (date: Date) => {
    return 0;
  },
  hasDST: false,
};

// === Location Configurations ===

/**
 * Sydney, Australia - Default location
 */
export const SYDNEY_LOCATION: LocationConfig = {
  name: 'Sydney, Australia',
  latitude: -33.8018,
  longitude: 151.1254,
  timezone: SYDNEY_TIMEZONE,
};

/**
 * Tokyo, Japan
 */
export const TOKYO_LOCATION: LocationConfig = {
  name: 'Tokyo, Japan',
  latitude: 35.6762,
  longitude: 139.6503,
  timezone: JST_TIMEZONE,
};

/**
 * New York, USA
 */
export const NEW_YORK_LOCATION: LocationConfig = {
  name: 'New York, USA',
  latitude: 40.7128,
  longitude: -74.006,
  timezone: UTC_TIMEZONE, // TODO: Implement EST/EDT
};

/**
 * Default location (Sydney)
 */
export const DEFAULT_LOCATION = SYDNEY_LOCATION;

/**
 * BOM Location ID for Sydney observations
 */
export const BOM_SYDNEY_LOCATION_ID = 'r3grwp';

/**
 * Supported locations for quick access
 */
export const SUPPORTED_LOCATIONS: Record<string, LocationConfig> = {
  sydney: SYDNEY_LOCATION,
  tokyo: TOKYO_LOCATION,
  'new-york': NEW_YORK_LOCATION,
} as const;
