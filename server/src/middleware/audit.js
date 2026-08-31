import { AuditLog } from '../models/AuditLog.js';

export async function logAudit({
  actorId,
  action,
  entityType,
  entityId,
  caseId = null,
  metadata = {},
  ipAddress = 'unknown'
}) {
  try {
    const entry = await AuditLog.create({
      actorId,
      action,
      entityType,
      entityId,
      caseId,
      metadata,
      ipAddress,
      timestamp: new Date()
    });
    return entry;
  } catch (error) {
    console.error(`[AuditLog Failure] Failed to record audit log for action '${action}':`, error.message);
    // Rethrow in critical flows or ensure logged for investigations
    throw error;
  }
}

export function auditMiddleware(action, entityType, getEntityIdAndCaseId) {
  return async (req, res, next) => {
    // Intercept response finish or provide res.locals.audit helper
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      // Execute original json send first
      const result = originalJson(body);

      // Write audit log if response was successful (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const { entityId, caseId, metadata } = getEntityIdAndCaseId
            ? getEntityIdAndCaseId(req, body)
            : {
                entityId: body?.data?.id || body?.data?._id || req.params.id,
                caseId: req.params.caseId || body?.data?.caseId || null,
                metadata: {}
              };

          if (entityId) {
            logAudit({
              actorId: req.user._id || req.user.id,
              action,
              entityType,
              entityId,
              caseId,
              metadata: { ...metadata, path: req.originalUrl, method: req.method },
              ipAddress: req.ip || req.connection?.remoteAddress || 'unknown'
            }).catch((err) => {
              console.error('[AuditMiddleware Error]', err.message);
            });
          }
        } catch (err) {
          console.error('[AuditMiddleware Exception]', err.message);
        }
      }

      return result;
    };

    next();
  };
}
