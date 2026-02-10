import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';
import { TABLES } from '../src/config/constants';

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

  // Seed Readings first so we can get the latest reading IDs
  const now = new Date();
  let readingCount = 0;
  
  const latestReadingTimes = {
    'device-001': now.toISOString(),
    'device-002': now.toISOString(),
  };
  
  for (let i = 0; i < 50; i++) {
    const time = new Date(now.getTime() - i * 10 * 60 * 1000); // Every 10 minutes
    
    await docClient.send(
      new PutCommand({
        TableName: TABLES.READINGS,
        Item: {
          deviceId: 'device-001',
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
        TableName: TABLES.READINGS,
        Item: {
          deviceId: 'device-002',
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

  // Seed Devices (with latestReadingId pointing to the most recent reading)
  const devices = [
    {
      id: 'device-001',
      name: 'Living Room Sensor',
      location: {
        x: 100,
        y: 200,
        type: 'inside',
      },
      type: 'ruuvi',
      sensorInfo: 'Ruuvi Tag Indoor',
      disabled: false,
      order: 1,
      latestReadingId: latestReadingTimes['device-001'],
    },
    {
      id: 'device-002',
      name: 'Balcony Sensor',
      location: {
        x: 300,
        y: 50,
        type: 'outside',
      },
      type: 'ruuvi',
      sensorInfo: 'Ruuvi Tag Outdoor',
      disabled: false,
      order: 2,
      latestReadingId: latestReadingTimes['device-002'],
    },
    {
      id: 'device-003',
      name: 'Bedroom Sensor',
      location: {
        x: 200,
        y: 300,
        type: 'inside',
      },
      type: 'sensorbug',
      sensorInfo: 'Sensorbug v2',
      disabled: true,
      order: 3,
    },
  ];

  for (const device of devices) {
    await docClient.send(
      new PutCommand({
        TableName: TABLES.DEVICES,
        Item: device,
      })
    );
  }
  console.log('✓ Seeded 3 devices');

  // Seed User
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = sha512('testpassword', salt);
  
  await docClient.send(
    new PutCommand({
        TableName: TABLES.USERS,
      Item: {
        username: 'testuser',
        passwordHash: passwordHash,
        salt: salt,
        disabled: false,
      },
    })
  );
  console.log('✓ Seeded 1 user (testuser / testpassword)');

  // Seed API Key
  await docClient.send(
    new PutCommand({
        TableName: TABLES.AUTH,
      Item: {
        apiKey: 'test-api-key-12345',
        deviceId: null,
        description: 'Test API key for development',
      },
    })
  );
  console.log('✓ Seeded 1 API key (test-api-key-12345)');

  console.log('\n✅ Seed complete!');
}

seedData().catch(console.error);
