import { Firestore } from '@google-cloud/firestore';
import * as firestoreService from '../../src/services/firestore';

jest.mock('@google-cloud/firestore', () => {
    const mFirestore = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn(),
        set: jest.fn(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        findNearest: jest.fn().mockReturnThis(),
        batch: jest.fn().mockReturnValue({
            delete: jest.fn(),
            commit: jest.fn()
        }),
        runTransaction: jest.fn(async (callback) => {
            const mTransaction = {
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn()
            };
            return callback(mTransaction);
        })
    };
    return {
        Firestore: jest.fn(() => mFirestore),
        FieldValue: {
            arrayUnion: jest.fn((arg) => ({ _mocked: 'arrayUnion', arg })),
            increment: jest.fn((arg) => ({ _mocked: 'increment', arg })),
            vector: jest.fn((arg) => ({ _mocked: 'vector', arg })),
            serverTimestamp: jest.fn(() => ({ _mocked: 'serverTimestamp' }))
        },
        Timestamp: {
            fromDate: jest.fn((arg) => ({ _mocked: 'fromDate', arg }))
        }
    };
});

describe('firestore.ts', () => {
    let firestoreInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        firestoreInstance = new Firestore();
    });

    describe('Image metadata', () => {
        it('should save image metadata', async () => {
            await firestoreService.saveImageMetadata('hash123', 'gs://test', 'caption test', [0.1, 0.2]);
            expect(firestoreInstance.doc).toHaveBeenCalledWith('hash123');
            expect(firestoreInstance.set).toHaveBeenCalled();
        });

        it('should get image by hash', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ url: 'gs://test', caption: 'test' }) });
            const image = await firestoreService.getImageByHash('hash123');
            expect(image).not.toBeNull();
            expect(image?.url).toBe('gs://test');
        });

        it('should return null if image not found by hash', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            const image = await firestoreService.getImageByHash('hash123');
            expect(image).toBeNull();
        });

        it('should find image by vector', async () => {
            firestoreInstance.get.mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'hash123', data: () => ({ url: 'gs://test', caption: 'test' }) }]
            });
            const image = await firestoreService.findImageByVector([0.1, 0.2]);
            expect(image).not.toBeNull();
            expect(image?.id).toBe('hash123');
        });

        it('should return null if no image matches vector', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ empty: true });
            const image = await firestoreService.findImageByVector([0.1, 0.2]);
            expect(image).toBeNull();
        });

        it('should filter out images within cooldown period', async () => {
            const recentDate = new Date();
            firestoreInstance.get.mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'hash123', data: () => ({ url: 'gs://test', caption: 'test', lastUsedAt: { toDate: () => recentDate } }) }]
            });
            const image = await firestoreService.findImageByVector([0.1, 0.2]);
            expect(image).toBeNull();
        });

        it('should include images past cooldown period', async () => {
            const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
            firestoreInstance.get.mockResolvedValueOnce({
                empty: false,
                docs: [{ id: 'hash123', data: () => ({ url: 'gs://test', caption: 'test', lastUsedAt: { toDate: () => oldDate } }) }]
            });
            const image = await firestoreService.findImageByVector([0.1, 0.2]);
            expect(image).not.toBeNull();
            expect(image?.id).toBe('hash123');
        });

        it('should update image last used', async () => {
            await firestoreService.updateImageLastUsed('hash123');
            expect(firestoreInstance.doc).toHaveBeenCalledWith('hash123');
            expect(firestoreInstance.set).toHaveBeenCalled();
        });
    });

    describe('User Operations', () => {
        it('getUserDoc should return data if exists', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ name: 'Test' }) });
            const result = await firestoreService.getUserDoc('user1');
            expect(result).toEqual({ name: 'Test' });
            expect(firestoreInstance.collection).toHaveBeenCalledWith('users');
            expect(firestoreInstance.doc).toHaveBeenCalledWith('user1');
        });

        it('getUserDoc should return null if not exists', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            const result = await firestoreService.getUserDoc('user2');
            expect(result).toBeNull();
        });

        it('updateUserDoc should set merge true', async () => {
            await firestoreService.updateUserDoc('user1', { episodicBuffer: [] });
            expect(firestoreInstance.set).toHaveBeenCalledWith({ episodicBuffer: [] }, { merge: true });
        });

        it('getAllUsers should return array of users', async () => {
            firestoreInstance.get.mockResolvedValueOnce([
                { id: '1', data: () => ({ name: 'A' }) },
                { id: '2', data: () => ({ name: 'B' }) }
            ]);
            const result = await firestoreService.getAllUsers();
            expect(result).toEqual([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
        });
    });

    describe('Episodic Buffer', () => {
        it('appendEpisodicBuffer should use arrayUnion', async () => {
            await firestoreService.appendEpisodicBuffer('user1', { role: 'user', content: 'test' });
            expect(firestoreInstance.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    episodicBuffer: expect.objectContaining({ _mocked: 'arrayUnion' })
                }),
                { merge: true }
            );
        });

        it('updateCoreProfile should flush episodicBuffer', async () => {
            await firestoreService.updateCoreProfile('user1', { persona: 'cool' });
            expect(firestoreInstance.set).toHaveBeenCalledWith(
                { coreProfile: { persona: 'cool' }, episodicBuffer: [] },
                { merge: true }
            );
        });
    });

    describe('Rate Limits', () => {
        it('incrementGlobalRateLimit should use FieldValue.increment', async () => {
            await firestoreService.incrementGlobalRateLimit('daily', '2024-01-01');
            expect(firestoreInstance.doc).toHaveBeenCalledWith('global_daily_2024-01-01');
            expect(firestoreInstance.set).toHaveBeenCalledWith(
                { count: expect.objectContaining({ _mocked: 'increment', arg: 1 }) },
                { merge: true }
            );
        });

        it('getGlobalRateLimit should return count or 0', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 5 }) });
            const res1 = await firestoreService.getGlobalRateLimit('daily', 'date');
            expect(res1).toBe(5);

            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            const res2 = await firestoreService.getGlobalRateLimit('daily', 'date');
            expect(res2).toBe(0);
        });

        it('incrementUserDailyLimit should use FieldValue.increment', async () => {
            await firestoreService.incrementUserDailyLimit('user1', '2024-01-01');
            expect(firestoreInstance.set).toHaveBeenCalled();
        });

        it('getUserDailyLimit should return count or 0', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 2 }) });
            expect(await firestoreService.getUserDailyLimit('user1', 'date')).toBe(2);
            
            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getUserDailyLimit('user1', 'date')).toBe(0);
        });

        it('incrementUserMinuteLimit should use FieldValue.increment', async () => {
            await firestoreService.incrementUserMinuteLimit('user1', 'time');
            expect(firestoreInstance.set).toHaveBeenCalled();
        });

        it('getUserMinuteLimit should return count or 0', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 3 }) });
            expect(await firestoreService.getUserMinuteLimit('user1', 'time')).toBe(3);
        });

        it('getDailyActiveUsersCount should return count or 1', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 100 }) });
            expect(await firestoreService.getDailyActiveUsersCount('date')).toBe(100);

            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getDailyActiveUsersCount('date')).toBe(1); // Default is 1
        });
    });

    describe('Conversation Logs & Timeline', () => {
        it('saveRawConversationLog should save log with expiration', async () => {
            await firestoreService.saveRawConversationLog('u1', 'hi', 'hello');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'u1',
                userText: 'hi',
                expireAt: expect.objectContaining({ _mocked: 'fromDate' })
            }));
        });

        it('getRecentConversationLogs should return array', async () => {
            firestoreInstance.get.mockResolvedValueOnce([
                { data: () => ({ text: 'log1' }) }
            ]);
            const res = await firestoreService.getRecentConversationLogs(7);
            expect(res).toEqual([{ text: 'log1' }]);
        });

        it('getExtendedPrompt / saveExtendedPrompt', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ extended_prompt: 'prompt' }) });
            expect(await firestoreService.getExtendedPrompt()).toBe('prompt');

            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getExtendedPrompt()).toBe('');

            await firestoreService.saveExtendedPrompt('new');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ extended_prompt: 'new' }), { merge: true });
        });

        it('getTimelineSummary / saveTimelineSummary', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ timeline_summary: 'sum' }) });
            expect(await firestoreService.getTimelineSummary()).toBe('sum');

            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getTimelineSummary()).toBe('');

            await firestoreService.saveTimelineSummary('new');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ timeline_summary: 'new' }), { merge: true });
        });

        it('saveTimelinePost / getRecentTimelinePosts', async () => {
            await firestoreService.saveTimelinePost('test');
            expect(firestoreInstance.set).toHaveBeenCalled();

            firestoreInstance.get.mockResolvedValueOnce([
                { data: () => ({ text: 'post1' }) },
                { data: () => ({ text: 'post2' }) }
            ]);
            const res = await firestoreService.getRecentTimelinePosts(2);
            // It reverses the order
            expect(res).toEqual(['post2', 'post1']);
        });
    });

    describe('RAG Memories', () => {
        it('saveRagMemory should cap max memories (boundary case)', async () => {
            // Mock config internally if needed, default is maxMemories = 100
            // If snapshot.size > 100, it deletes.
            const docs = Array.from({ length: 105 }).map((_, i) => ({ ref: `ref${i}` }));
            firestoreInstance.get.mockResolvedValueOnce({
                size: 105,
                docs
            });

            const batchDelete = jest.fn();
            const batchCommit = jest.fn();
            firestoreInstance.batch.mockReturnValue({ delete: batchDelete, commit: batchCommit });

            await firestoreService.saveRagMemory('u1', 'text', [0.1]);
            
            // Should delete 105 - 100 = 5 docs
            expect(batchDelete).toHaveBeenCalledTimes(5);
            expect(batchCommit).toHaveBeenCalled();
        });

        it('findRagMemories should return array of texts', async () => {
            firestoreInstance.get.mockResolvedValueOnce([
                { data: () => ({ text: 'mem1' }) }
            ]);
            const res = await firestoreService.findRagMemories('u1', [0.1]);
            expect(res).toEqual(['mem1']);
        });

        it('findRagMemories should fail gracefully and return empty array on error (abnormal case)', async () => {
            firestoreInstance.get.mockRejectedValueOnce(new Error('Vector search not supported'));
            const res = await firestoreService.findRagMemories('u1', [0.1]);
            expect(res).toEqual([]); // Fail-safe
        });
    });

    describe('X API State', () => {
        it('getLastMentionId / setLastMentionId', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ last_mention_id: '123' }) });
            expect(await firestoreService.getLastMentionId()).toBe('123');

            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({}) });
            expect(await firestoreService.getLastMentionId()).toBeNull();

            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getLastMentionId()).toBeNull();

            await firestoreService.setLastMentionId('123');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ last_mention_id: '123' }), { merge: true });
        });
    });

    describe('Follower and List Interactions', () => {
        it('hasProcessedFollower should return true if processed', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true });
            expect(await firestoreService.hasProcessedFollower('u1')).toBe(true);
        });

        it('hasProcessedFollower should return false if not processed', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.hasProcessedFollower('u2')).toBe(false);
        });

        it('markFollowerProcessed should set data', async () => {
            await firestoreService.markFollowerProcessed('u3');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u3' }));
        });

        it('getLastListInteraction should return date if exists', async () => {
            const date = new Date();
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({ lastInteractionAt: { toDate: () => date } }) });
            expect(await firestoreService.getLastListInteraction('u4')).toEqual(date);
        });

        it('getLastListInteraction should return null if data lacks lastInteractionAt', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: true, data: () => ({}) });
            expect(await firestoreService.getLastListInteraction('u4_null')).toBeNull();
        });

        it('getLastListInteraction should return null if not exists', async () => {
            firestoreInstance.get.mockResolvedValueOnce({ exists: false });
            expect(await firestoreService.getLastListInteraction('u5')).toBeNull();
        });

        it('updateLastListInteraction should update timestamp', async () => {
            await firestoreService.updateLastListInteraction('u6');
            expect(firestoreInstance.set).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u6' }), { merge: true });
        });
    });

    describe('Image Vector Search Fallbacks', () => {
        it('findImageByVector should return null on error', async () => {
            firestoreInstance.get.mockRejectedValueOnce(new Error('Test error'));
            const res = await firestoreService.findImageByVector([0.1, 0.2]);
            expect(res).toBeNull();
        });
    });

    describe('checkAndConsumeRateLimit', () => {
        it('should allow and consume rate limit if below limits', async () => {
            firestoreInstance.runTransaction.mockImplementation(async (callback: any) => {
                const mTransaction = {
                    get: jest.fn((docRef) => {
                        return { exists: false, data: () => undefined, ref: docRef };
                    }),
                    set: jest.fn(),
                    update: jest.fn()
                };
                return callback(mTransaction);
            });

            const limits = { globalDaily: 10, spamMinute: 2 };
            const result = await firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits);
            
            expect(result.allowed).toBe(true);
        });

        it('should block if user minute spam limit exceeded', async () => {
            firestoreInstance.runTransaction.mockImplementation(async (callback: any) => {
                const mTransaction = {
                    get: jest.fn()
                        .mockResolvedValueOnce({ exists: false, data: () => undefined, ref: {} }) // globalDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ lastMinute: '2023-10-27T10:00', minute: 2 }), ref: {} }) // userDoc
                        .mockResolvedValueOnce({ exists: false, data: () => undefined, ref: {} }), // dauDoc
                    set: jest.fn(),
                    update: jest.fn()
                };
                return callback(mTransaction);
            });

            const limits = { globalDaily: 10, spamMinute: 2 };
            const result = await firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('user_minute_spam');
        });

        it('should block if global daily limit exceeded', async () => {
            firestoreInstance.runTransaction.mockImplementation(async (callback: any) => {
                const mTransaction = {
                    get: jest.fn()
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 15, date: '2023-10-27' }), ref: {} }) // globalDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 1, lastDate: '2023-10-27' }), ref: {} }) // userDoc
                        .mockResolvedValueOnce({ exists: false, data: () => undefined, ref: {} }), // dauDoc
                    set: jest.fn(),
                    update: jest.fn()
                };
                return callback(mTransaction);
            });

            const limits = { globalDaily: 10, spamMinute: 2 };
            const result = await firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('global_daily');
        });

        it('should block if dynamic user daily limit exceeded', async () => {
            firestoreInstance.runTransaction.mockImplementation(async (callback: any) => {
                const mTransaction = {
                    get: jest.fn()
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 50 }), ref: {} }) // globalDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 6, lastDate: '2023-10-27' }), ref: {} }) // userDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ count: 20 }), ref: {} }), // dauDoc
                    set: jest.fn(),
                    update: jest.fn()
                };
                return callback(mTransaction);
            });

            const limits = { globalDaily: 100, spamMinute: 2 }; // active=20, global=100 -> dynamic limit = 5. User has 6.
            const result = await firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits);
            
            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('user_daily');
        });
        
        it('should correctly increment existing data in transaction', async () => {
            let mTransaction: any;
            firestoreInstance.runTransaction.mockImplementation(async (callback: any) => {
                mTransaction = {
                    get: jest.fn()
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 5 }), ref: {} }) // globalDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ daily: 1, lastDate: '2023-10-27', minute: 1, lastMinute: '2023-10-27T10:00' }), ref: {} }) // userDoc
                        .mockResolvedValueOnce({ exists: true, data: () => ({ count: 20 }), ref: {} }), // dauDoc
                    set: jest.fn(),
                    update: jest.fn()
                };
                return callback(mTransaction);
            });

            const limits = { globalDaily: 100, spamMinute: 2 };
            const result = await firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits);
            
            expect(result.allowed).toBe(true);
            expect(mTransaction.set).toHaveBeenCalledTimes(2); // user and global
        });
        
        it('should gracefully handle transaction errors', async () => {
            firestoreInstance.runTransaction.mockRejectedValueOnce(new Error('Transaction Failed'));
            const limits = { globalDaily: 10, spamMinute: 2 };
            await expect(firestoreService.checkAndConsumeRateLimit('u1', '2023-10-27', '2023-10', '2023-10-27T10:00', limits)).rejects.toThrow('Transaction Failed');
        });
    });
});
