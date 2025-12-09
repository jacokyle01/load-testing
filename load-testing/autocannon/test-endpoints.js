#!/usr/bin/env node

/**
 * Individual Endpoint Testing
 *
 * Tests specific endpoints with authentication where needed
 * Compares performance across different endpoint types
 */

const autocannon = require('autocannon');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_EMAIL = 'loadtest@example.com';
const TEST_USER_PASSWORD = 'password123';

let authToken = null;

// Test configuration
const config = {
  connections: 50,
  duration: 60
};

const endpoints = [
  {
    name: 'Tags (Simple Query)',
    method: 'GET',
    path: '/api/tags',
    requiresAuth: false,
    description: 'Simple endpoint with no auth, basic query'
  },
  {
    name: 'User Registration',
    method: 'POST',
    path: '/api/users',
    requiresAuth: false,
    description: 'CPU-intensive (bcrypt hashing)',
    body: () => ({
      user: {
        username: `user${Date.now()}${Math.random()}`,
        email: `user${Date.now()}${Math.random()}@test.com`,
        password: 'password123'
      }
    })
  },
  {
    name: 'Articles List',
    method: 'GET',
    path: '/api/articles?limit=20',
    requiresAuth: false,
    description: 'Complex query with pagination'
  },
  {
    name: 'Articles Feed (Auth)',
    method: 'GET',
    path: '/api/articles/feed?limit=20',
    requiresAuth: true,
    description: 'Personalized feed, requires auth'
  }
];

async function registerAndLogin() {
  return new Promise((resolve, reject) => {
    const username = `loadtest${Date.now()}`;
    const postData = JSON.stringify({
      user: {
        username: username,
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD
      }
    });

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('Registering test user for authenticated endpoints...');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const result = JSON.parse(data);
            authToken = result.user.token;
            console.log('✓ Test user registered successfully');
            resolve();
          } catch (e) {
            reject(new Error('Failed to parse registration response'));
          }
        } else {
          // Try login instead
          loginUser(resolve, reject);
        }
      });
    });

    req.on('error', (e) => {
      console.log('Registration failed, trying login...');
      loginUser(resolve, reject);
    });

    req.write(postData);
    req.end();
  });
}

function loginUser(resolve, reject) {
  const postData = JSON.stringify({
    user: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD
    }
  });

  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/users/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const result = JSON.parse(data);
          authToken = result.user.token;
          console.log('✓ Test user logged in successfully');
          resolve();
        } catch (e) {
          reject(new Error('Failed to parse login response'));
        }
      } else {
        reject(new Error(`Login failed with status ${res.statusCode}`));
      }
    });
  });

  req.on('error', reject);
  req.write(postData);
  req.end();
}

const results = [];
let currentIndex = 0;

function runNextTest() {
  if (currentIndex >= endpoints.length) {
    console.log('\n=== ALL ENDPOINT TESTS COMPLETED ===\n');
    saveResults();
    return;
  }

  const endpoint = endpoints[currentIndex];

  if (endpoint.requiresAuth && !authToken) {
    console.error(`\n✗ Cannot test ${endpoint.name} - no auth token available\n`);
    currentIndex++;
    runNextTest();
    return;
  }

  console.log(`\n=== Testing: ${endpoint.name} ===`);
  console.log(`Description: ${endpoint.description}`);
  console.log(`Method: ${endpoint.method} ${endpoint.path}`);
  console.log(`Auth required: ${endpoint.requiresAuth}`);
  console.log('---\n');

  const testConfig = {
    url: `${BASE_URL}${endpoint.path}`,
    method: endpoint.method,
    connections: config.connections,
    duration: config.duration,
    pipelining: 1,
    headers: endpoint.requiresAuth ? {
      'Authorization': `Token ${authToken}`
    } : {},
    title: endpoint.name
  };

  if (endpoint.body) {
    testConfig.body = JSON.stringify(endpoint.body());
    testConfig.headers['Content-Type'] = 'application/json';
  }

  autocannon(testConfig, (err, result) => {
    if (err) {
      console.error('Error running test:', err);
      currentIndex++;
      runNextTest();
      return;
    }

    console.log(`Requests:        ${result.requests.total} total, ${result.requests.average.toFixed(2)} req/sec`);
    console.log(`Latency:         ${result.latency.mean.toFixed(2)} ms average`);
    console.log(`  - p50:         ${result.latency.p50} ms`);
    console.log(`  - p95:         ${result.latency.p95} ms`);
    console.log(`  - p99:         ${result.latency.p99} ms`);
    console.log(`Throughput:      ${(result.throughput.mean / 1024).toFixed(2)} KB/sec`);
    console.log(`Errors:          ${result.errors} (${result.non2xx} non-2xx)`);

    results.push({
      endpoint: endpoint.name,
      description: endpoint.description,
      method: endpoint.method,
      path: endpoint.path,
      requiresAuth: endpoint.requiresAuth,
      config: {
        connections: config.connections,
        duration: config.duration
      },
      metrics: {
        totalRequests: result.requests.total,
        requestsPerSecond: result.requests.average,
        latencyMean: result.latency.mean,
        latencyP50: result.latency.p50 || 0,
        latencyP95: result.latency.p95 || 0,
        latencyP99: result.latency.p99 || 0,
        latencyMax: result.latency.max,
        throughputMean: result.throughput.mean,
        errors: result.errors,
        non2xx: result.non2xx,
        timeouts: result.timeouts
      }
    });

    currentIndex++;
    setTimeout(runNextTest, 5000);
  });
}

function saveResults() {
  const resultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `endpoint-comparison-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${filepath}`);

  // Comparison table
  console.log('\n=== ENDPOINT PERFORMANCE COMPARISON ===\n');
  console.log('Endpoint                | Avg Latency | p95 Latency | p99 Latency | Req/sec | Errors');
  console.log('------------------------|-------------|-------------|-------------|---------|-------');

  results.forEach(r => {
    const name = r.endpoint.padEnd(23);
    const avgLatency = `${(r.metrics.latencyMean || 0).toFixed(2)} ms`.padStart(11);
    const p95Latency = `${(r.metrics.latencyP95 || 0).toFixed(2)} ms`.padStart(11);
    const p99Latency = `${(r.metrics.latencyP99 || 0).toFixed(2)} ms`.padStart(11);
    const reqPerSec = (r.metrics.requestsPerSecond || 0).toFixed(2).padStart(7);
    const errors = (r.metrics.errors + r.metrics.non2xx).toString().padStart(7);

    console.log(`${name}| ${avgLatency} | ${p95Latency} | ${p99Latency} | ${reqPerSec} | ${errors}`);
  });

  // Analysis
  console.log('\n=== ANALYSIS ===\n');

  const sortedByLatency = [...results].sort((a, b) => b.metrics.latencyMean - a.metrics.latencyMean);
  console.log('Slowest endpoint:', sortedByLatency[0].endpoint,
    `(${sortedByLatency[0].metrics.latencyMean.toFixed(2)} ms avg)`);
  console.log('Fastest endpoint:', sortedByLatency[sortedByLatency.length - 1].endpoint,
    `(${sortedByLatency[sortedByLatency.length - 1].metrics.latencyMean.toFixed(2)} ms avg)`);

  const authEndpoints = results.filter(r => r.requiresAuth);
  const noAuthEndpoints = results.filter(r => !r.requiresAuth);

  if (authEndpoints.length > 0 && noAuthEndpoints.length > 0) {
    const avgAuthLatency = authEndpoints.reduce((sum, r) => sum + r.metrics.latencyMean, 0) / authEndpoints.length;
    const avgNoAuthLatency = noAuthEndpoints.reduce((sum, r) => sum + r.metrics.latencyMean, 0) / noAuthEndpoints.length;

    console.log(`\nAuthentication overhead: ${(avgAuthLatency - avgNoAuthLatency).toFixed(2)} ms average`);
  }
}

// Start tests
console.log('=== AUTOCANNON ENDPOINT COMPARISON TEST ===\n');
console.log(`Testing URL: ${BASE_URL}`);
console.log(`Configuration: ${config.connections} connections, ${config.duration}s duration`);
console.log(`Total endpoints: ${endpoints.length}`);
console.log('---');

// Check if we need auth token
const needsAuth = endpoints.some(e => e.requiresAuth);

if (needsAuth) {
  registerAndLogin()
    .then(() => {
      console.log('\nStarting tests...\n');
      runNextTest();
    })
    .catch((err) => {
      console.error('Failed to setup auth:', err.message);
      console.log('Proceeding with non-auth endpoints only...\n');
      runNextTest();
    });
} else {
  runNextTest();
}
