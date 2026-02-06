/**
 * Latest readings route handlers
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getAllLatestReadings, getDeviceLatestReading } from '../data/latest-readings';
import { requireAuth } from '../lib/auth-middleware';
import { isHttpError } from '../lib/errors';

const GetAllLatestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/latest
 * Get latest readings for all devices
 */
export async function getAllLatestHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Parse query parameters
    const query = GetAllLatestSchema.parse(event.queryStringParameters || {});

    const result = await getAllLatestReadings(query);

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

    console.error('Get all latest readings error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * GET /api/devices/{id}/latest
 * Get latest reading for a specific device
 */
export async function getDeviceLatestHandler(
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

    const result = await getDeviceLatestReading(deviceId);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (isHttpError(error)) {
      return {
        statusCode: error.statusCode,
        body: JSON.stringify({ error: error.message }),
      };
    }

    console.error('Get device latest reading error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
