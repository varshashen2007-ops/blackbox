<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/stores/auth.js';
  import { api } from '$lib/api/client.js';
  import { goto } from '$app/navigation';

  let user = null;
  let loading = true;
  let errorMsg = null;
  let successMsg = null;

  // Supervisor Request state
  let myRequest = null;
  let showRequestForm = false;
  let reqFullName = '';
  let reqOrg = '';
  let reqTitle = '';
  let reqProEmail = '';
  let reqReason = '';
  let reqCredRef = '';
  let submittingReq = false;

  // MFA Setup state
  let showMfaSetup = false;
  let mfaSecretData = null;
  let mfaVerifyCode = '';
  let verifyingMfa = false;
  let mfaError = null;

  onMount(async () => {
    if (!$auth.isAuthenticated) {
      goto('/login');
      return;
    }
    await loadSecurityProfile();
  });

  async function loadSecurityProfile() {
    loading = true;
    errorMsg = null;
    try {
      const [meRes, reqRes] = await Promise.allSettled([
        api.get('/auth/me'),
        api.get('/supervisor/my-request')
      ]);

      if (meRes.status === 'fulfilled' && meRes.value?.success) {
        user = meRes.value.data.user;
        auth.setUser(user);
        reqFullName = user.name || '';
        reqProEmail = user.email || '';
      }
      if (reqRes.status === 'fulfilled' && reqRes.value?.success) {
        myRequest = reqRes.value.data;
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to load security profile.';
    } finally {
      loading = false;
    }
  }

  async function handleVerifyEmail() {
    try {
      const res = await api.post('/auth/verify-email');
      if (res?.success) {
        successMsg = 'Email address marked as verified.';
        await loadSecurityProfile();
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to verify email.';
    }
  }

  async function handleStartMfaSetup() {
    mfaError = null;
    try {
      const res = await api.post('/auth/mfa/setup');
      if (res?.success) {
        mfaSecretData = res.data;
        showMfaSetup = true;
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to initiate MFA setup.';
    }
  }

  async function handleConfirmMfa() {
    mfaError = null;
    verifyingMfa = true;
    try {
      const res = await api.post('/auth/mfa/confirm', { code: mfaVerifyCode.trim() });
      if (res?.success) {
        showMfaSetup = false;
        mfaVerifyCode = '';
        mfaSecretData = null;
        successMsg = 'Multi-factor authentication (TOTP) successfully activated!';
        await loadSecurityProfile();
      }
    } catch (err) {
      mfaError = err.message || 'Invalid 6-digit MFA code.';
    } finally {
      verifyingMfa = false;
    }
  }

  async function handleSubmitSupervisorRequest() {
    errorMsg = null;
    submittingReq = true;
    try {
      const res = await api.post('/supervisor/request', {
        fullName: reqFullName,
        organization: reqOrg,
        professionalTitle: reqTitle,
        professionalEmail: reqProEmail,
        reason: reqReason,
        credentialReference: reqCredRef || undefined
      });

      if (res?.success) {
        showRequestForm = false;
        successMsg = 'Supervisor authority request submitted for administrative review.';
        await loadSecurityProfile();
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to submit supervisor request.';
    } finally {
      submittingReq = false;
    }
  }

  function getSecurityLevelBadge(level) {
    if (level === 3) return { text: 'LEVEL 3 — SYSTEM ADMINISTRATOR', class: 'badge-level-3' };
    if (level === 2) return { text: 'LEVEL 2 — INVESTIGATION SUPERVISOR', class: 'badge-level-2' };
    if (level === 1) return { text: 'LEVEL 1 — VERIFIED INVESTIGATOR', class: 'badge-level-1' };
    return { text: 'LEVEL 0 — UNVERIFIED ACCOUNT', class: 'badge-level-0' };
  }
</script>

<svelte:head>
  <title>Security & Identity Profile — BlackBox</title>
</svelte:head>

<div class="security-page">
  <div class="page-header">
    <div>
      <div class="eyebrow font-mono">CREDENTIAL & ACCESS CONTROL HUB</div>
      <h1>Security & Identity Profile</h1>
      <p class="subtitle">Multi-factor security posture, identity trust status, and credential verification records.</p>
    </div>

    {#if user}
      <div class="level-pill {getSecurityLevelBadge(user.securityLevel).class} font-mono">
        {getSecurityLevelBadge(user.securityLevel).text}
      </div>
    {/if}
  </div>

  {#if successMsg}
    <div class="alert alert-success">
      <span>✓ {successMsg}</span>
    </div>
  {/if}

  {#if errorMsg}
    <div class="alert alert-danger font-mono">
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if loading}
    <div class="loading-box">
      <div class="spinner"></div>
      <p class="font-mono">Loading cryptographic security credentials...</p>
    </div>
  {:else if user}
    <div class="profile-grid">

      <!-- Column 1: Identity & Account Status -->
      <div class="card">
        <div class="card-header">
          <h3>Identity Verification</h3>
          <span class="card-icon">🆔</span>
        </div>

        <div class="meta-list">
          <div class="meta-row">
            <span class="meta-label">Full Name:</span>
            <span class="meta-value font-bold">{user.name}</span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Primary Email:</span>
            <div class="meta-val-badge">
              <span class="font-mono">{user.email}</span>
              {#if user.emailVerified}
                <span class="badge-tag tag-success">Email Verified ✓</span>
              {:else}
                <button class="btn btn-secondary btn-xs" on:click={handleVerifyEmail}>Verify Email</button>
              {/if}
            </div>
          </div>

          <div class="meta-row">
            <span class="meta-label">Google Identity:</span>
            <div class="meta-val-badge">
              {#if user.identityVerified}
                <span class="badge-tag tag-success">Identity Verified ✓</span>
              {:else}
                <a href="/verify-identity" class="btn btn-secondary btn-xs">Verify via Google</a>
              {/if}
            </div>
          </div>

          <div class="meta-row">
            <span class="meta-label">Account Status:</span>
            <span class="status-badge badge-status-{user.status} font-mono">{user.status?.toUpperCase()}</span>
          </div>

          <div class="meta-row">
            <span class="meta-label">Assigned Role:</span>
            <span class="font-mono role-tag role-{user.role}">{user.role?.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <!-- Column 2: Multi-Factor Authentication (MFA) -->
      <div class="card">
        <div class="card-header">
          <h3>Multi-Factor Authentication (TOTP)</h3>
          <span class="card-icon">🔐</span>
        </div>

        <div class="mfa-status-box" class:mfa-active={user.mfaEnabled}>
          <div class="mfa-status-text">
            <span class="mfa-dot"></span>
            <strong>{user.mfaEnabled ? 'MFA ACTIVE & ENFORCED' : 'MFA NOT CONFIGURED'}</strong>
          </div>
          <p class="mfa-desc">
            {user.mfaEnabled
              ? 'Your account is secured with standard RFC 6238 TOTP. Authenticator code required on login.'
              : 'Protect your investigation workstation with an authenticator app (Google Authenticator, Microsoft Authenticator).'}
          </p>
        </div>

        {#if !user.mfaEnabled && !showMfaSetup}
          <button class="btn btn-primary btn-sm" on:click={handleStartMfaSetup} style="margin-top: 1rem;">
            + Configure Mobile Authenticator (TOTP)
          </button>
        {/if}

        <!-- MFA Setup Modal / Panel -->
        {#if showMfaSetup && mfaSecretData}
          <div class="mfa-setup-panel">
            <h4>Authenticator Setup</h4>
            <p style="font-size: 0.8125rem; color: var(--text-secondary);">
              1. Add a new account in your authenticator app using this secret key:
            </p>
            <div class="secret-box font-mono">{mfaSecretData.secret}</div>

            <p style="font-size: 0.8125rem; color: var(--text-secondary); margin-top: 0.75rem;">
              2. Enter the 6-digit code generated by your app:
            </p>
            <div class="mfa-input-row">
              <input
                type="text"
                placeholder="123456"
                maxlength="6"
                bind:value={mfaVerifyCode}
                class="form-input font-mono mfa-code-input"
              />
              <button
                class="btn btn-primary btn-sm"
                disabled={verifyingMfa || mfaVerifyCode.trim().length !== 6}
                on:click={handleConfirmMfa}
              >
                {verifyingMfa ? 'Verifying...' : 'Confirm & Activate'}
              </button>
            </div>
            {#if mfaError}
              <div class="form-error font-mono">{mfaError}</div>
            {/if}
          </div>
        {/if}
      </div>

    </div>

    <!-- Section 2: Credential & Supervisor Approval Workflow -->
    <div class="card supervisor-workflow-card">
      <div class="card-header">
        <div>
          <h3>Investigation Supervisor Authority</h3>
          <p class="section-sub">Controlled escalation process for evidentiary verification & case closure privileges.</p>
        </div>
        <span class="card-icon">⚖️</span>
      </div>

      {#if user.role === 'supervisor'}
        <div class="supervisor-approved-banner">
          <div class="app-badge font-mono">SUPERVISOR PRIVILEGE ACTIVE</div>
          <h4>Verified Investigation Supervisor (Level 2)</h4>
          <div class="sup-meta-grid">
            <div class="sup-meta-item">
              <span class="label">Organization:</span>
              <span class="val font-bold">{user.organization || 'Digital Forensics Unit'}</span>
            </div>
            <div class="sup-meta-item">
              <span class="label">Professional Email:</span>
              <span class="val font-mono">{user.professionalEmail || user.email} ✓</span>
            </div>
            <div class="sup-meta-item">
              <span class="label">Supervisor Approval:</span>
              <span class="val font-mono">{user.supervisorApprovedAt ? new Date(user.supervisorApprovedAt).toLocaleDateString() : 'Approved by Administrator'}</span>
            </div>
          </div>
        </div>
      {:else if user.role === 'admin'}
        <div class="admin-approved-banner">
          <div class="app-badge font-mono">ADMINISTRATIVE CLEARANCE</div>
          <h4>System Administrator (Level 3)</h4>
          <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.25rem;">
            Full supervisory, user management, and audit inspection authority pre-provisioned.
          </p>
        </div>
      {:else}
        <!-- Investigator Workflow -->
        {#if myRequest}
          <div class="request-status-card request-{myRequest.status}">
            <div class="req-status-header">
              <span class="status-badge badge-{myRequest.status} font-mono">{myRequest.status?.toUpperCase()}</span>
              <span class="font-mono" style="font-size: 0.75rem; color: var(--text-muted);">
                Submitted on {new Date(myRequest.createdAt).toLocaleDateString()}
              </span>
            </div>
            <h4>Supervisor Authority Request Status: {myRequest.status?.toUpperCase()}</h4>
            <div class="req-details-grid font-mono">
              <div>Organization: <strong>{myRequest.organization}</strong></div>
              <div>Title: <strong>{myRequest.professionalTitle}</strong></div>
              <div>Professional Email: <strong>{myRequest.professionalEmail}</strong></div>
              <div>Reason: <em>"{myRequest.reason}"</em></div>
            </div>
            {#if myRequest.status === 'rejected'}
              <p style="color: var(--color-danger); font-size: 0.8125rem; margin-top: 0.5rem;">
                Review notes: {myRequest.reviewNotes || 'Administrative review did not approve elevated supervisor authority.'}
              </p>
            {/if}
          </div>
        {:else if !showRequestForm}
          <div class="request-cta-box">
            <h4>Request Elevated Investigation Supervisor Authority</h4>
            <p>
              Supervisors can review and verify evidence artifacts, reject unverified evidence, and approve case lifecycle transitions.
              Submission requires organizational identification and administrative review.
            </p>
            <button class="btn btn-secondary btn-sm" on:click={() => (showRequestForm = true)} style="margin-top: 0.75rem;">
              + Submit Supervisor Request
            </button>
          </div>
        {:else}
          <!-- Request Application Form -->
          <form on:submit|preventDefault={handleSubmitSupervisorRequest} class="request-form">
            <div class="form-row">
              <div class="form-group flex-1">
                <label for="reqFullName">Full Name</label>
                <input id="reqFullName" type="text" bind:value={reqFullName} required class="form-input" />
              </div>
              <div class="form-group flex-1">
                <label for="reqProEmail">Professional / Agency Email</label>
                <input id="reqProEmail" type="email" bind:value={reqProEmail} required class="form-input" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group flex-1">
                <label for="reqOrg">Organization / Agency</label>
                <input id="reqOrg" type="text" placeholder="e.g. Cyber Crime Unit / Forensic Bureau" bind:value={reqOrg} required class="form-input" />
              </div>
              <div class="form-group flex-1">
                <label for="reqTitle">Professional Title / Role</label>
                <input id="reqTitle" type="text" placeholder="e.g. Senior Forensics Analyst" bind:value={reqTitle} required class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label for="reqReason">Justification for Supervisory Privileges</label>
              <textarea
                id="reqReason"
                rows="3"
                placeholder="Explain why your role requires evidence verification and case closure authority..."
                bind:value={reqReason}
                required
                class="form-input"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="reqCredRef">Credential / Reference ID (Optional)</label>
              <input id="reqCredRef" type="text" placeholder="e.g. GCFE-2024-8841 / Badge-9021" bind:value={reqCredRef} class="form-input" />
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" on:click={() => (showRequestForm = false)}>
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" disabled={submittingReq}>
                {submittingReq ? 'Submitting...' : 'Submit for Administrative Review'}
              </button>
            </div>
          </form>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .security-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1100px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .eyebrow {
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }

  .level-pill {
    font-size: 0.6875rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
  }

  .badge-level-3 { background-color: rgba(239, 68, 68, 0.15); color: var(--color-danger); border: 1px solid rgba(239, 68, 68, 0.4); }
  .badge-level-2 { background-color: rgba(245, 158, 11, 0.15); color: var(--color-warning); border: 1px solid rgba(245, 158, 11, 0.4); }
  .badge-level-1 { background-color: rgba(0, 229, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(0, 229, 255, 0.4); }
  .badge-level-0 { background-color: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); }

  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 820px) {
    .profile-grid { grid-template-columns: 1fr; }
  }

  .card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.5rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .card-header h3 { font-size: 1rem; font-weight: 700; }
  .card-icon { font-size: 1.25rem; }
  .section-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }

  .meta-list {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .meta-label { color: var(--text-muted); }
  .meta-value { color: var(--text-primary); }

  .meta-val-badge {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge-tag {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
  }

  .tag-success { background: rgba(63, 185, 80, 0.15); color: var(--color-success); border: 1px solid rgba(63, 185, 80, 0.3); }

  .btn-xs { font-size: 0.6875rem; padding: 0.2rem 0.5rem; }

  .role-tag {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .role-admin { color: var(--color-danger); border-color: rgba(248, 81, 73, 0.4); background-color: rgba(248, 81, 73, 0.1); }
  .role-supervisor { color: var(--color-warning); border-color: rgba(245, 158, 11, 0.4); background-color: rgba(245, 158, 11, 0.1); }
  .role-investigator { color: var(--accent-cyan); border-color: rgba(0, 229, 255, 0.4); background-color: rgba(0, 229, 255, 0.1); }

  /* MFA Card */
  .mfa-status-box {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .mfa-status-box.mfa-active {
    border-color: rgba(63, 185, 80, 0.4);
    background-color: rgba(63, 185, 80, 0.05);
  }

  .mfa-status-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .mfa-active .mfa-status-text { color: var(--color-success); }

  .mfa-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: currentColor;
  }

  .mfa-desc { font-size: 0.75rem; color: var(--text-secondary); line-height: 1.4; }

  .mfa-setup-panel {
    background-color: var(--bg-primary);
    border: 1px solid var(--accent-cyan);
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mfa-setup-panel h4 { font-size: 0.875rem; font-weight: 700; color: var(--accent-cyan); }

  .secret-box {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    color: var(--accent-cyan);
    letter-spacing: 0.1em;
    text-align: center;
  }

  .mfa-input-row { display: flex; gap: 0.5rem; align-items: center; }

  .mfa-code-input {
    max-width: 140px;
    text-align: center;
    font-size: 1.125rem;
    letter-spacing: 0.2em;
    padding: 0.4rem;
  }

  /* Supervisor Workflow */
  .supervisor-workflow-card { margin-top: 0.5rem; }

  .supervisor-approved-banner, .admin-approved-banner {
    background-color: rgba(245, 158, 11, 0.05);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .admin-approved-banner {
    background-color: rgba(248, 81, 73, 0.05);
    border-color: rgba(248, 81, 73, 0.3);
  }

  .app-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    color: var(--color-warning);
    margin-bottom: 0.25rem;
  }

  .sup-meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(245, 158, 11, 0.2);
  }

  .sup-meta-item { display: flex; flex-direction: column; gap: 0.15rem; font-size: 0.8125rem; }
  .sup-meta-item .label { font-size: 0.6875rem; color: var(--text-muted); }

  .request-status-card {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .req-status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
  .req-details-grid { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.8125rem; margin-top: 0.5rem; }

  .request-cta-box {
    background-color: var(--bg-primary);
    border: 1px dashed var(--border-color);
    border-radius: 8px;
    padding: 1.25rem;
  }

  .request-cta-box h4 { font-size: 0.9375rem; font-weight: 700; margin-bottom: 0.35rem; }
  .request-cta-box p { font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.5; }

  .request-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-row { display: flex; gap: 1rem; }
  .flex-1 { flex: 1; }

  .form-group { display: flex; flex-direction: column; gap: 0.35rem; }
  .form-group label { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }

  .form-input {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    font-family: inherit;
  }

  .form-input:focus { border-color: var(--accent-cyan); }

  .form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.8125rem;
  }

  .alert-success { background: rgba(63, 185, 80, 0.1); color: var(--color-success); border: 1px solid rgba(63, 185, 80, 0.3); }
  .alert-danger { background: rgba(248, 81, 73, 0.1); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.3); }
  .form-error { color: var(--color-danger); font-size: 0.75rem; }

  .loading-box { text-align: center; padding: 4rem; color: var(--text-muted); }
  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
