import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@parcelo/shared';
import { config } from '../config/env';
import { prisma } from '../lib/prisma';

export interface AuthUserPayload {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  societyId: string;
  flatId?: string | null;
  /** Set only on the loaded user (never in the token): a temporary password is still in use */
  mustChangePassword?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Verifies a JWT and reloads the user from the database, so a deleted user,
 * a role change or a flat move takes effect immediately instead of at token expiry.
 * Returns null for any invalid token or missing user.
 */
export async function resolveAuthUser(token: string | undefined | null): Promise<AuthUserPayload | null> {
  if (!token) return null;

  let decoded: { id?: unknown; sid?: unknown };
  try {
    decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] }) as { id?: unknown; sid?: unknown };
  } catch {
    return null;
  }
  if (typeof decoded.id !== 'string' || typeof decoded.sid !== 'string') return null;

  const found = await prisma.user.findUnique({
    where: { id: decoded.id },
    select: {
      id: true, name: true, phone: true, role: true, societyId: true, flatId: true, mustChangePassword: true,
      // Sign-out and password changes delete this row, which ends the access token at once
      refreshTokens: { where: { id: decoded.sid }, select: { id: true } },
    },
  });
  if (!found || found.refreshTokens.length === 0) return null;

  const { refreshTokens: _session, ...user } = found;
  return { ...user, role: user.role as UserRole };
}

/**
 * Verifies JWT token from Authorization: Bearer <token>
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid. Please log in to continue.',
    });
    return;
  }

  try {
    const user = await resolveAuthUser(authHeader.slice('Bearer '.length));
    if (!user) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED_OR_INVALID',
        message: 'Your session has expired or the token is invalid. Please log in again.',
      });
      return;
    }
    // A temporary password (known to the admin who set it) only opens /auth until it is replaced
    if (user.mustChangePassword && req.baseUrl !== '/auth') {
      res.status(403).json({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Set your own password before using Parcelo.',
      });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts access to specified user roles (e.g. GUARD, ADMIN, RESIDENT)
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You do not have permission to do this.',
      });
      return;
    }

    next();
  };
}

/**
 * Enforces society tenant isolation: ensures incoming request societyId matches user's societyId
 */
export function enforceSocietyScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
    return;
  }

  const querySocietyId = (req.query.societyId as string) || (req.body?.societyId as string);

  if (querySocietyId && querySocietyId !== req.user.societyId) {
    res.status(403).json({
      error: 'TENANT_MISMATCH',
      message: 'Cross-society data access is strictly forbidden.',
    });
    return;
  }

  next();
}
