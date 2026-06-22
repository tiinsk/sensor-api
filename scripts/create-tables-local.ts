import { DynamoDBClient, CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { tableSchemas } from '../src/config/table-schemas';
import { toCreateTableInput } from '../src/config/table-mappers';

const client = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

async function createTable(tableName: string, input: any) {
  try {
    await client.send(new CreateTableCommand(input));
    console.log(`✓ Created ${tableName} table`);
  } catch (err: any) {
    if (err.name === 'ResourceInUseException') {
      console.log(`✓ ${tableName} table already exists`);
    } else {
      throw err;
    }
  }
}

async function createTables() {
  console.log('Creating DynamoDB tables locally...\n');

  // Create all tables from shared config
  await createTable('Devices', toCreateTableInput(tableSchemas.devices));
  await createTable('Readings', toCreateTableInput(tableSchemas.readings));
  await createTable('ReadingRollups', toCreateTableInput(tableSchemas.readingRollups));
  await createTable('Users', toCreateTableInput(tableSchemas.users));
  await createTable('Auth', toCreateTableInput(tableSchemas.auth));

  console.log('\n✅ All tables created successfully!');
}

createTables().catch(console.error);
