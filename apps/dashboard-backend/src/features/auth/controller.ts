import { Request, Response } from 'express';

export class AuthController {
  public getMe(req: Request, res: Response): void {
    // IAP normally injects 'x-goog-authenticated-user-email' header
    // e.g., 'accounts.google.com:admin@example.com'
    const iapEmailHeader = req.headers['x-goog-authenticated-user-email'] as string | undefined;
    
    // For local development fallback, we mock an email if the header is missing
    let email = 'admin@example.com'; 
    if (iapEmailHeader) {
      // Typically formatted as: accounts.google.com:email@example.com
      const parts = iapEmailHeader.split(':');
      email = parts.length > 1 ? parts[1] : iapEmailHeader;
    }

    res.status(200).json({
      email,
      // The frontend will likely derive initials or fetch Gravatar from this email
    });
  }
}
