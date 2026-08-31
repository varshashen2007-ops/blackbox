import * as supervisorService from '../services/supervisor.service.js';

export async function submitRequest(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const request = await supervisorService.createSupervisorRequest(
      {
        user: req.user,
        ...req.body
      },
      ipAddress
    );

    res.status(201).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyRequest(req, res, next) {
  try {
    const request = await supervisorService.getMySupervisorRequest(req.user._id);
    res.status(200).json({
      success: true,
      data: request
    });
  } catch (error) {
    next(error);
  }
}

export async function listRequests(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await supervisorService.listSupervisorRequests({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status
    });

    res.status(200).json({
      success: true,
      data: result.requests,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

export async function approveRequest(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await supervisorService.approveSupervisorRequest(
      {
        requestId: req.params.id,
        adminUser: req.user,
        reviewNotes: req.body.reviewNotes
      },
      ipAddress
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRequest(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await supervisorService.rejectSupervisorRequest(
      {
        requestId: req.params.id,
        adminUser: req.user,
        reviewNotes: req.body.reviewNotes
      },
      ipAddress
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeSupervisor(req, res, next) {
  try {
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    const result = await supervisorService.revokeSupervisorPrivilege(
      {
        userId: req.params.userId,
        adminUser: req.user,
        reason: req.body.reason
      },
      ipAddress
    );

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}
