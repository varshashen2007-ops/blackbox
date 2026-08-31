<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';

  export let caseId;

  let evidenceList = [];
  let loading = true;
  let errorMsg = null;

  // Filters
  let typeFilter = '';
  let statusFilter = '';
  let search = '';

  // Add Evidence Modal
  let showAddModal = false;
  let title = '';
  let description = '';
  let type = 'document';
  let source = '';
  let tags = '';
  let initialCustodyNote = '';
  let fileInput = null;
  let submitting = false;
  let formError = null;

  // Rejection Modal
  let showRejectModal = false;
  let targetEvidence = null;
  let rejectionReason = '';
  let rejecting = false;
  let rejectError = null;

  // Custody Drawer / Modal
  let selectedEvidence = null;
  let showCustodyModal = false;
  let newCustodyAction = '';
  let newCustodyNote = '';
  let addingCustody = false;
  let custodyError = null;

  async function loadEvidence() {
    loading = true;
    errorMsg = null;

    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (statusFilter) params.set('verificationStatus', statusFilter);
      if (search) params.set('search', search);

      const res = await api.get(`/cases/${caseId}/evidence?${params.toString()}`);
      if (res && res.success) {
        evidenceList = res.data;
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to load evidence items.';
    } finally {
      loading = false;
    }
  }

  async function handleAddEvidence() {
    submitting = true;
    formError = null;

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('type', type);
      formData.append('source', source);
      if (tags) formData.append('tags', tags);
      if (initialCustodyNote) formData.append('initialCustodyNote', initialCustodyNote);

      if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('file', fileInput.files[0]);
      }

      const res = await api.post(`/cases/${caseId}/evidence`, formData);
      if (res && res.success) {
        showAddModal = false;
        title = '';
        description = '';
        type = 'document';
        source = '';
        tags = '';
        initialCustodyNote = '';
        await loadEvidence();
      }
    } catch (err) {
      formError = err.message || 'Failed to add evidence.';
    } finally {
      submitting = false;
    }
  }

  async function requestVerification(ev) {
    try {
      const res = await api.post(`/cases/${caseId}/evidence/${ev.id || ev._id}/request-verification`, {});
      if (res && res.success) {
        await loadEvidence();
      }
    } catch (err) {
      alert(err.message || 'Failed to request verification.');
    }
  }

  async function verifyEvidence(ev) {
    try {
      const res = await api.post(`/cases/${caseId}/evidence/${ev.id || ev._id}/verify`, {});
      if (res && res.success) {
        await loadEvidence();
      }
    } catch (err) {
      alert(err.message || 'Failed to verify evidence.');
    }
  }

  function openRejectModal(ev) {
    targetEvidence = ev;
    rejectionReason = '';
    rejectError = null;
    showRejectModal = true;
  }

  async function handleRejectSubmit() {
    if (!targetEvidence) return;
    rejecting = true;
    rejectError = null;

    try {
      const res = await api.post(`/cases/${caseId}/evidence/${targetEvidence.id || targetEvidence._id}/reject`, {
        rejectionReason
      });

      if (res && res.success) {
        showRejectModal = false;
        await loadEvidence();
      }
    } catch (err) {
      rejectError = err.message || 'Failed to reject evidence.';
    } finally {
      rejecting = false;
    }
  }

  function openCustodyModal(ev) {
    selectedEvidence = ev;
    newCustodyAction = '';
    newCustodyNote = '';
    custodyError = null;
    showCustodyModal = true;
  }

  async function handleAppendCustody() {
    if (!selectedEvidence) return;
    addingCustody = true;
    custodyError = null;

    try {
      const res = await api.post(
        `/cases/${caseId}/evidence/${selectedEvidence.id || selectedEvidence._id}/custody`,
        {
          action: newCustodyAction,
          note: newCustodyNote
        }
      );

      if (res && res.success) {
        selectedEvidence = res.data;
        await loadEvidence();
        newCustodyAction = '';
        newCustodyNote = '';
      }
    } catch (err) {
      custodyError = err.message || 'Failed to append custody record.';
    } finally {
      addingCustody = false;
    }
  }

  function getTypeIcon(t) {
    switch (t) {
      case 'document': return '📄';
      case 'image': return '🖼️';
      case 'digital_log': return '💻';
      case 'testimony': return '🎙️';
      case 'physical': return '📦';
      default: return '📎';
    }
  }

  function getStatusClass(st) {
    switch (st) {
      case 'unverified': return 'status-unverified';
      case 'pending': return 'status-pending';
      case 'verified': return 'status-verified';
      case 'rejected': return 'status-rejected';
      default: return '';
    }
  }

  onMount(() => {
    loadEvidence();
  });
</script>

<div class="evidence-board">
  <div class="board-header">
    <div class="header-left">
      <h2>Evidence Repository ({evidenceList.length})</h2>
      <p class="text-muted">Digital artifacts, forensic captures, testimonies, and physical assets</p>
    </div>

    <button class="btn btn-primary" on:click={() => (showAddModal = true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Log New Evidence
    </button>
  </div>

  <div class="filters-bar">
    <input
      type="text"
      bind:value={search}
      placeholder="Search evidence title, description, or source..."
      on:input={loadEvidence}
      class="search-input"
    />

    <div class="select-group">
      <select bind:value={typeFilter} on:change={loadEvidence} class="filter-select">
        <option value="">All Types</option>
        <option value="document">Document</option>
        <option value="digital_log">Digital Log</option>
        <option value="image">Image</option>
        <option value="testimony">Testimony</option>
        <option value="physical">Physical</option>
        <option value="other">Other</option>
      </select>

      <select bind:value={statusFilter} on:change={loadEvidence} class="filter-select">
        <option value="">All Verification States</option>
        <option value="unverified">Unverified</option>
        <option value="pending">Pending Review</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading case evidence repository...</p>
    </div>
  {:else if evidenceList.length === 0}
    <div class="empty-state">
      <p class="empty-title">No evidence items recorded</p>
      <p class="text-muted">
        {search || typeFilter || statusFilter
          ? 'No evidence matches your filters.'
          : 'No evidence has been attached to this investigation yet.'}
      </p>
    </div>
  {:else}
    <div class="evidence-grid">
      {#each evidenceList as ev (ev.id || ev._id)}
        <div class="evidence-card" class:card-verified={ev.verificationStatus === 'verified'} class:card-rejected={ev.verificationStatus === 'rejected'}>
          <div class="card-top">
            <div class="type-pill">
              <span>{getTypeIcon(ev.type)}</span>
              <span>{ev.type.replace('_', ' ').toUpperCase()}</span>
            </div>

            <span class={`verification-badge ${getStatusClass(ev.verificationStatus)}`}>
              {ev.verificationStatus.toUpperCase()}
            </span>
          </div>

          <h3 class="evidence-title">{ev.title}</h3>
          <p class="evidence-desc">{ev.description}</p>

          <div class="source-row">
            <span class="meta-label">Source:</span>
            <span class="meta-val font-mono">{ev.source}</span>
          </div>

          {#if ev.tags && ev.tags.length > 0}
            <div class="tags-row">
              {#each ev.tags as tag}
                <span class="tag-chip">#{tag}</span>
              {/each}
            </div>
          {/if}

          {#if ev.rejectionReason}
            <div class="rejection-note">
              <strong>Rejection Reason:</strong> {ev.rejectionReason}
            </div>
          {/if}

          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" on:click={() => openCustodyModal(ev)}>
              Custody ({ev.chainOfCustody?.length || 0})
            </button>

            <!-- Verification Flow Actions -->
            {#if ev.verificationStatus === 'unverified'}
              <button class="btn btn-secondary btn-sm" on:click={() => requestVerification(ev)}>
                Request Review
              </button>
            {/if}

            {#if $auth.user?.role === 'supervisor' && ev.verificationStatus !== 'verified'}
              <button class="btn btn-success btn-sm" on:click={() => verifyEvidence(ev)}>
                Verify
              </button>
              {#if ev.verificationStatus !== 'rejected'}
                <button class="btn btn-danger btn-sm" on:click={() => openRejectModal(ev)}>
                  Reject
                </button>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Add Evidence Modal -->
  {#if showAddModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showAddModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showAddModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Log Evidence Item</h3>
          <button class="close-btn" on:click={() => (showAddModal = false)}>✕</button>
        </div>

        {#if formError}
          <div class="alert alert-danger" style="margin: 0.75rem 0;">{formError}</div>
        {/if}

        <form on:submit|preventDefault={handleAddEvidence} class="modal-form">
          <div class="form-group">
            <label for="evTitle">Evidence Title</label>
            <input
              id="evTitle"
              type="text"
              bind:value={title}
              placeholder="e.g. Host Memory Dump - Node 4"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="evDesc">Detailed Description</label>
            <textarea
              id="evDesc"
              bind:value={description}
              rows="3"
              placeholder="Provide context, integrity status, and extraction details..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="evType">Asset Type</label>
              <select id="evType" bind:value={type} class="form-input">
                <option value="document">Document</option>
                <option value="digital_log">Digital Log</option>
                <option value="image">Image / Screenshot</option>
                <option value="testimony">Testimony</option>
                <option value="physical">Physical Asset</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div class="form-group">
              <label for="evSource">Source / Origin</label>
              <input
                id="evSource"
                type="text"
                bind:value={source}
                placeholder="e.g., Firewall Core 10.0.0.1"
                required
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="evTags">Tags (comma-separated)</label>
            <input
              id="evTags"
              type="text"
              bind:value={tags}
              placeholder="pcap, firewall, unauthorized-ssh"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="evCustody">Initial Chain of Custody Note</label>
            <input
              id="evCustody"
              type="text"
              bind:value={initialCustodyNote}
              placeholder="e.g., Extracted live on-site and stored in encrypted container"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="evFile">Attachment (Optional File Upload)</label>
            <input
              id="evFile"
              type="file"
              bind:this={fileInput}
              class="form-input-file"
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" on:click={() => (showAddModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Add to Evidence Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Supervisor Rejection Modal -->
  {#if showRejectModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showRejectModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showRejectModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Reject Evidence Item</h3>
          <button class="close-btn" on:click={() => (showRejectModal = false)}>✕</button>
        </div>

        <p class="modal-note">
          Supervisors must document the rationale for rejecting evidence. This reason will be logged in the immutable audit trail.
        </p>

        {#if rejectError}
          <div class="alert alert-danger" style="margin: 0.75rem 0;">{rejectError}</div>
        {/if}

        <form on:submit|preventDefault={handleRejectSubmit}>
          <div class="form-group">
            <label for="rejReason">Documented Rejection Reason</label>
            <textarea
              id="rejReason"
              bind:value={rejectionReason}
              rows="4"
              placeholder="Explain why this evidence fails authenticity or integrity checks..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="modal-actions" style="margin-top: 1rem;">
            <button type="button" class="btn btn-secondary" on:click={() => (showRejectModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-danger" disabled={rejecting || !rejectionReason.trim()}>
              {rejecting ? 'Rejecting...' : 'Reject Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Chain of Custody Drawer / Modal -->
  {#if showCustodyModal && selectedEvidence}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showCustodyModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showCustodyModal = false)}
    >
      <div class="modal-card custody-modal-card">
        <div class="modal-header">
          <div>
            <h3>Chain of Custody</h3>
            <p class="text-muted" style="font-size: 0.8125rem;">{selectedEvidence.title}</p>
          </div>
          <button class="close-btn" on:click={() => (showCustodyModal = false)}>✕</button>
        </div>

        <div class="custody-timeline">
          {#each selectedEvidence.chainOfCustody || [] as entry}
            <div class="custody-entry">
              <div class="custody-marker"></div>
              <div class="custody-box">
                <div class="custody-top">
                  <span class="custody-action font-mono">{entry.action}</span>
                  <span class="custody-time">{new Date(entry.timestamp).toLocaleString()}</span>
                </div>
                <div class="custody-actor">
                  Actor: <strong>{entry.actorId?.name || 'Authorized Personnel'}</strong>
                </div>
                {#if entry.note}
                  <div class="custody-note">"{entry.note}"</div>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <!-- Add Custody Transfer Action -->
        <div class="add-custody-section">
          <h4>Record Custody Handoff / Transfer</h4>
          {#if custodyError}
            <div class="alert alert-danger" style="margin-bottom: 0.5rem;">{custodyError}</div>
          {/if}
          <div class="custody-form">
            <input
              type="text"
              bind:value={newCustodyAction}
              placeholder="Action (e.g. TRANSFERRED_TO_LAB, IMAGE_ANALYSIS)"
              class="form-input"
            />
            <input
              type="text"
              bind:value={newCustodyNote}
              placeholder="Notes or recipient information..."
              class="form-input"
            />
            <button
              type="button"
              class="btn btn-secondary"
              on:click={handleAppendCustody}
              disabled={addingCustody || !newCustodyAction.trim()}
            >
              {addingCustody ? 'Saving...' : 'Record Handoff'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .evidence-board {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .board-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    border-radius: 8px;
  }

  .search-input {
    flex: 1;
    min-width: 240px;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
  }

  .select-group {
    display: flex;
    gap: 0.75rem;
  }

  .filter-select {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
  }

  .evidence-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .evidence-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .card-verified {
    border-color: rgba(16, 185, 129, 0.4);
  }

  .card-rejected {
    border-color: rgba(239, 68, 68, 0.4);
    opacity: 0.85;
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .type-pill {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
    background-color: var(--bg-card);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .verification-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .status-unverified { background: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }
  .status-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .status-verified { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .status-rejected { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }

  .evidence-title {
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .evidence-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
  }

  .source-row {
    font-size: 0.75rem;
    display: flex;
    gap: 0.4rem;
  }

  .tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .tag-chip {
    font-size: 0.6875rem;
    color: var(--accent-cyan);
    background-color: rgba(6, 182, 212, 0.1);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .rejection-note {
    background-color: rgba(239, 68, 68, 0.1);
    border-left: 3px solid var(--color-danger);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    color: var(--color-danger);
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
    margin-top: auto;
  }

  :global(.btn-success) {
    background-color: var(--color-success);
    color: white;
  }

  :global(.btn-danger) {
    background-color: var(--color-danger);
    color: white;
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
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.75rem;
    box-shadow: 0 15px 30px rgba(0,0,0,0.5);
  }

  .custody-modal-card {
    max-width: 620px;
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

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
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

  .form-input-file {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  /* Custody Timeline */
  .custody-timeline {
    position: relative;
    padding-left: 1.5rem;
    border-left: 2px solid var(--border-color);
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 1.25rem 0;
  }

  .custody-entry {
    position: relative;
  }

  .custody-marker {
    position: absolute;
    left: -1.95rem;
    top: 0.25rem;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--accent-cyan);
    border: 2px solid var(--bg-primary);
  }

  .custody-box {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
  }

  .custody-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .custody-action {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--accent-cyan);
  }

  .custody-time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .custody-actor {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .custody-note {
    font-size: 0.8125rem;
    color: var(--text-primary);
    margin-top: 0.35rem;
    background-color: var(--bg-primary);
    padding: 0.4rem;
    border-radius: 4px;
  }

  .add-custody-section {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
    margin-top: 1rem;
  }

  .add-custody-section h4 {
    font-size: 0.875rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .custody-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
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
