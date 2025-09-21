import request from 'supertest';
import { jest } from '@jest/globals';

afterEach(() => {
  jest.resetModules();
});

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

describe('Readiness check (/readyz)', () => {
  test('GET /readyz returns ok when DB is available', async () => {
    let app;
    await jest.isolateModulesAsync(async () => {
      process.env.NODE_ENV = 'test';

      const mockPing = jest.fn().mockResolvedValue(true);
      const mockQuery = jest.fn();
      await jest.unstable_mockModule('../mysql-connect.js', () => ({
        default: mockQuery,
        pingDatabase: mockPing,
      }));

      const mod = await import('../index.js');
      app = mod.default;
    });

    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /readyz returns 503 when DB check fails', async () => {
    let app;
    await jest.isolateModulesAsync(async () => {
      process.env.NODE_ENV = 'test';

      const mockPing = jest.fn().mockRejectedValue(new Error('db down'));
      const mockQuery = jest.fn();
      await jest.unstable_mockModule('../mysql-connect.js', () => ({
        default: mockQuery,
        pingDatabase: mockPing,
      }));

      const mod = await import('../index.js');
      app = mod.default;
    });

    const res = await request(app).get('/readyz');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
  });
});


