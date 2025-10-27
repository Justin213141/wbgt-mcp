/**
 * CORS Middleware Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createCORSMiddleware,
  addCORSHeaders,
  handleCORSPreflight,
  DEFAULT_CORS_CONFIG,
} from '../cors.middleware';

describe('CORS Middleware', () => {
  describe('DEFAULT_CORS_CONFIG', () => {
    it('should have default configuration', () => {
      expect(DEFAULT_CORS_CONFIG.allowedOrigins).toContain('*');
      expect(DEFAULT_CORS_CONFIG.allowedMethods).toContain('GET');
      expect(DEFAULT_CORS_CONFIG.allowedMethods).toContain('POST');
      expect(DEFAULT_CORS_CONFIG.allowedMethods).toContain('OPTIONS');
      expect(DEFAULT_CORS_CONFIG.maxAge).toBe(86400);
    });

    it('should allow content-type header by default', () => {
      expect(DEFAULT_CORS_CONFIG.allowedHeaders).toContain('Content-Type');
    });

    it('should expose rate limit headers', () => {
      expect(DEFAULT_CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Limit');
      expect(DEFAULT_CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Remaining');
      expect(DEFAULT_CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Reset');
    });
  });

  describe('addCORSHeaders', () => {
    it('should add CORS headers to response when origin is allowed', () => {
      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://example.com', DEFAULT_CORS_CONFIG);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
      expect(result.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(result.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should allow any origin when * is in allowedOrigins', () => {
      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://any-origin.com', DEFAULT_CORS_CONFIG);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://any-origin.com');
    });

    it('should set Access-Control-Max-Age', () => {
      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://example.com', DEFAULT_CORS_CONFIG);

      expect(result.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should expose headers', () => {
      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://example.com', DEFAULT_CORS_CONFIG);

      const exposeHeader = result.headers.get('Access-Control-Expose-Headers');
      expect(exposeHeader).toContain('Content-Type');
      expect(exposeHeader).toContain('X-RateLimit');
    });

    it('should preserve existing headers', () => {
      const response = new Response('test', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      const result = addCORSHeaders(response, 'https://example.com', DEFAULT_CORS_CONFIG);

      expect(result.headers.get('Content-Type')).toBe('application/json');
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should not add CORS headers if origin not allowed', () => {
      const config = {
        allowedOrigins: ['https://allowed.com'],
        allowedMethods: ['GET'],
        allowedHeaders: ['Content-Type'],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://not-allowed.com', config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should set credentials header when enabled', () => {
      const config = {
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: true,
      };

      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://example.com', config);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not set credentials header when disabled', () => {
      const config = {
        allowedOrigins: ['*'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://example.com', config);

      expect(result.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('should preserve response status', () => {
      const statusCodes = [200, 201, 400, 404, 500];

      for (const status of statusCodes) {
        const response = new Response('test', { status });
        const result = addCORSHeaders(response, 'https://example.com', DEFAULT_CORS_CONFIG);

        expect(result.status).toBe(status);
      }
    });
  });

  describe('handleCORSPreflight', () => {
    it('should return 204 for valid preflight request', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);

      expect(response.status).toBe(204);
    });

    it('should return 403 for disallowed origin', () => {
      const config = {
        allowedOrigins: ['https://allowed.com'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = handleCORSPreflight('https://not-allowed.com', config);

      expect(response.status).toBe(403);
    });

    it('should include Access-Control-Allow-Methods', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);

      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should include Access-Control-Allow-Headers', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);

      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Content-Type');
    });

    it('should include Access-Control-Max-Age', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);

      expect(response.headers.get('Access-Control-Max-Age')).toBe('86400');
    });

    it('should reject null origin', () => {
      const response = handleCORSPreflight(null, DEFAULT_CORS_CONFIG);

      // Should reject null origin (no Origin header)
      expect(response.status).toBe(403);
    });

    it('should set wildcard origin for allowed requests', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });
  });

  describe('createCORSMiddleware', () => {
    it('should return middleware object with handlePreflight and addHeaders methods', () => {
      const middleware = createCORSMiddleware();

      expect(middleware).toHaveProperty('handlePreflight');
      expect(middleware).toHaveProperty('addHeaders');
      expect(typeof middleware.handlePreflight).toBe('function');
      expect(typeof middleware.addHeaders).toBe('function');
    });

    it('should handle OPTIONS request as preflight', () => {
      const middleware = createCORSMiddleware();
      const request = new Request('https://api.example.com', {
        method: 'OPTIONS',
        headers: { Origin: 'https://example.com' },
      });

      const response = middleware.handlePreflight(request);

      expect(response).toBeDefined();
      expect(response?.status).toBe(204);
    });

    it('should return undefined for non-OPTIONS request', () => {
      const middleware = createCORSMiddleware();
      const request = new Request('https://api.example.com', {
        method: 'GET',
        headers: { Origin: 'https://example.com' },
      });

      const response = middleware.handlePreflight(request);

      expect(response).toBeUndefined();
    });

    it('should add CORS headers to response', () => {
      const middleware = createCORSMiddleware();
      const response = new Response('test', { status: 200 });
      const request = new Request('https://api.example.com', {
        headers: { Origin: 'https://example.com' },
      });

      const result = middleware.addHeaders(response, request);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should accept custom configuration', () => {
      const config = {
        allowedOrigins: ['https://custom.com'],
        allowedMethods: ['GET', 'POST', 'DELETE'],
      };

      const middleware = createCORSMiddleware(config);
      const request = new Request('https://api.example.com', {
        method: 'OPTIONS',
        headers: { Origin: 'https://custom.com' },
      });

      const response = middleware.handlePreflight(request);

      expect(response?.status).toBe(204);
    });

    it('should reject disallowed origins in custom config', () => {
      const config = {
        allowedOrigins: ['https://allowed.com'],
      };

      const middleware = createCORSMiddleware(config);
      const request = new Request('https://api.example.com', {
        method: 'OPTIONS',
        headers: { Origin: 'https://not-allowed.com' },
      });

      const response = middleware.handlePreflight(request);

      expect(response?.status).toBe(403);
    });
  });

  describe('Origin Matching', () => {
    it('should match wildcard origin', () => {
      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://any-origin.com', DEFAULT_CORS_CONFIG);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://any-origin.com');
    });

    it('should match specific origin', () => {
      const config = {
        allowedOrigins: ['https://specific.com', 'https://other.com'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://specific.com', config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://specific.com');
    });

    it('should not match origin not in list', () => {
      const config = {
        allowedOrigins: ['https://allowed.com'],
        allowedMethods: ['GET'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = new Response('test', { status: 200 });
      const result = addCORSHeaders(response, 'https://other.com', config);

      expect(result.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('Methods Configuration', () => {
    it('should allow configured HTTP methods', () => {
      const response = handleCORSPreflight('https://example.com', DEFAULT_CORS_CONFIG);
      const methods = response.headers.get('Access-Control-Allow-Methods');

      expect(methods).toContain('GET');
      expect(methods).toContain('POST');
      expect(methods).toContain('OPTIONS');
    });

    it('should respect custom methods configuration', () => {
      const config = {
        allowedOrigins: ['*'],
        allowedMethods: ['GET', 'DELETE', 'PATCH'],
        allowedHeaders: [],
        exposedHeaders: [],
        maxAge: 86400,
        credentials: false,
      };

      const response = handleCORSPreflight('https://example.com', config);
      const methods = response.headers.get('Access-Control-Allow-Methods');

      expect(methods).toContain('GET');
      expect(methods).toContain('DELETE');
      expect(methods).toContain('PATCH');
      expect(methods).not.toContain('POST');
    });
  });
});
