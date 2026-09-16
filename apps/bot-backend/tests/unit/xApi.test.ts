import { XApiService, XApiServiceConfig } from '../../src/services/xApi';

describe('XApiService Unit Tests', () => {
    let mockClientInstance: any;
    let mockOAuth1Instance: any;
    let defaultConfig: XApiServiceConfig;

    beforeEach(() => {
        jest.clearAllMocks();
        defaultConfig = {
            appKey: 'test-app-key',
            appSecret: 'test-app-secret',
            accessToken: 'test-access',
            accessSecret: 'test-secret',
            myUserId: 'test-my-user-id',
            followersPageSize: 10,
        };

        mockClientInstance = {
            posts: {
                create: jest.fn(),
                getById: jest.fn(),
                destroy: jest.fn(),
            },
            users: {
                getById: jest.fn(),
                getMe: jest.fn(),
                getMentions: jest.fn(),
                getFollowers: jest.fn(),
                getPosts: jest.fn().mockResolvedValue({ data: [], includes: { media: [] } }),
            },
        };

        mockOAuth1Instance = {
            buildRequestHeader: jest.fn().mockResolvedValue('mocked_auth_header'),
        };
    });

    const createService = (configOverride?: Partial<XApiServiceConfig>, client = mockClientInstance, oauth1 = mockOAuth1Instance) => {
        return new XApiService({ ...defaultConfig, ...configOverride }, client, oauth1);
    };

    describe('replyToMention', () => {
        it('should reply successfully (normal case)', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'new_tweet_id' } });

            const result = await api.replyToMention('12345', 'Hello');
            expect(result).toEqual({ data: { id: 'new_tweet_id' } });
            expect(mockClientInstance.posts.create).toHaveBeenCalledWith({
                text: 'Hello',
                reply: { inReplyToTweetId: '12345' },
            });
        });

        it('should throw on error (abnormal case)', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockRejectedValueOnce(new Error('Network error'));

            await expect(api.replyToMention('123', 'Hi')).rejects.toThrow('Network error');
        });

        it('should include mediaIds in reply when provided', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'reply_with_media' } });

            await api.replyToMention('123', 'Hi with photo', { mediaIds: ['m1', 'm2'] });
            expect(mockClientInstance.posts.create).toHaveBeenCalledWith({
                text: 'Hi with photo',
                reply: { inReplyToTweetId: '123' },
                media: { media_ids: ['m1', 'm2'] },
            });
        });
    });

    describe('getTweetDetails', () => {
        it('should return tweet details', async () => {
            const api = createService();
            mockClientInstance.posts.getById.mockResolvedValueOnce({ data: { text: 'test' } });
            const result = await api.getTweetDetails('123');
            expect(result).toEqual({ data: { text: 'test' } });
        });

        it('should throw on error', async () => {
            const api = createService();
            mockClientInstance.posts.getById.mockRejectedValueOnce(new Error('error'));
            await expect(api.getTweetDetails('123')).rejects.toThrow('error');
        });
    });

    describe('tweet', () => {
        it('should post tweet successfully', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'new' } });
            const result = await api.tweet('Test post');
            expect(result).toEqual({ data: { id: 'new' } });
        });

        it('should throw on error', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockRejectedValueOnce(new Error('error'));
            await expect(api.tweet('test')).rejects.toThrow('error');
        });

        it('should include mediaIds and quote_tweet_id in payload when provided', async () => {
            const api = createService();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'new_with_options' } });
            await api.tweet('Test post', { mediaIds: ['media_1', 'media_2'], quote_tweet_id: 'quote_123' });
            expect(mockClientInstance.posts.create).toHaveBeenCalledWith({
                text: 'Test post',
                media: { media_ids: ['media_1', 'media_2'] },
                quote_tweet_id: 'quote_123',
            });
        });
    });

    describe('getUserProfile', () => {
        it('should return user profile', async () => {
            const api = createService();
            mockClientInstance.users.getById.mockResolvedValueOnce({ data: { description: 'bio' } });
            const result = await api.getUserProfile('user1');
            expect(result).toEqual({ data: { description: 'bio' } });
        });

        it('should throw on error', async () => {
            const api = createService();
            mockClientInstance.users.getById.mockRejectedValueOnce(new Error('error'));
            await expect(api.getUserProfile('user1')).rejects.toThrow('error');
        });
    });

    describe('getMentions', () => {
        it('should return mentions for numeric user id', async () => {
            const api = createService({ myUserId: '999999' });
            mockClientInstance.users.getMentions.mockResolvedValueOnce({ data: [{ id: 'tweet1' }], meta: { resultCount: 1 } });

            const result = await api.getMentions('last_id');
            expect(result).toEqual({ data: [{ id: 'tweet1' }], meta: { resultCount: 1 } });
            expect(mockClientInstance.users.getMentions).toHaveBeenCalledWith('999999', expect.objectContaining({ since_id: 'last_id' }));
        });

        it('should resolve non-numeric user id using getMe()', async () => {
            const api = createService({ myUserId: 'screen_name' });
            mockClientInstance.users.getMe.mockResolvedValueOnce({ data: { id: '123456' } });
            mockClientInstance.users.getMentions.mockResolvedValueOnce({ data: [], meta: { resultCount: 0 } });

            await api.getMentions();
            expect(mockClientInstance.users.getMe).toHaveBeenCalledTimes(1);
            expect(mockClientInstance.users.getMentions).toHaveBeenCalledWith('123456', expect.any(Object));
        });

        it('should return empty if myUserId is not set', async () => {
            const api = createService({ myUserId: '' });
            const result = await api.getMentions();
            expect(result).toEqual({ data: [], meta: { resultCount: 0 } });
        });

        it('should throw on error', async () => {
            const api = createService({ myUserId: '999999' });
            mockClientInstance.users.getMentions.mockRejectedValueOnce(new Error('Network error'));

            await expect(api.getMentions()).rejects.toThrow('Network error');
        });
    });

    describe('Missing Credentials Fallback (!client)', () => {
        it('should return safe empty responses for passive operations when client is not initialized', async () => {
            const api = new XApiService({ appKey: '' });

            expect(await api.replyToMention('123', 'Hi')).toEqual({ data: { id: 'mock_tweet_id', text: 'Hi' } });
            expect(await api.tweet('Test')).toEqual({ data: { id: 'mock_tweet_id', text: 'Test' } });
            expect(await api.getTweetDetails('123')).toEqual({});
            expect(await api.getMentions()).toEqual({ data: [], meta: { resultCount: 0 } });
        });

        it('should throw when getUserProfile is called without an initialized client', async () => {
            const api = new XApiService({ appKey: '' });
            await expect(api.getUserProfile('user1')).rejects.toThrow('X API client is not initialized');
        });
    });

    describe('uploadMedia', () => {
        it('should upload media successfully when API returns 200', async () => {
            const api = createService();
            const originalFetch = global.fetch;
            try {
                global.fetch = jest.fn().mockResolvedValue({
                    ok: true,
                    json: async () => ({ media_id_string: 'media_uploaded_123' }),
                });
                const result = await api.uploadMedia(Buffer.from('test'), 'image/jpeg');
                expect(result).toBe('media_uploaded_123');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should throw error when client not initialized', async () => {
            const api = new XApiService({ appKey: '' });
            await expect(api.uploadMedia(Buffer.from('test'), 'image/jpeg')).rejects.toThrow('Twitter API client not initialized');
        });

        it('should throw error when fetch fails', async () => {
            const api = createService();
            const originalFetch = global.fetch;
            try {
                global.fetch = jest.fn().mockRejectedValue(new Error('fetch error'));
                await expect(api.uploadMedia(Buffer.from('test'), 'image/jpeg')).rejects.toThrow('fetch error');
            } finally {
                global.fetch = originalFetch;
            }
        });
    });

    describe('getFollowers', () => {
        it('should return followers successfully with default pageSize', async () => {
            const api = createService({ followersPageSize: 10 });
            mockClientInstance.users.getFollowers.mockResolvedValueOnce({ data: [{ id: 'user1' }], meta: { resultCount: 1 } });
            const result = await api.getFollowers('123');
            expect(result.data).toEqual([{ id: 'user1' }]);
            expect(mockClientInstance.users.getFollowers).toHaveBeenCalledWith('123', expect.objectContaining({ max_results: 10 }));
        });

        it('should pass paginationToken and custom pageSize if provided', async () => {
            const api = createService();
            mockClientInstance.users.getFollowers.mockResolvedValueOnce({ data: [{ id: 'user2' }], meta: { resultCount: 1 } });
            const result = await api.getFollowers('123', 'token_123', 25);
            expect(result.data).toEqual([{ id: 'user2' }]);
            expect(mockClientInstance.users.getFollowers).toHaveBeenCalledWith('123', expect.objectContaining({
                max_results: 25,
                pagination_token: 'token_123',
            }));
        });

        it('should return empty if client not initialized', async () => {
            const api = new XApiService({ appKey: '' });
            const result = await api.getFollowers('123');
            expect(result.data).toEqual([]);
        });

        it('should throw on error', async () => {
            const api = createService();
            mockClientInstance.users.getFollowers.mockRejectedValueOnce(new Error('err'));
            await expect(api.getFollowers('123')).rejects.toThrow('err');
        });
    });

    describe('addListMember', () => {
        it('should add member successfully', async () => {
            const api = createService();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: true });
            const result = await api.addListMember('list1', 'user1');
            expect(result).toBe(true);
            global.fetch = originalFetch;
        });

        it('should throw error if fetch not ok', async () => {
            const api = createService();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'failed' }) });
            await expect(api.addListMember('list1', 'user1')).rejects.toThrow(/Failed to add list member/);
            global.fetch = originalFetch;
        });

        it('should return false if oauth client not initialized', async () => {
            const api = new XApiService({ appKey: '' });
            const result = await api.addListMember('list1', 'user1');
            expect(result).toBe(false);
        });
    });

    describe('getUserTweets', () => {
        it('should return user tweets successfully', async () => {
            const api = createService();
            mockClientInstance.users.getPosts.mockResolvedValueOnce({
                data: [{ id: 'tweet1', text: 'Hello' }],
                includes: { media: [] },
            });
            const result = await api.getUserTweets('123', 5);
            expect(result.data).toEqual([{ id: 'tweet1', text: 'Hello' }]);
        });

        it('should return empty if client not initialized', async () => {
            const api = new XApiService({ appKey: '' });
            const result = await api.getUserTweets('123', 5);
            expect(result.data).toEqual([]);
        });
    });

    describe('deleteTweet', () => {
        it('should throw Error for non-numeric tweet ID', async () => {
            const api = createService();
            await expect(api.deleteTweet('test_tweet_id')).rejects.toThrow('Invalid tweet ID');
        });

        it('should call posts.destroy if available for a valid numeric tweet ID', async () => {
            const api = createService();
            mockClientInstance.posts.destroy = jest.fn().mockResolvedValueOnce({});
            const res = await api.deleteTweet('9999999999999999999');
            expect(res).toBe(true);
        });

        it('should call posts.delete if destroy is not available but delete is', async () => {
            const api = createService();
            delete mockClientInstance.posts.destroy;
            mockClientInstance.posts.delete = jest.fn().mockResolvedValueOnce({});
            const res = await api.deleteTweet('9999999999999999999');
            expect(res).toBe(true);
        });

        it('should fallback to direct OAuth fetch when neither destroy nor delete exists on posts', async () => {
            const api = createService();
            delete mockClientInstance.posts.destroy;
            delete mockClientInstance.posts.delete;

            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { deleted: true } }),
            }) as any;

            const res = await api.deleteTweet('9999999999999999999');
            expect(res).toBe(true);
        });

        it('should throw error when direct OAuth delete fetch returns non-ok', async () => {
            const api = createService();
            delete mockClientInstance.posts.destroy;
            delete mockClientInstance.posts.delete;

            const originalFetch = global.fetch;
            try {
                global.fetch = jest.fn().mockResolvedValueOnce({
                    ok: false,
                    json: async () => ({ error: 'Forbidden' }),
                });
                await expect(api.deleteTweet('9999999999999999999')).rejects.toThrow('Failed to delete tweet');
            } finally {
                global.fetch = originalFetch;
            }
        });
    });

    describe('Constructor initialization', () => {
        it('should instantiate Client and OAuth1 when appKey is provided without custom client', () => {
            const api = new XApiService({
                appKey: 'key',
                appSecret: 'secret',
                accessToken: 'token',
                accessSecret: 'secret',
            });
            expect(api).toBeDefined();
        });
    });
});
