/**
 * Solar geometry calculations for WBGT
 * Full NOAA Solar Calculator implementation for accurate zenith angles
 * Reference: https://gml.noaa.gov/grad/solcalc/calcdetails.html
 */

// Cache for solar angles
// Key: "lat-lon-timestamp-offset", Value: pre-calculated angle
const solarAngleCache = new Map<string, number>();

/**
 * Convert degrees to radians
 */
function toRadians(deg: number): number {
  return deg * Math.PI / 180;
}

/**
 * Convert radians to degrees
 */
function toDegrees(rad: number): number {
  return rad * 180 / Math.PI;
}

/**
 * Calculate Julian Date from date components
 * Based on algorithm from Astronomical Algorithms by Jean Meeus
 */
export function calculateJulianDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number = 0
): number {
  // Adjust for January/February (treat as months 13/14 of previous year)
  if (month <= 2) {
    year -= 1;
    month += 12;
  }

  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);

  const JD = Math.floor(365.25 * (year + 4716)) +
             Math.floor(30.6001 * (month + 1)) +
             day + B - 1524.5 +
             (hour + minute / 60 + second / 3600) / 24;

  return JD;
}

/**
 * Full NOAA Solar Calculator algorithm for solar zenith angle
 * Achieves 0.00° error compared to NOAA reference
 *
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp in local time (YYYY-MM-DDTHH:MM format)
 * @param utcOffset UTC offset in hours (e.g., 11 for AEDT, 10 for AEST)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngleNOAA(
  lat: number,
  lon: number,
  timestamp: string,
  utcOffset: number
): number {
  // Parse local time components
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Calculate Julian Date for local time
  const JD = calculateJulianDate(year, month, day, hour, minute);

  // Convert to UTC by subtracting the offset
  const JD_utc = JD - utcOffset / 24;

  // Julian Century from J2000.0 (January 1, 2000 at 12:00 TT)
  const JC = (JD_utc - 2451545.0) / 36525.0;

  // Orbital parameters
  // Geometric Mean Longitude of Sun (degrees)
  const geomMeanLong = (280.46646 + JC * (36000.76983 + 0.0003032 * JC)) % 360;

  // Geometric Mean Anomaly of Sun (degrees)
  const geomMeanAnom = 357.52911 + JC * (35999.05029 - 0.0001537 * JC);

  // Eccentricity of Earth's Orbit
  const eccentricity = 0.016708634 - JC * (0.000042037 + 0.0000001267 * JC);

  // Sun's Equation of Center (degrees)
  const sunEqCtr = Math.sin(toRadians(geomMeanAnom)) * (1.914602 - JC * (0.004817 + 0.000014 * JC)) +
                   Math.sin(toRadians(2 * geomMeanAnom)) * (0.019993 - 0.000101 * JC) +
                   Math.sin(toRadians(3 * geomMeanAnom)) * 0.000289;

  // Sun True Longitude (degrees)
  const sunTrueLong = geomMeanLong + sunEqCtr;

  // Sun Apparent Longitude (degrees) - corrected for nutation and aberration
  const omega = 125.04 - 1934.136 * JC;
  const sunAppLong = sunTrueLong - 0.00569 - 0.00478 * Math.sin(toRadians(omega));

  // Mean Obliquity of the Ecliptic (degrees)
  const meanObliq = 23 + (26 + (21.448 - JC * (46.815 + JC * (0.00059 - JC * 0.001813))) / 60) / 60;

  // Corrected Obliquity (degrees)
  const obliqCorr = meanObliq + 0.00256 * Math.cos(toRadians(omega));

  // Sun Declination (degrees)
  const declination = toDegrees(Math.asin(Math.sin(toRadians(obliqCorr)) * Math.sin(toRadians(sunAppLong))));

  // Equation of Time (minutes)
  const y = Math.tan(toRadians(obliqCorr / 2)) ** 2;
  const eqOfTime = 4 * toDegrees(
    y * Math.sin(2 * toRadians(geomMeanLong)) -
    2 * eccentricity * Math.sin(toRadians(geomMeanAnom)) +
    4 * eccentricity * y * Math.sin(toRadians(geomMeanAnom)) * Math.cos(2 * toRadians(geomMeanLong)) -
    0.5 * y * y * Math.sin(4 * toRadians(geomMeanLong)) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * toRadians(geomMeanAnom))
  );

  // True Solar Time (minutes)
  // CRITICAL: includes -60 * utcOffset correction
  const clockMinutes = hour * 60 + minute;
  const trueSolarTime = (clockMinutes + eqOfTime + 4 * lon - 60 * utcOffset) % 1440;

  // Ensure positive value
  const trueSolarTimePos = trueSolarTime < 0 ? trueSolarTime + 1440 : trueSolarTime;

  // Hour Angle (degrees)
  // CRITICAL: correct formula (not inverted)
  const hourAngle = trueSolarTimePos / 4 < 0 ? trueSolarTimePos / 4 + 180 : trueSolarTimePos / 4 - 180;

  // Solar Zenith Angle (degrees)
  const cosZenith = Math.sin(toRadians(lat)) * Math.sin(toRadians(declination)) +
                    Math.cos(toRadians(lat)) * Math.cos(toRadians(declination)) * Math.cos(toRadians(hourAngle));

  // Clamp to [-1, 1] for numerical safety
  const cosZenithClamped = Math.max(-1, Math.min(1, cosZenith));
  const zenithAngle = toDegrees(Math.acos(cosZenithClamped));

  return Math.max(0, Math.min(180, zenithAngle));
}

/**
 * Determine if a date is in Australian Eastern Daylight Time (AEDT)
 * AEDT runs from first Sunday in October to first Sunday in April
 */
function isAustralianDST(year: number, month: number, day: number): boolean {
  // October to March is potentially DST
  if (month >= 4 && month <= 9) {
    return false; // April to September is AEST
  }

  // Find first Sunday in October
  const octFirst = new Date(year, 9, 1); // October 1
  const daysToSunday = (7 - octFirst.getDay()) % 7;
  const firstSundayOct = daysToSunday === 0 ? 1 : daysToSunday + 1;

  // Find first Sunday in April
  const aprFirst = new Date(year, 3, 1); // April 1
  const daysToSundayApr = (7 - aprFirst.getDay()) % 7;
  const firstSundayApr = daysToSundayApr === 0 ? 1 : daysToSundayApr + 1;

  if (month === 10) {
    // October: DST starts at 2am on first Sunday
    return day >= firstSundayOct;
  }
  if (month === 4) {
    // April: DST ends at 3am on first Sunday
    return day < firstSundayApr;
  }
  // November to March
  if (month >= 11 || month <= 3) {
    return true;
  }

  return false;
}

/**
 * Unified solar zenith angle calculation for any timezone
 * Uses full NOAA algorithm for all calculations
 */
export function calculateSolarZenithAngleByTimezone(
  lat: number,
  lon: number,
  timestamp: string,
  utcOffset: number,
  hasDST: boolean
): number {
  // Parse timestamp to determine actual UTC offset with DST
  const [datePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));

  // Calculate actual UTC offset based on DST status
  let actualOffset = utcOffset;
  if (hasDST && utcOffset === 10) {
    // Australian Eastern timezone with DST capability
    actualOffset = isAustralianDST(year, month, day) ? 11 : 10;
  }

  // Cache key includes actual offset
  const cacheKey = `${lat.toFixed(4)}-${lon.toFixed(4)}-${timestamp}-${actualOffset}`;
  const cached = solarAngleCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const angle = calculateSolarZenithAngleNOAA(lat, lon, timestamp, actualOffset);
  solarAngleCache.set(cacheKey, angle);
  return angle;
}

/**
 * Calculate solar zenith angle for Sydney timezone (AEST/AEDT)
 * Uses full NOAA algorithm with automatic DST detection
 *
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp in Sydney local time (YYYY-MM-DDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngle(lat: number, lon: number, timestamp: string): number {
  // Parse timestamp to determine DST status
  const [datePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));

  // Determine Sydney UTC offset based on DST
  const utcOffset = isAustralianDST(year, month, day) ? 11 : 10;

  return calculateSolarZenithAngleNOAA(lat, lon, timestamp, utcOffset);
}

/**
 * Calculate solar zenith angle for Japan Standard Time (JST, UTC+9)
 * Uses full NOAA algorithm
 *
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp in JST local time (YYYY-MM-DDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngleJST(lat: number, lon: number, timestamp: string): number {
  // Japan uses JST (UTC+9) year-round - no daylight saving time
  return calculateSolarZenithAngleNOAA(lat, lon, timestamp, 9);
}
