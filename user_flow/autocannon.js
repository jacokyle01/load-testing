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
