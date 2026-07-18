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

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const tweetsPackage = protoDescriptor.tweets;

const botGrpcUrl = process.env.BOT_GRPC_URL || 'localhost:50051';

const client = new tweetsPackage.TweetService(
  botGrpcUrl,
  grpc.credentials.createInsecure()
);

/**
 * Call the bot-backend gRPC server to delete a tweet by its ID.
 * 
 * @param tweetId The ID of the tweet on X.
 */
export function deleteTweetViaGrpc(tweetId: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve, reject) => {
    client.deleteTweet({ tweet_id: tweetId }, (err: any, response: any) => {
      if (err) {
        console.error('gRPC client error calling deleteTweet:', err);
        return reject(err);
      }
      resolve(response);
    });
  });
}
