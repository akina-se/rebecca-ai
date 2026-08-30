import { Client } from '@xdevplatform/xdk';
import config from '../../src/config';

jest.mock('../../src/config', () => ({
    __esModule: true,
    default: {
        xApi: {
            appKey: 'test-app-key',
            appSecret: 'test-app-secret',
            accessToken: 'test-access',
            accessSecret: 'test-secret',
            myUserId: 'test-my-user-id'
        }
    }
}));

jest.mock('@xdevplatform/xdk', () => {
    return {
        OAuth1: class {
            async buildRequestHeader() {
                return 'mocked_auth_header';
            }
        },
        Client: jest.fn().mockImplementation(() => {
            return {
                posts: {
                    create: jest.fn(),
                    getById: jest.fn()
                },
                users: {
                    getById: jest.fn(),
                    getMe: jest.fn(),
                    getMentions: jest.fn()
                }
            };
        })
    };
});

describe('xApi.ts', () => {
    let mockClientInstance: any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Since xApi.ts initializes client on load based on config, and config is loaded,
        // we can access the mocked methods by getting the mock instance.
        // We will mock the returned client.
        const ClientMock = Client as jest.Mock;
        mockClientInstance = {
            posts: {
                create: jest.fn(),
                getById: jest.fn()
            },
            users: {
                getById: jest.fn(),
                getMe: jest.fn(),
                getMentions: jest.fn()
            }
        };
        ClientMock.mockImplementation(() => mockClientInstance);
        
        // Unfortunately, xApi module creates the client exactly once upon import.
        // To properly inject our mocked methods per test, we can reset the mock functions inside the cached instance.
        // Actually, we can just spy on the methods, but since we re-imported after mocking, let's just force the internal client.
        // A cleaner way in TS/Jest is to use jest.requireActual or require for isolation.
    });

    // We use a dynamic require to ensure a fresh module instance with our configured mocks
    const getXApiModule = () => {
        let api: any;
        jest.isolateModules(() => {
            api = require('../../src/services/xApi');
        });
        return api;
    };

    describe('replyToMention', () => {
        it('should reply successfully (normal case)', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'new_tweet_id' } });
            
            const result = await api.replyToMention('12345', 'Hello');
            expect(result).toEqual({ data: { id: 'new_tweet_id' } });
            expect(mockClientInstance.posts.create).toHaveBeenCalledWith({
                text: 'Hello',
                reply: { in_reply_to_tweet_id: '12345' }
            });
        });

        it('should throw on error (abnormal case)', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.create.mockRejectedValueOnce(new Error('Network error'));
            
            await expect(api.replyToMention('123', 'Hi')).rejects.toThrow('Network error');
        });
    });

    describe('getTweetDetails', () => {
        it('should return tweet details', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.getById.mockResolvedValueOnce({ data: { text: 'test' } });
            const result = await api.getTweetDetails('123');
            expect(result).toEqual({ data: { text: 'test' } });
        });

        it('should throw on error', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.getById.mockRejectedValueOnce(new Error('error'));
            await expect(api.getTweetDetails('123')).rejects.toThrow('error');
        });
    });

    describe('tweet', () => {
        it('should post tweet successfully', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.create.mockResolvedValueOnce({ data: { id: 'new' } });
            const result = await api.tweet('Test post');
            expect(result).toEqual({ data: { id: 'new' } });
        });

        it('should throw on error', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.create.mockRejectedValueOnce(new Error('error'));
            await expect(api.tweet('test')).rejects.toThrow('error');
        });
    });

    describe('getUserProfile', () => {
        it('should return user profile', async () => {
            const api = getXApiModule();
            mockClientInstance.users.getById.mockResolvedValueOnce({ data: { description: 'bio' } });
            const result = await api.getUserProfile('user1');
            expect(result).toEqual({ data: { description: 'bio' } });
        });

        it('should throw on error', async () => {
            const api = getXApiModule();
            mockClientInstance.users.getById.mockRejectedValueOnce(new Error('error'));
            await expect(api.getUserProfile('user1')).rejects.toThrow('error');
        });
    });

    describe('getMentions', () => {
        it('should return mentions for numeric user id', async () => {
            // Setup config
            const originalUserId = config.xApi.myUserId;
            config.xApi.myUserId = '999999'; // numeric

            const api = getXApiModule();
            mockClientInstance.users.getMentions.mockResolvedValueOnce({ data: [{ id: 'tweet1' }], meta: { resultCount: 1 } });
            
            const result = await api.getMentions('last_id');
            expect(result).toEqual({ data: [{ id: 'tweet1' }], meta: { resultCount: 1 } });
            expect(mockClientInstance.users.getMentions).toHaveBeenCalledWith('999999', expect.objectContaining({ since_id: 'last_id' }));

            // Restore config
            config.xApi.myUserId = originalUserId;
        });

        it('should resolve non-numeric user id using getMe()', async () => {
            const originalUserId = config.xApi.myUserId;
            config.xApi.myUserId = 'screen_name'; // non-numeric

            const api = getXApiModule();
            mockClientInstance.users.getMe.mockResolvedValueOnce({ data: { id: '123456' } });
            mockClientInstance.users.getMentions.mockResolvedValueOnce({ data: [], meta: { resultCount: 0 } });
            
            await api.getMentions();
            expect(mockClientInstance.users.getMe).toHaveBeenCalledTimes(1);
            expect(mockClientInstance.users.getMentions).toHaveBeenCalledWith('123456', expect.any(Object));

            // Restore config
            config.xApi.myUserId = originalUserId;
        });

        it('should return empty if X_MY_USER_ID is not set', async () => {
            const originalUserId = config.xApi.myUserId;
            config.xApi.myUserId = ''; 

            const api = getXApiModule();
            const result = await api.getMentions();
            expect(result).toEqual({ data: [], meta: { resultCount: 0 } });

            // Restore config
            config.xApi.myUserId = originalUserId;
        });

        it('should throw on error', async () => {
            const originalUserId = config.xApi.myUserId;
            config.xApi.myUserId = '999999'; 

            const api = getXApiModule();
            mockClientInstance.users.getMentions.mockRejectedValueOnce(new Error('Network error'));
            
            await expect(api.getMentions()).rejects.toThrow('Network error');

            config.xApi.myUserId = originalUserId;
        });
    });

    describe('Missing Credentials Fallback (!client)', () => {
        it('should return safe empty responses for passive operations when client is not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; // trigger !client condition
            const api = getXApiModule();

            expect(await api.replyToMention('123', 'Hi')).toEqual({ data: { id: 'mock_tweet_id', text: 'Hi' } });
            expect(await api.tweet('Test')).toEqual({ data: { id: 'mock_tweet_id', text: 'Test' } });
            expect(await api.getTweetDetails('123')).toEqual({ });
            expect(await api.getMentions()).toEqual({ data: [], meta: { resultCount: 0 } });

            config.xApi.appKey = originalAppKey;
        });

        it('should throw when getUserProfile is called without an initialized client', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; // trigger !client condition
            const api = getXApiModule();

            await expect(api.getUserProfile('user1')).rejects.toThrow('X API client is not initialized');

            config.xApi.appKey = originalAppKey;
        });
    });

    describe('uploadMedia', () => {
        it('should return mock_media_id when client not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; // trigger !client condition
            const api = getXApiModule();
            const result = await api.uploadMedia(Buffer.from('test'), 'image/jpeg');
            expect(result).toBe('mock_media_id');
            config.xApi.appKey = originalAppKey;
        });

        it('should throw error when fetch fails', async () => {
            const api = getXApiModule();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockRejectedValue(new Error('fetch error'));
            await expect(api.uploadMedia(Buffer.from('test'), 'image/jpeg')).rejects.toThrow('fetch error');
            global.fetch = originalFetch;
        });
    });

    describe('getFollowers', () => {
        it('should return followers successfully with default pageSize', async () => {
            const api = getXApiModule();
            if (!mockClientInstance.users.getFollowers) mockClientInstance.users.getFollowers = jest.fn();
            mockClientInstance.users.getFollowers.mockResolvedValueOnce({ data: [{ id: 'user1' }], meta: { resultCount: 1 } });
            const result = await api.getFollowers('123');
            expect(result.data).toEqual([{ id: 'user1' }]);
            expect(mockClientInstance.users.getFollowers).toHaveBeenCalledWith('123', expect.objectContaining({ max_results: 10 }));
        });

        it('should pass paginationToken and custom pageSize if provided', async () => {
            const api = getXApiModule();
            if (!mockClientInstance.users.getFollowers) mockClientInstance.users.getFollowers = jest.fn();
            mockClientInstance.users.getFollowers.mockResolvedValueOnce({ data: [{ id: 'user2' }], meta: { resultCount: 1 } });
            const result = await api.getFollowers('123', 'token_123', 25);
            expect(result.data).toEqual([{ id: 'user2' }]);
            expect(mockClientInstance.users.getFollowers).toHaveBeenCalledWith('123', expect.objectContaining({
                max_results: 25,
                pagination_token: 'token_123'
            }));
        });

        it('should return empty if client not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; 
            const api = getXApiModule();
            const result = await api.getFollowers('123');
            expect(result.data).toEqual([]);
            config.xApi.appKey = originalAppKey;
        });

        it('should throw on error', async () => {
            const api = getXApiModule();
            if (!mockClientInstance.users.getFollowers) mockClientInstance.users.getFollowers = jest.fn();
            mockClientInstance.users.getFollowers.mockRejectedValueOnce(new Error('err'));
            await expect(api.getFollowers('123')).rejects.toThrow('err');
        });
    });

    describe('addListMember', () => {
        it('should add member successfully', async () => {
            const api = getXApiModule();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: true });
            const result = await api.addListMember('list1', 'user1');
            expect(result).toBe(true);
            global.fetch = originalFetch;
        });

        it('should throw error if fetch not ok', async () => {
            const api = getXApiModule();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'failed' }) });
            await expect(api.addListMember('list1', 'user1')).rejects.toThrow(/Failed to add list member/);
            global.fetch = originalFetch;
        });
        
        it('should return false if oauth client not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; 
            const api = getXApiModule();
            const result = await api.addListMember('list1', 'user1');
            expect(result).toBe(false);
            config.xApi.appKey = originalAppKey;
        });
    });

    describe('getListMembers', () => {
        it('should get members successfully', async () => {
            const api = getXApiModule();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: [{ id: 'u1' }] }) });
            const result = await api.getListMembers('list1');
            expect(result.data).toEqual([{ id: 'u1' }]);
            global.fetch = originalFetch;
        });

        it('should return empty if client not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; 
            const api = getXApiModule();
            const result = await api.getListMembers('list1');
            expect(result.data).toEqual([]);
            config.xApi.appKey = originalAppKey;
        });

        it('should throw error if fetch not ok', async () => {
            const api = getXApiModule();
            const originalFetch = global.fetch;
            global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ error: 'failed' }) });
            await expect(api.getListMembers('list1')).rejects.toThrow(/Failed to get list members/);
            global.fetch = originalFetch;
        });
    });

    describe('getUserTweets', () => {
        it('should return user tweets successfully', async () => {
            const api = getXApiModule();
            if (!mockClientInstance.users.getPosts) mockClientInstance.users.getPosts = jest.fn();
            mockClientInstance.users.getPosts.mockResolvedValueOnce({ data: [{ id: 'tweet1', text: 'Hello' }], includes: { media: [] } });
            
            const result = await api.getUserTweets('123', 5);
            expect(result.data).toEqual([{ id: 'tweet1', text: 'Hello' }]);
        });

        it('should return empty if client not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; 
            const api = getXApiModule();
            const result = await api.getUserTweets('123', 5);
            expect(result.data).toEqual([]);
            config.xApi.appKey = originalAppKey;
        });

        it('should throw error on API failure', async () => {
            const api = getXApiModule();
            if (!mockClientInstance.users.getPosts) mockClientInstance.users.getPosts = jest.fn();
            mockClientInstance.users.getPosts.mockRejectedValueOnce(new Error('api error'));
            await expect(api.getUserTweets('123')).rejects.toThrow('api error');
        });
    });

    describe('deleteTweet', () => {
        it('should mock tweet deletion if client is not initialized or test ID is detected', async () => {
            const api = getXApiModule();
            const res = await api.deleteTweet('test_tweet_id');
            expect(res).toBe(true);
        });

        it('should call posts.destroy if available', async () => {
            const api = getXApiModule();
            mockClientInstance.posts.destroy = jest.fn().mockResolvedValueOnce({});
            const res = await api.deleteTweet('1234567890');
            expect(res).toBe(true);
            expect(mockClientInstance.posts.destroy).toHaveBeenCalledWith('1234567890');
        });

        it('should call posts.delete if destroy is not available', async () => {
            const api = getXApiModule();
            delete mockClientInstance.posts.destroy;
            mockClientInstance.posts.delete = jest.fn().mockResolvedValueOnce({});
            const res = await api.deleteTweet('1234567890');
            expect(res).toBe(true);
            expect(mockClientInstance.posts.delete).toHaveBeenCalledWith('1234567890');
        });

        it('should fallback to direct OAuth fetch when neither method exists on posts', async () => {
            const api = getXApiModule();
            delete mockClientInstance.posts.destroy;
            delete mockClientInstance.posts.delete;

            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: true,
                json: async () => ({ data: { deleted: true } }),
            }) as any;

            const res = await api.deleteTweet('1234567890');
            expect(res).toBe(true);
        });

        it('should throw on fetch error when deleting tweet', async () => {
            const api = getXApiModule();
            delete mockClientInstance.posts.destroy;
            delete mockClientInstance.posts.delete;

            global.fetch = jest.fn().mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Not authorized' }),
            }) as any;

            await expect(api.deleteTweet('1234567890')).rejects.toThrow('Failed to delete tweet');
        });
    });
});
