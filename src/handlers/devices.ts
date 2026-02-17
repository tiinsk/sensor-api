/**
 * Device route handlers for lambda-api
 */

import { Request, Response } from 'lambda-api';
import { z } from 'zod';
import { getAllDevices, getDevice, addDevice, updateDevice, deleteDevice } from '../data/devices';
import { isHttpError } from '../lib/errors';

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
export async function getAllDevicesHandler(req: Request, res: Response) {
  try {
    // Parse and validate query parameters
    const queryParams = GetAllDevicesSchema.parse({
      limit: req.query.limit,
      offset: req.query.offset,
      includeDisabled: req.query.includeDisabled,
    });

    const devices = await getAllDevices({
      limit: queryParams.limit,
      offset: queryParams.offset,
      includeDisabled: queryParams.includeDisabled,
    });

    return res.json(devices);
  } catch (error) {
    console.error('Get all devices error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/devices/:id
 * Delete a device and all its readings
 */
export async function deleteDeviceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    await deleteDevice(id);
    return res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/devices/:id
 * Get a single device by ID
 */
export async function getDeviceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const device = await getDevice(id);
    return res.json(device);
  } catch (error) {
    console.error('Get device error:', error);
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/devices
 * Add a new device
 */
export async function addDeviceHandler(req: Request, res: Response) {
  try {
    const deviceData = AddDeviceSchema.parse(req.body);
    const device = await addDevice(deviceData);
    return res.status(201).json(device);
  } catch (error) {
    console.error('Add device error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid device data', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PATCH /api/devices/:id
 * Update an existing device
 */
export async function updateDeviceHandler(req: Request, res: Response) {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const updateData = UpdateDeviceSchema.parse(req.body);
    const device = await updateDevice(id, updateData);
    return res.json(device);
  } catch (error) {
    console.error('Update device error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.errors });
    }
    if (isHttpError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
