import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const client = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'local',
    secretAccessKey: 'local',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

// Simple password hashing (same as old API)
function sha512(password: string, salt: string) {
  const hash = crypto.createHmac('sha512', salt);
  hash.update(password);
  return hash.digest('hex');
}

async function seedData() {
  console.log('Seeding test data...\n');

  // Seed Devices
  const devices = [
    {
      id: 'device-001',
      name: 'Living Room Sensor',
      location_x: 100,
      location_y: 200,
      type: 'ruuvi',
      disabled: false,
      order: 1,
    },
    {
      id: 'device-002',
      name: 'Balcony Sensor',
      location_x: 300,
      location_y: 50,
      type: 'ruuvi',
      disabled: false,
      order: 2,
    },
    {
      id: 'device-003',
      name: 'Bedroom Sensor',
      location_x: 200,
      location_y: 300,
      type: 'sensorbug',
      disabled: true,
      order: 3,
    },
  ];

  for (const device of devices) {
    await docClient.send(
      new PutCommand({
        TableName: 'SensorApi-Devices',
        Item: device,
      })
    );
  }
  console.log('✓ Seeded 3 devices');

  // Seed Readings
  const now = new Date();
  let readingCount = 0;
  
  for (let i = 0; i < 50; i++) {
    const time = new Date(now.getTime() - i * 10 * 60 * 1000); // Every 10 minutes
    
    await docClient.send(
      new PutCommand({
        TableName: 'SensorApi-Readings',
        Item: {
          device_id: 'device-001',
          timestamp: time.toISOString(),
          temperature: 20 + Math.random() * 5,
          humidity: 40 + Math.random() * 20,
          pressure: 1010 + Math.random() * 10,
          battery: 95 - i * 0.1,
        },
      })
    );
    
    await docClient.send(
      new PutCommand({
        TableName: 'SensorApi-Readings',
        Item: {
          device_id: 'device-002',
          timestamp: time.toISOString(),
          temperature: 5 + Math.random() * 10,
          humidity: 60 + Math.random() * 20,
          pressure: 1010 + Math.random() * 10,
          battery: 90 - i * 0.1,
        },
      })
    );
    
    readingCount += 2;
  }
  console.log(`✓ Seeded ${readingCount} readings`);

  // Seed User
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = sha512('testpassword', salt);
  
  await docClient.send(
    new PutCommand({
      TableName: 'SensorApi-Users',
      Item: {
        username: 'testuser',
        password_hash: passwordHash,
        salt: salt,
        disabled: false,
      },
    })
  );
  console.log('✓ Seeded 1 user (testuser / testpassword)');

  // Seed API Key
  await docClient.send(
    new PutCommand({
      TableName: 'SensorApi-Auth',
      Item: {
        api_key: 'test-api-key-12345',
        device_id: null,
        description: 'Test API key for development',
      },
    })
  );
  console.log('✓ Seeded 1 API key (test-api-key-12345)');

  console.log('\n✅ Seed complete!');
}

seedData().catch(console.error);
