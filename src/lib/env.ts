/**
 * Environment variable validation
 * Ensures all required environment variables are present at startup
 */

interface EnvironmentVariables {
  // Required
  JWT_SECRET: string;
  DEVICES_TABLE: string;
  READINGS_TABLE: string;
  USERS_TABLE: string;
  AUTH_TABLE: string;
  AWS_REGION: string;
  
  // Optional
  IS_LOCAL?: string;
  NODE_ENV?: string;
}

/**
 * Get and validate required environment variable
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ ERROR: Required environment variable "${key}" is not set!`);
    console.error(`Please set it in your .env.local file or environment.`);
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Validate and load all environment variables
 * Call this at application startup
 */
export function loadEnvironment(): EnvironmentVariables {
  console.log('🔍 Validating environment variables...');
  
  try {
    const env: EnvironmentVariables = {
      // Required variables
      JWT_SECRET: getRequiredEnv('JWT_SECRET'),
      DEVICES_TABLE: getRequiredEnv('DEVICES_TABLE'),
      READINGS_TABLE: getRequiredEnv('READINGS_TABLE'),
      USERS_TABLE: getRequiredEnv('USERS_TABLE'),
      AUTH_TABLE: getRequiredEnv('AUTH_TABLE'),
      AWS_REGION: getRequiredEnv('AWS_REGION'),
      
      // Optional variables
      IS_LOCAL: getOptionalEnv('IS_LOCAL', 'false'),
      NODE_ENV: getOptionalEnv('NODE_ENV', 'development'),
    };
    
    console.log('✅ All required environment variables are set');
    return env;
  } catch (error) {
    console.error('\n💡 Tip: Make sure your .env.local file exists and contains all required variables.');
    console.error('See .env.local.example for reference.\n');
    throw error;
  }
}

/**
 * Validated environment variables
 * Use this instead of process.env directly
 */
export const env = loadEnvironment();
