import { Case } from '../models/Case.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';

/**
 * Canonical Lifecycle Transition Rules per Section 4 of 01-antigravity-build-prompt.md
 */
const TRANSITION_RULES = {
  draft: {
    active: {
      roles: ['investigator', 'supervisor'],
      requireReason: false,
      auditAction: 'CASE_ACTIVATED'
    }
  },
  active: {
    under_review: {
      roles: ['investigator', 'supervisor'],
      requireReason: false,
      auditAction: 'CASE_SUBMITTED_FOR_REVIEW'
    }
  },
  under_review: {
    active: {
      roles: ['supervisor'],
      requireReason: true, // sends back for more work, must include a reason
      auditAction: 'CASE_SENT_BACK_FOR_WORK'
    },
    closed: {
      roles: ['supervisor'],
      requireReason: false,
      auditAction: 'CASE_CLOSED'
    }
  },
  closed: {
    archived: {
      roles: ['admin', 'supervisor'],
      requireReason: false,
      auditAction: 'CASE_ARCHIVED'
    },
    active: {
      roles: ['supervisor'],
      requireReason: true, // case reopened, requires reason
      auditAction: 'CASE_REOPENED'
    }
  },
  archived: {}
};

/**
 * Validates and executes a case lifecycle transition
 */
export async function executeCaseTransition({ caseId, targetStatus, reason, user, ipAddress = 'unknown' }) {
  const caseDoc = await Case.findById(caseId);
  if (!caseDoc) {
    throw new AppError('Case not found', 404, 'NOT_FOUND');
  }

  const currentStatus = caseDoc.status;

  // Check if transition is defined in the matrix
  const allowedTransitionsFromCurrent = TRANSITION_RULES[currentStatus];
  if (!allowedTransitionsFromCurrent || !allowedTransitionsFromCurrent[targetStatus]) {
    throw new AppError(
      `Invalid case lifecycle transition from '${currentStatus}' to '${targetStatus}'. This transition is not permitted.`,
      409,
      'INVALID_TRANSITION'
    );
  }

  const rule = allowedTransitionsFromCurrent[targetStatus];

  // Role validation
  if (!rule.roles.includes(user.role)) {
    throw new AppError(
      `Role '${user.role}' is not authorized to transition case from '${currentStatus}' to '${targetStatus}'. Allowed roles: ${rule.roles.join(', ')}`,
      403,
      'FORBIDDEN'
    );
  }

  // Mandatory Reason validation
  if (rule.requireReason && (!reason || reason.trim().length === 0)) {
    throw new AppError(
      `Transition from '${currentStatus}' to '${targetStatus}' strictly requires a documented reason.`,
      422,
      'REASON_REQUIRED'
    );
  }

  // Execute status update
  caseDoc.status = targetStatus;
  if (targetStatus === 'closed' || targetStatus === 'archived') {
    caseDoc.closedAt = new Date();
  } else if (currentStatus === 'closed' && targetStatus === 'active') {
    caseDoc.closedAt = null; // reset if reopened
  }

  await caseDoc.save();

  // Synchronous Audit Log entry
  await logAudit({
    actorId: user._id || user.id,
    action: rule.auditAction,
    entityType: 'Case',
    entityId: caseDoc._id,
    caseId: caseDoc._id,
    metadata: {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reason: reason || null,
      actorRole: user.role
    },
    ipAddress
  });

  return caseDoc;
}

export function getAllowedTransitions(currentStatus, userRole) {
  const rules = TRANSITION_RULES[currentStatus] || {};
  return Object.entries(rules)
    .filter(([_, rule]) => rule.roles.includes(userRole))
    .map(([targetStatus, rule]) => ({
      targetStatus,
      requireReason: rule.requireReason,
      actionName: rule.auditAction
    }));
}
