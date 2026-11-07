import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import {
  UserRole,
  createFlatSchema,
  updateFlatSchema,
  createUserSchema,
  updateUserSchema,
  importResidentsSchema,
} from '@parcelo/shared';
import { authenticate, requireRole } from '../../middleware/auth';
import { adminService } from './admin.service';

const router = Router();

// Every admin route: signed in, ADMIN, and scoped to the admin's own society
router.use(authenticate, requireRole(UserRole.ADMIN));

/** Wrap an async handler so thrown errors reach the error handler */
const h =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

// Overview
router.get('/stats', h(async (req, res) => {
  res.json({ success: true, data: await adminService.getStats(req.user!.societyId) });
}));

// Flats
router.get('/flats', h(async (req, res) => {
  const data = await adminService.listFlats(req.user!.societyId);
  res.json({ success: true, count: data.length, data });
}));
router.post('/flats', h(async (req, res) => {
  const body = createFlatSchema.parse(req.body);
  res.status(201).json({ success: true, data: await adminService.createFlat(req.user!.societyId, body) });
}));
router.patch('/flats/:id', h(async (req, res) => {
  const body = updateFlatSchema.parse(req.body);
  res.json({ success: true, data: await adminService.updateFlat(req.user!.societyId, req.params.id, body) });
}));
router.delete('/flats/:id', h(async (req, res) => {
  await adminService.deleteFlat(req.user!.societyId, req.params.id);
  res.json({ success: true });
}));

// People
router.get('/users', h(async (req, res) => {
  const role = typeof req.query.role === 'string' && req.query.role in UserRole ? (req.query.role as UserRole) : undefined;
  const data = await adminService.listUsers(req.user!.societyId, role);
  res.json({ success: true, count: data.length, data });
}));
router.post('/users', h(async (req, res) => {
  const body = createUserSchema.parse(req.body);
  res.status(201).json({ success: true, data: await adminService.createUser(req.user!.societyId, body) });
}));
router.patch('/users/:id', h(async (req, res) => {
  const body = updateUserSchema.parse(req.body);
  res.json({ success: true, data: await adminService.updateUser(req.user!.societyId, req.user!.id, req.params.id, body) });
}));
router.delete('/users/:id', h(async (req, res) => {
  await adminService.deleteUser(req.user!.societyId, req.user!.id, req.params.id);
  res.json({ success: true });
}));

// CSV import of residents (all-or-nothing; dryRun to preview)
router.post('/residents/import', h(async (req, res) => {
  const body = importResidentsSchema.parse(req.body);
  res.json({ success: true, data: await adminService.importResidents(req.user!.societyId, body) });
}));

export const adminRoutes = router;
