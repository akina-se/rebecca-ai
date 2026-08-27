import { beforeUserSignedIn, HttpsError } from 'firebase-functions/v2/identity';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Blocking Function that executes before a user is signed in via Firebase Authentication.
 * 
 * Verifies that the attempting user's email is present in the `admin_users` Firestore collection
 * with status === 'ACTIVE'. If not authorized, it throws an HttpsError to immediately abort
 * the sign-in process, ensuring zero tokens and zero sessions are established for unauthorized accounts.
 */
export const beforeAdminSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
  const email = user?.email?.toLowerCase().trim();

  if (!email) {
    throw new HttpsError(
      'invalid-argument',
      'An authenticated email address is required to access the admin dashboard.'
    );
  }

  const db = getFirestore();
  const adminSnapshot = await db
    .collection('admin_users')
    .where('email', '==', email)
    .where('status', '==', 'ACTIVE')
    .limit(1)
    .get();

  if (adminSnapshot.empty) {
    console.warn(`[Security Alert] Blocked unauthorized sign-in attempt from: ${email}`);
    throw new HttpsError(
      'permission-denied',
      'Access Denied: Your account is not registered as an authorized administrator.'
    );
  }

  const adminDoc = adminSnapshot.docs[0].data();
  const role = adminDoc.role || 'ADMIN';

  // Issue custom claims embedded into the cryptographically signed JWT
  return {
    customClaims: {
      role,
      admin: true,
    },
  };
});
