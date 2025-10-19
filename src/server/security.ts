/**
 * Security utilities
 */

export interface CorsConfig {
  enabled: boolean;
  allowedOrigins: string;
  allowedMethods: string;
  allowedHeaders: string;
  maxAge: number;
}

/**
 * Security headers for all responses
 */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
} as const;

/**
 * Get CORS headers based on configuration
 */
export function getCorsHeaders(config: CorsConfig): Record<string, string> {
  if (!config.enabled) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": config.allowedOrigins,
    "Access-Control-Allow-Methods": config.allowedMethods,
    "Access-Control-Allow-Headers": config.allowedHeaders,
    "Access-Control-Max-Age": config.maxAge.toString(),
  };
}

/**
 * Combine security and CORS headers
 */
export function getSecurityHeaders(corsConfig: CorsConfig): Record<string, string> {
  return { ...SECURITY_HEADERS, ...getCorsHeaders(corsConfig) };
}

/**
 * Validate and sanitize numeric input
 */
export function validateNumber(
  value: string | null,
  min: number,
  max: number,
  name: string
): { valid: boolean; value?: number; error?: string } {
  if (!value || value.trim() === "") {
    return { valid: false, error: `${name} is required` };
  }

  const num = parseFloat(value);
  
  if (isNaN(num)) {
    return { valid: false, error: `${name} must be a valid number` };
  }

  if (num < min || num > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Validate integer input
 */
export function validateInteger(
  value: string | null,
  min: number,
  max: number,
  name: string
): { valid: boolean; value?: number; error?: string } {
  if (!value || value.trim() === "") {
    return { valid: false, error: `${name} is required` };
  }

  const num = parseInt(value, 10);
  
  if (isNaN(num) || !Number.isInteger(num)) {
    return { valid: false, error: `${name} must be a valid integer` };
  }

  if (num < min || num > max) {
    return { valid: false, error: `${name} must be between ${min} and ${max}` };
  }

  return { valid: true, value: num };
}
