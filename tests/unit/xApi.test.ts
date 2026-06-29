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
        OAuth1: jest.fn(),
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
        it('should return mock responses when client is not initialized', async () => {
            const originalAppKey = config.xApi.appKey;
            config.xApi.appKey = ''; // trigger !client condition
            const api = getXApiModule();
            
            expect(await api.replyToMention('123', 'Hi')).toEqual({ data: { id: 'mock_tweet_id' } });
            expect(await api.tweet('Test')).toEqual({ data: { id: 'mock_tweet_id' } });
            expect(await api.getTweetDetails('123')).toEqual({ data: null });
            expect(await api.getUserProfile('user1')).toEqual({ data: { description: 'ダミーのプロフィール文です。仕事に疲れています。' } });
            expect(await api.getMentions()).toEqual({ data: [], meta: { resultCount: 0 } });
            
            config.xApi.appKey = originalAppKey;
        });
    });
});
