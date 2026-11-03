"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Rate limiter for OTP requests: 10 requests per 15 mins per IP
const otpRequestLimiter = (0, express_rate_limit_1.default)({
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
const otpVerifyLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many verification attempts. Please wait 15 minutes before retrying.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});
router.post('/otp/request', otpRequestLimiter, (req, res, next) => auth_controller_1.authController.requestOtp(req, res, next));
router.post('/otp/verify', otpVerifyLimiter, (req, res, next) => auth_controller_1.authController.verifyOtp(req, res, next));
router.get('/me', auth_1.authenticate, (req, res, next) => auth_controller_1.authController.getMe(req, res, next));
exports.authRoutes = router;
//# sourceMappingURL=auth.routes.js.map