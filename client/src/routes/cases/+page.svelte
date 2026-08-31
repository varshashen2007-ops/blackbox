<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let cases = [];
  let loading = true;
  let errorMsg = null;

  // Filters & Pagination
  let search = '';
  let statusFilter = '';
  let priorityFilter = '';
  let page = 1;
  let limit = 10;
  let total = 0;
  let totalPages = 1;

  // Create Case Modal state
  let showCreateModal = false;
  let newTitle = '';
  let newDescription = '';
  let newPriority = 'medium';
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

      const res = await api.get(`/cases?${params.toString()}`);
      if (res && res.success) {
        cases = res.data;
        total = res.pagination.total;
        totalPages = res.pagination.totalPages;
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

  async function handleCreateCase() {
    createError = null;
    creating = true;

    try {
      const res = await api.post('/cases', {
        title: newTitle,
        description: newDescription,
        priority: newPriority
      });

      if (res && res.success) {
        showCreateModal = false;
        newTitle = '';
        newDescription = '';
        newPriority = 'medium';
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
      <div class="badge-subtitle">CASE MANAGEMENT</div>
      <h1>Active & Historical Investigations</h1>
    </div>

    <button class="btn btn-primary" on:click={() => (showCreateModal = true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Investigation Case
    </button>
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
        placeholder="Search title or description..."
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

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading investigation records...</p>
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
        {search || statusFilter || priorityFilter
          ? 'No cases match the selected filter criteria.'
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
              {c.priority.toUpperCase()}
            </span>
          </div>

          <h3 class="case-title">{c.title}</h3>
          <p class="case-desc">{c.description}</p>

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
          class="btn btn-secondary"
          disabled={page <= 1}
          on:click={() => { page--; loadCases(); }}
        >
          Previous
        </button>
        <span class="page-info">Page {page} of {totalPages} ({total} total)</span>
        <button
          class="btn btn-secondary"
          disabled={page >= totalPages}
          on:click={() => { page++; loadCases(); }}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}

  <!-- Create Case Modal -->
  {#if showCreateModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showCreateModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Create New Case</h3>
          <button class="close-btn" on:click={() => (showCreateModal = false)}>✕</button>
        </div>

        {#if createError}
          <div class="alert alert-danger" style="margin: 1rem 0;">{createError}</div>
        {/if}

        <form on:submit|preventDefault={handleCreateCase} class="modal-form">
          <div class="form-group">
            <label for="caseTitle">Case Title</label>
            <input
              id="caseTitle"
              type="text"
              bind:value={newTitle}
              placeholder="e.g., Financial Ledger Discrepancy Audit"
              required
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label for="caseDesc">Case Summary & Objectives</label>
            <textarea
              id="caseDesc"
              bind:value={newDescription}
              rows="4"
              placeholder="Describe the context, primary targets, and initial findings..."
              required
              class="form-input"
            ></textarea>
          </div>

          <div class="form-group">
            <label for="casePriority">Initial Priority</label>
            <select id="casePriority" bind:value={newPriority} class="form-input">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              on:click={() => (showCreateModal = false)}
            >
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Initialize Draft Case'}
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
    gap: 1.75rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .badge-subtitle {
    font-size: 0.6875rem;
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

  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-secondary);
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

  .search-input:focus {
    border-color: var(--accent-blue);
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

  .cases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  .case-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .case-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent-blue);
  }

  .case-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .status-badge {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.05em;
  }

  .badge-draft { background: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }
  .badge-active { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
  .badge-review { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-closed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .badge-archived { background: rgba(107, 114, 128, 0.15); color: #9ca3af; border: 1px solid rgba(107, 114, 128, 0.3); }

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
    margin-bottom: 1.25rem;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .case-footer {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
    font-size: 0.75rem;
  }

  .meta-item {
    display: flex;
    gap: 0.3rem;
  }

  .meta-label {
    color: var(--text-muted);
  }

  .meta-val {
    color: var(--text-primary);
    font-weight: 500;
  }

  .pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    margin-top: 1rem;
  }

  .page-info {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .loading-state, .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background-color: var(--bg-secondary);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
  }

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 1rem;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
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
    align-items: center;
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
    gap: 1.25rem;
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

  .form-input:focus {
    border-color: var(--accent-blue);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }
</style>
