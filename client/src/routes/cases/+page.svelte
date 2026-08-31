<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let cases = [];
  let reviewQueueCases = [];
  let loading = true;
  let errorMsg = null;

  // Filters & Pagination
  let search = '';
  let statusFilter = '';
  let priorityFilter = '';
  let activeTab = 'all'; // 'all' | 'requires_review' | 'my_cases'
  let page = 1;
  let limit = 10;
  let total = 0;
  let totalPages = 1;

  // Create Case Modal state
  let showCreateModal = false;
  let newTitle = '';
  let newDescription = '';
  let newPriority = 'medium';
  let newAssignedSupervisor = '';
  let newAssignedInvestigators = [];
  let eligibleSupervisors = [];
  let eligibleInvestigators = [];
  let creating = false;
  let createError = null;

  async function loadCases() {
    loading = true;
    errorMsg = null;

    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (activeTab === 'requires_review') params.set('requiresReview', 'true');

      const res = await api.get(`/cases?${params.toString()}`);
      if (res && res.success) {
        cases = res.data;
        total = res.pagination.total;
        totalPages = res.pagination.totalPages;
      }

      // If user is supervisor, load review queue count
      if ($auth.user?.role === 'supervisor') {
        const revRes = await api.get('/cases?requiresReview=true&limit=5');
        if (revRes?.success) {
          reviewQueueCases = revRes.data || [];
        }
      }
    } catch (err) {
      if (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED') {
        goto('/login');
      } else {
        errorMsg = err.message || 'Failed to load cases.';
      }
    } finally {
      loading = false;
    }
  }

  async function openCreateModal() {
    createError = null;
    showCreateModal = true;
    try {
      const [supRes, invRes] = await Promise.all([
        api.get('/cases/assignees/supervisors'),
        api.get('/cases/assignees/investigators')
      ]);
      if (supRes?.success) eligibleSupervisors = supRes.data || [];
      if (invRes?.success) eligibleInvestigators = invRes.data || [];
    } catch {
      // Fallback
    }
  }

  async function handleCreateCase() {
    createError = null;
    creating = true;

    try {
      const payload = {
        title: newTitle,
        description: newDescription,
        priority: newPriority,
        assignedSupervisor: newAssignedSupervisor || null,
        assignedInvestigators: newAssignedInvestigators
      };

      const res = await api.post('/cases', payload);

      if (res && res.success) {
        showCreateModal = false;
        newTitle = '';
        newDescription = '';
        newPriority = 'medium';
        newAssignedSupervisor = '';
        newAssignedInvestigators = [];
        page = 1;
        await loadCases();
      }
    } catch (err) {
      createError = err.message || 'Failed to create case.';
    } finally {
      creating = false;
    }
  }

  function handleFilterChange() {
    page = 1;
    loadCases();
  }

  function setTab(tab) {
    activeTab = tab;
    page = 1;
    loadCases();
  }

  function getStatusClass(status) {
    switch (status) {
      case 'draft': return 'badge-draft';
      case 'active': return 'badge-active';
      case 'under_review': return 'badge-review';
      case 'closed': return 'badge-closed';
      case 'archived': return 'badge-archived';
      default: return '';
    }
  }

  function getPriorityClass(priority) {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  }

  onMount(() => {
    loadCases();
  });
</script>

<div class="cases-page">
  <div class="page-header">
    <div>
      <div class="badge-subtitle font-mono">CASE MANAGEMENT & ASSIGNMENT</div>
      <h1>Active & Historical Investigations</h1>
      <p class="subtitle">Digital evidence workspaces gated by multi-tenant assignment authorization.</p>
    </div>

    <button class="btn btn-primary" on:click={openCreateModal}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Investigation Case
    </button>
  </div>

  <!-- Supervisor Review Queue Callout -->
  {#if $auth.user?.role === 'supervisor' && reviewQueueCases.length > 0}
    <div class="review-queue-banner">
      <div class="review-queue-header">
        <div class="review-badge font-mono">SUPERVISORY ACTION REQUIRED</div>
        <h3>REQUIRES MY REVIEW ({reviewQueueCases.length})</h3>
        <p>The following case files have been submitted for supervisory verification and approval:</p>
      </div>
      <div class="review-queue-items">
        {#each reviewQueueCases as rc}
          <a href="/cases/{rc._id || rc.id}" class="review-item-card">
            <div class="review-item-main">
              <span class="status-badge badge-review font-mono">UNDER REVIEW</span>
              <span class="review-item-title">{rc.title}</span>
            </div>
            <div class="review-item-meta font-mono">
              Lead: {rc.createdBy?.name || 'Unknown'} • Priority: {rc.priority?.toUpperCase()}
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Tab Selector & Filters Bar -->
  <div class="filters-container">
    <div class="nav-tabs">
      <button class="tab-btn" class:active={activeTab === 'all'} on:click={() => setTab('all')}>
        All Authorized Cases
      </button>
      {#if $auth.user?.role === 'supervisor'}
        <button class="tab-btn tab-review-btn" class:active={activeTab === 'requires_review'} on:click={() => setTab('requires_review')}>
          Requires My Review
          {#if reviewQueueCases.length > 0}
            <span class="counter-chip">{reviewQueueCases.length}</span>
          {/if}
        </button>
      {/if}
    </div>

    <div class="filters-bar">
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          bind:value={search}
          placeholder="Search case title or description..."
          on:input={handleFilterChange}
          class="search-input"
        />
      </div>

      <div class="select-group">
        <select bind:value={statusFilter} on:change={handleFilterChange} class="filter-select">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="under_review">Under Review</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>

        <select bind:value={priorityFilter} on:change={handleFilterChange} class="filter-select">
          <option value="">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p class="font-mono">Loading authorized investigation files...</p>
    </div>
  {:else if cases.length === 0}
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <h3>No cases found</h3>
      <p class="text-muted">
        {search || statusFilter || priorityFilter || activeTab === 'requires_review'
          ? 'No cases match the selected filter criteria or assignment scope.'
          : 'No investigation cases exist yet in the database.'}
      </p>
    </div>
  {:else}
    <div class="cases-grid">
      {#each cases as c (c._id || c.id)}
        <a href={`/cases/${c._id || c.id}`} class="case-card">
          <div class="case-card-header">
            <span class={`status-badge ${getStatusClass(c.status)}`}>
              {c.status.replace('_', ' ').toUpperCase()}
            </span>
            <span class={`priority-badge ${getPriorityClass(c.priority)}`}>
              {c.priority.toUpperCase()} PRIORITY
            </span>
          </div>

          <h3 class="case-title">{c.title}</h3>
          <p class="case-desc">{c.description}</p>

          <!-- Assignment Metadata Display -->
          <div class="assignment-meta">
            {#if c.assignedSupervisor}
              <div class="assignment-chip">
                <span class="chip-label">Supervisor:</span>
                <span class="chip-val">{c.assignedSupervisor.name}</span>
              </div>
            {/if}
            {#if c.assignedInvestigators && c.assignedInvestigators.length > 0}
              <div class="assignment-chip">
                <span class="chip-label">Investigators:</span>
                <span class="chip-val">{c.assignedInvestigators.length} assigned</span>
              </div>
            {/if}
          </div>

          <div class="case-footer">
            <div class="meta-item">
              <span class="meta-label">Lead:</span>
              <span class="meta-val">{c.createdBy?.name || 'Unknown'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Updated:</span>
              <span class="meta-val">{new Date(c.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>
        </a>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="pagination-bar">
        <button
          class="btn btn-secondary btn-sm"
          disabled={page <= 1}
          on:click={() => { page--; loadCases(); }}
        >
          Previous
        </button>
        <span class="page-info font-mono">Page {page} of {totalPages} ({total} cases)</span>
        <button
          class="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          on:click={() => { page++; loadCases(); }}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}

  <!-- Create Case Modal with Dynamic Assignee Selectors -->
  {#if showCreateModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showCreateModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <div class="eyebrow font-mono">NEW INVESTIGATION WORKSPACE</div>
            <h3>Initialize Forensic Case</h3>
          </div>
          <button class="close-btn" on:click={() => (showCreateModal = false)}>✕</button>
        </div>

        {#if createError}
          <div class="alert alert-danger" style="margin: 1rem 0;">{createError}</div>
        {/if}

        <form on:submit|preventDefault={handleCreateCase} class="modal-form">
          <div class="form-group">
            <label for="caseTitle">Case Title <span class="req">*</span></label>
            <input
              id="caseTitle"
              type="text"
              bind:value={newTitle}
              placeholder="e.g. Infrastructure Intrusion & Data Exfiltration Audit"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="caseDesc">Case Summary & Objectives <span class="req">*</span></label>
            <textarea
              id="caseDesc"
              bind:value={newDescription}
              rows="3"
              placeholder="Describe the context, primary targets, and initial findings..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label for="casePriority">Priority Level</label>
              <select id="casePriority" bind:value={newPriority} class="form-input">
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Priority</option>
              </select>
            </div>

            <!-- Assigned Supervisor Dropdown -->
            <div class="form-group flex-1">
              <label for="assignedSupervisor">Assigned Supervisor</label>
              <select id="assignedSupervisor" bind:value={newAssignedSupervisor} class="form-input">
                <option value="">Select an Investigation Supervisor...</option>
                {#each eligibleSupervisors as sup}
                  <option value={sup.id || sup._id}>
                    {sup.name} ({sup.organization || 'Supervisor'})
                  </option>
                {/each}
              </select>
            </div>
          </div>

          <!-- Assigned Investigators Selector -->
          {#if eligibleInvestigators.length > 0}
            <div class="form-group">
              <label for="inv-select">Assign Co-Investigators</label>
              <div class="checkbox-grid">
                {#each eligibleInvestigators as inv}
                  {#if inv.id !== $auth.user?.id && inv._id !== $auth.user?.id}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        value={inv.id || inv._id}
                        on:change={(e) => {
                          const id = inv.id || inv._id;
                          if (e.target.checked) {
                            newAssignedInvestigators = [...newAssignedInvestigators, id];
                          } else {
                            newAssignedInvestigators = newAssignedInvestigators.filter((i) => i !== id);
                          }
                        }}
                      />
                      <span>{inv.name} <small class="font-mono">({inv.email})</small></span>
                    </label>
                  {/if}
                {/each}
              </div>
            </div>
          {/if}

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              on:click={() => (showCreateModal = false)}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Initialize Case File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .cases-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .badge-subtitle {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  /* Review Queue Callout */
  .review-queue-banner {
    background-color: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.35);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .review-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--color-warning);
    margin-bottom: 0.25rem;
  }

  .review-queue-header h3 {
    font-size: 1.125rem;
    font-weight: 800;
    color: var(--color-warning);
  }

  .review-queue-header p {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.15rem;
  }

  .review-queue-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .review-item-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    text-decoration: none;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    transition: border-color 0.15s ease;
  }

  .review-item-card:hover {
    border-color: var(--color-warning);
  }

  .review-item-main {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .review-item-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .review-item-meta {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  /* Filters */
  .filters-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .nav-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .tab-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    transition: all 0.15s ease;
  }

  .tab-btn:hover {
    color: var(--text-primary);
    background-color: var(--bg-card);
  }

  .tab-btn.active {
    color: var(--accent-cyan);
    background-color: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.3);
  }

  .counter-chip {
    background-color: var(--color-warning);
    color: #000;
    font-size: 0.625rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 10px;
  }

  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    border-radius: 8px;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 240px;
  }

  .search-icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }

  .search-input {
    width: 100%;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
  }

  .search-input:focus { border-color: var(--accent-cyan); }

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

  .cases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  .case-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .case-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent-cyan);
  }

  .case-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .case-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .case-desc {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
    margin-bottom: 1rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .assignment-meta {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.75rem;
  }

  .assignment-chip {
    font-size: 0.6875rem;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    display: flex;
    gap: 0.25rem;
  }

  .chip-label { color: var(--text-muted); }
  .chip-val { color: var(--accent-cyan); font-weight: 600; }

  .case-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
    font-size: 0.75rem;
  }

  .meta-item { display: flex; gap: 0.3rem; }
  .meta-label { color: var(--text-muted); }
  .meta-val { color: var(--text-primary); font-weight: 500; }

  .pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .page-info { font-size: 0.8125rem; color: var(--text-muted); }

  .loading-state, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background-color: var(--bg-card);
    border: 1px dashed var(--border-color);
    border-radius: 10px;
  }

  .empty-icon { color: var(--text-muted); margin-bottom: 1rem; }

  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    padding: 1.75rem;
    box-shadow: 0 20px 40px rgba(0,0,0,0.7);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
  }

  .eyebrow {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    margin-bottom: 0.2rem;
  }

  .modal-header h3 { font-size: 1.25rem; font-weight: 700; }

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

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .flex-1 { flex: 1; }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .req { color: var(--color-danger); }

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

  .form-input:focus { border-color: var(--accent-cyan); }

  .checkbox-grid {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    max-height: 120px;
    overflow-y: auto;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border-color);
  }

  .priority-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .priority-critical { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
  .priority-high { background: rgba(249, 115, 22, 0.2); color: #fb923c; border: 1px solid #f97316; }
  .priority-medium { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid #eab308; }
  .priority-low { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid #3b82f6; }
</style>
