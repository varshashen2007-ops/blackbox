<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';

  export let caseId;

  let hypotheses = [];
  let availableEvidence = [];
  let loading = true;
  let errorMsg = null;

  // Propose Modal
  let showProposeModal = false;
  let newTitle = '';
  let newDescription = '';
  let newStatus = 'proposed';
  let proposing = false;
  let proposeError = null;

  // Link Evidence Modal
  let showLinkModal = false;
  let targetHypothesis = null;
  let selectedEvidenceId = '';
  let selectedStance = 'supports';
  let linking = false;
  let linkError = null;

  async function loadData() {
    loading = true;
    errorMsg = null;

    try {
      const [hypRes, evRes] = await Promise.all([
        api.get(`/cases/${caseId}/hypotheses`),
        api.get(`/cases/${caseId}/evidence?limit=100`)
      ]);

      if (hypRes && hypRes.success) {
        hypotheses = hypRes.data;
      }
      if (evRes && evRes.success) {
        availableEvidence = evRes.data;
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to load hypotheses.';
    } finally {
      loading = false;
    }
  }

  async function handlePropose() {
    proposing = true;
    proposeError = null;

    try {
      const res = await api.post(`/cases/${caseId}/hypotheses`, {
        title: newTitle,
        description: newDescription,
        status: newStatus
      });

      if (res && res.success) {
        showProposeModal = false;
        newTitle = '';
        newDescription = '';
        newStatus = 'proposed';
        await loadData();
      }
    } catch (err) {
      proposeError = err.message || 'Failed to propose hypothesis.';
    } finally {
      proposing = false;
    }
  }

  function openLinkModal(hyp) {
    targetHypothesis = hyp;
    selectedEvidenceId = availableEvidence.length > 0 ? (availableEvidence[0].id || availableEvidence[0]._id) : '';
    selectedStance = 'supports';
    linkError = null;
    showLinkModal = true;
  }

  async function handleLinkEvidence() {
    if (!targetHypothesis || !selectedEvidenceId) return;
    linking = true;
    linkError = null;

    try {
      const res = await api.post(
        `/cases/${caseId}/hypotheses/${targetHypothesis.id || targetHypothesis._id}/link-evidence`,
        {
          evidenceId: selectedEvidenceId,
          stance: selectedStance
        }
      );

      if (res && res.success) {
        showLinkModal = false;
        await loadData();
      }
    } catch (err) {
      linkError = err.message || 'Failed to link evidence.';
    } finally {
      linking = false;
    }
  }

  async function handleUnlink(hyp, evidenceId) {
    try {
      const res = await api.delete(
        `/cases/${caseId}/hypotheses/${hyp.id || hyp._id}/unlink-evidence/${evidenceId}`
      );
      if (res && res.success) {
        await loadData();
      }
    } catch (err) {
      alert(err.message || 'Failed to unlink evidence.');
    }
  }

  async function handleStatusChange(hyp, newStatus) {
    try {
      const res = await api.patch(
        `/cases/${caseId}/hypotheses/${hyp.id || hyp._id}`,
        { status: newStatus }
      );
      if (res && res.success) {
        hyp.status = newStatus;
      }
    } catch (err) {
      alert(err.message || 'Failed to update hypothesis status.');
    }
  }

  function getScoreColor(score) {
    if (score >= 65) return 'var(--color-success)';
    if (score <= 35) return 'var(--color-danger)';
    return 'var(--color-warning)';
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="hypothesis-panel">
  <div class="panel-header">
    <div>
      <h2>Hypothesis Intelligence Engine ({hypotheses.length})</h2>
      <p class="text-muted">
        Competing theories evaluated dynamically by verified evidence stance and corroboration networks.
      </p>
    </div>

    <button class="btn btn-primary" on:click={() => (showProposeModal = true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Propose Hypothesis
    </button>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Computing deterministic confidence models...</p>
    </div>
  {:else if hypotheses.length === 0}
    <div class="empty-state">
      <p class="empty-title">No hypotheses proposed yet</p>
      <p class="text-muted">Propose competing hypotheses to begin reasoning and evaluating evidence stances.</p>
    </div>
  {:else}
    <div class="hypotheses-list">
      {#each hypotheses as hyp (hyp.id || hyp._id)}
        <div class="hypothesis-card">
          <div class="card-main">
            <div class="score-dial-section">
              <div class="score-circle" style="border-color: {getScoreColor(hyp.confidenceScore)}">
                <span class="score-val font-mono">{hyp.confidenceScore}%</span>
                <span class="score-label">CONFIDENCE</span>
              </div>
            </div>

            <div class="hyp-content">
              <div class="hyp-top-row">
                <div class="status-selector-group">
                  <span class="status-label">Investigator Judgment:</span>
                  <select
                    value={hyp.status}
                    on:change={(e) => handleStatusChange(hyp, e.target.value)}
                    class="judgment-select"
                  >
                    <option value="proposed">Proposed</option>
                    <option value="under_investigation">Under Investigation</option>
                    <option value="supported">Supported by Evidence</option>
                    <option value="refuted">Refuted</option>
                    <option value="inconclusive">Inconclusive</option>
                  </select>
                </div>

                <button class="btn btn-secondary btn-sm" on:click={() => openLinkModal(hyp)}>
                  + Link Evidence
                </button>
              </div>

              <h3 class="hyp-title">{hyp.title}</h3>
              <p class="hyp-desc">{hyp.description}</p>

              <!-- Conflict Alert Banner -->
              {#if hyp.conflicts && hyp.conflicts.length > 0}
                <div class="conflict-banner">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div>
                    <strong>Conflicting Evidence Detected:</strong> Evidence items supporting this hypothesis have contradictory relationships recorded in the case graph.
                  </div>
                </div>
              {/if}

              <!-- Breakdown of linked evidence -->
              <div class="breakdown-section">
                <h4>Linked Evidence Contributions ({hyp.breakdown?.length || 0})</h4>

                {#if !hyp.breakdown || hyp.breakdown.length === 0}
                  <p class="text-muted" style="font-size: 0.8125rem;">
                    No evidence linked yet. Score is resting at 50.0% neutral baseline.
                  </p>
                {:else}
                  <div class="breakdown-items">
                    {#each hyp.breakdown as b}
                      <div class="breakdown-item" class:item-uncounted={!b.counted}>
                        <div class="item-left">
                          <span class={`stance-tag ${b.stance === 'supports' ? 'tag-supports' : 'tag-contradicts'}`}>
                            {b.stance.toUpperCase()}
                          </span>
                          <span class="evidence-name">{b.title}</span>
                          {#if !b.counted}
                            <span class="uncounted-pill">NOT COUNTED ({b.verificationStatus.toUpperCase()})</span>
                          {/if}
                        </div>

                        <div class="item-right">
                          {#if b.counted}
                            {#if b.corroborationBoost > 0}
                              <span class="boost-tag font-mono">+{Math.round(b.corroborationBoost * 100)}% Boost</span>
                            {/if}
                            <span class={`contrib-val font-mono ${b.effectiveContribution > 0 ? 'pos' : 'neg'}`}>
                              {b.effectiveContribution > 0 ? '+' : ''}{b.effectiveContribution}
                            </span>
                          {:else}
                            <span class="zero-contrib font-mono">0.00</span>
                          {/if}
                          <button
                            class="unlink-btn"
                            title="Unlink evidence"
                            on:click={() => handleUnlink(hyp, b.evidenceId)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Propose Hypothesis Modal -->
  {#if showProposeModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showProposeModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showProposeModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Propose Hypothesis</h3>
          <button class="close-btn" on:click={() => (showProposeModal = false)}>✕</button>
        </div>

        {#if proposeError}
          <div class="alert alert-danger" style="margin: 0.75rem 0;">{proposeError}</div>
        {/if}

        <form on:submit|preventDefault={handlePropose} class="modal-form">
          <div class="form-group">
            <label for="hypTitle">Hypothesis Statement</label>
            <input
              id="hypTitle"
              type="text"
              bind:value={newTitle}
              placeholder="e.g. Threat Actor Leveraged Compromised VPN Credentials"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="hypDesc">Theory Details & Logic</label>
            <textarea
              id="hypDesc"
              bind:value={newDescription}
              rows="4"
              placeholder="Explain the investigative theory, entry vectors, and expected evidence indicators..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="hypStatus">Initial Status Judgment</label>
            <select id="hypStatus" bind:value={newStatus} class="form-input">
              <option value="proposed">Proposed</option>
              <option value="under_investigation">Under Investigation</option>
            </select>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" on:click={() => (showProposeModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={proposing}>
              {proposing ? 'Proposing...' : 'Submit Hypothesis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Link Evidence Modal -->
  {#if showLinkModal && targetHypothesis}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showLinkModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showLinkModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <h3>Link Evidence to Hypothesis</h3>
            <p class="text-muted" style="font-size: 0.8125rem;">{targetHypothesis.title}</p>
          </div>
          <button class="close-btn" on:click={() => (showLinkModal = false)}>✕</button>
        </div>

        {#if linkError}
          <div class="alert alert-danger" style="margin: 0.75rem 0;">{linkError}</div>
        {/if}

        {#if availableEvidence.length === 0}
          <p class="text-muted" style="margin: 1.5rem 0;">
            No evidence items logged in this case yet. Add evidence first from the Evidence Board.
          </p>
        {:else}
          <form on:submit|preventDefault={handleLinkEvidence} class="modal-form">
            <div class="form-group">
              <label for="linkEvSelect">Select Evidence Item</label>
              <select id="linkEvSelect" bind:value={selectedEvidenceId} class="form-input">
                {#each availableEvidence as ev}
                  <option value={ev.id || ev._id}>
                    [{ev.type.toUpperCase()}] {ev.title} ({ev.verificationStatus})
                  </option>
                {/each}
              </select>
            </div>

            <div class="form-group">
              <label for="linkStance">Evidence Stance toward Hypothesis</label>
              <select id="linkStance" bind:value={selectedStance} class="form-input">
                <option value="supports">Supports (+Weight towards confidence)</option>
                <option value="contradicts">Contradicts (-Weight against confidence)</option>
              </select>
            </div>

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" on:click={() => (showLinkModal = false)}>
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" disabled={linking}>
                {linking ? 'Linking...' : 'Connect & Update Score'}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .hypothesis-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .panel-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .hypotheses-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .hypothesis-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .card-main {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 1.75rem;
  }

  @media (max-width: 768px) {
    .card-main {
      grid-template-columns: 1fr;
    }
  }

  .score-dial-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
  }

  .score-circle {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid var(--accent-cyan);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-primary);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.4);
    transition: border-color 0.3s ease;
  }

  .score-val {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .score-label {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
  }

  .hyp-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .hyp-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .status-selector-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-label {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .judgment-select {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--accent-cyan);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    font-weight: 600;
    outline: none;
  }

  .hyp-title {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .hyp-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .conflict-banner {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid var(--color-danger);
    border-radius: 6px;
    padding: 0.75rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
    color: #f87171;
  }

  .breakdown-section {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
    margin-top: 0.5rem;
  }

  .breakdown-section h4 {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .breakdown-items {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .breakdown-item {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
  }

  .item-uncounted {
    opacity: 0.6;
    border-style: dashed;
  }

  .item-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .stance-tag {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .tag-supports {
    background-color: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid #3b82f6;
  }

  .tag-contradicts {
    background-color: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid #ef4444;
  }

  .uncounted-pill {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--text-muted);
    background-color: var(--bg-elevated);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
  }

  .item-right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .boost-tag {
    font-size: 0.6875rem;
    color: var(--color-success);
    background-color: rgba(16, 185, 129, 0.15);
    padding: 0.1rem 0.4rem;
    border-radius: 4px;
    font-weight: 700;
  }

  .contrib-val {
    font-weight: 700;
  }

  .contrib-val.pos {
    color: var(--color-success);
  }

  .contrib-val.neg {
    color: var(--color-danger);
  }

  .zero-contrib {
    color: var(--text-muted);
  }

  .unlink-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0 0.2rem;
  }

  .unlink-btn:hover {
    color: var(--color-danger);
  }

  .font-mono {
    font-family: var(--font-mono);
  }

  /* Modal */
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
    max-width: 520px;
    padding: 1.75rem;
    box-shadow: 0 15px 30px rgba(0,0,0,0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
  }

  .modal-header h3 {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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
    margin-top: 0.5rem;
  }

  .loading-state, .empty-state {
    text-align: center;
    padding: 3rem;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 0.75rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
