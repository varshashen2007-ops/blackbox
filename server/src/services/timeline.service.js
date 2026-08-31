import { AuditLog } from '../models/AuditLog.js';

export async function getCaseTimeline(caseId) {
  const logs = await AuditLog.find({ caseId })
    .populate('actorId', 'name email role')
    .sort({ timestamp: -1 })
    .lean();

  return logs.map((log) => ({
    id: log._id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actor: log.actorId
      ? {
          id: log.actorId._id,
          name: log.actorId.name,
          email: log.actorId.email,
          role: log.actorId.role
        }
      : { id: null, name: 'System / Deleted User', email: '', role: 'unknown' },
    timestamp: log.timestamp,
    metadata: log.metadata,
    ipAddress: log.ipAddress
  }));
}
