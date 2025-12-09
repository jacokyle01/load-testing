#!/usr/bin/env node

/**
 * Results Analysis Script
 *
 * Analyzes test results from the results directory and generates
 * comparison reports and insights
 */

const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, '../results');

console.log('=== Load Testing Results Analysis ===\n');

// Check if results directory exists
if (!fs.existsSync(resultsDir)) {
  console.error('Error: No results directory found');
  console.log('Please run tests first to generate results');
  process.exit(1);
}

// Read all JSON result files
const files = fs.readdirSync(resultsDir)
  .filter(f => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error('Error: No result files found');
  console.log('Please run tests first to generate results');
  process.exit(1);
}

console.log(`Found ${files.length} result file(s):\n`);

const results = {
  baseline: [],
  progressive: [],
  endpoints: []
};

// Load and categorize results
files.forEach(file => {
  const filepath = path.join(resultsDir, file);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

  if (file.includes('baseline')) {
    results.baseline.push({ file, data });
  } else if (file.includes('progressive')) {
    results.progressive.push({ file, data });
  } else if (file.includes('endpoint')) {
    results.endpoints.push({ file, data });
  }

  console.log(`  - ${file}`);
});

console.log('\n');

// Analyze baseline results
if (results.baseline.length > 0) {
  console.log('=== BASELINE PERFORMANCE ===\n');

  results.baseline.forEach(({ file, data }) => {
    console.log(`File: ${file}`);
    console.log(`  Requests:         ${data.requests.total} total`);
    console.log(`  Avg Latency:      ${data.latency.mean.toFixed(2)} ms`);
    console.log(`  p95 Latency:      ${data.latency.p95.toFixed(2)} ms`);
    console.log(`  p99 Latency:      ${data.latency.p99.toFixed(2)} ms`);
    console.log(`  Throughput:       ${data.requests.average.toFixed(2)} req/sec`);
    console.log(`  Errors:           ${data.errors + data.non2xx}`);

    // Assessment
    if (data.latency.mean < 50) {
      console.log(`  Assessment:       ✓ Excellent (<50ms)`);
    } else if (data.latency.mean < 100) {
      console.log(`  Assessment:       ✓ Good (<100ms)`);
    } else if (data.latency.mean < 200) {
      console.log(`  Assessment:       ⚠ Acceptable (<200ms)`);
    } else {
      console.log(`  Assessment:       ✗ Poor (>200ms)`);
    }
    console.log('');
  });
}

// Analyze progressive load results
if (results.progressive.length > 0) {
  console.log('=== PROGRESSIVE LOAD ANALYSIS ===\n');

  results.progressive.forEach(({ file, data }) => {
    console.log(`File: ${file}\n`);

    if (Array.isArray(data)) {
      // Create comparison table
      console.log('Scenario          | Connections | Avg Latency | p95      | p99      | Req/sec | Errors');
      console.log('------------------|-------------|-------------|----------|----------|---------|-------');

      data.forEach(test => {
        const scenario = test.scenario.padEnd(17);
        const connections = test.connections.toString().padStart(11);
        const avgLatency = `${test.metrics.latencyMean.toFixed(1)} ms`.padStart(11);
        const p95 = `${test.metrics.latencyP95.toFixed(1)} ms`.padStart(8);
        const p99 = `${test.metrics.latencyP99.toFixed(1)} ms`.padStart(8);
        const reqPerSec = test.metrics.requestsPerSecond.toFixed(1).padStart(7);
        const errors = (test.metrics.errors + test.metrics.non2xx).toString().padStart(7);

        console.log(`${scenario}| ${connections} | ${avgLatency} | ${p95} | ${p99} | ${reqPerSec} | ${errors}`);
      });

      console.log('\n');

      // Find degradation point
      let degraded = false;
      for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];

        const latencyIncrease = ((curr.metrics.latencyMean - prev.metrics.latencyMean) / prev.metrics.latencyMean) * 100;
        const hasErrors = curr.metrics.errors > 0 || curr.metrics.non2xx > 0;

        if (latencyIncrease > 50 || curr.metrics.latencyMean > 500 || hasErrors) {
          console.log(`⚠ Performance Degradation Detected:`);
          console.log(`  Scenario:         ${curr.scenario}`);
          console.log(`  Connections:      ${curr.connections}`);
          console.log(`  Latency Increase: ${latencyIncrease.toFixed(1)}%`);
          console.log(`  Average Latency:  ${curr.metrics.latencyMean.toFixed(2)} ms`);
          console.log(`  p99 Latency:      ${curr.metrics.latencyP99.toFixed(2)} ms`);
          if (hasErrors) {
            console.log(`  Errors:           ${curr.metrics.errors + curr.metrics.non2xx}`);
          }
          degraded = true;
          break;
        }
      }

      if (!degraded) {
        const last = data[data.length - 1];
        console.log(`✓ System handled ${last.connections} concurrent users well`);
        console.log(`  Final avg latency: ${last.metrics.latencyMean.toFixed(2)} ms`);
        console.log(`  Final p99 latency: ${last.metrics.latencyP99.toFixed(2)} ms`);
      }

      console.log('\n');

      // Capacity recommendations
      const acceptableTests = data.filter(t =>
        t.metrics.latencyMean < 500 &&
        t.metrics.latencyP99 < 1000 &&
        (t.metrics.errors + t.metrics.non2xx) === 0
      );

      if (acceptableTests.length > 0) {
        const maxCapacity = Math.max(...acceptableTests.map(t => t.connections));
        console.log(`📊 Capacity Recommendation:`);
        console.log(`  Maximum safe capacity: ${maxCapacity} concurrent users`);
        console.log(`  Recommended limit:     ${Math.floor(maxCapacity * 0.7)} users (70% of max)`);
      }
    }
    console.log('');
  });
}

// Analyze endpoint comparison results
if (results.endpoints.length > 0) {
  console.log('=== ENDPOINT PERFORMANCE COMPARISON ===\n');

  results.endpoints.forEach(({ file, data }) => {
    console.log(`File: ${file}\n`);

    if (Array.isArray(data)) {
      // Create comparison table
      console.log('Endpoint                | Avg Latency | p95      | p99      | Req/sec | Errors');
      console.log('------------------------|-------------|----------|----------|---------|-------');

      data.forEach(test => {
        const endpoint = test.endpoint.padEnd(23);
        const avgLatency = `${test.metrics.latencyMean.toFixed(1)} ms`.padStart(11);
        const p95 = `${test.metrics.latencyP95.toFixed(1)} ms`.padStart(8);
        const p99 = `${test.metrics.latencyP99.toFixed(1)} ms`.padStart(8);
        const reqPerSec = test.metrics.requestsPerSecond.toFixed(1).padStart(7);
        const errors = (test.metrics.errors + test.metrics.non2xx).toString().padStart(7);

        console.log(`${endpoint}| ${avgLatency} | ${p95} | ${p99} | ${reqPerSec} | ${errors}`);
      });

      console.log('\n');

      // Find bottleneck endpoints
      const sorted = [...data].sort((a, b) => b.metrics.latencyMean - a.metrics.latencyMean);

      console.log('🐌 Slowest Endpoints:');
      sorted.slice(0, 3).forEach((test, i) => {
        console.log(`  ${i + 1}. ${test.endpoint}`);
        console.log(`     Avg: ${test.metrics.latencyMean.toFixed(2)} ms, p99: ${test.metrics.latencyP99.toFixed(2)} ms`);
      });

      console.log('\n⚡ Fastest Endpoints:');
      sorted.slice(-3).reverse().forEach((test, i) => {
        console.log(`  ${i + 1}. ${test.endpoint}`);
        console.log(`     Avg: ${test.metrics.latencyMean.toFixed(2)} ms, p99: ${test.metrics.latencyP99.toFixed(2)} ms`);
      });

      console.log('\n');

      // Authentication overhead analysis
      const authEndpoints = data.filter(t => t.requiresAuth);
      const noAuthEndpoints = data.filter(t => !t.requiresAuth);

      if (authEndpoints.length > 0 && noAuthEndpoints.length > 0) {
        const avgAuthLatency = authEndpoints.reduce((sum, t) => sum + t.metrics.latencyMean, 0) / authEndpoints.length;
        const avgNoAuthLatency = noAuthEndpoints.reduce((sum, t) => sum + t.metrics.latencyMean, 0) / noAuthEndpoints.length;

        console.log('🔐 Authentication Overhead:');
        console.log(`  Avg latency (with auth):    ${avgAuthLatency.toFixed(2)} ms`);
        console.log(`  Avg latency (without auth): ${avgNoAuthLatency.toFixed(2)} ms`);
        console.log(`  Overhead:                   ${(avgAuthLatency - avgNoAuthLatency).toFixed(2)} ms`);
      }
    }
    console.log('');
  });
}

// Overall recommendations
console.log('=== RECOMMENDATIONS ===\n');

const allTests = [
  ...results.baseline.map(r => r.data),
  ...results.progressive.flatMap(r => Array.isArray(r.data) ? r.data.map(t => t.fullResult || t) : [r.data]),
  ...results.endpoints.flatMap(r => Array.isArray(r.data) ? r.data.map(t => t.fullResult || t) : [r.data])
].filter(Boolean);

if (allTests.length === 0) {
  console.log('Not enough data for recommendations');
} else {
  const hasHighLatency = allTests.some(t =>
    (t.latency?.mean || t.metrics?.latencyMean) > 500
  );

  const hasErrors = allTests.some(t =>
    (t.errors || 0) + (t.non2xx || 0) + (t.metrics?.errors || 0) + (t.metrics?.non2xx || 0) > 0
  );

  const hasPoorTailLatency = allTests.some(t =>
    (t.latency?.p99 || t.metrics?.latencyP99) > 1000
  );

  if (hasHighLatency) {
    console.log('⚠ High average latency detected (>500ms)');
    console.log('  Consider:');
    console.log('  - Database query optimization');
    console.log('  - Adding database indexes');
    console.log('  - Implementing caching');
    console.log('');
  }

  if (hasPoorTailLatency) {
    console.log('⚠ Poor tail latency detected (p99 >1s)');
    console.log('  Consider:');
    console.log('  - Connection pool tuning');
    console.log('  - Identifying slow queries');
    console.log('  - Rate limiting heavy operations');
    console.log('');
  }

  if (hasErrors) {
    console.log('⚠ Errors detected during testing');
    console.log('  Consider:');
    console.log('  - Increasing connection pool size');
    console.log('  - Adding request timeout handling');
    console.log('  - Implementing circuit breakers');
    console.log('');
  }

  if (!hasHighLatency && !hasErrors && !hasPoorTailLatency) {
    console.log('✓ System performance is good!');
    console.log('  Continue monitoring and testing as load increases');
    console.log('');
  }
}

console.log('=== END OF ANALYSIS ===\n');
