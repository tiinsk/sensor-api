/**
 * Load JWT secret from AWS Secrets Manager when JWT_SECRET_NAME is set (Lambda production).
 * Called at cold start so env.JWT_SECRET is available for the rest of the request.
 */

import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { ENV_VARS } from '../config/env-schema';

let loaded = false;

export async function ensureJwtSecretLoaded(): Promise<void> {
  const secretName = process.env[ENV_VARS.JWT_SECRET_NAME];
  if (!secretName || process.env[ENV_VARS.JWT_SECRET]) {
    return;
  }
  if (loaded) {
    return;
  }

  const client = new SecretsManagerClient({ region: process.env[ENV_VARS.AWS_REGION] });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretName })
  );
  const secret = response.SecretString;
  if (!secret) {
    throw new Error('JWT secret in Secrets Manager is empty');
  }
  process.env[ENV_VARS.JWT_SECRET] = secret;
  loaded = true;
}
