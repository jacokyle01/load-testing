const autocannon = require("autocannon");

async function runTest() {
	const result = await autocannon({
		url: "http://localhost:3001/api/articles",
		connections: 50,
		duration: 20,
	});

	console.log("result", result);

	const p90 = result.latency.p90;
	const p99 = result.latency.p99;

	console.log("p90:", p90);
	console.log("p99:", p99);

	// REQUIRED TAIL LATENCY THRESHOLDS
	const SLO_P90 = 150;
	const SLO_P99 = 300;

	if (p90 > SLO_P90 || p99 > SLO_P99) {
		console.error("❌ Performance regression detected!");
		console.error(`p90=${p90}, p99=${p99}`);
		process.exit(1); // <-- fail the test
	}

	console.log("✅ Performance requirements met.");
	process.exit(0);
}

runTest();
