import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { Hypothesis } from '../src/models/Hypothesis.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('AI Investigator & Intelligence Suite', () => {
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
      name: 'Agent Mulder',
      email: 'mulder@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    token = generateTokens(investigator).accessToken;

    testCase = await Case.create({
      title: 'Dark Web Exfiltration Operation',
      description: 'Encrypted archives transferred over I2P tunnels',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });

    await Evidence.create({
      caseId: testCase._id,
      title: 'I2P Router Log',
      description: 'Connection traces',
      type: 'digital_log',
      source: 'Router 127.0.0.1:4444',
      collectedBy: investigator._id,
      verificationStatus: 'verified'
    });

    await Hypothesis.create({
      caseId: testCase._id,
      title: 'Coordinated Data Exfiltration',
      description: 'Multiple threat actors collaborated on exfiltration',
      createdBy: investigator._id
    });
  });

  it('GET /api/v1/cases/:caseId/ai/brief should return contextual investigation brief', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${testCase._id}/ai/brief`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.caseTitle).toBe('Dark Web Exfiltration Operation');
    expect(res.body.data.metrics.totalEvidence).toBe(1);
    expect(res.body.data.metrics.verifiedCount).toBe(1);
    expect(res.body.data.summaryBullets.length).toBeGreaterThan(0);
    expect(res.body.data.disclaimer).toContain('AI-generated analysis');
  });

  it('POST /api/v1/cases/:caseId/ai/chat should return grounded analytical response', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/ai/chat`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        message: 'Can you summarize this investigation and its leading hypothesis?'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toBeDefined();
    expect(res.body.data.disclaimer).toContain('AI-generated analysis');
  });
});
