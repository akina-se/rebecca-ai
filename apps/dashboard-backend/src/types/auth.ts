import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';

/**
 * Strongly-typed payload attached to Express Request by auth middleware.
 */
export interface AuthenticatedUser extends Partial<DecodedIdToken> {
  uid: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | string;
  email?: string;
  admin?: boolean;
}

/**
 * Express Request augmented with strongly-typed authenticated user information.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
