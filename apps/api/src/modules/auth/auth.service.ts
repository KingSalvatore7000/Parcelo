import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { config } from '../../config/env';
import { hashPassword, hashTempPassword, verifyPassword, generateTempPassword } from '../../utils/crypto';
import { socketService } from '../../services/socket.service';
import { securityLog } from '../../services/securityLog';

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

/** Every session of this user ends now: refresh tokens, access tokens and live sockets */
async function endAllSessions(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
  socketService.disconnectUser(userId);
}

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
    mustChangePassword: user.mustChangePassword,
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

/** Refuse a password that is easy to guess for this person */
function weakPasswordReason(password: string, phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (password.replace(/\D/g, '').length >= 10 && digits.endsWith(password.replace(/\D/g, '').slice(-10))) {
    return 'Do not use your phone number as your password.';
  }
  if (/^(password|parcelo)\d*$/i.test(password)) return 'Choose a password that is harder to guess.';
  return null;
}

/**
 * Give a user a new temporary password (an admin creating or resetting an account). They must
 * change it at their next sign-in, and every session they have now ends.
 * Returns the plain password: shown to the admin once, never stored.
 */
export async function setTemporaryPassword(userId: string): Promise<string> {
  const temp = generateTempPassword();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashTempPassword(temp), mustChangePassword: true },
  });
  await endAllSessions(userId);
  return temp;
}

const BAD_LOGIN = { status: 401, code: 'INVALID_LOGIN', message: 'That mobile number and password do not match.' };

export class AuthService {
  /**
   * Sign in with a mobile number and password. The same answer for an unknown number and a wrong
   * password, in the same time, so the form cannot be used to find out who is registered.
   */
  async login(rawPhone: string, password: string) {
    const user = await loadUser({ phone: normalizePhone(rawPhone) });
    const ok = await verifyPassword(password, user?.passwordHash);
    if (!user || !ok) throw BAD_LOGIN;

    const tokens = await this.issueTokens(user);
    return { ...tokens, user: profile(user) };
  }

  /**
   * Change the signed-in user's password. Ends their other sessions; the one in use is replaced
   * by the returned token pair.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await loadUser({ id: userId });
    if (!user) throw { status: 404, code: 'USER_NOT_FOUND', message: 'User not found.' };
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw { status: 400, code: 'WRONG_PASSWORD', message: 'Your current password is not right.' };
    }
    if (currentPassword === newPassword) {
      throw { status: 400, code: 'SAME_PASSWORD', message: 'Choose a password different from the current one.' };
    }
    const weak = weakPasswordReason(newPassword, user.phone);
    if (weak) throw { status: 400, code: 'WEAK_PASSWORD', message: weak };

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });
    await endAllSessions(user.id);

    const fresh = (await loadUser({ id: user.id }))!;
    const tokens = await this.issueTokens(fresh);
    return { ...tokens, user: profile(fresh) };
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
      securityLog('refresh_token_reuse', { userId: row.userId });
      await endAllSessions(row.userId);
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
    await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(refreshToken) } });
  }

  private async issueTokens(user: UserWithPlace) {
    const refreshToken = crypto.randomBytes(32).toString('base64url');
    const session = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + config.refreshTokenDays * 86_400_000),
      },
    });
    // Only identifiers: the server reloads the person on every request, and no phone number sits in the token
    const token = jwt.sign({ id: user.id, sid: session.id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);

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
