import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const CODE_ROUNDS = 10;
const PASSWORD_ROUNDS = 12;

/**
 * Generate a cryptographically secure 4-digit code (parcel handover)
 */
export function generate4DigitCode(): string {
  return crypto.randomInt(1000, 10000).toString();
}

/** Hash a short handover code */
export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, CODE_ROUNDS);
}

/** Verify a handover code against its hash */
export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

/**
 * Temporary passwords are random (10 characters of 54, about 57 bits) and replaced at first sign-in,
 * so a lower cost is safe and keeps a 1,000-row import to seconds instead of minutes.
 */
export async function hashTempPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 8);
}

/** Compare against a real hash, or a fixed dummy one so a missing user takes the same time */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', PASSWORD_ROUNDS);
export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && !!hash;
}

/** A temporary password an admin can read out: 10 characters, no look-alikes (0/O, 1/l/I) */
export function generateTempPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  // always a letter and a digit, so it passes the password rules
  return /\d/.test(out) && /[a-z]/i.test(out) ? out : generateTempPassword();
}
