import * as admin from 'firebase-admin';

// Initialize the Firebase Admin SDK once for all functions
admin.initializeApp();

// Export all triggers
export * from './triggers/onConversationLogCreated';
