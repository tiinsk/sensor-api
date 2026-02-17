/**
 * Compatibility tests for PUT /api/devices/:id endpoint
 * Compare old API (Hapi.js + PostgreSQL) vs new API (Lambda + DynamoDB)
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import { getAuthHeaders, ApiAuthHeaders } from './auth-utils';
import { createTestDevice, deleteTestDevice, generateTestDeviceId } from './device-helpers';

interface Device {
  id: string;
  name: string;
  type: 'ruuvi' | 'sensorbug';
  order: number;
  disabled: boolean;
  location: {
    x: number;
    y: number;
    type: 'inside' | 'outside' | null;
  };
}

describe('PUT /api/devices/:id - Compatibility', () => {
  let auth: ApiAuthHeaders;
  let testDeviceId: string;

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();
  });

  beforeEach(async () => {
    // Create a fresh test device for each test
    testDeviceId = generateTestDeviceId();
    await createTestDevice(
      {
        id: testDeviceId,
        name: 'Original Device',
        type: 'ruuvi',
        order: 9999,
        disabled: false,
        location: { x: 0, y: 0, type: null },
      },
      auth
    );
  });

  afterEach(async () => {
    // Clean up test device
    await deleteTestDevice(testDeviceId, auth);
  });

  it('should reject partial update (missing required fields) in both APIs', async () => {
    // Try to send only partial data (PUT requires all fields)
    const partialUpdate = {
      name: 'Only Name Changed',
      // Missing: type, order, location, disabled
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partialUpdate),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(partialUpdate),
    });

    // Both should reject with 400
    expect(oldResponse.status).toBe(400);
    expect(newResponse.status).toBe(400);
  });

  it('should successfully update device with complete replacement in both APIs', async () => {
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

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(200);

    const oldData = (await oldResponse.json()) as Device;
    const newData = (await newResponse.json()) as Device;

    expect(oldData.name).toBe(updates.name);
    expect(newData.name).toBe(updates.name);
    expect(oldData.order).toBe(updates.order);
    expect(newData.order).toBe(updates.order);
    expect(oldData.type).toBe(updates.type);
    expect(newData.type).toBe(updates.type);
    expect(oldData.disabled).toBe(updates.disabled);
    expect(newData.disabled).toBe(updates.disabled);
    expect(oldData.location.x).toBe(updates.location.x);
    expect(newData.location.x).toBe(updates.location.x);
  });

  it('should return 404 for non-existent device in both APIs', async () => {
    const nonExistentId = 'device-99999';
    // PUT requires all fields
    const updates = {
      name: 'Should Not Work',
      type: 'ruuvi' as const,
      order: 9999,
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${nonExistentId}`, {
      method: 'PUT',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${nonExistentId}`, {
      method: 'PUT',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    expect(oldResponse.status).toBe(404);
    expect(newResponse.status).toBe(404);
  });

  it('should reject duplicate order when updating in both APIs', async () => {
    // Create second device with different order
    const deviceId2 = generateTestDeviceId();
    await createTestDevice(
      {
        id: deviceId2,
        name: 'Second Device',
        type: 'sensorbug',
        order: 9996, // Different order
        disabled: false,
        location: { x: 0, y: 0, type: null },
      },
      auth
    );

    // Try to update first device to use second device's order (PUT requires all fields)
    const updates = {
      name: 'Original Device',
      type: 'ruuvi' as const,
      order: 9996, // Conflicts with deviceId2
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${testDeviceId}`, {
      method: 'PUT',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    // Both should reject duplicate order
    expect(oldResponse.status).toBe(409);
    expect(newResponse.status).toBe(409);

    // Clean up second device
    await deleteTestDevice(deviceId2, auth);
  });
});
