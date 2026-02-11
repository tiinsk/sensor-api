/**
 * Mapper functions to convert shared table schemas to different formats
 */

import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';
import type { TableSchema } from './table-schemas';

/**
 * Convert shared schema to CDK Table props
 */
export function toCdkTableProps(schema: TableSchema): {
  partitionKey: dynamodb.Attribute;
  sortKey?: dynamodb.Attribute;
  tableName: string;
} {
  const attributeTypeMap: Record<string, dynamodb.AttributeType> = {
    S: dynamodb.AttributeType.STRING,
    N: dynamodb.AttributeType.NUMBER,
    B: dynamodb.AttributeType.BINARY,
  };

  return {
    tableName: schema.tableName,
    partitionKey: {
      name: schema.partitionKey.name,
      type: attributeTypeMap[schema.partitionKey.type],
    },
    sortKey: schema.sortKey
      ? {
          name: schema.sortKey.name,
          type: attributeTypeMap[schema.sortKey.type],
        }
      : undefined,
  };
}

/**
 * Convert shared schema to CDK GSI props
 */
export function toCdkGsiProps(schema: TableSchema): dynamodb.GlobalSecondaryIndexProps[] {
  if (!schema.globalSecondaryIndexes) return [];

  const attributeTypeMap: Record<string, dynamodb.AttributeType> = {
    S: dynamodb.AttributeType.STRING,
    N: dynamodb.AttributeType.NUMBER,
    B: dynamodb.AttributeType.BINARY,
  };

  return schema.globalSecondaryIndexes.map((gsi) => ({
    indexName: gsi.indexName,
    partitionKey: {
      name: gsi.partitionKey.name,
      type: attributeTypeMap[gsi.partitionKey.type],
    },
    sortKey: gsi.sortKey
      ? {
          name: gsi.sortKey.name,
          type: attributeTypeMap[gsi.sortKey.type],
        }
      : undefined,
    projectionType: dynamodb.ProjectionType.ALL,
  }));
}

/**
 * Convert shared schema to AWS SDK CreateTable input
 */
export function toCreateTableInput(schema: TableSchema): CreateTableCommandInput {
  const keySchema: Array<{ AttributeName: string; KeyType: 'HASH' | 'RANGE' }> = [
    { AttributeName: schema.partitionKey.name, KeyType: 'HASH' },
  ];

  if (schema.sortKey) {
    keySchema.push({ AttributeName: schema.sortKey.name, KeyType: 'RANGE' });
  }

  const attributeDefinitions = schema.attributes.map((attr) => ({
    AttributeName: attr.name,
    AttributeType: attr.type,
  }));

  const input: CreateTableCommandInput = {
    TableName: schema.tableName,
    KeySchema: keySchema,
    AttributeDefinitions: attributeDefinitions,
    BillingMode: 'PAY_PER_REQUEST',
  };

  // Add Global Secondary Indexes if present
  if (schema.globalSecondaryIndexes && schema.globalSecondaryIndexes.length > 0) {
    input.GlobalSecondaryIndexes = schema.globalSecondaryIndexes.map((gsi) => {
      const gsiKeySchema: Array<{ AttributeName: string; KeyType: 'HASH' | 'RANGE' }> = [
        { AttributeName: gsi.partitionKey.name, KeyType: 'HASH' },
      ];

      if (gsi.sortKey) {
        gsiKeySchema.push({ AttributeName: gsi.sortKey.name, KeyType: 'RANGE' });
      }

      return {
        IndexName: gsi.indexName,
        KeySchema: gsiKeySchema,
        Projection: { ProjectionType: 'ALL' },
      };
    });
  }

  return input;
}
