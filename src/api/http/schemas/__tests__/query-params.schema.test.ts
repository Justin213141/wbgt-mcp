/**
 * Query Parameter Validation Schema Tests
 */

import { describe, it, expect } from 'vitest';
import {
  CurrentWBGTQuerySchema,
  ForecastWBGTQuerySchema,
  HistoricWBGTQuerySchema,
  ObservationsQuerySchema,
  HealthCheckQuerySchema,
  validateQueryParams,
} from '../query-params.schema';

describe('Query Parameter Validation Schemas', () => {
  describe('CurrentWBGTQuerySchema', () => {
    it('should validate valid current WBGT query', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid latitude', () => {
      const data = {
        latitude: 95, // Out of range
        longitude: 151.2093,
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid longitude', () => {
      const data = {
        latitude: -33.8688,
        longitude: 181, // Out of range
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept optional timestamp', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        timestamp: '2025-10-27T12:00:00Z',
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid timestamp', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        timestamp: 'invalid-date',
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept source parameter', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        source: 'open-meteo',
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should coerce string numbers to numbers', () => {
      const data = {
        latitude: '-33.8688',
        longitude: '151.2093',
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      if (result.success) {
        expect(typeof result.data.latitude).toBe('number');
        expect(typeof result.data.longitude).toBe('number');
      }
      expect(result.success).toBe(true);
    });
  });

  describe('ForecastWBGTQuerySchema', () => {
    it('should validate valid forecast query', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        days: 7,
      };

      const result = ForecastWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should use default days value', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
      };

      const result = ForecastWBGTQuerySchema.safeParse(data);
      if (result.success) {
        expect(result.data.days).toBe(7);
      }
      expect(result.success).toBe(true);
    });

    it('should reject days greater than 16', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        days: 20,
      };

      const result = ForecastWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject days less than 1', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        days: 0,
      };

      const result = ForecastWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should only allow open-meteo as source', () => {
      const dataValid = {
        latitude: -33.8688,
        longitude: 151.2093,
        source: 'open-meteo',
      };

      const dataInvalid = {
        latitude: -33.8688,
        longitude: 151.2093,
        source: 'bom',
      };

      expect(ForecastWBGTQuerySchema.safeParse(dataValid).success).toBe(true);
      expect(ForecastWBGTQuerySchema.safeParse(dataInvalid).success).toBe(false);
    });
  });

  describe('HistoricWBGTQuerySchema', () => {
    it('should validate valid historic query', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-01-01',
        endDate: '2025-10-27',
      };

      const result = HistoricWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '01/01/2025', // Wrong format
        endDate: '2025-10-27',
      };

      const result = HistoricWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject end date before start date', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-10-27',
        endDate: '2025-01-01',
      };

      const result = HistoricWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should accept date range exceeding 365 days', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2024-01-01',
        endDate: '2025-01-10', // 375 days
      };

      const result = HistoricWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept large multi-year date range', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2020-01-01',
        endDate: '2025-12-31', // 6 years
      };

      const result = HistoricWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept source parameter (open-meteo or kong)', () => {
      const dataOpenMeteo = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-01-01',
        endDate: '2025-10-27',
        source: 'open-meteo',
      };

      const dataKong = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-01-01',
        endDate: '2025-10-27',
        source: 'kong',
      };

      expect(HistoricWBGTQuerySchema.safeParse(dataOpenMeteo).success).toBe(true);
      expect(HistoricWBGTQuerySchema.safeParse(dataKong).success).toBe(true);
    });
  });

  describe('ObservationsQuerySchema', () => {
    it('should validate valid observations query', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-01-01',
        endDate: '2025-10-27',
      };

      const result = ObservationsQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept date range exceeding 365 days', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2024-01-01',
        endDate: '2025-01-10',
      };

      const result = ObservationsQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should accept source parameter', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
        startDate: '2025-01-01',
        endDate: '2025-10-27',
        source: 'kong',
      };

      const result = ObservationsQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe('HealthCheckQuerySchema', () => {
    it('should accept empty query object', () => {
      const data = {};

      const result = HealthCheckQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject any extra properties (strict mode)', () => {
      const data = {
        extraParam: 'value',
      };

      const result = HealthCheckQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('Coordinate Validation', () => {
    it('should accept latitude -90 to 90', () => {
      const validLatitudes = [-90, -45, 0, 45, 90];

      for (const lat of validLatitudes) {
        const data = {
          latitude: lat,
          longitude: 0,
        };
        const result = CurrentWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should accept longitude -180 to 180', () => {
      const validLongitudes = [-180, -90, 0, 90, 180];

      for (const lon of validLongitudes) {
        const data = {
          latitude: 0,
          longitude: lon,
        };
        const result = CurrentWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should reject latitude outside range', () => {
      const invalidLatitudes = [-91, -100, 91, 100];

      for (const lat of invalidLatitudes) {
        const data = {
          latitude: lat,
          longitude: 0,
        };
        const result = CurrentWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(false);
      }
    });

    it('should reject longitude outside range', () => {
      const invalidLongitudes = [-181, -200, 181, 200];

      for (const lon of invalidLongitudes) {
        const data = {
          latitude: 0,
          longitude: lon,
        };
        const result = CurrentWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Date Validation', () => {
    it('should accept valid dates', () => {
      const validDates = ['2025-01-01', '2025-10-27', '2000-12-31'];

      for (const date of validDates) {
        const data = {
          latitude: 0,
          longitude: 0,
          startDate: date,
          endDate: date,
        };
        const result = HistoricWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid date formats', () => {
      const invalidDates = ['2025/01/01', '01-01-2025', '2025-1-1', 'invalid'];

      for (const date of invalidDates) {
        const data = {
          latitude: 0,
          longitude: 0,
          startDate: date,
          endDate: '2025-10-27',
        };
        const result = HistoricWBGTQuerySchema.safeParse(data);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Type Coercion', () => {
    it('should coerce string coordinates to numbers', () => {
      const data = {
        latitude: '-33.8688',
        longitude: '151.2093',
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.latitude).toBe('number');
        expect(typeof result.data.longitude).toBe('number');
      }
    });

    it('should coerce string days to number', () => {
      const data = {
        latitude: 0,
        longitude: 0,
        days: '7',
      };

      const result = ForecastWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.days).toBe('number');
      }
    });

    it('should reject non-numeric strings', () => {
      const data = {
        latitude: 'not-a-number',
        longitude: 0,
      };

      const result = CurrentWBGTQuerySchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('validateQueryParams function', () => {
    it('should return parsed data on success', () => {
      const data = {
        latitude: -33.8688,
        longitude: 151.2093,
      };

      const result = validateQueryParams(CurrentWBGTQuerySchema, data);
      expect(result.latitude).toBe(-33.8688);
      expect(result.longitude).toBe(151.2093);
    });

    it('should throw error on validation failure', () => {
      const data = {
        latitude: 95, // Invalid
        longitude: 151.2093,
      };

      expect(() => validateQueryParams(CurrentWBGTQuerySchema, data)).toThrow();
    });

    it('should attach validation errors to thrown error', () => {
      const data = {
        latitude: 95,
        longitude: 181,
      };

      try {
        validateQueryParams(CurrentWBGTQuerySchema, data);
      } catch (error: any) {
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.errors).toBeDefined();
        expect(Array.isArray(error.errors)).toBe(true);
        expect(error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should include field information in errors', () => {
      const data = {
        latitude: 'not-a-number',
        longitude: 0,
      };

      try {
        validateQueryParams(CurrentWBGTQuerySchema, data);
      } catch (error: any) {
        const errors = error.errors as any[];
        const latError = errors.find((e) => e.field.includes('latitude'));
        expect(latError).toBeDefined();
      }
    });
  });
});
