/**
 * Security Headers Middleware Tests
 */

import { describe, it, expect } from 'vitest';
import { addSecurityHeaders, createSecurityHeadersMiddleware } from '../security-headers.middleware';

describe('Security Headers Middleware', () => {
  describe('addSecurityHeaders', () => {
    it('should add all security headers to response', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(result.headers.get('X-Frame-Options')).toBe('DENY');
      expect(result.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(result.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(result.headers.get('Content-Security-Policy')).toBe("default-src 'none'");
      expect(result.headers.get('Permissions-Policy')).toBe(
        'geolocation=(), microphone=(), camera=()'
      );
      expect(result.headers.get('Strict-Transport-Security')).toBe(
        'max-age=31536000; includeSubDomains'
      );
    });

    it('should preserve existing headers', () => {
      const response = new Response('test', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Custom-Header': 'custom-value',
        },
      });

      const result = addSecurityHeaders(response);

      expect(result.headers.get('Content-Type')).toBe('application/json');
      expect(result.headers.get('Custom-Header')).toBe('custom-value');
    });

    it('should preserve response status', () => {
      const response = new Response('test', { status: 404 });
      const result = addSecurityHeaders(response);

      expect(result.status).toBe(404);
    });

    it('should handle different status codes', () => {
      const statusCodes = [200, 201, 400, 401, 403, 404, 500, 503];

      for (const status of statusCodes) {
        const response = new Response('test', { status });
        const result = addSecurityHeaders(response);

        expect(result.status).toBe(status);
        expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
      }
    });

    it('should preserve response body', async () => {
      const body = JSON.stringify({ message: 'test' });
      const response = new Response(body, { status: 200 });
      const result = addSecurityHeaders(response);

      const resultBody = await result.text();
      expect(resultBody).toBe(body);
    });

    it('should work with empty response', () => {
      const response = new Response('', { status: 200 });
      const result = addSecurityHeaders(response);

      expect(result.status).toBe(200);
      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('createSecurityHeadersMiddleware', () => {
    it('should return a middleware function', () => {
      const middleware = createSecurityHeadersMiddleware();

      expect(typeof middleware).toBe('function');
    });

    it('should apply security headers when middleware is called', () => {
      const middleware = createSecurityHeadersMiddleware();
      const response = new Response('test', { status: 200 });

      const result = middleware(response);

      expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should preserve original response properties', () => {
      const middleware = createSecurityHeadersMiddleware();
      const response = new Response('test data', {
        status: 201,
        headers: { 'X-Custom': 'value' },
      });

      const result = middleware(response);

      expect(result.status).toBe(201);
      expect(result.headers.get('X-Custom')).toBe('value');
      expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should be chainable with other middleware', () => {
      const middleware = createSecurityHeadersMiddleware();
      let response = new Response('test', { status: 200 });

      // First middleware call
      response = middleware(response);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

      // Second middleware call (should still work)
      response = middleware(response);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });
  });

  describe('CSP Header', () => {
    it('should enforce strict CSP policy', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const csp = result.headers.get('Content-Security-Policy');
      expect(csp).toBe("default-src 'none'");
    });
  });

  describe('HSTS Header', () => {
    it('should enforce strict HTTPS with HSTS', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const hsts = result.headers.get('Strict-Transport-Security');
      expect(hsts).toContain('max-age=31536000');
      expect(hsts).toContain('includeSubDomains');
    });
  });

  describe('Frame Options', () => {
    it('should deny framing with X-Frame-Options DENY', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const frameOptions = result.headers.get('X-Frame-Options');
      expect(frameOptions).toBe('DENY');
    });
  });

  describe('Permissions Policy', () => {
    it('should disable sensitive permissions', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const permPolicy = result.headers.get('Permissions-Policy');
      expect(permPolicy).toContain('geolocation=()');
      expect(permPolicy).toContain('microphone=()');
      expect(permPolicy).toContain('camera=()');
    });
  });

  describe('Referrer Policy', () => {
    it('should enforce no-referrer policy', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const referrerPolicy = result.headers.get('Referrer-Policy');
      expect(referrerPolicy).toBe('no-referrer');
    });
  });

  describe('XSS Protection', () => {
    it('should enable XSS protection', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const xssProtection = result.headers.get('X-XSS-Protection');
      expect(xssProtection).toBe('1; mode=block');
    });
  });

  describe('Content-Type Sniffing', () => {
    it('should prevent MIME-type sniffing', () => {
      const response = new Response('test', { status: 200 });
      const result = addSecurityHeaders(response);

      const contentTypeOptions = result.headers.get('X-Content-Type-Options');
      expect(contentTypeOptions).toBe('nosniff');
    });
  });
});
