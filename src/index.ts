#!/usr/bin/env node
import { startServer } from './server.js';

async function main() {
  try {
    await startServer();
  } catch (error) {
    process.stderr.write(`Failed to start Claudist MCP server: ${error}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  process.stderr.write(`Unhandled error: ${error}\n`);
  process.exit(1);
});
