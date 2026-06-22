/**
 * One-time setup script for integration tests
 * Creates dedicated test tables and seeds them with test data
 *
 * Usage:
 *   npm run test:setup
 *
 * This creates tables with TEST- prefix (NODE_ENV=test automatically adds prefix):
 *   - TEST-SensorApi-Devices
 *   - TEST-SensorApi-Readings
 *   - TEST-SensorApi-ReadingRollups
 *   - TEST-SensorApi-Users
 *   - TEST-SensorApi-Auth
 */

import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { tableSchemas } from '../src/config/table-schemas';
import { toCreateTableInput } from '../src/config/table-mappers';
import { execSync } from 'child_process';

const client = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

async function setupIntegrationTables() {
  console.log('🏗️  Creating integration test tables...\n');

  // Create tables from the shared schemas. The schema table names already include
  // the TEST- prefix when NODE_ENV=test.
  for (const schema of Object.values(tableSchemas)) {
    try {
      const createTableInput = toCreateTableInput(schema);
      await client.send(new CreateTableCommand(createTableInput));
      console.log(`✓ Created table: ${schema.tableName}`);
    } catch (error: any) {
      if (error.name === 'ResourceInUseException') {
        console.log(`✓ Table already exists: ${schema.tableName}`);
      } else {
        throw error;
      }
    }
  }

  console.log('\n🌱 Seeding test data...\n');

  // Seed data using existing seed-test script (NODE_ENV=test already set)
  try {
    execSync('npm run seed:test', {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('❌ Failed to seed data:', error);
    throw error;
  }

  console.log('\n✅ Test setup complete!');
  console.log('\nTo run tests:');
  console.log('  1. Start API: npm run sam:test');
  console.log('  2. Run compatibility tests: npm run test:compatibility');
  console.log('     OR run integration tests: npm run test:integration\n');
}

setupIntegrationTables().catch(console.error);
