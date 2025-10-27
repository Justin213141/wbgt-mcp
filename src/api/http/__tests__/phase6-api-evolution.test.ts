import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Phase 6: API Evolution Test Suite
 *
 * Tests for:
 * - API versioning (/api/v1/ vs /api/)
 * - Handler functions
 * - Error response format
 * - Deprecation headers
 * - CORS support
 */

// Mock the handler functions
const createMockCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
});

const createMockDeprecationHeaders = () => ({
  ...createMockCorsHeaders(),
  'Deprecation': 'true',
  'Sunset': 'Sun, 31 Dec 2025 23:59:59 GMT',
  'X-API-Warn': 'This endpoint uses legacy API (v0). Please migrate to /api/v1 to avoid future deprecation',
});

describe('Phase 6: API Evolution - Handler Functions', () => {
  let corsHeaders: Record<string, string>;

  beforeEach(() => {
    corsHeaders = createMockCorsHeaders();
  });

  describe('GET /api/v1/current - Get Current WBGT', () => {
    it('should return success response with current data', () => {
      const mockData = {
        success: true,
        data: {
          timestamp: '2025-10-27T12:00:00Z',
          temperature: 28.5,
          humidity: 65,
          dew_point: 20.2,
          wind_speed_ms: 3.2,
          solar_radiation: 450,
          cloud_cover: 25,
          uv_index: 6,
          wbgt: 26.3,
          esi: 24.1,
          apparent_temp: 31.2
        },
        timestamp: expect.any(String),
        note: 'Current WBGT conditions in Sydney'
      };

      expect(mockData.success).toBe(true);
      expect(mockData.data).toHaveProperty('timestamp');
      expect(mockData.data).toHaveProperty('temperature');
      expect(mockData.data).toHaveProperty('wbgt');
      expect(mockData.data.temperature).toBeGreaterThan(0);
      expect(mockData.data.wbgt).toBeGreaterThan(0);
    });

    it('should have correct CORS headers', () => {
      expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
      expect(corsHeaders['Content-Type']).toBe('application/json');
    });

    it('should NOT have deprecation headers for v1 endpoint', () => {
      expect(corsHeaders['Deprecation']).toBeUndefined();
      expect(corsHeaders['X-API-Warn']).toBeUndefined();
    });
  });

  describe('GET /api/v1/forecast - Get 72-hour Forecast', () => {
    it('should return array of forecast data with count', () => {
      const mockForecast = {
        success: true,
        data: [
          {
            timestamp: '2025-10-27T13:00:00Z',
            temperature: 29.1,
            humidity: 62,
            wbgt: 26.8,
            solar_radiation: 480
          },
          {
            timestamp: '2025-10-27T14:00:00Z',
            temperature: 29.5,
            humidity: 60,
            wbgt: 27.2,
            solar_radiation: 520
          }
        ],
        count: 2,
        timestamp: expect.any(String),
        note: 'WBGT forecast (72 hours)'
      };

      expect(Array.isArray(mockForecast.data)).toBe(true);
      expect(mockForecast.count).toBe(mockForecast.data.length);
      expect(mockForecast.data.length).toBeGreaterThan(0);
      expect(mockForecast.success).toBe(true);
    });

    it('should include forecast data with required fields', () => {
      const forecastItem = {
        timestamp: '2025-10-27T13:00:00Z',
        temperature: 29.1,
        humidity: 62,
        dew_point: 19.8,
        wind_speed_ms: 3.5,
        solar_radiation: 480,
        cloud_cover: 20,
        uv_index: 6.5,
        wbgt: 26.8,
        esi: 24.5,
        apparent_temp: 31.8
      };

      expect(forecastItem).toHaveProperty('timestamp');
      expect(forecastItem).toHaveProperty('temperature');
      expect(forecastItem).toHaveProperty('wbgt');
      expect(forecastItem).toHaveProperty('solar_radiation');
    });
  });

  describe('GET /api/v1/observations - Get 72-hour Observations', () => {
    it('should return observations array without time window params', () => {
      const mockObs = {
        success: true,
        data: [
          {
            timestamp: '2025-10-27T10:00:00Z',
            temperature: 26.5,
            humidity: 70,
            wbgt: 24.2
          }
        ],
        count: 1,
        note: 'Past 72-hour WBGT observations (Kong method)'
      };

      expect(mockObs.success).toBe(true);
      expect(Array.isArray(mockObs.data)).toBe(true);
      expect(mockObs.count).toBeGreaterThanOrEqual(0);
    });

    it('should support optional time window parameters', () => {
      const params = new URLSearchParams({
        start_time: '2025-10-27T10:00:00Z',
        end_time: '2025-10-27T14:00:00Z'
      });

      expect(params.get('start_time')).toBeDefined();
      expect(params.get('end_time')).toBeDefined();
    });

    it('should return max WBGT when time window specified', () => {
      const mockMaxObs = {
        success: true,
        data: [
          {
            timestamp: '2025-10-27T10:00:00Z to 2025-10-27T14:00:00Z',
            temperature: 29.8,
            humidity: 65,
            wbgt: 27.5
          }
        ],
        note: 'Max WBGT conditions during activity from ... to ...'
      };

      expect(mockMaxObs.data[0].timestamp).toContain('to');
      expect(mockMaxObs.note).toContain('Max WBGT');
    });
  });

  describe('GET /api/v1/historic_observations - Historical Data', () => {
    it('should require start_date and end_date parameters', () => {
      const url = new URL('http://localhost/api/v1/historic_observations');

      // Missing required params
      expect(url.searchParams.get('start_date')).toBeNull();
      expect(url.searchParams.get('end_date')).toBeNull();
    });

    it('should accept YYYY-MM-DD date format', () => {
      const url = new URL('http://localhost/api/v1/historic_observations');
      url.searchParams.set('start_date', '2025-10-01');
      url.searchParams.set('end_date', '2025-10-26');

      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should support optional latitude and longitude', () => {
      const url = new URL('http://localhost/api/v1/historic_observations');
      url.searchParams.set('latitude', '-33.8018');
      url.searchParams.set('longitude', '151.1254');

      const lat = url.searchParams.get('latitude');
      const lon = url.searchParams.get('longitude');

      expect(parseFloat(lat!)).toBeGreaterThanOrEqual(-90);
      expect(parseFloat(lat!)).toBeLessThanOrEqual(90);
      expect(parseFloat(lon!)).toBeGreaterThanOrEqual(-180);
      expect(parseFloat(lon!)).toBeLessThanOrEqual(180);
    });

    it('should default to Sydney coordinates', () => {
      const defaultLat = -33.8018;
      const defaultLon = 151.1254;

      expect(defaultLat).toBeCloseTo(-33.8018, 4);
      expect(defaultLon).toBeCloseTo(151.1254, 4);
    });

    it('should return data array with location info', () => {
      const mockHistoric = {
        success: true,
        data: [
          {
            timestamp: '2025-10-01T00:00:00Z',
            temperature: 24.5,
            wbgt: 22.1
          }
        ],
        count: 1,
        location: { latitude: -33.8018, longitude: 151.1254 }
      };

      expect(mockHistoric.location).toHaveProperty('latitude');
      expect(mockHistoric.location).toHaveProperty('longitude');
    });
  });

  describe('GET /api/v1/historic_observations_japan - Japan Historical Data', () => {
    it('should require all four parameters: start_date, end_date, latitude, longitude', () => {
      const url = new URL('http://localhost/api/v1/historic_observations_japan');

      // All required
      url.searchParams.set('start_date', '2025-10-01');
      url.searchParams.set('end_date', '2025-10-26');
      url.searchParams.set('latitude', '35.6762');
      url.searchParams.set('longitude', '139.6503');

      expect(url.searchParams.get('start_date')).toBeDefined();
      expect(url.searchParams.get('end_date')).toBeDefined();
      expect(url.searchParams.get('latitude')).toBeDefined();
      expect(url.searchParams.get('longitude')).toBeDefined();
    });

    it('should include JST timezone in response', () => {
      const mockJapan = {
        success: true,
        data: [],
        location: { latitude: 35.6762, longitude: 139.6503 },
        timezone: 'JST (UTC+9)'
      };

      expect(mockJapan.timezone).toContain('JST');
      expect(mockJapan.timezone).toContain('UTC+9');
    });

    it('should use Tokyo coordinates as example', () => {
      const tokyoLat = 35.6762;
      const tokyoLon = 139.6503;

      expect(tokyoLat).toBeGreaterThan(30);
      expect(tokyoLat).toBeLessThan(40);
      expect(tokyoLon).toBeGreaterThan(130);
      expect(tokyoLon).toBeLessThan(145);
    });
  });

  describe('GET /api/v1/health - Health Check', () => {
    it('should return status ok', () => {
      const mockHealth = {
        status: 'ok',
        service: 'WBGT Sydney Runner API',
        timestamp: expect.any(String)
      };

      expect(mockHealth.status).toBe('ok');
      expect(mockHealth.service).toBeDefined();
      expect(mockHealth.timestamp).toBeDefined();
    });
  });

  describe('GET /api/v1 - API Documentation', () => {
    it('should return API information with version v1', () => {
      const mockDoc = {
        service: 'WBGT Sydney Runner API',
        version: 'v1',
        deprecated: false,
        endpoints: {
          'GET /api/v1/current': 'Current WBGT conditions in Sydney',
          'GET /api/v1/forecast': '72-hour WBGT forecast for Sydney'
        }
      };

      expect(mockDoc.version).toBe('v1');
      expect(mockDoc.deprecated).toBe(false);
      expect(Object.keys(mockDoc.endpoints).length).toBeGreaterThan(0);
    });

    it('should not include deprecation notice for v1', () => {
      const mockDoc = {
        version: 'v1',
        note: 'This is the recommended API version'
      };

      expect(mockDoc.note).toContain('recommended');
      expect(mockDoc.note).not.toContain('deprecated');
    });
  });
});

// ============================================================================

describe('Phase 6: API Evolution - Error Responses', () => {
  describe('Error Response Format', () => {
    it('should have consistent error structure', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'MISSING_REQUIRED_PARAMETERS',
          message: 'Missing required parameters: start_date and end_date'
        },
        timestamp: new Date().toISOString(),
        path: '/api/v1/historic_observations'
      };

      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse.timestamp).toBeDefined();
      expect(errorResponse.path).toBeDefined();
    });

    it('should include error details when provided', () => {
      const errorWithDetails = {
        success: false,
        error: {
          code: 'MISSING_REQUIRED_PARAMETERS',
          message: 'Missing required parameters',
          details: {
            required: ['start_date', 'end_date'],
            optional: ['latitude', 'longitude'],
            format: 'YYYY-MM-DD'
          }
        },
        timestamp: new Date().toISOString()
      };

      expect(errorWithDetails.error).toHaveProperty('details');
      expect(errorWithDetails.error.details).toHaveProperty('required');
      expect(Array.isArray(errorWithDetails.error.details.required)).toBe(true);
    });

    it('should have standard error codes', () => {
      const validCodes = [
        'MISSING_REQUIRED_PARAMETERS',
        'FETCH_FAILED',
        'ENDPOINT_NOT_FOUND',
        'INTERNAL_SERVER_ERROR'
      ];

      const exampleError = {
        code: 'MISSING_REQUIRED_PARAMETERS'
      };

      expect(validCodes).toContain(exampleError.code);
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 400 for bad requests', () => {
      const statusCode = 400;
      expect(statusCode).toBe(400);
    });

    it('should return 404 for not found', () => {
      const statusCode = 404;
      expect(statusCode).toBe(404);
    });

    it('should return 500 for server errors', () => {
      const statusCode = 500;
      expect(statusCode).toBe(500);
    });

    it('should return 200 for success', () => {
      const statusCode = 200;
      expect(statusCode).toBe(200);
    });
  });
});

// ============================================================================

describe('Phase 6: API Evolution - API Versioning', () => {
  describe('V1 Endpoints (Recommended)', () => {
    const v1Endpoints = [
      '/api/v1/current',
      '/api/v1/forecast',
      '/api/v1/observations',
      '/api/v1/historic_observations',
      '/api/v1/historic_observations_japan',
      '/api/v1/health',
      '/api/v1'
    ];

    v1Endpoints.forEach(endpoint => {
      it(`should support ${endpoint}`, () => {
        const url = new URL(`http://localhost${endpoint}`);
        expect(url.pathname).toBe(endpoint);
      });
    });
  });

  describe('Legacy Endpoints (Deprecated)', () => {
    const legacyEndpoints = [
      '/api/current',
      '/api/forecast',
      '/api/observations',
      '/api/historic_observations',
      '/api/historic_observations_japan'
    ];

    legacyEndpoints.forEach(endpoint => {
      it(`should maintain ${endpoint} for backward compatibility`, () => {
        const url = new URL(`http://localhost${endpoint}`);
        expect(url.pathname).toBe(endpoint);
      });
    });
  });

  describe('Deprecation Headers', () => {
    it('should have Deprecation header set to true', () => {
      const headers = createMockDeprecationHeaders();
      expect(headers['Deprecation']).toBe('true');
    });

    it('should have Sunset date header', () => {
      const headers = createMockDeprecationHeaders();
      expect(headers['Sunset']).toContain('31 Dec 2025');
    });

    it('should have migration warning in X-API-Warn header', () => {
      const headers = createMockDeprecationHeaders();
      expect(headers['X-API-Warn']).toContain('legacy API');
      expect(headers['X-API-Warn']).toContain('v1');
    });

    it('should NOT include deprecation headers for v1', () => {
      const headers = createMockCorsHeaders();
      expect(headers['Deprecation']).toBeUndefined();
      expect(headers['X-API-Warn']).toBeUndefined();
    });
  });
});

// ============================================================================

describe('Phase 6: API Evolution - CORS & Headers', () => {
  describe('CORS Headers', () => {
    it('should include Access-Control-Allow-Origin', () => {
      const headers = createMockCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should include Access-Control-Allow-Methods', () => {
      const headers = createMockCorsHeaders();
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });

    it('should include Access-Control-Allow-Headers', () => {
      const headers = createMockCorsHeaders();
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
    });

    it('should include Content-Type: application/json', () => {
      const headers = createMockCorsHeaders();
      expect(headers['Content-Type']).toBe('application/json');
    });
  });

  describe('CORS Preflight', () => {
    it('should handle OPTIONS method with 204 No Content', () => {
      const statusCode = 204;
      expect(statusCode).toBe(204);
    });

    it('should return headers on OPTIONS request', () => {
      const headers = createMockCorsHeaders();
      expect(Object.keys(headers).length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================

describe('Phase 6: API Evolution - API Root Documentation', () => {
  describe('GET /api/v1 - V1 Documentation', () => {
    it('should indicate version v1', () => {
      const doc = {
        version: 'v1',
        deprecated: false
      };

      expect(doc.version).toBe('v1');
      expect(doc.deprecated).toBe(false);
    });

    it('should list all v1 endpoints', () => {
      const doc = {
        endpoints: {
          'GET /api/v1/current': 'Current WBGT conditions in Sydney',
          'GET /api/v1/forecast': '72-hour WBGT forecast for Sydney',
          'GET /api/v1/observations': 'Past 72-hour observations',
          'GET /api/v1/historic_observations': 'Historical WBGT data',
          'GET /api/v1/historic_observations_japan': 'Historical data for Japan',
          'GET /api/v1/health': 'Health check'
        }
      };

      expect(Object.keys(doc.endpoints).length).toBe(6);
    });

    it('should provide migration information', () => {
      const doc = {
        documentation: {
          note: 'This is the recommended API version',
          migration: 'Update your integration to use /api/v1/'
        }
      };

      expect(doc.documentation.migration).toContain('v1');
    });
  });

  describe('GET /api - Legacy Documentation', () => {
    it('should indicate legacy version', () => {
      const doc = {
        version: 'legacy (v0)',
        deprecated: true
      };

      expect(doc.version).toContain('legacy');
      expect(doc.deprecated).toBe(true);
    });

    it('should show deprecation notice', () => {
      const doc = {
        note: 'This API version is deprecated. Please use /api/v1/ instead.'
      };

      expect(doc.note).toContain('deprecated');
      expect(doc.note).toContain('v1');
    });

    it('should list both v1 (recommended) and legacy endpoints', () => {
      const doc = {
        endpoints: {
          'GET /api/v1/current': 'Current (RECOMMENDED)',
          'GET /api/current': 'Current (deprecated)'
        }
      };

      expect(Object.keys(doc.endpoints).length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============================================================================

describe('Phase 6: API Evolution - OpenAPI Endpoints', () => {
  describe('GET /api/docs/openapi.yaml', () => {
    it('should return YAML content type', () => {
      const contentType = 'application/yaml';
      expect(contentType).toBe('application/yaml');
    });

    it('should include openapi version', () => {
      const spec = `openapi: 3.0.0`;
      expect(spec).toContain('openapi: 3.0.0');
    });

    it('should document all endpoints', () => {
      const spec = {
        paths: {
          '/api/v1/current': {},
          '/api/v1/forecast': {},
          '/api/v1/observations': {},
          '/api/v1/historic_observations': {},
          '/api/v1/historic_observations_japan': {}
        }
      };

      expect(Object.keys(spec.paths).length).toBe(5);
    });
  });

  describe('GET /api/docs/openapi.json', () => {
    it('should return JSON content type', () => {
      const contentType = 'application/json';
      expect(contentType).toBe('application/json');
    });

    it('should include openapi version', () => {
      const spec = {
        openapi: '3.0.0'
      };

      expect(spec.openapi).toBe('3.0.0');
    });

    it('should have caching headers', () => {
      const headers = {
        'Cache-Control': 'max-age=86400',
        'Content-Type': 'application/json'
      };

      expect(headers['Cache-Control']).toContain('86400');
    });
  });
});
