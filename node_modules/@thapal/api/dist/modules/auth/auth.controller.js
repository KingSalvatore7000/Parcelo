"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const shared_1 = require("@thapal/shared");
const auth_service_1 = require("./auth.service");
class AuthController {
    async requestOtp(req, res, next) {
        try {
            const validated = shared_1.requestOtpSchema.parse(req.body);
            const result = await auth_service_1.authService.requestOtp(validated.phone);
            res.status(200).json(result);
        }
        catch (err) {
            next(err);
        }
    }
    async verifyOtp(req, res, next) {
        try {
            const validated = shared_1.verifyOtpSchema.parse(req.body);
            const result = await auth_service_1.authService.verifyOtp(validated.phone, validated.otp);
            res.status(200).json({
                success: true,
                message: 'Authentication successful',
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    async getMe(req, res, next) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
                return;
            }
            const user = await auth_service_1.authService.getProfile(req.user.id);
            res.status(200).json({
                success: true,
                data: user,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map