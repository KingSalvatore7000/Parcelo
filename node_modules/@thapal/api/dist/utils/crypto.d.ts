/**
 * Generate a cryptographically secure 4-digit code (e.g. for parcel handover)
 */
export declare function generate4DigitCode(): string;
/**
 * Generate a 6-digit OTP for login
 */
export declare function generate6DigitOtp(): string;
/**
 * Hash a code or OTP with bcrypt
 */
export declare function hashCode(code: string): Promise<string>;
/**
 * Verify code against stored hash
 */
export declare function verifyCode(code: string, hash: string): Promise<boolean>;
//# sourceMappingURL=crypto.d.ts.map