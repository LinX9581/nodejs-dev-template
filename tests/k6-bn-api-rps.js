import http from "k6/http";
import { check } from "k6";

const BN_BASE = "https://nodejs-bn.linx.bar";

export const options = {
  scenarios: {
    bn_api_rps: {
      executor: "constant-arrival-rate",
      exec: "testBnApiRps",
      rate: 300,
      timeUnit: "1s",
      duration: "7m",
      preAllocatedVUs: 100,
      maxVUs: 1200,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
    "http_req_duration{scenario:bn_api_rps}": ["p(95)<800"],
  },
};

function safeJson(res) {
  if (!res || !res.body) return null;
  try {
    return res.json();
  } catch {
    return null;
  }
}

export function testBnApiRps() {
  const res = http.get(`${BN_BASE}/stress/backend/work?waitMs=5&payloadKb=16`, {
    tags: { scenario: "bn_api_rps" },
    timeout: "10s",
  });

  const body = safeJson(res);

  check(res, {
    "bn status 200": (r) => r.status === 200,
    "bn body ok": () => body && body.status === "ok",
  });
}
