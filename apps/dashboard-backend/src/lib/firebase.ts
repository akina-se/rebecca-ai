import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage, Storage } from 'firebase-admin/storage';
import { config } from '../config';

/**
 * Centralized Firebase Admin SDK provider.
 * Uses config.gcp.projectId as the single source of truth.
 */
export function getFirebaseAdminApp(): App {
  if (getApps().length === 0) {
    return initializeApp({
      projectId: config.gcp.projectId,
    });
  }
  return getApps()[0]!;
}

export const getAdminAuth = (): Auth => getAuth(getFirebaseAdminApp());
export const getAdminFirestore = (): Firestore => getFirestore(getFirebaseAdminApp());
export const getAdminStorage = (): Storage => getStorage(getFirebaseAdminApp());
