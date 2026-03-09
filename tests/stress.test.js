import request from "supertest";
process.env.NODE_ENV = "test";
const { default: app } = await import("../index.js");

describe("Stress routes", () => {
  test("GET /stress should return page", async () => {
    const res = await request(app).get("/stress");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Stress Tools");
  });

  test("GET /stress/backend/work should return worker payload", async () => {
    const res = await request(app).get("/stress/backend/work");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.checksum).toBe("string");
  });
});
