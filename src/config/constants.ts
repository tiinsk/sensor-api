/**
 * Application constants
 * These are code-level constants, not configuration
 */

/**
 * DynamoDB table names
 */
export const TABLES = {
  DEVICES: 'SensorApi-Devices',
  READINGS: 'SensorApi-Readings',
  USERS: 'SensorApi-Users',
  AUTH: 'SensorApi-Auth',
} as const;
