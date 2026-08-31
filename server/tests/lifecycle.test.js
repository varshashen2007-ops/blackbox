import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Case Lifecycle Transition Engine Suite (Track A)', () => {
  let investigator, supervisor, admin;
  let invToken, supToken, admToken;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Agent Investigator',
      email: 'inv@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active'
    });

    supervisor = await User.create({
      name: 'Supervisor Chief',
      email: 'sup@blackbox.local',
      passwordHash: 'hash123',
      role: 'supervisor',
      status: 'active'
    });

    admin = await User.create({
      name: 'Director Admin',
      email: 'admin@blackbox.local',
      passwordHash: 'hash123',
      role: 'admin',
      status: 'active'
    });

    invToken = generateTokens(investigator).accessToken;
    supToken = generateTokens(supervisor).accessToken;
    admToken = generateTokens(admin).accessToken;
  });

  // 1. draft -> active (Investigator or Supervisor)
  it('Transition: draft -> active should succeed for Investigator and Supervisor', async () => {
    const caseDoc = await Case.create({
      title: 'Draft Case 1',
      description: 'Initial draft case test',
      status: 'draft',
      createdBy: investigator._id
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ targetStatus: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');

    // Audit log check
    const audit = await AuditLog.findOne({ caseId: caseDoc._id, action: 'CASE_ACTIVATED' });
    expect(audit).not.toBeNull();
  });

  // 2. active -> under_review (Investigator requests review or Supervisor)
  it('Transition: active -> under_review should succeed for Investigator', async () => {
    const caseDoc = await Case.create({
      title: 'Active Case',
      description: 'Active case description',
      status: 'active',
      createdBy: investigator._id
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ targetStatus: 'under_review' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('under_review');
  });

  // 3. under_review -> active (Supervisor only, requires reason)
  it('Transition: under_review -> active should fail if reason is missing', async () => {
    const caseDoc = await Case.create({
      title: 'Review Case',
      description: 'Review case description',
      status: 'under_review',
      createdBy: investigator._id,
      assignedSupervisor: supervisor._id
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ targetStatus: 'active' }); // missing reason

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });

  it('Transition: under_review -> active should succeed for Supervisor with valid reason', async () => {
    const caseDoc = await Case.create({
      title: 'Review Case 2',
      description: 'Review case description',
      status: 'under_review',
      createdBy: investigator._id,
      assignedSupervisor: supervisor._id
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ targetStatus: 'active', reason: 'Need additional digital log extraction from server.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');

    const audit = await AuditLog.findOne({ caseId: caseDoc._id, action: 'CASE_SENT_BACK_FOR_WORK' });
    expect(audit).not.toBeNull();
    expect(audit.metadata.reason).toBe('Need additional digital log extraction from server.');
  });

  // 4. under_review -> closed (Supervisor only)
  it('Transition: under_review -> closed should succeed for Supervisor and reject Investigator with 403', async () => {
    const caseDoc = await Case.create({
      title: 'Closing Case',
      description: 'Case ready for closure',
      status: 'under_review',
      createdBy: investigator._id,
      assignedSupervisor: supervisor._id
    });

    // Investigator forbidden
    const invRes = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ targetStatus: 'closed' });

    expect(invRes.status).toBe(403);

    // Supervisor allowed
    const supRes = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ targetStatus: 'closed' });

    expect(supRes.status).toBe(200);
    expect(supRes.body.data.status).toBe('closed');
    expect(supRes.body.data.closedAt).not.toBeNull();
  });

  // 5. closed -> archived (Admin or Supervisor)
  it('Transition: closed -> archived should succeed for Admin and Supervisor', async () => {
    const caseDoc = await Case.create({
      title: 'Closed Case',
      description: 'Closed case ready for archive',
      status: 'closed',
      createdBy: investigator._id,
      closedAt: new Date()
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${admToken}`)
      .send({ targetStatus: 'archived' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
  });

  // 6. closed -> active (Supervisor only, requires reason)
  it('Transition: closed -> active should require reason and reset closedAt', async () => {
    const caseDoc = await Case.create({
      title: 'Reopening Case',
      description: 'Closed case requiring reopening',
      status: 'closed',
      createdBy: investigator._id,
      assignedSupervisor: supervisor._id,
      closedAt: new Date()
    });

    const res = await request(app)
      .post(`/api/v1/cases/${caseDoc._id}/transition`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ targetStatus: 'active', reason: 'New corroborating physical evidence discovered.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
    expect(res.body.data.closedAt).toBeNull();

    const audit = await AuditLog.findOne({ caseId: caseDoc._id, action: 'CASE_REOPENED' });
    expect(audit).not.toBeNull();
    expect(audit.metadata.reason).toBe('New corroborating physical evidence discovered.');
  });

  // 7. Disallowed Transitions Matrix Rejections (409 INVALID_TRANSITION)
  it('Disallowed Transitions: should reject invalid transitions with 409 Conflict', async () => {
    const draftCase = await Case.create({
      title: 'Draft Case Disallowed',
      description: 'Testing illegal jump from draft to closed',
      status: 'draft',
      createdBy: investigator._id,
      assignedSupervisor: supervisor._id
    });

    // draft -> closed is illegal
    const res1 = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/transition`)
      .set('Authorization', `Bearer ${supToken}`)
      .send({ targetStatus: 'closed' });

    expect(res1.status).toBe(409);
    expect(res1.body.error.code).toBe('INVALID_TRANSITION');

    // draft -> archived is illegal
    const res2 = await request(app)
      .post(`/api/v1/cases/${draftCase._id}/transition`)
      .set('Authorization', `Bearer ${admToken}`)
      .send({ targetStatus: 'archived' });

    expect(res2.status).toBe(409);
    expect(res2.body.error.code).toBe('INVALID_TRANSITION');
  });
});
