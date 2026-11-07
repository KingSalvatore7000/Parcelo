import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data provided.',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Body parser errors
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'PAYLOAD_TOO_LARGE', message: 'The request is too large.' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'INVALID_JSON', message: 'The request body is not valid JSON.' });
    return;
  }

  const statusCode = Number(err?.status || err?.statusCode) || 500;

  if (statusCode >= 500) {
    // Unexpected failure: log everything, tell the client nothing internal
    console.error(`API Error on ${req.method} ${req.originalUrl}:`, err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: config.isDev && err?.message ? err.message : 'An unexpected error occurred. Please try again.',
    });
    return;
  }

  // Expected errors thrown deliberately by services ({ status, code, message })
  res.status(statusCode).json({
    error: err.code || 'REQUEST_FAILED',
    message: err.message || 'The request could not be completed.',
  });
}
