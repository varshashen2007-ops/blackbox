import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import { getSystemStatistics } from '../services/adminStats.service.js';

export async function getStats(req, res, next) {
  try {
    const stats = await getSystemStatistics();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

export async function listUsers(req, res, next) {
  try {
    const { page, limit, role, status, search } = req.query;
    const query = {};

    if (role) query.role = role;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).select('-passwordHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: users.map((u) => ({ ...u, id: u._id })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    // Prevent self role downgrade if sole admin
    if (user._id.toString() === req.user._id.toString() && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', status: 'active' });
      if (adminCount <= 1) {
        throw new AppError('Cannot downgrade the only active administrator', 400, 'ADMIN_LOCKOUT_PREVENTION');
      }
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    await logAudit({
      actorId: req.user._id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: user._id,
      metadata: { fromRole: oldRole, toRole: role, targetUserEmail: user.email },
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserStatus(req, res, next) {
  try {
    const { status } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    if (user._id.toString() === req.user._id.toString() && status === 'suspended') {
      throw new AppError('Administrators cannot suspend their own account', 400, 'SELF_SUSPENSION_DENIED');
    }

    const oldStatus = user.status;
    user.status = status;
    await user.save();

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    await logAudit({
      actorId: req.user._id,
      action: 'USER_STATUS_CHANGED',
      entityType: 'User',
      entityId: user._id,
      metadata: { fromStatus: oldStatus, toStatus: status, targetUserEmail: user.email },
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function listAuditLogs(req, res, next) {
  try {
    const { page, limit, actorId, action, entityType, caseId } = req.query;
    const query = {};

    if (actorId) query.actorId = actorId;
    if (action) query.action = action;
    if (entityType) query.entityType = entityType;
    if (caseId) query.caseId = caseId;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate('actorId', 'name email role')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: logs.map((log) => ({
        id: log._id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        caseId: log.caseId,
        actor: log.actorId
          ? { id: log.actorId._id, name: log.actorId.name, email: log.actorId.email, role: log.actorId.role }
          : { id: null, name: 'System / Unknown', email: '', role: 'unknown' },
        timestamp: log.timestamp,
        metadata: log.metadata,
        ipAddress: log.ipAddress
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) {
    next(error);
  }
}
