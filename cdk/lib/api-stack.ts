/**
 * API Stack - Lambda Function + API Gateway HTTP API
 *
 * Used only for production deploy to AWS.
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { DynamoDBStack } from './dynamodb-stack';

interface ApiStackProps extends cdk.StackProps {
  dynamoDBStack: DynamoDBStack;
  /** Secrets Manager secret name for JWT (e.g. sensor-api/jwt-secret)*/
  jwtSecretName: string;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly lambdaFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { dynamoDBStack, jwtSecretName } = props;

    const jwtSecretRef = secretsmanager.Secret.fromSecretNameV2(this, 'JwtSecret', jwtSecretName);

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      retention: logs.RetentionDays.ONE_WEEK,
    });

    this.lambdaFunction = new lambda.Function(this, 'SensorApiFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../dist/src'), // Compiled TypeScript output
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        JWT_SECRET_ARN: jwtSecretRef.secretArn,
        NODE_ENV: 'production',
        USE_LOCAL_DB: 'false', // Always use AWS DynamoDB in deployed environment
      },
      logGroup,
      description: 'Sensor API Lambda function with lambda-api routing',
    });

    jwtSecretRef.grantRead(this.lambdaFunction);

    // Grant Lambda permissions to access DynamoDB tables
    dynamoDBStack.devicesTable.grantReadWriteData(this.lambdaFunction);
    dynamoDBStack.readingsTable.grantReadWriteData(this.lambdaFunction);
    dynamoDBStack.usersTable.grantReadData(this.lambdaFunction);
    dynamoDBStack.authTable.grantReadData(this.lambdaFunction);

    // Create HTTP API Gateway
    const httpApi = new apigatewayv2.HttpApi(this, 'SensorApiGateway', {
      apiName: 'sensor-api',
      description: 'Sensor data API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Create Lambda integration
    const lambdaIntegration = new HttpLambdaIntegration(
      'SensorApiLambdaIntegration',
      this.lambdaFunction
    );

    // Add catch-all route to proxy everything to Lambda
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.POST,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
      ],
      integration: lambdaIntegration,
    });

    // Add root route
    httpApi.addRoutes({
      path: '/',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // Store API URL for output
    this.apiUrl = httpApi.url!;

    // Output the API URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'HTTP API Gateway URL',
      exportName: 'SensorApiUrl',
    });

    // Output the Lambda function name
    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: this.lambdaFunction.functionName,
      description: 'Lambda function name',
    });

    // Output table names for reference
    new cdk.CfnOutput(this, 'DevicesTableName', {
      value: dynamoDBStack.devicesTable.tableName,
      description: 'Devices DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'ReadingsTableName', {
      value: dynamoDBStack.readingsTable.tableName,
      description: 'Readings DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'AuthTableName', {
      value: dynamoDBStack.authTable.tableName,
      description: 'Auth DynamoDB table name',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: dynamoDBStack.usersTable.tableName,
      description: 'Users DynamoDB table name',
    });
  }
}
