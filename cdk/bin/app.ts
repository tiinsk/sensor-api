#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack.js';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

//DynamoDB Stack (4 tables)
const dynamoDBStack = new DynamoDBStack(app, 'SensorApiDynamoDBStack', {
  env,
  description: 'DynamoDB tables for Sensor API',
});

// Stack to be added:
// - ApiStack

app.synth();
