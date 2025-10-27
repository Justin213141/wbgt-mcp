/**
 * Security Headers Middleware
 *
 * Adds security-related HTTP headers to all responses:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - X-XSS-Protection: 1; mode=block
 * - Referrer-Policy: no-referrer
 * - Content-Security-Policy: default-src 'none'
 * - Permissions-Policy: geolocation=(), microphone=(), camera=()
 */

/**
 * Security headers to add to all responses
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'",
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

/**
 * Add security headers to response
 */
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Add all security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Create security headers middleware
 */
export function createSecurityHeadersMiddleware() {
  return (response: Response): Response => {
    return addSecurityHeaders(response);
  };
}
