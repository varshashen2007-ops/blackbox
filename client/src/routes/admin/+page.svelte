<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let stats = null;
  let loading = true;
  let errorMsg = null;

  async function loadStats() {
    loading = true;
    errorMsg = null;

    try {
      const res = await api.get('/admin/stats');
      if (res && res.success) {
        stats = res.data;
      }
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        errorMsg = 'Access Denied: Administrator privileges required.';
      } else if (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED') {
        goto('/login');
      } else {
        errorMsg = err.message || 'Failed to load system statistics.';
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadStats();
  });
</script>

<div class="admin-dashboard">
  <div class="page-header">
    <div>
      <div class="badge-subtitle">EXECUTIVE & AUDIT OVERSIGHT</div>
      <h1>System Intelligence & Analytics</h1>
    </div>

    <div class="header-actions">
      <a href="/admin/users" class="btn btn-secondary">Manage Users</a>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Aggregating real-time database intelligence metrics...</p>
    </div>
  {:else if stats}
    <!-- Top Stat Counter Cards -->
    <div class="metrics-grid">
      <div class="metric-card">
        <span class="metric-title">Total Active Cases</span>
        <span class="metric-value font-mono">{stats.cases.active}</span>
        <span class="metric-sub">{stats.cases.total} total cases recorded</span>
      </div>

      <div class="metric-card">
        <span class="metric-title">Verified Evidence Items</span>
        <span class="metric-value font-mono" style="color: var(--color-success);">{stats.evidence.verified}</span>
        <span class="metric-sub">{stats.evidence.total} total items logged</span>
      </div>

      <div class="metric-card">
        <span class="metric-title">Mean Hypothesis Confidence</span>
        <span class="metric-value font-mono" style="color: var(--accent-cyan);">{stats.averageConfidenceScore}%</span>
        <span class="metric-sub">{stats.hypotheses.total} total hypotheses</span>
      </div>

      <div class="metric-card">
        <span class="metric-title">Immutable Audit Trail</span>
        <span class="metric-value font-mono">{stats.totalAuditLogs}</span>
        <span class="metric-sub">{stats.totalUsers} registered personnel</span>
      </div>
    </div>

    <div class="charts-grid">
      <!-- Cases by Lifecycle Status -->
      <div class="card chart-card">
        <h3>Case Lifecycle Distribution</h3>
        <div class="breakdown-list">
          <div class="bar-row">
            <span class="bar-label">Draft</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.cases.total > 0 ? (stats.cases.draft / stats.cases.total) * 100 : 0}%; background: #6b7280;"></div>
            </div>
            <span class="bar-count font-mono">{stats.cases.draft}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Active</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.cases.total > 0 ? (stats.cases.active / stats.cases.total) * 100 : 0}%; background: var(--accent-blue);"></div>
            </div>
            <span class="bar-count font-mono">{stats.cases.active}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Under Review</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.cases.total > 0 ? (stats.cases.under_review / stats.cases.total) * 100 : 0}%; background: var(--color-warning);"></div>
            </div>
            <span class="bar-count font-mono">{stats.cases.under_review}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Closed</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.cases.total > 0 ? (stats.cases.closed / stats.cases.total) * 100 : 0}%; background: var(--color-success);"></div>
            </div>
            <span class="bar-count font-mono">{stats.cases.closed}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Archived</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.cases.total > 0 ? (stats.cases.archived / stats.cases.total) * 100 : 0}%; background: #4b5563;"></div>
            </div>
            <span class="bar-count font-mono">{stats.cases.archived}</span>
          </div>
        </div>
      </div>

      <!-- Evidence Verification Breakdown -->
      <div class="card chart-card">
        <h3>Evidence Verification Health</h3>
        <div class="breakdown-list">
          <div class="bar-row">
            <span class="bar-label">Verified</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.evidence.total > 0 ? (stats.evidence.verified / stats.evidence.total) * 100 : 0}%; background: var(--color-success);"></div>
            </div>
            <span class="bar-count font-mono">{stats.evidence.verified}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Pending Review</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.evidence.total > 0 ? (stats.evidence.pending / stats.evidence.total) * 100 : 0}%; background: var(--color-warning);"></div>
            </div>
            <span class="bar-count font-mono">{stats.evidence.pending}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Unverified</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.evidence.total > 0 ? (stats.evidence.unverified / stats.evidence.total) * 100 : 0}%; background: #6b7280;"></div>
            </div>
            <span class="bar-count font-mono">{stats.evidence.unverified}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Rejected</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.evidence.total > 0 ? (stats.evidence.rejected / stats.evidence.total) * 100 : 0}%; background: var(--color-danger);"></div>
            </div>
            <span class="bar-count font-mono">{stats.evidence.rejected}</span>
          </div>
        </div>
      </div>

      <!-- Hypothesis Outcomes -->
      <div class="card chart-card">
        <h3>Hypothesis Outcome Distribution</h3>
        <div class="breakdown-list">
          <div class="bar-row">
            <span class="bar-label">Supported</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.hypotheses.total > 0 ? (stats.hypotheses.supported / stats.hypotheses.total) * 100 : 0}%; background: var(--color-success);"></div>
            </div>
            <span class="bar-count font-mono">{stats.hypotheses.supported}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Under Investigation</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.hypotheses.total > 0 ? (stats.hypotheses.under_investigation / stats.hypotheses.total) * 100 : 0}%; background: var(--accent-blue);"></div>
            </div>
            <span class="bar-count font-mono">{stats.hypotheses.under_investigation}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Refuted</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.hypotheses.total > 0 ? (stats.hypotheses.refuted / stats.hypotheses.total) * 100 : 0}%; background: var(--color-danger);"></div>
            </div>
            <span class="bar-count font-mono">{stats.hypotheses.refuted}</span>
          </div>

          <div class="bar-row">
            <span class="bar-label">Inconclusive</span>
            <div class="bar-track">
              <div class="bar-fill" style="width: {stats.hypotheses.total > 0 ? (stats.hypotheses.inconclusive / stats.hypotheses.total) * 100 : 0}%; background: var(--color-warning);"></div>
            </div>
            <span class="bar-count font-mono">{stats.hypotheses.inconclusive}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-dashboard {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
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
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .metric-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
  }

  .metric-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.35rem;
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.1;
    margin-bottom: 0.25rem;
  }

  .metric-sub {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 1.5rem;
  }

  .chart-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .chart-card h3 {
    font-size: 0.9375rem;
    font-weight: 700;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .breakdown-list {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .bar-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
  }

  .bar-label {
    width: 120px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .bar-track {
    flex: 1;
    height: 8px;
    background-color: var(--bg-primary);
    border-radius: 4px;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.4s ease;
  }

  .bar-count {
    width: 32px;
    text-align: right;
    font-weight: 600;
    color: var(--text-primary);
  }

  .loading-state {
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

  .font-mono {
    font-family: var(--font-mono);
  }
</style>
