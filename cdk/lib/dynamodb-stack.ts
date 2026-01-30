import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { tableSchemas } from '../../src/config/table-schemas.js';
import { toCdkTableProps, toCdkGsiProps } from '../../src/config/table-mappers.js';

export class DynamoDBStack extends cdk.Stack {
  public readonly devicesTable: dynamodb.Table;
  public readonly readingsTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly authTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Devices Table
    const devicesProps = toCdkTableProps(tableSchemas.devices);
    this.devicesTable = new dynamodb.Table(this, 'DevicesTable', {
      ...devicesProps,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep table if stack is deleted
    });

    // Add GSI for devices
    const devicesGsis = toCdkGsiProps(tableSchemas.devices);
    devicesGsis.forEach((gsi) => {
      this.devicesTable.addGlobalSecondaryIndex(gsi);
    });

    // Readings Table
    const readingsProps = toCdkTableProps(tableSchemas.readings);
    this.readingsTable = new dynamodb.Table(this, 'ReadingsTable', {
      ...readingsProps,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Users Table
    const usersProps = toCdkTableProps(tableSchemas.users);
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      ...usersProps,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Auth/API Keys Table
    const authProps = toCdkTableProps(tableSchemas.auth);
    this.authTable = new dynamodb.Table(this, 'AuthTable', {
      ...authProps,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
