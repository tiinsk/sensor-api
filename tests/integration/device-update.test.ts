/**
 * Integration tests for PUT /api/devices/:id
 * Tests device update operations against new API
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';
import type { Device } from './utils/types';

describe('PUT /api/devices/:id - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;
  let testDeviceId: string;
  const createdDeviceIds: string[] = [];

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  beforeEach(async () => {
    // Create a fresh test device for each test
    testDeviceId = generateTestDeviceId();

    await fetch(`${API_URL}/api/devices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: testDeviceId,
        name: 'Original Device',
        type: 'ruuvi',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      }),
    });

    createdDeviceIds.push(testDeviceId);
  });

  afterEach(async () => {
    // Clean up any devices created during tests
    await deleteTestDevices(createdDeviceIds, headers);
    createdDeviceIds.length = 0;
  });

  describe('Successful updates', () => {
    it('should update device with complete replacement', async () => {
      const updates = {
        name: 'Fully Updated Device',
        order: 9997,
        type: 'sensorbug' as const,
        disabled: true,
        location: {
          x: 50,
          y: 75,
          type: 'inside' as const,
        },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as Device;

      expect(data.id).toBe(testDeviceId);
      expect(data.name).toBe(updates.name);
      expect(data.order).toBe(updates.order);
      expect(data.type).toBe(updates.type);
      expect(data.disabled).toBe(updates.disabled);
      expect(data.location.x).toBe(updates.location.x);
      expect(data.location.y).toBe(updates.location.y);
      expect(data.location.type).toBe(updates.location.type);
    });
  });

  describe('Validation errors', () => {
    it('should return 400 for partial update (missing required fields)', async () => {
      const partialUpdate = {
        name: 'Only Name Changed',
        // Missing: type, order, location, disabled
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(partialUpdate),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for missing name', async () => {
      const invalidUpdate = {
        // Missing: name
        type: 'ruuvi',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(invalidUpdate),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid device type', async () => {
      const invalidUpdate = {
        name: 'Test Device',
        type: 'invalid-type',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(invalidUpdate),
      });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid location type', async () => {
      const invalidUpdate = {
        name: 'Test Device',
        type: 'ruuvi',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: 'invalid' },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(invalidUpdate),
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Conflict errors', () => {
    it('should return 409 for duplicate order', async () => {
      // Create second device with different order
      const deviceId2 = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: deviceId2,
          name: 'Second Device',
          type: 'sensorbug',
          order: 9996,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(deviceId2);

      // Try to update first device to use second device's order
      const updates = {
        name: 'Original Device',
        type: 'ruuvi' as const,
        order: 9996, // Conflicts with deviceId2
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(409);
    });

    it('should allow updating device with its own order (no conflict)', async () => {
      // Update device but keep same order
      const updates = {
        name: 'Updated Name',
        type: 'ruuvi' as const,
        order: 9999, // Same order as original
        disabled: false,
        location: { x: 10, y: 20, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Not found errors', () => {
    it('should return 404 for non-existent device', async () => {
      const nonExistentId = 'device-99999';
      const updates = {
        name: 'Should Not Work',
        type: 'ruuvi' as const,
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${nonExistentId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const updates = {
        name: 'Test',
        type: 'ruuvi' as const,
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };

      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('Updated device verification', () => {
    it('should persist updates after retrieval', async () => {
      const updates = {
        name: 'Persistent Update',
        type: 'sensorbug' as const,
        order: 9995,
        disabled: false,
        location: { x: 123, y: 456, type: 'outside' as const },
      };

      // Update device
      await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });

      // Retrieve device
      const getResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        headers,
      });

      const device = (await getResponse.json()) as Device;

      expect(device.name).toBe('Persistent Update');
      expect(device.type).toBe('sensorbug');
      expect(device.order).toBe(9995);
      expect(device.disabled).toBe(false);
      expect(device.location).toEqual({ x: 123, y: 456, type: 'outside' });
    });

    it('should preserve latestReadingId when updating device', async () => {
      // Add a reading so the device gets latestReadingId set
      const readingTimestamp = new Date().toISOString();
      const addReadingRes = await fetch(`${API_URL}/api/devices/${testDeviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          temperature: 21.5,
          humidity: 60,
          timestamp: readingTimestamp,
        }),
      });
      expect(addReadingRes.status).toBe(201);

      // Get device and confirm latestReadingId is set
      const getBeforeRes = await fetch(`${API_URL}/api/devices/${testDeviceId}`, { headers });
      expect(getBeforeRes.status).toBe(200);
      const deviceBefore = (await getBeforeRes.json()) as Device;
      expect(deviceBefore.latestReadingId).toBe(readingTimestamp);

      // Update device (e.g. name only) without touching latestReadingId
      const updates = {
        name: 'Updated Name',
        type: 'ruuvi' as const,
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      };
      const updateRes = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updates),
      });
      expect(updateRes.status).toBe(200);

      // Get device again and assert latestReadingId was preserved
      const getAfterRes = await fetch(`${API_URL}/api/devices/${testDeviceId}`, { headers });
      expect(getAfterRes.status).toBe(200);
      const deviceAfter = (await getAfterRes.json()) as Device;
      expect(deviceAfter.name).toBe('Updated Name');
      expect(deviceAfter.latestReadingId).toBe(readingTimestamp);
    });
  });
});
