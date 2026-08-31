import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Case-Level Access Authorization Suite', () => {
  let invA, invB, assignedSupervisor, unrelatedSupervisor, admin;
  let tokenA, tokenB, assignedSupToken, unrelatedSupToken, admToken;
  let caseA;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    invA = await User.create({
      name: 'Investigator Alpha',
      email: 'alpha@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    invB = await User.create({
      name: 'Investigator Beta',
      email: 'beta@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    assignedSupervisor = await User.create({
      name: 'Supervisor Skinner (Assigned)',
      email: 'skinner@blackbox.local',
      passwordHash: 'hash',
      role: 'supervisor',
      status: 'active'
    });

    unrelatedSupervisor = await User.create({
      name: 'Supervisor Unrelated',
      email: 'unrelated_sup@blackbox.local',
      passwordHash: 'hash',
      role: 'supervisor',
      status: 'active'
    });

    admin = await User.create({
      name: 'Admin Director',
      email: 'admin@blackbox.local',
      passwordHash: 'hash',
      role: 'admin',
      status: 'active'
    });

    tokenA = generateTokens(invA).accessToken;
    tokenB = generateTokens(invB).accessToken;
    assignedSupToken = generateTokens(assignedSupervisor).accessToken;
    unrelatedSupToken = generateTokens(unrelatedSupervisor).accessToken;
    admToken = generateTokens(admin).accessToken;

    caseA = await Case.create({
      title: 'Classified Operation Alpha',
      description: 'Restricted access case',
      status: 'active',
      createdBy: invA._id,
      assignedInvestigators: [invA._id],
      assignedSupervisor: assignedSupervisor._id
    });
  });

  it('Assigned Investigator Alpha should access Case A', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Unassigned Investigator Beta should be denied access to Case A with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Unassigned Investigator Beta should be denied querying sub-resource evidence with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}/evidence`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Assigned Supervisor should have supervisory access to Case A', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${assignedSupToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('Unrelated Supervisor should be denied access to Case A with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${unrelatedSupToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('Admin should have full oversight access to Case A', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${caseA._id}`)
      .set('Authorization', `Bearer ${admToken}`);

    expect(res.status).toBe(200);
  });
});
