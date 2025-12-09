#!/usr/bin/env node

/**
 * Baseline Performance Test - Single User
 *
 * This test establishes baseline performance metrics with minimal load
 * to understand the system's optimal performance characteristics.
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Simple test configuration for baseline
const baselineConfig = {
  url: `${BASE_URL}/api/tags`,
  connections: 1,  // Single user
  duration: 30,    // 30 seconds
  pipelining: 1,
  title: 'Baseline Test - Single User'
};

console.log('Starting Baseline Performance Test...');
console.log('Configuration:', JSON.stringify(baselineConfig, null, 2));
console.log('---');

autocannon(baselineConfig, (err, result) => {
  if (err) {
    console.error('Error running test:', err);
    process.exit(1);
  }

  console.log('\n=== BASELINE TEST RESULTS ===\n');

  // Display key metrics
  console.log(`Requests:        ${result.requests.total} total, ${result.requests.average} req/sec average`);
  console.log(`Duration:        ${result.duration} seconds`);
  console.log(`Latency:         ${result.latency.mean} ms average`);
  console.log(`  - p50:         ${result.latency.p50} ms`);
  console.log(`  - p95:         ${result.latency.p95} ms`);
  console.log(`  - p99:         ${result.latency.p99} ms`);
  console.log(`  - p99.9:       ${result.latency.p999} ms`);
  console.log(`  - max:         ${result.latency.max} ms`);
  console.log(`Throughput:      ${(result.throughput.mean / 1024).toFixed(2)} KB/sec`);
  console.log(`Errors:          ${result.errors} (${result.non2xx} non-2xx responses)`);
  console.log(`Timeouts:        ${result.timeouts}`);

  // Save results
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `baseline-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`\nResults saved to: ${filepath}`);

  // Performance assessment
  console.log('\n=== BASELINE ASSESSMENT ===\n');
  if (result.latency.mean < 50) {
    console.log('✓ Excellent baseline performance (<50ms average)');
  } else if (result.latency.mean < 100) {
    console.log('✓ Good baseline performance (<100ms average)');
  } else if (result.latency.mean < 200) {
    console.log('⚠ Acceptable baseline performance (<200ms average)');
  } else {
    console.log('✗ Poor baseline performance (>200ms average) - investigate before load testing');
  }

  if (result.errors > 0 || result.non2xx > 0) {
    console.log('✗ Errors detected in baseline - fix before proceeding');
  } else {
    console.log('✓ No errors detected');
  }
});
