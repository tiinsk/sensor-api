/**
 * User data access layer
 */

import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { TABLES } from '../config/constants';

const docClient = createDynamoDBClient();

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
        TableName: TABLES.USERS,
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
        TableName: TABLES.USERS,
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
