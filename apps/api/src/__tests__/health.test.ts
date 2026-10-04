import { describe, it, expect } from 'vitest';
import app from '../app.js';
import request from 'supertest';

describe('health', () => {
  it('returns ok', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('ok');
  });
});
