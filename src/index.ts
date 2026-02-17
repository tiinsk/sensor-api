/**
 * Main Lambda handler using lambda-api for routing
 */

import createAPI, { Request, Response } from 'lambda-api';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Auth handlers
import { login } from './handlers/auth';

// Device handlers
import {
  getAllDevicesHandler,
  getDeviceHandler,
  addDeviceHandler,
  updateDeviceHandler,
  deleteDeviceHandler,
} from './handlers/devices';

// Reading handlers
import {
  getDeviceReadingsHandler,
  getAllReadingsHandler,
  addDeviceReadingHandler,
} from './handlers/readings';

// Latest readings handlers
import {
  getAllLatestHandler,
  getDeviceLatestHandler,
} from './handlers/latest';

// Statistics handlers
import {
  getAllStatisticsHandler,
  getDeviceStatisticsHandler,
} from './handlers/statistics';

// Auth middleware
import { requireAuth } from './lib/auth-middleware';

// Create API instance with options
const api = createAPI({
  version: 'v1.0',
  logger: {
    level: 'info',
    access: true,
  },
});

// CORS middleware
api.use((req: Request, res: Response, next: () => void) => {
  res.cors({
    origin: '*',
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    headers: 'Content-Type, Authorization',
  });
  next();
});

// Error handler middleware
api.use((err: any, req: Request, res: Response, next: () => void) => {
  console.error('API Error:', err);
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(statusCode).json({ error: message });
});

// Root
api.get('/', async (req: Request, res: Response) => {
  return { message: 'Sensor API' };
});

// Auth routes
api.post('/api/login', login);

// Device routes
api.get('/api/devices', requireAuth, getAllDevicesHandler);
api.get('/api/devices/:id', requireAuth, getDeviceHandler);
api.post('/api/devices', requireAuth, addDeviceHandler);
api.patch('/api/devices/:id', requireAuth, updateDeviceHandler);
api.delete('/api/devices/:id', requireAuth, deleteDeviceHandler);

// Reading routes
api.get('/api/devices/:id/readings', requireAuth, getDeviceReadingsHandler);
api.get('/api/readings', requireAuth, getAllReadingsHandler);
api.post('/api/devices/:id/readings', requireAuth, addDeviceReadingHandler);

// Latest readings routes
api.get('/api/latest', requireAuth, getAllLatestHandler);
api.get('/api/devices/:id/latest', requireAuth, getDeviceLatestHandler);

// Statistics routes
api.get('/api/statistics', requireAuth, getAllStatisticsHandler);
api.get('/api/devices/:id/statistics', requireAuth, getDeviceStatisticsHandler);

// Export Lambda handler
export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  return await api.run(event, context);
};
