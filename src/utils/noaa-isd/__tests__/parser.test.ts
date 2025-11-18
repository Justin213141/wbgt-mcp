/**
 * Tests for NOAA ISD Parser
 *
 * Verifies fixed-width format parsing, quality filtering, and data extraction
 */

import { describe, it, expect } from 'vitest';
import { ISDParser } from '../parser';

describe('NOAA ISD Parser', () => {
  const parser = new ISDParser();

  describe('parseControlSection', () => {
    it('should parse valid control section', () => {
      // Example ISD line (simplified)
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseControlSection(line);

      expect(result.timestamp).toBeDefined();
      expect(result.stationId).toBe('947670-99999');
    });

    it('should extract date and time correctly', () => {
      // Line with date 2024-07-15 12:00
      const line = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseControlSection(line);

      expect(result.timestamp).toContain('2024-07-15');
      expect(result.timestamp).toContain('12:00');
    });

    it('should handle midnight observations', () => {
      const line = '0079947670999992024073100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseControlSection(line);

      expect(result.timestamp).toContain('00:00');
    });
  });

  describe('parseMandatoryData', () => {
    it('should parse temperature correctly', () => {
      // Temperature field at position 87-92: +0115 = 11.5°C (scaled by 10)
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.temperature).toBeCloseTo(11.5, 1);
    });

    it('should parse negative temperatures', () => {
      // Temperature: -0055 = -5.5°C
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N00821051N-00550+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.temperature).toBeCloseTo(-5.5, 1);
    });

    it('should parse dew point correctly', () => {
      // Dew point field: +0086 = 8.6°C
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.dewPoint).toBeCloseTo(8.6, 1);
    });

    it('should parse sea level pressure correctly', () => {
      // SLP field: 10006 = 1000.6 hPa (scaled by 10)
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.seaLevelPressure).toBeCloseTo(1000.6, 1);
    });

    it('should parse wind speed correctly', () => {
      // Wind speed: 0519 = 51.9 m/s (scaled by 10)
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.windSpeed).toBeCloseTo(51.9, 1);
    });

    it('should parse wind direction correctly', () => {
      // Wind direction: 082 = 82 degrees
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.windDirection).toBe(82);
    });

    it('should handle missing values (9999)', () => {
      // Temperature missing: +9999
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+99999+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.temperature).toBeUndefined();
    });

    it('should handle all missing values', () => {
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N99999999+99999+999999999ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseMandatoryData(line);

      expect(result.temperature).toBeUndefined();
      expect(result.dewPoint).toBeUndefined();
      expect(result.windSpeed).toBeUndefined();
      expect(result.windDirection).toBeUndefined();
    });
  });

  describe('calculateRelativeHumidity', () => {
    it('should calculate RH from temperature and dew point', () => {
      const rh = parser.calculateRelativeHumidity(25, 18);

      // At 25°C with dew point 18°C, RH should be ~65-70%
      expect(rh).toBeGreaterThan(60);
      expect(rh).toBeLessThan(75);
    });

    it('should return ~100% when temp equals dew point', () => {
      const rh = parser.calculateRelativeHumidity(20, 20);

      expect(rh).toBeGreaterThan(99);
      expect(rh).toBeLessThanOrEqual(100);
    });

    it('should handle cold temperatures', () => {
      const rh = parser.calculateRelativeHumidity(0, -5);

      expect(rh).toBeGreaterThan(0);
      expect(rh).toBeLessThanOrEqual(100);
    });

    it('should handle hot temperatures', () => {
      const rh = parser.calculateRelativeHumidity(40, 25);

      expect(rh).toBeGreaterThan(0);
      expect(rh).toBeLessThan(60);
    });

    it('should cap RH at 100%', () => {
      // Edge case: dew point slightly higher than temp (measurement error)
      const rh = parser.calculateRelativeHumidity(20, 20.5);

      expect(rh).toBeLessThanOrEqual(100);
    });
  });

  describe('isQualityAcceptable', () => {
    it('should accept quality codes 0-2', () => {
      expect(parser.isQualityAcceptable('0')).toBe(true);
      expect(parser.isQualityAcceptable('1')).toBe(true);
      expect(parser.isQualityAcceptable('2')).toBe(true);
    });

    it('should reject quality codes 3-9', () => {
      expect(parser.isQualityAcceptable('3')).toBe(false);
      expect(parser.isQualityAcceptable('4')).toBe(false);
      expect(parser.isQualityAcceptable('5')).toBe(false);
      expect(parser.isQualityAcceptable('6')).toBe(false);
      expect(parser.isQualityAcceptable('7')).toBe(false);
      expect(parser.isQualityAcceptable('8')).toBe(false);
      expect(parser.isQualityAcceptable('9')).toBe(false);
    });

    it('should reject missing quality indicator', () => {
      expect(parser.isQualityAcceptable('9')).toBe(false);
    });
  });

  describe('parseISDLine', () => {
    it('should parse complete valid line', () => {
      const line = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseISDLine(line, '2024-07-01', '2024-07-31');

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeDefined();
      expect(result!.temperature).toBeDefined();
      expect(result!.dewPoint).toBeDefined();
      expect(result!.relativeHumidity).toBeDefined();
      expect(result!.seaLevelPressure).toBeDefined();
      expect(result!.windSpeed).toBeDefined();
    });

    it('should return null for observations outside date range', () => {
      const line = '0079947670999992024010100001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseISDLine(line, '2024-07-01', '2024-07-31');

      expect(result).toBeNull();
    });

    it('should skip lines with poor quality temperature', () => {
      // Temperature quality = 9 (bad)
      const line = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+011509+00860100061ADDAA101000091AA201000091AY121190AY221191';

      const result = parser.parseISDLine(line, '2024-07-01', '2024-07-31');

      // Should still parse but temperature will be undefined
      if (result) {
        expect(result.temperature).toBeUndefined();
      }
    });

    it('should handle observations with missing optional data', () => {
      const line = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210519+01150+00860100061ADD';

      const result = parser.parseISDLine(line, '2024-07-01', '2024-07-31');

      expect(result).not.toBeNull();
      expect(result!.timestamp).toBeDefined();
    });
  });

  describe('parseISDFile', () => {
    it('should parse multiple observations', () => {
      const fileContent = `0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD
0079947670999992024071501001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+01250+00920100021ADD
0079947670999992024071502001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210518+01300+00940100041ADD`;

      const result = parser.parseISDFile(fileContent, '2024-07-15', '2024-07-15');

      expect(result.observations).toHaveLength(3);
      expect(result.stationId).toBe('947670-99999');
    });

    it('should filter observations by date range', () => {
      const fileContent = `0079947670999992024071400001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD
0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+01250+00920100021ADD
0079947670999992024071600001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210518+01300+00940100041ADD`;

      const result = parser.parseISDFile(fileContent, '2024-07-15', '2024-07-15');

      expect(result.observations).toHaveLength(1); // Only July 15
      expect(result.observations[0].timestamp).toContain('2024-07-15');
    });

    it('should handle empty file content', () => {
      const result = parser.parseISDFile('', '2024-07-15', '2024-07-15');

      expect(result.observations).toHaveLength(0);
      expect(result.station_id).toBe('unknown');
    });

    it('should calculate data quality based on missing data', () => {
      // All good observations
      const goodContent = `0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD
0079947670999992024071501001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+01250+00920100021ADD`;

      const goodResult = parser.parseISDFile(goodContent, '2024-07-15', '2024-07-15');
      expect(goodResult.data_quality).toBe('good');

      // Some missing data (50%)
      const fairContent = `0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD
0079947670999992024071501001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+99999+999999999ADD`;

      const fairResult = parser.parseISDFile(fairContent, '2024-07-15', '2024-07-15');
      expect(fairResult.data_quality).toBe('fair');

      // Most missing data (>70%)
      const poorContent = `0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+99999+999999999ADD
0079947670999992024071501001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+99999+999999999ADD
0079947670999992024071502001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+99999+999999999ADD
0079947670999992024071503001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD`;

      const poorResult = parser.parseISDFile(poorContent, '2024-07-15', '2024-07-15');
      expect(poorResult.data_quality).toBe('poor');
    });

    it('should track missing data counts', () => {
      const fileContent = `0079947670999992024071500001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD
0079947670999992024071501001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210520+99999+00920100021ADD`;

      const result = parser.parseISDFile(fileContent, '2024-07-15', '2024-07-15');

      expect(result.missing_count).toBe(1);
      expect(result.total_count).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short lines gracefully', () => {
      const result = parser.parseISDLine('short', '2024-07-15', '2024-07-15');
      expect(result).toBeNull();
    });

    it('should handle malformed dates', () => {
      const line = '00799476709999920240715XXXX1+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+01200+00900100001ADD';

      const result = parser.parseISDLine(line, '2024-07-15', '2024-07-15');

      // Parser should handle gracefully (likely return null or skip)
      expect(result === null || result.timestamp).toBeDefined();
    });

    it('should handle extreme temperatures', () => {
      // Very hot: +0500 = 50°C (scaled by 10)
      const hotLine = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N008210515+05000+03000100001ADD';
      const hotResult = parser.parseMandatoryData(hotLine);
      expect(hotResult.temperature).toBeCloseTo(50, 1);

      // Very cold: -0500 = -50°C (scaled by 10)
      const coldLine = '0079947670999992024071512001+33946+151177+00064FM-12+0016YSSY  +99999V0203201N00821051N-05000-06000100001ADD';
      const coldResult = parser.parseMandatoryData(coldLine);
      expect(coldResult.temperature).toBeCloseTo(-50, 1);
    });
  });
});
