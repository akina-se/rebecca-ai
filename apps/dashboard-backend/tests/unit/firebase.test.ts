import { getFirebaseAdminApp, getAdminAuth, getAdminFirestore, getAdminStorage } from '../../src/lib/firebase';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { config } from '../../src/config';

jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn().mockReturnValue({ name: '[DEFAULT]' }),
  getApps: jest.fn().mockReturnValue([]),
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn().mockReturnValue({ verifyIdToken: jest.fn() }),
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({ collection: jest.fn() }),
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn().mockReturnValue({ bucket: jest.fn() }),
}));

describe('Firebase Admin Singleton Provider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize app when getApps is empty', () => {
    (getApps as unknown as jest.Mock).mockReturnValue([]);
    const app = getFirebaseAdminApp();
    expect(initializeApp).toHaveBeenCalledWith({
      projectId: config.gcp.projectId,
    });
    expect(app).toBeDefined();
  });

  it('should return existing app when getApps is not empty', () => {
    const mockApp = { name: 'existing-app' };
    (getApps as unknown as jest.Mock).mockReturnValue([mockApp]);
    const app = getFirebaseAdminApp();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(app).toBe(mockApp);
  });

  it('should provide admin auth instance', () => {
    const auth = getAdminAuth();
    expect(getAuth).toHaveBeenCalled();
    expect(auth).toBeDefined();
  });

  it('should provide admin firestore instance', () => {
    const firestore = getAdminFirestore();
    expect(getFirestore).toHaveBeenCalled();
    expect(firestore).toBeDefined();
  });

  it('should provide admin storage instance', () => {
    const storage = getAdminStorage();
    expect(getStorage).toHaveBeenCalled();
    expect(storage).toBeDefined();
  });
});
