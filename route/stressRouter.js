import express from "express";
import { createHash } from "crypto";
import http from "http";
import https from "https";
import { monitorEventLoopDelay, performance } from "perf_hooks";
import { asyncHandler } from "../log/asyncHandler.js";

const router = express.Router();

const STRESS_DEFAULT_WAIT_MS = parsePositiveInt(process.env.STRESS_DEFAULT_WAIT_MS, 25);
const STRESS_DEFAULT_PAYLOAD_KB = parsePositiveInt(process.env.STRESS_DEFAULT_PAYLOAD_KB, 16);
const STRESS_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.STRESS_REQUEST_TIMEOUT_MS, 8000);
const STRESS_UPSTREAM_KEEPALIVE_MS = parsePositiveInt(process.env.STRESS_UPSTREAM_KEEPALIVE_MS, 15000);
const STRESS_UPSTREAM_MAX_SOCKETS = parsePositiveInt(process.env.STRESS_UPSTREAM_MAX_SOCKETS, 512);
const STRESS_UPSTREAM_MAX_FREE_SOCKETS = parsePositiveInt(process.env.STRESS_UPSTREAM_MAX_FREE_SOCKETS, 128);

const upstreamHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: STRESS_UPSTREAM_KEEPALIVE_MS,
  maxSockets: STRESS_UPSTREAM_MAX_SOCKETS,
  maxFreeSockets: STRESS_UPSTREAM_MAX_FREE_SOCKETS
});

const upstreamHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: STRESS_UPSTREAM_KEEPALIVE_MS,
  maxSockets: STRESS_UPSTREAM_MAX_SOCKETS,
  maxFreeSockets: STRESS_UPSTREAM_MAX_FREE_SOCKETS
});

const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

const runtimeCounters = {
  backendWorkInFlight: 0,
  backendWorkTotal: 0,
  backendWorkFailures: 0,
  proxyInFlight: 0,
  proxyTotal: 0,
  proxyFailures: 0
};

const BACKEND_WORK_DURATION_BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2000, Infinity];
const backendWorkDurationHistogram = {
  sumMs: 0,
  count: 0,
  buckets: BACKEND_WORK_DURATION_BUCKETS_MS.map((le) => ({ le, value: 0 }))
};

const normalizeBaseUrl = (url) => (url || "").trim().replace(/\/+$/, "");

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toMs(nanoseconds) {
  return Number((nanoseconds / 1e6).toFixed(2));
}

function observeBackendWorkDuration(durationMs) {
  backendWorkDurationHistogram.sumMs += durationMs;
  backendWorkDurationHistogram.count += 1;

  for (const bucket of backendWorkDurationHistogram.buckets) {
    if (durationMs <= bucket.le) {
      bucket.value += 1;
    }
  }
}

function renderPrometheusMetrics() {
  const memoryUsage = process.memoryUsage();
  const hostname = (process.env.HOSTNAME || "local").replace(/"/g, '\\"');

  const lines = [
    "# HELP app_stress_backend_work_in_flight Current in-flight backend work requests.",
    "# TYPE app_stress_backend_work_in_flight gauge",
    `app_stress_backend_work_in_flight{hostname="${hostname}"} ${runtimeCounters.backendWorkInFlight}`,
    "# HELP app_stress_backend_work_total Total backend work requests served.",
    "# TYPE app_stress_backend_work_total counter",
    `app_stress_backend_work_total{hostname="${hostname}"} ${runtimeCounters.backendWorkTotal}`,
    "# HELP app_stress_backend_work_failures_total Total failed backend work requests.",
    "# TYPE app_stress_backend_work_failures_total counter",
    `app_stress_backend_work_failures_total{hostname="${hostname}"} ${runtimeCounters.backendWorkFailures}`,
    "# HELP app_stress_proxy_in_flight Current in-flight proxy-to-backend requests.",
    "# TYPE app_stress_proxy_in_flight gauge",
    `app_stress_proxy_in_flight{hostname="${hostname}"} ${runtimeCounters.proxyInFlight}`,
    "# HELP app_stress_proxy_total Total proxy-to-backend requests.",
    "# TYPE app_stress_proxy_total counter",
    `app_stress_proxy_total{hostname="${hostname}"} ${runtimeCounters.proxyTotal}`,
    "# HELP app_stress_proxy_failures_total Total failed proxy-to-backend requests.",
    "# TYPE app_stress_proxy_failures_total counter",
    `app_stress_proxy_failures_total{hostname="${hostname}"} ${runtimeCounters.proxyFailures}`,
    "# HELP app_stress_event_loop_delay_p95_milliseconds Event loop delay p95 in milliseconds.",
    "# TYPE app_stress_event_loop_delay_p95_milliseconds gauge",
    `app_stress_event_loop_delay_p95_milliseconds{hostname="${hostname}"} ${toMs(eventLoopHistogram.percentile(95))}`,
    "# HELP app_stress_event_loop_delay_max_milliseconds Event loop delay max in milliseconds.",
    "# TYPE app_stress_event_loop_delay_max_milliseconds gauge",
    `app_stress_event_loop_delay_max_milliseconds{hostname="${hostname}"} ${toMs(eventLoopHistogram.max)}`,
    "# HELP app_process_resident_memory_bytes Resident memory size in bytes.",
    "# TYPE app_process_resident_memory_bytes gauge",
    `app_process_resident_memory_bytes{hostname="${hostname}"} ${memoryUsage.rss}`,
    "# HELP app_process_heap_used_bytes V8 heap used in bytes.",
    "# TYPE app_process_heap_used_bytes gauge",
    `app_process_heap_used_bytes{hostname="${hostname}"} ${memoryUsage.heapUsed}`
  ];

  lines.push("# HELP app_stress_backend_work_duration_milliseconds Backend work duration histogram in milliseconds.");
  lines.push("# TYPE app_stress_backend_work_duration_milliseconds histogram");

  for (const bucket of backendWorkDurationHistogram.buckets) {
    const le = Number.isFinite(bucket.le) ? bucket.le : "+Inf";
    lines.push(`app_stress_backend_work_duration_milliseconds_bucket{hostname="${hostname}",le="${le}"} ${bucket.value}`);
  }

  lines.push(`app_stress_backend_work_duration_milliseconds_sum{hostname="${hostname}"} ${Number(backendWorkDurationHistogram.sumMs.toFixed(2))}`);
  lines.push(`app_stress_backend_work_duration_milliseconds_count{hostname="${hostname}"} ${backendWorkDurationHistogram.count}`);

  return `${lines.join("\n")}\n`;
}

async function runWorkerTask(waitMs, payloadKb, runId, sequence) {
  const startedAt = performance.now();
  const payload = "x".repeat(payloadKb * 1024) + `:${runId}:${sequence}:${Date.now()}`;
  const checksum = createHash("sha256").update(payload).digest("hex");

  await new Promise((resolve) => setTimeout(resolve, waitMs));

  return {
    checksum,
    payloadBytes: Buffer.byteLength(payload),
    waitedMs: waitMs,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    pid: process.pid
  };
}

function fetchJsonWithKeepAlive(targetUrl, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const client = url.protocol === "https:" ? https : http;
    const agent = url.protocol === "https:" ? upstreamHttpsAgent : upstreamHttpAgent;

    const req = client.request(url, {
      method: "GET",
      agent,
      timeout: timeoutMs,
      headers: {
        Connection: "keep-alive"
      }
    }, (res) => {
      let raw = "";
      res.setEncoding("utf8");

      res.on("data", (chunk) => {
        raw += chunk;
      });

      res.on("end", () => {
        const statusCode = res.statusCode || 0;
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP_${statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error("INVALID_JSON"));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("UPSTREAM_TIMEOUT"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

router.get("/stress", asyncHandler(async (req, res) => {
  res.render("stress-home", {
    title: "Stress Tools",
    backendBaseUrl: normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL)
  });
}));

router.get("/stress/pure", asyncHandler(async (req, res) => {
  res.render("stress-pure", { title: "Stress Pure Frontend" });
}));

router.get("/stress/call-backend", asyncHandler(async (req, res) => {
  res.render("stress-call", {
    title: "Stress Call Backend",
    backendBaseUrl: normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL),
    defaults: {
      waitMs: STRESS_DEFAULT_WAIT_MS,
      payloadKb: STRESS_DEFAULT_PAYLOAD_KB
    }
  });
}));

router.post("/stress/api/call-backend", asyncHandler(async (req, res) => {
  const backendBaseUrl = normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL);
  if (!backendBaseUrl) {
    return res.status(400).json({ status: "error", message: "STRESS_BACKEND_BASE_URL is not set" });
  }

  runtimeCounters.proxyInFlight += 1;
  runtimeCounters.proxyTotal += 1;
  const startedAt = performance.now();

  const waitMs = clamp(parsePositiveInt(req.body.waitMs, STRESS_DEFAULT_WAIT_MS), 1, 2000);
  const payloadKb = clamp(parsePositiveInt(req.body.payloadKb, STRESS_DEFAULT_PAYLOAD_KB), 1, 256);
  const timeoutMs = clamp(parsePositiveInt(req.body.timeoutMs, STRESS_REQUEST_TIMEOUT_MS), 1000, 30000);
  const runId = `ui-${Date.now()}`;

  try {
    const target = `${backendBaseUrl}/stress/backend/work?runId=${encodeURIComponent(runId)}&sequence=1&waitMs=${waitMs}&payloadKb=${payloadKb}`;
    const responseBody = await fetchJsonWithKeepAlive(target, timeoutMs);

    res.json({
      status: "ok",
      runId,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      backendNode: responseBody.node,
      backendDurationMs: responseBody.durationMs
    });
  } catch (error) {
    runtimeCounters.proxyFailures += 1;
    res.status(502).json({
      status: "error",
      runId,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      error: error?.code || error?.message || "UNKNOWN_ERROR"
    });
  } finally {
    runtimeCounters.proxyInFlight -= 1;
  }
}));

router.get("/stress/backend/work", asyncHandler(async (req, res) => {
  runtimeCounters.backendWorkInFlight += 1;
  runtimeCounters.backendWorkTotal += 1;
  const startedAt = performance.now();

  const waitMs = clamp(parsePositiveInt(req.query.waitMs, STRESS_DEFAULT_WAIT_MS), 1, 2000);
  const payloadKb = clamp(parsePositiveInt(req.query.payloadKb, STRESS_DEFAULT_PAYLOAD_KB), 1, 256);
  const runId = String(req.query.runId || "direct");
  const sequence = clamp(parsePositiveInt(req.query.sequence, 1), 1, 1000000);

  try {
    const result = await runWorkerTask(waitMs, payloadKb, runId, sequence);

    res.json({
      status: "ok",
      node: process.env.HOSTNAME || "local",
      runId,
      sequence,
      ...result
    });
  } catch (error) {
    runtimeCounters.backendWorkFailures += 1;
    throw error;
  } finally {
    observeBackendWorkDuration(performance.now() - startedAt);
    runtimeCounters.backendWorkInFlight -= 1;
  }
}));

router.get("/metrics", asyncHandler(async (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(renderPrometheusMetrics());
}));

export default router;
