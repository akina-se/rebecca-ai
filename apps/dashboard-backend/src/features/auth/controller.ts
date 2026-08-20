import { Request, Response } from 'express';

/**
 * Controller for handling authentication-related requests.
 */
export class AuthController {
  /**
   * Retrieves the currently authenticated user's details.
   * 
   * Parses the Identity-Aware Proxy (IAP) headers to determine the user's email.
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   */
  public getMe(req: Request, res: Response): void {
    const iapEmailHeader = req.headers['x-goog-authenticated-user-email'] as string | undefined;
    
    let email = 'admin@example.com'; 
    if (iapEmailHeader) {
      const parts = iapEmailHeader.split(':');
      email = parts.length > 1 ? parts[1] : iapEmailHeader;
    }

    res.status(200).json({
      email,
    });
  }
}
