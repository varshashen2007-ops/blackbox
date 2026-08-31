import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { Hypothesis } from '../src/models/Hypothesis.js';
import { EvidenceRelationship } from '../src/models/EvidenceRelationship.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { AiReview } from '../src/models/AiReview.js';
import { generateTokens } from '../src/middleware/auth.js';

describe('BlackBox AI Supervisor Automated Review Suite', () => {
  let investigator, adminUser;
  let invToken, admToken;
  let testCase, ev1, ev2, hyp1;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    investigator = await User.create({
      name: 'Sherlock Holmes',
      email: 'sherlock@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active',
      identityVerified: true
    });

    adminUser = await User.create({
      name: 'Mycroft Holmes',
      email: 'mycroft@blackbox.local',
      passwordHash: 'hash123',
      role: 'admin',
      status: 'active'
    });

    invToken = generateTokens(investigator).accessToken;
    admToken = generateTokens(adminUser).accessToken;

    testCase = await Case.create({
      title: 'SHERLOCK HOLMES — FINANCIAL SYSTEM INTRUSION',
      description: 'High-profile forensic audit of unauthorized access to production credentials.',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });

    ev1 = await Evidence.create({
      caseId: testCase._id,
      title: 'Production API Secret Exposure Log',
      description: 'API gateway access logs showing production secret exposure.',
      type: 'digital_log',
      source: 'Nginx Access Log',
      collectedBy: investigator._id,
      verificationStatus: 'unverified',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      integrityStatus: 'CALCULATED'
    });

    ev2 = await Evidence.create({
      caseId: testCase._id,
      title: 'Authorized Credential Rotation Record',
      description: 'Security team credential rotation change log.',
      type: 'document',
      source: 'JIRA Sec-1092',
      collectedBy: investigator._id,
      verificationStatus: 'unverified',
      fileHash: 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
      integrityStatus: 'CALCULATED'
    });

    await EvidenceRelationship.create({
      caseId: testCase._id,
      sourceEvidenceId: ev1._id,
      targetEvidenceId: ev2._id,
      relationshipType: 'contradicts',
      weight: 0.8,
      createdBy: investigator._id
    });

    hyp1 = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Compromised production credentials caused the intrusion',
      description: 'Attacker used exposed API secret to authenticate.',
      status: 'proposed',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: ev1._id, stance: 'supports' },
        { evidenceId: ev2._id, stance: 'contradicts' }
      ]
    });
  });

  it('POST /api/v1/cases/:caseId/ai/review should execute automated AI Supervisor review and return structured output', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/ai/review`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('decision');
    expect(res.body.data).toHaveProperty('overallAssessment');
    expect(res.body.data.evidenceAssessments).toBeInstanceOf(Array);
    expect(res.body.data.hypothesisAssessments).toBeInstanceOf(Array);

    // Verify audit logs generated
    const startAudit = await AuditLog.findOne({ caseId: testCase._id, action: 'AI_REVIEW_STARTED' });
    const completeAudit = await AuditLog.findOne({ caseId: testCase._id, action: 'AI_REVIEW_COMPLETED' });
    expect(startAudit).not.toBeNull();
    expect(completeAudit).not.toBeNull();
  });

  it('Automated AI Review should automatically update evidence status to ai_reviewed and recalculate hypothesis confidence', async () => {
    await request(app)
      .post(`/api/v1/cases/${testCase._id}/ai/review`)
      .set('Authorization', `Bearer ${invToken}`);

    // Check evidence status updated
    const updatedEv1 = await Evidence.findById(ev1._id);
    expect(['ai_reviewed', 'verified', 'flagged']).toContain(updatedEv1.verificationStatus);

    // Check hypothesis confidence score recalculated
    const updatedHyp = await Hypothesis.findById(hyp1._id);
    expect(updatedHyp.confidenceScore).toBeGreaterThan(0);
  });

  it('GET /api/v1/cases/:caseId/ai/review should return the latest AI Supervisor review record', async () => {
    await request(app)
      .post(`/api/v1/cases/${testCase._id}/ai/review`)
      .set('Authorization', `Bearer ${invToken}`);

    const res = await request(app)
      .get(`/api/v1/cases/${testCase._id}/ai/review`)
      .set('Authorization', `Bearer ${invToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.caseId.toString()).toBe(testCase._id.toString());
  });

  it('GET /api/v1/ai-supervisor/dashboard should return global AI Supervisor intelligence metrics', async () => {
    await request(app)
      .post(`/api/v1/cases/${testCase._id}/ai/review`)
      .set('Authorization', `Bearer ${invToken}`);

    const res = await request(app)
      .get('/api/v1/ai-supervisor/dashboard')
      .set('Authorization', `Bearer ${invToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalReviews).toBeGreaterThanOrEqual(1);
    expect(res.body.data.recentReviews).toBeInstanceOf(Array);
  });
});
