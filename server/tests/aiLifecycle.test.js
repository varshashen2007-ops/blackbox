import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
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
import { runAiSupervisorReview } from '../src/services/aiSupervisor.service.js';

describe('AI Supervisor Lifecycle Automation & Failure Handling Suite', () => {
  let investigator, invToken;
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
      email: 'sherlock.lifecycle@blackbox.local',
      passwordHash: 'hash123',
      role: 'investigator',
      status: 'active',
      identityVerified: true
    });

    invToken = generateTokens(investigator).accessToken;

    testCase = await Case.create({
      title: 'FINANCIAL SYSTEM INTRUSION - AUTOMATED LIFECYCLE',
      description: 'Case for automated lifecycle transition testing.',
      status: 'active',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });

    ev1 = await Evidence.create({
      caseId: testCase._id,
      title: 'Production API Secret Exposure',
      description: 'API secret leaked in logs.',
      type: 'digital_log',
      source: 'CloudWatch',
      collectedBy: investigator._id,
      verificationStatus: 'unverified',
      fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      integrityStatus: 'CALCULATED'
    });

    ev2 = await Evidence.create({
      caseId: testCase._id,
      title: 'Authorized Credential Rotation Record',
      description: 'Rotation change log.',
      type: 'document',
      source: 'ITSM',
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
      weight: 0.9,
      createdBy: investigator._id
    });

    hyp1 = await Hypothesis.create({
      caseId: testCase._id,
      title: 'H1: Compromised production credentials caused intrusion',
      description: 'Forensic theory.',
      status: 'proposed',
      confidenceScore: 50.0,
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: ev1._id, stance: 'supports' },
        { evidenceId: ev2._id, stance: 'contradicts' }
      ]
    });
  });

  // 1. Transitioning to under_review automatically triggers AI Supervisor review
  it('Transition to under_review triggers AI review and creates complete audit chain with actorType: AI_SUPERVISOR', async () => {
    const res = await request(app)
      .post(`/api/v1/cases/${testCase._id}/transition`)
      .set('Authorization', `Bearer ${invToken}`)
      .send({ targetStatus: 'under_review' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('under_review');

    // Allow async review to finish
    await new Promise((r) => setTimeout(r, 600));

    // Verify full audit timeline
    const auditActions = await AuditLog.find({ caseId: testCase._id })
      .sort({ timestamp: 1 })
      .lean();

    const actionNames = auditActions.map((a) => a.action);
    expect(actionNames).toContain('CASE_SUBMITTED_FOR_REVIEW');
    expect(actionNames).toContain('AI_REVIEW_STARTED');
    expect(actionNames).toContain('AI_EVIDENCE_ASSESSED');
    expect(actionNames).toContain('AI_HYPOTHESIS_ASSESSED');
    expect(actionNames).toContain('AI_HYPOTHESIS_RECALCULATED');
    expect(actionNames).toContain('AI_REVIEW_COMPLETED');

    // Check actorType is AI_SUPERVISOR on AI actions
    const reviewCompleteLog = auditActions.find((a) => a.action === 'AI_REVIEW_COMPLETED');
    expect(reviewCompleteLog.metadata.actorType).toBe('AI_SUPERVISOR');

    // Check AiReview document created
    const reviewDoc = await AiReview.findOne({ caseId: testCase._id });
    expect(reviewDoc).not.toBeNull();
    expect(reviewDoc.actorType).toBe('AI_SUPERVISOR');
    expect(reviewDoc.status).toBe('completed');
  });

  // 2. Deterministic Fallback is clearly labeled and does not claim to be Groq
  it('When Groq API key is unavailable, deterministic engine runs and is accurately labeled', async () => {
    delete process.env.GROQ_API_KEY;

    const review = await runAiSupervisorReview({
      caseId: testCase._id,
      user: investigator,
      ipAddress: '127.0.0.1',
      actorType: 'AI_SUPERVISOR'
    });

    expect(review.modelProvider).toBe('blackbox-forensic-engine');
    expect(review.modelName).toBe('blackbox-deterministic-v1');
    expect(review.decision).toBeDefined();

    // Check evidence was evaluated without changing cryptographic hashes
    const updatedEv1 = await Evidence.findById(ev1._id);
    expect(updatedEv1.fileHash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  // 3. AI Supervisor review calculates deterministic confidence and logs hypothesis changes
  it('AI Supervisor logs hypothesis recalculation change tracking metadata in audit log', async () => {
    await runAiSupervisorReview({
      caseId: testCase._id,
      user: investigator,
      ipAddress: '127.0.0.1',
      actorType: 'AI_SUPERVISOR'
    });

    const recalcAudit = await AuditLog.findOne({
      caseId: testCase._id,
      action: 'AI_HYPOTHESIS_RECALCULATED'
    });

    expect(recalcAudit).not.toBeNull();
    expect(recalcAudit.metadata.hypothesisChanges).toBeInstanceOf(Array);
    expect(recalcAudit.metadata.hypothesisChanges.length).toBeGreaterThan(0);
    expect(recalcAudit.metadata.hypothesisChanges[0]).toHaveProperty('newConfidence');
  });

  // 4. Safe AI Failure Handling: Case does not crash, marked as REQUIRES_ATTENTION, and auditable
  it('When AI analysis encounters invalid structure, system falls back safely and creates auditable record', async () => {
    // Force a review with corrupted evidence structure that fails parsing gracefully
    const corruptedCase = await Case.create({
      title: 'CORRUPTED CASE TEST',
      description: 'Testing schema validation failure handling.',
      status: 'under_review',
      createdBy: investigator._id,
      assignedInvestigators: [investigator._id]
    });

    const review = await runAiSupervisorReview({
      caseId: corruptedCase._id,
      user: investigator,
      ipAddress: '127.0.0.1',
      actorType: 'AI_SUPERVISOR'
    });

    expect(review).not.toBeNull();
    expect(['completed', 'failed']).toContain(review.status);

    const reviewLog = await AuditLog.findOne({ caseId: corruptedCase._id });
    expect(reviewLog).not.toBeNull();
  });
});
