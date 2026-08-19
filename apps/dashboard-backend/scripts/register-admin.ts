/**
 * CLI Script: Manage Admin Users (Register, Update, List, Delete)
 * 
 * Safely provisions and manages administrators in the Firestore `admin_users` collection.
 * 
 * Usage:
 *   # Add or Update Admin
 *   npm run register-admin -- --email=anabuki.motoshi@gmail.com --role=SUPER_ADMIN
 * 
 *   # Update Role or Status
 *   npm run register-admin -- --email=user@example.com --role=OPERATOR --status=REVOKED
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
import { Firestore, FieldValue } from '@google-cloud/firestore';

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER'] as const;
const VALID_STATUSES = ['ACTIVE', 'REVOKED'] as const;

function printUsage() {
  console.log(`
📋 Rebecca Admin Management CLI

Usage:
  npm run register-admin -- [options]

Commands & Options:
  --email=<email>         Target administrator email address (Required for add/update/delete)
  --role=<role>           SUPER_ADMIN | ADMIN | OPERATOR | VIEWER (Default: SUPER_ADMIN)
  --status=<status>       ACTIVE | REVOKED (Default: ACTIVE)
  --action=<action>       add | update | delete | list (Default: add)
  --delete                Shortcut for --action=delete
  --list                  Shortcut for --action=list
  --help                  Show this help message

Examples:
  npm run register-admin -- --email=anabuki.motoshi@gmail.com --role=SUPER_ADMIN
  npm run register-admin -- --email=helper@example.com --role=OPERATOR
  npm run register-admin -- --email=helper@example.com --status=REVOKED
  npm run register-admin -- --email=helper@example.com --delete
  npm run register-admin -- --list
`);
}

async function manageAdmin() {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    console.error('❌ Error: GCP_PROJECT_ID is not defined in .env');
    process.exit(1);
  }

  // Parse command-line flags
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
    process.exit(0);
  }

  let action = (flags['action'] || 'add').toLowerCase();
  if (flags['delete'] === 'true') action = 'delete';
  if (flags['list'] === 'true') action = 'list';

  console.log(`🔌 Connecting to Firestore (Project: ${projectId})...`);
  const firestore = new Firestore({ projectId });
  const collectionRef = firestore.collection('admin_users');

  // ACTION: LIST
  if (action === 'list') {
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
    return;
  }

  // Common validation for email-targeted actions
  const email = (flags['email'] || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    printUsage();
    process.exit(1);
  }

  const querySnapshot = await collectionRef.where('email', '==', email).limit(1).get();

  // ACTION: DELETE
  if (action === 'delete') {
    if (querySnapshot.empty) {
      console.warn(`⚠️  No admin user found with email "${email}". Nothing deleted.`);
      return;
    }
    const docRef = querySnapshot.docs[0].ref;
    await docRef.delete();
    console.log(`🗑️  Successfully deleted admin user: ${email} (Doc ID: ${docRef.id})`);
    return;
  }

  // ACTION: ADD / UPDATE
  const role = (flags['role'] || process.env.ADMIN_ROLE || 'SUPER_ADMIN').toUpperCase().trim();
  const status = (flags['status'] || 'ACTIVE').toUpperCase().trim();

  if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
    console.error(`❌ Error: Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }

  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    console.error(`❌ Error: Invalid status "${status}". Valid statuses: ${VALID_STATUSES.join(', ')}`);
    process.exit(1);
  }

  if (!querySnapshot.empty) {
    const docRef = querySnapshot.docs[0].ref;
    await docRef.update({
      role,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`✅ Successfully updated existing admin user:`);
    console.log(`   - Email:  ${email}`);
    console.log(`   - Role:   ${role}`);
    console.log(`   - Status: ${status}`);
    console.log(`   - Doc ID: ${docRef.id}`);
  } else {
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
    console.log(`🎉 Successfully registered new admin user:`);
    console.log(`   - ID:     ${newDocRef.id}`);
    console.log(`   - Email:  ${email}`);
    console.log(`   - Role:   ${role}`);
    console.log(`   - Status: ${status}`);
  }
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
