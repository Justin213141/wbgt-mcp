/**
 * Solar geometry calculations for WBGT
 * Handles solar zenith angle calculations for different timezones
 */

/**
 * Unified solar zenith angle calculation for any timezone
 * Delegates to appropriate timezone-specific function based on UTC offset
 */
export function calculateSolarZenithAngleByTimezone(
  lat: number,
  lon: number,
  timestamp: string,
  utcOffset: number,
  hasDST: boolean
): number {
  if (utcOffset === 10 && hasDST) {
    return calculateSolarZenithAngle(lat, lon, timestamp);
  }
  if (utcOffset === 9 && !hasDST) {
    return calculateSolarZenithAngleJST(lat, lon, timestamp);
  }
  throw new Error("Unsupported timezone");
}

/**
 * Calculate solar zenith angle using astronomical formulas
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp (in Sydney local time YYYYMMDDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngle(lat: number, lon: number, timestamp: string): number {
  // Parse Sydney local time components - timestamps from Archive API are in local time format
  // Format: "2025-10-11T08:00" (Sydney local time, NOT UTC)
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Determine Sydney DST status
  // Sydney uses EDT (UTC+11) from first Sunday in October to first Sunday in April
  // UTC+10 (EST) from first Sunday in April to first Sunday in October
  // For 2025: EDT is Oct 5 - Apr 6, so Oct 11 is EDT (UTC+11)
  const isDST = month >= 10 || month <= 3;
  const sydneyUTCOffset = isDST ? 11 : 10;

  // Convert Sydney local time to UTC
  // Sydney local = UTC + offset, so UTC = Sydney local - offset (in hours)
  let utcHour = hour - sydneyUTCOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // Days in previous month
      const isLeapYear = (utcYear % 4 === 0 && utcYear % 100 !== 0) || utcYear % 400 === 0;
      const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      utcDay = daysInMonth[utcMonth - 1];
    }
  }

  // Create UTC date
  const utcDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, minute));

  // Calculate day of year for UTC date
  const jan1UTC = new Date(Date.UTC(utcYear, 0, 1));
  const msPerDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.ceil((utcDate.getTime() - jan1UTC.getTime()) / msPerDay);

  // Decimal hour in UTC
  const decimalHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;

  // Solar declination (degrees) - using Cooper's equation
  const B = (360 / 365.25) * (dayOfYear - 81) * Math.PI / 180;
  const decl = 23.45 * Math.sin(B);

  // Equation of Time (minutes) - corrects for Earth's elliptical orbit
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Hour angle (degrees) - 15 degrees per hour from solar noon
  const solarTime = decimalHour + lon / 15 + EoT / 60; // Local solar time with EoT correction
  const hourAngle = 15 * (solarTime - 12);

  // Convert to radians
  const latRad = lat * Math.PI / 180;
  const declRad = decl * Math.PI / 180;
  const hourRad = hourAngle * Math.PI / 180;

  // Solar elevation angle
  const sinElev = Math.sin(latRad) * Math.sin(declRad) +
                  Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourRad);
  const elevRad = Math.asin(Math.max(-1, Math.min(1, sinElev)));

  // Solar zenith angle
  const zenithRad = Math.PI / 2 - elevRad;
  const zenithDeg = zenithRad * 180 / Math.PI;

  return Math.max(0, Math.min(180, zenithDeg));
}

/**
 * Calculate solar zenith angle using astronomical formulas (JST/Tokyo timezone)
 * @param lat Latitude in degrees
 * @param lon Longitude in degrees
 * @param timestamp ISO timestamp (in Japan Standard Time YYYYMMDDTHH:MM format)
 * @returns Solar zenith angle in degrees
 */
export function calculateSolarZenithAngleJST(lat: number, lon: number, timestamp: string): number {
  // Parse JST local time components - timestamps from Archive API with Asia/Tokyo timezone
  // Format: "2025-10-11T08:00" (JST local time, NOT UTC)
  const [datePart, timePart] = timestamp.split('T');
  const [year, month, day] = datePart.split('-').map(x => parseInt(x, 10));
  const [hour, minute] = timePart.split(':').map(x => parseInt(x, 10));

  // Japan uses JST (UTC+9) year-round - no daylight saving time
  const jstUTCOffset = 9;

  // Convert JST local time to UTC
  // JST local = UTC + 9, so UTC = JST local - 9 (in hours)
  let utcHour = hour - jstUTCOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  // Handle day rollover
  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // Days in previous month
      const isLeapYear = (utcYear % 4 === 0 && utcYear % 100 !== 0) || utcYear % 400 === 0;
      const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      utcDay = daysInMonth[utcMonth - 1];
    }
  }

  // Create UTC date
  const utcDate = new Date(Date.UTC(utcYear, utcMonth - 1, utcDay, utcHour, minute));

  // Calculate day of year for UTC date
  const jan1UTC = new Date(Date.UTC(utcYear, 0, 1));
  const msPerDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.ceil((utcDate.getTime() - jan1UTC.getTime()) / msPerDay);

  // Decimal hour in UTC
  const decimalHour = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;

  // Solar declination (degrees) - using Cooper's equation
  const B = (360 / 365.25) * (dayOfYear - 81) * Math.PI / 180;
  const declRad = (0.006918 - 0.399912 * Math.cos(B) + 0.070257 * Math.sin(B) - 0.006758 * Math.cos(2 * B) + 0.000907 * Math.sin(2 * B) - 0.002697 * Math.cos(3 * B) + 0.00111 * Math.sin(3 * B));

  // Hour angle (degrees per hour = 360/24 = 15)
  const hourAngleDeg = (decimalHour - 12) * 15 + lon;
  const hourAngleRad = hourAngleDeg * Math.PI / 180;

  // Latitude in radians
  const latRad = lat * Math.PI / 180;

  // Zenith angle calculation
  const zenithRad = Math.acos(Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad));
  const zenithDeg = zenithRad * 180 / Math.PI;

  return Math.max(0, Math.min(180, zenithDeg));
}
