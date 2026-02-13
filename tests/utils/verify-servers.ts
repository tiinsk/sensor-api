#!/usr/bin/env ts-node
/**
 * Simple script to verify both servers are running
 * Run this before running tests to check your setup
 */

import { verifyServersRunning } from './test-server';

async function main() {
  try {
    await verifyServersRunning();
    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

main();
