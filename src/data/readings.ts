/**
 * Readings data access layer
 */

import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { getDevice } from './devices';
import { TABLES } from '../config/constants';

const docClient = createDynamoDBClient();

export type ReadingType = 'temperature' | 'humidity' | 'pressure' | 'lux' | 'battery';
export type TimeLevel = '10 minutes' | '30 minutes' | 'day' | 'week' | 'month';

interface Reading {
  deviceId: string;
  timestamp: string;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  lux?: number;
  battery?: number;
}

/**
 * Get readings for a specific device within time range
 */
export async function getDeviceReadings(params: {
  deviceId: string;
  startTime: string;
  endTime: string;
  types: ReadingType[];
  level: TimeLevel;
}) {
  // Verify device exists
  const device = await getDevice(params.deviceId);
  if ('error' in device) {
    return device;
  }

  // Query readings in time range
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLES.READINGS,
      KeyConditionExpression: 'device_id = :deviceId AND #ts BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: {
        '#ts': 'timestamp',
      },
      ExpressionAttributeValues: {
        ':deviceId': params.deviceId,
        ':startTime': params.startTime,
        ':endTime': params.endTime,
      },
    })
  );

  const readings = (result.Items || []) as Reading[];

  // Aggregate readings by time level and type
  // NOTE: In PostgreSQL this was done with date_trunc/date_bin and GROUP BY
  // In DynamoDB, we do it in application code
  const aggregatedByType = params.types.map((type) => ({
    type,
    values: aggregateReadings(readings, type, params.level),
  }));

  return {
    id: params.deviceId,
    values: aggregatedByType,
  };
}

/**
 * Get readings for all devices
 */
export async function getAllReadings(params: {
  startTime: string;
  endTime: string;
  type: ReadingType;
  level: TimeLevel;
  limit: number;
  offset: number;
}) {
  // Get devices (reusing device pagination)
  const { getAllDevices } = await import('./devices.js');
  const devicesResult = await getAllDevices({
    limit: params.limit,
    offset: params.offset,
    includeDisabled: false,
  });

  // Query readings for each device
  const readingsPromises = devicesResult.values.map(async (device) => {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READINGS,
        KeyConditionExpression: 'device_id = :deviceId AND #ts BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#ts': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':deviceId': device.id,
          ':startTime': params.startTime,
          ':endTime': params.endTime,
        },
      })
    );

    return {
      deviceId: device.id,
      readings: (result.Items || []) as Reading[],
    };
  });

  const allReadings = await Promise.all(readingsPromises);

  // Aggregate readings
  const values = allReadings.map((deviceReadings) => ({
    id: deviceReadings.deviceId,
    values: aggregateReadings(deviceReadings.readings, params.type, params.level),
  }));

  return {
    count: devicesResult.count,
    totCount: devicesResult.totCount,
    limit: params.limit,
    values,
  };
}

/**
 * Add new reading for a device
 */
export async function addDeviceReading(params: {
  id: string;
  payload: {
    temperature?: number;
    humidity?: number;
    pressure?: number;
    lux?: number;
    battery?: number;
  };
}) {
  // Verify device exists
  const device = await getDevice(params.id);
  if ('error' in device) {
    return device;
  }

  const timestamp = new Date().toISOString();

  const reading: Reading = {
    deviceId: params.id,
    timestamp,
    temperature: params.payload.temperature,
    humidity: params.payload.humidity,
    pressure: params.payload.pressure,
    lux: params.payload.lux,
    battery: params.payload.battery,
  };

  // Add reading
  await docClient.send(
    new PutCommand({
      TableName: TABLES.READINGS,
      Item: reading,
    })
  );

  // Update device's latest_reading timestamp
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DEVICES,
      Key: { id: params.id },
      UpdateExpression: 'SET latest_reading_timestamp = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': timestamp,
      },
    })
  );

  return reading;
}

/**
 * Aggregate readings by time level
 * NOTE: This is done in application code since DynamoDB doesn't have GROUP BY
 */
function aggregateReadings(
  readings: Reading[],
  type: ReadingType,
  level: TimeLevel
): Array<{ time: string; avg: number; min: number; max: number }> {
  if (readings.length === 0) return [];

  // Group readings by time bucket
  const buckets = new Map<string, number[]>();

  readings.forEach((reading) => {
    const value = reading[type];
    if (value === undefined || value === null) return;

    const bucketKey = truncateTime(reading.timestamp, level);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(value);
  });

  // Calculate aggregates for each bucket
  const aggregated = Array.from(buckets.entries()).map(([time, values]) => ({
    time,
    avg: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }));

  // Sort by time
  aggregated.sort((a, b) => a.time.localeCompare(b.time));

  return aggregated;
}

/**
 * Truncate timestamp to time level bucket
 */
function truncateTime(timestamp: string, level: TimeLevel): string {
  const date = new Date(timestamp);

  switch (level) {
    case '10 minutes':
      date.setMinutes(Math.floor(date.getMinutes() / 10) * 10, 0, 0);
      return date.toISOString();

    case '30 minutes':
      date.setMinutes(Math.floor(date.getMinutes() / 30) * 30, 0, 0);
      return date.toISOString();

    case 'day':
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split('T')[0];

    case 'week': {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split('T')[0];
    }

    case 'month':
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.toISOString().split('T')[0].substring(0, 7); // YYYY-MM

    default:
      return timestamp;
  }
}
