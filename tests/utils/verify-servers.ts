#!/usr/bin/env ts-node
/**
 * Simple script to verify both servers are running
 * Run this before running tests to check your setup
 */

import { verifyServersRunning, OLD_API_URL, NEW_API_URL } from './test-server';

async function main() {
  console.log('Server Verification Tool');
  console.log('='.repeat(80));
  console.log(`Old API URL: ${OLD_API_URL}`);
  console.log(`New API URL: ${NEW_API_URL}`);
  console.log('='.repeat(80));

  try {
    await verifyServersRunning();
    console.log('✅ SUCCESS: Both servers are ready for testing!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ FAILED: Please start the servers as instructed above.\n');
    process.exit(1);
  }
}

main();
