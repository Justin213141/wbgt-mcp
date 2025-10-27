/**
 * CORS Middleware
 *
 * Configures CORS headers for API access
 */

/**
 * CORS configuration
 */
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
  credentials: boolean;
}

/**
 * Default CORS configuration
 * Allows requests from any origin (can be restricted via environment)
 */
export const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
  credentials: false,
};

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) {
    return false;
  }

  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response: Response, origin: string | null, config: CORSConfig): Response {
  const headers = new Headers(response.headers);

  if (isOriginAllowed(origin, config.allowedOrigins)) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
    headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
    headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
    headers.set('Access-Control-Max-Age', String(config.maxAge));

    if (config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Handle CORS preflight requests
 */
export function handleCORSPreflight(origin: string | null, config: CORSConfig): Response {
  if (!isOriginAllowed(origin, config.allowedOrigins)) {
    return new Response(null, { status: 403 });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin || '*');
  headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));
  headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  headers.set('Access-Control-Max-Age', String(config.maxAge));

  if (config.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return new Response(null, {
    status: 204,
    headers,
  });
}

/**
 * Create CORS middleware
 */
export function createCORSMiddleware(config: Partial<CORSConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CORS_CONFIG, ...config };

  return {
    handlePreflight: (request: Request): Response | undefined => {
      if (request.method === 'OPTIONS') {
        const origin = request.headers.get('Origin');
        return handleCORSPreflight(origin, mergedConfig);
      }
      return undefined;
    },

    addHeaders: (response: Response, request: Request): Response => {
      const origin = request.headers.get('Origin');
      return addCORSHeaders(response, origin, mergedConfig);
    },
  };
}
