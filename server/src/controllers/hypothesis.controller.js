import * as hypothesisService from '../services/hypothesis.service.js';

export async function listHypotheses(req, res, next) {
  try {
    const { caseId } = req.params;
    const hypotheses = await hypothesisService.getHypothesesForCase(caseId);
    res.status(200).json({
      success: true,
      data: hypotheses
    });
  } catch (error) {
    next(error);
  }
}

export async function createHypothesis(req, res, next) {
  try {
    const { caseId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const hypothesis = await hypothesisService.createHypothesis({
      caseId,
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      user: req.user,
      ipAddress
    });

    const detailed = await hypothesisService.getHypothesisDetail(caseId, hypothesis._id);

    res.status(201).json({
      success: true,
      data: detailed
    });
  } catch (error) {
    next(error);
  }
}

export async function getHypothesisById(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const hypothesis = await hypothesisService.getHypothesisDetail(caseId, id);
    res.status(200).json({
      success: true,
      data: hypothesis
    });
  } catch (error) {
    next(error);
  }
}

export async function updateHypothesis(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const updated = await hypothesisService.updateHypothesis({
      caseId,
      hypothesisId: id,
      title: req.body.title,
      description: req.body.description,
      status: req.body.status,
      user: req.user,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function linkEvidence(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const { evidenceId, stance } = req.body;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const updated = await hypothesisService.linkEvidenceToHypothesis({
      caseId,
      hypothesisId: id,
      evidenceId,
      stance,
      user: req.user,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

export async function unlinkEvidence(req, res, next) {
  try {
    const { caseId, id, evidenceId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const updated = await hypothesisService.unlinkEvidenceFromHypothesis({
      caseId,
      hypothesisId: id,
      evidenceId,
      user: req.user,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}
