<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';
  import { goto } from '$app/navigation';

  let users = [];
  let loading = true;
  let errorMsg = null;
  let search = '';
  let updatingId = null;

  async function loadUsers() {
    loading = true;
    errorMsg = null;

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const res = await api.get(`/admin/users?${params.toString()}`);
      if (res && res.success) {
        users = res.data;
      }
    } catch (err) {
      if (err.code === 'FORBIDDEN') {
        errorMsg = 'Access Denied: Administrator privileges required to manage users.';
      } else if (err.code === 'UNAUTHENTICATED' || err.code === 'TOKEN_EXPIRED') {
        goto('/login');
      } else {
        errorMsg = err.message || 'Failed to load system users.';
      }
    } finally {
      loading = false;
    }
  }

  async function handleRoleChange(user, newRole) {
    if (user.role === newRole) return;
    updatingId = user.id || user._id;

    try {
      const res = await api.patch(`/admin/users/${updatingId}/role`, { role: newRole });
      if (res && res.success) {
        user.role = newRole;
      }
    } catch (err) {
      alert(err.message || 'Failed to update user role');
    } finally {
      updatingId = null;
    }
  }

  async function handleStatusToggle(user) {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    updatingId = user.id || user._id;

    try {
      const res = await api.patch(`/admin/users/${updatingId}/status`, { status: newStatus });
      if (res && res.success) {
        user.status = newStatus;
      }
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    } finally {
      updatingId = null;
    }
  }

  onMount(() => {
    loadUsers();
  });
</script>

<div class="admin-page">
  <div class="page-header">
    <div>
      <div class="badge-subtitle">ADMINISTRATION & GOVERNANCE</div>
      <h1>User Directory & Role Management</h1>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  <div class="filters-bar">
    <div class="search-box">
      <input
        type="text"
        bind:value={search}
        placeholder="Filter by user name or email..."
        on:input={loadUsers}
        class="search-input"
      />
    </div>
  </div>

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading user directory...</p>
    </div>
  {:else if users.length === 0}
    <div class="empty-state">
      <p>No user accounts found.</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Account Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each users as u (u.id || u._id)}
            <tr class:row-suspended={u.status === 'suspended'}>
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
                <select
                  value={u.role}
                  on:change={(e) => handleRoleChange(u, e.target.value)}
                  class="role-select"
                  disabled={updatingId === (u.id || u._id)}
                >
                  <option value="investigator">Investigator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>
                <span class={`status-pill ${u.status === 'active' ? 'pill-active' : 'pill-suspended'}`}>
                  {u.status.toUpperCase()}
                </span>
              </td>
              <td class="text-muted">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td>
                <button
                  class={`btn btn-sm ${u.status === 'active' ? 'btn-danger-outline' : 'btn-success-outline'}`}
                  on:click={() => handleStatusToggle(u)}
                  disabled={updatingId === (u.id || u._id)}
                >
                  {u.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .admin-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .badge-subtitle {
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--accent-cyan);
    letter-spacing: 0.08em;
    margin-bottom: 0.25rem;
  }

  .page-header h1 {
    font-size: 1.75rem;
    font-weight: 800;
  }

  .filters-bar {
    background-color: var(--bg-secondary);
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

  .table-container {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    overflow-x: auto;
  }

  .users-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: left;
  }

  .users-table th {
    background-color: var(--bg-card);
    color: var(--text-muted);
    font-weight: 600;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-color);
    text-transform: uppercase;
    font-size: 0.6875rem;
    letter-spacing: 0.05em;
  }

  .users-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid var(--border-color);
  }

  .row-suspended {
    opacity: 0.6;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

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

  .user-name {
    font-weight: 600;
    color: var(--text-primary);
  }

  .user-email {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .role-select {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.35rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8125rem;
    outline: none;
  }

  .status-pill {
    font-size: 0.6875rem;
    font-weight: 700;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .pill-active {
    background-color: rgba(16, 185, 129, 0.15);
    color: var(--color-success);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .pill-suspended {
    background-color: rgba(239, 68, 68, 0.15);
    color: var(--color-danger);
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .btn-sm {
    padding: 0.3rem 0.6rem;
    font-size: 0.75rem;
    border-radius: 4px;
  }

  .btn-danger-outline {
    background: none;
    border: 1px solid var(--color-danger);
    color: var(--color-danger);
    cursor: pointer;
  }

  .btn-danger-outline:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .btn-success-outline {
    background: none;
    border: 1px solid var(--color-success);
    color: var(--color-success);
    cursor: pointer;
  }

  .btn-success-outline:hover {
    background-color: rgba(16, 185, 129, 0.1);
  }

  .loading-state, .empty-state {
    text-align: center;
    padding: 3rem;
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-blue);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 0.75rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
