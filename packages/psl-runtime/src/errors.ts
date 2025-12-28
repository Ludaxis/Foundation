export class ActionError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    options?: { status?: number; details?: unknown }
  ) {
    super(message);
    this.name = 'ActionError';
    this.code = code;
    this.status = options?.status || 400;
    this.details = options?.details;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends ActionError {
  public readonly fields: Record<string, string[]>;

  constructor(
    message: string,
    fields: Record<string, string[]>,
    details?: unknown
  ) {
    super('VALIDATION_ERROR', message, { status: 400, details });
    this.name = 'ValidationError';
    this.fields = fields;
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        fields: this.fields,
        details: this.details,
      },
    };
  }
}

export class NotFoundError extends ActionError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, { status: 404 });
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends ActionError {
  constructor(message = 'Access denied') {
    super('FORBIDDEN', message, { status: 403 });
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends ActionError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, { status: 401 });
    this.name = 'UnauthorizedError';
  }
}

export class ConflictError extends ActionError {
  constructor(message: string) {
    super('CONFLICT', message, { status: 409 });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends ActionError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', { status: 429 });
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class InvariantViolationError extends ActionError {
  constructor(invariant: string, message: string) {
    super('INVARIANT_VIOLATION', message, {
      status: 400,
      details: { invariant },
    });
    this.name = 'InvariantViolationError';
  }
}
