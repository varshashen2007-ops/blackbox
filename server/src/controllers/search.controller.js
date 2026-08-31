import { Case } from '../models/Case.js';
import { Evidence } from '../models/Evidence.js';
import { Hypothesis } from '../models/Hypothesis.js';

export async function globalSearch(req, res, next) {
  try {
    const q = req.query.q ? req.query.q.trim() : '';

    if (!q || q.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          cases: [],
          evidence: [],
          hypotheses: [],
          totalMatches: 0
        }
      });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const user = req.user;
    const userIdStr = user._id ? user._id.toString() : user.id;

    // Step 1: Find all Case IDs authorized for this user
    let authorizedCaseQuery = {};
    if (user.role === 'investigator') {
      authorizedCaseQuery = {
        $or: [
          { createdBy: user._id },
          { assignedInvestigators: user._id }
        ]
      };
    } else if (user.role === 'supervisor') {
      authorizedCaseQuery = {
        $or: [
          { createdBy: user._id },
          { assignedSupervisor: user._id },
          { assignedInvestigators: user._id }
        ]
      };
    }
    // Admin has access to all cases

    const authorizedCases = await Case.find(authorizedCaseQuery).select('_id title description priority status').lean();
    const authorizedCaseIds = authorizedCases.map((c) => c._id);

    // Step 2: Search cases, evidence, and hypotheses strictly within authorizedCaseIds
    const caseMatchQuery = {
      _id: { $in: authorizedCaseIds },
      $or: [{ title: regex }, { description: regex }, { tags: regex }]
    };

    const evidenceMatchQuery = {
      caseId: { $in: authorizedCaseIds },
      $or: [{ title: regex }, { description: regex }, { source: regex }, { tags: regex }]
    };

    const hypothesisMatchQuery = {
      caseId: { $in: authorizedCaseIds },
      $or: [{ title: regex }, { description: regex }]
    };

    const [matchedCases, matchedEvidence, matchedHypotheses] = await Promise.all([
      Case.find(caseMatchQuery).limit(5).lean(),
      Evidence.find(evidenceMatchQuery).populate('caseId', 'title status').limit(8).lean(),
      Hypothesis.find(hypothesisMatchQuery).populate('caseId', 'title status').limit(5).lean()
    ]);

    const results = {
      cases: matchedCases.map((c) => ({
        id: c._id.toString(),
        _id: c._id.toString(),
        title: c.title,
        status: c.status,
        priority: c.priority,
        type: 'case',
        url: `/cases/${c._id}`
      })),
      evidence: matchedEvidence.map((e) => ({
        id: e._id.toString(),
        _id: e._id.toString(),
        title: e.title,
        type: e.type,
        verificationStatus: e.verificationStatus,
        caseId: e.caseId?._id ? e.caseId._id.toString() : e.caseId?.toString(),
        caseTitle: e.caseId?.title || 'Case',
        url: `/cases/${e.caseId?._id || e.caseId}?tab=evidence`
      })),
      hypotheses: matchedHypotheses.map((h) => ({
        id: h._id.toString(),
        _id: h._id.toString(),
        title: h.title,
        status: h.status,
        confidenceScore: h.confidenceScore,
        caseId: h.caseId?._id ? h.caseId._id.toString() : h.caseId?.toString(),
        caseTitle: h.caseId?.title || 'Case',
        url: `/cases/${h.caseId?._id || h.caseId}?tab=hypotheses`
      })),
      totalMatches: matchedCases.length + matchedEvidence.length + matchedHypotheses.length
    };

    res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
}
