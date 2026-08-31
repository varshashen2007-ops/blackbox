import { Case } from '../models/Case.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import * as lifecycleService from '../services/caseLifecycle.service.js';
import * as timelineService from '../services/timeline.service.js';

export async function createCase(req, res, next) {
  try {
    const { title, description, priority, assignedInvestigators, assignedSupervisor } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    // Validate assigned supervisor credibility (must be active user with supervisor role)
    if (assignedSupervisor) {
      const supUser = await User.findById(assignedSupervisor);
      if (!supUser || supUser.role !== 'supervisor' || supUser.status !== 'active') {
        throw new AppError(
          'Assigned supervisor must be an active user with verified Investigation Supervisor credentials',
          400,
          'INVALID_SUPERVISOR_ASSIGNMENT'
        );
      }
    }

    // Validate assigned investigators
    if (Array.isArray(assignedInvestigators) && assignedInvestigators.length > 0) {
      const invUsers = await User.find({ _id: { $in: assignedInvestigators }, status: 'active' });
      if (invUsers.length !== assignedInvestigators.length) {
        throw new AppError(
          'One or more assigned investigators are invalid or inactive',
          400,
          'INVALID_INVESTIGATOR_ASSIGNMENT'
        );
      }
    }

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
      metadata: {
        title: caseDoc.title,
        priority: caseDoc.priority,
        status: caseDoc.status,
        assignedSupervisor: caseDoc.assignedSupervisor,
        assignedInvestigatorsCount: caseDoc.assignedInvestigators.length
      },
      ipAddress
    });

    const populatedCase = await Case.findById(caseDoc._id)
      .populate('createdBy', 'name email role identityVerified')
      .populate('assignedInvestigators', 'name email role identityVerified')
      .populate('assignedSupervisor', 'name email role identityVerified organization');

    res.status(201).json({
      success: true,
      data: {
        ...populatedCase.toJSON(),
        _id: populatedCase._id.toString(),
        id: populatedCase._id.toString()
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getCases(req, res, next) {
  try {
    const { page, limit, status, priority, assigned, search, requiresReview, filter } = req.query;
    const query = {};

    const userId = req.user._id;

    // Role-based visibility filtering
    if (req.user.role === 'investigator') {
      query.$or = [
        { createdBy: userId },
        { assignedInvestigators: userId }
      ];
    } else if (req.user.role === 'supervisor') {
      // If filtering for "REQUIRES MY REVIEW" queue
      if (requiresReview === true || requiresReview === 'true' || filter === 'requires_review' || filter === 'review_queue') {
        query.assignedSupervisor = userId;
        query.status = 'under_review';
      } else {
        // Supervisors see cases they supervise, created, or are assigned to
        query.$or = [
          { createdBy: userId },
          { assignedSupervisor: userId },
          { assignedInvestigators: userId }
        ];
      }
    }
    // Admin sees all cases without restriction

    // Status filter
    if (status && !query.status) {
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

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [cases, total] = await Promise.all([
      Case.find(query)
        .populate('createdBy', 'name email role identityVerified')
        .populate('assignedInvestigators', 'name email role identityVerified')
        .populate('assignedSupervisor', 'name email role identityVerified organization')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Case.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      success: true,
      data: cases.map((c) => ({ ...c, _id: c._id.toString(), id: c._id.toString() })),
      pagination: {
        page: pageNum,
        limit: limitNum,
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
      .populate('createdBy', 'name email role identityVerified')
      .populate('assignedInvestigators', 'name email role identityVerified')
      .populate('assignedSupervisor', 'name email role identityVerified organization');

    if (!caseDoc) {
      throw new AppError('Case not found', 404, 'NOT_FOUND');
    }

    const userIdStr = req.user._id.toString();
    const creatorId = caseDoc.createdBy?._id ? caseDoc.createdBy._id.toString() : caseDoc.createdBy?.toString();
    const supervisorId = caseDoc.assignedSupervisor?._id ? caseDoc.assignedSupervisor._id.toString() : caseDoc.assignedSupervisor?.toString();
    const isAssigned = Array.isArray(caseDoc.assignedInvestigators) && caseDoc.assignedInvestigators.some((inv) => {
      const invId = inv?._id ? inv._id.toString() : inv?.toString();
      return invId === userIdStr;
    });

    // Access check: Investigator must be owner or assigned
    if (req.user.role === 'investigator') {
      const isOwner = creatorId === userIdStr;
      if (!isOwner && !isAssigned) {
        throw new AppError('Access denied: You are not assigned to this case', 403, 'FORBIDDEN');
      }
    } else if (req.user.role === 'supervisor') {
      const isSupervisor = supervisorId === userIdStr;
      const isOwner = creatorId === userIdStr;
      if (!isSupervisor && !isOwner && !isAssigned) {
        throw new AppError('Access denied: You are not the assigned supervisor for this case', 403, 'FORBIDDEN');
      }
    }

    const allowedTransitions = lifecycleService.getAllowedTransitions(caseDoc.status, req.user.role);

    res.status(200).json({
      success: true,
      data: {
        ...caseDoc.toJSON(),
        _id: caseDoc._id.toString(),
        id: caseDoc._id.toString(),
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

    const userIdStr = req.user._id.toString();
    const creatorId = caseDoc.createdBy ? caseDoc.createdBy.toString() : null;
    const supervisorId = caseDoc.assignedSupervisor ? caseDoc.assignedSupervisor.toString() : null;
    const isAssigned = Array.isArray(caseDoc.assignedInvestigators) && caseDoc.assignedInvestigators.some((id) => id.toString() === userIdStr);

    // Access check
    if (req.user.role === 'investigator') {
      const isOwner = creatorId === userIdStr;
      if (!isOwner && !isAssigned) {
        throw new AppError('Access denied: You cannot edit unassigned cases', 403, 'FORBIDDEN');
      }
    } else if (req.user.role === 'supervisor') {
      const isSupervisor = supervisorId === userIdStr;
      const isOwner = creatorId === userIdStr;
      if (!isSupervisor && !isOwner && !isAssigned) {
        throw new AppError('Access denied: You cannot edit cases you do not supervise', 403, 'FORBIDDEN');
      }
    }

    // Cannot edit archived or closed cases directly without reopening
    if (caseDoc.status === 'archived' || caseDoc.status === 'closed') {
      throw new AppError(`Cannot modify a ${caseDoc.status} case. Reopen the case first.`, 409, 'CASE_LOCKED');
    }

    // Validate supervisor assignment update
    if (req.body.assignedSupervisor) {
      const supUser = await User.findById(req.body.assignedSupervisor);
      if (!supUser || supUser.role !== 'supervisor' || supUser.status !== 'active') {
        throw new AppError('Assigned supervisor must be an active Investigation Supervisor', 400, 'INVALID_SUPERVISOR_ASSIGNMENT');
      }
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    Object.assign(caseDoc, req.body);
    await caseDoc.save();

    await logAudit({
      actorId: req.user._id,
      action: req.body.assignedSupervisor || req.body.assignedInvestigators ? 'CASE_ASSIGNMENT_UPDATED' : 'CASE_UPDATED',
      entityType: 'Case',
      entityId: caseDoc._id,
      caseId: caseDoc._id,
      metadata: { changedFields: Object.keys(req.body) },
      ipAddress
    });

    const updated = await Case.findById(caseDoc._id)
      .populate('createdBy', 'name email role identityVerified')
      .populate('assignedInvestigators', 'name email role identityVerified')
      .populate('assignedSupervisor', 'name email role identityVerified organization');

    res.status(200).json({
      success: true,
      data: {
        ...updated.toJSON(),
        _id: updated._id.toString(),
        id: updated._id.toString()
      }
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
      .populate('createdBy', 'name email role identityVerified')
      .populate('assignedInvestigators', 'name email role identityVerified')
      .populate('assignedSupervisor', 'name email role identityVerified organization');

    const allowedTransitions = lifecycleService.getAllowedTransitions(populated.status, req.user.role);

    res.status(200).json({
      success: true,
      data: {
        ...populated.toJSON(),
        _id: populated._id.toString(),
        id: populated._id.toString(),
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

/**
 * Return active supervisors for case assignment dropdown
 */
export async function listEligibleSupervisors(req, res, next) {
  try {
    const supervisors = await User.find({ role: 'supervisor', status: 'active' })
      .select('name email role organization identityVerified professionalEmail')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: supervisors.map((s) => ({ ...s, id: s._id.toString(), _id: s._id.toString() }))
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Return active investigators for case assignment selector
 */
export async function listEligibleInvestigators(req, res, next) {
  try {
    const investigators = await User.find({ role: 'investigator', status: 'active' })
      .select('name email role identityVerified')
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: investigators.map((i) => ({ ...i, id: i._id.toString(), _id: i._id.toString() }))
    });
  } catch (error) {
    next(error);
  }
}
