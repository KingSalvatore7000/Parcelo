import { Request, Response, NextFunction } from 'express';
import { requestOtpSchema, verifyOtpSchema } from '@parcelo/shared';
import { z } from 'zod';
import { authService } from './auth.service';

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export class AuthController {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = requestOtpSchema.parse(req.body);
      const result = await authService.requestOtp(validated.phone);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = verifyOtpSchema.parse(req.body);
      const result = await authService.verifyOtp(validated.phone, validated.otp);
      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await authService.refresh(refreshToken);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
      await authService.logout(refreshToken);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Not authenticated' });
        return;
      }
      const user = await authService.getProfile(req.user.id);
      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
