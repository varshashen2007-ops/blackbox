import { AuditLog } from '../models/AuditLog.js';
import { Case } from '../models/Case.js';

export async function getNotifications(req, res, next) {
  try {
    const user = req.user;

    // Fetch recent audit events
    let query = {};
    if (user.role === 'investigator') {
      const assignedCases = await Case.find({
        $or: [{ createdBy: user._id }, { assignedInvestigators: user._id }]
      }).select('_id');
      const caseIds = assignedCases.map((c) => c._id);
      query = { caseId: { $in: caseIds } };
    }

    const recentAudits = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(15)
      .populate('actorId', 'name email role')
      .populate('caseId', 'title status')
      .lean();

    const notifications = recentAudits.map((a) => {
      let title = 'Investigation Event';
      let type = 'info';

      switch (a.action) {
        case 'EVIDENCE_VERIFIED':
          title = `Evidence Verified on ${a.caseId?.title || 'Case'}`;
          type = 'success';
          break;
        case 'EVIDENCE_REJECTED':
          title = `Evidence Rejected on ${a.caseId?.title || 'Case'}`;
          type = 'warning';
          break;
        case 'CASE_TRANSITIONED':
          title = `Case State Changed: ${a.caseId?.title || 'Case'}`;
          type = 'primary';
          break;
        case 'HYPOTHESIS_PROPOSED':
          title = `New Hypothesis Formulated`;
          type = 'info';
          break;
        case 'EVIDENCE_COLLECTED':
          title = `New Evidence Logged`;
          type = 'info';
          break;
        case 'RELATIONSHIP_CREATED':
          title = `Topology Edge Added`;
          type = 'info';
          break;
        default:
          title = `Audit Event: ${a.action}`;
      }

      return {
        id: a._id,
        title,
        action: a.action,
        actor: a.actorId?.name || 'System',
        caseId: a.caseId?._id || a.caseId,
        caseTitle: a.caseId?.title || 'Investigation',
        timestamp: a.timestamp,
        type,
        metadata: a.metadata
      };
    });

    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
}
