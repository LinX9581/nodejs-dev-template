import http from "http";
import https from "https";

function parsePositiveInt(value, defaultValue) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

const UPSTREAM_KEEPALIVE_MS = parsePositiveInt(
  process.env.UPSTREAM_KEEPALIVE_MS ?? process.env.STRESS_UPSTREAM_KEEPALIVE_MS,
  15000
);
const UPSTREAM_MAX_SOCKETS = parsePositiveInt(
  process.env.UPSTREAM_MAX_SOCKETS ?? process.env.STRESS_UPSTREAM_MAX_SOCKETS,
  512
);
const UPSTREAM_MAX_FREE_SOCKETS = parsePositiveInt(
  process.env.UPSTREAM_MAX_FREE_SOCKETS ?? process.env.STRESS_UPSTREAM_MAX_FREE_SOCKETS,
  128
);

const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: UPSTREAM_KEEPALIVE_MS,
  maxSockets: UPSTREAM_MAX_SOCKETS,
  maxFreeSockets: UPSTREAM_MAX_FREE_SOCKETS
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: UPSTREAM_KEEPALIVE_MS,
  maxSockets: UPSTREAM_MAX_SOCKETS,
  maxFreeSockets: UPSTREAM_MAX_FREE_SOCKETS
});

function buildRequestBody(body) {
  if (body == null) {
    return null;
  }

  if (typeof body === "string" || Buffer.isBuffer(body)) {
    return body;
  }

  return JSON.stringify(body);
}

export function requestJson(targetUrl, options = {}) {
  const {
    method = "GET",
    headers = {},
    timeoutMs = 8000,
    body
  } = options;

  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const client = url.protocol === "https:" ? https : http;
    const agent = url.protocol === "https:" ? httpsAgent : httpAgent;
    const requestBody = buildRequestBody(body);

    const req = client.request(url, {
      method,
      agent,
      timeout: timeoutMs,
      headers: {
        ...headers,
        ...(requestBody && !headers["Content-Length"] ? { "Content-Length": Buffer.byteLength(requestBody) } : {})
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
          const error = new Error(`HTTP_${statusCode}`);
          error.code = `HTTP_${statusCode}`;
          error.statusCode = statusCode;
          error.responseText = raw;
          reject(error);
          return;
        }

        try {
          resolve(raw ? JSON.parse(raw) : null);
        } catch {
          const error = new Error("INVALID_JSON");
          error.code = "INVALID_JSON";
          error.responseText = raw;
          reject(error);
        }
      });
    });

    req.on("timeout", () => {
      const error = new Error("UPSTREAM_TIMEOUT");
      error.code = "UPSTREAM_TIMEOUT";
      req.destroy(error);
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (requestBody) {
      req.write(requestBody);
    }

    req.end();
  });
}

