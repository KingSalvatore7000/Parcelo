import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Generate a cryptographically secure 4-digit code (e.g. for parcel handover)
 */
export function generate4DigitCode(): string {
  // Generates integer between 1000 and 9999
  const num = crypto.randomInt(1000, 10000);
  return num.toString();
}

/**
 * Generate a 6-digit OTP for login
 */
export function generate6DigitOtp(): string {
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

/**
 * Hash a code or OTP with bcrypt
 */
export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, SALT_ROUNDS);
}

/**
 * Verify code against stored hash
 */
export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
