/**
 * Cache Configuration Constants
 *
 * Cache keys, TTL values, and caching strategies
 */

// === Cache Keys ===

/**
 * Cache key prefix for all WBGT-related caches
 */
export const CACHE_PREFIX = 'wbgt';

/**
 * Forecast data cache key
 */
export const FORECAST_CACHE_KEY = `${CACHE_PREFIX}:forecast`;

/**
 * Current observations cache key
 */
export const OBSERVATIONS_CACHE_KEY = `${CACHE_PREFIX}:observations`;

/**
 * Historic observations cache key
 */
export const HISTORIC_CACHE_KEY = `${CACHE_PREFIX}:historic`;

// === Cache TTL (Time-To-Live) ===

/**
 * Forecast cache TTL [seconds]
 * Forecast data is relatively stable, cache for longer period
 */
export const FORECAST_TTL_SECONDS = 12 * 60 * 60; // 12 hours

/**
 * Observations cache TTL [seconds]
 * Recent observations update frequently, shorter cache
 */
export const OBSERVATIONS_TTL_SECONDS = 30 * 60; // 30 minutes

/**
 * Historic data cache TTL [seconds]
 * Historic data is stable, can cache longer
 */
export const HISTORIC_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * API response cache TTL [seconds]
 * Default TTL for general API responses
 */
export const DEFAULT_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

// === Cache Strategies ===

/**
 * Cache invalidation settings
 */
export const CACHE_INVALIDATION = {
  /**
   * Clear cache on deployment (if desired)
   */
  CLEAR_ON_DEPLOY: false,

  /**
   * Cache stale-while-revalidate window [seconds]
   * Serve stale cache while fetching fresh data in background
   */
  STALE_WHILE_REVALIDATE_SECONDS: 24 * 60 * 60, // 24 hours

  /**
   * Cache stale-if-error window [seconds]
   * Serve stale cache if external API fails
   */
  STALE_IF_ERROR_SECONDS: 24 * 60 * 60, // 24 hours
} as const;

// === Rate Limiting ===

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  /**
   * Maximum requests per hour per IP
   */
  REQUESTS_PER_HOUR: 100,

  /**
   * Rate limit window [seconds]
   */
  WINDOW_SECONDS: 60 * 60, // 1 hour

  /**
   * Retry-After header value [seconds]
   */
  RETRY_AFTER_SECONDS: 60,
} as const;

// === Data Retention ===

/**
 * How long to keep historical data in cache [seconds]
 */
export const DATA_RETENTION_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Maximum age of observations before considering stale [seconds]
 */
export const OBSERVATIONS_MAX_AGE_SECONDS = 24 * 60 * 60; // 24 hours

// === External API Rate Limits ===

/**
 * Open-Meteo API rate limiting
 * Open-Meteo is generous with rate limits for free tier
 */
export const OPENMETEO_API = {
  /**
   * Maximum requests per second (free tier)
   */
  RATE_LIMIT_PER_SECOND: 1,

  /**
   * Requests per day (soft limit)
   */
  DAILY_LIMIT: 10000,

  /**
   * Request timeout [milliseconds]
   */
  TIMEOUT_MS: 30000,
} as const;

/**
 * BOM (Bureau of Meteorology) API rate limiting
 */
export const BOM_API = {
  /**
   * Rate limit (BOM doesn't publish limits, being conservative)
   */
  RATE_LIMIT_PER_SECOND: 1,

  /**
   * Request timeout [milliseconds]
   */
  TIMEOUT_MS: 30000,
} as const;

// === Request Coalescing ===

/**
 * Request coalescing settings
 * Prevent duplicate concurrent requests to external APIs
 */
export const REQUEST_COALESCING = {
  /**
   * Coalesce requests within this time window [milliseconds]
   */
  WINDOW_MS: 100,

  /**
   * Maximum requests to coalesce
   */
  MAX_COALESCE: 10,
} as const;
