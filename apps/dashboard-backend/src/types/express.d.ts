import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Strongly-typed payload attached to Express Request by auth middleware.
 */
export interface AuthenticatedUser extends Partial<DecodedIdToken> {
  uid: string;
  role?: 'SUPER_ADMIN' | 'ADMIN' | string;
  email?: string;
  admin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
