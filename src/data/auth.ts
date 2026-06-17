/**
 * Auth (API Keys) data access layer
 */

import { GetCommand, PutCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { TABLES } from '../config/constants';
import { ApiKey } from '../types';

const docClient = createDynamoDBClient();

/**
 * Get an API key record
 */
export async function getApiKey(apiKey: string): Promise<ApiKey | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.AUTH,
        Key: { apiKey },
      })
    );

    return result.Item ? (result.Item as ApiKey) : null;
  } catch (error) {
    console.error(`Failed to get API key:`, error);
    throw error;
  }
}

/**
 * Create a new API key
 */
export async function createApiKey(apiKey: ApiKey): Promise<ApiKey> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUTH,
        Item: apiKey,
        ConditionExpression: 'attribute_not_exists(apiKey)', // Prevent overwriting
      })
    );

    return apiKey;
  } catch (error) {
    console.error(`Failed to create API key:`, error);
    throw error;
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(apiKey: string): Promise<void> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.AUTH,
        Key: { apiKey },
      })
    );
  } catch (error) {
    console.error(`Failed to delete API key:`, error);
    throw error;
  }
}

/**
 * Validate an API key
 * Returns the API key record if valid, null if invalid
 */
export async function validateApiKey(apiKey: string): Promise<ApiKey | null> {
  return getApiKey(apiKey);
}
