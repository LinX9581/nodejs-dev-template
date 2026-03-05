import request from 'supertest';
process.env.NODE_ENV = 'test';
const { default: app } = await import('../index.js');

describe('Health check', () => {
  test('GET /healthz should return ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

