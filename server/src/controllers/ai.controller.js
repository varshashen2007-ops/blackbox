import * as aiService from '../services/aiInvestigator.service.js';

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
