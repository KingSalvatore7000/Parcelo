import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { normalizePhone } from './auth.service';
import { config } from '../../config/env';

const router = Router();

// OTP rate limits protect real phones from SMS floods and guessing. In development the
// OTP is fixed and nothing is sent, and demo logins / "Switch view" request a fresh OTP
// on every click, so the limits are switched off there.
const skipInDev = () => config.isDev;

// Per phone number: at most 5 OTP requests per 15 mins, whichever IPs they come from.
// Stops one number being flooded with SMS and limits guessing across fresh OTPs.
const otpPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: skipInDev,
  keyGenerator: (req) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone : '';
    return `phone:${normalizePhone(phone)}`;
  },
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP requests for this number. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for OTP requests: 100 requests per 15 mins per IP (generous for shared society Wi-Fi;
// the per-phone limit above is the tight one)
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: skipInDev,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for OTP verification attempts: 200 per 15 mins per IP
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  skip: skipInDev,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many verification attempts. Please wait 15 minutes before retrying.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/request', otpRequestLimiter, otpPhoneLimiter, (req, res, next) => authController.requestOtp(req, res, next));
router.post('/otp/verify', otpVerifyLimiter, (req, res, next) => authController.verifyOtp(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

export const authRoutes = router;
