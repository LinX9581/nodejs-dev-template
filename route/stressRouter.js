import express from "express";
import { createHash } from "crypto";
import { performance } from "perf_hooks";
import { asyncHandler } from "../log/asyncHandler.js";
import { requestJson } from "../lib/upstreamHttpClient.js";

const router = express.Router();

const STRESS_DEFAULT_WAIT_MS = parsePositiveInt(process.env.STRESS_DEFAULT_WAIT_MS, 25);
const STRESS_DEFAULT_PAYLOAD_KB = parsePositiveInt(process.env.STRESS_DEFAULT_PAYLOAD_KB, 16);
const STRESS_REQUEST_TIMEOUT_MS = parsePositiveInt(process.env.STRESS_REQUEST_TIMEOUT_MS, 8000);

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeBaseUrl(url) {
  return (url || "").trim().replace(/\/+$/, "");
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

router.get("/stress", asyncHandler(async (req, res) => {
  res.render("stress-home", {
    title: "Stress Tools",
    backendBaseUrl: normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL)
  });
}));

router.post("/stress/api/call-backend", asyncHandler(async (req, res) => {
  const backendBaseUrl = normalizeBaseUrl(process.env.STRESS_BACKEND_BASE_URL);
  if (!backendBaseUrl) {
    return res.status(400).json({ status: "error", message: "STRESS_BACKEND_BASE_URL is not set" });
  }

  const startedAt = performance.now();
  const waitMs = clamp(parsePositiveInt(req.body.waitMs, STRESS_DEFAULT_WAIT_MS), 1, 2000);
  const payloadKb = clamp(parsePositiveInt(req.body.payloadKb, STRESS_DEFAULT_PAYLOAD_KB), 1, 256);
  const timeoutMs = clamp(parsePositiveInt(req.body.timeoutMs, STRESS_REQUEST_TIMEOUT_MS), 1000, 30000);
  const runId = `ui-${Date.now()}`;

  try {
    const target = `${backendBaseUrl}/stress/backend/work?runId=${encodeURIComponent(runId)}&sequence=1&waitMs=${waitMs}&payloadKb=${payloadKb}`;
    const responseBody = await requestJson(target, { timeoutMs });

    res.json({
      status: "ok",
      runId,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      backendNode: responseBody.node,
      backendDurationMs: responseBody.durationMs
    });
  } catch (error) {
    res.status(502).json({
      status: "error",
      runId,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      error: error?.code || error?.message || "UNKNOWN_ERROR"
    });
  }
}));

router.get("/stress/backend/work", asyncHandler(async (req, res) => {
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

export default router;
