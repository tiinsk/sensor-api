/**
 * Compatibility tests for POST /api/devices/:id/readings endpoint
 * Compare old API (Hapi.js + PostgreSQL) vs new API (Lambda + DynamoDB)
 * Tests the Raspberry Pi sensor data submission use case
 */

import {NEW_API_URL, OLD_API_URL, verifyServersRunning} from '../utils/test-server';
import { getAuthHeaders, ApiAuthHeaders } from './auth-utils';
import { createTestDevice, deleteTestDevice } from './device-helpers';

interface ReadingResponse {
  temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  battery: number | null;
  timestamp?: string;
  created_at?: string;
}

interface LatestReadingResponse {
  reading: ReadingResponse;
}

const ADD_READING_DEVICE_ID = 'device-TEST1'

describe('POST /api/devices/:id/readings - Compatibility', () => {
  let auth: ApiAuthHeaders;

  beforeAll(async () => {
    await verifyServersRunning();
    auth = await getAuthHeaders();
  });

  beforeEach(async () => {
    // Create a fresh test device for each test
    await createTestDevice(
      {
        id: ADD_READING_DEVICE_ID,
        name: 'Test Device for Readings',
        type: 'ruuvi',
        order: 9999,
        location: {
          x: 0,
          y: 0,
          type: 'inside',
        },
        disabled: false,
      },
      auth,
    );
  });

  afterEach(async () => {
    // Delete test device (CASCADE deletes all readings automatically)
    await deleteTestDevice(ADD_READING_DEVICE_ID, auth);
  });

  it('should successfully add a reading with all sensor types to both APIs', async () => {
    const timestamp = new Date().toISOString();
    const reading = {
      temperature: 22.5,
      humidity: 45.2,
      pressure: 1013.25,
      battery: 95.5,
    };

    // Add reading to old API
    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    // Add reading to new API
    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    // Both should succeed
    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(201);

    const oldData = (await oldResponse.json()) as ReadingResponse;
    const newData = (await newResponse.json()) as ReadingResponse;

    // Both should return saved reading
    expect(oldData.temperature).toBe(reading.temperature);
    expect(newData.temperature).toBe(reading.temperature);
    expect(oldData.humidity).toBe(reading.humidity);
    expect(newData.humidity).toBe(reading.humidity);
    expect(oldData.pressure).toBe(reading.pressure);
    expect(newData.pressure).toBe(reading.pressure);
    expect(oldData.battery).toBe(reading.battery);
    expect(newData.battery).toBe(reading.battery);
  });

  it('should successfully add a reading with only temperature', async () => {
    const reading = {
      temperature: 21.8,
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(201);
  });

  it('should successfully add a reading with partial sensor data', async () => {
    const reading = {
      temperature: 20.5,
      humidity: 50.0,
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    expect(oldResponse.status).toBe(200);
    expect(newResponse.status).toBe(201);
  });

  it('should verify added reading appears in latest readings', async () => {
    // Add a unique reading
    const uniqueTemp = 3.1415927;
    const reading = {
      temperature: uniqueTemp,
      humidity: 48.9,
      pressure: 1015.5,
      battery: 92.0,
    };

    // Add to old API
    const oldAddResponse = await fetch(`${OLD_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });
    expect(oldAddResponse.status).toBe(200);

    // Add to new API
    const newAddResponse = await fetch(`${NEW_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });
    expect(newAddResponse.status).toBe(201);

    // Wait a moment for data to be written
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify it appears in latest readings for old API
    const oldLatestResponse = await fetch(
      `${OLD_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/latest-readings`,
      { headers: auth.oldHeaders }
    );


    expect(oldLatestResponse.status).toBe(200);
    const oldLatest = (await oldLatestResponse.json()) as LatestReadingResponse;
    expect(oldLatest.reading.temperature).toBe(uniqueTemp);

    // Verify it appears in latest readings for new API
    const newLatestResponse = await fetch(`${NEW_API_URL}/api/devices/${ADD_READING_DEVICE_ID}/latest`, {
      headers: auth.newHeaders,
    });
    expect(newLatestResponse.status).toBe(200);
    const newLatest = (await newLatestResponse.json()) as LatestReadingResponse;
    expect(newLatest.reading.temperature).toBe(uniqueTemp);
  });

  it('should reject invalid device ID with same error handling', async () => {
    const invalidDeviceId = 'nonexistent-device-999';
    const reading = {
      temperature: 20.0,
    };

    const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${invalidDeviceId}/readings`, {
      method: 'POST',
      headers: {
        ...auth.oldHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    const newResponse = await fetch(`${NEW_API_URL}/api/devices/${invalidDeviceId}/readings`, {
      method: 'POST',
      headers: {
        ...auth.newHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reading),
    });

    // Both should return error status (likely 404 or 400)
    expect(oldResponse.status).toBeGreaterThanOrEqual(400);
    expect(newResponse.status).toBeGreaterThanOrEqual(400);
  });
});
