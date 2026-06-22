/**
 * Device data access layer
 */

import { ScanCommand, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import type { ArrayRequestParams } from '../api-types';
import type { Device } from '../db-types';
import { NotFoundError, ConflictError } from '../lib/errors';
import { TABLES } from '../config/constants';

const docClient = createDynamoDBClient();

/**
 * Map DynamoDB item to Device type
 */
function mapToDevice(item: any): Device {
  return {
    id: item.id,
    name: item.name,
    location: {
      x: item.location.x,
      y: item.location.y,
      type: item.location.type,
    },
    disabled: item.disabled,
    order: item.order,
    type: item.type,
    timezone: item.timezone,
    latestReadingId: item.latestReadingId,
  };
}

/**
 * Map Device type to DynamoDB item
 */
function mapToDynamoItem(device: Device) {
  return {
    id: device.id,
    name: device.name,
    location: {
      x: device.location.x,
      y: device.location.y,
      type: device.location.type,
    },
    disabled: device.disabled,
    order: device.order,
    type: device.type,
    timezone: device.timezone,
    latestReadingId: device.latestReadingId,
  };
}

/**
 * Get all devices with pagination
 */
export async function getAllDevices(params: ArrayRequestParams & { includeDisabled: boolean }) {
  const { limit, offset, includeDisabled } = params;

  // Scan all devices to get total count and apply filters
  // Note: For large datasets, consider using a count table or caching
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLES.DEVICES,
    })
  );

  let allItems = result.Items || [];

  // Filter disabled devices if needed
  if (!includeDisabled) {
    allItems = allItems.filter((item) => !item.disabled);
  }

  // Sort by order
  allItems.sort((a, b) => a.order - b.order);

  // Get total count after filtering
  const totalCount = allItems.length;

  // Apply offset and limit for pagination
  const paginatedItems = allItems.slice(offset, offset + limit);

  return {
    count: paginatedItems.length,
    totCount: totalCount,
    limit,
    values: paginatedItems.map(mapToDevice),
  };
}

/**
 * Check if a device exists (returns boolean)
 */
async function deviceExists(deviceId: string): Promise<boolean> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.DEVICES,
      Key: { id: deviceId },
    })
  );
  return !!result.Item;
}

/**
 * Get single device by ID
 */
export async function getDevice(
  deviceId: string,
  includeDisabled = false
): Promise<Device> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLES.DEVICES,
      Key: { id: deviceId },
    })
  );

  if (!result.Item) {
    throw new NotFoundError(`Device with id ${deviceId} not found`);
  }

  if (!includeDisabled && result.Item.disabled) {
    throw new NotFoundError(`Device with id ${deviceId} not found`);
  }

  return mapToDevice(result.Item);
}

/**
 * Add new device
 */
export async function addDevice(device: Device): Promise<Device> {
  // Check if device already exists
  const exists = await deviceExists(device.id);
  if (exists) {
    throw new ConflictError(`Device with id ${device.id} already exists`);
  }

  // Check if order is already taken
  const allDevices = await getAllDevices({ limit: 1000, offset: 0, includeDisabled: true });
  const orderExists = allDevices.values.some((d) => d.order === device.order);
  if (orderExists) {
    throw new ConflictError(`Device with order ${device.order} already exists`);
  }

  // Add device
  const item = mapToDynamoItem(device);
  await docClient.send(
    new PutCommand({
      TableName: TABLES.DEVICES,
      Item: item,
    })
  );

  return device;
}

/**
 * Update existing device
 */
export async function updateDevice(
  deviceId: string,
  updates: Partial<Omit<Device, 'id'>>
): Promise<Device> {
  // Check if device exists (will throw NotFoundError if not found)
  const existing = await getDevice(deviceId, true);

  // Check if new order conflicts with another device
  if (updates.order !== undefined) {
    const allDevices = await getAllDevices({ limit: 1000, offset: 0, includeDisabled: true });
    const orderConflict = allDevices.values.some(
      (d) => d.id !== deviceId && d.order === updates.order
    );
    if (orderConflict) {
      throw new ConflictError(`Device with order ${updates.order} already exists`);
    }
  }

  // Merge updates with existing device
  const updatedDevice: Device = {
    ...existing,
    ...updates,
    id: deviceId, // Ensure ID doesn't change
  };

  // Update device in DynamoDB
  const item = mapToDynamoItem(updatedDevice);
  await docClient.send(
    new PutCommand({
      TableName: TABLES.DEVICES,
      Item: item,
    })
  );

  return updatedDevice;
}

/**
 * Delete device and all its readings
 */
export async function deleteDevice(deviceId: string): Promise<void> {
  // Check if device exists (will throw NotFoundError if not found)
  await getDevice(deviceId, true);

  // Delete all readings for this device
  let lastEvaluatedKey: any = undefined;
  do {
    const queryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.READINGS,
        KeyConditionExpression: 'deviceId = :deviceId',
        ExpressionAttributeValues: {
          ':deviceId': deviceId,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    // Delete each reading
    if (queryResult.Items) {
      for (const item of queryResult.Items) {
        await docClient.send(
          new DeleteCommand({
            TableName: TABLES.READINGS,
            Key: {
              deviceId: item.deviceId,
              timestamp: item.timestamp,
            },
          })
        );
      }
    }

    lastEvaluatedKey = queryResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Delete the device
  await docClient.send(
    new DeleteCommand({
      TableName: TABLES.DEVICES,
      Key: { id: deviceId },
    })
  );
}
