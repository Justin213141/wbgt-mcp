import { describe, it, expect } from 'vitest';
import {
  calculateKongWBGTPipelineByTimezone,
  calculateKongWBGTPipeline,
  calculateKongWBGTPipelineJST
} from '../src/calculations';

describe('Kong WBGT Pipeline - Timezone Unified Function', () => {
  it('should calculate Kong WBGT for Sydney with unified timezone function', () => {
    const result = calculateKongWBGTPipelineByTimezone(
      25,    // Ta
      20,    // Tw
      60,    // RH
      1013.25, // P_hPa
      3,     // u10m
      500,   // SRdown
      350,   // SRdirect
      150,   // SRdiffuse
      -33.8018, // lat (Sydney)
      151.1254, // lon (Sydney)
      '2025-10-11T08:00',
      10,    // UTC+10
      true   // Has DST
    );

    expect(Number.isFinite(result.kong_wbgt)).toBe(true);
    expect(result.kong_wbgt).toBeGreaterThan(0);
    expect(result.solar_zenith_angle).toBeGreaterThanOrEqual(0);
    expect(result.solar_zenith_angle).toBeLessThanOrEqual(180);
    expect(result.black_globe_temp).toBeDefined();
    expect(result.natural_wet_bulb_temp).toBeDefined();
    expect(result.esi).toBeDefined();
  });

  it('should produce equivalent results to Sydney-specific function', () => {
    const testData = {
      Ta: 25,
      Tw: 20,
      RH: 60,
      P_hPa: 1013.25,
      u10m: 3,
      SRdown: 500,
      SRdirect: 350,
      SRdiffuse: 150,
      lat: -33.8018,
      lon: 151.1254,
      timestamp: '2025-10-11T08:00'
    };

    const unified = calculateKongWBGTPipelineByTimezone(
      testData.Ta, testData.Tw, testData.RH, testData.P_hPa, testData.u10m,
      testData.SRdown, testData.SRdirect, testData.SRdiffuse,
      testData.lat, testData.lon, testData.timestamp,
      10, true
    );

    const specific = calculateKongWBGTPipeline(
      testData.Ta, testData.Tw, testData.RH, testData.P_hPa, testData.u10m,
      testData.SRdown, testData.SRdirect, testData.SRdiffuse,
      testData.lat, testData.lon, testData.timestamp
    );

    expect(unified.kong_wbgt).toBeCloseTo(specific.kong_wbgt, 5);
    expect(unified.solar_zenith_angle).toBeCloseTo(specific.solar_zenith_angle, 5);
  });

  it('should produce equivalent results to JST-specific function for Tokyo', () => {
    const testData = {
      Ta: 20,
      Tw: 18,
      RH: 55,
      P_hPa: 1013.25,
      u10m: 2,
      SRdown: 400,
      SRdirect: 300,
      SRdiffuse: 100,
      lat: 35.6762,
      lon: 139.6503,
      timestamp: '2025-10-11T08:00'
    };

    const unified = calculateKongWBGTPipelineByTimezone(
      testData.Ta, testData.Tw, testData.RH, testData.P_hPa, testData.u10m,
      testData.SRdown, testData.SRdirect, testData.SRdiffuse,
      testData.lat, testData.lon, testData.timestamp,
      9, false
    );

    const specific = calculateKongWBGTPipelineJST(
      testData.Ta, testData.Tw, testData.RH, testData.P_hPa, testData.u10m,
      testData.SRdown, testData.SRdirect, testData.SRdiffuse,
      testData.lat, testData.lon, testData.timestamp
    );

    expect(unified.kong_wbgt).toBeCloseTo(specific.kong_wbgt, 5);
    expect(unified.solar_zenith_angle).toBeCloseTo(specific.solar_zenith_angle, 5);
  });
});
