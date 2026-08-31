import * as relationshipService from '../services/relationship.service.js';

export async function listRelationships(req, res, next) {
  try {
    const { caseId } = req.params;
    const relationships = await relationshipService.getRelationshipsForCase(caseId);
    res.status(200).json({
      success: true,
      data: relationships
    });
  } catch (error) {
    next(error);
  }
}

export async function createRelationship(req, res, next) {
  try {
    const { caseId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const relationship = await relationshipService.createRelationship({
      caseId,
      sourceEvidenceId: req.body.sourceEvidenceId,
      targetEvidenceId: req.body.targetEvidenceId,
      relationshipType: req.body.relationshipType,
      weight: req.body.weight,
      notes: req.body.notes,
      user: req.user,
      ipAddress
    });

    res.status(201).json({
      success: true,
      data: relationship
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRelationship(req, res, next) {
  try {
    const { caseId, id } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const result = await relationshipService.deleteRelationship({
      caseId,
      relationshipId: id,
      user: req.user,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export async function getGraphData(req, res, next) {
  try {
    const { caseId } = req.params;
    const graph = await relationshipService.getCaseGraphData(caseId);
    res.status(200).json({
      success: true,
      data: graph
    });
  } catch (error) {
    next(error);
  }
}
