import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Evidence Cryptographic Hash & Integrity Suite', () => {
  let investigator, token, testCase;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Forensic Officer Scully',
      email: 'scully@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    token = generateTokens(investigator).accessToken;

    testCase = await Case.create({
      title: 'Cryptographic Validation Test Case',
      description: 'Verifying SHA-256 hash generation and verification',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });
  });

  it('POST /api/v1/cases/:caseId/evidence should generate a SHA-256 fileHash on evidence creation', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Core Database DDL Export',
        description: 'Schema and audit logs exported from production database',
        type: 'digital_log',
        source: 'PostgreSQL Server 192.168.1.50',
        tags: ['db', 'schema']
      });

    expect(res.status).toBe(201);
    expect(res.body.data.fileHash).toBeDefined();
    expect(res.body.data.fileHash).toMatch(/^[a-f0-9]{64}$/); // 64 hex chars for SHA-256
    expect(res.body.data.hashAlgorithm).toBe('SHA-256');
    expect(res.body.data.hashVerified).toBe(true);
  });

  it('POST /api/v1/cases/:caseId/evidence/:id/verify-integrity should verify evidence hash', async () => {
    const evidence = await Evidence.create({
      caseId: testCase._id,
      title: 'Host Ram Snapshot',
      description: 'Raw memory snapshot',
      type: 'digital_log',
      source: 'Host 01',
      collectedBy: investigator._id,
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    });

    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/evidence/${evidence._id}/verify-integrity`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hashAlgorithm).toBe('SHA-256');
    expect(res.body.data.hashVerified).toBe(true);
  });
});
