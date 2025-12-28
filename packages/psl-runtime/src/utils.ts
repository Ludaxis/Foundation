import crypto from 'crypto';

/**
 * Generates a unique ID with optional prefix.
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Generates a UUID v4.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Creates a SHA-256 hash of a string.
 */
export function hashString(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Sanitizes a string for safe logging (removes sensitive patterns).
 */
export function sanitize(
  input: string,
  patterns: RegExp[] = [
    /password\s*[:=]\s*["']?[^"'\s]+["']?/gi,
    /token\s*[:=]\s*["']?[^"'\s]+["']?/gi,
    /secret\s*[:=]\s*["']?[^"'\s]+["']?/gi,
    /api[_-]?key\s*[:=]\s*["']?[^"'\s]+["']?/gi,
  ]
): string {
  let result = input;
  for (const pattern of patterns) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Deep freezes an object to make it immutable.
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  const propNames = Object.getOwnPropertyNames(obj);

  for (const name of propNames) {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Creates a deterministic hash from an object (for idempotency keys).
 */
export function objectHash(obj: unknown): string {
  const normalized = JSON.stringify(obj, Object.keys(obj as object).sort());
  return hashString(normalized).slice(0, 16);
}

/**
 * Safely parses JSON with a default fallback.
 */
export function safeParseJSON<T>(input: string, fallback: T): T {
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

/**
 * Delays execution for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: 'fixed' | 'exponential';
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const {
    attempts = 3,
    delay: initialDelay = 1000,
    backoff = 'exponential',
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === attempts) {
        throw lastError;
      }

      if (onRetry) {
        onRetry(lastError, attempt);
      }

      const waitTime =
        backoff === 'exponential'
          ? initialDelay * Math.pow(2, attempt - 1)
          : initialDelay;

      await delay(waitTime);
    }
  }

  throw lastError!;
}
