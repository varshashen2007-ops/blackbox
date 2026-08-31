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
  let loading = true;
  let errorMsg = null;
  let activeTab = 'timeline';

  // Transition Action state
  let showReasonModal = false;
  let selectedTargetStatus = null;
  let selectedActionLabel = '';
  let transitionReason = '';
  let transitioning = false;
  let transitionError = null;

  async function loadCase() {
    loading = true;
    errorMsg = null;

    try {
      const [caseRes, timelineRes] = await Promise.all([
        api.get(`/cases/${caseId}`),
        api.get(`/cases/${caseId}/timeline`)
      ]);

      if (caseRes && caseRes.success) {
        caseData = caseRes.data;
      }
      if (timelineRes && timelineRes.success) {
        timeline = timelineRes.data;
      }
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED') {
        goto('/login');
      } else {
        errorMsg = err.message || 'Failed to load case details.';
      }
    } finally {
      loading = false;
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

      if (res && res.success) {
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
      case 'active':
        return caseData?.status === 'closed' ? 'Reopen Case' : 'Activate Investigation';
      case 'under_review':
        return 'Submit for Supervisor Review';
      case 'closed':
        return 'Approve Closure';
      case 'archived':
        return 'Archive Case Record';
      default:
        return `Transition to ${targetStatus}`;
    }
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'draft': return 'badge-draft';
      case 'active': return 'badge-active';
      case 'under_review': return 'badge-review';
      case 'closed': return 'badge-closed';
      case 'archived': return 'badge-archived';
      default: return '';
    }
  }

  onMount(() => {
    loadCase();
  });
</script>

<div class="case-workspace">
  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
    <a href="/cases" class="btn btn-secondary">← Back to Cases</a>
  {:else if loading}
    <div class="loading-box">
      <div class="spinner"></div>
      <p>Loading Case Workspace...</p>
    </div>
  {:else if caseData}
    <div class="workspace-header">
      <div class="breadcrumb">
        <a href="/cases" class="crumb-link">Cases</a>
        <span class="crumb-sep">/</span>
        <span class="crumb-current font-mono">CASE-{caseData.id?.slice(-6).toUpperCase()}</span>
      </div>

      <div class="header-main">
        <div class="title-block">
          <div class="badges-row">
            <span class={`status-badge ${getStatusBadgeClass(caseData.status)}`}>
              {caseData.status.replace('_', ' ').toUpperCase()}
            </span>
            <span class="priority-badge">{caseData.priority.toUpperCase()} PRIORITY</span>
          </div>
          <h1>{caseData.title}</h1>
        </div>

        <!-- Role-Gated Lifecycle Action Buttons -->
        <div class="lifecycle-actions">
          {#if caseData.allowedTransitions && caseData.allowedTransitions.length > 0}
            {#each caseData.allowedTransitions as t}
              <button
                class="btn btn-action"
                on:click={() => handleTransitionClick(t)}
                disabled={transitioning}
              >
                {getActionLabel(t.targetStatus)}
              </button>
            {/each}
          {:else}
            <span class="no-actions-badge">No available status transitions</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Case Workspace Navigation Tabs -->
    <div class="workspace-tabs">
      <button
        class="tab-btn"
        class:active={activeTab === 'timeline'}
        on:click={() => (activeTab = 'timeline')}
      >
        Investigation Timeline ({timeline.length})
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === 'evidence'}
        on:click={() => (activeTab = 'evidence')}
      >
        Evidence Board
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === 'hypotheses'}
        on:click={() => (activeTab = 'hypotheses')}
      >
        Hypotheses & Intelligence
      </button>

      <button
        class="tab-btn"
        class:active={activeTab === 'graph'}
        on:click={() => (activeTab = 'graph')}
      >
        Topology Graph
      </button>
    </div>

    <!-- Tab Content -->
    {#if activeTab === 'timeline'}
      <div class="tab-pane">
        <div class="info-grid">
          <div class="card meta-panel">
            <h3>Case Overview</h3>
            <p class="case-full-desc">{caseData.description}</p>
            
            <div class="team-section">
              <h4>Assigned Personnel</h4>
              <div class="person-row">
                <span class="role-tag">Creator</span>
                <span class="person-name">{caseData.createdBy?.name || 'Unknown'}</span>
              </div>
              <div class="person-row">
                <span class="role-tag">Supervisor</span>
                <span class="person-name">{caseData.assignedSupervisor?.name || 'Unassigned'}</span>
              </div>
            </div>
          </div>

          <div class="timeline-panel">
            <h3>Chronological Audit & Lifecycle Trail</h3>
            
            {#if timeline.length === 0}
              <div class="empty-timeline">No timeline events recorded yet.</div>
            {:else}
              <div class="timeline-list">
                {#each timeline as item (item.id)}
                  <div class="timeline-item">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                      <div class="event-header">
                        <span class="event-action font-mono">{item.action}</span>
                        <span class="event-time">{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                      <div class="event-actor">
                        By <strong>{item.actor?.name || 'System'}</strong> ({item.actor?.role || 'system'})
                      </div>
                      {#if item.metadata?.reason}
                        <div class="event-reason">
                          <strong>Documented Reason:</strong> "{item.metadata.reason}"
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {:else if activeTab === 'hypotheses'}
      <HypothesisPanel {caseId} />
    {:else if activeTab === 'graph'}
      <RelationshipGraph {caseId} />
    {/if}
  {/if}

  <!-- Mandatory Reason Modal -->
  {#if showReasonModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showReasonModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showReasonModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Document Required Reason</h3>
          <button class="close-btn" on:click={() => (showReasonModal = false)}>✕</button>
        </div>

        <p class="modal-note">
          Per operating procedure, transition <strong>{selectedActionLabel}</strong> strictly requires a documented rationale written to the immutable audit trail.
        </p>

        {#if transitionError}
          <div class="alert alert-danger" style="margin: 1rem 0;">{transitionError}</div>
        {/if}

        <form on:submit|preventDefault={() => executeTransition(selectedTargetStatus, transitionReason)}>
          <div class="form-group">
            <label for="transReason">Action Rationale / Reopening Justification</label>
            <textarea
              id="transReason"
              bind:value={transitionReason}
              rows="4"
              placeholder="State the findings, additional evidence, or regulatory reason..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="modal-actions" style="margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" on:click={() => (showReasonModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={transitioning || !transitionReason.trim()}>
              {transitioning ? 'Executing...' : 'Confirm & Log Transition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .case-workspace {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    margin-bottom: 0.5rem;
  }

  .crumb-link {
    color: var(--accent-cyan);
    text-decoration: none;
  }

  .crumb-sep {
    color: var(--text-muted);
  }

  .crumb-current {
    color: var(--text-secondary);
  }

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 1rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1.25rem;
  }

  .badges-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .title-block h1 {
    font-size: 1.75rem;
    font-weight: 800;
  }

  .lifecycle-actions {
    display: flex;
    gap: 0.75rem;
  }

  .btn-action {
    background-color: var(--accent-blue);
    color: white;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-action:hover {
    background-color: var(--accent-blue-hover);
  }

  .no-actions-badge {
    font-size: 0.75rem;
    color: var(--text-muted);
    background-color: var(--bg-card);
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .workspace-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .tab-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.6rem 1rem;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--text-primary);
  }

  .tab-btn.active {
    color: var(--accent-cyan);
    border-bottom-color: var(--accent-cyan);
  }

  .info-grid {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 860px) {
    .info-grid {
      grid-template-columns: 1fr;
    }
  }

  .card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .meta-panel h3, .timeline-panel h3 {
    font-size: 1rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .case-full-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 1.5rem;
  }

  .team-section {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
  }

  .team-section h4 {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .person-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
    padding: 0.35rem 0;
  }

  .role-tag {
    color: var(--text-muted);
  }

  .person-name {
    color: var(--text-primary);
    font-weight: 500;
  }

  /* Timeline */
  .timeline-list {
    position: relative;
    padding-left: 1.5rem;
    border-left: 2px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1rem;
  }

  .timeline-item {
    position: relative;
  }

  .timeline-marker {
    position: absolute;
    left: -1.95rem;
    top: 0.25rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--accent-blue);
    border: 2px solid var(--bg-primary);
  }

  .timeline-content {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.875rem 1rem;
  }

  .event-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }

  .event-action {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--accent-cyan);
  }

  .event-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .event-actor {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .event-reason {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: var(--bg-primary);
    border-left: 3px solid var(--accent-blue);
    border-radius: 4px;
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .track-placeholder {
    text-align: center;
    padding: 4rem 2rem;
  }

  .placeholder-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .status-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .priority-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background-color: var(--bg-card);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
  }

  .badge-draft { background: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }
  .badge-active { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
  .badge-review { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-closed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-archived { background: rgba(107, 114, 128, 0.15); color: #9ca3af; border: 1px solid rgba(107, 114, 128, 0.3); }

  .font-mono {
    font-family: var(--font-mono);
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    width: 100%;
    max-width: 500px;
    padding: 1.75rem;
    box-shadow: 0 15px 30px rgba(0,0,0,0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .modal-note {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-bottom: 1rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-input {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    font-family: inherit;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
</style>
