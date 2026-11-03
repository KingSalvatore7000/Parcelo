"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.requireRole = requireRole;
exports.enforceSocietyScope = enforceSocietyScope;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
/**
 * Verifies JWT token from Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
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
        const decoded = jsonwebtoken_1.default.verify(token, env_1.config.jwtSecret);
        req.user = decoded;
        next();
    }
    catch (err) {
        res.status(401).json({
            error: 'TOKEN_EXPIRED_OR_INVALID',
            message: 'Your session has expired or the token is invalid. Please log in again.',
        });
    }
}
/**
 * Restricts access to specified user roles (e.g. GUARD, ADMIN, RESIDENT)
 */
function requireRole(...allowedRoles) {
    return (req, res, next) => {
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
function enforceSocietyScope(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
        return;
    }
    const querySocietyId = req.query.societyId || req.body?.societyId;
    if (querySocietyId && querySocietyId !== req.user.societyId) {
        res.status(403).json({
            error: 'TENANT_MISMATCH',
            message: 'Cross-society data access is strictly forbidden.',
        });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map