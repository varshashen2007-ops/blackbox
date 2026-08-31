<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';

  const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:5000/api/v1';

  function handleGoogleOAuth() {
    window.location.href = `${API_BASE}/auth/google`;
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
        <p class="verify-sub">Verify your investigator identity through Google OAuth 2.0 to access the BlackBox platform.</p>
      </div>
    </div>

    <div class="oauth-box">
      <div class="oauth-active-badge font-mono">SERVER-SIDE GOOGLE OAUTH 2.0 / OIDC</div>
      <p style="color: var(--text-secondary); font-size: 0.875rem; line-height: 1.5;">
        Click below to securely authenticate with your Google account. Your identity claims will be cryptographically verified server-side.
      </p>

      <button
        type="button"
        class="google-oauth-btn font-mono"
        on:click={handleGoogleOAuth}
      >
        <svg class="google-icon" width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
        </svg>
        <span>Continue with Google</span>
      </button>

      <div class="divider">
        <span>or</span>
      </div>

      <a href="/login" class="btn btn-secondary" style="width: 100%; text-align: center;">
        Return to Standard Login
      </a>
    </div>

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

  .oauth-box {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .oauth-active-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.6rem;
    border-radius: 4px;
    display: inline-block;
    width: fit-content;
    background-color: rgba(63, 185, 80, 0.15);
    color: var(--color-success);
    border: 1px solid rgba(63, 185, 80, 0.4);
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
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
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
