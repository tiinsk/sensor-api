/**
 * Compatibility tests for DELETE /api/devices/:id endpoint
 * Compare old API (Hapi.js + PostgreSQL) vs new API (Lambda + DynamoDB)
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from './utils/test-server';
import { getAuthHeaders, ApiAuthHeaders } from './utils/auth-utils';
import { createTestDevice, generateTestDeviceId } from './utils/device-helpers';

interface Device {
  id: string;
  name: string;
  type: 'ruuvi' | 'sensorbug' | 'ruuvi-air';
  order: number;
  disabled: boolean;
  location: {
    x: number;
    y: number;
    type: 'inside' | 'outside' | null;
  };
}

interface DeviceListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: Device[];
}

interface DeleteResponse {
  message: string;
}

describe('DELETE /api/devices/:id - Compatibility', () => {
  let auth: ApiAuthHeaders;

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();
  });

  it('should successfully delete device in both APIs', async () => {
    // Create test device
    const testDeviceId = generateTestDeviceId();
    await createTestDevice(
      {
        id: testDeviceId,
        name: 'Device To Delete',
        type: 'ruuvi',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      },
      auth
    );

    // Delete from old API
    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}`, {
      method: 'DELETE',
      headers: auth.oldHeaders,
    });

    expect(oldResponse.status).toBe(200);
    const oldData = (await oldResponse.json()) as DeleteResponse;
    expect(oldData.message).toBeTruthy();

    // Verify device is gone from old API
    const oldListResponse = await fetch(`${OLD_API_URL}/api/devices?includeDisabled=true`, {
      headers: auth.oldHeaders,
    });
    const oldList = (await oldListResponse.json()) as DeviceListResponse;
    const oldDevice = oldList.values.find((d) => d.id === testDeviceId);
    expect(oldDevice).toBeUndefined();

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}`, {
      method: 'DELETE',
      headers: auth.newHeaders,
    });

    expect(newResponse.status).toBe(200);
    const newData = (await newResponse.json()) as DeleteResponse;
    expect(newData.message).toBeTruthy();

    // Verify device is gone from new API
    const newListResponse = await fetch(`${NEW_API_URL}/api/devices?includeDisabled=true`, {
      headers: auth.newHeaders,
    });
    const newList = (await newListResponse.json()) as DeviceListResponse;
    const newDevice = newList.values.find((d) => d.id === testDeviceId);
    expect(newDevice).toBeUndefined();
  });

  it('should return 404 when deleting non-existent device in both APIs', async () => {
    const nonExistentId = 'device-99999';

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${nonExistentId}`, {
      method: 'DELETE',
      headers: auth.oldHeaders,
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${nonExistentId}`, {
      method: 'DELETE',
      headers: auth.newHeaders,
    });

    expect(oldResponse.status).toBe(404);
    expect(newResponse.status).toBe(404);
  });

  it('should CASCADE delete all device readings in both APIs', async () => {
    // Create test device
    const testDeviceId = generateTestDeviceId();
    await createTestDevice(
      {
        id: testDeviceId,
        name: 'Device With Readings',
        type: 'ruuvi',
        order: 9998,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      },
      auth
    );

    // Add some readings to the device in old API
    const reading = {
      temperature: 20.5,
      humidity: 45.0,
      pressure: 1013.0,
    };

    await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    // Add reading to new API
    await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    // Verify readings exist (old API)
    const oldLatestBefore = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}/latest-readings`, {
      headers: auth.oldHeaders,
    });
    expect(oldLatestBefore.status).toBe(200);

    // Verify readings exist (new API)
    const newLatestBefore = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}/latest`, {
      headers: auth.newHeaders,
    });
    expect(newLatestBefore.status).toBe(200);

    // Delete device from old API (should CASCADE delete readings)
    const oldDeleteResponse = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}`, {
      method: 'DELETE',
      headers: auth.oldHeaders,
    });
    expect(oldDeleteResponse.status).toBe(200);

    // Verify readings are gone (old API)
    const oldLatestAfter = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}/latest-readings`, {
      headers: auth.oldHeaders,
    });
    expect(oldLatestAfter.status).toBe(404);

    // Delete device from new API (should CASCADE delete readings)
    const newDeleteResponse = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}`, {
      method: 'DELETE',
      headers: auth.newHeaders,
    });
    expect(newDeleteResponse.status).toBe(200);

    // Verify readings are gone (new API)
    const newLatestAfter = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}/latest`, {
      headers: auth.newHeaders,
    });
    expect(newLatestAfter.status).toBe(404);
  });
});
