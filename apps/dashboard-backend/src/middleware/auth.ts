import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Only once across the application)
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Middleware to verify Firebase Authentication JWT tokens.
 * Protects dashboard endpoints from unauthorized access.
 * 
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express Next function
 * @returns A promise that resolves when the verification process is complete.
 */
export const verifyAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  // Bypass auth for local development if running in emulator and NO_AUTH=true is set
  // Caution: Be extremely careful not to deploy this bypass to production!
  if (process.env.NODE_ENV !== 'production' && process.env.NO_AUTH === 'true') {
    req.user = { uid: 'local-dev-admin' };
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    // Attach decoded token to request for downstream use
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Firebase Auth Verification Error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
