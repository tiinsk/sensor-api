/**
 * Shared device helper utilities for tests
 */

import { getApiUrl } from '../integration/utils/test-config';
import { RequestHeaders } from '../integration/utils/auth-utils';

/**
 * Generate a unique test device ID
 * Format: test-NNNNNNN (12 chars: 'test-' = 5 chars + 7 chars)
 * Combines timestamp with random suffix to ensure uniqueness
 */
export function generateTestDeviceId(): string {
  const timestamp = Date.now().toString(36).slice(-4);
  const random = Math.random().toString(36).substring(2, 5);
  return `test-${timestamp}${random}`;
}

/**
 * Create a test device and seed it with readings.
 * The device ID is added to `createdDeviceIds` so the caller's afterEach cleanup picks it up.
 */
export async function createTestDeviceWithReadings(opts: {
  deviceOrder: number;
  deviceName?: string;
  timezone?: string;
  readings: Array<{ timestamp: string; temperature: number; humidity?: number; pressure?: number; battery?: number }>;
  headers: RequestHeaders;
  createdDeviceIds: string[];
}): Promise<string> {
  const API_URL = getApiUrl();
  const deviceId = generateTestDeviceId();

  await fetch(`${API_URL}/api/devices`, {
    method: 'POST',
    headers: opts.headers,
    body: JSON.stringify({
      id: deviceId,
      name: opts.deviceName ?? 'Test Device',
      location: { x: 0, y: 0, type: null },
      type: 'ruuvi',
      timezone: opts.timezone ?? 'UTC',
      disabled: false,
      order: opts.deviceOrder,
    }),
  });

  opts.createdDeviceIds.push(deviceId);

  for (const reading of opts.readings) {
    await fetch(`${API_URL}/api/devices/${deviceId}/readings`, {
      method: 'POST',
      headers: opts.headers,
      body: JSON.stringify(reading),
    });
  }

  return deviceId;
}

/**
 * Delete test devices from the API (for integration test cleanup)
 */
export async function deleteTestDevices(
  deviceIds: string[],
  headers: RequestHeaders
): Promise<void> {
  const API_URL = getApiUrl();

  for (const deviceId of deviceIds) {
    const response = await fetch(`${API_URL}/api/devices/${deviceId}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      throw new Error(`Failed to delete device from API: ${response.status} - ${errorText}`);
    }
  }
}

