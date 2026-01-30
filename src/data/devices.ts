/**
 * Device data access layer
 */

import { ScanCommand, QueryCommand, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createDynamoDBClient } from '../lib/db-client';
import type { Device, DeviceError, ArrayRequestParams } from '../types';

const docClient = createDynamoDBClient();
const TABLE_NAME = process.env.DEVICES_TABLE || 'SensorApi-Devices';

/**
 * Map DynamoDB item to Device type
 */
function mapToDevice(item: any): Device {
  return {
    id: item.id,
    name: item.name,
    location: {
      x: item.location_x,
      y: item.location_y,
      type: item.location_type,
    },
    disabled: item.disabled,
    order: item.order,
    type: item.type,
  };
}

/**
 * Map Device type to DynamoDB item
 */
function mapToDynamoItem(device: Device) {
  return {
    id: device.id,
    name: device.name,
    location_x: device.location.x,
    location_y: device.location.y,
    location_type: device.location.type,
    disabled: device.disabled,
    order: device.order,
    type: device.type,
  };
}

/**
 * Get all devices with pagination
 */
export async function getAllDevices(params: ArrayRequestParams & { includeDisabled: boolean }) {
  const { limit, offset, includeDisabled } = params;

  // DynamoDB doesn't support offset directly, so we scan and skip
  // For production, use LastEvaluatedKey pagination instead
  const result = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      Limit: limit + offset, // Fetch more to handle offset
    })
  );

  let items = result.Items || [];

  // Filter disabled devices if needed
  if (!includeDisabled) {
    items = items.filter((item) => !item.disabled);
  }

  // Sort by order
  items.sort((a, b) => a.order - b.order);

  // Apply offset and limit
  const paginatedItems = items.slice(offset, offset + limit);

  return {
    count: paginatedItems.length,
    totCount: items.length,
    limit,
    values: paginatedItems.map(mapToDevice),
  };
}

/**
 * Get single device by ID
 */
export async function getDevice(
  deviceId: string,
  includeDisabled = false
): Promise<Device | DeviceError> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: deviceId },
    })
  );

  if (!result.Item) {
    return {
      error: `Device with id ${deviceId} not found`,
      statusCode: 404,
    };
  }

  if (!includeDisabled && result.Item.disabled) {
    return {
      error: `Device with id ${deviceId} not found`,
      statusCode: 404,
    };
  }

  return mapToDevice(result.Item);
}

/**
 * Add new device
 */
export async function addDevice(device: Device): Promise<Device | DeviceError> {
  // Check if device already exists
  const existing = await getDevice(device.id, true);
  if (!('error' in existing)) {
    return {
      error: `Device with id ${device.id} already exists`,
      statusCode: 409,
    };
  }

  // Check if order is already taken
  const allDevices = await getAllDevices({ limit: 1000, offset: 0, includeDisabled: true });
  const orderExists = allDevices.values.some((d) => d.order === device.order);
  if (orderExists) {
    return {
      error: `Device with order ${device.order} already exists`,
      statusCode: 409,
    };
  }

  // Add device
  const item = mapToDynamoItem(device);
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return device;
}

/**
 * Update existing device
 */
export async function updateDevice(device: Device): Promise<Device | DeviceError> {
  // Check if device exists
  const existing = await getDevice(device.id, true);
  if ('error' in existing) {
    return {
      error: `Device with id ${device.id} doesn't exist`,
      statusCode: 409,
    };
  }

  // Check if new order conflicts with another device
  const allDevices = await getAllDevices({ limit: 1000, offset: 0, includeDisabled: true });
  const orderConflict = allDevices.values.some(
    (d) => d.id !== device.id && d.order === device.order
  );
  if (orderConflict) {
    return {
      error: `Device with order ${device.order} already exists`,
      statusCode: 409,
    };
  }

  // Update device
  const item = mapToDynamoItem(device);
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return device;
}
