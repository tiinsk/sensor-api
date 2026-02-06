#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

// Get JWT secret from context or environment variable or use default for development
const jwtSecret = 
  app.node.tryGetContext('jwtSecret') || 
  process.env.JWT_SECRET || 
  'change-this-in-production';

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
