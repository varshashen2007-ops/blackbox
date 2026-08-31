import { User } from '../models/User.js';
import { SupervisorRequest } from '../models/SupervisorRequest.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';

export async function createSupervisorRequest(
  { user, fullName, professionalEmail, organization, professionalTitle, reason, credentialReference },
  ipAddress = 'unknown'
) {
  if (user.role === 'supervisor' || user.role === 'admin') {
    throw new AppError('User already possesses elevated supervisor or administrator privileges', 400, 'ALREADY_ELEVATED');
  }

  // Check for existing pending request
  const existingPending = await SupervisorRequest.findOne({
    userId: user._id,
    status: { $in: ['pending', 'under_review'] }
  });

  if (existingPending) {
    throw new AppError('A supervisor request is already pending review for this account', 409, 'REQUEST_ALREADY_PENDING');
  }

  const request = await SupervisorRequest.create({
    userId: user._id,
    fullName: fullName || user.name,
    professionalEmail: professionalEmail.toLowerCase().trim(),
    organization: organization.trim(),
    professionalTitle: professionalTitle.trim(),
    reason: reason.trim(),
    credentialReference: credentialReference ? credentialReference.trim() : null,
    identityVerifiedAtRequest: !!user.identityVerified,
    status: 'pending'
  });

  // Update user metadata
  await User.findByIdAndUpdate(user._id, {
    supervisorStatus: 'pending',
    organization: organization.trim(),
    professionalEmail: professionalEmail.toLowerCase().trim()
  });

  await logAudit({
    actorId: user._id,
    action: 'SUPERVISOR_REQUESTED',
    entityType: 'SupervisorRequest',
    entityId: request._id,
    metadata: {
      professionalEmail: request.professionalEmail,
      organization: request.organization,
      professionalTitle: request.professionalTitle
    },
    ipAddress
  });

  return request;
}

export async function getMySupervisorRequest(userId) {
  const request = await SupervisorRequest.findOne({ userId })
    .sort({ createdAt: -1 })
    .populate('reviewedBy', 'name email role');
  return request;
}

export async function listSupervisorRequests({ page = 1, limit = 20, status }) {
  const query = {};
  if (status) query.status = status;

  const skip = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    SupervisorRequest.find(query)
      .populate('userId', 'name email role status identityVerified emailVerified createdAt')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupervisorRequest.countDocuments(query)
  ]);

  return {
    requests: requests.map((r) => ({ ...r, id: r._id })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

export async function approveSupervisorRequest({ requestId, adminUser, reviewNotes }, ipAddress = 'unknown') {
  const request = await SupervisorRequest.findById(requestId);
  if (!request) {
    throw new AppError('Supervisor request not found', 404, 'NOT_FOUND');
  }

  // Prevent self-approval
  if (request.userId.toString() === adminUser._id.toString()) {
    throw new AppError('Administrative conflict of interest: Requesters cannot approve their own supervisor status', 403, 'SELF_APPROVAL_DENIED');
  }

  if (request.status === 'approved') {
    throw new AppError('Supervisor request is already approved', 400, 'ALREADY_APPROVED');
  }

  const targetUser = await User.findById(request.userId);
  if (!targetUser) {
    throw new AppError('Target user account not found', 404, 'NOT_FOUND');
  }

  if (targetUser.status === 'suspended' || targetUser.status === 'revoked') {
    throw new AppError(`Cannot approve supervisor privileges for a ${targetUser.status} user account`, 400, 'INVALID_ACCOUNT_STATE');
  }

  // Update request record
  request.status = 'approved';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  if (reviewNotes) request.reviewNotes = reviewNotes;
  await request.save();

  // Elevate user to supervisor role
  targetUser.role = 'supervisor';
  targetUser.supervisorStatus = 'approved';
  targetUser.supervisorApprovedBy = adminUser._id;
  targetUser.supervisorApprovedAt = new Date();
  targetUser.professionalEmailVerified = true;
  await targetUser.save();

  await logAudit({
    actorId: adminUser._id,
    action: 'SUPERVISOR_APPROVED',
    entityType: 'User',
    entityId: targetUser._id,
    metadata: {
      targetUserEmail: targetUser.email,
      requestId: request._id,
      organization: request.organization,
      reviewNotes: reviewNotes || null
    },
    ipAddress
  });

  return { request, user: targetUser.toJSON() };
}

export async function rejectSupervisorRequest({ requestId, adminUser, reviewNotes }, ipAddress = 'unknown') {
  const request = await SupervisorRequest.findById(requestId);
  if (!request) {
    throw new AppError('Supervisor request not found', 404, 'NOT_FOUND');
  }

  request.status = 'rejected';
  request.reviewedBy = adminUser._id;
  request.reviewedAt = new Date();
  if (reviewNotes) request.reviewNotes = reviewNotes;
  await request.save();

  await User.findByIdAndUpdate(request.userId, {
    supervisorStatus: 'rejected'
  });

  await logAudit({
    actorId: adminUser._id,
    action: 'SUPERVISOR_REJECTED',
    entityType: 'User',
    entityId: request.userId,
    metadata: {
      requestId: request._id,
      reviewNotes: reviewNotes || null
    },
    ipAddress
  });

  return { request };
}

export async function revokeSupervisorPrivilege({ userId, adminUser, reason }, ipAddress = 'unknown') {
  const targetUser = await User.findById(userId);
  if (!targetUser) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  if (targetUser.role !== 'supervisor') {
    throw new AppError('Target user is not currently an active supervisor', 400, 'NOT_A_SUPERVISOR');
  }

  if (targetUser._id.toString() === adminUser._id.toString()) {
    throw new AppError('Administrators cannot revoke their own accounts via supervisor revocation', 400, 'INVALID_ACTION');
  }

  // Demote to investigator
  targetUser.role = 'investigator';
  targetUser.supervisorStatus = 'revoked';
  await targetUser.save();

  // Mark latest approved request as revoked
  await SupervisorRequest.updateMany(
    { userId: targetUser._id, status: 'approved' },
    { status: 'revoked', reviewNotes: reason || 'Privilege revoked by Administrator' }
  );

  await logAudit({
    actorId: adminUser._id,
    action: 'SUPERVISOR_REVOKED',
    entityType: 'User',
    entityId: targetUser._id,
    metadata: {
      targetUserEmail: targetUser.email,
      reason: reason || 'Administrative privilege revocation'
    },
    ipAddress
  });

  return { user: targetUser.toJSON() };
}
