import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { Hypothesis } from '../src/models/Hypothesis.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('Hypotheses, Relationships & Admin Stats Suite (Track C)', () => {
  let investigator, supervisor, admin;
  let invToken, supToken, admToken;
  let testCase, evidence1, evidence2;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Investigator Fox',
      email: 'fox@blackbox.local',
      passwordHash: 'hash',
      role: 'investigator',
      status: 'active'
    });

    supervisor = await User.create({
      name: 'Supervisor Dana',
      email: 'dana@blackbox.local',
      passwordHash: 'hash',
      role: 'supervisor',
      status: 'active'
    });

    admin = await User.create({
      name: 'Director Walter',
      email: 'walter@blackbox.local',
      passwordHash: 'hash',
      role: 'admin',
      status: 'active'
    });

    invToken = generateTokens(investigator).accessToken;
    supToken = generateTokens(supervisor).accessToken;
    admToken = generateTokens(admin).accessToken;

    testCase = await Case.create({
      title: 'Espionage Inquiry',
      description: 'Foreign agent exfiltration',
      status: 'active',
      createdBy: investigator._id
    });

    evidence1 = await Evidence.create({
      caseId: testCase._id,
      title: 'Badge Log',
      description: 'Physical badge scan at server room',
      type: 'digital_log',
      source: 'Badge Reader B4',
      collectedBy: investigator._id,
      verificationStatus: 'verified'
    });

    evidence2 = await Evidence.create({
      caseId: testCase._id,
      title: 'Surveillance Footage',
      description: 'Hallway camera capture',
      type: 'image',
      source: 'CCTV Camera 12',
      collectedBy: investigator._id,
      verificationStatus: 'verified'
    });
  });

  it('POST /api/v1/cases/:caseId/hypotheses should create a proposed hypothesis', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/hypotheses`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        title: 'Insider Threat: Compromised Access Badge',
        description: 'Target access credentials were duplicated or stolen by an internal actor.',
        status: 'proposed'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Insider Threat: Compromised Access Badge');
    expect(res.body.data.confidenceScore).toBe(50.0);
  });

  it('POST /api/v1/cases/:caseId/hypotheses/:id/link-evidence should link evidence and update score', async () => {
    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Stolen Badge Hypothesis',
      description: 'Badge was used off-hours',
      createdBy: investigator._id
    });

    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/hypotheses/${hypothesis._id}/link-evidence`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        evidenceId: evidence1._id.toString(),
        stance: 'supports'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.confidenceScore).toBe(62.5); // 50 + 25 * 0.5 = 62.5
    expect(res.body.data.breakdown).toHaveLength(1);
    expect(res.body.data.breakdown[0].stance).toBe('supports');
  });

  it('POST /api/v1/cases/:caseId/relationships should create corroboration and boost confidence', async () => {
    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Corroborated Hypothesis',
      description: 'Badge log corroborated by CCTV',
      createdBy: investigator._id,
      linkedEvidence: [{ evidenceId: evidence1._id, stance: 'supports' }]
    });

    // Link evidence1 corroborates evidence2
    const resRel = await request(app)
      .post(`/api/v1/cases/${testCase._id}/relationships`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({
        sourceEvidenceId: evidence1._id.toString(),
        targetEvidenceId: evidence2._id.toString(),
        relationshipType: 'corroborates',
        weight: 0.8,
        notes: 'CCTV timestamp matches badge swipe exactly.'
      });

    expect(resRel.status).toBe(201);

    // Fetch updated hypothesis
    const resHyp = await request(app)
      .get(`/api/v1/cases/${testCase._id}/hypotheses/${hypothesis._id}`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(resHyp.status).toBe(200);
    // Base 0.5 * 1.1 = 0.55 => 50 + 25 * 0.55 = 63.75 => 63.8
    expect(resHyp.body.data.confidenceScore).toBe(63.8);
  });

  it('GET /api/v1/admin/stats should return real computed MongoDB aggregation statistics', async () => {
    const res = await request(app)
      .get('/api/v1/admin/stats')
      .set('Authorization', `Bearer ${admToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cases.active).toBe(1);
    expect(res.body.data.cases.total).toBe(1);
    expect(res.body.data.evidence.verified).toBe(2);
    expect(res.body.data.evidence.total).toBe(2);
    expect(res.body.data.totalUsers).toBe(3);
  });
});
