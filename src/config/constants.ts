/**
 * Application constants
 * These are code-level constants, not configuration
 */

/**
 * Get table name with automatic TEST- prefix in test environment
 */
function getTableName(baseName: string): string {
  // Automatically prefix with TEST- when NODE_ENV=test
  const prefix = process.env.NODE_ENV === 'test' ? 'TEST-' : '';
  return `${prefix}${baseName}`;
}

/**
 * DynamoDB table names
 * Automatically uses TEST- prefix when NODE_ENV=test
 * Examples:
 *   NODE_ENV=production → "SensorApi-Devices"
 *   NODE_ENV=test → "TEST-SensorApi-Devices"
 */
export const TABLES = {
  DEVICES: getTableName('SensorApi-Devices'),
  READINGS: getTableName('SensorApi-Readings'),
  USERS: getTableName('SensorApi-Users'),
  AUTH: getTableName('SensorApi-Auth'),
} as const;
