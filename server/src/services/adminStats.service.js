import { Case } from '../models/Case.js';
import { Evidence } from '../models/Evidence.js';
import { Hypothesis } from '../models/Hypothesis.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';

export async function getSystemStatistics() {
  const [
    casesByStatusAgg,
    evidenceByStatusAgg,
    hypothesesByStatusAgg,
    totalUsers,
    totalAuditLogs,
    avgConfidenceAgg
  ] = await Promise.all([
    // 1. Cases count grouped by status
    Case.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // 2. Evidence count grouped by verificationStatus
    Evidence.aggregate([
      {
        $group: {
          _id: '$verificationStatus',
          count: { $sum: 1 }
        }
      }
    ]),

    // 3. Hypotheses count grouped by status
    Hypothesis.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),

    // 4. Total users count
    User.countDocuments({}),

    // 5. Total audit logs
    AuditLog.countDocuments({}),

    // 6. Average confidence score
    Hypothesis.aggregate([
      {
        $group: {
          _id: null,
          avgConfidence: { $avg: '$confidenceScore' }
        }
      }
    ])
  ]);

  // Format cases by status
  const casesByStatus = {
    draft: 0,
    active: 0,
    under_review: 0,
    closed: 0,
    archived: 0,
    total: 0
  };
  for (const item of casesByStatusAgg) {
    if (casesByStatus[item._id] !== undefined) {
      casesByStatus[item._id] = item.count;
    }
    casesByStatus.total += item.count;
  }

  // Format evidence by status
  const evidenceByStatus = {
    unverified: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
    total: 0
  };
  for (const item of evidenceByStatusAgg) {
    if (evidenceByStatus[item._id] !== undefined) {
      evidenceByStatus[item._id] = item.count;
    }
    evidenceByStatus.total += item.count;
  }

  // Format hypotheses by status
  const hypothesesByStatus = {
    proposed: 0,
    under_investigation: 0,
    supported: 0,
    refuted: 0,
    inconclusive: 0,
    total: 0
  };
  for (const item of hypothesesByStatusAgg) {
    if (hypothesesByStatus[item._id] !== undefined) {
      hypothesesByStatus[item._id] = item.count;
    }
    hypothesesByStatus.total += item.count;
  }

  const averageConfidenceScore =
    avgConfidenceAgg.length > 0 && avgConfidenceAgg[0].avgConfidence !== null
      ? parseFloat(avgConfidenceAgg[0].avgConfidence.toFixed(1))
      : 50.0;

  return {
    cases: casesByStatus,
    evidence: evidenceByStatus,
    hypotheses: hypothesesByStatus,
    averageConfidenceScore,
    totalUsers,
    totalAuditLogs
  };
}
