import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  });

  static getProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = await AuthService.getCurrentUser(req.user!.userId);

    res.status(200).json({
      success: true,
      data: user
    });
  });
}
