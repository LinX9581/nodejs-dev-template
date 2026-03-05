import express from "express";
import { createHash } from "crypto";
import http from "http";
import https from "https";
import { monitorEventLoopDelay, performance } from "perf_hooks";
import { logUserAccess } from "../log/userAccess.js";
import { asyncHandler } from "../log/asyncHandler.js";

const router = express.Router();

const STRESS_DEFAULT_FANOUT = parsePositiveInt(process.env.STRESS_DEFAULT_FANOUT, 8);
const STRESS_MAX_FANOUT = parsePositiveInt(process.env.STRESS_MAX_FANOUT, 200);
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
  fanoutInFlight: 0,
  upstreamInFlight: 0,
  totalFanoutRequests: 0,
  totalUpstreamRequests: 0,
  totalUpstreamFailures: 0
};

const recentErrors = [];

const normalizeBaseUrl = (url) => (url || "").trim().replace(/\/+$/, "");

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index];
}

function toMs(nanoseconds) {
  return Number((nanoseconds / 1e6).toFixed(2));
}

function agentStats(agent) {
  const activeSockets = Object.values(agent.sockets).reduce((sum, list) => sum + list.length, 0);
  const idleSockets = Object.values(agent.freeSockets).reduce((sum, list) => sum + list.length, 0);
  const queuedRequests = Object.values(agent.requests).reduce((sum, list) => sum + list.length, 0);

  return {
    activeSockets,
    idleSockets,
    queuedRequests
  };
}

function renderPrometheusMetrics() {
  const memoryUsage = process.memoryUsage();
  const httpStats = agentStats(upstreamHttpAgent);
  const httpsStats = agentStats(upstreamHttpsAgent);
  const hostname = (process.env.HOSTNAME || "local").replace(/"/g, '\\"');

  const lines = [
    "# HELP app_stress_fanout_in_flight Current in-flight fanout requests.",
    "# TYPE app_stress_fanout_in_flight gauge",
    `app_stress_fanout_in_flight{hostname="${hostname}"} ${runtimeCounters.fanoutInFlight}`,
    "# HELP app_stress_upstream_in_flight Current in-flight upstream requests.",
    "# TYPE app_stress_upstream_in_flight gauge",
    `app_stress_upstream_in_flight{hostname="${hostname}"} ${runtimeCounters.upstreamInFlight}`,
    "# HELP app_stress_total_fanout_requests Total fanout requests served.",
    "# TYPE app_stress_total_fanout_requests counter",
    `app_stress_total_fanout_requests{hostname="${hostname}"} ${runtimeCounters.totalFanoutRequests}`,
    "# HELP app_stress_total_upstream_requests Total upstream requests sent.",
    "# TYPE app_stress_total_upstream_requests counter",
    `app_stress_total_upstream_requests{hostname="${hostname}"} ${runtimeCounters.totalUpstreamRequests}`,
    "# HELP app_stress_total_upstream_failures Total upstream failures.",
    "# TYPE app_stress_total_upstream_failures counter",
    `app_stress_total_upstream_failures{hostname="${hostname}"} ${runtimeCounters.totalUpstreamFailures}`,
    "# HELP app_stress_http_agent_active_sockets Active HTTP upstream sockets.",
    "# TYPE app_stress_http_agent_active_sockets gauge",
    `app_stress_http_agent_active_sockets{hostname="${hostname}"} ${httpStats.activeSockets}`,
    "# HELP app_stress_http_agent_idle_sockets Idle HTTP upstream sockets.",
    "# TYPE app_stress_http_agent_idle_sockets gauge",
    `app_stress_http_agent_idle_sockets{hostname="${hostname}"} ${httpStats.idleSockets}`,
    "# HELP app_stress_http_agent_queued_requests Queued HTTP upstream requests.",
    "# TYPE app_stress_http_agent_queued_requests gauge",
    `app_stress_http_agent_queued_requests{hostname="${hostname}"} ${httpStats.queuedRequests}`,
    "# HELP app_stress_https_agent_active_sockets Active HTTPS upstream sockets.",
    "# TYPE app_stress_https_agent_active_sockets gauge",
    `app_stress_https_agent_active_sockets{hostname="${hostname}"} ${httpsStats.activeSockets}`,
    "# HELP app_stress_https_agent_idle_sockets Idle HTTPS upstream sockets.",
    "# TYPE app_stress_https_agent_idle_sockets gauge",
    `app_stress_https_agent_idle_sockets{hostname="${hostname}"} ${httpsStats.idleSockets}`,
    "# HELP app_stress_https_agent_queued_requests Queued HTTPS upstream requests.",
    "# TYPE app_stress_https_agent_queued_requests gauge",
    `app_stress_https_agent_queued_requests{hostname="${hostname}"} ${httpsStats.queuedRequests}`,
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

    runtimeCounters.upstreamInFlight += 1;
    runtimeCounters.totalUpstreamRequests += 1;

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
        runtimeCounters.upstreamInFlight -= 1;
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
      runtimeCounters.upstreamInFlight -= 1;
      reject(err);
    });

    req.end();
  });
}

router.get("/stress", logUserAccess("壓測頁面訪問"), asyncHandler(async (req, res) => {
  res.render("stress", {
    title: "Node.js Stress Test",
    backendBaseUrl: normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL),
    frontendBaseUrl: normalizeBaseUrl(process.env.STRESS_FRONTEND_BASE_URL),
    defaults: {
      fanout: STRESS_DEFAULT_FANOUT,
      waitMs: STRESS_DEFAULT_WAIT_MS,
      payloadKb: STRESS_DEFAULT_PAYLOAD_KB
    }
  });
}));

router.get("/stress/backend/work", logUserAccess("壓測後端工作端點"), asyncHandler(async (req, res) => {
  const waitMs = clamp(parsePositiveInt(req.query.waitMs, STRESS_DEFAULT_WAIT_MS), 1, 2000);
  const payloadKb = clamp(parsePositiveInt(req.query.payloadKb, STRESS_DEFAULT_PAYLOAD_KB), 1, 256);
  const runId = String(req.query.runId || "direct");
  const sequence = clamp(parsePositiveInt(req.query.sequence, 1), 1, 1000000);

  const result = await runWorkerTask(waitMs, payloadKb, runId, sequence);

  res.json({
    status: "ok",
    node: process.env.HOSTNAME || "local",
    runId,
    sequence,
    ...result
  });
}));

router.post("/stress/api/fanout", logUserAccess("壓測 fanout 執行"), asyncHandler(async (req, res) => {
  runtimeCounters.fanoutInFlight += 1;
  runtimeCounters.totalFanoutRequests += 1;

  const backendBaseUrl = normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL);
  const runId = `run-${Date.now()}`;

  const fanout = clamp(parsePositiveInt(req.body.fanout, STRESS_DEFAULT_FANOUT), 1, STRESS_MAX_FANOUT);
  const waitMs = clamp(parsePositiveInt(req.body.waitMs, STRESS_DEFAULT_WAIT_MS), 1, 2000);
  const payloadKb = clamp(parsePositiveInt(req.body.payloadKb, STRESS_DEFAULT_PAYLOAD_KB), 1, 256);
  const timeoutMs = clamp(parsePositiveInt(req.body.timeoutMs, STRESS_REQUEST_TIMEOUT_MS), 1000, 30000);

  const startedAt = performance.now();
  const callResults = await Promise.all(Array.from({ length: fanout }, async (_, i) => {
    const sequence = i + 1;
    const itemStartedAt = performance.now();

    try {
      let responseBody;
      if (backendBaseUrl) {
        const target = `${backendBaseUrl}/stress/backend/work?runId=${encodeURIComponent(runId)}&sequence=${sequence}&waitMs=${waitMs}&payloadKb=${payloadKb}`;
        responseBody = await fetchJsonWithKeepAlive(target, timeoutMs);
      } else {
        responseBody = await runWorkerTask(waitMs, payloadKb, runId, sequence);
      }

      return {
        ok: true,
        sequence,
        durationMs: Number((performance.now() - itemStartedAt).toFixed(2)),
        checksum: responseBody.checksum
      };
    } catch (error) {
      return {
        ok: false,
        sequence,
        durationMs: Number((performance.now() - itemStartedAt).toFixed(2)),
        error: error?.code || error?.message || "UNKNOWN_ERROR"
      };
    }
  }));

  const durationMsList = callResults.map((item) => item.durationMs);
  const successCount = callResults.filter((item) => item.ok).length;
  const failCount = callResults.length - successCount;
  runtimeCounters.totalUpstreamFailures += failCount;

  if (failCount > 0) {
    recentErrors.push({
      ts: new Date().toISOString(),
      runId,
      failCount,
      sample: callResults.find((item) => !item.ok)?.error || "UNKNOWN_ERROR"
    });

    if (recentErrors.length > 20) {
      recentErrors.shift();
    }
  }

  runtimeCounters.fanoutInFlight -= 1;

  res.json({
    status: failCount === 0 ? "success" : "partial",
    runId,
    mode: backendBaseUrl ? "remote-backend" : "local-fallback",
    backendBaseUrl: backendBaseUrl || null,
    summary: {
      fanout,
      successCount,
      failCount,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      minMs: Number(Math.min(...durationMsList).toFixed(2)),
      p95Ms: Number(percentile(durationMsList, 0.95).toFixed(2)),
      maxMs: Number(Math.max(...durationMsList).toFixed(2))
    },
    samples: callResults.slice(0, 5)
  });
}));

router.get("/stress/api/metrics", asyncHandler(async (req, res) => {
  const memoryUsage = process.memoryUsage();

  res.json({
    status: "ok",
    runtime: {
      pid: process.pid,
      hostname: process.env.HOSTNAME || "local",
      uptimeSec: Number(process.uptime().toFixed(1))
    },
    counters: runtimeCounters,
    agent: {
      http: agentStats(upstreamHttpAgent),
      https: agentStats(upstreamHttpsAgent),
      keepAliveMs: STRESS_UPSTREAM_KEEPALIVE_MS,
      maxSockets: STRESS_UPSTREAM_MAX_SOCKETS,
      maxFreeSockets: STRESS_UPSTREAM_MAX_FREE_SOCKETS
    },
    node: {
      memoryMb: {
        rss: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
        heapUsed: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotal: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
        external: Number((memoryUsage.external / 1024 / 1024).toFixed(2))
      },
      eventLoopDelayMs: {
        mean: toMs(eventLoopHistogram.mean),
        p95: toMs(eventLoopHistogram.percentile(95)),
        max: toMs(eventLoopHistogram.max)
      }
    },
    recentErrors
  });
}));

router.get("/metrics", asyncHandler(async (req, res) => {
  res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(renderPrometheusMetrics());
}));

export default router;
