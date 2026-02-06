/**
 * Device route handlers
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getAllDevices, getDevice, addDevice, updateDevice } from '../data/devices';
import { requireAuth, AuthContext } from '../lib/auth-middleware';
import { NotFoundError, ConflictError, isHttpError } from '../lib/errors';

const GetAllDevicesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  includeDisabled: z.coerce.boolean().default(false),
});

const AddDeviceSchema = z.object({
  id: z.string().length(12),
  order: z.number(),
  name: z.string(),
  type: z.enum(['ruuvi', 'sensorbug']),
  location: z.object({
    x: z.number(),
    y: z.number(),
    type: z.enum(['inside', 'outside']).nullable(),
  }),
  disabled: z.boolean().default(true),
  sensorInfo: z.string().optional(),
});

const UpdateDeviceSchema = z.object({
  order: z.number().optional(),
  name: z.string().optional(),
  type: z.enum(['ruuvi', 'sensorbug']).optional(),
  location: z.object({
    x: z.number(),
    y: z.number(),
    type: z.enum(['inside', 'outside']).nullable(),
  }).optional(),
  disabled: z.boolean().optional(),
  sensorInfo: z.string().optional(),
});

/**
 * GET /api/devices
 * Get all devices with pagination
 */
export async function getAllDevicesHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Parse query parameters
    const query = GetAllDevicesSchema.parse(event.queryStringParameters || {});

    const result = await getAllDevices(query);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request', details: error.errors }),
      };
    }

    console.error('Get all devices error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * GET /api/devices/{id}
 * Get a single device by ID
 */
export async function getDeviceHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const deviceId = event.pathParameters?.id;
    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Device ID is required' }),
      };
    }

    const device = await getDevice(deviceId);

    return {
      statusCode: 200,
      body: JSON.stringify(device),
    };
  } catch (error) {
    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Get device error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * POST /api/devices
 * Create a new device
 */
export async function addDeviceHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const deviceData = AddDeviceSchema.parse(body);

    const device = await addDevice(deviceData);

    return {
      statusCode: 201,
      body: JSON.stringify(device),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request', details: error.errors }),
      };
    }

    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Add device error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * PUT /api/devices/{id}
 * Update an existing device
 */
export async function updateDeviceHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    const deviceId = event.pathParameters?.id;
    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Device ID is required' }),
      };
    }

    // Parse and validate request body
    const body = JSON.parse(event.body || '{}');
    const updates = UpdateDeviceSchema.parse(body);

    const device = await updateDevice(deviceId, updates);

    return {
      statusCode: 200,
      body: JSON.stringify(device),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request', details: error.errors }),
      };
    }

    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Update device error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
