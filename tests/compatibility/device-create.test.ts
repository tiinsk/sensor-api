/**
 * Compatibility tests for POST /api/devices endpoint
 * Compare old API (Hapi.js + PostgreSQL) vs new API (Lambda + DynamoDB)
 */

import { OLD_API_URL, NEW_API_URL, verifyServersRunning } from '../utils/test-server';
import { getAuthHeaders, ApiAuthHeaders } from './auth-utils';
import { deleteTestDevice, generateTestDeviceId } from './device-helpers';

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

interface DeviceListResponse {
  count: number;
  totCount: number;
  limit: number;
  values: Device[];
}

describe('POST /api/devices - Compatibility', () => {
  let auth: ApiAuthHeaders;
  const createdDeviceIds: string[] = [];

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();
  });

  afterEach(async () => {
    // Clean up any devices created during tests
    for (const deviceId of createdDeviceIds) {
      await deleteTestDevice(deviceId, auth);
    }
    createdDeviceIds.length = 0;
  });

  it('should successfully create a device with all fields in both APIs', async () => {
    const deviceId = generateTestDeviceId();
    const device = {
      id: deviceId,
      name: 'Test Device Full',
      type: 'ruuvi',
      order: 9999,
      disabled: false,
      location: {
        x: 10,
        y: 20,
        type: 'inside',
      },
    };

    // Create in old API
    const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    // Create in new API
    const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(201);

    const oldData = (await oldResponse.json()) as Device;
    const newData = (await newResponse.json()) as Device;

    // Verify returned data matches
    expect(oldData.id).toBe(device.id);
    expect(newData.id).toBe(device.id);
    expect(oldData.name).toBe(device.name);
    expect(newData.name).toBe(device.name);
    expect(oldData.type).toBe(device.type);
    expect(newData.type).toBe(device.type);
    expect(oldData.order).toBe(device.order);
    expect(newData.order).toBe(device.order);

    createdDeviceIds.push(deviceId);
  });

  it('should successfully create a device with null location type', async () => {
    const deviceId = generateTestDeviceId();
    const device = {
      id: deviceId,
      name: 'Test Device Null Location',
      type: 'sensorbug',
      order: 9998,
      disabled: true,
      location: {
        x: 0,
        y: 0,
        type: null,
      },
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(201);

    const oldData = (await oldResponse.json()) as Device;
    const newData = (await newResponse.json()) as Device;

    expect(oldData.location.type).toBeNull();
    expect(newData.location.type).toBeNull();

    createdDeviceIds.push(deviceId);
  });

  it('should reject device with invalid ID length (not 12 chars)', async () => {
    const device = {
      id: 'short', // Only 5 characters
      name: 'Invalid Device',
      type: 'ruuvi',
      order: 9997,
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    // Both should reject
    expect(oldResponse.status).toBe(400);
    expect(newResponse.status).toBe(400);
  });

  it('should reject device with missing required fields', async () => {
    const device = {
      id: generateTestDeviceId(),
      name: 'Missing Fields Device',
      // Missing: type, order, location
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    // Both should reject
    expect(oldResponse.status).toBe(400);
    expect(newResponse.status).toBe(400);
  });

  it('should reject device with invalid type', async () => {
    const device = {
      id: generateTestDeviceId(),
      name: 'Invalid Type Device',
      type: 'invalid-type', // Only 'ruuvi' or 'sensorbug' allowed
      order: 9996,
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(device),
    });

    // Both should reject
    expect(oldResponse.status).toBe(400);
    expect(newResponse.status).toBe(400);
  });

  it('should reject duplicate device ID', async () => {
    const deviceId = generateTestDeviceId();
    const device = {
      id: deviceId,
      name: 'Duplicate ID Test',
      type: 'ruuvi',
      order: 9995,
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    // Create device in both APIs (first time)
    const oldResponse1 = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.oldHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    const newResponse1 = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.newHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    expect(oldResponse1.status).toBe(200);
    expect(newResponse1.status).toBe(201);
    createdDeviceIds.push(deviceId);

    // Try to create duplicate in both APIs (should fail)
    const oldResponse2 = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.oldHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    const newResponse2 = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.newHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    // Both should reject duplicate
    expect(oldResponse2.status).toBe(409);
    expect(newResponse2.status).toBe(409);
  });

  it('should reject duplicate device order', async () => {
    const deviceId1 = generateTestDeviceId();
    const deviceId2 = generateTestDeviceId();
    const duplicateOrder = 9994;

    const device1 = {
      id: deviceId1,
      name: 'First Device',
      type: 'ruuvi',
      order: duplicateOrder,
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    const device2 = {
      id: deviceId2,
      name: 'Second Device',
      type: 'sensorbug',
      order: duplicateOrder, // Same order!
      disabled: false,
      location: { x: 0, y: 0, type: null },
    };

    // Create first device in both APIs
    const oldResponse1 = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.oldHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device1),
    });

    const newResponse1 = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.newHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device1),
    });

    expect(oldResponse1.status).toBe(200);
    expect(newResponse1.status).toBe(201);
    createdDeviceIds.push(deviceId1);

    // Try to create second device with duplicate order (should fail)
    const oldResponse2 = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.oldHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device2),
    });

    const newResponse2 = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.newHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device2),
    });

    // Both should reject duplicate order
    expect(oldResponse2.status).toBe(409);
    expect(newResponse2.status).toBe(409);
  });

  it('should verify created device appears in device list', async () => {
    const deviceId = generateTestDeviceId();
    const device = {
      id: deviceId,
      name: 'Verify List Device',
      type: 'ruuvi',
      order: 9993,
      disabled: false,
      location: { x: 5, y: 15, type: 'outside' },
    };

    // Create in both APIs
    const oldCreateResponse = await fetch(`${OLD_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.oldHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    const newCreateResponse = await fetch(`${NEW_API_URL}/api/devices`, {
      method: 'POST',
      headers: { ...auth.newHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(device),
    });

    expect(oldCreateResponse.status).toBe(200);
    expect(newCreateResponse.status).toBe(201);
    createdDeviceIds.push(deviceId);

    // Verify device appears in list (old API)
    const oldListResponse = await fetch(`${OLD_API_URL}/api/devices?includeDisabled=true`, {
      headers: auth.oldHeaders,
    });
    const oldList = (await oldListResponse.json()) as DeviceListResponse;
    const oldDevice = oldList.values.find((d: Device) => d.id === deviceId);
    expect(oldDevice).toBeDefined();
    expect(oldDevice?.name).toBe(device.name);

    // Verify device appears in list (new API)
    const newListResponse = await fetch(`${NEW_API_URL}/api/devices?includeDisabled=true`, {
      headers: auth.newHeaders,
    });
    const newList = (await newListResponse.json()) as DeviceListResponse;
    const newDevice = newList.values.find((d: Device) => d.id === deviceId);
    expect(newDevice).toBeDefined();
    expect(newDevice?.name).toBe(device.name);
  });
});
