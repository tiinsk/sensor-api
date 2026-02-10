#!/usr/bin/env node
/**
 * Generate env.json for SAM CLI from validated environment variables
 * Validation is handled by src/lib/env.ts - if any required vars are missing,
 * the import will throw an error and this script will exit
 */
import dotenv from 'dotenv';
import { resolve } from 'path';
import { writeFileSync } from 'fs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

// Import env (validation happens during import)
import { env } from '../src/lib/env';

const samEnv = {
  SensorApiFunction: env
};

writeFileSync('env.json', JSON.stringify(samEnv, null, 2));
console.log('✅ Generated env.json for SAM CLI');
