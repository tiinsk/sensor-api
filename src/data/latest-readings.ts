import {DynamoDBDocumentClient, GetCommand, ScanCommand} from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import { ArrayRequestParams, LatestReading } from '../api-types';
import { Device, Reading } from '../db-types';
import { NotFoundError } from '../lib/errors';
import { TABLES } from '../config/constants';
import { airQualityFromPm25Co2 } from '../utils/air-quality';

const docClient = createDynamoDBClient();

interface DeviceWithReading extends Device {
  reading: LatestReading | null;
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
    // Scan all devices to filter disabled and get accurate count
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DEVICES,
      })
    );

    // Filter out disabled devices and sort by order
    const allDevices = ((result.Items || []) as Device[])
      .filter(device => !device.disabled)
      .sort((a, b) => a.order - b.order);

    // Get total count after filtering
    const totalCount = allDevices.length;

    // Apply offset and limit for pagination
    const paginatedDevices = allDevices.slice(offset, offset + limit);

    // Fetch latest reading for each device
    const devicesWithReadings = await Promise.all(
      paginatedDevices.map(async (device): Promise<DeviceWithReading> => {
        const reading = await fetchLatestReading(
          docClient,
          device.id,
          device.latestReadingId
        );
        return {
          id: device.id,
          name: device.name,
          sensorInfo: device.sensorInfo,
          order: device.order,
          type: device.type,
          location: device.location,
          timezone: device.timezone,
          disabled: device.disabled,
          reading: reading ? {
            temperature: reading.temperature,
            humidity: reading.humidity,
            pressure: reading.pressure,
            battery: reading.battery,
            pm25: reading.pm25,
            co2: reading.co2,
            voc: reading.voc,
            nox: reading.nox,
            airQuality: airQualityFromPm25Co2(reading.pm25, reading.co2),
            timestamp: reading.timestamp,
          } : null,
        };
      })
    );

    return {
      count: devicesWithReadings.length,
      totCount: totalCount,
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
    
    if (device.disabled) {
      throw new NotFoundError(`Device with id ${deviceId} not found`);
    }

    // Fetch latest reading
    const reading = await fetchLatestReading(
      docClient,
      device.id,
      device.latestReadingId
    );

    return {
      id: device.id,
      name: device.name,
      sensorInfo: device.sensorInfo,
      order: device.order,
      type: device.type,
      location: device.location,
      timezone: device.timezone,
      disabled: device.disabled,
      reading: reading ? {
        temperature: reading.temperature,
        humidity: reading.humidity,
        pressure: reading.pressure,
        battery: reading.battery,
        pm25: reading.pm25,
        co2: reading.co2,
        voc: reading.voc,
        nox: reading.nox,
        airQuality: airQualityFromPm25Co2(reading.pm25, reading.co2),
        timestamp: reading.timestamp,
      } : null,
    };
  } catch (error) {
    console.error(`Failed to get latest reading for device ${deviceId}:`, error);
    throw error;
  }
}
