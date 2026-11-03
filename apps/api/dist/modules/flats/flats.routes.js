"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flatRoutes = void 0;
const express_1 = require("express");
const prisma_1 = require("../../lib/prisma");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.enforceSocietyScope);
/**
 * GET /flats
 * Returns all flats in the user's society for autocomplete / dropdown
 */
router.get('/', async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
            return;
        }
        const flats = await prisma_1.prisma.flat.findMany({
            where: { societyId: req.user.societyId },
            orderBy: [{ tower: 'asc' }, { number: 'asc' }],
            include: {
                _count: {
                    select: { users: true },
                },
            },
        });
        const formatted = flats.map((f) => ({
            id: f.id,
            societyId: f.societyId,
            tower: f.tower,
            number: f.number,
            label: `Tower ${f.tower} - ${f.number}`,
            residentCount: f._count.users,
        }));
        res.status(200).json({
            success: true,
            count: formatted.length,
            data: formatted,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.flatRoutes = router;
//# sourceMappingURL=flats.routes.js.map