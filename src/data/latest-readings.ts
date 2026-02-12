import {DynamoDBDocumentClient, GetCommand, ScanCommand} from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { ArrayRequestParams, Device, Reading } from '../types';
import { NotFoundError } from '../lib/errors';
import { TABLES } from '../config/constants';

const docClient = createDynamoDBClient();

interface DeviceWithReading extends Device {
  reading: Reading | null;
}

/**
 * Fetches the latest reading for a device by using the latestReadingId field
 */
async function fetchLatestReading(
  client: DynamoDBDocumentClient,
  deviceId: string,
  latestReadingId?: string
): Promise<Reading | null> {
  if (!latestReadingId) {
    return null;
  }

  try {
    const result = await client.send(
      new GetCommand({
        TableName: TABLES.READINGS,
        Key: {
          deviceId,
          timestamp: latestReadingId,
        },
      })
    );

    return result.Item as Reading | null;
  } catch (error) {
    console.error(`Failed to fetch latest reading for device ${deviceId}:`, error);
    return null;
  }
}

/**
 * Get all devices with their latest readings
 * Uses the GSI to query devices by type and order
 */
export async function getAllLatestReadings(params: ArrayRequestParams) {
  const { limit, offset } = params;

  try {
    // Query all non-disabled devices using the type-order-index
    // Note: This assumes 'sensor' is the default type. Adjust if you have multiple types.
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DEVICES,
        Limit: limit + offset,
      })
    );

    //TODO: contains also disabled devices -> remove disabled
    const devices = (result.Items || []) as Device[];

    // Apply offset in application code (inefficient for large offsets)
    const paginatedDevices = devices.slice(offset, offset + limit);

    // Fetch latest reading for each device
    const devicesWithReadings = await Promise.all(
      paginatedDevices.map(async (device): Promise<DeviceWithReading> => {
        const reading = await fetchLatestReading(
          docClient,
          device.id,
          device.latestReadingId
        );
        return {
          ...device,
          reading,
        };
      })
    );

    return {
      count: devicesWithReadings.length,
      totCount: devices.length,
      limit,
      values: devicesWithReadings,
    };
  } catch (error) {
    console.error('Failed to get all latest readings:', error);
    throw error;
  }
}

/**
 * Get a single device with its latest reading
 */
export async function getDeviceLatestReading(deviceId: string) {
  try {
    // Fetch device
    const deviceResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.DEVICES,
        Key: { id: deviceId },
      })
    );

    if (!deviceResult.Item) {
      throw new NotFoundError(`Device with id ${deviceId} not found`);
    }

    const device = deviceResult.Item as Device;

    // Fetch latest reading
    const reading = await fetchLatestReading(
      docClient,
      device.id,
      device.latestReadingId
    );

    return {
      ...device,
      reading,
    };
  } catch (error) {
    console.error(`Failed to get latest reading for device ${deviceId}:`, error);
    throw error;
  }
}
