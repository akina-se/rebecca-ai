import * as grpc from '@grpc/grpc-js';
import { startGrpcServer } from '../../src/services/grpcServer';
import * as xApi from '../../src/services/xApi';

jest.mock('../../src/services/xApi', () => ({
  deleteTweet: jest.fn().mockResolvedValue(true),
}));

describe('gRPC Server Unit Tests', () => {
  let server: any;
  let capturedImplementation: any;
  let capturedBindCallback: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(grpc.Server.prototype, 'addService').mockImplementation((service: any, impl: any) => {
      capturedImplementation = impl;
    });
    jest.spyOn(grpc.Server.prototype, 'bindAsync').mockImplementation((port: string, creds: any, cb: any) => {
      capturedBindCallback = cb;
    });
  });

  afterEach((done) => {
    jest.restoreAllMocks();
    if (server && typeof server.forceShutdown === 'function') {
      server.forceShutdown();
    }
    done();
  });

  it('startGrpcServer should initialize and register TweetService', () => {
    server = startGrpcServer();
    expect(server).toBeDefined();
    expect(capturedImplementation).toBeDefined();
    expect(typeof capturedImplementation.deleteTweet).toBe('function');
  });

  it('deleteTweet handler should successfully delete tweet and call callback', async () => {
    server = startGrpcServer();
    (xApi.deleteTweet as jest.Mock).mockResolvedValueOnce(true);

    const mockCall = { request: { tweet_id: 'tweet_123' } } as any;
    const mockCallback = jest.fn();

    await capturedImplementation.deleteTweet(mockCall, mockCallback);

    expect(xApi.deleteTweet).toHaveBeenCalledWith('tweet_123');
    expect(mockCallback).toHaveBeenCalledWith(null, {
      success: true,
      message: 'Tweet successfully deleted',
    });
  });

  it('deleteTweet handler should handle Error failure and return success: false', async () => {
    server = startGrpcServer();
    (xApi.deleteTweet as jest.Mock).mockRejectedValueOnce(new Error('Rate limit exceeded on X'));

    const mockCall = { request: { tweet_id: 'tweet_err' } } as any;
    const mockCallback = jest.fn();

    await capturedImplementation.deleteTweet(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, {
      success: false,
      message: 'Rate limit exceeded on X',
    });
  });

  it('deleteTweet handler should handle non-Error failure and return Unknown error', async () => {
    server = startGrpcServer();
    (xApi.deleteTweet as jest.Mock).mockRejectedValueOnce('string error');

    const mockCall = { request: { tweet_id: 'tweet_err2' } } as any;
    const mockCallback = jest.fn();

    await capturedImplementation.deleteTweet(mockCall, mockCallback);

    expect(mockCallback).toHaveBeenCalledWith(null, {
      success: false,
      message: 'Unknown error',
    });
  });

  it('bindAsync callback should handle error and success states', () => {
    server = startGrpcServer();
    expect(capturedBindCallback).toBeDefined();

    // Test error branch
    capturedBindCallback(new Error('Port in use'), 0);

    // Test success branch
    capturedBindCallback(null, 50051);
  });
});
