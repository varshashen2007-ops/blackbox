import { Evidence } from '../models/Evidence.js';
import { EvidenceRelationship } from '../models/EvidenceRelationship.js';
import { Hypothesis } from '../models/Hypothesis.js';

/**
 * Deterministic Hypothesis Confidence Score Calculation Engine
 * Strictly follows Section 5 of 01-antigravity-build-prompt.md
 */
export async function calculateHypothesisConfidence(hypothesisId) {
  const hypothesis = await Hypothesis.findById(hypothesisId);
  if (!hypothesis) {
    throw new Error(`Hypothesis with id ${hypothesisId} not found`);
  }

  const caseId = hypothesis.caseId;
  const linked = hypothesis.linkedEvidence || [];

  if (linked.length === 0) {
    return {
      confidenceScore: 50.0,
      breakdown: [],
      conflicts: [],
      rawScore: 0.0
    };
  }

  // Fetch all evidence documents in this case
  const allCaseEvidence = await Evidence.find({ caseId }).lean();
  const evidenceMap = new Map(allCaseEvidence.map((e) => [e._id.toString(), e]));

  // Fetch all relationships within this case
  const relationships = await EvidenceRelationship.find({ caseId }).lean();

  // Find supporting evidence IDs for conflict detection
  const supportingEvidenceIds = new Set();
  for (const item of linked) {
    const doc = evidenceMap.get(item.evidenceId.toString());
    if (doc && doc.verificationStatus === 'verified' && item.stance === 'supports') {
      supportingEvidenceIds.add(doc._id.toString());
    }
  }

  // Conflict detection: If two supporting verified evidence items contradict each other
  const conflicts = [];
  for (const rel of relationships) {
    if (rel.relationshipType === 'contradicts') {
      const srcId = rel.sourceEvidenceId.toString();
      const tgtId = rel.targetEvidenceId.toString();

      if (supportingEvidenceIds.has(srcId) && supportingEvidenceIds.has(tgtId)) {
        conflicts.push({
          sourceEvidenceId: srcId,
          targetEvidenceId: tgtId,
          message: `Conflicting evidence detected: Evidence items supporting this hypothesis contradict each other.`
        });
      }
    }
  }

  // Compute contribution for each linked item
  let rawScore = 0.0;
  const breakdown = [];

  for (const item of linked) {
    const doc = evidenceMap.get(item.evidenceId.toString());
    if (!doc) continue;

    // Rule 1: Only evidence with verificationStatus = 'verified' contributes
    const isVerified = doc.verificationStatus === 'verified';

    if (!isVerified) {
      breakdown.push({
        evidenceId: doc._id,
        title: doc.title,
        verificationStatus: doc.verificationStatus,
        stance: item.stance,
        baseWeight: 0.5,
        corroborationBoost: 0.0,
        effectiveContribution: 0.0,
        counted: false,
        note: 'Not yet counted: Evidence must be verified by a supervisor to contribute.'
      });
      continue;
    }

    // Rule 2 & 3: Base weight is 0.5
    let baseWeight = 0.5;

    // Rule 4: Corroboration boost (+10% per corroborating verified link, capped at +30%)
    let corroboratingLinksCount = 0;
    for (const rel of relationships) {
      if (rel.relationshipType === 'corroborates') {
        const src = rel.sourceEvidenceId.toString();
        const tgt = rel.targetEvidenceId.toString();
        const curId = doc._id.toString();

        if (src === curId || tgt === curId) {
          const otherId = src === curId ? tgt : src;
          const otherDoc = evidenceMap.get(otherId);
          // Only count if the corroborating partner is also verified
          if (otherDoc && otherDoc.verificationStatus === 'verified') {
            corroboratingLinksCount++;
          }
        }
      }
    }

    const boostPercent = Math.min(corroboratingLinksCount * 0.10, 0.30);
    const boostedWeight = baseWeight * (1 + boostPercent);

    let contribution = 0.0;
    if (item.stance === 'supports') {
      contribution = boostedWeight;
      rawScore += contribution;
    } else if (item.stance === 'contradicts') {
      contribution = -boostedWeight;
      rawScore += contribution;
    }

    breakdown.push({
      evidenceId: doc._id,
      title: doc.title,
      verificationStatus: doc.verificationStatus,
      stance: item.stance,
      baseWeight,
      corroborationBoost: boostPercent,
      effectiveContribution: parseFloat(contribution.toFixed(3)),
      counted: true
    });
  }

  // Rule 5: Clamped linear normalization into 0 - 100
  // Baseline is 50.0. Each +1 net contribution moves score by +25 points (clamped [0, 100])
  const normalizedScore = Math.min(100.0, Math.max(0.0, 50.0 + 25.0 * rawScore));
  const finalScore = parseFloat(normalizedScore.toFixed(1));

  return {
    confidenceScore: finalScore,
    breakdown,
    conflicts,
    rawScore: parseFloat(rawScore.toFixed(3))
  };
}

/**
 * Recomputes and updates all hypotheses for a given case
 */
export async function recomputeAllHypothesesForCase(caseId) {
  const hypotheses = await Hypothesis.find({ caseId });
  for (const hyp of hypotheses) {
    const { confidenceScore } = await calculateHypothesisConfidence(hyp._id);
    hyp.confidenceScore = confidenceScore;
    await hyp.save();
  }
}
