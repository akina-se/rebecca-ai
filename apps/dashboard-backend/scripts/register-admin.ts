/**
 * CLI Script: Manage Admin Users (Register, Update, List, Delete)
 * 
 * Safely provisions and manages administrators in the Firestore `admin_users` collection
 * and synchronizes custom claims and token revocation in Firebase Authentication.
 * 
 * Usage:
 *   # Add or Update Admin
 *   npm run register-admin -- --email=admin@example.com --role=ADMIN
 * 
 *   # Update Status (Revoke Access)
 *   npm run register-admin -- --email=user@example.com --status=REVOKED
 * 
 *   # Delete Admin
 *   npm run register-admin -- --email=user@example.com --action=delete
 *   npm run register-admin -- --email=user@example.com --delete
 * 
 *   # List All Admins
 *   npm run register-admin -- --action=list
 *   npm run register-admin -- --list
 */
import 'dotenv/config';
import { Firestore, FieldValue, CollectionReference, QuerySnapshot } from '@google-cloud/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const VALID_ROLES = ['ADMIN'] as const;
type AdminRole = typeof VALID_ROLES[number];

const VALID_STATUSES = ['ACTIVE', 'REVOKED'] as const;
type AdminStatus = typeof VALID_STATUSES[number];

function printUsage(): void {
  console.log(`
📋 Rebecca Admin Management CLI

Usage:
  npm run register-admin -- [options]

Commands & Options:
  --email=<email>         Target administrator email address (Required for add/update/delete)
  --role=<role>           ADMIN (Default: ADMIN)
  --status=<status>       ACTIVE | REVOKED (Default: ACTIVE)
  --action=<action>       add | update | delete | list (Default: add)
  --delete                Shortcut for --action=delete
  --list                  Shortcut for --action=list
  --help                  Show this help message

Examples:
  npm run register-admin -- --email=admin@example.com --role=ADMIN
  npm run register-admin -- --email=helper@example.com --status=REVOKED
  npm run register-admin -- --email=helper@example.com --delete
  npm run register-admin -- --list
`);
}

/**
 * Synchronizes custom claims and revokes refresh tokens in Firebase Auth when an admin's status changes.
 */
async function syncFirebaseAuthState(email: string, role: AdminRole | null, status: AdminStatus | 'DELETED'): Promise<void> {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUserByEmail(email);
    if (status === 'ACTIVE' && role === 'ADMIN') {
      await auth.setCustomUserClaims(userRecord.uid, { role: 'ADMIN', admin: true });
      console.log(`🔐 Synchronized Firebase Auth custom claims (role: ADMIN) for UID: ${userRecord.uid}`);
    } else {
      await auth.setCustomUserClaims(userRecord.uid, null);
      await auth.revokeRefreshTokens(userRecord.uid);
      console.log(`🔒 Cleared custom claims and revoked refresh tokens in Firebase Auth for UID: ${userRecord.uid}`);
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/user-not-found') {
      console.log(`ℹ️  No Firebase Auth user record yet for "${email}" (claims will be applied on first sign-in).`);
      return;
    }
    console.warn(`⚠️  Could not synchronize Firebase Auth state for "${email}":`, (err as Error).message || err);
  }
}

/**
 * Lists all registered administrators in a formatted table.
 */
async function handleList(collectionRef: CollectionReference): Promise<void> {
  const snapshot = await collectionRef.orderBy('createdAt', 'desc').get();
  if (snapshot.empty) {
    console.log('ℹ️  No administrators found in `admin_users` collection.');
    return;
  }

  console.log(`\n📋 Registered Administrators (${snapshot.size} total):`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`| ${'Email'.padEnd(35)} | ${'Role'.padEnd(12)} | ${'Status'.padEnd(8)} | ${'ID'.padEnd(20)} |`);
  console.log('--------------------------------------------------------------------------------');
  snapshot.forEach((doc) => {
    const data = doc.data();
    const email = (data.email || '').padEnd(35);
    const role = (data.role || 'ADMIN').padEnd(12);
    const status = (data.status || 'ACTIVE').padEnd(8);
    const id = doc.id.padEnd(20);
    console.log(`| ${email} | ${role} | ${status} | ${id} |`);
  });
  console.log('--------------------------------------------------------------------------------\n');
}

/**
 * Deletes an existing administrator document and revokes their Firebase Auth session.
 */
async function handleDelete(querySnapshot: QuerySnapshot, email: string): Promise<void> {
  if (querySnapshot.empty) {
    console.warn(`⚠️  No admin user found with email "${email}". Nothing deleted.`);
    return;
  }
  const docRef = querySnapshot.docs[0].ref;
  await docRef.delete();
  await syncFirebaseAuthState(email, null, 'DELETED');
  console.log(`🗑️  Successfully deleted admin user: ${email} (Doc ID: ${docRef.id})`);
}

/**
 * Upserts (creates or updates) an administrator record and synchronizes Firebase Auth state.
 */
async function handleUpsert(
  querySnapshot: QuerySnapshot,
  collectionRef: CollectionReference,
  email: string,
  role: AdminRole,
  status: AdminStatus
): Promise<void> {
  if (!querySnapshot.empty) {
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      role,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await syncFirebaseAuthState(email, role, status);
    console.log(`✅ Successfully updated existing admin user:`);
    console.log(`   - Email:  ${email}`);
    console.log(`   - Role:   ${role}`);
    console.log(`   - Status: ${status}`);
    console.log(`   - Doc ID: ${docRef.id}`);
    return;
  }

  const newDocRef = collectionRef.doc();
  await newDocRef.set({
    id: newDocRef.id,
    email,
    role,
    status,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: 'CLI_SETUP',
  });
  await syncFirebaseAuthState(email, role, status);
  console.log(`🎉 Successfully registered new admin user:`);
  console.log(`   - ID:     ${newDocRef.id}`);
  console.log(`   - Email:  ${email}`);
  console.log(`   - Role:   ${role}`);
  console.log(`   - Status: ${status}`);
}

/**
 * Main command dispatcher.
 */
async function manageAdmin(): Promise<void> {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error('❌ Error: GCP_PROJECT_ID is not defined in .env');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const flags: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0]?.trim();
      const val = parts.length > 1 ? parts.slice(1).join('=').trim() : 'true';
      if (key) {
        flags[key] = val;
      }
    }
  }

  if (flags['help']) {
    printUsage();
    return;
  }

  let action = (flags['action'] || 'add').toLowerCase();
  if (flags['delete'] === 'true') action = 'delete';
  if (flags['list'] === 'true') action = 'list';

  console.log(`🔌 Connecting to Firestore (Project: ${projectId})...`);
  if (!getApps().length) {
    initializeApp({ projectId });
  }
  const firestore = new Firestore({ projectId });
  const collectionRef = firestore.collection('admin_users');

  if (action === 'list') {
    await handleList(collectionRef);
    return;
  }

  const email = (flags['email'] || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    printUsage();
    process.exit(1);
  }

  const querySnapshot = await collectionRef.where('email', '==', email).limit(1).get();

  if (action === 'delete') {
    await handleDelete(querySnapshot, email);
    return;
  }

  const role = (flags['role'] || process.env.ADMIN_ROLE || 'ADMIN').toUpperCase().trim() as AdminRole;
  const status = (flags['status'] || 'ACTIVE').toUpperCase().trim() as AdminStatus;

  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Error: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!VALID_STATUSES.includes(status)) {
    console.error(`❌ Error: Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }

  await handleUpsert(querySnapshot, collectionRef, email, role, status);
}

manageAdmin()
  .then(() => {
    console.log('🏁 Admin management operation completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Failed admin operation:', err);
    process.exit(1);
  });
