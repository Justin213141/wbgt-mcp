/**
 * NOAA ISD Fixed-Width Format Parser
 * Based on: https://www.ncei.noaa.gov/data/global-hourly/doc/isd-format-document.pdf
 *
 * Focuses on core fields needed for WBGT calculation:
 * - Air temperature
 * - Dew point temperature
 * - Sea level pressure
 * - Wind speed
 * - Cloud cover
 */

import type { ISDObservation, ISDHourlyData, ISDStation } from './types';
import { getStationId } from './types';

export class ISDParser {
  /**
   * Parse control section (positions 1-60)
   * Contains timestamp and station metadata
   */
  parseControlSection(line: string): {
    timestamp: string;
    stationId: string;
  } | null {
    // Minimum line length check
    if (line.length < 60) {
      return null;
    }

    // Positions 16-27: Observation date/time (YYYYMMDD HHmm)
    const dateStr = line.substring(15, 23);  // YYYYMMDD
    const timeStr = line.substring(23, 27);  // HHmm

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = timeStr.substring(0, 2);
    const minute = timeStr.substring(2, 4);

    // Create ISO timestamp (UTC)
    const timestamp = `${year}-${month}-${day}T${hour}:${minute}:00Z`;

    // Positions 5-10: USAF ID, 11-15: WBAN ID
    const usaf = line.substring(4, 10).trim();
    const wban = line.substring(10, 15).trim();
    const stationId = `${usaf}-${wban}`;

    return { timestamp, stationId };
  }

  /**
   * Parse mandatory data section (positions 61-105)
   * Contains core meteorological observations
   */
  parseMandatoryData(line: string): Partial<ISDObservation> {
    const obs: Partial<ISDObservation> = {
      quality: {
        temperature: '9',
        dew_point: '9',
        pressure: '9',
        wind: '9'
      }
    };

    // Minimum length check
    if (line.length < 105) {
      return obs;
    }

    // Wind data - modern ISD format uses variable-length control section
    // Two format variants exist:
    // Format 1 (legacy): V02DDDQQN0DDDQSSSS - 9 digits after N (0+dir+Q+speed)
    // Format 2 (modern): V02DDDQQNSSSSQ - 5 digits after N (speed+Q), then non-digit
    //
    // Key difference: Format 1 has exactly 9 consecutive digits after N,
    // Format 2 has exactly 5 consecutive digits after N (then more data follows)
    //
    // Try Format 1 first - must have 9 consecutive digits after N
    let windMatch = line.match(/V0[23]\d{5}N(\d{9})(?=\D|$)/);

    if (windMatch) {
      // Format 1: extract from the 9 digits after N
      const nineDigits = windMatch[1];
      const windDir = nineDigits.substring(1, 4);  // Skip first '0', take next 3
      const windSpeed = nineDigits.substring(5, 9); // Skip to position 5, take 4 digits

      // Parse wind direction (999 = missing)
      if (windDir !== '999') {
        obs.wind_direction = parseInt(windDir);
      }

      // Parse wind speed (9999 = missing)
      if (windSpeed !== '9999') {
        obs.wind_speed = parseInt(windSpeed) / 10;
        obs.quality.wind = '1'; // Default quality for legacy format
      }
    } else {
      // Format 1 didn't match, try Format 2 - exactly 5 digits after N
      windMatch = line.match(/V0[23](\d{3})(\d{2})N(\d{4})(\d)/);

      if (windMatch) {
        const windDir = windMatch[1];
        const windSpeed = windMatch[3];
        const windQuality = windMatch[4];

        // Parse wind direction (999 = missing)
        if (windDir !== '999') {
          obs.wind_direction = parseInt(windDir);
        }

        // Parse wind speed (9999 = missing)
        if (windSpeed !== '9999') {
          obs.wind_speed = parseInt(windSpeed) / 10;
          obs.quality.wind = windQuality;
        }
      }
    }

    // Temperature data (positions 87-92)
    // Position 87-92: Air temperature (°C * 10)
    // Position 93: Quality flag
    const tempStr = line.substring(87, 92);
    const tempQuality = line.substring(92, 93);

    // Missing value can be +9999 or 99999 (all 9s)
    if (tempStr !== '+9999' && !/^9+$/.test(tempStr)) {
      obs.temperature = parseInt(tempStr) / 10;
      obs.quality.temperature = tempQuality;
    }

    // Dew point (positions 93-98)
    // Position 93-98: Dew point (°C * 10)
    // Position 99: Quality flag
    const dewStr = line.substring(93, 98);
    const dewQuality = line.substring(98, 99);

    // Missing value can be +9999 or 99999 (all 9s)
    if (dewStr !== '+9999' && !/^9+$/.test(dewStr)) {
      obs.dew_point = parseInt(dewStr) / 10;
      obs.quality.dew_point = dewQuality;
    }

    // Sea level pressure (positions 99-104)
    // Position 99-104: SLP (hPa * 10)
    // Position 105: Quality flag
    const slpStr = line.substring(99, 104);
    const slpQuality = line.substring(104, 105);

    // Missing value is 99999 (all 9s)
    if (!/^9+$/.test(slpStr)) {
      obs.sea_level_pressure = parseInt(slpStr) / 10;
      obs.quality.pressure = slpQuality;
    }

    return obs;
  }

  /**
   * Calculate relative humidity from temperature and dew point
   * Using Magnus formula
   */
  calculateRelativeHumidity(temp: number, dewPoint: number): number {
    const a = 17.27;
    const b = 237.7;

    const alpha = ((a * temp) / (b + temp)) + Math.log(Math.exp((a * dewPoint) / (b + dewPoint)));
    const rh = 100 * (Math.exp((a * dewPoint) / (b + dewPoint)) / Math.exp((a * temp) / (b + temp)));

    return Math.max(0, Math.min(100, rh));
  }

  /**
   * Parse additional data section (variable length after position 105)
   * Looking for cloud cover data
   */
  parseAdditionalData(line: string): Partial<ISDObservation> {
    const obs: Partial<ISDObservation> = {};

    // Additional data starts at position 106
    if (line.length <= 105) {
      return obs;
    }

    const additionalData = line.substring(105);

    // Look for GF1 (Sky Condition) field
    // Format: GF1 NNCC where NN is coverage code, CC is cloud height
    const gf1Match = additionalData.match(/GF1(\d{2})(\d{3})/);
    if (gf1Match) {
      const coverageCode = parseInt(gf1Match[1]);
      // Coverage codes (simplified):
      // 00 = clear (0 oktas)
      // 01 = few (1-2 oktas)
      // 02 = scattered (3-4 oktas)
      // 03 = broken (5-7 oktas)
      // 04 = overcast (8 oktas)
      const oktasMap: Record<number, number> = {
        0: 0, 1: 1.5, 2: 3.5, 3: 6, 4: 8
      };
      obs.cloud_cover = oktasMap[coverageCode] || 0;
    }

    return obs;
  }

  /**
   * Check if a single quality flag is acceptable
   * Quality flags: 0-2 are good, 3-5 are questionable, 6-9 are bad
   */
  isQualityAcceptable(qualityFlag: string): boolean {
    const quality = parseInt(qualityFlag);
    return quality >= 0 && quality <= 2;
  }

  /**
   * Check if observation quality is acceptable
   */
  private isObservationQualityAcceptable(obs: ISDObservation): boolean {
    // Quality flags: 0-2 are good, 3-5 are questionable, 6-9 are bad
    const tempQuality = parseInt(obs.quality.temperature || '9');
    const dewQuality = parseInt(obs.quality.dew_point || '9');
    const pressureQuality = parseInt(obs.quality.pressure || '9');

    // Require at least temperature and either dew point or pressure
    const hasTempGood = obs.temperature !== undefined && tempQuality <= 2;
    const hasDewGood = obs.dew_point !== undefined && dewQuality <= 2;
    const hasPressGood = obs.sea_level_pressure !== undefined && pressureQuality <= 2;

    return hasTempGood && (hasDewGood || hasPressGood);
  }

  /**
   * Parse a single line of ISD data with date filtering
   * Returns null if line is outside date range or invalid
   */
  parseISDLine(line: string, startDate: string, endDate: string): ISDObservation | null {
    const obs = this.parseLine(line);
    if (!obs) {
      return null;
    }

    // Check date range
    const start = new Date(startDate).getTime();
    const end = new Date(endDate + 'T23:59:59Z').getTime();
    const obsTime = new Date(obs.timestamp).getTime();

    if (obsTime < start || obsTime > end) {
      return null;
    }

    return obs;
  }

  /**
   * Parse a single line of ISD data
   */
  private parseLine(line: string): ISDObservation | null {
    const control = this.parseControlSection(line);
    if (!control) {
      return null;
    }

    const mandatory = this.parseMandatoryData(line);
    const additional = this.parseAdditionalData(line);

    const obs: ISDObservation = {
      timestamp: control.timestamp,
      station_id: control.stationId,
      ...mandatory,
      ...additional,
      quality: mandatory.quality || {
        temperature: '9',
        dew_point: '9',
        pressure: '9',
        wind: '9'
      }
    };

    // Calculate relative humidity if we have both temp and dew point
    if (obs.temperature !== undefined && obs.dew_point !== undefined) {
      obs.relative_humidity = this.calculateRelativeHumidity(obs.temperature, obs.dew_point);
    }

    return obs;
  }

  /**
   * Filter observations by date range
   */
  private filterByDateRange(
    observations: ISDObservation[],
    startDate: string,
    endDate: string
  ): ISDObservation[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate + 'T23:59:59Z').getTime();

    return observations.filter(obs => {
      const obsTime = new Date(obs.timestamp).getTime();
      return obsTime >= start && obsTime <= end;
    });
  }

  /**
   * Parse a single ISD file content string and return structured data
   */
  parseISDFile(fileContent: string, startDate: string, endDate: string): ISDHourlyData {
    return this.parseISDFiles([fileContent], undefined as any, startDate, endDate);
  }

  /**
   * Parse ISD file content(s) and return structured data
   */
  parseISDFiles(
    fileContents: string[],
    station: ISDStation | undefined,
    startDate: string,
    endDate: string
  ): ISDHourlyData {
    const allObservations: ISDObservation[] = [];

    for (const content of fileContents) {
      const lines = content.split('\n');

      for (const line of lines) {
        if (line.trim().length === 0) continue;

        try {
          const obs = this.parseLine(line);
          if (obs) {
            allObservations.push(obs);
          }
        } catch (error) {
          // Skip malformed lines
          continue;
        }
      }
    }

    // Filter by date range
    const filtered = this.filterByDateRange(allObservations, startDate, endDate);

    // Filter by quality
    const goodQuality = filtered.filter(obs => this.isObservationQualityAcceptable(obs));

    // Determine overall data quality
    const qualityRatio = filtered.length > 0 ? goodQuality.length / filtered.length : 0;
    let dataQuality: 'good' | 'fair' | 'poor';
    if (qualityRatio >= 0.8) {
      dataQuality = 'good';
    } else if (qualityRatio >= 0.5) {
      dataQuality = 'fair';
    } else {
      dataQuality = 'poor';
    }

    const stationId = station ? getStationId(station) : (filtered.length > 0 ? filtered[0].station_id : 'unknown');
    const stationName = station ? station.name : 'unknown';

    console.log(`[ISD-PARSE] Parsed ${filtered.length} observations, ${goodQuality.length} good quality (${(qualityRatio * 100).toFixed(1)}%)`);

    return {
      station_id: stationId,
      station_name: stationName,
      observations: goodQuality,
      data_quality: dataQuality,
      missing_count: filtered.length - goodQuality.length,
      total_count: filtered.length
    };
  }
}
