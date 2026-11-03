import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticate, enforceSocietyScope } from '../../middleware/auth';

const router = Router();

router.use(authenticate, enforceSocietyScope);

/**
 * GET /flats
 * Returns all flats in the user's society for autocomplete / dropdown
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }

    const flats = await prisma.flat.findMany({
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
  } catch (err) {
    next(err);
  }
});

export const flatRoutes = router;
