<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client.js';

  export let isOpen = false;
  export let onClose = () => {};

  let searchQuery = '';
  let searchResults = { cases: [], evidence: [], hypotheses: [], totalMatches: 0 };
  let loading = false;
  let debounceTimer;

  function handleKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isOpen = !isOpen;
      if (isOpen) {
        setTimeout(() => {
          document.getElementById('command-palette-input')?.focus();
        }, 50);
      }
    } else if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  }

  function handleInput() {
    clearTimeout(debounceTimer);
    if (!searchQuery.trim()) {
      searchResults = { cases: [], evidence: [], hypotheses: [], totalMatches: 0 };
      return;
    }

    loading = true;
    debounceTimer = setTimeout(async () => {
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res && res.success) {
          searchResults = res.data;
        }
      } catch {
        searchResults = { cases: [], evidence: [], hypotheses: [], totalMatches: 0 };
      } finally {
        loading = false;
      }
    }, 250);
  }

  function navigateTo(url) {
    onClose();
    goto(url);
  }

  onMount(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

{#if isOpen}
  <div
    class="palette-backdrop"
    role="presentation"
    on:click|self={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div class="palette-container">
      <div class="palette-search-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          id="command-palette-input"
          type="text"
          bind:value={searchQuery}
          on:input={handleInput}
          placeholder="Search cases, evidence artifacts, hypotheses, tags... (Esc to exit)"
          autocomplete="off"
        />
        {#if loading}
          <div class="palette-spinner"></div>
        {/if}
      </div>

      <div class="palette-results">
        {#if !searchQuery.trim()}
          <div class="palette-hint">
            <p class="hint-title">Quick Actions & Navigation</p>
            <div class="quick-links">
              <button class="quick-link-btn" on:click={() => navigateTo('/cases')}>
                <span>📁</span> Browse All Cases
              </button>
              <button class="quick-link-btn" on:click={() => navigateTo('/admin/audit-logs')}>
                <span>📜</span> System Audit Logs
              </button>
            </div>
          </div>
        {:else if searchResults.totalMatches === 0 && !loading}
          <div class="palette-empty">
            <p>No matching investigation artifacts found for "{searchQuery}".</p>
          </div>
        {:else}
          <!-- Cases -->
          {#if searchResults.cases && searchResults.cases.length > 0}
            <div class="result-group">
              <div class="group-header">CASES ({searchResults.cases.length})</div>
              {#each searchResults.cases as c}
                <div class="result-item" role="button" tabindex="0" on:click={() => navigateTo(c.url)} on:keydown={(e) => e.key === 'Enter' && navigateTo(c.url)}>
                  <div class="item-icon">📁</div>
                  <div class="item-info">
                    <span class="item-title">{c.title}</span>
                    <span class="item-sub">Priority: {c.priority} • Status: {c.status}</span>
                  </div>
                  <span class="item-badge">{c.status.toUpperCase()}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Evidence -->
          {#if searchResults.evidence && searchResults.evidence.length > 0}
            <div class="result-group">
              <div class="group-header">EVIDENCE ARTIFACTS ({searchResults.evidence.length})</div>
              {#each searchResults.evidence as e}
                <div class="result-item" role="button" tabindex="0" on:click={() => navigateTo(e.url)} on:keydown={(ev) => ev.key === 'Enter' && navigateTo(e.url)}>
                  <div class="item-icon">🔬</div>
                  <div class="item-info">
                    <span class="item-title">{e.title}</span>
                    <span class="item-sub">Type: {e.type} • Case: {e.caseTitle}</span>
                  </div>
                  <span class="item-badge badge-cyan">{e.verificationStatus.toUpperCase()}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Hypotheses -->
          {#if searchResults.hypotheses && searchResults.hypotheses.length > 0}
            <div class="result-group">
              <div class="group-header">COMPETING HYPOTHESES ({searchResults.hypotheses.length})</div>
              {#each searchResults.hypotheses as h}
                <div class="result-item" role="button" tabindex="0" on:click={() => navigateTo(h.url)} on:keydown={(ev) => ev.key === 'Enter' && navigateTo(h.url)}>
                  <div class="item-icon">🧠</div>
                  <div class="item-info">
                    <span class="item-title">{h.title}</span>
                    <span class="item-sub">Confidence: {h.confidenceScore}% • Case: {h.caseTitle}</span>
                  </div>
                  <span class="item-badge badge-green">{h.confidenceScore}%</span>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .palette-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
  }

  .palette-container {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .palette-search-box {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
    gap: 0.75rem;
  }

  .search-icon {
    color: var(--accent-cyan);
  }

  .palette-search-box input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
  }

  .palette-results {
    max-height: 420px;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .result-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .group-header {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    padding: 0.25rem 0.5rem;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    background-color: var(--bg-primary);
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .result-item:hover {
    background-color: var(--bg-card);
    border-color: var(--accent-cyan);
    transform: translateX(2px);
  }

  .item-icon {
    font-size: 1.1rem;
  }

  .item-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    overflow: hidden;
  }

  .item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-sub {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .item-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background-color: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .badge-cyan {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--accent-cyan);
  }

  .badge-green {
    background-color: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
  }

  .palette-hint, .palette-empty {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--text-secondary);
  }

  .quick-links {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1rem;
  }

  .quick-link-btn {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .quick-link-btn:hover {
    border-color: var(--accent-cyan);
  }

  .palette-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
