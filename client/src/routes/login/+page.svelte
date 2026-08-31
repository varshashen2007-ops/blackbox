<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let isRegister = false;
  let name = '';
  let email = '';
  let password = '';
  let loading = false;
  let errorMessage = '';

  // MFA Challenge State
  let mfaRequired = false;
  let tempChallengeToken = '';
  let mfaCode = '';
  let mfaMessage = '';

  const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  onMount(async () => {
    // Check for OAuth callback parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const accessToken = urlParams.get('accessToken');
    const refreshToken = urlParams.get('refreshToken');
    const oauthError = urlParams.get('error');

    if (oauthError) {
      handleOAuthError(oauthError);
    } else if (oauthSuccess === 'true' && accessToken) {
      loading = true;
      try {
        api.setToken(accessToken);
        if (refreshToken) {
          api.setRefreshToken(refreshToken);
        }
        const meRes = await api.get('/auth/me');
        if (meRes?.success && meRes?.data?.user) {
          auth.setUser(meRes.data.user);
          goto('/cases');
        } else {
          goto('/cases');
        }
      } catch (err) {
        errorMessage = 'Failed to finalize Google session. Please sign in again.';
      } finally {
        loading = false;
      }
    }
  });

  function handleOAuthError(code) {
    switch (code) {
      case 'oauth_denied':
        errorMessage = 'Google authentication was cancelled by user.';
        break;
      case 'oauth_state_invalid':
      case 'oauth_state_expired':
      case 'oauth_state_missing':
        errorMessage = 'Security validation failed (OAuth state mismatch/expired). Please try again.';
        break;
      case 'oauth_exchange_failed':
        errorMessage = 'Failed to exchange authorization token with Google.';
        break;
      case 'oauth_account_conflict':
        errorMessage = 'Account is already linked to a different identity.';
        break;
      case 'account_suspended':
      case 'account_revoked':
        errorMessage = 'Your BlackBox account is suspended or revoked. Contact an administrator.';
        break;
      default:
        errorMessage = 'Google OAuth authentication failed. Please try again or use credentials.';
        break;
    }
  }

  function handleGoogleLogin() {
    window.location.href = `${API_BASE}/auth/google`;
  }

  async function handleSubmit() {
    errorMessage = '';
    loading = true;

    try {
      if (isRegister) {
        // Public registration creates an Investigator (Level 1)
        const res = await api.post('/auth/register', { name, email, password });
        if (res && res.success && res.data) {
          api.setToken(res.data.tokens.accessToken);
          api.setRefreshToken(res.data.tokens.refreshToken);
          auth.setUser(res.data.user);
          goto('/cases');
        }
      } else {
        // Standard login
        const res = await api.post('/auth/login', { email, password });

        if (res && res.success && res.data) {
          // Check if MFA challenge was triggered
          if (res.data.mfaRequired) {
            mfaRequired = true;
            tempChallengeToken = res.data.tempToken;
            mfaMessage = res.data.message || 'Enter 6-digit authentication code';
            return;
          }

          api.setToken(res.data.tokens.accessToken);
          api.setRefreshToken(res.data.tokens.refreshToken);
          auth.setUser(res.data.user);
          goto('/cases');
        }
      }
    } catch (err) {
      errorMessage = err.message || 'Authentication failed. Please check your credentials.';
    } finally {
      loading = false;
    }
  }

  async function handleMfaSubmit() {
    errorMessage = '';
    loading = true;

    try {
      const res = await api.post('/auth/login/mfa', {
        tempToken: tempChallengeToken,
        code: mfaCode.trim()
      });

      if (res && res.success && res.data) {
        api.setToken(res.data.tokens.accessToken);
        api.setRefreshToken(res.data.tokens.refreshToken);
        auth.setUser(res.data.user);
        goto('/cases');
      }
    } catch (err) {
      errorMessage = err.message || 'Invalid multi-factor authentication code.';
    } finally {
      loading = false;
    }
  }

  function resetMfa() {
    mfaRequired = false;
    tempChallengeToken = '';
    mfaCode = '';
    errorMessage = '';
  }
</script>

<div class="auth-wrapper">
  <div class="auth-card">
    <!-- Header -->
    <div class="auth-header">
      <div class="auth-badge font-mono">
        {mfaRequired ? 'STEP 2: MULTI-FACTOR CHALLENGE' : isRegister ? 'LEVEL 1 INVESTIGATOR ONBOARDING' : 'SECURE FORENSIC ACCESS'}
      </div>
      <h2>
        {mfaRequired ? 'Enter Security Code' : isRegister ? 'Register Investigator Account' : 'Sign In to BlackBox'}
      </h2>
      <p class="auth-subtext">
        {mfaRequired
          ? 'Enter the 6-digit TOTP code from your mobile authenticator app.'
          : isRegister
          ? 'Initialize a Level 1 Investigator identity to access case files and intelligence boards.'
          : 'Enter your credentials to access the digital evidence workstation.'}
      </p>
    </div>

    {#if errorMessage}
      <div class="alert alert-danger font-mono">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{errorMessage}</span>
      </div>
    {/if}

    {#if mfaRequired}
      <!-- MFA Challenge Form -->
      <form on:submit|preventDefault={handleMfaSubmit} class="auth-form">
        <div class="form-group">
          <label for="mfaCode">6-Digit Authenticator Code</label>
          <input
            id="mfaCode"
            type="text"
            bind:value={mfaCode}
            placeholder="123456"
            maxlength="6"
            pattern="[0-9]{6}"
            required
            class="form-input font-mono mfa-input"
            autofocus
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" disabled={loading || mfaCode.trim().length !== 6}>
          {loading ? 'Verifying...' : 'Complete Authentication'}
        </button>

        <button type="button" class="btn btn-secondary btn-block" on:click={resetMfa}>
          ← Back to Password Login
        </button>
      </form>
    {:else}
      <!-- Google OAuth Button -->
      <button
        type="button"
        class="google-oauth-btn font-mono"
        on:click={handleGoogleLogin}
        disabled={loading}
      >
        <svg class="google-icon" width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <div class="auth-divider font-mono">
        <span>OR AUTHENTICATE WITH CREDENTIALS</span>
      </div>

      <!-- Standard / Registration Form -->
      <form on:submit|preventDefault={handleSubmit} class="auth-form">
        {#if isRegister}
          <div class="form-group">
            <label for="name">Full Name</label>
            <input
              id="name"
              type="text"
              bind:value={name}
              placeholder="e.g. Varsha Shenoy"
              required
              class="form-input"
            />
          </div>
        {/if}

        <div class="form-group">
          <label for="email">Email Address</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="investigator@blackbox.local"
            required
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="••••••••••••"
            required
            minlength="6"
            class="form-input"
          />
        </div>

        {#if isRegister}
          <div class="role-notice-card">
            <div class="role-notice-icon">🛡️</div>
            <div class="role-notice-text">
              <strong>Assigned Access: Level 1 (Investigator)</strong>
              <p>Higher supervisory authority requires explicit invitation or administrative credential approval.</p>
            </div>
          </div>
        {/if}

        <button type="submit" class="btn btn-primary btn-block" disabled={loading}>
          {loading ? 'Authenticating...' : isRegister ? 'Create Investigator Account' : 'Authenticate'}
        </button>
      </form>

      <div class="toggle-mode">
        {#if isRegister}
          <span>Already registered?</span>
          <button type="button" class="link-btn" on:click={() => { isRegister = false; errorMessage = ''; }}>
            Sign In
          </button>
        {:else}
          <span>Need an investigator account?</span>
          <button type="button" class="link-btn" on:click={() => { isRegister = true; errorMessage = ''; }}>
            Register
          </button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .auth-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 3rem 1rem;
  }

  .auth-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 2.25rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
  }

  .auth-header {
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .auth-badge {
    display: inline-block;
    font-size: 0.5625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent-cyan);
    background-color: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.3);
    padding: 0.2rem 0.55rem;
    border-radius: 4px;
    margin-bottom: 0.6rem;
  }

  .auth-header h2 {
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .auth-subtext {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-top: 0.35rem;
    line-height: 1.4;
  }

  .google-oauth-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: #ffffff;
    color: #1f2937;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 0.65rem 1rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .google-oauth-btn:hover {
    background-color: #f3f4f6;
    border-color: #9ca3af;
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
  }

  .google-oauth-btn:active {
    transform: translateY(0);
  }

  .google-icon {
    flex-shrink: 0;
  }

  .auth-divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 1.25rem 0;
    color: var(--text-muted);
    font-size: 0.625rem;
    letter-spacing: 0.05em;
  }

  .auth-divider::before,
  .auth-divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border-color);
  }

  .auth-divider span {
    padding: 0 0.75rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.15rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .form-group label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .form-input {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.65rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    border-color: var(--accent-cyan);
  }

  .mfa-input {
    font-size: 1.5rem;
    letter-spacing: 0.3em;
    text-align: center;
    padding: 0.75rem;
  }

  .role-notice-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background-color: rgba(0, 229, 255, 0.04);
    border: 1px solid rgba(0, 229, 255, 0.2);
    border-radius: 8px;
    padding: 0.75rem;
  }

  .role-notice-icon { font-size: 1.25rem; }

  .role-notice-text strong {
    font-size: 0.75rem;
    color: var(--accent-cyan);
    display: block;
  }

  .role-notice-text p {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 0.15rem;
    line-height: 1.3;
  }

  .btn-block {
    width: 100%;
    padding: 0.65rem;
    margin-top: 0.25rem;
  }

  .alert {
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .alert-danger {
    background-color: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .toggle-mode {
    margin-top: 1.5rem;
    text-align: center;
    font-size: 0.8125rem;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: var(--accent-cyan);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8125rem;
    text-decoration: underline;
  }
</style>
