/**
 * Statistics route handlers
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { getAllStatistics, getDeviceStatistics } from '../data/statistics';
import { requireAuth } from '../lib/auth-middleware';
import { isHttpError } from '../lib/errors';

const GetAllStatisticsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const GetDeviceStatisticsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

/**
 * GET /api/statistics
 * Get statistics for all devices
 */
export async function getAllStatisticsHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Require authentication
    const authResult = await requireAuth(event);
    if ('statusCode' in authResult) {
      return authResult;
    }

    // Parse query parameters
    const query = GetAllStatisticsSchema.parse(event.queryStringParameters || {});

    const result = await getAllStatistics(query);

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

    console.error('Get all statistics error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * GET /api/devices/{id}/statistics
 * Get statistics for a specific device
 */
export async function getDeviceStatisticsHandler(
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
    const query = GetDeviceStatisticsSchema.parse(event.queryStringParameters || {});

    const result = await getDeviceStatistics({
      deviceId,
      ...query,
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

    console.error('Get device statistics error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
