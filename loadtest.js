const autocannon = require('autocannon');

const BASE = 'http://localhost:3001/api';

async function run() {
  console.log("Running load test...");

  const instance = autocannon({
    url: BASE,
    connections: 50,          // number of concurrent users
    duration: 20,             // total seconds to test
    headers: {
      Authorization: "Token <YOUR_JWT>",
      "Content-Type": "application/json"
    },
    requests: [
      { method: 'GET', path: '/articles' },
      { method: 'GET', path: '/articles/feed' },
      { method: 'GET', path: '/articles/my-first-post' },
      {
        method: 'POST',
        path: '/articles',
        body: JSON.stringify({
          article: {
            title: "Load test post",
            description: "Testing",
            body: "Load testing body",
            tagList: ["test"]
          }
        })
      }
    ]
  });

  autocannon.track(instance); // live console progress
}

run();
