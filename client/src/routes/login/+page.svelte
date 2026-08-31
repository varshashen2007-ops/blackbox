<script>
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';
  import { goto } from '$app/navigation';

  let isRegister = false;
  let name = '';
  let email = '';
  let password = '';
  let role = 'investigator';
  let loading = false;
  let errorMessage = '';

  async function handleSubmit() {
    errorMessage = '';
    loading = true;

    try {
      let res;
      if (isRegister) {
        res = await api.post('/auth/register', { name, email, password, role });
      } else {
        res = await api.post('/auth/login', { email, password });
      }

      if (res && res.success && res.data) {
        api.setToken(res.data.tokens.accessToken);
        api.setRefreshToken(res.data.tokens.refreshToken);
        auth.setUser(res.data.user);
        goto('/cases');
      }
    } catch (err) {
      errorMessage = err.message || 'Authentication failed. Please check your credentials.';
    } finally {
      loading = false;
    }
  }

  function fillSynthetic(userEmail, userPass) {
    email = userEmail;
    password = userPass;
    isRegister = false;
  }
</script>

<div class="auth-wrapper">
  <div class="auth-card">
    <div class="auth-header">
      <div class="auth-badge">{isRegister ? 'JOIN INVESTIGATION UNIT' : 'SECURE ACCESS'}</div>
      <h2>{isRegister ? 'Register Investigator' : 'Sign In to BlackBox'}</h2>
      <p class="auth-subtext">
        {isRegister
          ? 'Create your credentials to access case files and intelligence boards.'
          : 'Enter your credentials to access the case management system.'}
      </p>
    </div>

    {#if errorMessage}
      <div class="alert alert-danger">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <form on:submit|preventDefault={handleSubmit} class="auth-form">
      {#if isRegister}
        <div class="form-group">
          <label for="name">Full Name</label>
          <input
            id="name"
            type="text"
            bind:value={name}
            placeholder="Agent Fox Mulder"
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
        <div class="form-group">
          <label for="role">Requested Role</label>
          <select id="role" bind:value={role} class="form-input">
            <option value="investigator">Investigator (Case & Evidence author)</option>
            <option value="supervisor">Supervisor (Verification & Lifecycle authority)</option>
            <option value="admin">Administrator (System & User Oversight)</option>
          </select>
        </div>
      {/if}

      <button type="submit" class="btn btn-primary btn-block" disabled={loading}>
        {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Authenticate'}
      </button>
    </form>

    <div class="toggle-mode">
      {#if isRegister}
        <span>Already have credentials?</span>
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
      <div class="seed-label">Synthetic Dev Test Accounts (dev seed):</div>
      <div class="seed-chips">
        <button
          type="button"
          class="seed-chip"
          on:click={() => fillSynthetic('admin@blackbox.local', 'Password123!')}
        >
          Admin
        </button>
        <button
          type="button"
          class="seed-chip"
          on:click={() => fillSynthetic('supervisor@blackbox.local', 'Password123!')}
        >
          Supervisor
        </button>
        <button
          type="button"
          class="seed-chip"
          on:click={() => fillSynthetic('investigator@blackbox.local', 'Password123!')}
        >
          Investigator
        </button>
      </div>
    </div>
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
    border-radius: 10px;
    padding: 2.25rem;
    max-width: 440px;
    width: 100%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  }

  .auth-header {
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .auth-badge {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--accent-cyan);
    background-color: rgba(6, 182, 212, 0.1);
    border: 1px solid rgba(6, 182, 212, 0.3);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .auth-header h2 {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .auth-subtext {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
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
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;
  }

  .form-input:focus {
    border-color: var(--accent-blue);
  }

  .btn-block {
    width: 100%;
    padding: 0.65rem;
    margin-top: 0.5rem;
  }

  .alert {
    padding: 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
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
    margin-top: 1.75rem;
    padding-top: 1.25rem;
    border-top: 1px dashed var(--border-color);
    text-align: center;
  }

  .seed-label {
    font-size: 0.75rem;
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
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .seed-chip:hover {
    background-color: var(--bg-elevated);
    color: var(--text-primary);
    border-color: var(--accent-blue);
  }
</style>
