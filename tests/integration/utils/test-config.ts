/**
 * Configuration for integration tests
 * Simple shared config - assumes test tables and API are already running
 */

/**
 * Get API URL from environment or use default
 */
export function getApiUrl(): string {
  const port = process.env.TEST_API_PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Test user credentials (from seed data)
 */
export const TEST_USER = {
  username: 'testuser',
  password: 'testpassword',
};
