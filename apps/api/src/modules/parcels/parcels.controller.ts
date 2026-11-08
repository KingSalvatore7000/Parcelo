import { Request, Response, NextFunction } from 'express';
import { createParcelSchema, handoverVerifySchema, scheduleParcelSchema, ParcelStatus } from '@parcelo/shared';
import { parcelsService } from './parcels.service';
import { storageService, signPhotoUrl } from '../../services/storage.service';

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

      const status = typeof req.query.status === 'string' ? (req.query.status as ParcelStatus) : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || undefined : undefined;
      const cursor = typeof req.query.cursor === 'string' && req.query.cursor ? req.query.cursor : undefined;

      const page = await parcelsService.getParcels({
        societyId: req.user.societyId,
        userRole: req.user.role,
        userId: req.user.id,
        userFlatId: req.user.flatId,
        status,
        search,
        limit,
        cursor,
      });

      res.status(200).json({
        success: true,
        count: page.items.length,
        data: page.items,
        nextCursor: page.nextCursor,
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
        message: `Parcel ${stamp.rescheduled ? 'rescheduled' : 'scheduled'} for ${validated.mode === 'PICKUP' ? 'counter pickup' : 'door delivery'}. Your 4-digit code is ready.`,
        data: stamp,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /parcels/slots (bookable handover slots and fees)
   */
  async getSlots(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ success: true, data: parcelsService.getSlotOptions() });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /parcels/:id/return (Gate returns an uncollected parcel to the courier)
   */
  async returnParcel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
        return;
      }
      const parcel = await parcelsService.returnParcel(req.params.id, req.user.societyId);
      res.status(200).json({ success: true, message: 'Parcel marked as returned to the courier.', data: parcel });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /parcels/upload-photo (Uploads base64 or photo to storage)
   */
  async uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const image = req.body?.image;
      if (!image) {
        res.status(400).json({ error: 'NO_IMAGE', message: 'No image data provided' });
        return;
      }

      const photoUrl = await storageService.uploadPhoto(image);
      res.status(200).json({
        success: true,
        // the path to send back when logging the parcel; a signed link to show it now
        photoUrl,
        previewUrl: signPhotoUrl(photoUrl),
      });
    } catch (err) {
      next(err);
    }
  }
}

export const parcelsController = new ParcelsController();
