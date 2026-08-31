<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let activeTab = 'users'; // 'users' | 'supervisor_requests'
  let users = [];
  let supervisorRequests = [];
  let loading = true;
  let errorMsg = null;
  let successMsg = null;
  let search = '';
  let updatingId = null;

  // Re-auth confirmation modal
  let showConfirmModal = false;
  let confirmAction = null;
  let confirmTitle = '';
  let confirmPrompt = '';
  let adminPassword = '';
  let revokeReason = '';

  async function loadData() {
    loading = true;
    errorMsg = null;

    try {
      const [usersRes, reqsRes] = await Promise.allSettled([
        api.get(`/admin/users?search=${encodeURIComponent(search)}`),
        api.get('/supervisor/admin/requests')
      ]);

      if (usersRes.status === 'fulfilled' && usersRes.value?.success) {
        users = usersRes.value.data;
      }
      if (reqsRes.status === 'fulfilled' && reqsRes.value?.success) {
        supervisorRequests = reqsRes.value.data || [];
      }
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        errorMsg = 'Access Denied: Administrator clearance (Level 3) required to manage system credentials.';
      } else if (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED') {
        goto('/login');
      } else {
        errorMsg = err.message || 'Failed to load user directory.';
      }
    } finally {
      loading = false;
    }
  }

  function promptRoleChange(user, newRole) {
    if (user.role === newRole) return;
    confirmTitle = `Confirm Role Escalation / Change`;
    confirmPrompt = `Are you sure you want to change ${user.name}'s role from ${user.role?.toUpperCase()} to ${newRole.toUpperCase()}?`;
    confirmAction = async () => {
      updatingId = user.id || user._id;
      try {
        const res = await api.patch(`/admin/users/${updatingId}/role`, {
          role: newRole,
          adminPassword: adminPassword || undefined
        });
        if (res?.success) {
          user.role = newRole;
          successMsg = `User ${user.name} role changed to ${newRole.toUpperCase()}`;
          await loadData();
        }
      } catch (err) {
        errorMsg = err.message || 'Failed to update user role';
      } finally {
        updatingId = null;
      }
    };
    showConfirmModal = true;
  }

  async function handleStatusChange(user, newStatus) {
    updatingId = user.id || user._id;
    try {
      const res = await api.patch(`/admin/users/${updatingId}/status`, { status: newStatus });
      if (res?.success) {
        user.status = newStatus;
        successMsg = `User ${user.name} status set to ${newStatus.toUpperCase()}`;
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to update status';
    } finally {
      updatingId = null;
    }
  }

  async function handleApproveSupervisorRequest(req) {
    updatingId = req.id || req._id;
    try {
      const res = await api.post(`/supervisor/admin/requests/${updatingId}/approve`, {
        reviewNotes: 'Approved by Administrator after credential review'
      });
      if (res?.success) {
        successMsg = `Approved supervisor authority for ${req.fullName} (${req.organization})`;
        await loadData();
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to approve supervisor request';
    } finally {
      updatingId = null;
    }
  }

  async function handleRejectSupervisorRequest(req) {
    updatingId = req.id || req._id;
    try {
      const res = await api.post(`/supervisor/admin/requests/${updatingId}/reject`, {
        reviewNotes: 'Rejected by Administrator: Insufficient documentation or organizational mismatch'
      });
      if (res?.success) {
        successMsg = `Rejected supervisor request for ${req.fullName}`;
        await loadData();
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to reject supervisor request';
    } finally {
      updatingId = null;
    }
  }

  function promptRevokeSupervisor(user) {
    confirmTitle = `Revoke Investigation Supervisor Authority`;
    confirmPrompt = `Are you sure you want to revoke supervisor authority for ${user.name}? Their role will be demoted to Level 1 Investigator.`;
    confirmAction = async () => {
      updatingId = user.id || user._id;
      try {
        const res = await api.post(`/supervisor/admin/users/${updatingId}/revoke`, {
          reason: revokeReason || 'Administrative revocation'
        });
        if (res?.success) {
          successMsg = `Supervisor privileges revoked for ${user.name}`;
          await loadData();
        }
      } catch (err) {
        errorMsg = err.message || 'Failed to revoke supervisor privilege';
      } finally {
        updatingId = null;
      }
    };
    showConfirmModal = true;
  }

  async function executeConfirm() {
    showConfirmModal = false;
    if (confirmAction) {
      await confirmAction();
      confirmAction = null;
      adminPassword = '';
      revokeReason = '';
    }
  }

  onMount(() => {
    loadData();
  });
</script>

<div class="admin-page">
  <div class="page-header">
    <div>
      <div class="badge-subtitle font-mono">SYSTEM ADMINISTRATOR GOVERNANCE (LEVEL 3)</div>
      <h1>User Directory & Credential Authority</h1>
      <p class="subtitle">Govern role privileges, review supervisor authorization requests, and audit account statuses.</p>
    </div>
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

  <!-- Tab Navigation -->
  <div class="admin-nav-tabs">
    <button class="nav-tab" class:active={activeTab === 'users'} on:click={() => (activeTab = 'users')}>
      User Directory ({users.length})
    </button>
    <button class="nav-tab" class:active={activeTab === 'supervisor_requests'} on:click={() => (activeTab = 'supervisor_requests')}>
      Supervisor Requests ({supervisorRequests.filter((r) => r.status === 'pending').length} Pending)
    </button>
  </div>

  {#if activeTab === 'users'}
    <!-- Filters -->
    <div class="filters-bar">
      <div class="search-box">
        <input
          type="text"
          bind:value={search}
          placeholder="Filter by name, email, or organization..."
          on:input={loadData}
          class="search-input"
        />
      </div>
    </div>

    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p class="font-mono">Loading user directory...</p>
      </div>
    {:else if users.length === 0}
      <div class="empty-state">
        <p>No user accounts found matching your filter.</p>
      </div>
    {:else}
      <div class="table-container">
        <table class="users-table">
          <thead>
            <tr>
              <th>User & Identity</th>
              <th>Access Level</th>
              <th>Verifications</th>
              <th>Account Status</th>
              <th>Organization</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each users as u (u.id || u._id)}
              <tr class:row-suspended={u.status === 'suspended' || u.status === 'revoked'}>
                <td>
                  <div class="user-cell">
                    <div class="avatar">{u.name.charAt(0).toUpperCase()}</div>
                    <div>
                      <div class="user-name">{u.name}</div>
                      <div class="user-email font-mono">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="role-cell">
                    <select
                      value={u.role}
                      on:change={(e) => promptRoleChange(u, e.target.value)}
                      class="role-select font-mono"
                      disabled={updatingId === (u.id || u._id)}
                    >
                      <option value="investigator">L1: Investigator</option>
                      <option value="supervisor">L2: Supervisor</option>
                      <option value="admin">L3: Administrator</option>
                    </select>
                  </div>
                </td>
                <td>
                  <div class="badge-cluster">
                    {#if u.emailVerified}
                      <span class="v-badge v-success" title="Email Verified">EMAIL ✓</span>
                    {/if}
                    {#if u.identityVerified}
                      <span class="v-badge v-cyan" title="Identity Verified">ID ✓</span>
                    {/if}
                    {#if u.mfaEnabled}
                      <span class="v-badge v-purple" title="MFA TOTP Active">MFA ✓</span>
                    {/if}
                  </div>
                </td>
                <td>
                  <span class={`status-pill pill-${u.status} font-mono`}>
                    {u.status?.toUpperCase()}
                  </span>
                </td>
                <td class="org-cell">
                  {u.organization || '—'}
                </td>
                <td>
                  <div class="actions-group">
                    {#if u.status === 'active'}
                      <button
                        class="btn btn-sm btn-danger-outline"
                        on:click={() => handleStatusChange(u, 'suspended')}
                        disabled={updatingId === (u.id || u._id)}
                      >
                        Suspend
                      </button>
                    {:else}
                      <button
                        class="btn btn-sm btn-success-outline"
                        on:click={() => handleStatusChange(u, 'active')}
                        disabled={updatingId === (u.id || u._id)}
                      >
                        Activate
                      </button>
                    {/if}
                    {#if u.role === 'supervisor'}
                      <button
                        class="btn btn-sm btn-warning-outline"
                        on:click={() => promptRevokeSupervisor(u)}
                        disabled={updatingId === (u.id || u._id)}
                      >
                        Revoke Sup
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else if activeTab === 'supervisor_requests'}
    <!-- Supervisor Requests Queue -->
    {#if supervisorRequests.length === 0}
      <div class="empty-state">
        <p>No supervisor authority requests in the registry.</p>
      </div>
    {:else}
      <div class="requests-grid">
        {#each supervisorRequests as req (req.id || req._id)}
          <div class="req-card req-card-{req.status}">
            <div class="req-card-top">
              <span class="status-badge badge-{req.status} font-mono">{req.status?.toUpperCase()}</span>
              <span class="font-mono" style="font-size: 0.6875rem; color: var(--text-muted);">
                {new Date(req.createdAt).toLocaleDateString()}
              </span>
            </div>

            <h3 class="req-title">{req.fullName}</h3>
            <div class="req-meta-row font-mono">
              <strong>{req.professionalTitle}</strong> @ {req.organization}
            </div>
            <div class="req-email font-mono">{req.professionalEmail}</div>

            <div class="req-reason-box">
              <span class="req-reason-label font-mono">JUSTIFICATION:</span>
              <p>"{req.reason}"</p>
            </div>

            {#if req.credentialReference}
              <div class="req-cred font-mono">Ref: {req.credentialReference}</div>
            {/if}

            {#if req.status === 'pending' || req.status === 'under_review'}
              <div class="req-actions">
                <button
                  class="btn btn-danger-outline btn-sm"
                  on:click={() => handleRejectSupervisorRequest(req)}
                  disabled={updatingId === (req.id || req._id)}
                >
                  Reject
                </button>
                <button
                  class="btn btn-primary btn-sm"
                  on:click={() => handleApproveSupervisorRequest(req)}
                  disabled={updatingId === (req.id || req._id)}
                >
                  Approve Supervisor (L2)
                </button>
              </div>
            {:else if req.reviewedBy}
              <div class="req-review-meta font-mono">
                Reviewed by {req.reviewedBy.name} on {new Date(req.reviewedAt).toLocaleDateString()}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Re-Auth / Confirmation Modal -->
  {#if showConfirmModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showConfirmModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showConfirmModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>{confirmTitle}</h3>
          <button class="close-btn" on:click={() => (showConfirmModal = false)}>✕</button>
        </div>
        <div class="modal-body">
          <p style="color: var(--text-secondary); margin-bottom: 1rem;">{confirmPrompt}</p>

          <div class="form-group">
            <label for="adminPass">Administrator Password (Re-authentication)</label>
            <input
              id="adminPass"
              type="password"
              placeholder="Enter your admin password to confirm..."
              bind:value={adminPassword}
              class="form-input"
            />
          </div>

          {#if confirmTitle.includes('Revoke')}
            <div class="form-group" style="margin-top: 0.75rem;">
              <label for="revReason">Reason for Revocation</label>
              <input
                id="revReason"
                type="text"
                placeholder="e.g. Transfer to unprivileged department"
                bind:value={revokeReason}
                class="form-input"
              />
            </div>
          {/if}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" on:click={() => (showConfirmModal = false)}>Cancel</button>
          <button class="btn btn-primary" on:click={executeConfirm}>
            Confirm Security Action
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1250px;
    margin: 0 auto;
  }

  .badge-subtitle {
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

  .admin-nav-tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 0.5rem;
  }

  .nav-tab {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.875rem;
    font-weight: 600;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .nav-tab:hover {
    color: var(--text-primary);
    background-color: var(--bg-card);
  }

  .nav-tab.active {
    color: var(--accent-cyan);
    background-color: rgba(0, 229, 255, 0.1);
    border: 1px solid rgba(0, 229, 255, 0.3);
  }

  .filters-bar {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    border-radius: 8px;
  }

  .search-input {
    width: 100%;
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
  }

  .search-input:focus { border-color: var(--accent-cyan); }

  .table-container {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    overflow-x: auto;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .users-table th {
    background-color: var(--bg-primary);
    color: var(--text-muted);
    font-weight: 700;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    font-size: 0.625rem;
    letter-spacing: 0.05em;
  }

  .users-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .row-suspended { opacity: 0.5; }

  .user-cell { display: flex; align-items: center; gap: 0.75rem; }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-elevated);
    color: var(--accent-cyan);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8125rem;
  }

  .user-name { font-weight: 600; color: var(--text-primary); }
  .user-email { font-size: 0.6875rem; color: var(--text-muted); }

  .role-select {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    outline: none;
  }

  .badge-cluster { display: flex; gap: 0.35rem; flex-wrap: wrap; }

  .v-badge {
    font-size: 0.5625rem;
    font-weight: 800;
    padding: 0.15rem 0.35rem;
    border-radius: 3px;
    letter-spacing: 0.04em;
  }

  .v-success { background: rgba(63, 185, 80, 0.15); color: var(--color-success); }
  .v-cyan { background: rgba(0, 229, 255, 0.15); color: var(--accent-cyan); }
  .v-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

  .status-pill {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .pill-active { background-color: rgba(63, 185, 80, 0.15); color: var(--color-success); }
  .pill-suspended { background-color: rgba(248, 81, 73, 0.15); color: var(--color-danger); }
  .pill-revoked { background-color: rgba(248, 81, 73, 0.2); color: var(--color-danger); border: 1px solid var(--color-danger); }

  .org-cell { font-size: 0.8125rem; color: var(--text-secondary); }

  .actions-group { display: flex; gap: 0.4rem; }

  .btn-sm { padding: 0.25rem 0.55rem; font-size: 0.6875rem; border-radius: 4px; }
  .btn-danger-outline { background: none; border: 1px solid var(--color-danger); color: var(--color-danger); cursor: pointer; }
  .btn-danger-outline:hover { background-color: rgba(248, 81, 73, 0.1); }
  .btn-success-outline { background: none; border: 1px solid var(--color-success); color: var(--color-success); cursor: pointer; }
  .btn-success-outline:hover { background-color: rgba(63, 185, 80, 0.1); }
  .btn-warning-outline { background: none; border: 1px solid var(--color-warning); color: var(--color-warning); cursor: pointer; }
  .btn-warning-outline:hover { background-color: rgba(245, 158, 11, 0.1); }

  /* Requests Grid */
  .requests-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 1.25rem;
  }

  .req-card {
    background-color: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .req-card-top { display: flex; justify-content: space-between; align-items: center; }
  .req-title { font-size: 1.125rem; font-weight: 700; color: var(--text-primary); }
  .req-meta-row { font-size: 0.75rem; color: var(--text-secondary); }
  .req-email { font-size: 0.6875rem; color: var(--text-muted); }

  .req-reason-box {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 0.75rem;
    margin-top: 0.25rem;
  }

  .req-reason-label { font-size: 0.5625rem; font-weight: 700; color: var(--accent-cyan); display: block; margin-bottom: 0.25rem; }
  .req-reason-box p { font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.4; }

  .req-cred { font-size: 0.6875rem; color: var(--text-muted); }
  .req-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
  .req-review-meta { font-size: 0.6875rem; color: var(--text-muted); margin-top: 0.5rem; }

  .alert { padding: 0.75rem 1rem; border-radius: 8px; font-size: 0.8125rem; }
  .alert-success { background: rgba(63, 185, 80, 0.1); color: var(--color-success); border: 1px solid rgba(63, 185, 80, 0.3); }
  .alert-danger { background: rgba(248, 81, 73, 0.1); color: var(--color-danger); border: 1px solid rgba(248, 81, 73, 0.3); }

  .loading-state, .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
  .spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--border-color);
    border-top-color: var(--accent-cyan);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 0.75rem;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    padding: 1.5rem;
  }

  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem; }
  .modal-header h3 { font-size: 1.125rem; font-weight: 700; }
  .close-btn { background: none; border: none; color: var(--text-muted); font-size: 1.25rem; cursor: pointer; }
  .modal-body { margin-bottom: 1.25rem; }
  .modal-footer { display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--border-color); padding-top: 0.75rem; }

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
  }
  .form-input:focus { border-color: var(--accent-cyan); }
</style>
