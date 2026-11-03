"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
exports.normalizePhone = normalizePhone;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../lib/prisma");
const env_1 = require("../../config/env");
const crypto_1 = require("../../utils/crypto");
/**
 * Standardize Indian phone number to E.164 format (+91XXXXXXXXXX)
 */
function normalizePhone(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
        return `+${digits}`;
    }
    if (rawPhone.startsWith('+')) {
        return rawPhone.trim();
    }
    return `+${digits}`;
}
class AuthService {
    /**
     * Request OTP for phone login
     */
    async requestOtp(rawPhone) {
        const phone = normalizePhone(rawPhone);
        // Verify user exists in the system
        const user = await prisma_1.prisma.user.findUnique({
            where: { phone },
            include: {
                society: true,
                flat: true,
            },
        });
        if (!user) {
            throw {
                status: 404,
                code: 'USER_NOT_FOUND',
                message: `No account registered with phone ${phone}. Please contact your society gate or admin to register your flat.`,
            };
        }
        // Generate OTP (use default in dev for easy testing or random 6-digit)
        const otp = env_1.config.nodeEnv === 'development' && env_1.config.defaultDevOtp ? env_1.config.defaultDevOtp : (0, crypto_1.generate6DigitOtp)();
        const otpHash = await (0, crypto_1.hashCode)(otp);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
        // Invalidate prior sessions
        await prisma_1.prisma.otpSession.deleteMany({
            where: { phone },
        });
        // Save session
        await prisma_1.prisma.otpSession.create({
            data: {
                phone,
                otpHash,
                expiresAt,
                attempts: 0,
            },
        });
        // Pluggable SMS logger / mock
        if (env_1.config.mockSmsConsole) {
            console.log('========================================================');
            console.log(`📱 [MOCK SMS to ${phone}]`);
            console.log(`Your Thapal verification code is: [ ${otp} ]`);
            console.log(`Valid for 5 minutes. Do not share this with anyone.`);
            console.log('========================================================');
        }
        return {
            success: true,
            message: `OTP sent successfully to ${phone}`,
            expiresInSeconds: 300,
            devOtp: env_1.config.nodeEnv === 'development' ? otp : undefined,
        };
    }
    /**
     * Verify OTP and issue JWT session
     */
    async verifyOtp(rawPhone, otp) {
        const phone = normalizePhone(rawPhone);
        const session = await prisma_1.prisma.otpSession.findFirst({
            where: { phone },
            orderBy: { createdAt: 'desc' },
        });
        if (!session) {
            throw {
                status: 400,
                code: 'NO_ACTIVE_OTP',
                message: 'No active OTP request found for this phone number. Please request a new OTP.',
            };
        }
        if (new Date() > session.expiresAt) {
            await prisma_1.prisma.otpSession.delete({ where: { id: session.id } });
            throw {
                status: 400,
                code: 'OTP_EXPIRED',
                message: 'The OTP has expired. Please request a new code.',
            };
        }
        if (session.attempts >= 5) {
            await prisma_1.prisma.otpSession.delete({ where: { id: session.id } });
            throw {
                status: 429,
                code: 'MAX_ATTEMPTS_EXCEEDED',
                message: 'Too many incorrect attempts. For security, please request a fresh OTP.',
            };
        }
        const isValid = await (0, crypto_1.verifyCode)(otp, session.otpHash);
        if (!isValid) {
            const remaining = 5 - (session.attempts + 1);
            await prisma_1.prisma.otpSession.update({
                where: { id: session.id },
                data: { attempts: { increment: 1 } },
            });
            throw {
                status: 400,
                code: 'INVALID_OTP',
                message: `Incorrect OTP entered. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new OTP.'}`,
            };
        }
        // OTP is valid! Clean up session
        await prisma_1.prisma.otpSession.delete({ where: { id: session.id } });
        // Fetch user details
        const user = await prisma_1.prisma.user.findUnique({
            where: { phone },
            include: {
                society: true,
                flat: true,
            },
        });
        if (!user) {
            throw {
                status: 404,
                code: 'USER_NOT_FOUND',
                message: 'User record not found.',
            };
        }
        const payload = {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            societyId: user.societyId,
            flatId: user.flatId,
        };
        const token = jsonwebtoken_1.default.sign(payload, env_1.config.jwtSecret, {
            expiresIn: '7d',
        });
        return {
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                societyId: user.societyId,
                societyName: user.society.name,
                flatId: user.flatId,
                flat: user.flat
                    ? {
                        id: user.flat.id,
                        societyId: user.flat.societyId,
                        tower: user.flat.tower,
                        number: user.flat.number,
                        label: `Tower ${user.flat.tower} - ${user.flat.number}`,
                    }
                    : null,
            },
        };
    }
    /**
     * Get user profile by ID
     */
    async getProfile(userId) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            include: {
                society: true,
                flat: true,
            },
        });
        if (!user) {
            throw {
                status: 404,
                code: 'USER_NOT_FOUND',
                message: 'User profile not found.',
            };
        }
        return {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            societyId: user.societyId,
            societyName: user.society.name,
            flatId: user.flatId,
            flat: user.flat
                ? {
                    id: user.flat.id,
                    societyId: user.flat.societyId,
                    tower: user.flat.tower,
                    number: user.flat.number,
                    label: `Tower ${user.flat.tower} - ${user.flat.number}`,
                }
                : null,
        };
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map