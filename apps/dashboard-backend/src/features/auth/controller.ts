import { Response } from 'express';
import { AuthenticatedRequest } from '../../types/auth';

/**
 * Controller for handling authentication-related requests.
 */
export class AuthController {
  /**
   * Retrieves the currently authenticated user's details from the verified Firebase Auth token.
   * 
   * @param req - The AuthenticatedRequest containing verified token payload.
   * @param res - The Express Response object.
   */
  public getMe(req: AuthenticatedRequest, res: Response): void {
    if (!req.user || !req.user.email) {
      res.status(401).json({ error: 'Unauthorized: User authentication context missing' });
      return;
    }

    res.status(200).json({
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role || 'ADMIN',
    });
  }
}
