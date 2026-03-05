import request from "supertest";
process.env.NODE_ENV = "test";
const { default: app } = await import("../index.js");

describe("Stress routes", () => {
  test("GET /stress should return page", async () => {
    const res = await request(app).get("/stress");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Stress Tools");
  });

  test("GET /stress/pure should return page", async () => {
    const res = await request(app).get("/stress/pure");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Stress Pure Frontend");
  });

  test("GET /stress/call-backend should return page", async () => {
    const res = await request(app).get("/stress/call-backend");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Stress Call Backend");
  });

  test("GET /stress/backend/work should return worker payload", async () => {
    const res = await request(app).get("/stress/backend/work");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.checksum).toBe("string");
  });

  test("GET /metrics should expose prometheus metrics", async () => {
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("app_stress_backend_work_total");
    expect(res.text).toContain("app_stress_proxy_total");
  });
});
