import * as aiService from '../services/aiInvestigator.service.js';
import * as aiSupervisorService from '../services/aiSupervisor.service.js';

export async function getCaseBrief(req, res, next) {
  try {
    const { caseId } = req.params;
    const brief = await aiService.generateCaseAiBrief(caseId);
    res.status(200).json({
      success: true,
      data: brief
    });
  } catch (error) {
    next(error);
  }
}

export async function chatWithAi(req, res, next) {
  try {
    const { caseId } = req.params;
    const { message, history } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Message cannot be empty' }
      });
    }

    const result = await aiService.queryAiInvestigator({
      caseId,
      message,
      conversationHistory: history || []
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Triggers Automated AI Supervisor Review for a case
 */
export async function triggerAiReview(req, res, next) {
  try {
    const { caseId } = req.params;
    const ipAddress = req.ip || req.connection?.remoteAddress || 'unknown';

    const review = await aiSupervisorService.runAiSupervisorReview({
      caseId,
      user: req.user,
      ipAddress
    });

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets the latest AI Supervisor Review for a case
 */
export async function getLatestReview(req, res, next) {
  try {
    const { caseId } = req.params;
    const review = await aiSupervisorService.getLatestAiReview(caseId);

    if (!review) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No AI review has been performed for this case yet.'
      });
    }

    res.status(200).json({
      success: true,
      data: review
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Gets global AI Supervisor Dashboard statistics and recent reviews
 */
export async function getAiDashboardStats(req, res, next) {
  try {
    const stats = await aiSupervisorService.getAiSupervisorDashboardStats();
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
}
