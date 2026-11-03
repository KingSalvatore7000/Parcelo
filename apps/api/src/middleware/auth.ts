import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@thapal/shared';
import { config } from '../config/env';

export interface AuthUserPayload {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  societyId: string;
  flatId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

/**
 * Verifies JWT token from Authorization: Bearer <token>
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication token missing or invalid. Please log in to continue.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({
      error: 'TOKEN_EXPIRED_OR_INVALID',
      message: 'Your session has expired or the token is invalid. Please log in again.',
    });
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
        message: `Access denied. Requires one of [${allowedRoles.join(', ')}], but current role is ${req.user.role}.`,
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
