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
  private parseControlSection(line: string): {
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
  private parseMandatoryData(line: string): Partial<ISDObservation> {
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

    // Wind data (positions 61-69)
    // Position 61-63: Wind direction (degrees)
    // Position 64-67: Wind speed (m/s * 10)
    // Position 68: Wind speed quality
    const windDir = line.substring(60, 63);
    const windSpeed = line.substring(63, 67);
    const windQuality = line.substring(67, 68);

    if (windSpeed !== '9999' && windSpeed !== '+999') {
      obs.wind_speed = parseInt(windSpeed) / 10;
      obs.quality.wind = windQuality;
    }

    if (windDir !== '999') {
      obs.wind_direction = parseInt(windDir);
    }

    // Temperature data (positions 87-92)
    // Position 87-92: Air temperature (°C * 10)
    // Position 93: Quality flag
    const tempStr = line.substring(87, 92);
    const tempQuality = line.substring(92, 93);

    if (tempStr !== '+9999') {
      obs.temperature = parseInt(tempStr) / 10;
      obs.quality.temperature = tempQuality;
    }

    // Dew point (positions 93-98)
    // Position 93-98: Dew point (°C * 10)
    // Position 99: Quality flag
    const dewStr = line.substring(93, 98);
    const dewQuality = line.substring(98, 99);

    if (dewStr !== '+9999') {
      obs.dew_point = parseInt(dewStr) / 10;
      obs.quality.dew_point = dewQuality;
    }

    // Sea level pressure (positions 99-104)
    // Position 99-104: SLP (hPa * 10)
    // Position 105: Quality flag
    const slpStr = line.substring(99, 104);
    const slpQuality = line.substring(104, 105);

    if (slpStr !== '99999') {
      obs.sea_level_pressure = parseInt(slpStr) / 10;
      obs.quality.pressure = slpQuality;
    }

    return obs;
  }

  /**
   * Calculate relative humidity from temperature and dew point
   * Using Magnus formula
   */
  private calculateRelativeHumidity(temp: number, dewPoint: number): number {
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
  private parseAdditionalData(line: string): Partial<ISDObservation> {
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
   * Check if observation quality is acceptable
   */
  private isQualityAcceptable(obs: ISDObservation): boolean {
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
   * Parse ISD file content(s) and return structured data
   */
  parseISDFiles(
    fileContents: string[],
    station: ISDStation,
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
    const goodQuality = filtered.filter(obs => this.isQualityAcceptable(obs));

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

    const stationId = getStationId(station);

    console.log(`[ISD-PARSE] Parsed ${filtered.length} observations, ${goodQuality.length} good quality (${(qualityRatio * 100).toFixed(1)}%)`);

    return {
      station_id: stationId,
      station_name: station.name,
      observations: goodQuality,
      data_quality: dataQuality,
      missing_count: filtered.length - goodQuality.length,
      total_count: filtered.length
    };
  }
}
