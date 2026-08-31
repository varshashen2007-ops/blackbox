import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Health Check Endpoint', () => {
  it('GET /api/v1/health should return 200 and healthy status envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toMatchObject({
      status: 'healthy',
      service: 'blackbox-backend',
      version: '0.1.0'
    });
    expect(res.body.data).toHaveProperty('timestamp');
  });

  it('GET /api/v1/unknown-endpoint should return 404 with standard error envelope', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body.error.message).toContain('Endpoint not found');
  });
});
