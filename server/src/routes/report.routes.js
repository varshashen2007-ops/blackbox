import { Router } from 'express';
import { generateCaseReport } from '../services/report.service.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const report = await generateCaseReport(caseId);
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
});

router.get('/download', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const report = await generateCaseReport(caseId);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="Case-Report-${caseId}.md"`);
    res.send(report.markdown);
  } catch (error) {
    next(error);
  }
});

export default router;
