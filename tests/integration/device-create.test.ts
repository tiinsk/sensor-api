/**
 * Integration tests for POST /api/devices
 * Tests device creation against new API
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';
import type { Device } from './utils/types';

describe('POST /api/devices - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;
  let testDeviceId: string;
  const createdDeviceIds: string[] = [];

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  beforeEach(() => {
    testDeviceId = generateTestDeviceId();
  });

  afterEach(async () => {
    // Clean up any devices created during tests
    await deleteTestDevices(createdDeviceIds, headers);
    createdDeviceIds.length = 0;
  });

  describe('Valid device creation', () => {
    it('should create a new device with all fields', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Test Sensor',
        location: { x: 150, y: 250, type: 'inside' as const },
        type: 'ruuvi' as const,
        disabled: false,
        order: 100,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Device;

      expect(data.id).toBe(testDeviceId);
      expect(data.name).toBe('Test Sensor');
      expect(data.location).toEqual({ x: 150, y: 250, type: 'inside' });
      expect(data.type).toBe('ruuvi');
      expect(data.disabled).toBe(false);
      expect(data.order).toBe(100);
      expect(data.timezone).toBe('Europe/Helsinki');

      createdDeviceIds.push(testDeviceId);
    });

    it('should create device with location type "outside"', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Outdoor Sensor',
        location: { x: 300, y: 400, type: 'outside' as const },
        type: 'ruuvi' as const,
        disabled: false,
        order: 101,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Device;

      expect(data.location.type).toBe('outside');

      createdDeviceIds.push(testDeviceId);
    });

    it('should create device with location type null', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Unknown Location Sensor',
        location: { x: 0, y: 0, type: null },
        type: 'ruuvi' as const,
        disabled: false,
        order: 102,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Device;

      expect(data.location.type).toBeNull();

      createdDeviceIds.push(testDeviceId);
    });

    it('should create device with type "sensorbug"', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Sensorbug Device',
        location: { x: 100, y: 100, type: null },
        type: 'sensorbug' as const,
        disabled: false,
        order: 103,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Device;

      expect(data.type).toBe('sensorbug');

      createdDeviceIds.push(testDeviceId);
    });

    it('should create device with disabled=true', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Disabled Sensor',
        location: { x: 50, y: 50, type: null },
        type: 'ruuvi' as const,
        disabled: true,
        order: 104,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(201);

      const data = (await response.json()) as Device;

      expect(data.disabled).toBe(true);

      createdDeviceIds.push(testDeviceId);
    });
  });

  describe('Duplicate detection', () => {
    it('should return 409 for duplicate device id', async () => {
      const device = {
        id: testDeviceId,
        name: 'Duplicate ID Test',
        type: 'ruuvi',
        order: 9995,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response1 = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(device),
      });

      expect(response1.status).toBe(201);
      createdDeviceIds.push(testDeviceId);

      const response2 = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(device),
      });

      expect(response2.status).toBe(409);
      const data = (await response2.json()) as { error: string };
      expect(data).toHaveProperty('error');
    });

    it('should return 409 for duplicate order', async () => {
      const device = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: null },
        type: 'ruuvi' as const,
        disabled: false,
        order: 1, // Already used by device-001
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(device),
      });

      expect(response.status).toBe(409);

      const data = (await response.json()) as { error: string };
      expect(data).toHaveProperty('error');
    });
  });

  describe('Validation errors', () => {
    it('should reject device with invalid ID length (not 12 chars)', async () => {
      const invalidDevice = {
        id: 'short', // Only 5 characters, must be 12
        name: 'Invalid ID Device',
        location: { x: 100, y: 100, type: null },
        type: 'ruuvi' as const,
        disabled: false,
        order: 105,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        // Missing: location, type, disabled, order
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid device type', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: null },
        type: 'invalid-type', // Invalid type
        disabled: false,
        order: 105,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid location type', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: 'invalid' }, // Invalid location type
        type: 'ruuvi',
        disabled: false,
        order: 106,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing location fields', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100 }, // Missing y and type
        type: 'ruuvi',
        disabled: false,
        order: 107,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid disabled value', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: null },
        type: 'ruuvi',
        disabled: 'not-boolean', // Invalid boolean
        order: 108,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid order (non-number)', async () => {
      const invalidDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: null },
        type: 'ruuvi',
        disabled: false,
        order: 'not-a-number', // Invalid order
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invalidDevice),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Test Device',
        location: { x: 100, y: 100, type: null },
        type: 'ruuvi',
        disabled: false,
        order: 109,
      };

      const response = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newDevice),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Created device verification', () => {
    it('should be retrievable after creation', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Verifiable Sensor',
        location: { x: 500, y: 600, type: 'inside' as const },
        type: 'ruuvi' as const,
        disabled: false,
        order: 110,
      };

      // Create device
      const createResponse = await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      expect(createResponse.status).toBe(201);

      createdDeviceIds.push(testDeviceId);

      // Retrieve device
      const getResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        headers,
      });

      expect(getResponse.status).toBe(200);

      const data = (await getResponse.json()) as Device;

      expect(data.id).toBe(testDeviceId);
      expect(data.name).toBe('Verifiable Sensor');
    });

    it('should appear in device list after creation', async () => {
      const newDevice = {
        id: testDeviceId,
        name: 'Listed Sensor',
        location: { x: 700, y: 800, type: null },
        type: 'ruuvi' as const,
        disabled: false,
        order: 111,
      };

      // Create device
      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(newDevice),
      });

      createdDeviceIds.push(testDeviceId);

      // Get device list
      const listResponse = await fetch(`${API_URL}/api/devices`, {
        headers,
      });

      const listData = (await listResponse.json()) as { values: Device[] };

      const foundDevice = listData.values.find((d) => d.id === testDeviceId);
      expect(foundDevice).toBeDefined();
      expect(foundDevice?.name).toBe('Listed Sensor');
    });
  });
});
