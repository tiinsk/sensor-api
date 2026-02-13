/**
 * Compatibility Test Setup
 *
 * This test file verifies that both APIs are running and ready for testing.
 * It should be run first before any actual compatibility tests.
 */

import { verifyServersRunning, OLD_API_URL, NEW_API_URL } from '../utils/test-server';

describe('API Compatibility Test Setup', () => {
  beforeAll(async () => {
    // Verify both servers are running before any tests
    console.log('\n=== Verifying Test Environment ===');
    console.log(`Old API URL: ${OLD_API_URL}`);
    console.log(`New API URL: ${NEW_API_URL}`);

    await verifyServersRunning();
  });

  it('should have both servers running and responding', () => {
    // If we got here, verifyServersRunning() passed in beforeAll
    expect(true).toBe(true);
  });

  it('should have old api url configured', () => {
    expect(OLD_API_URL).toBeDefined();
    expect(OLD_API_URL).toMatch(/^https?:\/\//);
  });

  it('should have new api url configured', () => {
    expect(NEW_API_URL).toBeDefined();
    expect(NEW_API_URL).toMatch(/^https?:\/\//);
  });
});
