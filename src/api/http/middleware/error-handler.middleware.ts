/**
 * Error Handler Middleware
 *
 * Handles errors and sanitizes error messages for client responses
 * - Full errors logged server-side only
 * - Generic errors returned to clients
 * - Appropriate HTTP status codes
 */

import { AppError, isAppError, toAppError } from '../../../utils/errors';
import { createLogger } from '../../../utils/logger';
import { addSecurityHeaders } from './security-headers.middleware';

const logger = createLogger('ErrorHandler');

/**
 * Safe error response (no sensitive info)
 */
interface SafeErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  timestamp: string;
}

/**
 * Sanitize error for client response
 * Remove internal details that could be security risks
 */
function sanitizeErrorForClient(error: AppError): SafeErrorResponse {
  // For validation errors, include the field but not implementation details
  const isSafeError =
    error.code === 'VALIDATION_ERROR' ||
    error.code === 'RATE_LIMIT_EXCEEDED' ||
    error.code === 'API_ERROR';

  return {
    success: false,
    error: {
      code: error.code,
      message: isSafeError ? error.message : 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create error response
 */
export function createErrorResponse(error: AppError): Response {
  const safeResponse = sanitizeErrorForClient(error);

  return new Response(JSON.stringify(safeResponse), {
    status: error.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle any error and return appropriate response
 */
export function handleError(error: unknown): Response {
  // Convert to AppError
  const appError = isAppError(error) ? error : toAppError(error);

  // Log full error server-side
  if (appError.statusCode >= 500) {
    logger.error(
      `Server error: ${appError.code}`,
      new Error(appError.message),
      {
        code: appError.code,
        statusCode: appError.statusCode,
        context: appError.context,
      },
      'ErrorHandler'
    );
  } else {
    logger.warn(
      `Client error: ${appError.code}`,
      {
        code: appError.code,
        statusCode: appError.statusCode,
        context: appError.context,
      },
      'ErrorHandler'
    );
  }

  // Return sanitized response
  const response = createErrorResponse(appError);
  return addSecurityHeaders(response);
}

/**
 * Create error handler middleware
 */
export function createErrorHandlerMiddleware() {
  return (error: unknown): Response => {
    return handleError(error);
  };
}

/**
 * Wrap async handler with error catching
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleError(error);
    }
  }) as T;
}

/**
 * Wrap sync handler with error catching
 */
export function withErrorHandlingSync<T extends (...args: any[]) => Response>(
  handler: T
): T {
  return ((...args: any[]) => {
    try {
      return handler(...args);
    } catch (error) {
      return handleError(error);
    }
  }) as T;
}
