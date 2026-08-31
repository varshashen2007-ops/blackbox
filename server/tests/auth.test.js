import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { AuditLog } from '../src/models/AuditLog.js';

describe('Auth & Identity Suite (Track A)', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  it('POST /api/v1/auth/register should create an investigator account and return JWT tokens', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Agent Mulder',
      email: 'mulder@blackbox.local',
      password: 'SecurePassword123!',
      role: 'investigator'
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({
      name: 'Agent Mulder',
      email: 'mulder@blackbox.local',
      role: 'investigator',
      status: 'active'
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.tokens).toHaveProperty('accessToken');
    expect(res.body.data.tokens).toHaveProperty('refreshToken');

    // Verify synchronous AuditLog
    const audit = await AuditLog.findOne({ action: 'USER_REGISTER' });
    expect(audit).not.toBeNull();
    expect(audit.metadata.email).toBe('mulder@blackbox.local');
  });

  it('POST /api/v1/auth/register should reject duplicate emails with 409 Conflict', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Agent Scully',
      email: 'scully@blackbox.local',
      password: 'Password123!'
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Agent Scully Duplicate',
      email: 'scully@blackbox.local',
      password: 'Password123!'
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/auth/login should authenticate valid credentials and issue tokens', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Supervisor Skinner',
      email: 'skinner@blackbox.local',
      password: 'SupervisorPass123!',
      role: 'supervisor'
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'skinner@blackbox.local',
      password: 'SupervisorPass123!'
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('skinner@blackbox.local');
    expect(res.body.data.tokens).toHaveProperty('accessToken');

    // Check login audit log
    const audit = await AuditLog.findOne({ action: 'USER_LOGIN' });
    expect(audit).not.toBeNull();
  });

  it('POST /api/v1/auth/login should reject incorrect password with 401', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'user@blackbox.local',
      password: 'CorrectPassword123!'
    });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@blackbox.local',
      password: 'WrongPassword999!'
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /api/v1/auth/login should reject suspended accounts with 403', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Suspended Investigator',
      email: 'suspended@blackbox.local',
      password: 'Password123!'
    });

    await User.findByIdAndUpdate(regRes.body.data.user.id, { status: 'suspended' });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'suspended@blackbox.local',
      password: 'Password123!'
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('GET /api/v1/auth/me should return current user profile with valid Bearer token', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Special Agent Doggett',
      email: 'doggett@blackbox.local',
      password: 'Password123!'
    });

    const token = regRes.body.data.tokens.accessToken;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('doggett@blackbox.local');
  });
});
