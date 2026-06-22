/**
 * Readings data access layer
 */

import { QueryCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { getDevice } from './devices';
import { TABLES } from '../config/constants';
import {
  AllReadingsResponse,
  CreatedReadingResponse,
  DeviceReadingsResponse,
  SensorType,
  TimedAvgMinMax,
  TimeLevel,
} from '../api-types';
import { Reading } from '../db-types';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { airQualityFromPm25Co2 } from '../utils/air-quality';
import { getAllDevices } from './devices';
import { updateReadingRollups } from './reading-rollups';

const docClient = createDynamoDBClient();

/**
 * Fetch all readings for a device within a time range, paginating through DynamoDB results.
 */
export async function queryAllReadingsInRange(params: {
  deviceId: string;
  startTime: string;
  endTime: string;
}): Promise<Reading[]> {
  const readings: Reading[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READINGS,
        KeyConditionExpression: 'deviceId = :deviceId AND #timestamp BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':deviceId': params.deviceId,
          ':startTime': params.startTime,
          ':endTime': params.endTime,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    readings.push(...((result.Items || []) as Reading[]));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return readings;
}

/**
 * Get readings for a specific device within time range
 */
export async function getDeviceReadings(params: {
  deviceId: string;
  startTime: string;
  endTime: string;
  types: SensorType[];
  level: TimeLevel;
  timezone?: string; // IANA timezone (e.g., 'Europe/Helsinki'), defaults to 'UTC'
}): Promise<DeviceReadingsResponse> {
  // Verify device exists
  await getDevice(params.deviceId);

  // Query readings in time range
  const readings = await queryAllReadingsInRange({
    deviceId: params.deviceId,
    startTime: params.startTime,
    endTime: params.endTime,
  });

  // Aggregate readings by time level and type
  // NOTE: In PostgreSQL this was done with date_trunc/date_bin and GROUP BY
  // In DynamoDB, we do it in application code
  const timezone = params.timezone || 'UTC';
  const aggregatedByType = params.types.map((type) => ({
    type,
    values: aggregateReadings(readings, type, params.level, timezone),
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
  type: SensorType;
  level: TimeLevel;
  limit: number;
  offset: number;
  timezone?: string; // IANA timezone (e.g., 'Europe/Helsinki'), defaults to 'UTC'
}): Promise<AllReadingsResponse> {
  const devicesResult = await getAllDevices({
    limit: params.limit,
    offset: params.offset,
    includeDisabled: false,
  });

  // Query readings for each device
  const readingsPromises = devicesResult.values.map(async (device) => {
    const readings = await queryAllReadingsInRange({
      deviceId: device.id,
      startTime: params.startTime,
      endTime: params.endTime,
    });

    return {
      deviceId: device.id,
      readings,
    };
  });

  const allReadings = await Promise.all(readingsPromises);

  // Aggregate readings
  const timezone = params.timezone || 'UTC';
  const values = allReadings.map((deviceReadings) => ({
    id: deviceReadings.deviceId,
    values: aggregateReadings(deviceReadings.readings, params.type, params.level, timezone),
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
    pm25?: number;
    co2?: number;
    voc?: number;
    nox?: number;
    timestamp?: string;
  };
}): Promise<CreatedReadingResponse> {
  // Verify device exists
  const device = await getDevice(params.id);

  // Use provided timestamp or current time
  const timestamp = params.payload.timestamp || new Date().toISOString();

  const reading: Reading = {
    deviceId: params.id,
    timestamp,
    temperature: params.payload.temperature,
    humidity: params.payload.humidity,
    pressure: params.payload.pressure,
    lux: params.payload.lux,
    battery: params.payload.battery,
    pm25: params.payload.pm25,
    co2: params.payload.co2,
    voc: params.payload.voc,
    nox: params.payload.nox,
  };

  // Add reading
  await docClient.send(
    new PutCommand({
      TableName: TABLES.READINGS,
      Item: reading,
    })
  );

  // Update device's latestReadingId timestamp
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.DEVICES,
      Key: { id: params.id },
      UpdateExpression: 'SET latestReadingId = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': timestamp,
      },
    })
  );

  await updateReadingRollups(reading, device.timezone);

  return {
    ...reading,
    airQuality: airQualityFromPm25Co2(reading.pm25, reading.co2),
  };
}

/**
 * Aggregate readings by time level
 * NOTE: This is done in application code since DynamoDB doesn't have GROUP BY
 */
function aggregateReadings(
  readings: Reading[],
  type: SensorType,
  level: TimeLevel,
  timezone: string
): TimedAvgMinMax[] {
  if (readings.length === 0) return [];

  // Group readings by time bucket
  const buckets = new Map<string, number[]>();

  readings.forEach((reading) => {
    const value =
      type === 'airQuality'
        ? airQualityFromPm25Co2(reading.pm25, reading.co2)
        : reading[type];
    if (value === undefined) return;

    const bucketKey = truncateTime(reading.timestamp, level, timezone);
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(value);
  });

  // Calculate aggregates for each bucket
  const aggregated = Array.from(buckets.entries()).map(([timestamp, values]) => ({
    timestamp,
    avg: values.reduce((sum, v) => sum + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  }));

  // Sort by time
  aggregated.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return aggregated;
}

/**
 * Truncate timestamp to time level bucket using specified timezone
 * Matches PostgreSQL's date_trunc behavior with timezone support
 */
function truncateTime(timestamp: string, level: TimeLevel, timezone: string): string {
  // Convert UTC timestamp to the target timezone
  const utcDate = new Date(timestamp);
  const zonedDate = toZonedTime(utcDate, timezone);

  // Truncate the date components according to level
  switch (level) {
    case '30 minutes':
      zonedDate.setMinutes(Math.floor(zonedDate.getMinutes() / 30) * 30, 0, 0);
      break;

    case 'day':
      zonedDate.setHours(0, 0, 0, 0);
      break;

    case 'week': {
      const dayOfWeek = zonedDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      zonedDate.setDate(zonedDate.getDate() - daysToMonday);
      zonedDate.setHours(0, 0, 0, 0);
      break;
    }

    case 'month':
      zonedDate.setDate(1);
      zonedDate.setHours(0, 0, 0, 0);
      break;
  }

  // Convert back to UTC
  const utcResult = fromZonedTime(zonedDate, timezone);
  return utcResult.toISOString();
}
