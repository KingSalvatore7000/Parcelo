import { Request, Response, NextFunction } from 'express';
import { createParcelSchema, handoverVerifySchema, scheduleParcelSchema, ParcelStatus } from '@thapal/shared';
import { parcelsService } from './parcels.service';
import { storageService } from '../../services/storage.service';

export class ParcelsController {
  /**
   * POST /parcels (Guard logs parcel)
   */
  async createParcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const validated = createParcelSchema.parse(req.body);

      const parcel = await parcelsService.logParcel({
        societyId: req.user.societyId,
        flatId: validated.flatId,
        courier: validated.courier,
        photoUrl: validated.photoUrl || null,
        guardId: req.user.id,
      });

      res.status(201).json({
        success: true,
        message: 'Parcel logged successfully and resident notified',
        data: parcel,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /parcels (Scoped by role & society)
   */
  async getParcels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const status = req.query.status as ParcelStatus | undefined;
      const search = req.query.search as string | undefined;

      const parcels = await parcelsService.getParcels({
        societyId: req.user.societyId,
        userRole: req.user.role,
        userId: req.user.id,
        userFlatId: req.user.flatId,
        status,
        search,
      });

      res.status(200).json({
        success: true,
        count: parcels.length,
        data: parcels,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /parcels/:id
   */
  async getParcelById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const parcel = await parcelsService.getParcelById(req.params.id, req.user.societyId);

      // If resident, ensure they can only view their own flat's parcel
      if (req.user.role === 'RESIDENT' && parcel.flatId !== req.user.flatId) {
        res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You can only view parcels addressed to your flat.',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: parcel,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /parcels/:id/handover (Guard submits 4-digit code)
   */
  async completeHandover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      const validated = handoverVerifySchema.parse(req.body);

      const result = await parcelsService.completeHandover(
        req.params.id,
        req.user.societyId,
        req.user.id,
        validated.code
      );

      res.status(200).json({
        success: true,
        message: 'Handover verified and completed successfully!',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /parcels/:id/schedule (Resident schedules pickup or door delivery)
   */
  async scheduleParcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }

      if (!req.user.flatId) {
        res.status(400).json({ error: 'NO_FLAT', message: 'No flat assigned to your account.' });
        return;
      }

      const validated = scheduleParcelSchema.parse(req.body);

      const stamp = await parcelsService.scheduleParcel({
        parcelId: req.params.id,
        societyId: req.user.societyId,
        userId: req.user.id,
        userFlatId: req.user.flatId,
        mode: validated.mode,
        slotStart: validated.slotStart,
        slotEnd: validated.slotEnd,
      });

      res.status(200).json({
        success: true,
        message: `Parcel scheduled for ${validated.mode === 'PICKUP' ? 'counter pickup' : 'door delivery'}. Your 4-digit code is ready.`,
        data: stamp,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /parcels/upload-photo (Uploads base64 or photo to storage)
   */
  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { image, filename } = req.body;
      if (!image) {
        res.status(400).json({ error: 'NO_IMAGE', message: 'No image data provided' });
        return;
      }

      const photoUrl = await storageService.uploadPhoto(image, filename || 'parcel.jpg');
      res.status(200).json({
        success: true,
        photoUrl,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const parcelsController = new ParcelsController();
