/**
 * DynamoDB client factory
 * Creates clients configured for local or AWS environments
 */

import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {env} from './env';

export function createDynamoDBClient(): DynamoDBDocumentClient {
  const useLocalDb = env.USE_LOCAL_DB === 'true';
  
  let endpoint = 'http://localhost:8000'; // When running locally (scripts), use localhost
  if (process.env.AWS_EXECUTION_ENV) {
    // Running in Lambda runtime (including SAM Local)
    // Use the container name from docker-compose
    endpoint = 'http://sensor-api-dynamodb:8000';
  }

  const client = new DynamoDBClient({
    region: env.AWS_REGION,
    ...(useLocalDb && {
      endpoint,
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    }),
  });

  // Use DocumentClient for easier data marshaling
  return DynamoDBDocumentClient.from(client);
}
