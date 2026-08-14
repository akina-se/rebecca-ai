import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.resolve(__dirname, '../../../../packages/grpc-schemas/tweets.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

interface TweetServiceClient extends grpc.Client {
  deleteTweet(
    request: { tweet_id: string },
    callback: (error: grpc.ServiceError | null, response: { success: boolean; message: string }) => void
  ): void;
}

interface ProtoGrpcType {
  tweets: {
    TweetService: new (address: string, credentials: grpc.ChannelCredentials) => TweetServiceClient;
  };
}

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const tweetsPackage = protoDescriptor.tweets;

const botGrpcUrl = process.env.BOT_GRPC_URL || 'localhost:50051';

const client = new tweetsPackage.TweetService(
  botGrpcUrl,
  grpc.credentials.createInsecure()
);

/**
 * Executes a gRPC call to the bot-backend service to delete a specified tweet on the X platform.
 * 
 * @param tweetId - The unique identifier of the tweet to be deleted.
 * @returns A promise that resolves to an object indicating the success status and a descriptive message.
 */
export function deleteTweetViaGrpc(tweetId: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    client.deleteTweet({ tweet_id: tweetId }, (err, response) => {
      if (err) {
        console.error('gRPC client error calling deleteTweet:', err);
        return reject(err);
      }
      resolve(response);
    });
  });
}

