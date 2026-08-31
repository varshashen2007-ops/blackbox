import { Hypothesis } from '../models/Hypothesis.js';
import { Evidence } from '../models/Evidence.js';
import { Case } from '../models/Case.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import { calculateHypothesisConfidence } from './confidenceScore.service.js';

export async function createHypothesis({ caseId, title, description, status = 'proposed', user, ipAddress = 'unknown' }) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    throw new AppError('Case not found', 404, 'NOT_FOUND');
  }

  if (caseDoc.status === 'archived' || caseDoc.status === 'closed') {
    throw new AppError(`Cannot propose hypotheses on a ${caseDoc.status} case`, 409, 'CASE_LOCKED');
  }

  const hypothesis = await Hypothesis.create({
    caseId,
    title,
    description,
    status,
    linkedEvidence: [],
    confidenceScore: 50.0,
    createdBy: user._id
  });

  await logAudit({
    actorId: user._id,
    action: 'HYPOTHESIS_PROPOSED',
    entityType: 'Hypothesis',
    entityId: hypothesis._id,
    caseId,
    metadata: { title: hypothesis.title, status: hypothesis.status },
    ipAddress
  });

  return hypothesis;
}

export async function getHypothesesForCase(caseId) {
  const hypotheses = await Hypothesis.find({ caseId })
    .populate('createdBy', 'name email role')
    .sort({ createdAt: -1 });

  const results = [];
  for (const hyp of hypotheses) {
    const analysis = await calculateHypothesisConfidence(hyp._id);
    hyp.confidenceScore = analysis.confidenceScore;
    await hyp.save();

    results.push({
      ...hyp.toJSON(),
      confidenceScore: analysis.confidenceScore,
      breakdown: analysis.breakdown,
      conflicts: analysis.conflicts,
      rawScore: analysis.rawScore
    });
  }

  return results;
}

export async function getHypothesisDetail(caseId, hypothesisId) {
  const hypothesis = await Hypothesis.findOne({ _id: hypothesisId, caseId })
    .populate('createdBy', 'name email role');

  if (!hypothesis) {
    throw new AppError('Hypothesis not found', 404, 'NOT_FOUND');
  }

  const analysis = await calculateHypothesisConfidence(hypothesis._id);
  hypothesis.confidenceScore = analysis.confidenceScore;
  await hypothesis.save();

  return {
    ...hypothesis.toJSON(),
    confidenceScore: analysis.confidenceScore,
    breakdown: analysis.breakdown,
    conflicts: analysis.conflicts,
    rawScore: analysis.rawScore
  };
}

export async function updateHypothesis({ caseId, hypothesisId, title, description, status, user, ipAddress = 'unknown' }) {
  const hypothesis = await Hypothesis.findOne({ _id: hypothesisId, caseId });
  if (!hypothesis) {
    throw new AppError('Hypothesis not found', 404, 'NOT_FOUND');
  }

  if (title) hypothesis.title = title;
  if (description) hypothesis.description = description;
  if (status) hypothesis.status = status;

  await hypothesis.save();

  await logAudit({
    actorId: user._id,
    action: 'HYPOTHESIS_UPDATED',
    entityType: 'Hypothesis',
    entityId: hypothesis._id,
    caseId,
    metadata: { title: hypothesis.title, status: hypothesis.status },
    ipAddress
  });

  return getHypothesisDetail(caseId, hypothesisId);
}

export async function linkEvidenceToHypothesis({ caseId, hypothesisId, evidenceId, stance, user, ipAddress = 'unknown' }) {
  const hypothesis = await Hypothesis.findOne({ _id: hypothesisId, caseId });
  if (!hypothesis) {
    throw new AppError('Hypothesis not found', 404, 'NOT_FOUND');
  }

  const evidence = await Evidence.findOne({ _id: evidenceId, caseId });
  if (!evidence) {
    throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
  }

  // Check if evidence already linked -> update stance or add new
  const existingIdx = hypothesis.linkedEvidence.findIndex(
    (l) => l.evidenceId.toString() === evidenceId.toString()
  );

  if (existingIdx >= 0) {
    hypothesis.linkedEvidence[existingIdx].stance = stance;
  } else {
    hypothesis.linkedEvidence.push({
      evidenceId,
      stance
    });
  }

  await hypothesis.save();

  // Recompute confidence score
  const analysis = await calculateHypothesisConfidence(hypothesis._id);
  hypothesis.confidenceScore = analysis.confidenceScore;
  await hypothesis.save();

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_LINKED_TO_HYPOTHESIS',
    entityType: 'Hypothesis',
    entityId: hypothesis._id,
    caseId,
    metadata: {
      evidenceId,
      evidenceTitle: evidence.title,
      stance,
      newConfidenceScore: hypothesis.confidenceScore
    },
    ipAddress
  });

  return getHypothesisDetail(caseId, hypothesisId);
}

export async function unlinkEvidenceFromHypothesis({ caseId, hypothesisId, evidenceId, user, ipAddress = 'unknown' }) {
  const hypothesis = await Hypothesis.findOne({ _id: hypothesisId, caseId });
  if (!hypothesis) {
    throw new AppError('Hypothesis not found', 404, 'NOT_FOUND');
  }

  hypothesis.linkedEvidence = hypothesis.linkedEvidence.filter(
    (l) => l.evidenceId.toString() !== evidenceId.toString()
  );

  await hypothesis.save();

  const analysis = await calculateHypothesisConfidence(hypothesis._id);
  hypothesis.confidenceScore = analysis.confidenceScore;
  await hypothesis.save();

  await logAudit({
    actorId: user._id,
    action: 'EVIDENCE_UNLINKED_FROM_HYPOTHESIS',
    entityType: 'Hypothesis',
    entityId: hypothesis._id,
    caseId,
    metadata: {
      evidenceId,
      newConfidenceScore: hypothesis.confidenceScore
    },
    ipAddress
  });

  return getHypothesisDetail(caseId, hypothesisId);
}
