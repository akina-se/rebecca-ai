let authBlockingHandler: any;
let firestoreTriggerHandler: any;

class MockHttpsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'HttpsError';
  }
}

jest.mock('firebase-functions/v2/identity', () => ({
  beforeUserSignedIn: jest.fn().mockImplementation((handler) => {
    authBlockingHandler = handler;
    return { run: handler };
  }),
  HttpsError: MockHttpsError,
}));

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: jest.fn().mockImplementation((_path, handler) => {
    firestoreTriggerHandler = handler;
    return { run: handler };
  }),
}));

const mockBatchSet = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue({ id: 'mock-doc-id' });
const mockWhere = jest.fn().mockReturnThis();
const mockLimit = jest.fn().mockReturnThis();
const mockGet = jest.fn();
const mockCollection = jest.fn().mockReturnValue({
  where: mockWhere,
  limit: mockLimit,
  get: mockGet,
  doc: mockDoc,
});

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn().mockReturnValue({
      collection: mockCollection,
      batch: jest.fn().mockReturnValue({
        set: mockBatchSet,
        commit: mockBatchCommit,
      }),
    }),
    {
      FieldValue: {
        increment: jest.fn().mockImplementation((n) => ({ increment: n })),
        arrayUnion: jest.fn().mockImplementation((val) => ({ arrayUnion: val })),
      },
    }
  ),
}));

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn().mockImplementation((n) => ({ increment: n })),
    arrayUnion: jest.fn().mockImplementation((val) => ({ arrayUnion: val })),
  },
}));

import '../../src/triggers/authBlocking';
import '../../src/triggers/onConversationLogCreated';

describe('Firebase Cloud Functions Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authBlocking: beforeAdminSignIn', () => {
    it('should throw invalid-argument when email is missing', async () => {
      const event = { data: { email: '' } };
      let thrown: any = null;
      try {
        await authBlockingHandler(event);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.code).toBe('invalid-argument');
      expect(thrown.message).toContain('An authenticated email address is required');
    });

    it('should throw permission-denied when user is not found in admin_users or not ACTIVE', async () => {
      mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
      const event = { data: { email: 'unauthorized@example.com' } };

      let thrown: any = null;
      try {
        await authBlockingHandler(event);
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeDefined();
      expect(thrown.code).toBe('permission-denied');
      expect(thrown.message).toContain('Access Denied');
      expect(mockCollection).toHaveBeenCalledWith('admin_users');
      expect(mockWhere).toHaveBeenCalledWith('email', '==', 'unauthorized@example.com');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'ACTIVE');
    });

    it('should return customClaims for authorized active administrator with role from doc', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({ role: 'SUPER_ADMIN', status: 'ACTIVE' }),
          },
        ],
      });

      const event = { data: { email: 'admin@rebecca-ai.net' } };
      const result = await authBlockingHandler(event);

      expect(result).toEqual({
        customClaims: {
          role: 'SUPER_ADMIN',
          admin: true,
        },
      });
    });

    it('should return customClaims with ADMIN fallback if role is undefined in doc', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            data: () => ({ status: 'ACTIVE' }),
          },
        ],
      });

      const event = { data: { email: 'admin2@rebecca-ai.net' } };
      const result = await authBlockingHandler(event);

      expect(result).toEqual({
        customClaims: {
          role: 'ADMIN',
          admin: true,
        },
      });
    });
  });

  describe('analytics: onConversationLogCreated', () => {
    it('should return early when snapshot has no data', async () => {
      const event = { data: null };
      await firestoreTriggerHandler(event);
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('should return early when log has no userId', async () => {
      const event = {
        data: {
          data: () => ({ userText: 'hello' }), // no userId
        },
      };
      await firestoreTriggerHandler(event);
      expect(mockBatchCommit).not.toHaveBeenCalled();
    });

    it('should aggregate user stats and DAU metrics on new conversation log with timestamp', async () => {
      const event = {
        data: {
          data: () => ({
            userId: 'user_123',
            userText: 'hello rebecca',
            aiText: 'hello babe',
            timestamp: '2026-08-15T14:30:00.000Z',
          }),
        },
      };

      await firestoreTriggerHandler(event);

      expect(mockDoc).toHaveBeenCalledWith('user_123');
      expect(mockDoc).toHaveBeenCalledWith('dau_2026-08-15');
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });

    it('should aggregate stats using current date when timestamp is missing', async () => {
      const event = {
        data: {
          data: () => ({
            userId: 'user_456',
            userText: 'hello rebecca',
            aiText: 'hello babe',
          }),
        },
      };

      await firestoreTriggerHandler(event);

      expect(mockDoc).toHaveBeenCalledWith('user_456');
      expect(mockBatchSet).toHaveBeenCalledTimes(2);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
    });
  });
});
