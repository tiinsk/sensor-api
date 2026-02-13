/**
 * Test server configuration
 */

// Server configuration - can be overridden via environment variables
export const OLD_API_PORT = process.env.OLD_API_PORT;
export const NEW_API_PORT = process.env.LOCAL_API_PORT;

export const OLD_API_URL = `http://localhost:${OLD_API_PORT}`;
export const NEW_API_URL = `http://localhost:${NEW_API_PORT}`;

/**
 * Check if a server is reachable
 */
export async function checkServer(url: string, serverName: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/devices`, { method: 'GET' });
    // We expect 401 (unauthorized) or 200 (if auth not required) - both mean server is running
    if (response.status === 401 || response.status === 200) {
      return true;
    }
    console.error(`✗ ${serverName} returned unexpected status ${response.status}`);
    return false;
  } catch (error) {
    console.error(`✗ ${serverName} is not reachable at ${url}`);
    console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Verify both servers are running before tests
 * Call this in beforeAll() in your test suites
 */
export async function verifyServersRunning(): Promise<void> {

  const oldApiOk = await checkServer(OLD_API_URL, 'Old API');
  const newApiOk = await checkServer(NEW_API_URL, 'New API');

  if (!oldApiOk || !newApiOk) {
    if(!oldApiOk) {
      console.error('\n❌ Old API server is not running');
    }

    if(!newApiOk) {
      console.error('\n❌ New API server is not running');
    }

    throw new Error('Both servers are not running. Please start them manually.');
  }
}
