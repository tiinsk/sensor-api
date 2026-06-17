/**
 * Load CORS allowed origins from SSM when ALLOWED_ORIGINS_PARAM_NAME is set (Lambda production).
 * Called at cold start so ALLOWED_ORIGINS is available for the rest of the request.
 */

import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { ENV_VARS } from '../config/env-schema';

let loaded = false;

export async function ensureAllowedOriginsLoaded(): Promise<void> {
  const paramName = process.env[ENV_VARS.ALLOWED_ORIGINS_PARAM_NAME];
  if (!paramName || process.env[ENV_VARS.ALLOWED_ORIGINS]) {
    return;
  }
  if (loaded) {
    return;
  }

  const client = new SSMClient({ region: process.env[ENV_VARS.AWS_REGION] });
  const response = await client.send(
    new GetParameterCommand({ Name: paramName })
  );

  const value = response.Parameter?.Value;
  if (!value) {
    throw new Error('Allowed origins parameter in SSM is empty');
  }

  process.env[ENV_VARS.ALLOWED_ORIGINS] = value;
  loaded = true;
}
