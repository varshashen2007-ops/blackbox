<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import NotificationCenter from '$lib/components/NotificationCenter.svelte';
  import AiInvestigatorDrawer from '$lib/components/AiInvestigatorDrawer.svelte';

  let paletteOpen = false;
  let notifOpen = false;
  let aiOpen = false;
  let aiCaseId = null;
  let aiCaseTitle = 'Active Investigation';

  // Derive caseId from the current URL if we're on a case page
  $: {
    const match = $page.url.pathname.match(/^\/cases\/([^/]+)/);
    if (match) {
      aiCaseId = match[1];
    } else {
      aiCaseId = null;
    }
  }

  onMount(async () => {
    const token = api.getToken();
    if (token) {
      try {
        const res = await api.get('/auth/me');
        if (res && res.success && res.data) {
          auth.setUser(res.data.user);
        }
      } catch {
        auth.logout();
      }
    } else {
      auth.setLoading(false);
    }
  });

  // Check if we are on an auth-only page (no shell)
  $: isAuthPage = $page.url.pathname === '/login' || $page.url.pathname === '/register';
</script>

{#if isAuthPage}
  <slot />
{:else}
  <div class="workstation-shell">
    <!-- Left Sidebar -->
    <Sidebar onOpenAi={() => { aiOpen = true; }} />

    <!-- Main Content Area -->
    <div class="shell-body">
      <!-- Top Bar -->
      <header class="shell-topbar">
        <div class="topbar-left">
          <button
            class="search-pill"
            on:click={() => { paletteOpen = true; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <span>Search cases, evidence, hypotheses...</span>
            <kbd class="kbd-hint">Ctrl K</kbd>
          </button>
        </div>

        <div class="topbar-right">
          <!-- System Status Badge -->
          <div class="system-status">
            <span class="dot dot-online"></span>
            <span class="status-text">SYSTEM SECURE</span>
          </div>

          <!-- Notification Bell -->
          <button
            class="icon-btn"
            on:click={() => { notifOpen = !notifOpen; }}
            title="Investigation Event Feed"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>

          <!-- AI Investigator Button -->
          <button
            class="ai-trigger-btn"
            on:click={() => { aiOpen = !aiOpen; }}
            title="Open AI Cyber Investigator"
          >
            <span class="ai-dot"></span>
            <span>AI Investigator</span>
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <main class="shell-main">
        <slot />
      </main>
    </div>
  </div>

  <!-- Drawers & Modals -->
  <CommandPalette bind:isOpen={paletteOpen} onClose={() => { paletteOpen = false; }} />
  <NotificationCenter bind:isOpen={notifOpen} onClose={() => { notifOpen = false; }} />
  <AiInvestigatorDrawer
    bind:isOpen={aiOpen}
    {aiCaseId}
    caseId={aiCaseId}
    caseTitle={aiCaseTitle}
    onClose={() => { aiOpen = false; }}
  />
{/if}

<style>
  /* ============================================================
     DESIGN SYSTEM TOKENS
  ============================================================ */
  :global(:root) {
    --bg-primary: #07090e;
    --bg-secondary: #0d1117;
    --bg-card: #161b22;
    --bg-elevated: #21262d;
    --border-color: #30363d;
    --border-light: #3d444d;

    --text-primary: #e6edf3;
    --text-secondary: #7d8590;
    --text-muted: #484f58;

    --accent-blue: #3b82f6;
    --accent-blue-hover: #2563eb;
    --accent-cyan: #00e5ff;

    --color-success: #3fb950;
    --color-warning: #d29922;
    --color-danger: #f85149;
    --color-verified: #1f6feb;

    --font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;

    --sidebar-width: 260px;
    --topbar-height: 52px;
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
    -moz-osx-font-smoothing: grayscale;
  }

  :global(::-webkit-scrollbar) { width: 5px; height: 5px; }
  :global(::-webkit-scrollbar-track) { background: var(--bg-primary); }
  :global(::-webkit-scrollbar-thumb) { background: var(--border-color); border-radius: 3px; }
  :global(::-webkit-scrollbar-thumb:hover) { background: var(--border-light); }

  /* ============================================================
     SHELL LAYOUT
  ============================================================ */
  .workstation-shell {
    display: flex;
    min-height: 100vh;
    width: 100%;
    background-color: var(--bg-primary);
  }

  .shell-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }

  /* ============================================================
     TOP BAR
  ============================================================ */
  .shell-topbar {
    height: var(--topbar-height);
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1.5rem;
    gap: 1rem;
    position: sticky;
    top: 0;
    z-index: 40;
  }

  .topbar-left {
    flex: 1;
    max-width: 480px;
  }

  .search-pill {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.45rem 0.875rem;
    color: var(--text-muted);
    font-size: 0.8125rem;
    cursor: pointer;
    width: 100%;
    text-align: left;
    transition: all 0.15s ease;
  }

  .search-pill:hover {
    border-color: var(--accent-cyan);
    color: var(--text-secondary);
  }

  .search-pill span {
    flex: 1;
    font-size: 0.8125rem;
  }

  .kbd-hint {
    background-color: var(--bg-elevated);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 0.1rem 0.35rem;
    font-size: 0.625rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
    white-space: nowrap;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .system-status {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .dot-online {
    background-color: var(--color-success);
    box-shadow: 0 0 6px var(--color-success);
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--color-success); }
    50% { opacity: 0.7; box-shadow: 0 0 12px var(--color-success); }
  }

  .status-text {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-success);
    letter-spacing: 0.05em;
  }

  .icon-btn {
    background: none;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-light);
    background-color: var(--bg-card);
  }

  .ai-trigger-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: rgba(0, 229, 255, 0.08);
    border: 1px solid rgba(0, 229, 255, 0.3);
    color: var(--accent-cyan);
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ai-trigger-btn:hover {
    background-color: rgba(0, 229, 255, 0.15);
    border-color: var(--accent-cyan);
    box-shadow: 0 0 12px rgba(0, 229, 255, 0.2);
  }

  .ai-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: var(--accent-cyan);
    box-shadow: 0 0 6px var(--accent-cyan);
    animation: pulse-glow-cyan 2.5s ease-in-out infinite;
  }

  @keyframes pulse-glow-cyan {
    0%, 100% { opacity: 1; box-shadow: 0 0 6px var(--accent-cyan); }
    50% { opacity: 0.6; box-shadow: 0 0 14px var(--accent-cyan); }
  }

  /* ============================================================
     MAIN CONTENT ZONE
  ============================================================ */
  .shell-main {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
  }

  /* ============================================================
     GLOBAL UTILITY CLASSES
  ============================================================ */
  :global(.btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
    font-family: inherit;
  }

  :global(.btn-sm) {
    padding: 0.35rem 0.75rem;
    font-size: 0.8125rem;
  }

  :global(.btn-xs) {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  :global(.btn-primary) {
    background-color: var(--accent-blue);
    color: white;
    border-color: var(--accent-blue);
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
    border-color: var(--border-light);
  }

  :global(.btn-danger) {
    background-color: rgba(248, 81, 73, 0.15);
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  :global(.btn-danger:hover) {
    background-color: rgba(248, 81, 73, 0.25);
  }

  :global(.btn-success) {
    background-color: rgba(63, 185, 80, 0.15);
    color: var(--color-success);
    border-color: var(--color-success);
  }

  :global(.btn-success:hover) {
    background-color: rgba(63, 185, 80, 0.25);
  }

  :global(.btn:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }

  :global(.card) {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.5rem;
  }

  :global(.font-mono) {
    font-family: var(--font-mono);
  }

  :global(.text-muted) {
    color: var(--text-muted);
  }

  :global(.text-secondary) {
    color: var(--text-secondary);
  }

  :global(.badge-status-draft)    { background: rgba(125, 133, 144, 0.15); color: #7d8590; border: 1px solid #30363d; }
  :global(.badge-status-active)   { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border: 1px solid rgba(63, 185, 80, 0.4); }
  :global(.badge-status-under_review) { background: rgba(210, 153, 34, 0.15); color: var(--color-warning); border: 1px solid rgba(210, 153, 34, 0.4); }
  :global(.badge-status-closed)   { background: rgba(248, 81, 73, 0.15); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.4); }
  :global(.badge-status-archived) { background: rgba(125, 133, 144, 0.08); color: #484f58; border: 1px solid #21262d; }

  :global(.badge-verified)   { background: rgba(31, 111, 235, 0.15); color: #58a6ff; border: 1px solid rgba(31, 111, 235, 0.4); }
  :global(.badge-pending)    { background: rgba(210, 153, 34, 0.15); color: var(--color-warning); border: 1px solid rgba(210, 153, 34, 0.4); }
  :global(.badge-unverified) { background: rgba(125, 133, 144, 0.1); color: var(--text-muted); border: 1px solid var(--border-color); }
  :global(.badge-rejected)   { background: rgba(248, 81, 73, 0.1); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.4); }

  :global(.status-badge) {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.55rem;
    border-radius: 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }
</style>
