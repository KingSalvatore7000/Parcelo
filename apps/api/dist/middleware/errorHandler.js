"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
function errorHandler(err, req, res, next) {
    console.error('API Error:', err);
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Invalid request data provided.',
            details: err.errors.map((e) => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred. Please try again.',
    });
}
//# sourceMappingURL=errorHandler.js.map