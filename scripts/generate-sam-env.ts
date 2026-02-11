#!/usr/bin/env node
/**
 * Generate env.json for SAM CLI from validated environment variables
 * Validation is handled by src/lib/env.ts - if any required vars are missing,
 * the import will throw an error and this script will exit
 */

import { writeFileSync } from 'fs';
import { env } from '../src/lib/env';

const samEnv = {
  Parameters: env
};

writeFileSync('env.json', JSON.stringify(samEnv, null, 2));
console.log('✅ Generated env.json for SAM CLI');
