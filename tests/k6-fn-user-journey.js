import http from "k6/http";
import { check, sleep } from "k6";

const FN_BASE = "https://nodejs.linx.bar";

export const options = {
  scenarios: {
    fn_user_journey: {
      executor: "ramping-vus",
      exec: "testFnUserJourney",
      startVUs: 20,
      stages: [
        { duration: "1m", target: 300 },
        // { duration: "2m", target: 600 },
        // { duration: "2m", target: 200 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
    "http_req_duration{scenario:fn_user_journey}": ["p(95)<2000"],
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

function randomThinkTime() {
  return 0.3 + Math.random() * 1.2;
}

export function testFnUserJourney() {
  const pageRes = http.get(`${FN_BASE}/stress`, {
    tags: { scenario: "fn_user_journey", step: "page_load" },
    timeout: "15s",
  });

  check(pageRes, {
    "fn page status 200": (r) => r.status === 200,
    "fn page has auto call": (r) => r.body && r.body.includes("/stress/api/call-backend"),
  });

  sleep(0.2);

  const payload = JSON.stringify({
    waitMs: 5,
    payloadKb: 16,
    timeoutMs: 10000,
  });

  const res = http.post(`${FN_BASE}/stress/api/call-backend`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { scenario: "fn_user_journey", step: "call_backend" },
    timeout: "15s",
  });

  const body = safeJson(res);

  check(res, {
    "fn status 200": (r) => r.status === 200,
    "fn body status ok": () => body && body.status === "ok",
  });

  sleep(randomThinkTime());
}
