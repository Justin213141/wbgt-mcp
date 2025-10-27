/**
 * Error Handler Middleware Tests
 */

import { describe, it, expect } from 'vitest';
import {
  handleError,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingSync,
} from '../error-handler.middleware';
import {
  AppError,
  ValidationError,
  CoordinateError,
  RateLimitError,
  WBGTCalculationError,
} from '../../../../utils/errors';

describe('Error Handler Middleware', () => {
  describe('createErrorResponse', () => {
    it('should create a response with 400 status for validation errors', () => {
      const error = new ValidationError('Invalid input');
      const response = createErrorResponse(error);

      expect(response.status).toBe(400);
    });

    it('should create a response with 429 status for rate limit errors', () => {
      const error = new RateLimitError(60);
      const response = createErrorResponse(error);

      expect(response.status).toBe(429);
    });

    it('should create a response with 500 status for app errors', () => {
      const error = new AppError('Internal error', 'INTERNAL_ERROR', 500);
      const response = createErrorResponse(error);

      expect(response.status).toBe(500);
    });

    it('should include error code and message in response', async () => {
      const error = new ValidationError('Test error', { field: 'latitude' });
      const response = createErrorResponse(error);
      const body = (await response.json()) as any;

      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.message).toBe('Test error');
    });

    it('should include timestamp in response', async () => {
      const error = new ValidationError('Test error');
      const response = createErrorResponse(error);
      const body = (await response.json()) as any;

      expect(body.timestamp).toBeDefined();
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
    });

    it('should set Content-Type header', () => {
      const error = new ValidationError('Test error');
      const response = createErrorResponse(error);

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('handleError', () => {
    it('should handle AppError instances', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400);
      const response = handleError(error);

      expect(response.status).toBe(400);
    });

    it('should handle ValidationError instances', () => {
      const error = new ValidationError('Invalid input');
      const response = handleError(error);

      expect(response.status).toBe(400);
    });

    it('should handle CoordinateError instances', () => {
      const error = new CoordinateError('Invalid latitude');
      const response = handleError(error);

      expect(response.status).toBe(400);
    });

    it('should handle native Error instances', () => {
      const error = new Error('Something went wrong');
      const response = handleError(error);

      expect(response.status).toBe(500);
    });

    it('should handle string errors', () => {
      const response = handleError('String error');

      expect(response.status).toBe(500);
    });

    it('should handle unknown errors', () => {
      const response = handleError({ unknown: 'error' });

      expect(response.status).toBe(500);
    });

    it('should sanitize error messages for non-validation errors', async () => {
      const error = new WBGTCalculationError('Calculation failed: internal details');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.error.message).toBe('An unexpected error occurred');
    });

    it('should preserve validation error messages', async () => {
      const error = new ValidationError('Latitude must be between -90 and 90');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.error.message).toBe('Latitude must be between -90 and 90');
    });

    it('should include security headers in response', () => {
      const error = new ValidationError('Test error');
      const response = handleError(error);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('should handle rate limit errors correctly', async () => {
      const error = new RateLimitError(120);
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(response.status).toBe(429);
      expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('withErrorHandling', () => {
    it('should wrap async function and catch errors', async () => {
      const handler = async () => {
        throw new ValidationError('Test error');
      };

      const wrapped = withErrorHandling(handler as any);
      const response = (await wrapped()) as Response;

      expect(response.status).toBe(400);
    });

    it('should pass through successful responses', async () => {
      const handler = async () => {
        return new Response('success', { status: 200 });
      };

      const wrapped = withErrorHandling(handler);
      const response = await wrapped();

      expect(response.status).toBe(200);
    });

    it('should handle errors in async handlers', async () => {
      const handler = async () => {
        throw new Error('Async error');
      };

      const wrapped = withErrorHandling(handler as any);
      const response = (await wrapped()) as Response;

      expect(response.status).toBe(500);
    });

    it('should preserve response body', async () => {
      const handler = async () => {
        return new Response(JSON.stringify({ data: 'test' }), { status: 200 });
      };

      const wrapped = withErrorHandling(handler);
      const response = await wrapped();
      const body = (await response.json()) as any;

      expect(body.data).toBe('test');
    });
  });

  describe('withErrorHandlingSync', () => {
    it('should wrap sync function and catch errors', () => {
      const handler = () => {
        throw new ValidationError('Test error');
      };

      const wrapped = withErrorHandlingSync(handler as any);
      const response = (wrapped()) as Response;

      expect(response.status).toBe(400);
    });

    it('should pass through successful responses', () => {
      const handler = () => {
        return new Response('success', { status: 200 });
      };

      const wrapped = withErrorHandlingSync(handler as any);
      const response = (wrapped()) as Response;

      expect(response.status).toBe(200);
    });

    it('should handle errors in sync handlers', () => {
      const handler = () => {
        throw new Error('Sync error');
      };

      const wrapped = withErrorHandlingSync(handler as any);
      const response = (wrapped()) as Response;

      expect(response.status).toBe(500);
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize internal error details', async () => {
      const error = new WBGTCalculationError('Failed at line 42: invalid state');
      const response = handleError(error);
      const body = (await response.json()) as any;

      // Should not expose internal details
      expect(body.error.message).not.toContain('line 42');
      expect(body.error.message).not.toContain('invalid state');
    });

    it('should expose validation error details', async () => {
      const error = new ValidationError('Invalid coordinate', {
        field: 'latitude',
        value: 95,
      });
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.error.message).toContain('Invalid coordinate');
    });

    it('should preserve error code', async () => {
      const error = new ValidationError('Test error');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Response Structure', () => {
    it('should include success: false in error response', async () => {
      const error = new ValidationError('Test error');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.success).toBe(false);
    });

    it('should include timestamp in error response', async () => {
      const error = new ValidationError('Test error');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.timestamp).toBeDefined();
    });

    it('should include error object with code and message', async () => {
      const error = new ValidationError('Test error');
      const response = handleError(error);
      const body = (await response.json()) as any;

      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
    });
  });

  describe('HTTP Status Codes', () => {
    it('should return 400 for validation errors', () => {
      const error = new ValidationError('Invalid input');
      const response = handleError(error);

      expect(response.status).toBe(400);
    });

    it('should return 429 for rate limit errors', () => {
      const error = new RateLimitError();
      const response = handleError(error);

      expect(response.status).toBe(429);
    });

    it('should return 500 for calculation errors', () => {
      const error = new WBGTCalculationError('Calculation failed');
      const response = handleError(error);

      expect(response.status).toBe(500);
    });

    it('should return 500 for unknown errors', () => {
      const response = handleError('Unknown error');

      expect(response.status).toBe(500);
    });
  });
});
