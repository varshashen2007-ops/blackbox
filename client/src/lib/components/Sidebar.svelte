<script>
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.js';

  export let onOpenAi = () => {};

  $: currentPath = $page.url.pathname;

  function getLevelShortTag(role, level) {
    if (role === 'admin') return 'L3 ADMIN';
    if (role === 'supervisor') return 'L2 SUPERVISOR';
    return 'L1 INVESTIGATOR';
  }
</script>

<aside class="workstation-sidebar">
  <!-- Brand Header -->
  <div class="sidebar-brand">
    <a href="/" class="brand-link">
      <div class="brand-emblem">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      </div>
      <div class="brand-text">
        <span class="brand-title">BLACKBOX</span>
        <span class="brand-sub">DIGITAL FORENSICS</span>
      </div>
    </a>
  </div>

  <!-- Navigation Groups -->
  <nav class="sidebar-nav">
    <div class="nav-section-label">OPERATIONAL WORKSPACES</div>

    <a href="/" class="nav-item" class:active={currentPath === '/'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      <span>Command Center</span>
    </a>

    <a href="/cases" class="nav-item" class:active={currentPath.startsWith('/cases')}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>Investigation Cases</span>
    </a>

    <div class="nav-section-label">CREDENTIALS & IDENTITY</div>

    <a href="/security" class="nav-item" class:active={currentPath === '/security'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span>Security & Credentials</span>
    </a>

    <a href="/verify-identity" class="nav-item" class:active={currentPath === '/verify-identity'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span>Verify Identity</span>
    </a>

    <div class="nav-section-label">INTELLIGENCE & AUDIT</div>

    <button type="button" class="nav-item ai-nav-btn" on:click={onOpenAi}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/>
        <path d="M12 8v4"/>
        <path d="M12 16h.01"/>
      </svg>
      <span>AI Investigator</span>
      <span class="nav-badge-cyan">AI</span>
    </button>

    <a href="/admin/audit-logs" class="nav-item" class:active={currentPath === '/admin/audit-logs'}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span>Audit Explorer</span>
    </a>

    <!-- Admin Section -->
    {#if $auth.user?.role === 'admin'}
      <div class="nav-section-label">ADMINISTRATIVE OVERSIGHT</div>

      <a href="/admin" class="nav-item" class:active={currentPath === '/admin'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        <span>Global Intelligence Stats</span>
      </a>

      <a href="/admin/users" class="nav-item" class:active={currentPath === '/admin/users'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span>Personnel Directory</span>
      </a>

      <a href="/admin/security-events" class="nav-item" class:active={currentPath === '/admin/security-events'}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <span>Security SIEM Monitor</span>
      </a>
    {/if}
  </nav>

  <!-- Bottom User Profile Card -->
  <div class="sidebar-footer">
    {#if $auth.isAuthenticated}
      <div class="user-card">
        <div class="user-avatar font-mono">
          {$auth.user?.name?.slice(0, 2).toUpperCase() || 'BB'}
        </div>
        <div class="user-details">
          <span class="user-name">{$auth.user?.name}</span>
          <div class="user-status-row">
            <span class="status-indicator-dot"></span>
            <span class="role-badge font-mono">{getLevelShortTag($auth.user?.role, $auth.user?.securityLevel)}</span>
          </div>
        </div>
      </div>
      <div class="footer-actions">
        <a href="/security" class="btn btn-secondary btn-xs" style="flex: 1; text-align: center;">Security</a>
        <button class="btn btn-secondary btn-xs logout-btn" on:click={auth.logout}>Sign Out</button>
      </div>
    {:else}
      <a href="/login" class="btn btn-primary btn-sm login-btn">
        Access Workstation
      </a>
    {/if}
  </div>
</aside>

<style>
  .workstation-sidebar {
    width: 260px;
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: sticky;
    top: 0;
    z-index: 50;
  }

  .sidebar-brand {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .brand-link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    text-decoration: none;
  }

  .brand-emblem {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid var(--accent-cyan);
    color: var(--accent-cyan);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.2);
  }

  .brand-text {
    display: flex;
    flex-direction: column;
  }

  .brand-title {
    font-size: 1.125rem;
    font-weight: 800;
    color: var(--text-primary);
    letter-spacing: 0.05em;
  }

  .brand-sub {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.1em;
  }

  .sidebar-nav {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem 0.875rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-section-label {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    padding: 0.75rem 0.6rem 0.35rem;
    margin-top: 0.5rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    border-radius: 6px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.15s ease;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    text-align: left;
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-card);
    border-color: rgba(255, 255, 255, 0.05);
  }

  .nav-item.active {
    color: var(--accent-cyan);
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.3);
    font-weight: 600;
  }

  .ai-nav-btn {
    width: 100%;
    justify-content: flex-start;
  }

  .nav-badge-cyan {
    margin-left: auto;
    font-size: 0.5625rem;
    font-weight: 800;
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--accent-cyan);
    border: 1px solid var(--accent-cyan);
  }

  .sidebar-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border-color);
    background-color: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .user-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.75rem;
    color: var(--accent-cyan);
  }

  .user-details {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .user-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .user-status-row {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .status-indicator-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--color-success);
    box-shadow: 0 0 6px var(--color-success);
  }

  .role-badge {
    font-size: 0.5625rem;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.04em;
  }

  .footer-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-xs { font-size: 0.6875rem; padding: 0.25rem 0.5rem; border-radius: 4px; }
  .logout-btn, .login-btn { width: 100%; text-align: center; }
</style>
