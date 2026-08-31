<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';

  let backendStatus = 'Checking...';
  let backendData = null;
  let errorMsg = null;

  onMount(async () => {
    try {
      const res = await api.get('/health');
      if (res && res.success) {
        backendStatus = 'Online & Healthy';
        backendData = res.data;
      } else {
        backendStatus = 'Unreachable';
      }
    } catch (err) {
      backendStatus = 'Offline';
      errorMsg = err.message || 'Could not connect to backend server';
    }
  });
</script>

<div class="overview-container">
  <div class="hero-section">
    <div class="hero-badge">DAY 0 MONOREPO INITIALIZED</div>
    <h1 class="hero-title">Digital Evidence & Hypothesis Intelligence</h1>
    <p class="hero-subtitle">
      BlackBox empowers investigators, supervisors, and administrators to evaluate evidence dynamically with deterministic confidence scoring, chain of custody tracking, and auditable case lifecycles.
    </p>
  </div>

  <div class="status-grid">
    <div class="card status-card">
      <div class="card-header">
        <span class="card-title">Backend API Service</span>
        <span class="status-indicator" class:online={backendStatus === 'Online & Healthy'}>
          {backendStatus}
        </span>
      </div>
      <div class="card-body">
        {#if backendData}
          <div class="meta-row">
            <span class="meta-label">Service:</span>
            <span class="meta-value font-mono">{backendData.service}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Version:</span>
            <span class="meta-value font-mono">v{backendData.version}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Last Ping:</span>
            <span class="meta-value font-mono">{new Date(backendData.timestamp).toLocaleTimeString()}</span>
          </div>
        {:else if errorMsg}
          <p class="text-error">{errorMsg}</p>
          <p class="text-muted" style="margin-top: 0.5rem; font-size: 0.8125rem;">
            Run <code class="font-mono">cd server && npm run dev</code> to launch the REST backend.
          </p>
        {:else}
          <p class="text-muted">Connecting to backend at <code class="font-mono">http://localhost:5000/api/v1/health</code>...</p>
        {/if}
      </div>
    </div>

    <div class="card info-card">
      <div class="card-header">
        <span class="card-title">Vertical Slice Architecture</span>
        <span class="badge">3 TRACKS READY</span>
      </div>
      <div class="card-body">
        <ul class="track-list">
          <li>
            <strong>Track A (Foundation):</strong> Auth, RBAC, Cases & Transition Engine
          </li>
          <li>
            <strong>Track B (Evidence):</strong> Evidence Board, Verification & Chain of Custody
          </li>
          <li>
            <strong>Track C (Hypotheses):</strong> Dynamic Confidence Engine & Relationship Graph
          </li>
        </ul>
      </div>
    </div>
  </div>

  <div class="cases-preview">
    <div class="section-header">
      <h2>Active Case Overview</h2>
      <span class="text-muted" style="font-size: 0.875rem;">Honest real-time status</span>
    </div>
    <div class="empty-state-box">
      <p class="empty-text">No data yet</p>
      <p class="empty-subtext">No active investigations in database. Connect backend to begin Phase 1 setup.</p>
    </div>
  </div>
</div>

<style>
  .overview-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .hero-section {
    max-width: 800px;
  }

  .hero-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent-cyan);
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    margin-bottom: 0.75rem;
  }

  .hero-title {
    font-size: 2.25rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.2;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
  }

  .hero-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
  }

  .card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .status-indicator {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background-color: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-indicator.online {
    background-color: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    padding: 0.35rem 0;
    font-size: 0.875rem;
  }

  .meta-label {
    color: var(--text-muted);
  }

  .meta-value {
    color: var(--text-primary);
  }

  .track-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .track-list strong {
    color: var(--text-primary);
  }

  .cases-preview {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .section-header h2 {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .empty-state-box {
    text-align: center;
    padding: 3rem 1.5rem;
    background-color: var(--bg-primary);
    border: 1px dashed var(--border-color);
    border-radius: 6px;
  }

  .empty-text {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.25rem;
  }

  .empty-subtext {
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .text-error {
    color: var(--color-danger);
    font-size: 0.875rem;
  }

  .font-mono {
    font-family: var(--font-mono);
  }
</style>
