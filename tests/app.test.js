import request from 'supertest';
import { jest } from '@jest/globals';

describe('Health check', () => {
  test('GET /healthz should return ok', async () => {
    let app;
    await jest.isolateModulesAsync(async () => {
      process.env.NODE_ENV = 'test';
      const mod = await import('../index.js');
      app = mod.default;
    });

    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});


