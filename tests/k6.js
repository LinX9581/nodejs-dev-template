  import http from "k6/http";
  import { check, sleep } from "k6";

  const FN_BASE = __ENV.FN_BASE || "https://nodejs.linx.bar";
  const BN_BASE = __ENV.BN_BASE || "https://nodejs-bn.linx.bar";

  export const options = {
    scenarios: {
    //   fn_fanout: {
    //     executor: "ramping-vus",
    //     exec: "testFnFanout",
    //     startVUs: 10,
    //     stages: [
    //       { duration: "2m", target: 300 },
    //       { duration: "3m", target: 350 },
    //       { duration: "2m", target: 100 },
    //     ],
    //     gracefulRampDown: "30s",
    //   },
      bn_direct: {
        executor: "ramping-vus",
        exec: "testBnDirect",
        startVUs: 20,
        stages: [
          { duration: "2m", target: 300 },
          { duration: "3m", target: 350 },
          { duration: "2m", target: 100 },
        ],
        gracefulRampDown: "30s",
      },
    },
    thresholds: {
      http_req_failed: ["rate<0.01"],
      http_req_duration: ["p(95)<1200"],
      "http_req_duration{scenario:fn_fanout}": ["p(95)<1500"],
      "http_req_duration{scenario:bn_direct}": ["p(95)<500"],
    },
  };

//   export function testFnFanout() {
//     const payload = JSON.stringify({
//       fanout: 2,
//       waitMs: 25,
//       payloadKb: 16,
//       timeoutMs: 8000,
//     });

//     const res = http.post(`${FN_BASE}/stress/api/fanout`, payload, {
//       headers: { "Content-Type": "application/json" },
//       tags: { scenario: "fn_fanout" },
//       timeout: "10s",
//     });

//     check(res, {
//       "fn status 200": (r) => r.status === 200,
//       "fn json success/partial": (r) => {
//         const j = r.json();
//         return j && (j.status === "success" || j.status === "partial");
//       },
//     });

//     sleep(0.2);
//   }

  export function testBnDirect() {
    const url = `${BN_BASE}/stress/backend/work?waitMs=25&payloadKb=16`;

    const res = http.get(url, {
      tags: { scenario: "bn_direct" },
      timeout: "5s",
    });

    check(res, {
      "bn status 200": (r) => r.status === 200,
      "bn body ok": (r) => r.json("status") === "ok",
    });

    sleep(0.1);
  }