#!/usr/bin/env node
/**
 * Interactive script to generate a new API key in DynamoDB
 * Usage: npm run create:api-key
 *
 * Requires AWS credentials to be set via environment variables or AWS CLI profile
 */
import prompts from 'prompts';
import crypto from 'crypto';
import {GetCommand, PutCommand} from '@aws-sdk/lib-dynamodb';
import { TABLES } from '../src/config/constants';
import {createDynamoDBClient} from "../src/lib/db-client";
import {signApiKeyToken} from "../src/lib/jwt";

const docClient = createDynamoDBClient();

/**
 * Generate a cryptographically secure API key
 */
function generateApiKey(): string {
  // Generate 32 random bytes and convert to hex (64 characters)
  return crypto.randomBytes(32).toString('hex');
}

async function createApiKey() {
  console.log('');
  console.log('🔑 Generate New API Key');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('This will generate a new API key in DynamoDB.');
  console.log(`Table: ${TABLES.AUTH}`);
  console.log(`Region: ${process.env.AWS_REGION}`);
  console.log(`Local DB: ${process.env.USE_LOCAL_DB}`);
  console.log('');

  // Prompt for description
  const descriptionResponse = await prompts({
    type: 'text',
    name: 'description',
    message: 'Description (e.g., "Sensor API Key"):',
    validate: (value) => value.length > 0 ? true : 'Description is required',
  });

  if (!descriptionResponse.description) {
    console.log('\n❌ Cancelled');
    process.exit(0);
  }

  const description = descriptionResponse.description;

  // Generate API key
  console.log('\n⏳ Generating secure API key...');
  const apiKey = generateApiKey();

  // Check if API key already exists (very unlikely with crypto.randomBytes)
  try {
    const existingKey = await docClient.send(
      new GetCommand({
        TableName: TABLES.AUTH,
        Key: { apiKey },
      })
    );

    if (existingKey.Item) {
      console.log('\n❌ Error: Generated API key already exists (extremely unlikely!)');
      console.log('Please run the script again to generate a new key.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error checking existing API key:', error.message);
    process.exit(1);
  }

  // Create API key
  try {
    console.log('⏳ Saving API key...');
    await docClient.send(
      new PutCommand({
        TableName: TABLES.AUTH,
        Item: {
          apiKey,
          description,
          createdAt: new Date().toISOString(),
        },
      })
    );

    const jwtToken = signApiKeyToken(apiKey);

    console.log('');
    console.log('✅ API key created successfully!');
    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('🔐 SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log(`API Key: ${apiKey}`);
    console.log(`JWT Token: ${jwtToken}`);
    console.log(`Description: ${description}`);
    console.log('');
    console.log('💡 Use this API key in the Authorization header:');
    console.log(`   Authorization: Bearer ${jwtToken}`);
    console.log('');
  } catch (error: any) {
    console.error('\n❌ Error creating API key:', error.message);
    process.exit(1);
  }
}

// Run the script
createApiKey().catch((error) => {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
});
