/**
 * Latest readings route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getAllLatestReadings, getDeviceLatestReading } from '../data/latest-readings';
import { isHttpError } from '../lib/errors';

const GetAllLatestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/latest
 * Get latest readings for all devices
 */
export async function getAllLatestHandler(req: Request, res: Response) {
  try {
    // Parse query parameters
    const query = GetAllLatestSchema.parse(req.query);

    const result = await getAllLatestReadings(query);

    return res.json(result);
  } catch (error) {
    console.error('Get all latest readings error:', error);
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
 * GET /api/devices/:id/latest
 * Get latest reading for a specific device
 */
export async function getDeviceLatestHandler(req: Request, res: Response) {
  try {
    const deviceId = req.params.id;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const result = await getDeviceLatestReading(deviceId);

    return res.json(result);
  } catch (error) {
    console.error('Get device latest reading error:', error);
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
