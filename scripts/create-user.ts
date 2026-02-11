#!/usr/bin/env node
/**
 * Interactive script to create a new user in DynamoDB
 * Usage: npm run create:user
 *
 * Requires AWS credentials to be set via environment variables or AWS CLI profile
 */
import prompts from 'prompts';
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { saltHashPassword } from '../src/lib/password';
import { TABLES } from '../src/config/constants';
import {createDynamoDBClient} from "../src/lib/db-client";

const docClient = createDynamoDBClient();

async function createUser() {
  console.log('');
  console.log('🔐 Create New User');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('This will create a new user in DynamoDB.');
  console.log(`Table: ${TABLES.USERS}`);
  console.log(`Region: ${process.env.AWS_REGION || 'us-east-1'}`);
  console.log('');

  // Prompt for username
  const usernameResponse = await prompts({
    type: 'text',
    name: 'username',
    message: 'Username:',
    validate: (value) => value.length >= 3 ? true : 'Username must be at least 3 characters',
  });

  if (!usernameResponse.username) {
    console.log('\n❌ Cancelled');
    process.exit(0);
  }

  const username = usernameResponse.username;

  // Check if user already exists
  try {
    const existingUser = await docClient.send(
      new GetCommand({
        TableName: TABLES.USERS,
        Key: { username },
      })
    );

    if (existingUser.Item) {
      console.log(`\n❌ Error: User "${username}" already exists`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error checking existing user:', error.message);
    process.exit(1);
  }

  // Prompt for password
  const passwordResponse = await prompts({
    type: 'password',
    name: 'password',
    message: 'Password:',
    validate: (value) => value.length >= 8 ? true : 'Password must be at least 8 characters',
  });

  if (!passwordResponse.password) {
    console.log('\n❌ Cancelled');
    process.exit(0);
  }

  // Confirm password
  const confirmResponse = await prompts({
    type: 'password',
    name: 'confirm',
    message: 'Confirm password:',
    validate: (value) => value === passwordResponse.password ? true : 'Passwords do not match',
  });

  if (!confirmResponse.confirm) {
    console.log('\n❌ Cancelled');
    process.exit(0);
  }

  // Hash password
  console.log('\n⏳ Hashing password...');
  const { passwordHash, salt } = saltHashPassword(passwordResponse.password);

  // Create user
  try {
    console.log('⏳ Creating user...');
    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: {
          username,
          passwordHash,
          salt,
          createdAt: new Date().toISOString(),
          disabled: false,
        },
      })
    );

    console.log('');
    console.log('✅ User created successfully!');
    console.log('');
    console.log(`Username: ${username}`);
    console.log(`Table: ${TABLES.USERS}`);
    console.log('');
    console.log('💡 You can now use these credentials to log in.');
    console.log('');
  } catch (error: any) {
    console.error('\n❌ Error creating user:', error.message);
    process.exit(1);
  }
}

// Run the script
createUser().catch((error) => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
