/**
 * User data access layer
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';

const docClient = createDynamoDBClient();
const TABLE_NAME = process.env.USERS_TABLE || 'SensorApi-Users';

export interface User {
  username: string;
  passwordHash: string;
  salt: string;
  disabled: boolean;
}

/**
 * Get a user by username
 */
export async function getUser(username: string): Promise<User | null> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { username },
      })
    );

    return result.Item ? (result.Item as User) : null;
  } catch (error) {
    console.error(`Failed to get user ${username}:`, error);
    throw error;
  }
}

/**
 * Create a new user
 */
export async function createUser(user: User): Promise<User> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: user,
        ConditionExpression: 'attribute_not_exists(username)', // Prevent overwriting
      })
    );

    return user;
  } catch (error) {
    console.error(`Failed to create user ${user.username}:`, error);
    throw error;
  }
}

/**
 * Validate user credentials
 * Returns the user if valid, null if invalid
 */
export async function validateUserCredentials(
  username: string,
  passwordHash: string
): Promise<User | null> {
  const user = await getUser(username);

  if (!user || user.disabled || user.passwordHash !== passwordHash) {
    return null;
  }

  return user;
}
