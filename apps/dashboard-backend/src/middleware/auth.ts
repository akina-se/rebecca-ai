import { Response, NextFunction } from 'express';
import { COLLECTIONS } from '@rebecca/db/schema';
import type { AdminRole } from '@rebecca/types';
import { AuthenticatedRequest, AuthenticatedUser } from '../types/auth';
import { getAdminAuth, getAdminFirestore } from '../lib/firebase';
import { logger } from '../utils/logger';

export { AuthenticatedRequest, AuthenticatedUser };

/**
 * Resolves the administrator authorization and role directly from the Firestore `admin_users` collection
 * (Single Source of Truth) without in-memory caching to guarantee immediate revocation and role enforcement.
 */
async function resolveAdminAuthorization(email: string): Promise<{
  authorized: boolean;
  role?: AdminRole;
  revoked?: boolean;
  insufficientRole?: boolean;
}> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTIONS.ADMIN_USERS)
    .where('email', '==', email)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return { authorized: false };
  }

  const data = snapshot.docs[0].data();
  if (data.status === 'REVOKED' || data.status !== 'ACTIVE') {
    return { authorized: false, revoked: true };
  }

  if (data.role !== 'ADMIN') {
    return { authorized: false, insufficientRole: true };
  }

  return { authorized: true, role: 'ADMIN' };
}

/**
 * Middleware that verifies Firebase Authentication JWT tokens and enforces Role-Based Access Control (RBAC).
 *
 * Ensures that dashboard endpoints are protected from unauthorized access by:
 * 1. Validating the Bearer token signature and revocation state (`checkRevoked = true`) with Firebase Admin SDK.
 * 2. Verifying against the `admin_users` Firestore collection (Single Source of Truth) on every request
 *    that the account exists, has `status === 'ACTIVE'`, and holds `role === 'ADMIN'`.
 *
 * @param req - The Express Request object.
 * @param res - The Express Response object.
 * @param next - The Express NextFunction callback to pass control to the next middleware.
 * @returns A promise that resolves when the verification process is complete.
 */
export const verifyAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Allow OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  // Bypass auth for local development ONLY if running against local emulator AND NO_AUTH=true is explicitly set
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NO_AUTH === 'true' &&
    Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST)
  ) {
    req.user = { uid: 'local-dev-admin', role: 'ADMIN' };
    next();
    return;
  }

  let token: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1]?.trim();
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }
  try {
    // Pass checkRevoked = true so tokens from revoked sessions are immediately rejected
    const decodedToken = await getAdminAuth().verifyIdToken(token, true);
    const email = decodedToken.email?.toLowerCase().trim();

    if (email) {
      const { authorized, role, revoked, insufficientRole } = await resolveAdminAuthorization(email);
      if (revoked) {
        logger.warn('[Security Alert] Revoked admin attempted access', { uid: decodedToken.uid });
        res.status(403).json({ error: 'Forbidden: Your admin access has been revoked.' });
        return;
      }
      if (insufficientRole) {
        logger.warn('[Security Alert] Insufficient role privileges for user', { uid: decodedToken.uid });
        res.status(403).json({ error: 'Forbidden: Insufficient role privileges.' });
        return;
      }
      if (authorized && role === 'ADMIN') {
        req.user = { ...decodedToken, role };
        next();
        return;
      }
    }

    logger.warn('[Security Alert] Access denied for user', { uid: decodedToken.uid });
    res.status(403).json({ error: 'Forbidden: Access denied. You do not have administrative privileges.' });
  } catch (error) {
    logger.error('Firebase Auth Verification Error', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
