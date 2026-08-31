import path from 'path';
import fs from 'fs';
import { Evidence } from '../models/Evidence.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import { logAudit } from '../middleware/audit.js';
import * as evidenceService from '../services/evidence.service.js';

export async function listEvidence(req, res, next) {
  try {
    const { caseId } = req.params;
    const { page, limit, type, verificationStatus, tag, search } = req.query;

    const query = { caseId };

    if (type) query.type = type;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    if (tag) query.tags = tag.toLowerCase();
    if (search) query.$text = { $search: search };

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Evidence.find(query)
        .populate('collectedBy', 'name email role')
        .populate('verifiedBy', 'name email role')
        .populate('chainOfCustody.actorId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Evidence.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: items.map((item) => ({ ...item, id: item._id })),
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

export async function createEvidence(req, res, next) {
  try {
    const { caseId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const evidence = await evidenceService.createEvidence({
      caseId,
      title: req.body.title,
      description: req.body.description,
      type: req.body.type,
      source: req.body.source,
      tags: req.body.tags,
      file: req.file || null,
      initialCustodyNote: req.body.initialCustodyNote,
      user: req.user,
      ipAddress
    });

    const populated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

export async function getEvidenceById(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const evidence = await Evidence.findOne({ _id: id, caseId })
      .populate('collectedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    if (!evidence) {
      throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: evidence
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEvidence(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const evidence = await Evidence.findOne({ _id: id, caseId });

    if (!evidence) {
      throw new AppError('Evidence not found in this case', 404, 'NOT_FOUND');
    }

    if (evidence.verificationStatus === 'verified') {
      throw new AppError('Cannot modify verified evidence. Integrity lock in effect.', 409, 'EVIDENCE_LOCKED');
    }

    Object.assign(evidence, req.body);
    await evidence.save();

    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';
    await logAudit({
      actorId: req.user._id,
      action: 'EVIDENCE_UPDATED',
      entityType: 'Evidence',
      entityId: evidence._id,
      caseId,
      metadata: { changedFields: Object.keys(req.body) },
      ipAddress
    });

    const updated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function requestVerification(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const evidence = await evidenceService.requestVerification({
      caseId,
      evidenceId: id,
      user: req.user,
      ipAddress
    });

    const populated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEvidence(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const evidence = await evidenceService.verifyEvidence({
      caseId,
      evidenceId: id,
      user: req.user,
      ipAddress
    });

    const populated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectEvidence(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const { rejectionReason } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const evidence = await evidenceService.rejectEvidence({
      caseId,
      evidenceId: id,
      rejectionReason,
      user: req.user,
      ipAddress
    });

    const populated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

export async function appendCustody(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const { action, note } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const evidence = await evidenceService.appendCustodyAction({
      caseId,
      evidenceId: id,
      action,
      note,
      user: req.user,
      ipAddress
    });

    const populated = await Evidence.findById(evidence._id)
      .populate('collectedBy', 'name email role')
      .populate('verifiedBy', 'name email role')
      .populate('chainOfCustody.actorId', 'name email role');

    res.status(200).json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadFile(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const evidence = await Evidence.findOne({ _id: id, caseId });

    if (!evidence || !evidence.fileRefs || evidence.fileRefs.length === 0) {
      throw new AppError('No attachment found for this evidence item', 404, 'NOT_FOUND');
    }

    const filename = evidence.fileRefs[0];
    const filePath = path.join(config.uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found on storage disk', 404, 'NOT_FOUND');
    }

    res.download(filePath, filename);
  } catch (error) {
    next(error);
  }
}
