<script>
  import { auth } from '$lib/stores/auth.js';
</script>

<div class="app-container">
  <header class="app-header">
    <div class="header-content">
      <div class="brand">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        </div>
        <span class="brand-name">BlackBox</span>
        <span class="badge">EVIDENCE INTELLIGENCE</span>
      </div>

      <nav class="nav-links">
        <a href="/" class="nav-item">Overview</a>
        <a href="/cases" class="nav-item">Cases</a>
        <a href="/admin" class="nav-item">Admin</a>
      </nav>

      <div class="auth-status">
        {#if $auth.isAuthenticated}
          <span class="user-greeting">{$auth.user?.name || 'Investigator'}</span>
          <button class="btn btn-secondary" on:click={auth.logout}>Sign Out</button>
        {:else}
          <a href="/login" class="btn btn-primary">Sign In</a>
        {/if}
      </div>
    </div>
  </header>

  <main class="main-content">
    <slot />
  </main>

  <footer class="app-footer">
    <div class="footer-content">
      <p>BlackBox Digital Evidence Investigation Platform • Audit Monitored</p>
    </div>
  </footer>
</div>

<style>
  :global(:root) {
    --bg-primary: #0a0e17;
    --bg-secondary: #111827;
    --bg-card: #1f2937;
    --bg-elevated: #374151;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --text-muted: #6b7280;
    --accent-blue: #3b82f6;
    --accent-blue-hover: #2563eb;
    --accent-cyan: #06b6d4;
    --border-color: #374151;
    --border-light: #4b5563;
    --color-success: #10b981;
    --color-warning: #f59e0b;
    --color-danger: #ef4444;
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background-color: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-sans);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .app-header {
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0.875rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .brand-icon {
    background: linear-gradient(135deg, #1e3a8a, #3b82f6);
    color: white;
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  .brand-name {
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: var(--text-primary);
  }

  .badge {
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background-color: rgba(59, 130, 246, 0.15);
    color: var(--accent-cyan);
    border: 1px solid rgba(6, 182, 212, 0.3);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .nav-item {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .nav-item:hover {
    color: var(--text-primary);
    background-color: var(--bg-card);
  }

  .auth-status {
    display: flex;
    align-items: center;
    gap: 0.875rem;
  }

  .user-greeting {
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  :global(.btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.45rem 0.9rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  :global(.btn-primary) {
    background-color: var(--accent-blue);
    color: white;
  }

  :global(.btn-primary:hover) {
    background-color: var(--accent-blue-hover);
  }

  :global(.btn-secondary) {
    background-color: var(--bg-card);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  :global(.btn-secondary:hover) {
    background-color: var(--bg-elevated);
  }

  .main-content {
    flex: 1;
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  .app-footer {
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
    padding: 1.25rem 1.5rem;
    margin-top: auto;
  }

  .footer-content {
    max-width: 1280px;
    margin: 0 auto;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>
