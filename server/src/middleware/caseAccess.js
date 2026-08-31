import { Case } from '../models/Case.js';
import { AppError } from './errorHandler.js';

/**
 * Reusable Case-Level Authorization Middleware
 * Enforces strict multi-tenant and case-assignment boundaries:
 * - Admin: Full access to all cases for system administration
 * - Supervisor: Access ONLY to cases assigned to them as supervisor, created by them, or assigned to them as investigator
 * - Investigator: Access ONLY to cases created by them or explicitly assigned to them
 * 
 * Unrelated supervisors and investigators receive 403 FORBIDDEN.
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

    // System Administrator has universal audit and oversight authority
    if (user.role === 'admin') {
      req.case = caseDoc;
      return next();
    }

    const userIdStr = user._id ? user._id.toString() : user.id;

    // Check if user is creator
    const isCreator = caseDoc.createdBy && caseDoc.createdBy.toString() === userIdStr;

    // Check if user is an assigned investigator
    const isAssignedInvestigator =
      Array.isArray(caseDoc.assignedInvestigators) &&
      caseDoc.assignedInvestigators.some((id) => (id._id ? id._id.toString() : id.toString()) === userIdStr);

    // Investigation Supervisor access check
    if (user.role === 'supervisor') {
      const isAssignedSupervisor =
        caseDoc.assignedSupervisor &&
        (caseDoc.assignedSupervisor._id
          ? caseDoc.assignedSupervisor._id.toString()
          : caseDoc.assignedSupervisor.toString()) === userIdStr;

      if (isAssignedSupervisor || isCreator || isAssignedInvestigator) {
        req.case = caseDoc;
        return next();
      }

      return next(
        new AppError('Access denied: You are not the assigned supervisor or investigator for this case file', 403, 'FORBIDDEN')
      );
    }

    // Investigator access check
    if (user.role === 'investigator') {
      if (isCreator || isAssignedInvestigator) {
        req.case = caseDoc;
        return next();
      }

      return next(
        new AppError('Access denied: You are not assigned to this case file', 403, 'FORBIDDEN')
      );
    }

    return next(new AppError('Access denied: Unauthorized access attempt', 403, 'FORBIDDEN'));
  } catch (error) {
    next(error);
  }
}
