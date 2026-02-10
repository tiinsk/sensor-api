/**
 * Environment variable schema
 * Single source of truth for all environment variable names
 */
export const ENV_VARS = {
  JWT_SECRET: 'JWT_SECRET',
  USE_LOCAL_DB: 'USE_LOCAL_DB',
  AWS_REGION: 'AWS_REGION',
  NODE_ENV: 'NODE_ENV',
} as const;

export type EnvVarKey = keyof typeof ENV_VARS;
