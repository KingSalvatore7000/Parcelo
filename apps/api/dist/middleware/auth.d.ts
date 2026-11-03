import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@thapal/shared';
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
export declare function authenticate(req: Request, res: Response, next: NextFunction): void;
/**
 * Restricts access to specified user roles (e.g. GUARD, ADMIN, RESIDENT)
 */
export declare function requireRole(...allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
/**
 * Enforces society tenant isolation: ensures incoming request societyId matches user's societyId
 */
export declare function enforceSocietyScope(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map