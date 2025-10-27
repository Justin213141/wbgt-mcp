/**
 * Domain Objects Basic Tests
 * Tests compilation and basic functionality of new domain objects
 */

import { describe, it, expect } from 'vitest';
import {
  Location,
  Temperature,
  Pressure,
  WindSpeed,
  SolarRadiation,
  WeatherConditions,
  WBGTResult,
  TemperatureUnit,
  WBGTRiskCategory,
} from '../index';

describe('Domain Objects - Basic Functionality', () => {
  describe('Location', () => {
    it('should create a valid location', () => {
      const location = Location.create(-33.8018, 151.1254);
      expect(location.latitude).toBe(-33.8018);
      expect(location.longitude).toBe(151.1254);
      expect(location.toString()).toBe('-33.8018,151.1254');
    });

    it('should validate location bounds', () => {
      expect(() => Location.create(91, 0)).toThrow();
      expect(() => Location.create(0, 181)).toThrow();
    });

    it('should calculate distance between locations', () => {
      const sydney = Location.create(-33.8018, 151.1254);
      const tokyo = Location.create(35.6762, 139.6503);

      const distance = sydney.distanceTo(tokyo);
      expect(distance).toBeGreaterThan(7000); // Approximate distance in km
      expect(distance).toBeLessThan(9000);
    });
  });

  describe('Temperature', () => {
    it('should create temperature in Celsius', () => {
      const temp = Temperature.fromCelsius(25);
      expect(temp.celsius).toBe(25);
      expect(temp.fahrenheit).toBe(77);
      expect(temp.kelvin).toBe(298.15);
    });

    it('should convert between units', () => {
      const temp = Temperature.fromFahrenheit(32);
      expect(temp.celsius).toBe(0);

      const temp2 = Temperature.fromKelvin(273.15);
      expect(temp2.celsius).toBe(0);
    });

    it('should determine comfort levels', () => {
      const comfortable = Temperature.fromCelsius(22);
      expect(comfortable.isComfortable).toBe(true);
      expect(comfortable.comfortCategory).toBe('comfortable');

      const hot = Temperature.fromCelsius(45);
      expect(hot.isExtremelyHot).toBe(true);
    });
  });

  describe('Pressure', () => {
    it('should create pressure in hPa', () => {
      const pressure = Pressure.fromHectopascal(1013.25);
      expect(pressure.hPa).toBe(1013.25);
      expect(pressure.atm).toBe(1);
      expect(pressure.isNormal).toBe(true);
    });

    it('should categorize pressure levels', () => {
      const low = Pressure.fromHectopascal(990);
      expect(low.isLow).toBe(true);
      expect(low.category).toBe('low');

      const high = Pressure.fromHectopascal(1030);
      expect(high.isHigh).toBe(true);
      expect(high.category).toBe('high');
    });
  });

  describe('WindSpeed', () => {
    it('should create wind speed in m/s', () => {
      const wind = WindSpeed.fromMetersPerSecond(5);
      expect(wind.metersPerSecond).toBe(5);
      expect(wind.kilometersPerHour).toBe(18);
      expect(wind.isModerate).toBe(true);
    });

    it('should determine Beaufort scale', () => {
      const calm = WindSpeed.fromMetersPerSecond(0);
      expect(calm.beaufortScale).toBe(0);
      expect(calm.beaufortDescription).toBe('Calm');

      const gale = WindSpeed.fromMetersPerSecond(20);
      expect(gale.beaufortScale).toBe(8);
      expect(gale.isGale).toBe(true);
    });
  });

  describe('SolarRadiation', () => {
    it('should create solar radiation in W/m²', () => {
      const solar = SolarRadiation.fromWattsPerSquareMeter(500);
      expect(solar.wattsPerSquareMeter).toBe(500);
      expect(solar.isModerate).toBe(true);
      expect(solar.isDaytime).toBe(true);
    });

    it('should categorize radiation levels', () => {
      const night = SolarRadiation.fromWattsPerSquareMeter(0);
      expect(night.isNighttime).toBe(true);
      expect(night.category).toBe('zero');

      const clear = SolarRadiation.fromWattsPerSquareMeter(800);
      expect(clear.isVeryHigh).toBe(true);
      expect(clear.estimatedCloudCover).toBe('clear');
    });
  });

  describe('WeatherConditions', () => {
    it('should create complete weather conditions', () => {
      const location = Location.create(-33.8018, 151.1254);
      const timestamp = new Date('2023-06-21T12:00:00Z');

      const conditions = WeatherConditions.fromMeasurements({
        location,
        timestamp,
        temperatureCelsius: 25,
        humidity: 60,
        dewPointCelsius: 18,
        wetBulbTemperatureCelsius: 20,
        pressureHPa: 1013,
        windSpeedMs: 3,
        solarRadiationWm2: 600,
        apparentTemperatureCelsius: 26,
        cloudCover: 30,
      });

      expect(conditions.location.equals(location)).toBe(true);
      expect(conditions.temperature.celsius).toBe(25);
      expect(conditions.isDaytime).toBe(true);
      expect(conditions.comfortScore).toBeGreaterThan(0);
    });

    it('should generate weather descriptions', () => {
      const location = Location.create(35.6762, 139.6503);
      const timestamp = new Date('2023-12-21T12:00:00Z');

      const conditions = WeatherConditions.fromMeasurements({
        location,
        timestamp,
        temperatureCelsius: 35,
        humidity: 80,
        dewPointCelsius: 30,
        wetBulbTemperatureCelsius: 32,
        pressureHPa: 1005,
        windSpeedMs: 2,
        solarRadiationWm2: 400,
        apparentTemperatureCelsius: 40,
        cloudCover: 70,
      });

      expect(conditions.weatherDescription).toContain('hot');
      expect(conditions.weatherDescription).toContain('humid');
      expect(conditions.heatIndexCategory).toBe('extreme-caution');
    });
  });

  describe('WBGTResult', () => {
    it('should create WBGT result with risk assessment', () => {
      const location = Location.create(-33.8018, 151.1254);
      const timestamp = new Date('2023-06-21T12:00:00Z');

      const result = WBGTResult.fromCalculation({
        location,
        timestamp,
        wbgtCelsius: 28,
        blackGlobeTempCelsius: 35,
        naturalWetBulbTempCelsius: 22,
        airTemperatureCelsius: 30,
        esi: 35,
        solarZenithAngle: 30,
      });

      expect(result.wbgt.celsius).toBe(28);
      expect(result.riskCategory).toBe(WBGTRiskCategory.HIGH);
      expect(result.requiresWorkModifications).toBe(true);
      expect(result.activityGuidelines.restWorkRatio).toBe(2);
    });

    it('should provide comprehensive heat stress assessment', () => {
      const location = Location.create(35.6762, 139.6503);
      const timestamp = new Date('2023-08-15T14:00:00Z');

      const extremeResult = WBGTResult.fromCalculation({
        location,
        timestamp,
        wbgtCelsius: 34,
        blackGlobeTempCelsius: 45,
        naturalWetBulbTempCelsius: 28,
        airTemperatureCelsius: 38,
        esi: 48,
        solarZenithAngle: 20,
      });

      expect(extremeResult.riskCategory).toBe(WBGTRiskCategory.EXTREME);
      expect(extremeResult.shouldAvoidOutdoorWork).toBe(true);
      expect(extremeResult.activityGuidelines.restWorkRatio).toBe(0);
      expect(extremeResult.activityGuidelines.additionalPrecautions).toContain('Avoid outdoor activities');
    });
  });

  describe('JSON Serialization', () => {
    it('should serialize and deserialize domain objects', () => {
      const original = Location.create(-33.8018, 151.1254);
      const json = original.toJSON();
      const restored = Location.fromJSON(json);

      expect(restored.equals(original)).toBe(true);
    });

    it('should serialize complex domain objects', () => {
      const original = WBGTResult.fromCalculation({
        location: Location.create(-33.8018, 151.1254),
        timestamp: new Date('2023-06-21T12:00:00Z'),
        wbgtCelsius: 25,
        blackGlobeTempCelsius: 30,
        naturalWetBulbTempCelsius: 20,
        airTemperatureCelsius: 27,
        esi: 30,
        solarZenithAngle: 45,
      });

      const json = original.toJSON();
      const restored = WBGTResult.fromJSON(json);

      expect(restored.equals(original)).toBe(true);
      expect(restored.riskCategory).toBe(original.riskCategory);
      expect(restored.activityGuidelines.restWorkRatio).toBe(original.activityGuidelines.restWorkRatio);
    });
  });
});