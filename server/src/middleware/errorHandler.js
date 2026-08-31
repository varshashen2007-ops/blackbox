import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);
  const errorCode = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');

  const response = {
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred'
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  // Never expose raw stack traces in production environment
  if (config.nodeEnv === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}
