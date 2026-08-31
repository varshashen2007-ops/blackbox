<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';
  import EvidenceBoard from '$lib/components/EvidenceBoard.svelte';
  import HypothesisPanel from '$lib/components/HypothesisPanel.svelte';
  import RelationshipGraph from '$lib/components/RelationshipGraph.svelte';

  let caseId = $page.params.id;
  let caseData = null;
  let timeline = [];
  let aiBrief = null;
  let report = null;
  let loading = true;
  let errorMsg = null;
  let activeTab = 'overview';

  // Transition state
  let showReasonModal = false;
  let selectedTargetStatus = null;
  let selectedActionLabel = '';
  let transitionReason = '';
  let transitioning = false;
  let transitionError = null;

  // Report state
  let reportLoading = false;
  let reportError = null;

  async function loadCase() {
    loading = true;
    errorMsg = null;
    try {
      const [caseRes, timelineRes, briefRes] = await Promise.allSettled([
        api.get(`/cases/${caseId}`),
        api.get(`/cases/${caseId}/timeline`),
        api.get(`/cases/${caseId}/ai/brief`)
      ]);

      if (caseRes.status === 'fulfilled' && caseRes.value?.success) {
        caseData = caseRes.value.data;
      } else if (caseRes.status === 'rejected') {
        const err = caseRes.reason;
        if (err?.code === 'UNAUTHENTICATED' || err?.code === 'TOKEN_EXPIRED') goto('/login');
        else errorMsg = err?.message || 'Failed to load case.';
      }
      if (timelineRes.status === 'fulfilled' && timelineRes.value?.success) {
        timeline = timelineRes.value.data;
      }
      if (briefRes.status === 'fulfilled' && briefRes.value?.success) {
        aiBrief = briefRes.value.data;
      }
    } finally {
      loading = false;
    }
  }

  async function loadReport() {
    reportLoading = true;
    reportError = null;
    try {
      const res = await api.get(`/cases/${caseId}/report`);
      if (res?.success) report = res.data;
    } catch (err) {
      reportError = err.message || 'Failed to generate report.';
    } finally {
      reportLoading = false;
    }
  }

  function handleTransitionClick(transition) {
    transitionError = null;
    selectedTargetStatus = transition.targetStatus;
    selectedActionLabel = getActionLabel(transition.targetStatus);
    if (transition.requireReason) {
      transitionReason = '';
      showReasonModal = true;
    } else {
      executeTransition(transition.targetStatus, null);
    }
  }

  async function executeTransition(targetStatus, reason) {
    transitioning = true;
    transitionError = null;
    try {
      const res = await api.post(`/cases/${caseId}/transition`, {
        targetStatus,
        reason: reason || undefined
      });
      if (res?.success) {
        showReasonModal = false;
        await loadCase();
      }
    } catch (err) {
      transitionError = err.message || 'Transition failed.';
    } finally {
      transitioning = false;
    }
  }

  function getActionLabel(targetStatus) {
    switch (targetStatus) {
      case 'active': return caseData?.status === 'closed' ? 'Reopen Case' : 'Activate Investigation';
      case 'under_review': return 'Submit for AI Review';
      case 'closed': return 'Approve Closure';
      case 'archived': return 'Archive Case Record';
      default: return `Transition to ${targetStatus}`;
    }
  }

  // Lifecycle steps for visual stepper
  const LIFECYCLE_STEPS = ['draft', 'active', 'under_review', 'closed', 'archived'];

  function getStepState(step, currentStatus) {
    const currentIdx = LIFECYCLE_STEPS.indexOf(currentStatus);
    const stepIdx = LIFECYCLE_STEPS.indexOf(step);
    if (stepIdx < currentIdx) return 'done';
    if (stepIdx === currentIdx) return 'current';
    return 'pending';
  }

  function stepLabel(step) {
    switch (step) {
      case 'draft': return 'Draft';
      case 'active': return 'Active';
      case 'under_review': return 'Review';
      case 'closed': return 'Closed';
      case 'archived': return 'Archived';
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
  }

  function formatRelative(d) {
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(d).toLocaleDateString();
  }

  let aiReview = null;
  let aiReviewLoading = false;
  let aiReviewError = null;

  async function loadAiReview() {
    aiReviewLoading = true;
    aiReviewError = null;
    try {
      const res = await api.get(`/cases/${caseId}/ai/review`);
      if (res?.success) {
        aiReview = res.data;
      }
    } catch (err) {
      aiReviewError = err.message || 'Failed to load AI review.';
    } finally {
      aiReviewLoading = false;
    }
  }

  async function runAiReview() {
    aiReviewLoading = true;
    aiReviewError = null;
    try {
      const res = await api.post(`/cases/${caseId}/ai/review`, {});
      if (res?.success) {
        aiReview = res.data;
        await loadCase();
      }
    } catch (err) {
      aiReviewError = err.message || 'Failed to run AI review.';
    } finally {
      aiReviewLoading = false;
    }
  }

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'evidence', label: 'Evidence Board' },
    { id: 'hypotheses', label: 'Hypotheses' },
    { id: 'graph', label: 'Topology Graph' },
    { id: 'timeline', label: 'Audit Timeline' },
    { id: 'report', label: 'Case Report' },
    { id: 'ai_supervisor', label: 'AI Supervisor', badge: 'AUTOMATED' },
    { id: 'ai', label: 'AI Investigator' }
  ];

  onMount(() => {
    const urlTab = $page.url.searchParams.get('tab');
    if (urlTab) activeTab = urlTab;
    loadCase();
    if (activeTab === 'ai_supervisor') loadAiReview();
  });
</script>

{#if errorMsg}
  <div class="alert-banner">
    <strong>Access Denied or Case Not Found:</strong> {errorMsg}
    <a href="/cases" class="btn btn-secondary btn-sm" style="margin-left: 1rem;">← Back to Cases</a>
  </div>
{:else if loading}
  <div class="loading-workspace">
    <div class="spinner"></div>
    <p class="font-mono">Loading Investigation Workspace...</p>
  </div>
{:else if caseData}
  <div class="workspace">

    <!-- ===== FORENSIC CASE HEADER ===== -->
    <div class="case-header">
      <div class="case-breadcrumb">
        <a href="/cases" class="crumb-link">Cases</a>
        <span class="crumb-sep">/</span>
        <span class="crumb-current font-mono">CASE-{caseData.id?.slice(-8).toUpperCase()}</span>
      </div>

      <div class="case-header-main">
        <div class="case-header-left">
          <div class="badge-row">
            <span class="status-badge badge-status-{caseData.status}">
              {caseData.status.replace('_', ' ').toUpperCase()}
            </span>
            <span class="priority-chip priority-{caseData.priority}">
              {caseData.priority?.toUpperCase()} PRIORITY
            </span>
            {#if caseData.category}
              <span class="meta-chip">{caseData.category}</span>
            {/if}
          </div>
          <h1 class="case-title">{caseData.title}</h1>
          <p class="case-meta-row font-mono">
            Created {formatDate(caseData.createdAt)} by {caseData.createdBy?.name || '—'}
            {#if caseData.assignedSupervisor}
              &nbsp;• Supervisor: {caseData.assignedSupervisor?.name}
            {/if}
          </p>
        </div>

        <div class="case-header-actions">
          {#if caseData.allowedTransitions?.length > 0}
            {#each caseData.allowedTransitions as t}
              <button
                class="btn btn-secondary btn-sm"
                on:click={() => handleTransitionClick(t)}
                disabled={transitioning}
              >
                {getActionLabel(t.targetStatus)}
              </button>
            {/each}
          {:else}
            <span class="no-transitions font-mono">No available transitions</span>
          {/if}
        </div>
      </div>

      <!-- Lifecycle Stepper -->
      <div class="lifecycle-stepper">
        {#each LIFECYCLE_STEPS as step, i}
          <div class="step step-{getStepState(step, caseData.status)}">
            <div class="step-circle">
              {#if getStepState(step, caseData.status) === 'done'}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              {:else}
                <span>{i + 1}</span>
              {/if}
            </div>
            <span class="step-label">{stepLabel(step)}</span>
          </div>
          {#if i < LIFECYCLE_STEPS.length - 1}
            <div class="step-connector step-connector-{getStepState(LIFECYCLE_STEPS[i + 1], caseData.status)}"></div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- ===== WORKSPACE TABS ===== -->
    <div class="workspace-tabs">
      {#each TABS as tab}
        <button
          class="tab-btn"
          class:tab-active={activeTab === tab.id}
          on:click={() => {
            activeTab = tab.id;
            if (tab.id === 'report' && !report && !reportLoading) loadReport();
          }}
        >
          {tab.label}
          {#if tab.id === 'timeline' && timeline.length > 0}
            <span class="tab-count">{timeline.length}</span>
          {/if}
          {#if tab.id === 'ai'}
            <span class="tab-ai-pill">AI</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- ===== TAB CONTENT ===== -->
    <div class="tab-content">

      <!-- OVERVIEW TAB -->
      {#if activeTab === 'overview'}
        <div class="overview-grid">
          <!-- Description Card -->
          <div class="card overview-desc-card">
            <div class="card-title-row">
              <h3>Case Description & Scope</h3>
            </div>
            <p class="desc-text">{caseData.description || 'No description provided.'}</p>
            {#if caseData.tags?.length > 0}
              <div class="tag-row">
                {#each caseData.tags as tag}
                  <span class="tag-chip">#{tag}</span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Personnel Card -->
          <div class="card">
            <div class="card-title-row">
              <h3>Assigned Personnel</h3>
            </div>
            <div class="personnel-list">
              {#if caseData.createdBy}
                <div class="personnel-row">
                  <span class="personnel-role">Lead Investigator</span>
                  <span class="personnel-name">{caseData.createdBy.name}</span>
                  <span class="personnel-email font-mono">{caseData.createdBy.email}</span>
                </div>
              {/if}
              {#if caseData.assignedSupervisor}
                <div class="personnel-row">
                  <span class="personnel-role">Supervisor</span>
                  <span class="personnel-name">{caseData.assignedSupervisor.name}</span>
                  <span class="personnel-email font-mono">{caseData.assignedSupervisor.email}</span>
                </div>
              {/if}
              {#if caseData.assignedInvestigators?.length > 0}
                {#each caseData.assignedInvestigators as inv}
                  <div class="personnel-row">
                    <span class="personnel-role">Investigator</span>
                    <span class="personnel-name">{inv.name}</span>
                    <span class="personnel-email font-mono">{inv.email}</span>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- AI Brief Card -->
          {#if aiBrief}
            <div class="card ai-brief-card">
              <div class="card-title-row ai-title-row">
                <h3>AI Investigator Brief</h3>
                <span class="ai-model-badge font-mono">{aiBrief.model || 'forensic-engine'}</span>
              </div>
              <div class="ai-metrics-row">
                <div class="ai-metric">
                  <span class="ai-metric-val">{aiBrief.metrics?.totalEvidence ?? 0}</span>
                  <span class="ai-metric-label">Total Evidence</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val ai-val-success">{aiBrief.metrics?.verifiedCount ?? 0}</span>
                  <span class="ai-metric-label">Verified</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val ai-val-warn">{aiBrief.metrics?.unverifiedCount ?? 0}</span>
                  <span class="ai-metric-label">Unverified</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val">{aiBrief.metrics?.hypothesisCount ?? 0}</span>
                  <span class="ai-metric-label">Hypotheses</span>
                </div>
                {#if aiBrief.metrics?.conflictCount > 0}
                  <div class="ai-metric">
                    <span class="ai-metric-val ai-val-danger">{aiBrief.metrics.conflictCount}</span>
                    <span class="ai-metric-label">⚠️ Conflicts</span>
                  </div>
                {/if}
              </div>
              <ul class="ai-bullets">
                {#each aiBrief.summaryBullets as bullet}
                  <li>{bullet}</li>
                {/each}
              </ul>
              <p class="ai-disclaimer font-mono">{aiBrief.disclaimer}</p>
            </div>
          {/if}
        </div>

      <!-- EVIDENCE BOARD TAB -->
      {:else if activeTab === 'evidence'}
        <EvidenceBoard {caseId} userRole={$auth.user?.role} on:updated={loadCase} />

      <!-- HYPOTHESES TAB -->
      {:else if activeTab === 'hypotheses'}
        <HypothesisPanel {caseId} userRole={$auth.user?.role} on:updated={loadCase} />

      <!-- TOPOLOGY GRAPH TAB -->
      {:else if activeTab === 'graph'}
        <RelationshipGraph {caseId} userRole={$auth.user?.role} />

      <!-- AUDIT TIMELINE TAB -->
      {:else if activeTab === 'timeline'}
        <div class="timeline-section">
          <div class="section-header-row">
            <h2>Immutable Investigation Audit Trail</h2>
            <span class="mono-meta">{timeline.length} events recorded</span>
          </div>
          {#if timeline.length === 0}
            <div class="empty-state">No audit events recorded for this case yet.</div>
          {:else}
            <div class="timeline-list">
              {#each timeline as event}
                <div class="timeline-event">
                  <div class="event-connector">
                    <div class="event-dot"></div>
                    <div class="event-line"></div>
                  </div>
                  <div class="event-body">
                    <div class="event-header-row">
                      <span class="event-action font-mono">{event.action}</span>
                      <span class="event-time font-mono">{formatDate(event.timestamp)}</span>
                    </div>
                    <div class="event-actor">
                      Actor: <strong>{event.actorId?.name || 'System'}</strong>
                      {#if event.actorId?.role}
                        <span class="role-pill">{event.actorId.role.toUpperCase()}</span>
                      {/if}
                    </div>
                    {#if event.metadata && Object.keys(event.metadata).length > 0}
                      <details class="event-meta-details">
                        <summary class="font-mono">Metadata</summary>
                        <pre class="meta-json font-mono">{JSON.stringify(event.metadata, null, 2)}</pre>
                      </details>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

      <!-- REPORT TAB -->
      {:else if activeTab === 'report'}
        <div class="report-section">
          <div class="section-header-row">
            <h2>Generated Forensic Case Report</h2>
            {#if report}
              <a
                href="/api/v1/cases/{caseId}/report/download"
                target="_blank"
                class="btn btn-secondary btn-sm"
              >
                ⬇ Download Markdown
              </a>
            {/if}
          </div>
          {#if reportLoading}
            <div class="loading-workspace">
              <div class="spinner"></div>
              <p class="font-mono">Generating cryptographic integrity report...</p>
            </div>
          {:else if reportError}
            <div class="alert-banner">{reportError}</div>
          {:else if report}
            <div class="report-summary-grid">
              <div class="report-stat">
                <span class="report-stat-val">{report.evidenceSummary?.total ?? 0}</span>
                <span class="report-stat-label">Evidence Items</span>
              </div>
              <div class="report-stat">
                <span class="report-stat-val">{report.evidenceSummary?.verified ?? 0}</span>
                <span class="report-stat-label">Verified</span>
              </div>
              <div class="report-stat">
                <span class="report-stat-val">{report.hypotheses?.length ?? 0}</span>
                <span class="report-stat-label">Hypotheses</span>
              </div>
              <div class="report-stat">
                <span class="report-stat-val">{report.auditLogs?.length ?? 0}</span>
                <span class="report-stat-label">Audit Events</span>
              </div>
            </div>
            <div class="report-evidence-table">
              <h3 class="report-section-heading">Evidence Integrity Register</h3>
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>SHA-256 Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {#each (report.evidenceSummary?.items || []) as e}
                    <tr>
                      <td>{e.title}</td>
                      <td class="font-mono">{e.type}</td>
                      <td>
                        <span class="status-badge badge-{e.verificationStatus}">
                          {e.verificationStatus.toUpperCase()}
                        </span>
                      </td>
                      <td class="font-mono hash-cell" title={e.fileHash}>
                        {e.fileHash ? e.fileHash.slice(0, 16) + '...' : 'N/A'}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else}
            <div class="empty-state">
              <p>Click the "Case Report" tab to generate the forensic report.</p>
              <button class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" on:click={loadReport}>
                Generate Report
              </button>
            </div>
          {/if}
        </div>

      <!-- AI SUPERVISOR TAB -->
      {:else if activeTab === 'ai_supervisor'}
        <div class="ai-supervisor-section card p-6 space-y-6">
          <div class="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border pb-4 gap-4">
            <div>
              <div class="flex items-center gap-3">
                <h3 class="text-xl font-bold text-white">BLACKBOX AI SUPERVISOR REVIEW</h3>
                <span class="px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
                  AUTOMATED ENGINE
                </span>
              </div>
              <p class="text-sm text-text-muted mt-1">
                Automated case analysis, cryptographic hash integrity checks, contradiction detection, and hypothesis confidence evaluation.
              </p>
            </div>
            <button
              class="btn btn-secondary btn-sm flex items-center gap-2 font-mono"
              on:click={runAiReview}
              disabled={aiReviewLoading}
              title="Manually re-run the automated review analysis"
            >
              {#if aiReviewLoading}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Analyzing Case Files...
              {:else}
                🔄 Re-run AI Review
              {/if}
            </button>
          </div>

          {#if aiReviewError}
            <div class="p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm font-mono">
              ⚠️ {aiReviewError}
            </div>
          {/if}

          {#if aiReviewLoading && !aiReview}
            <div class="p-12 text-center text-text-muted font-mono space-y-3">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto"></div>
              <div>Running cryptographic integrity checks and LLM forensic stance reasoning...</div>
            </div>
          {:else if aiReview}
            <!-- Review Decision Card -->
            <div class="p-4 rounded-lg bg-bg-elevated border border-border space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="text-xs font-mono uppercase text-text-muted font-semibold">REVIEW DECISION:</span>
                  {#if aiReview.decision === 'READY_FOR_CLOSURE'}
                    <span class="px-3 py-1 rounded text-xs font-mono font-extrabold border bg-emerald-950 text-emerald-400 border-emerald-800">
                      ● READY FOR CLOSURE
                    </span>
                  {:else if aiReview.decision === 'REQUIRES_ATTENTION'}
                    <span class="px-3 py-1 rounded text-xs font-mono font-extrabold border bg-amber-950 text-amber-400 border-amber-800">
                      ⚠ REQUIRES ATTENTION
                    </span>
                  {:else if aiReview.decision === 'REVIEW_BLOCKED'}
                    <span class="px-3 py-1 rounded text-xs font-mono font-extrabold border bg-red-950 text-red-400 border-red-800">
                      ⛔ REVIEW BLOCKED
                    </span>
                  {:else}
                    <span class="px-3 py-1 rounded text-xs font-mono font-extrabold border bg-cyan-950 text-cyan-400 border-cyan-800">
                      ● REVIEW COMPLETE
                    </span>
                  {/if}
                </div>
                <span class="text-xs font-mono text-text-muted">
                  Model: {aiReview.modelName || 'Llama-3.3-70B'} ({aiReview.modelProvider || 'groq'})
                </span>
              </div>
              <p class="text-sm text-white leading-relaxed font-medium">
                {aiReview.overallAssessment}
              </p>
            </div>

            <!-- Deterministic Metrics Row -->
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
              <div class="p-3 rounded bg-bg-card border border-border">
                <div class="text-[11px] text-text-muted uppercase">TOTAL EVIDENCE</div>
                <div class="text-xl font-bold text-white">{aiReview.deterministicMetrics?.totalEvidence || 0}</div>
              </div>
              <div class="p-3 rounded bg-bg-card border border-border">
                <div class="text-[11px] text-text-muted uppercase">VERIFIED / REVIEWED</div>
                <div class="text-xl font-bold text-emerald-400">{aiReview.deterministicMetrics?.verifiedCount || 0}</div>
              </div>
              <div class="p-3 rounded bg-bg-card border border-border">
                <div class="text-[11px] text-text-muted uppercase">INTEGRITY PASSED</div>
                <div class="text-xl font-bold text-cyan-400">{aiReview.deterministicMetrics?.integrityPassedCount || 0}</div>
              </div>
              <div class="p-3 rounded bg-bg-card border border-border">
                <div class="text-[11px] text-text-muted uppercase">LEADING CONFIDENCE</div>
                <div class="text-xl font-bold text-cyan-400">{aiReview.deterministicMetrics?.leadingConfidence || 50}%</div>
              </div>
              <div class="p-3 rounded bg-bg-card border border-border">
                <div class="text-[11px] text-text-muted uppercase">CONTRADICTIONS</div>
                <div class="text-xl font-bold { (aiReview.deterministicMetrics?.conflictCount || 0) > 0 ? 'text-amber-400' : 'text-emerald-400' }">
                  {aiReview.deterministicMetrics?.conflictCount || 0}
                </div>
              </div>
            </div>

            <!-- Evidence Assessments Section -->
            <div class="space-y-3">
              <h4 class="text-sm font-bold text-white uppercase font-mono tracking-wider border-b border-border pb-2">
                Evidence Integrity & Stance Assessments
              </h4>
              {#if (aiReview.evidenceAssessments || []).length === 0}
                <div class="text-xs text-text-muted font-mono italic">No evidence items analyzed.</div>
              {:else}
                <div class="space-y-2">
                  {#each aiReview.evidenceAssessments as evEval}
                    <div class="p-3 rounded bg-bg-card border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div class="space-y-1 flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-white">{evEval.title || 'Evidence Item'}</span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                            {evEval.assessment}
                          </span>
                          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                            SHA-256 {evEval.integritySignal || 'CALCULATED'}
                          </span>
                        </div>
                        <p class="text-text-muted">{evEval.reason}</p>
                      </div>
                      <div class="font-mono text-cyan-400 text-right">
                        Stance Confidence: {Math.round((evEval.confidence || 0.8) * 100)}%
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Hypothesis Assessments Section -->
            <div class="space-y-3">
              <h4 class="text-sm font-bold text-white uppercase font-mono tracking-wider border-b border-border pb-2">
                Competing Hypothesis Evaluations
              </h4>
              {#if (aiReview.hypothesisAssessments || []).length === 0}
                <div class="text-xs text-text-muted font-mono italic">No competing hypotheses evaluated.</div>
              {:else}
                <div class="space-y-2">
                  {#each aiReview.hypothesisAssessments as hypEval}
                    <div class="p-3 rounded bg-bg-card border border-border space-y-1 text-xs">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-white text-sm">{hypEval.title || 'Hypothesis'}</span>
                        <span class="font-mono text-cyan-400 font-extrabold text-sm">
                          {hypEval.confidence}% Confidence
                        </span>
                      </div>
                      <p class="text-text-muted">{hypEval.reasoning}</p>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Recommendations & Contradictions Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="p-4 rounded bg-bg-card border border-border space-y-2">
                <h5 class="text-xs font-mono font-bold text-white uppercase tracking-wider text-cyan-400">
                  AI RECOMMENDATIONS
                </h5>
                <ul class="space-y-1 text-xs text-text-muted list-disc list-inside">
                  {#each (aiReview.recommendations || []) as rec}
                    <li>{rec}</li>
                  {/each}
                </ul>
              </div>

              <div class="p-4 rounded bg-bg-card border border-border space-y-2">
                <h5 class="text-xs font-mono font-bold text-white uppercase tracking-wider text-amber-400">
                  FLAGGED CONTRADICTIONS
                </h5>
                {#if (aiReview.contradictions || []).length === 0}
                  <div class="text-xs text-emerald-400 font-mono">✓ No unresolved evidence contradictions detected.</div>
                {:else}
                  <ul class="space-y-1 text-xs text-amber-300 list-disc list-inside">
                    {#each aiReview.contradictions as con}
                      <li>{con.description} (Severity: {con.severity})</li>
                    {/each}
                  </ul>
                {/if}
              </div>
            </div>

            <!-- Confidence Explanation -->
            {#if aiReview.confidenceExplanation}
              <div class="p-3 rounded bg-bg-elevated border border-border text-xs font-mono text-text-muted">
                ℹ️ <strong>Confidence Engine Explanation:</strong> {aiReview.confidenceExplanation}
              </div>
            {/if}
          {:else}
            <div class="p-12 text-center text-text-muted font-mono space-y-3">
              <p>The AI Supervisor automatically executes when this case is transitioned to <strong>UNDER_REVIEW</strong>.</p>
              <p class="text-xs text-text-secondary">You can also manually trigger an analysis below.</p>
              <button class="btn btn-secondary btn-sm" on:click={runAiReview}>
                🔄 Re-run AI Review Now
              </button>
            </div>
          {/if}
        </div>

      <!-- AI INVESTIGATOR TAB -->
      {:else if activeTab === 'ai'}
        <div class="ai-tab-section">
          {#if aiBrief}
            <div class="ai-tab-brief">
              <div class="ai-tab-header">
                <div class="ai-badge-row">
                  <span class="ai-live-badge">AI ACTIVE</span>
                  <span class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">
                    Disclaimer: {aiBrief.disclaimer}
                  </span>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                  Use the <strong>AI Investigator drawer</strong> (top bar button) for multi-turn forensic analysis on this case. The brief below summarizes the current investigation status.
                </p>
              </div>
              <div class="ai-metrics-row">
                <div class="ai-metric">
                  <span class="ai-metric-val">{aiBrief.metrics?.totalEvidence ?? 0}</span>
                  <span class="ai-metric-label">Total Evidence</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val ai-val-success">{aiBrief.metrics?.verifiedCount ?? 0}</span>
                  <span class="ai-metric-label">Verified</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val ai-val-warn">{aiBrief.metrics?.unverifiedCount ?? 0}</span>
                  <span class="ai-metric-label">Pending Verification</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val">{aiBrief.metrics?.hypothesisCount ?? 0}</span>
                  <span class="ai-metric-label">Active Hypotheses</span>
                </div>
                <div class="ai-metric">
                  <span class="ai-metric-val ai-val-success">{aiBrief.metrics?.leadingConfidence?.toFixed(1) ?? '50.0'}%</span>
                  <span class="ai-metric-label">Leading Confidence</span>
                </div>
                {#if aiBrief.metrics?.conflictCount > 0}
                  <div class="ai-metric">
                    <span class="ai-metric-val ai-val-danger">{aiBrief.metrics.conflictCount}</span>
                    <span class="ai-metric-label">Evidence Conflicts</span>
                  </div>
                {/if}
              </div>
              <div class="ai-brief-bullets">
                <h4>AI Analysis Bullets</h4>
                <ul class="ai-bullets">
                  {#each aiBrief.summaryBullets as bullet}
                    <li>{bullet}</li>
                  {/each}
                </ul>
              </div>
            </div>
          {:else}
            <div class="empty-state">
              <p>AI brief is loading or unavailable.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ===== TRANSITION REASON MODAL ===== -->
{#if showReasonModal}
  <div
    class="modal-backdrop"
    role="presentation"
    on:click|self={() => { showReasonModal = false; }}
    on:keydown={(e) => e.key === 'Escape' && (showReasonModal = false)}
  >
    <div class="modal-box">
      <div class="modal-header">
        <h3>{selectedActionLabel}</h3>
        <button class="close-btn" on:click={() => { showReasonModal = false; }}>✕</button>
      </div>
      <div class="modal-body">
        <label for="reason-input" class="form-label">
          Justification / Reason <span class="required">*</span>
        </label>
        <textarea
          id="reason-input"
          class="form-textarea"
          rows="4"
          bind:value={transitionReason}
          placeholder="Provide a detailed justification for this status transition..."
        ></textarea>
        {#if transitionError}
          <div class="form-error">{transitionError}</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={() => { showReasonModal = false; }}>Cancel</button>
        <button
          class="btn btn-primary"
          disabled={transitioning || transitionReason.trim().length < 5}
          on:click={() => executeTransition(selectedTargetStatus, transitionReason.trim())}
        >
          {transitioning ? 'Processing...' : 'Confirm Transition'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* ===== HEADER ===== */
  .case-header {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .case-breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .crumb-link {
    color: var(--accent-cyan);
    text-decoration: none;
  }

  .crumb-link:hover { text-decoration: underline; }
  .crumb-sep { color: var(--text-muted); }
  .crumb-current { color: var(--text-secondary); }

  .case-header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  .badge-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .priority-chip {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    letter-spacing: 0.05em;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .priority-high { color: var(--color-danger); border-color: rgba(248, 81, 73, 0.4); background-color: rgba(248, 81, 73, 0.1); }
  .priority-medium { color: var(--color-warning); border-color: rgba(210, 153, 34, 0.4); background-color: rgba(210, 153, 34, 0.1); }
  .priority-low { color: var(--color-success); border-color: rgba(63, 185, 80, 0.4); background-color: rgba(63, 185, 80, 0.1); }

  .meta-chip {
    font-size: 0.6875rem;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    background-color: var(--bg-elevated);
    color: var(--text-muted);
    border: 1px solid var(--border-color);
  }

  .case-title {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    line-height: 1.2;
    margin-bottom: 0.4rem;
  }

  .case-meta-row {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .case-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .no-transitions {
    font-size: 0.6875rem;
    color: var(--text-muted);
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 5px;
  }

  /* Lifecycle Stepper */
  .lifecycle-stepper {
    display: flex;
    align-items: center;
    gap: 0;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-color);
  }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
  }

  .step-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    border: 2px solid var(--border-color);
    background-color: var(--bg-primary);
    color: var(--text-muted);
  }

  .step-done .step-circle {
    background-color: rgba(63, 185, 80, 0.2);
    border-color: var(--color-success);
    color: var(--color-success);
  }

  .step-current .step-circle {
    background-color: rgba(0, 229, 255, 0.15);
    border-color: var(--accent-cyan);
    color: var(--accent-cyan);
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
  }

  .step-label {
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .step-done .step-label { color: var(--color-success); }
  .step-current .step-label { color: var(--accent-cyan); }

  .step-connector {
    flex: 1;
    height: 2px;
    background-color: var(--border-color);
    margin-bottom: 1rem;
    min-width: 24px;
  }

  .step-connector-done { background-color: var(--color-success); }
  .step-connector-current { background: linear-gradient(to right, var(--color-success) 50%, var(--border-color) 50%); }

  /* ===== TABS ===== */
  .workspace-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 1.5rem;
    overflow-x: auto;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 0.84rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--text-secondary);
  }

  .tab-active {
    color: var(--accent-cyan) !important;
    border-bottom-color: var(--accent-cyan) !important;
    font-weight: 600;
  }

  .tab-count {
    font-size: 0.6875rem;
    padding: 0.1rem 0.35rem;
    border-radius: 10px;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .tab-ai-pill {
    font-size: 0.5625rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background-color: rgba(0, 229, 255, 0.15);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 229, 255, 0.4);
    letter-spacing: 0.03em;
  }

  /* ===== OVERVIEW TAB ===== */
  .overview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }

  @media (max-width: 820px) {
    .overview-grid { grid-template-columns: 1fr; }
  }

  .card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  .card-title-row h3 {
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .overview-desc-card {
    grid-column: 1 / -1;
  }

  .desc-text {
    color: var(--text-secondary);
    font-size: 0.9375rem;
    line-height: 1.6;
    margin-bottom: 0.75rem;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }

  .tag-chip {
    font-size: 0.6875rem;
    padding: 0.2rem 0.5rem;
    border-radius: 12px;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  /* Personnel */
  .personnel-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .personnel-row {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.625rem;
    border-radius: 6px;
    background-color: var(--bg-primary);
  }

  .personnel-role {
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--accent-cyan);
    text-transform: uppercase;
  }

  .personnel-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .personnel-email {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* AI Brief Card */
  .ai-brief-card {
    grid-column: 1 / -1;
    border-color: rgba(0, 229, 255, 0.25);
    background-color: rgba(0, 229, 255, 0.03);
  }

  .ai-title-row { }

  .ai-model-badge {
    font-size: 0.625rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background-color: var(--bg-elevated);
    color: var(--text-muted);
  }

  .ai-metrics-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding: 0.75rem;
    background-color: var(--bg-primary);
    border-radius: 6px;
  }

  .ai-metric {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    align-items: center;
  }

  .ai-metric-val {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
  }

  .ai-val-success { color: var(--color-success); }
  .ai-val-warn    { color: var(--color-warning); }
  .ai-val-danger  { color: var(--color-danger); }

  .ai-metric-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    white-space: nowrap;
    text-align: center;
  }

  .ai-bullets {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .ai-bullets li {
    font-size: 0.875rem;
    color: var(--text-secondary);
    padding-left: 1rem;
    position: relative;
    line-height: 1.5;
  }

  .ai-bullets li::before {
    content: '›';
    position: absolute;
    left: 0;
    color: var(--accent-cyan);
    font-weight: 700;
  }

  .ai-disclaimer {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }

  /* ===== TIMELINE TAB ===== */
  .timeline-section, .report-section, .ai-tab-section {
    max-width: 900px;
  }

  .section-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .section-header-row h2 {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .mono-meta {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .timeline-list {
    display: flex;
    flex-direction: column;
  }

  .timeline-event {
    display: flex;
    gap: 1rem;
  }

  .event-connector {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .event-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--accent-cyan);
    border: 2px solid var(--bg-primary);
    flex-shrink: 0;
    margin-top: 0.2rem;
  }

  .event-line {
    width: 2px;
    flex: 1;
    background-color: var(--border-color);
    margin-top: 4px;
    min-height: 32px;
  }

  .event-body {
    flex: 1;
    padding-bottom: 1.25rem;
  }

  .event-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.25rem;
  }

  .event-action {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.03em;
  }

  .event-time {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .event-actor {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .role-pill {
    font-size: 0.5625rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    background-color: var(--bg-elevated);
    color: var(--text-muted);
    margin-left: 0.35rem;
  }

  .event-meta-details {
    margin-top: 0.5rem;
  }

  .event-meta-details summary {
    font-size: 0.6875rem;
    color: var(--text-muted);
    cursor: pointer;
  }

  .meta-json {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    background-color: var(--bg-primary);
    padding: 0.625rem;
    border-radius: 6px;
    margin-top: 0.35rem;
    overflow-x: auto;
    white-space: pre-wrap;
  }

  /* ===== REPORT TAB ===== */
  .report-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .report-stat {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .report-stat-val {
    display: block;
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .report-stat-label {
    display: block;
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
  }

  .report-section-heading {
    font-size: 0.9375rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .report-evidence-table {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  th {
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }

  .hash-cell {
    font-size: 0.6875rem;
    color: var(--accent-cyan);
  }

  /* ===== AI TAB ===== */
  .ai-tab-brief {
    background-color: var(--bg-card);
    border: 1px solid rgba(0, 229, 255, 0.25);
    border-radius: 10px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .ai-tab-header { }

  .ai-badge-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .ai-live-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background-color: rgba(0, 229, 255, 0.2);
    color: var(--accent-cyan);
    border: 1px solid rgba(0, 229, 255, 0.5);
    letter-spacing: 0.06em;
  }

  .ai-brief-bullets h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.75rem;
  }

  /* ===== COMMON ===== */
  .alert-banner {
    background-color: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.4);
    color: var(--color-danger);
    padding: 1rem 1.25rem;
    border-radius: 8px;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .loading-workspace {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 4rem 2rem;
    color: var(--text-muted);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* ===== TRANSITION MODAL ===== */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .modal-box {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .modal-header h3 { font-size: 1rem; font-weight: 700; }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .modal-body { padding: 1.25rem 1.5rem; }
  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .form-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
  }

  .required { color: var(--color-danger); }

  .form-textarea {
    width: 100%;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.75rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.875rem;
    resize: vertical;
    outline: none;
  }

  .form-textarea:focus { border-color: var(--accent-cyan); }

  .form-error {
    color: var(--color-danger);
    font-size: 0.8125rem;
    margin-top: 0.5rem;
  }
</style>
