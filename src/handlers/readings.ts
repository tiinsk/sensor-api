/**
 * Readings route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getDeviceReadings, getAllReadings, addDeviceReading } from '../data/readings';
import { isHttpError } from '../lib/errors';

const GetDeviceReadingsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  types: z
    .string()
    .transform((str) => str.split(',').map((t) => t.trim()))
    .pipe(z.array(z.enum(['temperature', 'humidity', 'pressure', 'battery']))),
  level: z.enum(['30 minutes', 'day', 'week', 'month']),
  timezone: z.string().optional(), // IANA timezone (e.g., 'Europe/Helsinki'), defaults to UTC
});

const GetAllReadingsSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  type: z.enum(['temperature', 'humidity', 'pressure', 'battery']),
  level: z.enum(['30 minutes', 'day', 'week', 'month']),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  timezone: z.string().optional(), // IANA timezone (e.g., 'Europe/Helsinki'), defaults to UTC
});

const AddReadingSchema = z.object({
  temperature: z.number().optional(),
  humidity: z.number().optional(),
  pressure: z.number().optional(),
  battery: z.number().optional(),
});

/**
 * GET /api/devices/:id/readings
 * Get readings for a specific device
 */
export async function getDeviceReadingsHandler(req: Request, res: Response) {
  try {
    const deviceId = req.params.id;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Parse and validate query parameters
    const query = GetDeviceReadingsSchema.parse(req.query);

    const result = await getDeviceReadings({
      deviceId,
      startTime: query.startTime,
      endTime: query.endTime,
      types: query.types,
      level: query.level,
      timezone: query.timezone,
    });

    return res.json(result);
  } catch (error) {
    console.error('Get device readings error:', error);
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
 * GET /api/readings
 * Get readings for all devices
 */
export async function getAllReadingsHandler(req: Request, res: Response) {
  try {
    // Parse query parameters
    const query = GetAllReadingsSchema.parse(req.query);

    const result = await getAllReadings({
      startTime: query.startTime,
      endTime: query.endTime,
      type: query.type,
      level: query.level,
      limit: query.limit,
      offset: query.offset,
      timezone: query.timezone,
    });

    return res.json(result);
  } catch (error) {
    console.error('Get all readings error:', error);
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
 * POST /api/devices/:id/readings
 * Add a new reading for a device
 */
export async function addDeviceReadingHandler(req: Request, res: Response) {
  try {
    const deviceId = req.params.id;
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    // Parse and validate request body
    const payload = AddReadingSchema.parse(req.body);

    const reading = await addDeviceReading({
      id: deviceId,
      payload,
    });

    return res.status(201).json(reading);
  } catch (error) {
    console.error('Add device reading error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
