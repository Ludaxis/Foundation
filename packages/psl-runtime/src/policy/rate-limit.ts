export interface RateLimitConfig {
  requestsPerMinute: number;
  burst?: number;
  scope: 'user' | 'tenant' | 'ip' | 'global';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private windowMs = 60000; // 1 minute

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const maxRequests = this.config.requestsPerMinute + (this.config.burst || 0);

    let entry = this.store.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs,
      };
    }

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetAt = new Date(entry.resetAt);

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      resetAt,
    };
  }

  consume(key: string): RateLimitResult {
    const result = this.check(key);

    if (result.allowed) {
      const now = Date.now();
      let entry = this.store.get(key);

      if (!entry || now > entry.resetAt) {
        entry = {
          count: 1,
          resetAt: now + this.windowMs,
        };
      } else {
        entry.count++;
      }

      this.store.set(key, entry);
    }

    return result;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  getKey(
    scope: 'user' | 'tenant' | 'ip' | 'global',
    identifiers: { userId?: string; tenantId?: string; ip?: string }
  ): string {
    switch (scope) {
      case 'user':
        return `rate:user:${identifiers.userId || 'anonymous'}`;
      case 'tenant':
        return `rate:tenant:${identifiers.tenantId || 'default'}`;
      case 'ip':
        return `rate:ip:${identifiers.ip || 'unknown'}`;
      case 'global':
        return 'rate:global';
      default:
        return `rate:${identifiers.userId || identifiers.ip || 'unknown'}`;
    }
  }

  // Cleanup expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}
