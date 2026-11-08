import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { normalizePhone } from './auth.service';

const router = Router();
const FIFTEEN_MIN = 15 * 60 * 1000;

// Password guessing: only failed sign-ins count, so normal use (and demo account switching) never trips it.
// Per number: 10 wrong passwords per 15 mins, whichever IPs they come from.
const loginPhoneLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `phone:${normalizePhone(typeof req.body?.phone === 'string' ? req.body.phone.slice(0, 20) : '')}`,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many wrong passwords for this number. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Per IP: 100 failed sign-ins per 15 mins (generous for a society's shared Wi-Fi)
const loginIpLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 100,
  skipSuccessfulRequests: true,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many failed sign-ins from this network. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Changing a password: 10 wrong current passwords per signed-in user per 15 mins
const passwordChangeLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${req.user?.id ?? 'anon'}`,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many wrong passwords. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: FIFTEEN_MIN,
  max: 200,
  message: { error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait a few minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginIpLimiter, loginPhoneLimiter, (req, res, next) => authController.login(req, res, next));
router.post('/password', authenticate, passwordChangeLimiter, (req, res, next) => authController.changePassword(req, res, next));
router.post('/refresh', refreshLimiter, (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', refreshLimiter, (req, res, next) => authController.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

export const authRoutes = router;
