<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';

  let backendOnline = false;
  let backendData = null;
  let adminStats = null;
  let recentCases = [];
  let auditFeed = [];
  let loading = true;

  onMount(async () => {
    try {
      const health = await api.get('/health');
      if (health && health.success) {
        backendOnline = true;
        backendData = health.data;
      }
    } catch { /* offline */ }

    if ($auth.isAuthenticated) {
      await loadDashboardData();
    }

    loading = false;
  });

  async function loadDashboardData() {
    try {
      const [casesRes, statsRes, auditRes] = await Promise.allSettled([
        api.get('/cases?limit=5&sort=-updatedAt'),
        $auth.user?.role === 'admin' ? api.get('/admin/stats') : Promise.resolve(null),
        api.get('/notifications')
      ]);

      if (casesRes.status === 'fulfilled' && casesRes.value?.success) {
        recentCases = casesRes.value.data?.cases || casesRes.value.data || [];
      }
      if (statsRes.status === 'fulfilled' && statsRes.value?.success) {
        adminStats = statsRes.value.data;
      }
      if (auditRes.status === 'fulfilled' && auditRes.value?.success) {
        auditFeed = auditRes.value.data?.slice(0, 8) || [];
      }
    } catch { /* silent */ }
  }

  function getStatusClass(status) {
    return `badge-status-${status}`;
  }

  function formatRelative(dateStr) {
    const d = new Date(dateStr);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  }
</script>

<div class="command-center">

  <!-- Page Header -->
  <div class="page-header">
    <div class="header-left">
      <div class="header-eyebrow font-mono">BLACKBOX DIGITAL FORENSICS — COMMAND CENTER</div>
      <h1 class="header-title">Investigation Intelligence Hub</h1>
      <p class="header-sub">
        {#if $auth.isAuthenticated}
          Welcome back, <strong>{$auth.user?.name}</strong>. All systems are operational.
        {:else}
          Real-time forensic analytics, live audit trail, and investigation status at a glance.
        {/if}
      </p>
    </div>
    <div class="header-actions">
      <div class="api-status-pill" class:api-online={backendOnline}>
        <span class="status-dot"></span>
        <span class="font-mono">{backendOnline ? 'API ONLINE' : 'API OFFLINE'}</span>
        {#if backendData}
          <span class="api-version">v{backendData.version}</span>
        {/if}
      </div>
      {#if $auth.isAuthenticated}
        <a href="/cases/new" class="btn btn-primary btn-sm">+ New Case</a>
      {:else}
        <a href="/login" class="btn btn-primary btn-sm">Access Platform</a>
      {/if}
    </div>
  </div>

  {#if !$auth.isAuthenticated}
    <!-- Unauthenticated CTA -->
    <div class="auth-cta-card">
      <div class="cta-icon">🔐</div>
      <h2>Authenticate to Access Investigation Workstation</h2>
      <p>Sign in with your BlackBox investigator credentials to access cases, evidence boards, and the AI Investigator.</p>
      <div class="cta-actions">
        <a href="/login" class="btn btn-primary">Sign In to Platform</a>
        <a href="/verify-identity" class="btn btn-secondary">Verify Identity (Google)</a>
      </div>
    </div>
  {:else}
    <!-- Stats Grid -->
    {#if adminStats}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">TOTAL CASES</div>
          <div class="stat-value font-mono">{adminStats.cases?.total ?? 0}</div>
          <div class="stat-sub">{adminStats.cases?.active ?? 0} active</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">EVIDENCE ARTIFACTS</div>
          <div class="stat-value font-mono">{adminStats.evidence?.total ?? 0}</div>
          <div class="stat-sub">{adminStats.evidence?.verified ?? 0} verified</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">HYPOTHESES</div>
          <div class="stat-value font-mono">{adminStats.hypotheses?.total ?? 0}</div>
          <div class="stat-sub">Avg confidence: {adminStats.hypotheses?.avgConfidence?.toFixed(1) ?? '—'}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">AUDIT ENTRIES</div>
          <div class="stat-value font-mono">{adminStats.auditLogs?.total ?? 0}</div>
          <div class="stat-sub">Immutable event log</div>
        </div>
      </div>
    {:else}
      <div class="stats-grid">
        <div class="stat-card stat-card--loading">
          <div class="stat-label">TOTAL CASES</div>
          <div class="stat-value font-mono">—</div>
        </div>
        <div class="stat-card stat-card--loading">
          <div class="stat-label">EVIDENCE ARTIFACTS</div>
          <div class="stat-value font-mono">—</div>
        </div>
        <div class="stat-card stat-card--loading">
          <div class="stat-label">HYPOTHESES</div>
          <div class="stat-value font-mono">—</div>
        </div>
        <div class="stat-card stat-card--loading">
          <div class="stat-label">INVESTIGATORS</div>
          <div class="stat-value font-mono">—</div>
        </div>
      </div>
    {/if}

    <!-- Two-Column Content -->
    <div class="content-grid">

      <!-- Recent Cases Panel -->
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Recent Investigations</h2>
          <a href="/cases" class="btn btn-secondary btn-sm">View All</a>
        </div>
        <div class="panel-body">
          {#if loading}
            <div class="loading-placeholder">
              <div class="placeholder-line"></div>
              <div class="placeholder-line short"></div>
            </div>
          {:else if recentCases.length === 0}
            <div class="empty-state">
              <p>No investigations found.</p>
              <a href="/cases/new" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;">Open First Case</a>
            </div>
          {:else}
            <div class="case-list">
              {#each recentCases as c}
                <a href="/cases/{c._id}" class="case-row">
                  <div class="case-row-left">
                    <span class="status-badge {getStatusClass(c.status)}">{c.status.replace('_', ' ')}</span>
                    <div>
                      <div class="case-title">{c.title}</div>
                      <div class="case-meta font-mono">{c.priority?.toUpperCase()} PRIORITY • {formatRelative(c.updatedAt)}</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Live Audit Feed -->
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Live Audit Event Feed</h2>
          <a href="/admin/audit-logs" class="btn btn-secondary btn-sm">Full Log</a>
        </div>
        <div class="panel-body">
          {#if auditFeed.length === 0}
            <div class="empty-state">
              <p>No recent events detected.</p>
            </div>
          {:else}
            <div class="audit-list">
              {#each auditFeed as entry}
                <div class="audit-row audit-{entry.type || 'info'}">
                  <div class="audit-action font-mono">{entry.action}</div>
                  <div class="audit-info">
                    <span class="audit-title">{entry.title || entry.action}</span>
                    <span class="audit-actor">by {entry.actor}</span>
                  </div>
                  <div class="audit-time font-mono">{formatRelative(entry.timestamp)}</div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

    </div>

    <!-- Investigative Pillars Banner -->
    <div class="pillars-banner">
      <div class="pillar">
        <div class="pillar-icon">🔐</div>
        <div class="pillar-label">SHA-256 HASH VERIFICATION</div>
        <div class="pillar-desc">Cryptographic integrity badges on every evidence artifact</div>
      </div>
      <div class="pillar-divider"></div>
      <div class="pillar">
        <div class="pillar-icon">📊</div>
        <div class="pillar-label">DETERMINISTIC CONFIDENCE ENGINE</div>
        <div class="pillar-desc">Mathematical scoring: +0.5 supporting, −0.5 contradicting, +10% corroboration boost</div>
      </div>
      <div class="pillar-divider"></div>
      <div class="pillar">
        <div class="pillar-icon">🤖</div>
        <div class="pillar-label">AI INVESTIGATOR</div>
        <div class="pillar-desc">Context-aware analysis grounded on verified evidence only — zero fabrication</div>
      </div>
      <div class="pillar-divider"></div>
      <div class="pillar">
        <div class="pillar-icon">📜</div>
        <div class="pillar-label">IMMUTABLE AUDIT TRAIL</div>
        <div class="pillar-desc">Synchronous AuditLog on every state mutation — actor, action, timestamp</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .command-center {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  /* Page Header */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .header-eyebrow {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.1em;
    margin-bottom: 0.4rem;
  }

  .header-title {
    font-size: 2rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin-bottom: 0.375rem;
  }

  .header-sub {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .api-status-pill {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    background-color: rgba(248, 81, 73, 0.1);
    color: var(--color-danger);
    border: 1px solid rgba(248, 81, 73, 0.3);
  }

  .api-status-pill.api-online {
    background-color: rgba(63, 185, 80, 0.1);
    color: var(--color-success);
    border-color: rgba(63, 185, 80, 0.4);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .api-version {
    color: var(--text-muted);
    font-weight: 400;
    margin-left: 0.25rem;
  }

  /* Auth CTA */
  .auth-cta-card {
    text-align: center;
    padding: 4rem 2rem;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 12px;
  }

  .cta-icon { font-size: 3rem; margin-bottom: 1rem; }

  .auth-cta-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 0.75rem;
  }

  .auth-cta-card p {
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .cta-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  @media (max-width: 960px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .stat-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    transition: border-color 0.15s ease;
  }

  .stat-card:hover {
    border-color: var(--accent-cyan);
  }

  .stat-card--loading {
    opacity: 0.5;
  }

  .stat-label {
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1;
  }

  .stat-sub {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
  }

  /* Two-Col Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 820px) {
    .content-grid { grid-template-columns: 1fr; }
  }

  /* Panel */
  .panel {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .panel-title {
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .panel-body {
    padding: 0.75rem;
    flex: 1;
  }

  /* Case List */
  .case-list {
    display: flex;
    flex-direction: column;
  }

  .case-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.5rem;
    border-bottom: 1px solid var(--border-color);
    text-decoration: none;
    transition: background-color 0.15s ease;
    border-radius: 6px;
  }

  .case-row:last-child { border-bottom: none; }

  .case-row:hover {
    background-color: var(--bg-elevated);
  }

  .case-row-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    overflow: hidden;
  }

  .case-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .case-meta {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 0.1rem;
  }

  .chevron { color: var(--text-muted); flex-shrink: 0; }

  /* Audit Feed */
  .audit-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .audit-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.5rem;
    border-radius: 6px;
    border-left: 3px solid var(--border-color);
    background-color: var(--bg-primary);
  }

  .audit-success { border-left-color: var(--color-success); }
  .audit-warning { border-left-color: var(--color-warning); }
  .audit-primary { border-left-color: var(--accent-blue); }
  .audit-info    { border-left-color: var(--accent-cyan); }

  .audit-action {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .audit-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .audit-title {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .audit-actor {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .audit-time {
    font-size: 0.6875rem;
    color: var(--text-muted);
    white-space: nowrap;
  }

  /* Pillars Banner */
  .pillars-banner {
    display: flex;
    align-items: stretch;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow: hidden;
  }

  .pillar {
    flex: 1;
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .pillar-icon { font-size: 1.5rem; }

  .pillar-label {
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent-cyan);
  }

  .pillar-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .pillar-divider {
    width: 1px;
    background-color: var(--border-color);
    align-self: stretch;
  }

  /* Loading & Empty */
  .loading-placeholder {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .placeholder-line {
    height: 14px;
    border-radius: 4px;
    background: linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-card) 50%, var(--bg-elevated) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .placeholder-line.short { width: 60%; }

  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .empty-state {
    text-align: center;
    padding: 2.5rem 1.5rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }
</style>
