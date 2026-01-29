import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DynamoDBStack extends cdk.Stack {
  public readonly devicesTable: dynamodb.Table;
  public readonly readingsTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly authTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Devices Table
    this.devicesTable = new dynamodb.Table(this, 'DevicesTable', {
      tableName: 'SensorApi-Devices',
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep table if stack is deleted
    });

    // GSI for listing devices by order
    this.devicesTable.addGlobalSecondaryIndex({
      indexName: 'type-order-index',
      partitionKey: {
        name: 'type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'order',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Readings Table
    this.readingsTable = new dynamodb.Table(this, 'ReadingsTable', {
      tableName: 'SensorApi-Readings',
      partitionKey: {
        name: 'device_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING, // ISO timestamp string
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep table if stack is deleted
    });

    // Users Table
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'SensorApi-Users',
      partitionKey: {
        name: 'username',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep table if stack is deleted
    });

    // Auth/API Keys Table
    this.authTable = new dynamodb.Table(this, 'AuthTable', {
      tableName: 'SensorApi-Auth',
      partitionKey: {
        name: 'api_key',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep table if stack is deleted
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'DevicesTableName', {
      value: this.devicesTable.tableName,
      description: 'Devices table name',
      exportName: 'SensorApi-DevicesTableName',
    });

    new cdk.CfnOutput(this, 'ReadingsTableName', {
      value: this.readingsTable.tableName,
      description: 'Readings table name',
      exportName: 'SensorApi-ReadingsTableName',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users table name',
      exportName: 'SensorApi-UsersTableName',
    });

    new cdk.CfnOutput(this, 'AuthTableName', {
      value: this.authTable.tableName,
      description: 'Auth table name',
      exportName: 'SensorApi-AuthTableName',
    });
  }
}
