<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';

  let googleConfigStatus = null;
  let loading = true;
  let verifyLoading = false;
  let verifyError = null;
  let verifySuccess = false;

  let googleScriptLoaded = false;

  onMount(async () => {
    try {
      const res = await api.get('/auth/google/config');
      if (res?.success) googleConfigStatus = res.data;
    } catch { /* fail quietly */ }
    finally { loading = false; }

    // Load Google Identity Services script
    if (!document.getElementById('google-identity-script')) {
      const script = document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => { googleScriptLoaded = true; };
      document.head.appendChild(script);
    }
  });

  async function handleCredentialResponse(response) {
    verifyLoading = true;
    verifyError = null;

    try {
      // Decode email from JWT (header.payload.sig)
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const res = await api.post('/auth/google/verify', {
        credential: response.credential,
        email: payload.email,
        name: payload.name
      });

      if (res?.success) {
        auth.setUser(res.data.user);
        localStorage.setItem('bb_access_token', res.data.tokens.accessToken);
        if (res.data.tokens.refreshToken) {
          localStorage.setItem('bb_refresh_token', res.data.tokens.refreshToken);
        }
        verifySuccess = true;
        setTimeout(() => goto('/'), 1500);
      }
    } catch (err) {
      verifyError = err.message || 'Google identity verification failed.';
    } finally {
      verifyLoading = false;
    }
  }

  // Expose for GIS callback
  if (typeof window !== 'undefined') {
    window.handleGoogleCredentialResponse = handleCredentialResponse;
  }
</script>

<svelte:head>
  <title>Verify Identity — BlackBox</title>
</svelte:head>

<div class="verify-page">
  <div class="verify-card">
    <!-- Header -->
    <div class="verify-header">
      <div class="verify-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
      </div>
      <div>
        <h1>Identity Verification</h1>
        <p class="verify-sub">Verify your identity through Google to access the BlackBox investigation platform.</p>
      </div>
    </div>

    {#if loading}
      <div class="loading-box">
        <div class="spinner"></div>
        <p class="font-mono">Checking OAuth configuration...</p>
      </div>
    {:else if verifySuccess}
      <div class="success-box">
        <div class="success-icon">✓</div>
        <h2>Identity Verified</h2>
        <p>Google identity confirmed. Redirecting to investigation workstation...</p>
      </div>
    {:else if googleConfigStatus?.isConfigured === false}
      <div class="unconfigured-box">
        <div class="unc-badge font-mono">GOOGLE OAUTH: UNCONFIGURED</div>
        <h2>Google OAuth Not Configured</h2>
        <p>{googleConfigStatus.message}</p>
        <div class="config-instructions">
          <h4 class="font-mono">To enable, add to server/.env:</h4>
          <pre class="code-block font-mono">GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret</pre>
          <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.75rem;">
            Obtain credentials from <strong>Google Cloud Console → APIs & Services → OAuth 2.0 Client IDs</strong>.
          </p>
        </div>
        <div class="divider">
          <span>or sign in with credentials</span>
        </div>
        <a href="/login" class="btn btn-primary" style="width: 100%; text-align: center;">
          Sign In with BlackBox Credentials
        </a>
      </div>
    {:else if googleConfigStatus?.isConfigured}
      <div class="oauth-box">
        <div class="oauth-active-badge font-mono">GOOGLE OAUTH: ACTIVE</div>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.5rem;">
          Sign in with your Google account. Only verified accounts will be granted access.
        </p>

        {#if verifyError}
          <div class="error-box">{verifyError}</div>
        {/if}

        <!-- Google One Tap Button -->
        {#if googleConfigStatus.clientId}
          <div
            id="g_id_onload"
            data-client_id={googleConfigStatus.clientId}
            data-callback="handleGoogleCredentialResponse"
            data-auto_prompt="false"
          ></div>
          <div
            class="g_id_signin"
            data-type="standard"
            data-size="large"
            data-theme="filled_black"
            data-text="signin_with"
            data-shape="rectangular"
            data-logo_alignment="left"
            style="width: 100%;"
          ></div>
        {/if}

        <div class="divider">
          <span>or</span>
        </div>
        <a href="/login" class="btn btn-secondary" style="width: 100%; text-align: center;">
          Use BlackBox Investigator Credentials
        </a>
      </div>
    {:else}
      <div class="error-box">
        Unable to determine Google OAuth configuration status. Please try again or use standard login.
      </div>
      <a href="/login" class="btn btn-primary" style="width: 100%; margin-top: 1rem; text-align: center;">
        Standard Login
      </a>
    {/if}

    <div class="verify-footer">
      <p class="font-mono">BlackBox Identity Verification System</p>
      <p>All authentication events are recorded in the immutable audit log.</p>
    </div>
  </div>
</div>

<style>
  .verify-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background-color: var(--bg-primary);
  }

  .verify-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 14px;
    padding: 2.5rem;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  }

  .verify-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .verify-icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background-color: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.3);
    color: var(--accent-cyan);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .verify-header h1 {
    font-size: 1.375rem;
    font-weight: 800;
    margin-bottom: 0.25rem;
  }

  .verify-sub {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .loading-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .success-box {
    text-align: center;
    padding: 2rem;
    background-color: rgba(63, 185, 80, 0.1);
    border: 1px solid rgba(63, 185, 80, 0.4);
    border-radius: 8px;
  }

  .success-icon {
    font-size: 3rem;
    color: var(--color-success);
    margin-bottom: 0.75rem;
  }

  .success-box h2 { color: var(--color-success); font-size: 1.25rem; }
  .success-box p { color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.25rem; }

  .unconfigured-box, .oauth-box {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .unc-badge, .oauth-active-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
  }

  .unc-badge {
    background-color: rgba(210, 153, 34, 0.15);
    color: var(--color-warning);
    border: 1px solid rgba(210, 153, 34, 0.4);
  }

  .oauth-active-badge {
    background-color: rgba(63, 185, 80, 0.15);
    color: var(--color-success);
    border: 1px solid rgba(63, 185, 80, 0.4);
  }

  .config-instructions {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
  }

  .config-instructions h4 {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .code-block {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    font-size: 0.75rem;
    color: var(--accent-cyan);
    white-space: pre;
    overflow-x: auto;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .divider::before, .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: var(--border-color);
  }

  .error-box {
    background-color: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.4);
    color: var(--color-danger);
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .verify-footer {
    border-top: 1px solid var(--border-color);
    padding-top: 1rem;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
</style>
