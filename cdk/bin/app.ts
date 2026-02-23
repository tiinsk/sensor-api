#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

// Production deploy: JWT comes from Secrets Manager only. Secret name is passed via --context (see package.json cdk:deploy script).
const jwtSecretName = app.node.tryGetContext('jwtSecretName');
if (!jwtSecretName) {
  console.error('\n❌ ERROR: jwtSecretName is required.\n');
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
  jwtSecretName,
  description: 'Sensor API Lambda function and API Gateway',
});

// Ensure API stack depends on DynamoDB stack
apiStack.addDependency(dynamoDBStack);

app.synth();
