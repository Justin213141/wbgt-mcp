/**
 * Basic tests for formatters to ensure coverage
 * Focus on testing the main functionality without edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  TemperatureFormatter,
  HumidityFormatter,
  WindSpeedFormatter,
  SolarRadiationFormatter,
  PressureFormatter,
  AngleFormatter,
  NumberFormatter,
  TimestampFormatter,
  formatObservationValue,
} from '../formatters';

describe('Formatters Basic Tests', () => {
  it('should format temperatures', () => {
    expect(TemperatureFormatter.celsius(25.5)).toBe(25.5);
    expect(TemperatureFormatter.celsiusWithUnit(25.5)).toBe('25.5°C');
    expect(TemperatureFormatter.fahrenheit(0)).toBe(32.0);
    expect(TemperatureFormatter.kelvin(0)).toBe(273);
  });

  it('should format humidity', () => {
    expect(HumidityFormatter.percentage(65.5)).toBe(66);
    expect(HumidityFormatter.percentageWithUnit(65.5)).toBe('66%');
    expect(HumidityFormatter.clamp(150)).toBe(100);
  });

  it('should format wind speed', () => {
    expect(WindSpeedFormatter.metersPerSecond(5.12)).toBe(5.12);
    expect(WindSpeedFormatter.kilometersPerHour(10)).toBe(36.0);
    expect(WindSpeedFormatter.knots(10)).toBeCloseTo(19.44, 1);
  });

  it('should format solar radiation', () => {
    expect(SolarRadiationFormatter.wattsPerSquareMeter(800)).toBe(800.0);
    expect(SolarRadiationFormatter.withUnit(800.0)).toContain('W/m²');
  });

  it('should format pressure', () => {
    expect(PressureFormatter.hectopascals(1013.25)).toBeCloseTo(1013.3, 1);
    expect(PressureFormatter.withUnit(1013.25)).toContain('hPa');
  });

  it('should format angles', () => {
    expect(AngleFormatter.degrees(45.1)).toBe(45.1);
    expect(AngleFormatter.withUnit(45.1)).toBe('45.1°');
    expect(AngleFormatter.toCardinalDirection(0)).toBe('N');
  });

  it('should format numbers', () => {
    expect(NumberFormatter.format(3.14, 2)).toBe(3.14);
    expect(NumberFormatter.safeDivide(10, 2)).toBe(5);
    expect(NumberFormatter.safeDivide(10, 0)).toBe(0);
  });

  it('should format timestamps', () => {
    const date = new Date('2023-06-21T12:34:56.789Z');
    expect(TimestampFormatter.isoString(date)).toBe('2023-06-21T12:34:56.789Z');
    expect(TimestampFormatter.dateOnly(date)).toBe('2023-06-21');
  });

  it('should format observation values', () => {
    expect(formatObservationValue(25.5, 'temperature')).toBe(25.5);
    expect(formatObservationValue(65, 'humidity', { includeUnit: true })).toBe('65%');
    expect(formatObservationValue(800, 'solar_radiation', { includeUnit: true })).toContain('W/m²');
  });
});