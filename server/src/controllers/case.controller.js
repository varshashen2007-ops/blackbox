import { Case } from '../models/Case.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import * as lifecycleService from '../services/caseLifecycle.service.js';
import * as timelineService from '../services/timeline.service.js';

export async function createCase(req, res, next) {
  try {
    const { title, description, priority, assignedInvestigators, assignedSupervisor } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const caseDoc = await Case.create({
      title,
      description,
      priority,
      status: 'draft',
      createdBy: req.user._id,
      assignedInvestigators: assignedInvestigators || [],
      assignedSupervisor: assignedSupervisor || null
    });

    await logAudit({
      actorId: req.user._id,
      action: 'CASE_CREATED',
      entityType: 'Case',
      entityId: caseDoc._id,
      caseId: caseDoc._id,
      metadata: { title: caseDoc.title, priority: caseDoc.priority, status: caseDoc.status },
      ipAddress
    });

    const populatedCase = await Case.findById(caseDoc._id)
      .populate('createdBy', 'name email role')
      .populate('assignedInvestigators', 'name email role')
      .populate('assignedSupervisor', 'name email role');

    res.status(201).json({
      success: true,
      data: populatedCase
    });
  } catch (error) {
    next(error);
  }
}

export async function getCases(req, res, next) {
  try {
    const { page, limit, status, priority, assigned, search } = req.query;
    const query = {};

    // Role-based visibility filtering
    if (req.user.role === 'investigator') {
      query.$or = [
        { createdBy: req.user._id },
        { assignedInvestigators: req.user._id }
      ];
    } else if (req.user.role === 'supervisor') {
      // Supervisors see cases they created, supervise, or have assigned investigators
      query.$or = [
        { createdBy: req.user._id },
        { assignedSupervisor: req.user._id },
        { assignedInvestigators: req.user._id }
      ];
    }
    // Admin sees all cases without restriction

    // Status filter
    if (status) {
      query.status = status;
    }

    // Priority filter
    if (priority) {
      query.priority = priority;
    }

    // Assigned user filter
    if (assigned) {
      query.assignedInvestigators = assigned;
    }

    // Text search filter
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate('createdBy', 'name email role')
        .populate('assignedInvestigators', 'name email role')
        .populate('assignedSupervisor', 'name email role')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Case.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCaseById(req, res, next) {
  try {
    const caseDoc = await Case.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('assignedInvestigators', 'name email role')
      .populate('assignedSupervisor', 'name email role');

    if (!caseDoc) {
      throw new AppError('Case not found', 404, 'NOT_FOUND');
    }

    // Access check: Investigator must be owner or assigned
    if (req.user.role === 'investigator') {
      const isOwner = caseDoc.createdBy._id.toString() === req.user._id.toString();
      const isAssigned = caseDoc.assignedInvestigators.some(
        (inv) => inv._id.toString() === req.user._id.toString()
      );
      if (!isOwner && !isAssigned) {
        throw new AppError('Access denied: You are not assigned to this case', 403, 'FORBIDDEN');
      }
    }

    const allowedTransitions = lifecycleService.getAllowedTransitions(caseDoc.status, req.user.role);

    res.status(200).json({
      success: true,
      data: {
        ...caseDoc.toJSON(),
        allowedTransitions
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCase(req, res, next) {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) {
      throw new AppError('Case not found', 404, 'NOT_FOUND');
    }

    // Access check
    if (req.user.role === 'investigator') {
      const isOwner = caseDoc.createdBy.toString() === req.user._id.toString();
      const isAssigned = caseDoc.assignedInvestigators.some(
        (id) => id.toString() === req.user._id.toString()
      );
      if (!isOwner && !isAssigned) {
        throw new AppError('Access denied: You cannot edit unassigned cases', 403, 'FORBIDDEN');
      }
    }

    // Cannot edit archived or closed cases directly without reopening
    if (caseDoc.status === 'archived' || caseDoc.status === 'closed') {
      throw new AppError(`Cannot modify a ${caseDoc.status} case. Reopen the case first.`, 409, 'CASE_LOCKED');
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const originalData = { ...caseDoc.toObject() };

    Object.assign(caseDoc, req.body);
    await caseDoc.save();

    await logAudit({
      actorId: req.user._id,
      action: 'CASE_UPDATED',
      entityType: 'Case',
      entityId: caseDoc._id,
      caseId: caseDoc._id,
      metadata: { changedFields: Object.keys(req.body) },
      ipAddress
    });

    const updated = await Case.findById(caseDoc._id)
      .populate('createdBy', 'name email role')
      .populate('assignedInvestigators', 'name email role')
      .populate('assignedSupervisor', 'name email role');

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function transitionCase(req, res, next) {
  try {
    const { targetStatus, reason } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const updatedCase = await lifecycleService.executeCaseTransition({
      caseId: req.params.id,
      targetStatus,
      reason,
      user: req.user,
      ipAddress
    });

    const populated = await Case.findById(updatedCase._id)
      .populate('createdBy', 'name email role')
      .populate('assignedInvestigators', 'name email role')
      .populate('assignedSupervisor', 'name email role');

    const allowedTransitions = lifecycleService.getAllowedTransitions(populated.status, req.user.role);

    res.status(200).json({
      success: true,
      data: {
        ...populated.toJSON(),
        allowedTransitions
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCaseTimeline(req, res, next) {
  try {
    const timeline = await timelineService.getCaseTimeline(req.params.id);
    res.status(200).json({
      success: true,
      data: timeline
    });
  } catch (error) {
    next(error);
  }
}
