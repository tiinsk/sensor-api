import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLES, DEFAULT_DEVICE_TIMEZONE } from '../src/config/constants';
import { updateReadingRollups } from '../src/data/reading-rollups';
import type { Device, Reading } from '../src/db-types';
import { createDynamoDBClient } from '../src/lib/db-client';

const docClient = createDynamoDBClient();

const getAllDevices = async (): Promise<Device[]> => {
  const devices: Device[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DEVICES,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    devices.push(...((result.Items || []) as Device[]));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return devices;
};

const getDeviceReadings = async (deviceId: string): Promise<Reading[]> => {
  const readings: Reading[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READINGS,
        KeyConditionExpression: 'deviceId = :deviceId',
        ExpressionAttributeValues: {
          ':deviceId': deviceId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    readings.push(...((result.Items || []) as Reading[]));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return readings;
};

const run = async () => {
  const devices = await getAllDevices();

  console.log(`Backfilling reading rollups for ${devices.length} devices...`);

  for (const device of devices) {
    const readings = await getDeviceReadings(device.id);
    const timezone = device.timezone ?? DEFAULT_DEVICE_TIMEZONE;

    console.log(`Backfilling ${readings.length} readings for ${device.id} (${timezone})`);

    for (const reading of readings) {
      await updateReadingRollups(reading, timezone);
    }
  }

  console.log('Reading rollup backfill complete.');
};

run().catch((error) => {
  console.error('Reading rollup backfill failed:', error);
  process.exit(1);
});
