<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';

  export let isOpen = false;
  export let caseId = null;
  export let caseTitle = 'Active Investigation';
  export let onClose = () => {};

  let messageInput = '';
  let messages = [
    {
      sender: 'ai',
      text: 'BlackBox Cyber Investigator ready. I can summarize evidence, evaluate hypothesis support/contradictions, identify conflicts, and recommend next forensic steps.',
      model: 'blackbox-forensic-engine'
    }
  ];
  let loading = false;
  let chatBox;

  async function sendMessage(textToSend = messageInput) {
    if (!textToSend.trim() || loading || !caseId) return;

    const userText = textToSend.trim();
    messageInput = '';

    messages = [
      ...messages,
      { sender: 'user', text: userText }
    ];

    loading = true;
    scrollToBottom();

    try {
      const res = await api.post(`/cases/${caseId}/ai/chat`, {
        message: userText,
        history: messages.slice(-6)
      });

      if (res && res.success) {
        messages = [
          ...messages,
          {
            sender: 'ai',
            text: res.data.response,
            model: res.data.model,
            disclaimer: res.data.disclaimer
          }
        ];
      }
    } catch (err) {
      messages = [
        ...messages,
        {
          sender: 'ai',
          text: `Analysis error: ${err.message || 'Unable to complete forensic query'}`,
          isError: true
        }
      ];
    } finally {
      loading = false;
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
      }
    }, 50);
  }

  function handleQuickPrompt(prompt) {
    sendMessage(prompt);
  }
</script>

{#if isOpen}
  <div
    class="ai-drawer-backdrop"
    role="presentation"
    on:click|self={onClose}
    on:keydown={(e) => e.key === 'Escape' && onClose()}
  >
    <div class="ai-drawer-panel">
      <!-- Header -->
      <div class="ai-drawer-header">
        <div class="header-left">
          <div class="ai-avatar">AI</div>
          <div>
            <h3>BlackBox AI Investigator</h3>
            <p class="text-muted" style="font-size: 0.75rem;">
              Context: <strong>{caseTitle}</strong>
            </p>
          </div>
        </div>
        <button class="close-btn" on:click={onClose}>✕</button>
      </div>

      <!-- Disclaimer Banner -->
      <div class="ai-disclaimer-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>AI-generated analysis. Verify conclusions against underlying verified evidence.</span>
      </div>

      <!-- Messages Body -->
      <div class="ai-chat-body" bind:this={chatBox}>
        {#each messages as msg}
          <div class="chat-message msg-{msg.sender}">
            <div class="message-bubble" class:bubble-error={msg.isError}>
              <div class="message-text">
                {@html msg.text.replace(/\n/g, '<br/>')}
              </div>
              {#if msg.model}
                <div class="message-meta font-mono">
                  Model: {msg.model}
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if loading}
          <div class="chat-message msg-ai">
            <div class="message-bubble">
              <div class="ai-typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Quick Action Prompts -->
      <div class="quick-prompts-bar">
        <button class="quick-pill" on:click={() => handleQuickPrompt('Summarize this investigation and key evidence.')}>
          📋 Summarize Case
        </button>
        <button class="quick-pill" on:click={() => handleQuickPrompt('What evidence supports the leading hypothesis?')}>
          🔍 Supporting Evidence
        </button>
        <button class="quick-pill" on:click={() => handleQuickPrompt('Are there any conflicting or contradictory evidence relationships?')}>
          ⚠️ Check Contradictions
        </button>
        <button class="quick-pill" on:click={() => handleQuickPrompt('What should the investigator review next?')}>
          💡 Next Steps
        </button>
      </div>

      <!-- Input Bar -->
      <form on:submit|preventDefault={() => sendMessage()} class="ai-input-form">
        <input
          type="text"
          bind:value={messageInput}
          placeholder={caseId ? "Ask AI Investigator about this case..." : "Select a case first..."}
          disabled={!caseId || loading}
          class="ai-text-input"
        />
        <button type="submit" class="btn btn-primary btn-sm" disabled={!caseId || loading || !messageInput.trim()}>
          Send
        </button>
      </form>
    </div>
  </div>
{/if}

<style>
  .ai-drawer-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    z-index: 9997;
    display: flex;
    justify-content: flex-end;
  }

  .ai-drawer-panel {
    background-color: var(--bg-secondary);
    border-left: 1px solid var(--border-color);
    width: 100%;
    max-width: 480px;
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

  .ai-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border-color);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ai-avatar {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-cyan));
    color: white;
    font-weight: 800;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ai-drawer-header h3 {
    font-size: 0.9375rem;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .ai-disclaimer-banner {
    background-color: rgba(6, 182, 212, 0.1);
    border-bottom: 1px solid rgba(6, 182, 212, 0.2);
    padding: 0.5rem 1rem;
    font-size: 0.6875rem;
    color: var(--accent-cyan);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ai-chat-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .chat-message {
    display: flex;
    flex-direction: column;
  }

  .msg-user {
    align-items: flex-end;
  }

  .msg-ai {
    align-items: flex-start;
  }

  .message-bubble {
    max-width: 90%;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    line-height: 1.5;
  }

  .msg-user .message-bubble {
    background-color: var(--accent-blue);
    color: white;
    border-bottom-right-radius: 2px;
  }

  .msg-ai .message-bubble {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    border-bottom-left-radius: 2px;
  }

  .bubble-error {
    background-color: rgba(239, 68, 68, 0.2) !important;
    border-color: var(--color-danger) !important;
    color: #fca5a5 !important;
  }

  .message-meta {
    font-size: 0.625rem;
    color: var(--text-muted);
    margin-top: 0.4rem;
  }

  .quick-prompts-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-primary);
  }

  .quick-pill {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.25rem 0.6rem;
    border-radius: 12px;
    font-size: 0.6875rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .quick-pill:hover {
    color: var(--accent-cyan);
    border-color: var(--accent-cyan);
  }

  .ai-input-form {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
  }

  .ai-text-input {
    flex: 1;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    outline: none;
    font-family: inherit;
  }

  .ai-text-input:focus {
    border-color: var(--accent-cyan);
  }

  .ai-typing {
    display: flex;
    gap: 4px;
    padding: 4px 2px;
  }

  .ai-typing span {
    width: 6px;
    height: 6px;
    background-color: var(--accent-cyan);
    border-radius: 50%;
    animation: bounce 1.2s infinite;
  }

  .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
  .ai-typing span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-6px); }
  }

  .font-mono {
    font-family: var(--font-mono);
  }
</style>
