import { initializeApp } from 'firebase-admin/app';

// Initialize the Firebase Admin SDK once for all functions
initializeApp();

// Export all triggers
export * from './triggers/onConversationLogCreated';
