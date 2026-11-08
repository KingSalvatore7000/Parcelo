import { Request, Response, NextFunction } from 'express';
import { loginSchema, changePasswordSchema } from '@parcelo/shared';
import { z } from 'zod';
import { authService } from './auth.service';

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, password } = loginSchema.parse(req.body);
      const result = await authService.login(phone, password);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(req.user!.id, currentPassword, newPassword);
      res.status(200).json({ success: true, data: result });
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
