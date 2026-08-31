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

    const regex = new RegExp(q, 'i');
    const user = req.user;

    // Filter accessible cases
    let caseQuery = {
      $or: [{ title: regex }, { description: regex }, { tags: regex }]
    };

    if (user.role === 'investigator') {
      caseQuery = {
        ...caseQuery,
        $or: [
          { createdBy: user._id, title: regex },
          { createdBy: user._id, description: regex },
          { assignedInvestigators: user._id, title: regex },
          { assignedInvestigators: user._id, description: regex }
        ]
      };
    }

    const [matchedCases, matchedEvidence, matchedHypotheses] = await Promise.all([
      Case.find(caseQuery).limit(5).lean(),
      Evidence.find({
        $or: [{ title: regex }, { description: regex }, { source: regex }, { tags: regex }]
      }).populate('caseId', 'title status').limit(8).lean(),
      Hypothesis.find({
        $or: [{ title: regex }, { description: regex }]
      }).populate('caseId', 'title status').limit(5).lean()
    ]);

    const results = {
      cases: matchedCases.map((c) => ({
        id: c._id,
        title: c.title,
        status: c.status,
        priority: c.priority,
        type: 'case',
        url: `/cases/${c._id}`
      })),
      evidence: matchedEvidence.map((e) => ({
        id: e._id,
        title: e.title,
        type: e.type,
        verificationStatus: e.verificationStatus,
        caseId: e.caseId?._id || e.caseId,
        caseTitle: e.caseId?.title || 'Case',
        url: `/cases/${e.caseId?._id || e.caseId}?tab=evidence`
      })),
      hypotheses: matchedHypotheses.map((h) => ({
        id: h._id,
        title: h.title,
        status: h.status,
        confidenceScore: h.confidenceScore,
        caseId: h.caseId?._id || h.caseId,
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
