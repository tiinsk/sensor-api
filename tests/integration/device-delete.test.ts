/**
 * Integration tests for DELETE /api/devices/:id
 * Tests device deletion operations against new API
 */

import { getApiUrl } from './utils/test-config';
import { getAuthHeaders, RequestHeaders } from './utils/auth-utils';
import { generateTestDeviceId, deleteTestDevices } from '../utils/device-helpers';
import type { Device, DeviceListResponse, DeleteResponse } from './utils/types';

describe('DELETE /api/devices/:id - Integration', () => {
  const API_URL = getApiUrl();
  let headers: RequestHeaders;
  const createdDeviceIds: string[] = [];

  beforeAll(async () => {
    headers = await getAuthHeaders();
  });

  afterEach(async () => {
    // Clean up any devices created during tests
    await deleteTestDevices(createdDeviceIds, headers);
    createdDeviceIds.length = 0;
  });

  describe('Successful deletion', () => {
    it('should successfully delete a device', async () => {
      // Create test device
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Device To Delete',
          type: 'ruuvi',
          order: 9999,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // Delete device
      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as DeleteResponse;
      expect(data.message).toBeTruthy();

      // Verify device is gone
      const getResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        headers,
      });

      expect(getResponse.status).toBe(404);
    });

    it('should remove device from device list after deletion', async () => {
      // Create test device
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Listed Device',
          type: 'ruuvi',
          order: 9998,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // Verify device is in list
      const listBefore = await fetch(`${API_URL}/api/devices?includeDisabled=true`, {
        headers,
      });
      const listDataBefore = (await listBefore.json()) as DeviceListResponse;
      const deviceBefore = listDataBefore.values.find((d) => d.id === testDeviceId);
      expect(deviceBefore).toBeDefined();

      // Delete device
      await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });

      // Verify device is removed from list
      const listAfter = await fetch(`${API_URL}/api/devices?includeDisabled=true`, {
        headers,
      });
      const listDataAfter = (await listAfter.json()) as DeviceListResponse;
      const deviceAfter = listDataAfter.values.find((d) => d.id === testDeviceId);
      expect(deviceAfter).toBeUndefined();
    });
  });

  describe('CASCADE deletion of readings', () => {
    it('should CASCADE delete all device readings', async () => {
      // Create test device
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Device With Readings',
          type: 'ruuvi',
          order: 9997,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // Add some readings to the device
      const reading = {
        temperature: 20.5,
        humidity: 45.0,
        pressure: 1013.0,
      };

      await fetch(`${API_URL}/api/devices/${testDeviceId}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(reading),
      });

      // Verify readings exist
      const latestBefore = await fetch(`${API_URL}/api/devices/${testDeviceId}/latest`, {
        headers,
      });
      expect(latestBefore.status).toBe(200);

      // Delete device (should CASCADE delete readings)
      const deleteResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });

      expect(deleteResponse.status).toBe(200);

      // Verify readings are gone
      const latestAfter = await fetch(`${API_URL}/api/devices/${testDeviceId}/latest`, {
        headers,
      });
      expect(latestAfter.status).toBe(404);
    });

    it('should not affect other devices when deleting one with readings', async () => {
      // Create two test devices
      const testDeviceId1 = generateTestDeviceId();
      const testDeviceId2 = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId1,
          name: 'Device 1',
          type: 'ruuvi',
          order: 9996,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId2,
          name: 'Device 2',
          type: 'ruuvi',
          order: 9995,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId1, testDeviceId2);

      // Add readings to both devices
      await fetch(`${API_URL}/api/devices/${testDeviceId1}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ temperature: 20.0, humidity: 40.0 }),
      });

      await fetch(`${API_URL}/api/devices/${testDeviceId2}/readings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ temperature: 25.0, humidity: 50.0 }),
      });

      // Delete device 1
      await fetch(`${API_URL}/api/devices/${testDeviceId1}`, {
        method: 'DELETE',
        headers,
      });

      // Verify device 2 still exists with its readings
      const device2Response = await fetch(`${API_URL}/api/devices/${testDeviceId2}`, {
        headers,
      });

      expect(device2Response.status).toBe(200);

      const device2Latest = await fetch(`${API_URL}/api/devices/${testDeviceId2}/latest`, {
        headers,
      });
      expect(device2Latest.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should return 404 when deleting non-existent device', async () => {
      const nonExistentId = 'device-99999';

      const response = await fetch(`${API_URL}/api/devices/${nonExistentId}`, {
        method: 'DELETE',
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 404 when deleting already deleted device', async () => {
      // Create and delete device
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Temporary Device',
          type: 'ruuvi',
          order: 9994,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // First deletion should succeed
      const firstDelete = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });
      expect(firstDelete.status).toBe(200);

      // Second deletion should return 404
      const secondDelete = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });
      expect(secondDelete.status).toBe(404);
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const testDeviceId = generateTestDeviceId();

      // Create device first
      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Auth Test Device',
          type: 'ruuvi',
          order: 9993,
          disabled: false,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // Try to delete without auth
      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.status).toBe(401);

      // Verify device still exists
      const getResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        headers,
      });
      expect(getResponse.status).toBe(200);
    });
  });

  describe('Disabled devices', () => {
    it('should successfully delete disabled device', async () => {
      // Create disabled device
      const testDeviceId = generateTestDeviceId();

      await fetch(`${API_URL}/api/devices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: testDeviceId,
          name: 'Disabled Device',
          type: 'ruuvi',
          order: 9992,
          disabled: true,
          location: { x: 0, y: 0, type: null },
        }),
      });

      createdDeviceIds.push(testDeviceId);

      // Delete disabled device
      const response = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        method: 'DELETE',
        headers,
      });

      expect(response.status).toBe(200);

      // Verify device is gone (even with includeDisabled)
      const getResponse = await fetch(`${API_URL}/api/devices/${testDeviceId}`, {
        headers,
      });
      expect(getResponse.status).toBe(404);
    });
  });
});
