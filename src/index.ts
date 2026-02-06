/**
 * Main Lambda handler using lambda-api for routing
 */

import createAPI, { Request, Response } from 'lambda-api';
import {APIGatewayProxyEvent, APIGatewayProxyResultV2, Context} from 'aws-lambda';
import 'dotenv/config';

// Auth handlers
import { login } from './handlers/auth';

// Device handlers
import {
  getAllDevicesHandler,
  getDeviceHandler,
  addDeviceHandler,
  updateDeviceHandler,
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
api.post('/api/login', async (req: Request, res: Response) => {
  const result = await login(req.event);
  sendResult(res, result);
});

// Device routes
api.get('/api/devices', async (req: Request, res: Response) => {
  const result = await getAllDevicesHandler(req.event);
  sendResult(res, result);
});

api.get('/api/devices/:id', async (req: Request, res: Response) => {
  const result = await getDeviceHandler(req.event);
  sendResult(res, result);
});

api.post('/api/devices', async (req: Request, res: Response) => {
  const result = await addDeviceHandler(req.event);
  sendResult(res, result);
});

api.put('/api/devices/:id', async (req: Request, res: Response) => {
  const result = await updateDeviceHandler(req.event);
  sendResult(res, result);
});

// Reading routes
api.get('/api/devices/:id/readings', async (req: Request, res: Response) => {
  const result = await getDeviceReadingsHandler(req.event);
  sendResult(res, result);
});

api.get('/api/readings', async (req: Request, res: Response) => {
  const result = await getAllReadingsHandler(req.event);
  sendResult(res, result);
});

api.post('/api/devices/:id/readings', async (req: Request, res: Response) => {
  const result = await addDeviceReadingHandler(req.event);
  sendResult(res, result);
});

// Latest readings routes
api.get('/api/latest', async (req: Request, res: Response) => {
  const result = await getAllLatestHandler(req.event);
  sendResult(res, result);
});

api.get('/api/devices/:id/latest', async (req: Request, res: Response) => {
  const result = await getDeviceLatestHandler(req.event);
  sendResult(res, result);
});

// Statistics routes
api.get('/api/statistics', async (req: Request, res: Response) => {
  const result = await getAllStatisticsHandler(req.event);
  sendResult(res, result);
});

api.get('/api/devices/:id/statistics', async (req: Request, res: Response) => {
  const result = await getDeviceStatisticsHandler(req.event);
  sendResult(res, result);
});

// Export Lambda handler
export const handler = async (event: APIGatewayProxyEvent, context: Context) => {
  return await api.run(event, context);
};
