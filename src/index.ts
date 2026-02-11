/**
 * Main Lambda handler using lambda-api for routing
 */

import createAPI, { Request, Response } from 'lambda-api';
import { APIGatewayProxyEvent, APIGatewayProxyResultV2, Context } from 'aws-lambda';

// Device handlers (refactored for lambda-api)
import {
  getAllDevicesHandler,
  getDeviceHandler,
  addDeviceHandler,
  updateDeviceHandler,
} from './handlers/devices';

// Auth middleware
import { requireAuth } from './lib/auth-middleware';

// TODO: Import and refactor these handlers for lambda-api
// import { login } from './handlers/auth';
// import { getDeviceReadingsHandler, getAllReadingsHandler, addDeviceReadingHandler } from './handlers/readings';
// import { getAllLatestHandler, getDeviceLatestHandler } from './handlers/latest';
// import { getAllStatisticsHandler, getDeviceStatisticsHandler } from './handlers/statistics';

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
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    headers: 'Content-Type, Authorization',
  });
  next();
});

// Error handler middleware
api.use((err: any, req: Request, res: Response, next: () => void) => {
  console.error('API Error:', err);

  // Lambda-api wraps the original event in req.event
  const statusCode = (err as any).statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
});

// Helper to send result from handlers
function sendResult(res: Response, result: APIGatewayProxyResultV2) {
  if (typeof result === 'string') {
    return res.send(result);
  }

  return res.status(result.statusCode || 200).send(result.body || '');
}

// Root
api.get('/', async (req: Request, res: Response) => {
  return { message: 'Sensor API' };
});

// Auth routes
// TODO: Refactor login handler for lambda-api
api.post('/api/login', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

// Device routes
api.get('/api/devices', requireAuth, getAllDevicesHandler);
api.get('/api/devices/:id', requireAuth, getDeviceHandler);
api.post('/api/devices', requireAuth, addDeviceHandler);
api.patch('/api/devices/:id', requireAuth, updateDeviceHandler);

// Reading routes
// TODO: Refactor reading handlers for lambda-api
api.get('/api/devices/:id/readings', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

api.get('/api/readings', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

api.post('/api/devices/:id/readings', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

// Latest readings routes
// TODO: Refactor latest handlers for lambda-api
api.get('/api/latest', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

api.get('/api/devices/:id/latest', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

// Statistics routes
// TODO: Refactor statistics handlers for lambda-api
api.get('/api/statistics', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

api.get('/api/devices/:id/statistics', async (req: Request, res: Response) => {
  res.status(501).json({ error: 'Not yet implemented - needs refactoring for lambda-api' });
});

// Export Lambda handler
export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  return await api.run(event, context);
};
