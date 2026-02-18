/**
 * Statistics route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getAllStatistics, getDeviceStatistics } from '../data/statistics';
import { isHttpError } from '../lib/errors';

const GetAllStatisticsSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return start <= end;
    },
    {
      message: 'startTime must be before or equal to endTime',
      path: ['startTime'],
    }
  );

const GetDeviceStatisticsSchema = z
  .object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      return start <= end;
    },
    {
      message: 'startTime must be before or equal to endTime',
      path: ['startTime'],
    }
  );

/**
 * GET /api/statistics
 * Get statistics for all devices
 */
export async function getAllStatisticsHandler(req: Request, res: Response) {
  try {
    // Parse query parameters
    const query = GetAllStatisticsSchema.parse(req.query);

    const result = await getAllStatistics(query);

    return res.json(result);
  } catch (error) {
    console.error('Get all statistics error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/devices/:id/statistics
 * Get statistics for a specific device
 */
export async function getDeviceStatisticsHandler(req: Request, res: Response) {
  try {
    const deviceId = req.params.id;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Parse query parameters
    const query = GetDeviceStatisticsSchema.parse(req.query);

    const result = await getDeviceStatistics({
      deviceId,
      ...query,
    });

    return res.json(result);
  } catch (error) {
    console.error('Get device statistics error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
