"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generate4DigitCode = generate4DigitCode;
exports.generate6DigitOtp = generate6DigitOtp;
exports.hashCode = hashCode;
exports.verifyCode = verifyCode;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const SALT_ROUNDS = 10;
/**
 * Generate a cryptographically secure 4-digit code (e.g. for parcel handover)
 */
function generate4DigitCode() {
    // Generates integer between 1000 and 9999
    const num = crypto_1.default.randomInt(1000, 10000);
    return num.toString();
}
/**
 * Generate a 6-digit OTP for login
 */
function generate6DigitOtp() {
    const num = crypto_1.default.randomInt(100000, 1000000);
    return num.toString();
}
/**
 * Hash a code or OTP with bcrypt
 */
async function hashCode(code) {
    return bcryptjs_1.default.hash(code, SALT_ROUNDS);
}
/**
 * Verify code against stored hash
 */
async function verifyCode(code, hash) {
    return bcryptjs_1.default.compare(code, hash);
}
//# sourceMappingURL=crypto.js.map