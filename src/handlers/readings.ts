/**
 * Readings route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getDeviceReadings, getAllReadings, addDeviceReading } from '../data/readings';
import { isHttpError } from '../lib/errors';
import { sensorTypes } from '../api-types';

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: 'Expected date in YYYY-MM-DD format',
});

const TypesParamSchema = z
  .string()
  .transform((str) => str.split(',').map((t) => t.trim()))
  .pipe(
    z.array(z.enum(sensorTypes))
  );

const TimeRangeShape = {
  level: z.literal('30 minutes'),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
};

const DateRangeShape = {
  level: z.enum(['day', 'week', 'month']),
  startDate: DateStringSchema,
  endDate: DateStringSchema,
};

const isValidTimeRange = (data: { startTime: string; endTime: string }): boolean => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return start <= end;
};

const isValidDateRange = (data: { startDate: string; endDate: string }): boolean =>
  data.startDate <= data.endDate;

const timeRangeError = {
  message: 'startTime must be before or equal to endTime',
  path: ['startTime'],
};

const dateRangeError = {
  message: 'startDate must be before or equal to endDate',
  path: ['startDate'],
};

const GetDeviceReadingsSchema = z.union([
  z
    .object({
      ...TimeRangeShape,
      types: TypesParamSchema,
    })
    .strict()
    .refine(isValidTimeRange, timeRangeError),
  z
    .object({
      ...DateRangeShape,
      types: TypesParamSchema,
    })
    .strict()
    .refine(isValidDateRange, dateRangeError),
]);

const GetAllReadingsSchema = z.union([
  z
    .object({
      ...TimeRangeShape,
      type: z.enum(sensorTypes),
      limit: z.coerce.number().int().min(1).max(100).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .strict()
    .refine(isValidTimeRange, timeRangeError),
  z
    .object({
      ...DateRangeShape,
      type: z.enum(sensorTypes),
      limit: z.coerce.number().int().min(1).max(100).default(100),
      offset: z.coerce.number().int().min(0).default(0),
    })
    .strict()
    .refine(isValidDateRange, dateRangeError),
]);

type ParsedReadingRangeQuery =
  | { level: '30 minutes'; startTime: string; endTime: string }
  | { level: 'day' | 'week' | 'month'; startDate: string; endDate: string };

const toLegacyTimeRange = (
  query: ParsedReadingRangeQuery
): { startTime: string; endTime: string } => {
  if (query.level === '30 minutes') {
    return {
      startTime: query.startTime,
      endTime: query.endTime,
    };
  }

  return {
    startTime: `${query.startDate}T00:00:00.000Z`,
    endTime: `${query.endDate}T23:59:59.999Z`,
  };
};

const AddReadingSchema = z
  .object({
    temperature: z.number().optional(),
    humidity: z.number().optional(),
    pressure: z.number().optional(),
    battery: z.number().optional(),
    pm25: z.number().optional(),
    co2: z.number().optional(),
    voc: z.number().optional(),
    nox: z.number().optional(),
    timestamp: z.string().datetime().optional(),
  })
  .refine(
    (data) => {
      if (!data.timestamp) return true; // If no timestamp, it's valid
      const providedTime = new Date(data.timestamp).getTime();
      const now = Date.now();
      return providedTime <= now;
    },
    {
      message: 'Timestamp cannot be in the future',
      path: ['timestamp'],
    }
  );

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

    //TODO: remove this next
    const range = toLegacyTimeRange(query);

    const result = await getDeviceReadings({
      deviceId,
      startTime: range.startTime,
      endTime: range.endTime,
      types: query.types,
      level: query.level,
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

    //TODO: remove this next
    const range = toLegacyTimeRange(query);

    const result = await getAllReadings({
      startTime: range.startTime,
      endTime: range.endTime,
      type: query.type,
      level: query.level,
      limit: query.limit,
      offset: query.offset,
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
