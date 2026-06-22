#!/usr/bin/env node
/**
 * One-time migration: PostgreSQL (sensor_api-OLD) → DynamoDB (sensor-api).
 * Install pg first: npm install pg && npm install -D @types/pg
 */
import { Client } from 'pg';
import { BatchWriteCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../src/lib/db-client';
import { TABLES } from '../src/config/constants';

const BATCH_SIZE = 25; // DynamoDB BatchWriteItem limit

const docClient = createDynamoDBClient();

const DEVICES_TABLE = TABLES.DEVICES;
const READINGS_TABLE = TABLES.READINGS;

async function run() {
  const pgUrl = process.env.PG_CONNECTION_STRING;
  if (!pgUrl) {
    console.error('Missing PG_CONNECTION_STRING');
    process.exit(1);
  }

  const client = new Client({ connectionString: pgUrl });
  await client.connect();

  try {
    // --- Devices ---
    const deviceRows = await client.query(`
      SELECT id, name, location_type, location_x, location_y, "order", type, disabled, latest_reading, sensor_info
      FROM device
    `);
    const devices = deviceRows.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      name: row.name ?? '',
      location: {
        x: Number(row.location_x) || 0,
        y: Number(row.location_y) || 0,
        type: row.location_type === 'inside' || row.location_type === 'outside' ? row.location_type : null,
      },
      order: row.order != null ? Number(row.order) : 0,
      type: row.type === 'sensorbug' ? 'sensorbug' : 'ruuvi',
      disabled: Boolean(row.disabled),
    }));
    await batchWrite(DEVICES_TABLE, devices);
    console.log(`Devices: ${devices.length} written to ${DEVICES_TABLE}`);

    // --- Readings ---
    const readingRows = await client.query(`
      SELECT id, temperature, humidity, pressure, battery, device, created_at
      FROM reading
      ORDER BY device, created_at ASC
    `);
    const latestByDevice: Record<string, string> = {};
    const readings = readingRows.rows.map((row: Record<string, unknown>) => {
      const created = row.created_at as Date;
      const timestamp = created instanceof Date ? created.toISOString() : String(created);
      const deviceId = String(row.device);
      latestByDevice[deviceId] = timestamp;
      return {
        deviceId,
        timestamp,
        temperature: row.temperature != null ? Number(row.temperature) : undefined,
        humidity: row.humidity != null ? Number(row.humidity) : undefined,
        pressure: row.pressure != null ? Number(row.pressure) : undefined,
        battery: row.battery != null ? Number(row.battery) : undefined,
      };
    });
    await batchWrite(READINGS_TABLE, readings);
    console.log(`Readings: ${readings.length} written to ${READINGS_TABLE}`);

    // --- Update device latestReadingId ---
    for (const [deviceId, timestamp] of Object.entries(latestByDevice)) {
      await docClient.send(
        new UpdateCommand({
          TableName: DEVICES_TABLE,
          Key: { id: deviceId },
          UpdateExpression: 'SET latestReadingId = :ts',
          ExpressionAttributeValues: { ':ts': timestamp },
        })
      );
    }
    console.log(`Updated latestReadingId on ${Object.keys(latestByDevice).length} devices.`);
  } finally {
    await client.end();
  }

  console.log('Migration done.');
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function batchWrite(tableName: string, items: Record<string, unknown>[]): Promise<void> {
  let written = 0;
  for (const batch of chunk(items, BATCH_SIZE)) {
    try {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: item as Record<string, unknown> },
            })),
          },
        })
      );
      written += batch.length;
      console.log(`Batch ${tableName}: ${written}/${items.length}`);
    } catch (batchErr) {
      console.error(`Batch write failed for ${tableName}, retrying items one by one to find the failing item:\n`, batchErr);
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j] as Record<string, unknown>;
        try {
          await docClient.send(
            new PutCommand({
              TableName: tableName,
              Item: item,
            })
          );
          written += 1;
          console.log(`One by one (index ${j} in batch):`, JSON.stringify(item, null, 2));
        } catch (itemErr) {
          console.error(`Item that caused the error (index ${j} in batch):`, JSON.stringify(item, null, 2));
          console.error('Error:', itemErr);
          throw itemErr;
        }
      }
      console.log(`Batch ${tableName}: ${written}/${items.length} (recovered after one-by-one retry)`);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
