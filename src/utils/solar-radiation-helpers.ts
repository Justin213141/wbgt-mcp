/**
 * Solar Radiation Helper Functions
 * Extracted from lookupSolarRadiation to improve maintainability
 */

/**
 * Solar radiation lookup result with metadata
 */
export interface SolarRadiationLookupResult {
  value: number;
  matchedKey: string;
  matchType: 'exact' | 'nearest' | 'fallback';
  timeDiffMinutes?: number;
}

/**
 * Parse BOM compact timestamp (14 digits) to Date
 * "20251020110000" -> Date
 */
export function parseCompactBOMTimestamp(compactTimestamp: string): Date {
  const isoFormat = parseBOMTime(compactTimestamp);
  return new Date(isoFormat);
}

/**
 * Parse BOM short format timestamp "20/11:00am" to Date
 */
export function parseShortBOMTimestamp(shortTimestamp: string): { date: Date; formatted: string } {
  const match = shortTimestamp.match(/^(\d{2})\/(\d{1,2}):(\d{2})([ap]m)$/i);
  if (!match) {
    throw new Error(`Invalid short BOM timestamp format: ${shortTimestamp}`);
  }

  const day = parseInt(match[1]);
  let hour = parseInt(match[2]);
  const minute = parseInt(match[3]);
  const ampm = match[4].toLowerCase();

  // Convert 12-hour to 24-hour
  if (ampm === 'pm' && hour !== 12) {
    hour += 12;
  } else if (ampm === 'am' && hour === 12) {
    hour = 0;
  }

  // Infer year and month from current date (BOM observations are always recent)
  const now = new Date();
  const nowSydney = new Date(now.getTime() + (11 * 60 * 60 * 1000)); // Approximate Sydney time
  let year = nowSydney.getUTCFullYear();
  let month = nowSydney.getUTCMonth() + 1; // 1-indexed for formatting

  // If day > current day in Sydney, assume it's from previous month
  if (day > nowSydney.getUTCDate()) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }

  // Round to nearest hour and build formatted timestamp
  const roundedHour = minute >= 30 ? (hour + 1) % 24 : hour;
  const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(roundedHour).padStart(2, '0')}:00`;

  const date = new Date(Date.UTC(year, month - 1, day, roundedHour, 0, 0, 0));

  return { date, formatted };
}

/**
 * Format date to Open-Meteo timestamp format "2025-10-20T11:00"
 */
export function formatDateToOpenMeteoFormat(date: Date): string {
  // Round to nearest hour
  const minutes = date.getMinutes();
  if (minutes >= 30) {
    date.setHours(date.getHours() + 1);
  }
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);

  // Format to match Open-Meteo format
  const isoString = date.toISOString();
  return isoString.slice(0, 16); // "2025-10-20T11:00"
}

/**
 * Try exact match in solar radiation map
 */
export function tryExactMatch(
  timestamp: string,
  solarRadiationMap: Map<string, number>
): SolarRadiationLookupResult | null {
  if (solarRadiationMap.has(timestamp)) {
    return {
      value: solarRadiationMap.get(timestamp)!,
      matchedKey: timestamp,
      matchType: 'exact'
    };
  }
  return null;
}

/**
 * Find nearest timestamp within ±30 minutes
 */
export function findNearestMatch(
  targetDate: Date,
  solarRadiationMap: Map<string, number>
): SolarRadiationLookupResult {
  const targetTime = targetDate.getTime();
  let nearest = 0;
  let minDiff = Infinity;
  let matchedKey = '';

  for (const [key, value] of solarRadiationMap.entries()) {
    const srDate = new Date(key);
    const diff = Math.abs(srDate.getTime() - targetTime);

    // Only consider matches within ±30 minutes (for hourly data)
    if (diff <= 30 * 60 * 1000 && diff < minDiff) {
      minDiff = diff;
      nearest = value;
      matchedKey = key;
    }
  }

  return {
    value: nearest,
    matchedKey,
    matchType: 'nearest',
    timeDiffMinutes: minDiff / 60000
  };
}

/**
 * Determine timestamp format type
 */
export type TimestampFormat = 'compact' | 'short' | 'iso' | 'unknown';

export function detectTimestampFormat(timestamp: string): TimestampFormat {
  if (/^\d{14}$/.test(timestamp)) {
    return 'compact';
  }
  if (/^\d{2}\/\d{1,2}:\d{2}[ap]m$/i.test(timestamp)) {
    return 'short';
  }
  try {
    new Date(timestamp);
    return 'iso';
  } catch {
    return 'unknown';
  }
}

/**
 * Parse timestamp based on detected format
 */
export function parseTimestampByFormat(
  timestamp: string,
  format: TimestampFormat
): { date: Date; formatted?: string } {
  switch (format) {
    case 'compact':
      return { date: parseCompactBOMTimestamp(timestamp) };

    case 'short':
      return parseShortBOMTimestamp(timestamp);

    case 'iso':
      return { date: new Date(timestamp) };

    default:
      throw new Error(`Unknown timestamp format: ${timestamp}`);
  }
}

/**
 * Main solar radiation lookup function using helper functions
 */
export function lookupSolarRadiation(
  bomTimestamp: string,
  srMap: Map<string, number>,
  debugFirst: boolean = false
): SolarRadiationLookupResult {
  if (debugFirst) {
    console.log('[DEBUG LOOKUP] BOM timestamp:', bomTimestamp);
    console.log('[DEBUG LOOKUP] Map size:', srMap.size);
  }

  // Try exact match first (fastest path)
  const exactMatch = tryExactMatch(bomTimestamp, srMap);
  if (exactMatch) {
    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Exact match found:', exactMatch.value);
    }
    return exactMatch;
  }

  try {
    // Detect and parse timestamp format
    const format = detectTimestampFormat(bomTimestamp);
    if (format === 'unknown') {
      if (debugFirst) {
        console.log('[DEBUG LOOKUP] Unknown timestamp format');
      }
      return { value: 0, matchedKey: '', matchType: 'fallback' };
    }

    const { date, formatted } = parseTimestampByFormat(bomTimestamp, format);

    if (isNaN(date.getTime())) {
      if (debugFirst) {
        console.log('[DEBUG LOOKUP] Invalid date');
      }
      return { value: 0, matchedKey: '', matchType: 'fallback' };
    }

    // Use pre-formatted timestamp if available (from short format parsing)
    const targetFormatted = formatted || formatDateToOpenMeteoFormat(date);

    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Parsed date:', date.toISOString());
      console.log('[DEBUG LOOKUP] Target formatted:', targetFormatted);
    }

    // Try exact match with formatted timestamp
    const formattedMatch = tryExactMatch(targetFormatted, srMap);
    if (formattedMatch) {
      if (debugFirst) {
        console.log('[DEBUG LOOKUP] Formatted match found:', formattedMatch.value);
      }
      return formattedMatch;
    }

    // Find nearest match as fallback
    const nearestMatch = findNearestMatch(date, srMap);

    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Nearest match:', nearestMatch.value,
                  'key:', nearestMatch.matchedKey,
                  'diff:', nearestMatch.timeDiffMinutes, 'minutes');
    }

    return nearestMatch;

  } catch (error) {
    if (debugFirst) {
      console.log('[DEBUG LOOKUP] Error:', error);
    }
    return { value: 0, matchedKey: '', matchType: 'fallback' };
  }
}

/**
 * Legacy function wrapper for backward compatibility
 * Returns just the value like the original function
 */
export function lookupSolarRadiationLegacy(
  bomTimestamp: string,
  srMap: Map<string, number>,
  debugFirst: boolean = false
): number {
  const result = lookupSolarRadiation(bomTimestamp, srMap, debugFirst);
  return result.value;
}

// Import parseBOMTime from main index file for helper functions
function parseBOMTime(bomTime: string): string {
  return `${bomTime.slice(0,4)}-${bomTime.slice(4,6)}-${bomTime.slice(6,8)}T${bomTime.slice(8,10)}:${bomTime.slice(10,12)}`;
}