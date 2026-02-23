/**
 * Environment variable validation
 * Single source of truth for environment validation logic
 */
import { ENV_VARS } from '../config/env-schema';

function validateAndLoadEnv() {
  // Validate required environment variables
  const useSecretsManager = !!process.env[ENV_VARS.JWT_SECRET_ARN];
  const required = useSecretsManager
    ? [ENV_VARS.AWS_REGION, ENV_VARS.NODE_ENV]
    : [ENV_VARS.JWT_SECRET, ENV_VARS.AWS_REGION, ENV_VARS.NODE_ENV];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`❌ ERROR: Missing required environment variables: ${missing.join(', ')}`);
    console.error('💡 Make sure your .env.local file contains all required variables.');
    console.error('See .env.local.example for reference.\n');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    get JWT_SECRET(): string {
      return process.env[ENV_VARS.JWT_SECRET] ?? '';
    },
    JWT_SECRET_ARN: process.env[ENV_VARS.JWT_SECRET_ARN],
    AWS_REGION: process.env[ENV_VARS.AWS_REGION]!,
    NODE_ENV: process.env[ENV_VARS.NODE_ENV]!,
    USE_LOCAL_DB: process.env[ENV_VARS.USE_LOCAL_DB] || 'false',
  } as const;
}

/**
 * Validated environment variables
 * Use this instead of process.env directly
 */
export const env = validateAndLoadEnv();
