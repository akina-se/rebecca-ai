import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Only once across the application)
if (!admin.apps.length) {
  admin.initializeApp();
}

// In-memory cache for admin authorization status (5-minute TTL)
interface CachedAdmin {
  role: string;
  status: string;
  cachedAt: number;
}
const adminCache = new Map<string, CachedAdmin>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Middleware that verifies Firebase Authentication JWT tokens and enforces Role-Based Access Control (RBAC).
 * 
 * Ensures that dashboard endpoints are protected from unauthorized access by:
 * 1. Validating the Bearer token signature with Firebase Admin SDK.
 * 2. Verifying custom claims (`role === 'SUPER_ADMIN'` or `role === 'ADMIN'`).
 * 3. Falling back to the `admin_users` Firestore collection with in-memory TTL caching for Defense-in-Depth.
 * 
 * @param req - The Express Request object.
 * @param res - The Express Response object.
 * @param next - The Express NextFunction callback to pass control to the next middleware.
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
    req.user = { uid: 'local-dev-admin', role: 'SUPER_ADMIN' };
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
    const email = decodedToken.email?.toLowerCase().trim();

    // 1. Check custom claims if present
    if (decodedToken.role === 'SUPER_ADMIN' || decodedToken.role === 'ADMIN' || decodedToken.admin === true) {
      req.user = decodedToken;
      next();
      return;
    }

    // 2. Defense-in-Depth: Check admin_users collection with in-memory TTL cache
    if (email) {
      const now = Date.now();
      const cached = adminCache.get(email);
      if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
        if (cached.status === 'ACTIVE') {
          req.user = { ...decodedToken, role: cached.role };
          next();
          return;
        } else {
          res.status(403).json({ error: 'Forbidden: Your admin access has been revoked.' });
          return;
        }
      }

      const db = admin.firestore();
      const snapshot = await db
        .collection('admin_users')
        .where('email', '==', email)
        .where('status', '==', 'ACTIVE')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const role = docData.role || 'ADMIN';
        adminCache.set(email, { role, status: 'ACTIVE', cachedAt: now });
        req.user = { ...decodedToken, role };
        next();
        return;
      }
    }

    console.warn(`[Security Alert] Access denied for user: ${email || decodedToken.uid}`);
    res.status(403).json({ error: 'Forbidden: Access denied. You do not have administrative privileges.' });
  } catch (error) {
    console.error('Firebase Auth Verification Error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

