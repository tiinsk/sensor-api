#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

// Stacks to be added:
// - DynamoDBStack
// - ApiStack

app.synth();
