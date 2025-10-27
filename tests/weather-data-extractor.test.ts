import { describe, it, expect } from 'vitest';
import { WeatherDataExtractor } from '../src/utils/weather-data-extractor';

describe('WeatherDataExtractor', () => {
  it('should build time-indexed maps from Open-Meteo arrays', () => {
    const mockData = {
      hourly: {
        time: ['2025-10-11T08:00', '2025-10-11T09:00'],
        temperature_2m: [25, 26],
        relative_humidity_2m: [60, 55],
        shortwave_radiation_instant: [500, 550],
        direct_radiation_instant: [350, 380],
        diffuse_radiation_instant: [150, 170],
        wind_speed_10m: [3, 4],
        surface_pressure: [1013.25, 1012.5]
      }
    };

    const extractor = new WeatherDataExtractor();
    const map = extractor.buildOpenMeteoMap(mockData.hourly);

    // Should have maps keyed by hour (substring 0-13 of ISO timestamp)
    expect(map['2025-10-11T08']).toBeDefined();
    expect(map['2025-10-11T08'].temperature).toEqual(25);
    expect(map['2025-10-11T08'].humidity).toEqual(60);
    expect(map['2025-10-11T08'].solarRadiationInstant).toEqual(500);
  });

  it('should extract radiation data correctly', () => {
    const extractor = new WeatherDataExtractor();
    const weatherData = {
      solarRadiationInstant: 500,
      solarRadiationDirect: 350,
      solarRadiationDiffuse: 150
    };

    const radiation = extractor.extractRadiationData(weatherData);

    expect(radiation.shortwave_instant).toEqual(500);
    expect(radiation.direct).toEqual(350);
    expect(radiation.diffuse).toEqual(150);
  });
});
