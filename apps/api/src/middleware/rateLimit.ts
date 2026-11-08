import rateLimit from 'express-rate-limit';

/** A limit per signed-in user per 15 minutes, for expensive endpoints. Use after authenticate. */
export const perUserLimit = (max: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    keyGenerator: (req) => `user:${req.user?.id ?? req.ip}`,
    message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a few minutes and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
