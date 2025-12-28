// Foundation Dev PSL Runtime
// Pure TypeScript utilities for policy evaluation, audit logging, and metrics

export { PolicyEngine, type PolicyContext, type PolicyResult } from './policy/engine.js';
export { evaluateCondition, type ConditionContext } from './policy/conditions.js';
export { RateLimiter, type RateLimitConfig, type RateLimitResult } from './policy/rate-limit.js';

export { AuditLogger, auditLog, type AuditEntry, type AuditConfig } from './audit/logger.js';

export { MetricsTracker, type MetricEvent, type MetricDimensions } from './metrics/tracker.js';

export { TenantContext, type TenantInfo } from './tenancy/context.js';

export { ActionError, ValidationError, NotFoundError, ForbiddenError } from './errors.js';

export { generateId, hashString, sanitize, deepFreeze } from './utils.js';
