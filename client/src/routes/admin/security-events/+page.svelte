<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let logs = [];
  let loading = true;
  let errorMsg = null;
  let page = 1;
  let limit = 25;
  let total = 0;
  let totalPages = 1;

  async function loadSecurityLogs() {
    loading = true;
    errorMsg = null;
    try {
      const res = await api.get(`/admin/audit-logs?securityOnly=true&page=${page}&limit=${limit}`);
      if (res?.success) {
        logs = res.data || [];
        if (res.pagination) {
          total = res.pagination.total;
          totalPages = res.pagination.totalPages;
        }
      }
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        errorMsg = 'Access Denied: Level 3 Administrator privileges required.';
      } else {
        errorMsg = err.message || 'Failed to load security event logs.';
      }
    } finally {
      loading = false;
    }
  }

  function getActionBadgeColor(action) {
    if (action.includes('FAILED') || action.includes('REVOKED') || action.includes('FORBIDDEN')) return 'danger';
    if (action.includes('APPROVED') || action.includes('VERIFIED') || action.includes('SUCCESS') || action.includes('ENABLED')) return 'success';
    if (action.includes('CHANGED') || action.includes('REQUESTED')) return 'warning';
    return 'cyan';
  }

  function formatTime(d) {
    return d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' }) : '—';
  }

  onMount(() => {
    if (!$auth.isAuthenticated) {
      goto('/login');
      return;
    }
    loadSecurityLogs();
  });
</script>

<svelte:head>
  <title>Security Event Log — BlackBox Admin</title>
</svelte:head>

<div class="security-events-page">
  <div class="page-header">
    <div>
      <div class="eyebrow font-mono">SECURITY INFORMATION & EVENT MANAGEMENT (SIEM)</div>
      <h1>Security Events & Audit Monitor</h1>
      <p class="subtitle">Real-time log of authentication challenges, privilege escalations, and authorization decisions.</p>
    </div>
    <span class="badge-tamper font-mono">TAMPER-EVIDENT • APPEND-ONLY</span>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger font-mono">{errorMsg}</div>
  {/if}

  <div class="card logs-card">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p class="font-mono">Loading security event records...</p>
      </div>
    {:else if logs.length === 0}
      <div class="empty-state">
        <p>No security events recorded in the system.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="security-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Security Event</th>
              <th>Actor & Role</th>
              <th>Target Entity</th>
              <th>IP Address</th>
              <th>Event Metadata</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log (log.id || log._id)}
              <tr>
                <td class="font-mono time-cell">{formatTime(log.timestamp)}</td>
                <td>
                  <span class="event-badge badge-{getActionBadgeColor(log.action)} font-mono">
                    {log.action}
                  </span>
                </td>
                <td>
                  <div class="actor-box">
                    <span class="actor-name font-bold">{log.actor?.name || 'System / Unauthenticated'}</span>
                    {#if log.actor?.email}
                      <span class="actor-email font-mono">{log.actor.email}</span>
                    {/if}
                  </div>
                </td>
                <td class="font-mono target-cell">
                  {log.entityType}
                </td>
                <td class="font-mono ip-cell">
                  {log.ipAddress || '127.0.0.1'}
                </td>
                <td>
                  {#if log.metadata && Object.keys(log.metadata).length > 0}
                    <pre class="meta-json font-mono">{JSON.stringify(log.metadata)}</pre>
                  {:else}
                    <span class="text-muted">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if totalPages > 1}
        <div class="pagination-bar">
          <button class="btn btn-secondary btn-sm" disabled={page <= 1} on:click={() => { page--; loadSecurityLogs(); }}>
            Previous
          </button>
          <span class="font-mono" style="font-size: 0.8125rem; color: var(--text-muted);">
            Page {page} of {totalPages} ({total} events)
          </span>
          <button class="btn btn-secondary btn-sm" disabled={page >= totalPages} on:click={() => { page++; loadSecurityLogs(); }}>
            Next
          </button>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .security-events-page {
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
    gap: 1rem;
    flex-wrap: wrap;
  }

  .eyebrow {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .page-header h1 { font-size: 1.75rem; font-weight: 800; }
  .subtitle { font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem; }

  .badge-tamper {
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
    overflow: hidden;
  }

  .table-wrapper { overflow-x: auto; }

  .security-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    text-align: left;
  }

  .security-table th {
    background-color: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 700;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    font-size: 0.5625rem;
    letter-spacing: 0.05em;
  }

  .security-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  .time-cell { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }

  .event-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 800;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .badge-danger { background: rgba(248, 81, 73, 0.15); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.3); }
  .badge-success { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border: 1px solid rgba(63, 185, 80, 0.3); }
  .badge-warning { background: rgba(245, 158, 11, 0.15); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.3); }
  .badge-cyan { background: rgba(0, 229, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(0, 229, 255, 0.3); }

  .actor-box { display: flex; flex-direction: column; gap: 0.1rem; }
  .actor-name { color: var(--text-primary); }
  .actor-email { font-size: 0.6875rem; color: var(--text-muted); }

  .target-cell { font-size: 0.75rem; color: var(--text-secondary); }
  .ip-cell { font-size: 0.75rem; color: var(--text-muted); }

  .meta-json {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    background-color: var(--bg-primary);
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    max-width: 280px;
    overflow-x: auto;
    white-space: nowrap;
    margin: 0;
  }

  .pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
    padding: 1rem;
    border-top: 1px solid var(--border-color);
  }

  .alert { padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.8125rem; }
  .alert-danger { background: rgba(248, 81, 73, 0.1); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.3); }

  .loading-state, .empty-state { text-align: center; padding: 4rem; color: var(--text-muted); }
  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 0.75rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
