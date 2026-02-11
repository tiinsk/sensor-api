/**
 * Shared table schema definitions
 * Single source of truth for both CDK and local DynamoDB setup
 */

import {TABLES} from './constants';

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
    tableName: TABLES.DEVICES,
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
    tableName: TABLES.READINGS,
    partitionKey: { name: 'deviceId', type: 'S' },
    sortKey: { name: 'timestamp', type: 'S' },
    attributes: [
      { name: 'deviceId', type: 'S' },
      { name: 'timestamp', type: 'S' },
    ],
  },

  users: {
    tableName: TABLES.USERS,
    partitionKey: { name: 'username', type: 'S' },
    attributes: [{ name: 'username', type: 'S' }],
  },

  auth: {
    tableName: TABLES.AUTH,
    partitionKey: { name: 'apiKey', type: 'S' },
    attributes: [{ name: 'apiKey', type: 'S' }],
  },
} as const satisfies Record<string, TableSchema>;

export type TableName = keyof typeof tableSchemas;
