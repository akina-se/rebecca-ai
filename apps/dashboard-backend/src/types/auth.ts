import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';

/**
 * Strongly-typed payload attached to Express Request by auth middleware.
 */
export interface AuthenticatedUser extends Partial<DecodedIdToken> {
  uid: string;
  role?: 'ADMIN';
  email?: string;
  admin?: boolean;
}

/**
 * Express Request augmented with strongly-typed authenticated user information.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
