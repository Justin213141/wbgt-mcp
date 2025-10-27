/**
 * HTTP Query Parameter Schemas
 *
 * Zod schemas for validating HTTP query parameters
 * Ensures strong type safety and runtime validation
 */

import { z } from 'zod';

/**
 * Coordinate validation schema
 * Latitude: -90 to 90
 * Longitude: -180 to 180
 */
const CoordinateSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

/**
 * Date validation schema
 * YYYY-MM-DD format
 */
const DateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format'
);

/**
 * Date range schema
 */
const DateRangeSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  { message: 'Start date must be before or equal to end date' }
);

/**
 * Timestamp validation schema
 * ISO 8601 format
 */
const TimestampSchema = z.string().datetime('Timestamp must be in valid ISO 8601 format');

/**
 * Weather parameters schema
 */
const WeatherParametersSchema = z.object({
  temperature: z.coerce
    .number()
    .min(-50, 'Temperature must be at least -50°C')
    .max(60, 'Temperature must be at most 60°C')
    .optional(),
  relativeHumidity: z.coerce
    .number()
    .min(0, 'Relative humidity must be between 0 and 100%')
    .max(100, 'Relative humidity must be between 0 and 100%')
    .optional(),
  windSpeed: z.coerce
    .number()
    .min(0, 'Wind speed must be non-negative')
    .max(40, 'Wind speed must be at most 40 m/s')
    .optional(),
  solarRadiation: z.coerce
    .number()
    .min(0, 'Solar radiation must be non-negative')
    .max(2000, 'Solar radiation must be at most 2000 W/m²')
    .optional(),
  atmosphericPressure: z.coerce
    .number()
    .min(90000, 'Atmospheric pressure must be at least 90000 Pa')
    .max(110000, 'Atmospheric pressure must be at most 110000 Pa')
    .optional(),
});

/**
 * Current WBGT query schema
 */
export const CurrentWBGTQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  timestamp: TimestampSchema.optional(),
  source: z.enum(['open-meteo', 'bom']).optional(),
});

export type CurrentWBGTQuery = z.infer<typeof CurrentWBGTQuerySchema>;

/**
 * Forecast WBGT query schema
 */
export const ForecastWBGTQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  days: z.coerce
    .number()
    .min(1, 'Days must be at least 1')
    .max(16, 'Forecast is limited to 16 days')
    .optional()
    .default(7),
  source: z.enum(['open-meteo']).optional(),
});

export type ForecastWBGTQuery = z.infer<typeof ForecastWBGTQuerySchema>;

/**
 * Historic WBGT query schema
 */
export const HistoricWBGTQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  startDate: DateSchema,
  endDate: DateSchema,
  source: z.enum(['open-meteo', 'kong']).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  { message: 'Start date must be before or equal to end date' }
);

export type HistoricWBGTQuery = z.infer<typeof HistoricWBGTQuerySchema>;

/**
 * Observations query schema
 */
export const ObservationsQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  startDate: DateSchema,
  endDate: DateSchema,
  source: z.enum(['open-meteo', 'kong']).optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  { message: 'Start date must be before or equal to end date' }
);

export type ObservationsQuery = z.infer<typeof ObservationsQuerySchema>;

/**
 * Health check query schema
 */
export const HealthCheckQuerySchema = z.object({}).strict();

export type HealthCheckQuery = z.infer<typeof HealthCheckQuerySchema>;

/**
 * Validate query parameters
 * Returns parsed data or throws ValidationError
 */
export function validateQueryParams<T>(schema: z.ZodSchema<T>, params: Record<string, any>): T {
  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    const error = new Error('Query parameter validation failed');
    (error as any).code = 'VALIDATION_ERROR';
    (error as any).errors = errors;
    throw error;
  }

  return result.data;
}
