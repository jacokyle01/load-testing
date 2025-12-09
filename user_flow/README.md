chatGPT compares and contrasts autocannon and locust 

key points: 

- locust has a nice UI to view results 
- its easy to chain requests in locust (creating a realistic user flow)




Yes — you can simulate a workflow or scenario using Autocannon, but not as easily or flexibly as in Locust. Autocannon is fundamentally built for raw HTTP load, not for user-behavior simulation. You need to manually orchestrate request sequences.

Below is:

✔ A full Autocannon example that performs login → store JWT → make authenticated requests

✔ A version that simulates a flow (sequential, dependent actions)

✔ A comparison of Locust vs Autocannon tradeoffs — for load testing webapps

✔ Guidance on when to use which

✅ 1. Autocannon version of your Locust flow (login → get token → hit APIs)
const autocannon = require("autocannon");
const fetch = require("node-fetch");

async function getJwt() {
  const res = await fetch("http://localhost:3001/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: {
        email: "jacokyle01@gmail.com",
        password: "password"
      }
    }),
  });

  const data = await res.json();
  return data.user.token;
}

(async () => {
  const token = await getJwt();

  const instance = autocannon({
    url: "http://localhost:3001",
    connections: 25,
    duration: 20,
    headers: {
      Authorization: `Token ${token}`,
    },
    requests: [
      { method: "GET", path: "/api/articles" },
    ],
  });

  autocannon.track(instance);
})();


This performs only parallel requests, not sequential flows.

✅ 2. Autocannon workflow-mode (simulate sequential actions per connection)

Autocannon supports a “requests as an array” format where the test cycles through steps:

Simulating a user flow with Autocannon
const autocannon = require('autocannon');
const fetch = require("node-fetch");

async function getJwt() {
  const loginRes = await fetch("http://localhost:3001/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: {
        email: "jacokyle01@gmail.com",
        password: "password"
      }
    }),
  });
  const data = await loginRes.json();
  return data.user.token;
}

(async () => {
  const token = await getJwt();

  const instance = autocannon({
    url: "http://localhost:3001",
    connections: 10,
    duration: 20,
    headers: { Authorization: `Token ${token}` },
    requests: [
      { method: "GET", path: "/api/articles" },
      { method: "GET", path: "/api/articles/feed" },
      { method: "GET", path: "/api/articles?limit=5" },
    ]
  });

  autocannon.track(instance);
})();

⚠️ Important:

Autocannon's workflow mode does NOT:

guarantee a real "user scenario"

store or pass dynamic variables between steps

allow branching

allow per-virtual-user state

So you cannot do:

login per user

create article and then read that same article

dynamic slugs

deep UI flows

For that, you need Locust.

❗ 3. Autocannon vs Locust — the real tradeoffs
Feature	Autocannon	Locust
Language	Node.js	Python
Best for	High-throughput benchmarking	User-behavior simulation
Scenario modeling	😞 Very limited	😍 Full workflows (login → create → read → delete → …)
Can store per-user state (JWT, IDs)	No	Yes
UI for results	No	Beautiful web UI
Tail latency (p99, p999) enforcement	Easy	Possible but manual
Requests per second	🔥 Extremely high (100k+/s)	Medium
Distributed load	Hard	Built-in distributed cluster mode
Authentication flows	Must be done manually, cannot repeat per user	Native support (on_start, stateful users)
Dynamic data (slugs, IDs)	No	Yes
Realistic delays (wait_time)	No	Yes
CI/CD use	Excellent (fast)	Slower but possible
🧠 When to use Autocannon

Choose Autocannon when you want:

✔ Maximum throughput
✔ Quick performance profiling
✔ p99 latency CI gates (e.g., fail if > 50ms)
✔ Primitive scenario sequences
✔ CI-friendly scripts

🧠 When to use Locust

Choose Locust when you want:

✔ Flows like login → feed → article → comment → logout
✔ Per-user state (JWTs, items created earlier)
✔ Realistic user behavior
✔ distributed load
✔ pretty dashboard + live stats

If you need realism → Locust wins automatically.

⭐ If you want:

I can generate:

a multi-user Autocannon harness

a Locust file performing full Conduit flows (create article, favorite, list)

a CI script that fails the build if p99 latency > threshold

a hybrid approach: Autocannon for load, Locust for flows

Just tell me what you want next.