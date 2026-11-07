import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '@parcelo/shared';
import { prisma } from '../../lib/prisma';
import { config } from '../../config/env';
import { hashCode, verifyCode, generate6DigitOtp } from '../../utils/crypto';
import { AuthUserPayload } from '../../middleware/auth';
import { sendOtp } from '../../services/notify/notifier';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

/**
 * Standardize Indian phone number to E.164 format (+91XXXXXXXXXX)
 */
export function normalizePhone(rawPhone: string): string {
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

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

type UserWithPlace = NonNullable<Awaited<ReturnType<typeof loadUser>>>;
function loadUser(where: { id: string } | { phone: string }) {
  return prisma.user.findUnique({ where, include: { society: true, flat: true } });
}

function profile(user: UserWithPlace) {
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

export class AuthService {
  /**
   * Request OTP for phone login. Outside development the answer is the same whether or not the
   * number is registered, so the endpoint cannot be used to find out who lives in a society.
   */
  async requestOtp(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    const generic = {
      success: true,
      message: 'If this number is registered with Parcelo, a sign-in code is on its way.',
      expiresInSeconds: OTP_TTL_MS / 1000,
    };

    const user = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!user) {
      if (config.isDev) {
        throw {
          status: 404,
          code: 'USER_NOT_FOUND',
          message: `No account registered with phone ${phone}. Ask your society admin to add you.`,
        };
      }
      return generic;
    }

    // Fixed OTP only in development (config leaves it undefined otherwise); random everywhere else
    const otp = config.defaultDevOtp ?? generate6DigitOtp();
    const otpHash = await hashCode(otp);

    // Invalidate this number's earlier sessions and sweep away any expired ones
    await prisma.otpSession.deleteMany({
      where: { OR: [{ phone }, { expiresAt: { lt: new Date() } }] },
    });
    const session = await prisma.otpSession.create({
      data: { phone, otpHash, expiresAt: new Date(Date.now() + OTP_TTL_MS), attempts: 0 },
    });

    try {
      await sendOtp(phone, otp);
    } catch (err) {
      await prisma.otpSession.deleteMany({ where: { id: session.id } });
      console.error(`OTP delivery to ${phone} failed:`, (err as Error).message);
      throw { status: 503, code: 'OTP_NOT_SENT', message: 'We could not send the sign-in code. Please try again in a minute.' };
    }

    return { ...generic, devOtp: config.isDev ? otp : undefined };
  }

  /**
   * Verify OTP and start a session: a short access token and a refresh token
   */
  async verifyOtp(rawPhone: string, otp: string) {
    const phone = normalizePhone(rawPhone);

    const session = await prisma.otpSession.findFirst({
      where: { phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw { status: 400, code: 'NO_ACTIVE_OTP', message: 'No active code for this number. Please request a new one.' };
    }
    if (new Date() > session.expiresAt) {
      await prisma.otpSession.deleteMany({ where: { id: session.id } });
      throw { status: 400, code: 'OTP_EXPIRED', message: 'The code has expired. Please request a new one.' };
    }

    // Reserve the attempt before checking, so parallel guesses cannot pass the limit
    const reserved = await prisma.otpSession.updateMany({
      where: { id: session.id, attempts: { lt: MAX_OTP_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    if (reserved.count === 0) {
      // deleteMany: parallel guesses may race to remove the same row
      await prisma.otpSession.deleteMany({ where: { id: session.id } });
      throw { status: 429, code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Too many incorrect attempts. Please request a new code.' };
    }

    if (!(await verifyCode(otp, session.otpHash))) {
      const remaining = MAX_OTP_ATTEMPTS - (session.attempts + 1);
      throw {
        status: 400,
        code: 'INVALID_OTP',
        message: `Incorrect code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'Please request a new code.'}`,
      };
    }

    await prisma.otpSession.deleteMany({ where: { id: session.id } });

    const user = await loadUser({ phone });
    if (!user) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User record not found.' };
    }

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: profile(user) };
  }

  /**
   * Exchange a refresh token for a new pair. The old refresh token stops working; presenting it
   * again means it was copied, so every session of that user is ended.
   */
  async refresh(refreshToken: string) {
    const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    const invalid = { status: 401, code: 'REFRESH_INVALID', message: 'Your session has ended. Please sign in again.' };

    if (!row) throw invalid;
    if (row.revokedAt) {
      await prisma.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      throw invalid;
    }
    if (row.expiresAt < new Date()) throw invalid;

    // Revoke atomically, so two refreshes with one token cannot both succeed
    const revoked = await prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count === 0) throw invalid;

    const user = await loadUser({ id: row.userId });
    if (!user) throw invalid;

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: profile(user) };
  }

  /** End this device's session */
  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(user: UserWithPlace) {
    const payload: AuthUserPayload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role as UserRole,
      societyId: user.societyId,
      flatId: user.flatId,
    };
    const token = jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

    const refreshToken = crypto.randomBytes(32).toString('base64url');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
      },
    });
    // Old, used or expired tokens of this user are no longer needed
    await prisma.refreshToken.deleteMany({
      where: { userId: user.id, OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 86_400_000) } }] },
    });

    return { token, refreshToken };
  }

  /**
   * Get user profile by ID
   */
  async getProfile(userId: string) {
    const user = await loadUser({ id: userId });
    if (!user) {
      throw { status: 404, code: 'USER_NOT_FOUND', message: 'User profile not found.' };
    }
    return profile(user);
  }
}

export const authService = new AuthService();
