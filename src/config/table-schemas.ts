/**
 * Shared table schema definitions
 * Single source of truth for both CDK and local DynamoDB setup
 */

export interface AttributeDefinition {
  name: string;
  type: 'S' | 'N' | 'B'; // String, Number, Binary
}

export interface KeySchema {
  name: string;
  type: 'HASH' | 'RANGE';
}

export interface GlobalSecondaryIndex {
  indexName: string;
  partitionKey: AttributeDefinition;
  sortKey?: AttributeDefinition;
}

export interface TableSchema {
  tableName: string;
  partitionKey: AttributeDefinition;
  sortKey?: AttributeDefinition;
  attributes: AttributeDefinition[]; // All attributes used in keys/indexes
  globalSecondaryIndexes?: GlobalSecondaryIndex[];
}

export const tableSchemas = {
  devices: {
    tableName: 'SensorApi-Devices',
    partitionKey: { name: 'id', type: 'S' },
    attributes: [
      { name: 'id', type: 'S' },
      { name: 'type', type: 'S' },
      { name: 'order', type: 'N' },
    ],
    globalSecondaryIndexes: [
      {
        indexName: 'type-order-index',
        partitionKey: { name: 'type', type: 'S' },
        sortKey: { name: 'order', type: 'N' },
      },
    ],
  },

  readings: {
    tableName: 'SensorApi-Readings',
    partitionKey: { name: 'device_id', type: 'S' },
    sortKey: { name: 'timestamp', type: 'S' },
    attributes: [
      { name: 'device_id', type: 'S' },
      { name: 'timestamp', type: 'S' },
    ],
  },

  users: {
    tableName: 'SensorApi-Users',
    partitionKey: { name: 'username', type: 'S' },
    attributes: [{ name: 'username', type: 'S' }],
  },

  auth: {
    tableName: 'SensorApi-Auth',
    partitionKey: { name: 'api_key', type: 'S' },
    attributes: [{ name: 'api_key', type: 'S' }],
  },
} as const satisfies Record<string, TableSchema>;

export type TableName = keyof typeof tableSchemas;
