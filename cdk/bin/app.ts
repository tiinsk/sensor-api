#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

// Get JWT secret from context or environment variable (REQUIRED)
const jwtSecret = 
  app.node.tryGetContext('jwtSecret') || 
  process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error('\n❌ ERROR: JWT_SECRET is required for deployment!');
  console.error('\nProvide it in one of these ways:');
  console.error('  1. Export as environment variable:');
  console.error('     export JWT_SECRET="your-secure-secret-key"');
  console.error('     npm run cdk:deploy');
  console.error('\n  2. Pass as CDK context:');
  console.error('     npm run cdk:deploy -- --context jwtSecret="your-secure-secret-key"');
  console.error('\n💡 Tip: Generate a secure secret with: openssl rand -base64 32\n');
  process.exit(1);
}

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// DynamoDB Stack (4 tables)
const dynamoDBStack = new DynamoDBStack(app, 'SensorApiDynamoDBStack', {
  env,
  description: 'DynamoDB tables for Sensor API',
});

// API Stack (Lambda + API Gateway)
const apiStack = new ApiStack(app, 'SensorApiStack', {
  env,
  dynamoDBStack,
  jwtSecret,
  description: 'Sensor API Lambda function and API Gateway',
});

// Ensure API stack depends on DynamoDB stack
apiStack.addDependency(dynamoDBStack);

app.synth();
