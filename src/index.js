#!/usr/bin/env node

/**
 * Cross-Schedule Bot — Entry point.
 * 
 * Usage:
 *   node src/index.js                    # Run scheduler (check for due posts)
 *   DRY_RUN=true node src/index.js       # Preview what would be posted
 *   PLATFORM=bluesky node src/index.js   # Filter (optional — for future use)
 * 
 * Designed to run on a cron schedule (GitHub Actions every 15-30 min).
 */

import { runScheduler } from './scheduler.js';

async function main() {
  try {
    await runScheduler();
  } catch (e) {
    console.error('\n💥 Fatal error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

main();
