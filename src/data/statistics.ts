import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { ArrayRequestParams, Reading } from '../types';
import {getAllDevices, getDevice} from './devices';
import { TABLES } from '../config/constants';
import { airQualityFromPm25Co2 } from '../utils/air-quality';

const docClient = createDynamoDBClient();

interface Statistics {
  temperature: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  humidity: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  pressure: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  pm25: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  co2: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  voc: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  nox: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
  airQuality: {
    avg: number | null;
    min: number | null;
    max: number | null;
  };
}

interface DeviceStatistics {
  id: string;
  statistics: Statistics;
}

/**
 * Calculate statistics (min, max, avg) for a set of readings
 */
function calculateStatistics(readings: Reading[]): Statistics {
  if (readings.length === 0) {
    return {
      temperature: { avg: null, min: null, max: null },
      humidity: { avg: null, min: null, max: null },
      pressure: { avg: null, min: null, max: null },
      pm25: { avg: null, min: null, max: null },
      co2: { avg: null, min: null, max: null },
      voc: { avg: null, min: null, max: null },
      nox: { avg: null, min: null, max: null },
      airQuality: { avg: null, min: null, max: null },
    };
  }

  // Filter out readings with null values for each metric
  const temps = readings.filter(r => r.temperature !== null && r.temperature !== undefined).map(r => r.temperature!);
  const humids = readings.filter(r => r.humidity !== null && r.humidity !== undefined).map(r => r.humidity!);
  const pressures = readings.filter(r => r.pressure !== null && r.pressure !== undefined).map(r => r.pressure!);
  const pm25Values = readings.filter(r => r.pm25 !== null && r.pm25 !== undefined).map(r => r.pm25!);
  const co2Values = readings.filter(r => r.co2 !== null && r.co2 !== undefined).map(r => r.co2!);
  const vocValues = readings.filter(r => r.voc !== null && r.voc !== undefined).map(r => r.voc!);
  const noxValues = readings.filter(r => r.nox !== null && r.nox !== undefined).map(r => r.nox!);
  const airQualityValues = readings
    .map((r) => airQualityFromPm25Co2(r.pm25, r.co2))
    .filter((v): v is number => v !== null);

  const calcStats = (values: number[]) => {
    if (values.length === 0) return { avg: null, min: null, max: null };
    return {
      avg: values.reduce((sum, v) => sum + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  };

  return {
    temperature: calcStats(temps),
    humidity: calcStats(humids),
    pressure: calcStats(pressures),
    pm25: calcStats(pm25Values),
    co2: calcStats(co2Values),
    voc: calcStats(vocValues),
    nox: calcStats(noxValues),
    airQuality: calcStats(airQualityValues),
  };
}

/**
 * Fetch all readings for a device within a time range
 */
async function getDeviceReadingsInRange(
  client: DynamoDBDocumentClient,
  deviceId: string,
  startTime: string,
  endTime: string
): Promise<Reading[]> {
  const readings: Reading[] = [];
  let lastEvaluatedKey: any = undefined;

  try {
    do {
      const result = await client.send(
        new QueryCommand({
          TableName: TABLES.READINGS,
          KeyConditionExpression: 'deviceId = :deviceId AND #timestamp BETWEEN :startTime AND :endTime',
          ExpressionAttributeNames: {
            '#timestamp': 'timestamp',
          },
          ExpressionAttributeValues: {
            ':deviceId': deviceId,
            ':startTime': startTime,
            ':endTime': endTime,
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      readings.push(...((result.Items || []) as Reading[]));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return readings;
  } catch (error) {
    console.error(`Failed to get readings for device ${deviceId}:`, error);
    throw error;
  }
}

/**
 * Get statistics for all devices within a time range
 */
export async function getAllStatistics(
  params: {
    startTime: string;
    endTime: string;
  } & ArrayRequestParams
) {
  const { startTime, endTime, limit, offset } = params;

  try {
    // Get paginated list of devices (only non-disabled)
    const devicesResult = await getAllDevices({ limit, offset, includeDisabled: false });

    // Fetch readings and calculate statistics for each device in parallel
    const statisticsResults = await Promise.all(
      devicesResult.values.map(async (device): Promise<DeviceStatistics> => {
        const readings = await getDeviceReadingsInRange(
          docClient,
          device.id,
          startTime,
          endTime
        );
        const statistics = calculateStatistics(readings);

        return {
          id: device.id,
          statistics,
        };
      })
    );

    return {
      count: statisticsResults.length,
      totCount: devicesResult.totCount,
      limit,
      values: statisticsResults,
    };
  } catch (error) {
    console.error('Failed to get all statistics:', error);
    throw error;
  }
}

/**
 * Get statistics for a single device within a time range
 */
export async function getDeviceStatistics(params: {
  startTime: string;
  endTime: string;
  deviceId: string;
}) {
  const { startTime, endTime, deviceId } = params;

  // Verify device exists
  const device = await getDevice(params.deviceId);
  if ('error' in device) {
    return device;
  }

  try {
    // Fetch all readings for this device in the time range
    const readings = await getDeviceReadingsInRange(
      docClient,
      deviceId,
      startTime,
      endTime
    );

    const statistics = calculateStatistics(readings);

    return {
      id: deviceId,
      statistics,
    };
  } catch (error) {
    console.error(`Failed to get statistics for device ${deviceId}:`, error);
    throw error;
  }
}
