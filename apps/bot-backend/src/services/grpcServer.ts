import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { deleteTweet } from './xApi';

const PROTO_PATH = path.resolve(__dirname, '../../../../packages/grpc-schemas/tweets.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

interface TweetDeleteRequest {
  tweet_id: string;
}

interface TweetDeleteResponse {
  success: boolean;
  message: string;
}

interface ProtoGrpcType {
  tweets: {
    TweetService: {
      service: grpc.ServiceDefinition<grpc.UntypedServiceImplementation>;
    };
  };
}

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const tweetsPackage = protoDescriptor.tweets;

export function startGrpcServer(): grpc.Server {
  const server = new grpc.Server();
  
  server.addService(tweetsPackage.TweetService.service, {
    deleteTweet: async (
      call: grpc.ServerUnaryCall<TweetDeleteRequest, TweetDeleteResponse>,
      callback: grpc.sendUnaryData<TweetDeleteResponse>
    ) => {
      const tweetId = call.request.tweet_id;
      console.log(`gRPC server received delete request for tweet: ${tweetId}`);
      try {
        await deleteTweet(tweetId);
        callback(null, { success: true, message: 'Tweet successfully deleted' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`gRPC error deleting tweet ${tweetId}:`, err);
        callback(null, { success: false, message });
      }
    }
  });
  
  const port = '0.0.0.0:50051';
  server.bindAsync(port, grpc.ServerCredentials.createInsecure(), (err, portNumber) => {
    if (err) {
      console.error('Failed to bind gRPC server:', err);
      return;
    }
    console.log(`gRPC server running at ${port} (bound to port ${portNumber})`);
  });
  
  return server;
}

