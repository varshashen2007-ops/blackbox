import { Case } from '../models/Case.js';
import { AppError } from './errorHandler.js';

/**
 * Reusable Case-Level Authorization Middleware
 * Enforces strict multi-tenant isolation:
 * - Admin: Full access to all cases
 * - Supervisor: Full supervisory oversight
 * - Investigator: Only creator or explicitly assigned investigators
 */
export async function requireCaseAccess(req, res, next) {
  try {
    const caseId = req.params.caseId || req.params.id;

    if (!caseId) {
      return next(new AppError('Case ID parameter missing', 400, 'BAD_REQUEST'));
    }

    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) {
      return next(new AppError('Case not found', 404, 'NOT_FOUND'));
    }

    const user = req.user;
    if (!user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    }

    if (user.role === 'admin' || user.role === 'supervisor') {
      req.case = caseDoc;
      return next();
    }

    if (user.role === 'investigator') {
      const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === user._id.toString();
      const isAssigned =
        Array.isArray(caseDoc.assignedInvestigators) &&
        caseDoc.assignedInvestigators.some((id) => id.toString() === user._id.toString());

      if (isCreator || isAssigned) {
        req.case = caseDoc;
        return next();
      }
    }

    return next(new AppError('Access denied: You are not assigned to this case file', 403, 'FORBIDDEN'));
  } catch (error) {
    next(error);
  }
}
