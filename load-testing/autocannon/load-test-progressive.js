#!/usr/bin/env node

/**
 * Progressive Load Test
 *
 * Tests multiple load levels to identify performance degradation points
 * Runs tests sequentially with increasing concurrency
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

// Progressive load scenarios
const scenarios = [
  {
    name: 'Light Load',
    connections: 10,
    duration: 60,
    description: '10 concurrent users for 60 seconds'
  },
  {
    name: 'Moderate Load',
    connections: 50,
    duration: 120,
    description: '50 concurrent users for 120 seconds'
  },
  {
    name: 'Heavy Load',
    connections: 100,
    duration: 120,
    description: '100 concurrent users for 120 seconds'
  },
  {
    name: 'Stress Test',
    connections: 250,
    duration: 120,
    description: '250 concurrent users for 120 seconds'
  },
  {
    name: 'Breaking Point',
    connections: 500,
    duration: 120,
    description: '500 concurrent users for 120 seconds'
  }
];

// Endpoints to test
const endpoints = [
  { path: '/api/tags', name: 'Tags (Simple)', method: 'GET' },
];

const results = [];
let currentScenarioIndex = 0;
let currentEndpointIndex = 0;

function runNextTest() {
  if (currentScenarioIndex >= scenarios.length) {
    console.log('\n=== ALL TESTS COMPLETED ===\n');
    saveComparisonReport();
    return;
  }

  if (currentEndpointIndex >= endpoints.length) {
    currentEndpointIndex = 0;
    currentScenarioIndex++;

    // Cooldown between scenarios
    if (currentScenarioIndex < scenarios.length) {
      console.log('\n--- Cooldown: 10 seconds before next scenario ---\n');
      setTimeout(runNextTest, 10000);
      return;
    } else {
      runNextTest();
      return;
    }
  }

  const scenario = scenarios[currentScenarioIndex];
  const endpoint = endpoints[currentEndpointIndex];

  const config = {
    url: `${BASE_URL}${endpoint.path}`,
    method: endpoint.method,
    connections: scenario.connections,
    duration: scenario.duration,
    pipelining: 1,
    title: `${scenario.name} - ${endpoint.name}`
  };

  console.log(`\n=== Running: ${scenario.name} - ${endpoint.name} ===`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Endpoint: ${endpoint.method} ${endpoint.path}`);
  console.log('---\n');

  autocannon(config, (err, result) => {
    if (err) {
      console.error('Error running test:', err);
      currentEndpointIndex++;
      runNextTest();
      return;
    }

    // Display results
    console.log(`Requests:        ${result.requests.total} total, ${result.requests.average} req/sec`);
    console.log(`Latency:         ${result.latency.mean} ms average`);
    console.log(`  - p95:         ${result.latency.p95} ms`);
    console.log(`  - p99:         ${result.latency.p99} ms`);
    console.log(`Errors:          ${result.errors} (${result.non2xx} non-2xx)`);

    // Store results
    results.push({
      scenario: scenario.name,
      endpoint: endpoint.name,
      connections: scenario.connections,
      duration: scenario.duration,
      metrics: {
        totalRequests: result.requests.total,
        requestsPerSecond: result.requests.average,
        latencyMean: result.latency.mean,
        latencyP50: result.latency.p50,
        latencyP95: result.latency.p95,
        latencyP99: result.latency.p99,
        latencyMax: result.latency.max,
        throughputMean: result.throughput.mean,
        errors: result.errors,
        non2xx: result.non2xx,
        timeouts: result.timeouts
      },
      fullResult: result
    });

    // Performance assessment
    if (result.latency.mean > 500) {
      console.log('⚠ WARNING: High average latency detected!');
    }
    if (result.latency.p99 > 1000) {
      console.log('⚠ WARNING: Poor tail latency (p99 > 1s)!');
    }
    if (result.errors > 0 || result.non2xx > 0) {
      console.log('✗ ERRORS DETECTED - System may be overloaded');
    }

    currentEndpointIndex++;

    // Short cooldown between tests
    setTimeout(runNextTest, 5000);
  });
}

function saveComparisonReport() {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `progressive-load-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${filepath}`);

  // Generate comparison table
  console.log('\n=== PERFORMANCE COMPARISON ===\n');
  console.log('Scenario          | Connections | Avg Latency | p95 Latency | p99 Latency | Req/sec | Errors');
  console.log('------------------|-------------|-------------|-------------|-------------|---------|-------');

  results.forEach(r => {
    const scenario = r.scenario.padEnd(17);
    const connections = r.connections.toString().padStart(11);
    const avgLatency = `${r.metrics.latencyMean.toFixed(2)} ms`.padStart(11);
    const p95Latency = `${r.metrics.latencyP95.toFixed(2)} ms`.padStart(11);
    const p99Latency = `${r.metrics.latencyP99.toFixed(2)} ms`.padStart(11);
    const reqPerSec = r.metrics.requestsPerSecond.toFixed(2).padStart(7);
    const errors = (r.metrics.errors + r.metrics.non2xx).toString().padStart(7);

    console.log(`${scenario}| ${connections} | ${avgLatency} | ${p95Latency} | ${p99Latency} | ${reqPerSec} | ${errors}`);
  });

  // Identify degradation point
  console.log('\n=== DEGRADATION ANALYSIS ===\n');

  let degradationPoint = null;
  for (let i = 1; i < results.length; i++) {
    const prev = results[i - 1];
    const curr = results[i];

    const latencyIncrease = ((curr.metrics.latencyMean - prev.metrics.latencyMean) / prev.metrics.latencyMean) * 100;

    if (latencyIncrease > 50 || curr.metrics.latencyMean > 500) {
      degradationPoint = curr;
      console.log(`Performance degradation detected at: ${curr.scenario}`);
      console.log(`  - Latency increased by ${latencyIncrease.toFixed(2)}%`);
      console.log(`  - Average latency: ${curr.metrics.latencyMean.toFixed(2)} ms`);
      break;
    }
  }

  if (!degradationPoint) {
    console.log('No significant degradation detected across test scenarios');
  }
}

// Start testing
console.log('=== AUTOCANNON PROGRESSIVE LOAD TEST ===\n');
console.log(`Testing URL: ${BASE_URL}`);
console.log(`Total scenarios: ${scenarios.length}`);
console.log(`Endpoints per scenario: ${endpoints.length}`);
console.log('---');

runNextTest();
