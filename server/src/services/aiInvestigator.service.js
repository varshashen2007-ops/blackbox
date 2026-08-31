import { Case } from '../models/Case.js';
import { Evidence } from '../models/Evidence.js';
import { Hypothesis } from '../models/Hypothesis.js';
import { EvidenceRelationship } from '../models/EvidenceRelationship.js';
import { AuditLog } from '../models/AuditLog.js';
import { calculateHypothesisConfidence } from './confidenceScore.service.js';

const DISCLAIMER = 'AI-generated analysis. Verify conclusions against the underlying evidence.';

async function gatherCaseContext(caseId) {
  const [caseDoc, evidenceList, rawHypotheses, relationships, recentAudit] = await Promise.all([
    Case.findById(caseId).populate('createdBy assignedInvestigators assignedSupervisor', 'name email role').lean(),
    Evidence.find({ caseId }).populate('collectedBy verifiedBy', 'name email role').lean(),
    Hypothesis.find({ caseId }).lean(),
    EvidenceRelationship.find({ caseId }).lean(),
    AuditLog.find({ caseId }).sort({ timestamp: -1 }).limit(10).populate('actorId', 'name email').lean()
  ]);

  const hypothesesWithScores = [];
  for (const h of rawHypotheses) {
    const analysis = await calculateHypothesisConfidence(h._id);
    hypothesesWithScores.push({
      ...h,
      confidenceScore: analysis.confidenceScore,
      breakdown: analysis.breakdown,
      conflicts: analysis.conflicts
    });
  }

  return {
    case: caseDoc,
    evidence: evidenceList,
    hypotheses: hypothesesWithScores,
    relationships,
    recentAudit
  };
}

export async function generateCaseAiBrief(caseId) {
  const context = await gatherCaseContext(caseId);
  const totalEvidence = context.evidence.length;
  const verifiedEvidence = context.evidence.filter((e) => e.verificationStatus === 'verified');
  const unverifiedEvidence = context.evidence.filter((e) => e.verificationStatus === 'unverified' || e.verificationStatus === 'pending');
  const rejectedEvidence = context.evidence.filter((e) => e.verificationStatus === 'rejected');

  const hypotheses = context.hypotheses;
  const leadingHypothesis = hypotheses.length > 0
    ? [...hypotheses].sort((a, b) => b.confidenceScore - a.confidenceScore)[0]
    : null;

  const totalConflicts = hypotheses.reduce((acc, h) => acc + (h.conflicts?.length || 0), 0);

  const briefBullets = [];

  if (totalEvidence === 0) {
    briefBullets.push('No evidence recorded yet. Begin by attaching forensic artifacts and logs.');
  } else {
    briefBullets.push(
      `${verifiedEvidence.length} of ${totalEvidence} evidence items verified (${Math.round((verifiedEvidence.length / totalEvidence) * 100)}% verified).`
    );
  }

  if (unverifiedEvidence.length > 0) {
    briefBullets.push(
      `${unverifiedEvidence.length} evidence items pending or unverified. Supervisor verification is required to factor them into hypothesis confidence scores.`
    );
  }

  if (leadingHypothesis) {
    briefBullets.push(
      `Leading hypothesis is "${leadingHypothesis.title}" with a deterministic confidence score of ${leadingHypothesis.confidenceScore}%.`
    );
  }

  if (totalConflicts > 0) {
    briefBullets.push(
      `WARNING: ${totalConflicts} contradictory evidence relationships detected between items supporting active hypotheses.`
    );
  }

  if (rejectedEvidence.length > 0) {
    briefBullets.push(
      `${rejectedEvidence.length} evidence items rejected during chain-of-custody review.`
    );
  }

  return {
    caseId,
    caseTitle: context.case?.title || 'Unknown Case',
    status: context.case?.status || 'draft',
    summaryBullets: briefBullets,
    metrics: {
      totalEvidence,
      verifiedCount: verifiedEvidence.length,
      unverifiedCount: unverifiedEvidence.length,
      rejectedCount: rejectedEvidence.length,
      hypothesisCount: hypotheses.length,
      leadingConfidence: leadingHypothesis?.confidenceScore || 50.0,
      conflictCount: totalConflicts
    },
    disclaimer: DISCLAIMER
  };
}

export async function queryAiInvestigator({ caseId, message, conversationHistory = [] }) {
  const context = await gatherCaseContext(caseId);

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const systemPrompt = `You are the BlackBox AI Cyber Investigator, an expert analytical assistant embedded in the BlackBox Digital Evidence Investigation Platform.
You are assisting an investigator on Case #${context.case?._id}: "${context.case?.title}".
Case Description: ${context.case?.description}
Case Status: ${context.case?.status}

Current Verified Evidence:
${context.evidence.map((e) => `- [${e.verificationStatus.toUpperCase()}] ${e.title} (${e.type}, Source: ${e.source}, Hash: ${e.fileHash || 'N/A'})`).join('\n')}

Current Relationships:
${context.relationships.map((r) => `- Evidence ${r.sourceEvidenceId} ${r.relationshipType.toUpperCase()} Evidence ${r.targetEvidenceId} (weight: ${r.weight})`).join('\n')}

Current Competing Hypotheses:
${context.hypotheses.map((h) => `- Hypothesis: "${h.title}" (Status: ${h.status}, Confidence: ${h.confidenceScore}%)\n  Conflicts: ${h.conflicts?.length || 0}`).join('\n')}

Rules:
1. ONLY reference evidence and hypotheses that exist in the context above.
2. NEVER invent evidence, fabricated hashes, or unconfirmed facts.
3. Clearly distinguish between verified evidence (which counts toward confidence) and unverified/rejected evidence.
4. If asked for next steps, recommend actions that resolve unverified items or contradictory relationships.
5. Keep your tone objective, precise, forensic, and analytical.`;

      const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am ready to provide objective, context-grounded forensic analysis for this investigation.' }] },
        ...conversationHistory.map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: message }] }
      ];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });

      if (response.ok) {
        const json = await response.json();
        const replyText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText) {
          return {
            response: replyText,
            disclaimer: DISCLAIMER,
            model: 'gemini-1.5-flash'
          };
        }
      }
    } catch (err) {
      console.warn('[AI Investigator] Gemini API call failed, falling back to internal reasoning engine:', err.message);
    }
  }

  // Graceful deterministic fallback analytical engine
  const reply = generateDeterministicAnalysis(context, message);
  return {
    response: reply,
    disclaimer: DISCLAIMER,
    model: 'blackbox-forensic-engine (offline mode)'
  };
}

function generateDeterministicAnalysis(context, message) {
  const query = message.toLowerCase();
  const verified = context.evidence.filter((e) => e.verificationStatus === 'verified');
  const unverified = context.evidence.filter((e) => e.verificationStatus === 'unverified' || e.verificationStatus === 'pending');
  const hypotheses = context.hypotheses;
  const leadingHypothesis = hypotheses.length > 0
    ? [...hypotheses].sort((a, b) => b.confidenceScore - a.confidenceScore)[0]
    : null;

  if (query.includes('summar') || query.includes('overview')) {
    return `### Case Investigation Brief: "${context.case?.title || 'Case'}"\n\n` +
      `- **Status:** ${context.case?.status?.toUpperCase()}\n` +
      `- **Evidence Repository:** ${context.evidence.length} total items (${verified.length} verified, ${unverified.length} pending/unverified).\n` +
      `- **Active Hypotheses:** ${hypotheses.length} competing theories currently evaluated.\n` +
      (leadingHypothesis ? `- **Leading Theory:** "${leadingHypothesis.title}" with a deterministic confidence of **${leadingHypothesis.confidenceScore}%**.\n` : '') +
      `\n**Investigative Focus:** ${unverified.length > 0 ? `Verify the ${unverified.length} pending evidence items to update confidence metrics.` : 'All collected evidence is currently verified.'}`;
  }

  if (query.includes('support') || query.includes('contradict')) {
    if (!leadingHypothesis) return 'No hypotheses have been formulated for this case yet.';
    const supporting = leadingHypothesis.breakdown?.filter((b) => b.stance === 'supports') || [];
    const contradicting = leadingHypothesis.breakdown?.filter((b) => b.stance === 'contradicts') || [];
    return `### Evidence Stance Analysis for "${leadingHypothesis.title}" (Score: ${leadingHypothesis.confidenceScore}%)\n\n` +
      `**Supporting Evidence (${supporting.length}):**\n` +
      (supporting.length > 0 ? supporting.map((s) => `- ${s.title} (${s.counted ? `+${s.effectiveContribution}` : 'Unverified - 0.00'})`).join('\n') : '- No supporting evidence linked.') +
      `\n\n**Contradicting Evidence (${contradicting.length}):**\n` +
      (contradicting.length > 0 ? contradicting.map((c) => `- ${c.title} (${c.counted ? `${c.effectiveContribution}` : 'Unverified - 0.00'})`).join('\n') : '- No contradicting evidence linked.');
  }

  if (query.includes('conflict') || query.includes('contradiction')) {
    const allConflicts = hypotheses.flatMap((h) => (h.conflicts || []).map((c) => `Hypothesis "${h.title}": ${c.message}`));
    if (allConflicts.length === 0) {
      return 'No contradictory evidence pairs are currently flagged among evidence supporting active hypotheses.';
    }
    return `### Flagged Evidence Contradictions (${allConflicts.length}):\n\n` + allConflicts.map((c) => `- ⚠️ ${c}`).join('\n');
  }

  if (query.includes('next') || query.includes('recommend') || query.includes('review')) {
    const recommendations = [];
    if (unverified.length > 0) {
      recommendations.push(`Submit and verify ${unverified.length} pending evidence items (e.g. "${unverified[0].title}").`);
    }
    if (hypotheses.length === 0) {
      recommendations.push('Propose initial competing hypotheses to begin structured stance evaluation.');
    }
    if (context.relationships.length === 0 && verified.length >= 2) {
      recommendations.push('Establish corroborating or causal relationships between verified evidence in the Topology Graph.');
    }
    return `### Recommended Investigative Actions:\n\n` +
      (recommendations.length > 0 ? recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') : 'All current evidence is verified and linked. Consider case review and report generation.');
  }

  // Default intelligent contextual reply
  return `Based on current case files for **"${context.case?.title}"**:\n\n` +
    `- **Evidence Health:** ${verified.length} verified artifacts, ${unverified.length} unverified.\n` +
    `- **Hypothesis Status:** ${leadingHypothesis ? `"${leadingHypothesis.title}" is leading at ${leadingHypothesis.confidenceScore}% confidence.` : 'No active hypotheses.'}\n\n` +
    `You can ask me to summarize the case, evaluate supporting/contradicting evidence, detect contradictions, or suggest next forensic steps.`;
}
