/**
 * Readings route handlers
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getDeviceReadings, getAllReadings, addDeviceReading } from '../data/readings';
import { requireAuth, AuthContext } from '../lib/auth-middleware';
import { isHttpError } from '../lib/errors';

const GetDeviceReadingsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.enum(['temperature', 'humidity', 'pressure', 'battery']),
  level: z.enum(['10 minutes', '30 minutes', 'day', 'week', 'month']),
});

const GetAllReadingsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.enum(['temperature', 'humidity', 'pressure', 'battery']),
  level: z.enum(['10 minutes', '30 minutes', 'day', 'week', 'month']),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const AddReadingSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  battery: z.number().optional(),
});

/**
 * GET /api/devices/{id}/readings
 * Get readings for a specific device
 */
export async function getDeviceReadingsHandler(
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

    // Parse query parameters
    const query = GetDeviceReadingsSchema.parse(event.queryStringParameters || {});

    const result = await getDeviceReadings({
      deviceId,
      startTime: query.startTime,
      endTime: query.endTime,
      types: [query.type], // Convert single type to array
      level: query.level,
    });

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

    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Get device readings error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * GET /api/readings
 * Get readings for all devices
 */
export async function getAllReadingsHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Parse query parameters
    const query = GetAllReadingsSchema.parse(event.queryStringParameters || {});

    const result = await getAllReadings({
      startTime: query.startTime,
      endTime: query.endTime,
      type: query.type,
      level: query.level,
      limit: query.limit,
      offset: query.offset,
    });

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

    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Get all readings error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * POST /api/devices/{id}/readings
 * Add a new reading for a device
 */
export async function addDeviceReadingHandler(
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
    const payload = AddReadingSchema.parse(body);

    const reading = await addDeviceReading({
      id: deviceId,
      payload,
    });

    return {
      statusCode: 201,
      body: JSON.stringify(reading),
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

    console.error('Add device reading error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
