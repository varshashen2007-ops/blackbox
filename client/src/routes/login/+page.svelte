<script>
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';
  import { goto } from '$app/navigation';

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

  function fillSynthetic(userEmail, userPass) {
    email = userEmail;
    password = userPass;
    isRegister = false;
    mfaRequired = false;
    errorMessage = '';
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

      <div class="synthetic-seeds">
        <div class="seed-label font-mono">SYNTHETIC TEST CREDENTIALS (DEV):</div>
        <div class="seed-chips">
          <button
            type="button"
            class="seed-chip"
            on:click={() => fillSynthetic('admin@blackbox.local', 'Password123!')}
          >
            Admin (L3)
          </button>
          <button
            type="button"
            class="seed-chip"
            on:click={() => fillSynthetic('supervisor@blackbox.local', 'Password123!')}
          >
            Supervisor (L2)
          </button>
          <button
            type="button"
            class="seed-chip"
            on:click={() => fillSynthetic('investigator@blackbox.local', 'Password123!')}
          >
            Investigator (L1)
          </button>
        </div>
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

  .synthetic-seeds {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px dashed var(--border-color);
    text-align: center;
  }

  .seed-label {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .seed-chips {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }

  .seed-chip {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .seed-chip:hover {
    background-color: var(--bg-elevated);
    color: var(--text-primary);
    border-color: var(--accent-cyan);
  }
</style>
