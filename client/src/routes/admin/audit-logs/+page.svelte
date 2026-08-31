<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let logs = [];
  let loading = true;
  let page = 1;
  const LIMIT = 25;
  let filterAction = '';
  let filterActor = '';

  onMount(async () => {
    if (!$auth.isAuthenticated) {
      goto('/login');
      return;
    }
    await loadLogs();
  });

  async function loadLogs() {
    loading = true;
    try {
      let url = `/admin/audit-logs?limit=${LIMIT}&page=${page}`;
      if (filterAction) url += `&action=${encodeURIComponent(filterAction)}`;
      const res = await api.get(url);
      if (res?.success) {
        logs = res.data?.logs || res.data || [];
      }
    } catch (err) {
      if (err?.code === 'FORBIDDEN') goto('/');
    } finally {
      loading = false;
    }
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) : '—';
  }

  function getActionColor(action) {
    if (action?.includes('VERIFIED')) return 'success';
    if (action?.includes('REJECTED')) return 'danger';
    if (action?.includes('TRANSITION') || action?.includes('STATUS')) return 'warning';
    return 'info';
  }
</script>

<div class="audit-explorer">
  <!-- Header -->
  <div class="page-header">
    <div>
      <div class="eyebrow font-mono">ADMINISTRATIVE SECURITY CONSOLE</div>
      <h1>Audit Log Explorer</h1>
      <p class="subtitle">Immutable, chronological record of all system state mutations and access events.</p>
    </div>
    <div class="header-badges">
      <span class="badge-readonly font-mono">READ-ONLY • TAMPER-EVIDENT</span>
    </div>
  </div>

  <!-- Filters -->
  <div class="filter-bar card">
    <div class="filter-field">
      <label for="action-filter" class="filter-label">Filter by Action</label>
      <input
        id="action-filter"
        type="text"
        class="filter-input font-mono"
        placeholder="e.g. EVIDENCE_VERIFIED, CASE_TRANSITIONED..."
        bind:value={filterAction}
        on:input={() => { page = 1; loadLogs(); }}
      />
    </div>
    <div class="filter-actions">
      <span class="result-count font-mono">{logs.length} entries displayed</span>
      <button class="btn btn-secondary btn-sm" on:click={() => { filterAction = ''; page = 1; loadLogs(); }}>
        Clear
      </button>
    </div>
  </div>

  <!-- Logs Table -->
  <div class="logs-card card">
    {#if loading}
      <div class="loading-box">
        <div class="spinner"></div>
        <p class="font-mono">Loading audit records...</p>
      </div>
    {:else if logs.length === 0}
      <div class="empty-state">
        <p>No audit logs found matching your filter criteria.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Entity Type</th>
              <th>Case</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log}
              <tr>
                <td class="font-mono timestamp-cell">{formatDate(log.timestamp)}</td>
                <td>
                  <span class="action-badge action-{getActionColor(log.action)} font-mono">
                    {log.action}
                  </span>
                </td>
                <td class="actor-cell">
                  <span class="actor-name">{log.actorId?.name || '—'}</span>
                  <span class="actor-email font-mono">{log.actorId?.email || ''}</span>
                </td>
                <td>
                  {#if log.actorId?.role}
                    <span class="role-chip">{log.actorId.role.toUpperCase()}</span>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
                <td class="font-mono">{log.entityType || '—'}</td>
                <td class="font-mono">
                  {#if log.caseId}
                    <a href="/cases/{log.caseId?._id || log.caseId}" class="case-link">
                      {log.caseId?.title?.slice(0, 24) || String(log.caseId).slice(-8).toUpperCase()}...
                    </a>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
                <td class="font-mono ip-cell">{log.ipAddress || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination-bar">
        <button
          class="btn btn-secondary btn-sm"
          disabled={page <= 1}
          on:click={() => { page--; loadLogs(); }}
        >
          ← Prev
        </button>
        <span class="font-mono">Page {page}</span>
        <button
          class="btn btn-secondary btn-sm"
          disabled={logs.length < LIMIT}
          on:click={() => { page++; loadLogs(); }}
        >
          Next →
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .audit-explorer {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1300px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .eyebrow {
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: var(--accent-cyan);
    margin-bottom: 0.4rem;
  }

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
  }

  .subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .badge-readonly {
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 0.3rem 0.75rem;
    border-radius: 5px;
    background-color: rgba(248, 81, 73, 0.1);
    color: var(--color-danger);
    border: 1px solid rgba(248, 81, 73, 0.4);
  }

  .card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
  }

  .filter-bar {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filter-field {
    flex: 1;
    min-width: 240px;
  }

  .filter-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    margin-bottom: 0.35rem;
  }

  .filter-input {
    width: 100%;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    outline: none;
    font-family: inherit;
  }

  .filter-input:focus { border-color: var(--accent-cyan); }

  .filter-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .result-count {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .logs-card { padding: 0; overflow: hidden; }

  .table-wrapper { overflow-x: auto; }

  .audit-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .audit-table th {
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    padding: 0.75rem 1rem;
    background-color: var(--bg-primary);
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    white-space: nowrap;
  }

  .audit-table td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--text-primary);
    vertical-align: middle;
  }

  .audit-table tbody tr:last-child td { border-bottom: none; }

  .audit-table tbody tr:hover { background-color: var(--bg-elevated); }

  .timestamp-cell { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }

  .action-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .action-success  { background: rgba(63,185,80,0.15);  color: var(--color-success); }
  .action-danger   { background: rgba(248,81,73,0.15);  color: var(--color-danger);  }
  .action-warning  { background: rgba(210,153,34,0.15); color: var(--color-warning); }
  .action-info     { background: rgba(0,229,255,0.1);   color: var(--accent-cyan);   }

  .actor-cell {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .actor-name { font-weight: 600; }
  .actor-email { font-size: 0.6875rem; color: var(--text-muted); }

  .role-chip {
    font-size: 0.5625rem;
    font-weight: 700;
    padding: 0.1rem 0.35rem;
    border-radius: 3px;
    background-color: var(--bg-elevated);
    color: var(--text-muted);
  }

  .case-link {
    color: var(--accent-cyan);
    text-decoration: none;
    font-size: 0.75rem;
  }

  .case-link:hover { text-decoration: underline; }

  .ip-cell { font-size: 0.6875rem; color: var(--text-muted); }

  .pagination-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .loading-box, .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
    color: var(--text-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
