/**
 * Helper functions for managing test devices in compatibility tests
 */

import { OLD_API_URL, NEW_API_URL } from './test-server';
import { ApiAuthHeaders } from './auth-utils';
import { generateTestDeviceId } from '../../utils/device-helpers';

export { generateTestDeviceId };

export interface TestDevice {
  id: string;
  name: string;
  type: 'ruuvi' | 'sensorbug';
  order: number;
  disabled?: boolean;
  location?: {
    x: number;
    y: number;
    type: 'inside' | 'outside' | null;
  };
}

/**
 * Create a test device in both APIs
 */
export async function createTestDevice(
  device: TestDevice,
  auth: ApiAuthHeaders
): Promise<void> {
  const deviceData = {
    id: device.id,
    name: device.name,
    type: device.type,
    order: device.order,
    disabled: device.disabled || false,
    location: device.location || { x: 0, y: 0, type: null },
  };

  // Create in old API
  const oldResponse = await fetch(`${OLD_API_URL}/api/devices`, {
    method: 'POST',
    headers: {
      ...auth.oldHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deviceData),
  });

  if (!oldResponse.ok) {
    const errorText = await oldResponse.text();
    throw new Error(`Failed to create device in old API: ${oldResponse.status} - ${errorText}`);
  }

  // Create in new API
  const newResponse = await fetch(`${NEW_API_URL}/api/devices`, {
    method: 'POST',
    headers: {
      ...auth.newHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deviceData),
  });

  if (!newResponse.ok) {
    const errorText = await newResponse.text();
    throw new Error(`Failed to create device in new API: ${newResponse.status} - ${errorText}`);
  }
}

/**
 * Delete a test device from both APIs (CASCADE deletes all readings)
 */
export async function deleteTestDevice(
  deviceId: string,
  auth: ApiAuthHeaders
): Promise<void> {
  // Delete from old API
  const oldResponse = await fetch(`${OLD_API_URL}/api/devices/${deviceId}`, {
    method: 'DELETE',
    headers: auth.oldHeaders,
  });

  if (!oldResponse.ok && oldResponse.status !== 404) {
    const errorText = await oldResponse.text();
    throw new Error(`Failed to delete device from old API: ${oldResponse.status} - ${errorText}`);
  }

  // Delete from new API
  const newResponse = await fetch(`${NEW_API_URL}/api/devices/${deviceId}`, {
    method: 'DELETE',
    headers: auth.newHeaders,
  });

  if (!newResponse.ok && newResponse.status !== 404) {
    const errorText = await newResponse.text();
    throw new Error(`Failed to delete device from new API: ${newResponse.status} - ${errorText}`);
  }
}

