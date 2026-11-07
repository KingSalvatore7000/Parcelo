import { Router } from 'express';
import { UserRole } from '@parcelo/shared';
import { parcelsController } from './parcels.controller';
import { authenticate, requireRole, enforceSocietyScope } from '../../middleware/auth';

const router = Router();

// All parcel routes require authentication and society scoping
router.use(authenticate, enforceSocietyScope);

// List parcels (scoped by role inside the controller)
router.get('/', (req, res, next) => parcelsController.getParcels(req, res, next));

// Guard logs incoming parcel
router.post(
  '/',
  requireRole(UserRole.GUARD, UserRole.ADMIN),
  (req, res, next) => parcelsController.createParcel(req, res, next)
);

// Upload parcel photo
router.post(
  '/upload-photo',
  requireRole(UserRole.GUARD, UserRole.ADMIN),
  (req, res, next) => parcelsController.uploadPhoto(req, res, next)
);

// Bookable handover slots and fees (before /:id)
router.get('/slots', (req, res, next) => parcelsController.getSlots(req, res, next));

// Single parcel details
router.get('/:id', (req, res, next) => parcelsController.getParcelById(req, res, next));

// Guard verifies 4-digit code and completes handover
router.post(
  '/:id/handover',
  requireRole(UserRole.GUARD, UserRole.ADMIN),
  (req, res, next) => parcelsController.completeHandover(req, res, next)
);

// Gate returns an uncollected parcel to the courier
router.post(
  '/:id/return',
  requireRole(UserRole.GUARD, UserRole.ADMIN),
  (req, res, next) => parcelsController.returnParcel(req, res, next)
);

// Resident schedules (or reschedules) pickup mode + slot (generates a fresh 4-digit code)
router.post(
  '/:id/schedule',
  requireRole(UserRole.RESIDENT, UserRole.ADMIN),
  (req, res, next) => parcelsController.scheduleParcel(req, res, next)
);

export const parcelRoutes = router;
