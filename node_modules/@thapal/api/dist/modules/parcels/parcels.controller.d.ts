import { Request, Response, NextFunction } from 'express';
export declare class ParcelsController {
    /**
     * POST /parcels (Guard logs parcel)
     */
    createParcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /parcels (Scoped by role & society)
     */
    getParcels(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * GET /parcels/:id
     */
    getParcelById(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /parcels/:id/handover (Guard submits 4-digit code)
     */
    completeHandover(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /parcels/:id/schedule (Resident schedules pickup or door delivery)
     */
    scheduleParcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    /**
     * POST /parcels/upload-photo (Uploads base64 or photo to storage)
     */
    uploadPhoto(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const parcelsController: ParcelsController;
//# sourceMappingURL=parcels.controller.d.ts.map