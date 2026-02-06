/**
 * DynamoDB client factory
 * Creates clients configured for local or AWS environments
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { env } from './env';

export function createDynamoDBClient(): DynamoDBDocumentClient {
  const isLocal = env.IS_LOCAL === 'true';

  const client = new DynamoDBClient(
    isLocal
      ? {
          endpoint: 'http://localhost:8000',
          region: 'us-east-1',
          credentials: {
            accessKeyId: 'local',
            secretAccessKey: 'local',
          },
        }
      : {
          region: env.AWS_REGION,
        }
  );

  // Use DocumentClient for easier data marshaling
  return DynamoDBDocumentClient.from(client);
}
