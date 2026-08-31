import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import { User } from '../src/models/User.js';
import { Case } from '../src/models/Case.js';
import { Evidence } from '../src/models/Evidence.js';
import { EvidenceRelationship } from '../src/models/EvidenceRelationship.js';
import { Hypothesis } from '../src/models/Hypothesis.js';
import { calculateHypothesisConfidence } from '../src/services/confidenceScore.service.js';

describe('Deterministic Confidence-Score Engine Suite (Track C)', () => {
  let investigator, testCase;

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
      role: 'investigator'
    });

    testCase = await Case.create({
      title: 'Confidence Engine Test Case',
      description: 'Mathematical testing of Section 5 scoring rules',
      status: 'active',
      createdBy: investigator._id
    });
  });

  // 1. Zero linked evidence should give default 50.0 score
  it('Scenario 1: Hypothesis with zero linked evidence should return baseline 50.0', async () => {
    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis Baseline',
      description: 'No evidence attached yet',
      createdBy: investigator._id,
      linkedEvidence: []
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.confidenceScore).toBe(50.0);
    expect(result.breakdown).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
  });

  // 2. Unverified, pending, and rejected evidence must contribute ZERO weight
  it('Scenario 2: Unverified, pending, and rejected evidence contribute zero weight', async () => {
    const [unverifiedEv, pendingEv, rejectedEv] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Unverified Log',
        description: 'Desc',
        type: 'digital_log',
        source: 'Edge Server',
        collectedBy: investigator._id,
        verificationStatus: 'unverified'
      },
      {
        caseId: testCase._id,
        title: 'Pending Log',
        description: 'Desc',
        type: 'digital_log',
        source: 'Edge Server',
        collectedBy: investigator._id,
        verificationStatus: 'pending'
      },
      {
        caseId: testCase._id,
        title: 'Rejected Document',
        description: 'Desc',
        type: 'document',
        source: 'Third Party',
        collectedBy: investigator._id,
        verificationStatus: 'rejected',
        rejectionReason: 'Invalid hash'
      }
    ]);

    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis with Unverified Evidence',
      description: 'All evidence is non-verified',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: unverifiedEv._id, stance: 'supports' },
        { evidenceId: pendingEv._id, stance: 'supports' },
        { evidenceId: rejectedEv._id, stance: 'contradicts' }
      ]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.confidenceScore).toBe(50.0); // Baseline unchanged
    expect(result.rawScore).toBe(0.0);
    expect(result.breakdown).toHaveLength(3);
    expect(result.breakdown.every((b) => b.counted === false)).toBe(true);
  });

  // 3. All-verified supporting evidence should increase score
  it('Scenario 3: All-verified supporting evidence increases confidence above 50.0', async () => {
    const [ev1, ev2] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Verified Access Log',
        description: 'Desc',
        type: 'digital_log',
        source: 'Core Gateway',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Verified Memory Dump',
        description: 'Desc',
        type: 'digital_log',
        source: 'Host RAM',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      }
    ]);

    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis Supported',
      description: 'Two verified supporting items (+0.5 + 0.5 = +1.0 raw => 50 + 25 = 75.0)',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: ev1._id, stance: 'supports' },
        { evidenceId: ev2._id, stance: 'supports' }
      ]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.rawScore).toBe(1.0);
    expect(result.confidenceScore).toBe(75.0);
  });

  // 4. All-verified contradicting evidence should decrease score
  it('Scenario 4: All-verified contradicting evidence decreases confidence below 50.0', async () => {
    const [ev1, ev2] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Verified Alibi Records',
        description: 'Desc',
        type: 'document',
        source: 'HR System',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Verified Badge Swipe',
        description: 'Desc',
        type: 'digital_log',
        source: 'Building Access',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      }
    ]);

    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis Contradicted',
      description: 'Two verified contradicting items (-0.5 + -0.5 = -1.0 raw => 50 - 25 = 25.0)',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: ev1._id, stance: 'contradicts' },
        { evidenceId: ev2._id, stance: 'contradicts' }
      ]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.rawScore).toBe(-1.0);
    expect(result.confidenceScore).toBe(25.0);
  });

  // 5. Mixed verified evidence (supporting and contradicting)
  it('Scenario 5: Mixed verified supporting and contradicting evidence balances appropriately', async () => {
    const [evSupport, evContradict] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Supporting Evidence',
        description: 'Desc',
        type: 'document',
        source: 'Source A',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Contradicting Evidence',
        description: 'Desc',
        type: 'document',
        source: 'Source B',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      }
    ]);

    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Mixed Hypothesis',
      description: '+0.5 - 0.5 = 0.0 => 50.0',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: evSupport._id, stance: 'supports' },
        { evidenceId: evContradict._id, stance: 'contradicts' }
      ]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.rawScore).toBe(0.0);
    expect(result.confidenceScore).toBe(50.0);
  });

  // 6. Corroborating relationships apply +10% boost per link (capped at +30%)
  it('Scenario 6: Corroborating relationships apply +10% multiplier boost per verified partner', async () => {
    const [ev1, ev2, ev3, ev4] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Primary Packet Capture',
        description: 'Desc',
        type: 'digital_log',
        source: 'Interface eth0',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Corroborating Log A',
        description: 'Desc',
        type: 'digital_log',
        source: 'Syslog 1',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Corroborating Log B',
        description: 'Desc',
        type: 'digital_log',
        source: 'Syslog 2',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Corroborating Log C',
        description: 'Desc',
        type: 'digital_log',
        source: 'Syslog 3',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      }
    ]);

    // Create 3 corroborating links for ev1 (+10% each -> capped at +30% = 0.5 * 1.3 = 0.65)
    await EvidenceRelationship.create([
      { caseId: testCase._id, sourceEvidenceId: ev1._id, targetEvidenceId: ev2._id, relationshipType: 'corroborates', createdBy: investigator._id },
      { caseId: testCase._id, sourceEvidenceId: ev1._id, targetEvidenceId: ev3._id, relationshipType: 'corroborates', createdBy: investigator._id },
      { caseId: testCase._id, sourceEvidenceId: ev1._id, targetEvidenceId: ev4._id, relationshipType: 'corroborates', createdBy: investigator._id }
    ]);

    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis with Corroboration Boost',
      description: 'ev1 receives 30% boost',
      createdBy: investigator._id,
      linkedEvidence: [{ evidenceId: ev1._id, stance: 'supports' }]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    // Base 0.5 * 1.3 = 0.65 contribution => score = 50 + 25 * 0.65 = 66.25 => 66.3
    expect(result.rawScore).toBe(0.65);
    expect(result.confidenceScore).toBe(66.3);
    expect(result.breakdown[0].corroborationBoost).toBe(0.30);
  });

  // 7. Conflicting evidence items must be surfaced, not silently cancelled
  it('Scenario 7: Contradicting links between supporting evidence items surface explicit conflicts', async () => {
    const [evA, evB] = await Evidence.create([
      {
        caseId: testCase._id,
        title: 'Witness Statement Alpha',
        description: 'Desc',
        type: 'testimony',
        source: 'Witness Alpha',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      },
      {
        caseId: testCase._id,
        title: 'Witness Statement Beta',
        description: 'Desc',
        type: 'testimony',
        source: 'Witness Beta',
        collectedBy: investigator._id,
        verificationStatus: 'verified'
      }
    ]);

    // Alpha and Beta contradict each other
    await EvidenceRelationship.create({
      caseId: testCase._id,
      sourceEvidenceId: evA._id,
      targetEvidenceId: evB._id,
      relationshipType: 'contradicts',
      createdBy: investigator._id
    });

    // Both are linked as supporting H
    const hypothesis = await Hypothesis.create({
      caseId: testCase._id,
      title: 'Hypothesis with Internal Conflict',
      description: 'Both Alpha and Beta are supporting, but they contradict each other',
      createdBy: investigator._id,
      linkedEvidence: [
        { evidenceId: evA._id, stance: 'supports' },
        { evidenceId: evB._id, stance: 'supports' }
      ]
    });

    const result = await calculateHypothesisConfidence(hypothesis._id);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].sourceEvidenceId).toBe(evA._id.toString());
    expect(result.conflicts[0].targetEvidenceId).toBe(evB._id.toString());
  });
});
