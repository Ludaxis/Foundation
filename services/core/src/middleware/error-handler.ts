import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ActionError, ValidationError } from '@foundation/psl-runtime';
import { logger } from '../lib/logger.js';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log the error
  logger.error({
    err,
    method: req.method,
    url: req.url,
    requestId: req.headers['x-request-id'],
  }, 'Request error');

  // Handle known error types
  if (err instanceof ActionError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  if (err instanceof ValidationError) {
    res.status(err.status).json(err.toJSON());
    return;
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: (err as unknown as { errors: unknown[] }).errors,
      },
    });
    return;
  }

  // Handle unknown errors
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};
