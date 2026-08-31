<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client.js';

  export let isOpen = false;
  export let onClose = () => {};

  let notifications = [];
  let loading = false;

  export async function loadNotifications() {
    loading = true;
    try {
      const res = await api.get('/notifications');
      if (res && res.success) {
        notifications = res.data;
      }
    } catch {
      notifications = [];
    } finally {
      loading = false;
    }
  }

  function handleNavigate(caseId) {
    onClose();
    if (caseId) {
      goto(`/cases/${caseId}`);
    }
  }

  onMount(() => {
    loadNotifications();
  });
</script>

{#if isOpen}
  <div
    class="drawer-backdrop"
    role="presentation"
    on:click|self={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div class="drawer-panel">
      <div class="drawer-header">
        <div class="header-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <h3>Investigation Event Feed</h3>
        </div>
        <button class="close-btn" on:click={onClose}>✕</button>
      </div>

      <div class="drawer-content">
        {#if loading}
          <div class="spinner-box">
            <div class="spinner"></div>
            <p>Fetching real-time audit event feed...</p>
          </div>
        {:else if notifications.length === 0}
          <div class="empty-box">
            <p>No recent case events or notifications.</p>
          </div>
        {:else}
          <div class="feed-list">
            {#each notifications as n}
              <div
                class="feed-card feed-{n.type}"
                role="button"
                tabindex="0"
                on:click={() => handleNavigate(n.caseId)}
                on:keydown={(e) => e.key === 'Enter' && handleNavigate(n.caseId)}
              >
                <div class="feed-top">
                  <span class="feed-action font-mono">{n.action}</span>
                  <span class="feed-time">{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div class="feed-title">{n.title}</div>
                <div class="feed-meta">
                  <span>Actor: <strong>{n.actor}</strong></span>
                  {#if n.caseTitle}
                    <span>• Case: <em>{n.caseTitle}</em></span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 9998;
    display: flex;
    justify-content: flex-end;
  }

  .drawer-panel {
    background-color: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
    width: 100%;
    max-width: 420px;
    height: 100%;
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.8);
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--accent-cyan);
  }

  .header-title h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .feed-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feed-card {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.875rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .feed-card:hover {
    border-color: var(--accent-cyan);
    background-color: var(--bg-card);
  }

  .feed-success { border-left: 3px solid var(--color-success); }
  .feed-warning { border-left: 3px solid var(--color-warning); }
  .feed-primary { border-left: 3px solid var(--accent-blue); }
  .feed-info { border-left: 3px solid var(--accent-cyan); }

  .feed-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .feed-action {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  .feed-time {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .feed-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.35rem;
  }

  .feed-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .spinner-box, .empty-box {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-secondary);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin: 0 auto 0.5rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .font-mono {
    font-family: var(--font-mono);
  }
</style>
