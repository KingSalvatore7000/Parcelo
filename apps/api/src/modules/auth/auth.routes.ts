import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Rate limiter for OTP requests: 10 requests per 15 mins per IP
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many OTP requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for OTP verification attempts: 20 per 15 mins per IP
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many verification attempts. Please wait 15 minutes before retrying.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/otp/request', otpRequestLimiter, (req, res, next) => authController.requestOtp(req, res, next));
router.post('/otp/verify', otpVerifyLimiter, (req, res, next) => authController.verifyOtp(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));

export const authRoutes = router;
