/**
 * @fileoverview Configures and starts the gRPC server for the bot backend.
 * Provides endpoints for inter-service communication, such as deleting processed tweets.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { IXApiService } from '../types';
import { logger } from '../utils/logger';

const PROTO_PATH = path.resolve(__dirname, '../../../../packages/grpc-schemas/tweets.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

/**
 * Request payload for the tweet deletion gRPC endpoint.
 */
interface TweetDeleteRequest {
  /** The unique identifier of the tweet to be deleted. */
  tweet_id: string;
}

/**
 * Response payload for the tweet deletion gRPC endpoint.
 */
interface TweetDeleteResponse {
  /** Indicates whether the deletion operation was successful. */
  success: boolean;
  /** A descriptive message regarding the operation's outcome. */
  message: string;
}

/**
 * Type definition for the loaded gRPC package descriptor.
 */
interface ProtoGrpcType {
  tweets: {
    TweetService: {
      service: grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
    };
  };
}

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const tweetsPackage = protoDescriptor.tweets;

/**
 * Initializes and starts the gRPC server.
 * 
 * Binds the server to the configured port and registers all available services,
 * currently limited to the TweetService for handling tweet deletions.
 * 
 * @param xApiService - Injected IXApiService instance.
 * @returns The initialized and bound gRPC `Server` instance.
 */
export function startGrpcServer(xApiService: IXApiService): grpc.Server {
  const server = new grpc.Server();
  
  server.addService(tweetsPackage.TweetService.service, {
    deleteTweet: async (
      call: grpc.ServerUnaryCall<TweetDeleteRequest, TweetDeleteResponse>,
      callback: grpc.sendUnaryData<TweetDeleteResponse>
    ) => {
      const tweetId = call.request.tweet_id;
      logger.info('gRPC server received delete request for tweet', { tweetId });
      try {
        await xApiService.deleteTweet(tweetId);
        callback(null, { success: true, message: 'Tweet successfully deleted' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error('gRPC error deleting tweet', err, { tweetId });
        callback(null, { success: false, message });
      }
    }
  });
  
  const port = '0.0.0.0:50051';
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, portNumber) => {
    if (err) {
      logger.error('Failed to bind gRPC server', err, { port });
      return;
    }
    logger.info('gRPC server running', { port, portNumber });
  });
  
  return server;
}

