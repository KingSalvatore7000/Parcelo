import { Router } from 'express';
import { UserRole } from '@thapal/shared';
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

// Single parcel details
router.get('/:id', (req, res, next) => parcelsController.getParcelById(req, res, next));

// Guard verifies 4-digit code and completes handover
router.post(
  '/:id/handover',
  requireRole(UserRole.GUARD, UserRole.ADMIN),
  (req, res, next) => parcelsController.completeHandover(req, res, next)
);

// Resident schedules pickup mode + slot (generates 4-digit code)
router.post(
  '/:id/schedule',
  requireRole(UserRole.RESIDENT, UserRole.ADMIN),
  (req, res, next) => parcelsController.scheduleParcel(req, res, next)
);

export const parcelRoutes = router;
