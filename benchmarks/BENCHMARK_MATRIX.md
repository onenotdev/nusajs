# Benchmark Matrix

| ID | Fixture | Mode | Primary metrics | Correctness and security prerequisite |
|---|---|---|---|---|
| B01 | hello-static | production | HTML/JS size, build | semantic HTML parity; no hidden client runtime |
| B02 | static-1000 | production | build time, memory | 1,000 valid URLs; escaped output |
| B03 | ssr-minimal | production | RPS, p50/p95/p99 | status/body/header parity; request isolation |
| B04 | ssr-data | production | TTFB, abort | loader cancellation and redaction pass |
| B05 | islands-10 | production | JS size, interaction latency | all islands work; CSP/XSS suite passes |
| B06 | dashboard | production | route transition | authz and private-cache semantics match |
| B07 | api-json | production | throughput, memory | identical payload and body limits |
| B08 | routes-10k | build/runtime | scan and match | collisions and malicious paths validated |
| B09 | monorepo | development/build | cold, HMR, build | dependency boundaries pass |
| B10 | rebuild | development | HMR latency | browser reflects change; HMR origin check active |
| B11 | security-overhead | production | latency and size delta | all strict controls enabled and passing |

## Output schema

```json
{
  "framework": "[FRAMEWORK_NAME]",
  "version": "0.0.0",
  "fixture": "B01",
  "commit": "...",
  "environment": {
    "os": "...",
    "cpu": "...",
    "memory": "...",
    "runtime": "..."
  },
  "configHash": "...",
  "correctness": "pass",
  "security": "pass",
  "samples": [],
  "summary": {
    "median": 0,
    "p95": 0,
    "p99": 0
  }
}
```

