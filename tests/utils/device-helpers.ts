/**
 * Shared device helper utilities for tests
 */

import { getApiUrl } from '../integration/test-config';
import { RequestHeaders } from '../integration/auth-utils';

/**
 * Generate a unique test device ID
 * Format: test-NNNNNNN (12 chars: 'test-' = 5 chars + 7 digits)
 */
export function generateTestDeviceId(): string {
  return `test-${Date.now().toString().slice(-7)}`;
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

