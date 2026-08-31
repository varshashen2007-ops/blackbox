<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';
  import { auth } from '$lib/stores/auth.js';

  let loading = true;
  let error = null;
  let stats = {
    totalReviews: 0,
    completedReviews: 0,
    flaggedCount: 0,
    recentReviews: []
  };

  onMount(async () => {
    await fetchDashboardData();
  });

  async function fetchDashboardData() {
    loading = true;
    error = null;
    try {
      const res = await api.get('/ai-supervisor/dashboard');
      if (res.success) {
        stats = res.data;
      } else {
        error = res.error?.message || 'Failed to load AI Supervisor dashboard';
      }
    } catch (err) {
      error = err.message || 'Network error loading AI Supervisor dashboard';
    } finally {
      loading = false;
    }
  }

  function getDecisionBadgeClass(decision) {
    switch (decision) {
      case 'READY_FOR_CLOSURE': return 'badge-success';
      case 'REQUIRES_ATTENTION': return 'badge-warning';
      case 'REVIEW_BLOCKED': return 'badge-danger';
      default: return 'badge-cyan';
    }
  }

  function formatDecisionLabel(decision) {
    switch (decision) {
      case 'READY_FOR_CLOSURE': return 'READY FOR CLOSURE';
      case 'REQUIRES_ATTENTION': return 'REQUIRES ATTENTION';
      case 'REVIEW_BLOCKED': return 'REVIEW BLOCKED';
      case 'REVIEW_COMPLETE': return 'AI REVIEW COMPLETE';
      default: return decision || 'COMPLETE';
    }
  }
</script>

<div class="ai-supervisor-page container mx-auto p-6 space-y-6">
  <!-- Top Header -->
  <div class="flex items-center justify-between border-b border-border pb-4">
    <div>
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-bold tracking-tight text-white">BLACKBOX AI SUPERVISOR</h1>
        <span class="px-2.5 py-0.5 rounded text-xs font-mono font-semibold bg-cyan-950 text-cyan-400 border border-cyan-800">
          AUTOMATED REASONING ENGINE
        </span>
      </div>
      <p class="text-sm text-text-muted mt-1">
        Automated digital evidence review, cryptographic integrity verification, contradiction detection, and hypothesis stance analysis.
      </p>
    </div>
    <button class="btn btn-secondary btn-sm flex items-center gap-2" on:click={fetchDashboardData} disabled={loading}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
      </svg>
      Refresh Dashboard
    </button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center p-12 text-text-muted font-mono">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mr-3"></div>
      Loading AI Supervisor intelligence metrics...
    </div>
  {:else if error}
    <div class="p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm">
      ⚠️ {error}
    </div>
  {:else}
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="card p-4 space-y-1">
        <div class="text-xs font-mono text-text-muted uppercase">TOTAL AI REVIEWS</div>
        <div class="text-3xl font-extrabold text-white font-mono">{stats.totalReviews}</div>
        <div class="text-xs text-text-muted">Automated case evaluations</div>
      </div>

      <div class="card p-4 space-y-1">
        <div class="text-xs font-mono text-text-muted uppercase">COMPLETED REVIEWS</div>
        <div class="text-3xl font-extrabold text-emerald-400 font-mono">{stats.completedReviews}</div>
        <div class="text-xs text-emerald-500/80">Structured JSON validated</div>
      </div>

      <div class="card p-4 space-y-1">
        <div class="text-xs font-mono text-text-muted uppercase font-semibold text-amber-400">ATTENTION / FLAGGED</div>
        <div class="text-3xl font-extrabold text-amber-400 font-mono">{stats.flaggedCount}</div>
        <div class="text-xs text-amber-500/80">Contradictions or integrity concerns</div>
      </div>

      <div class="card p-4 space-y-1">
        <div class="text-xs font-mono text-text-muted uppercase">ENGINE STATUS</div>
        <div class="flex items-center gap-2 mt-1">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-lg font-bold text-white font-mono">ONLINE</span>
        </div>
        <div class="text-xs text-text-muted font-mono">Groq Llama-3.3-70B / Fallback</div>
      </div>
    </div>

    <!-- Active Reviews Table -->
    <div class="card overflow-hidden">
      <div class="px-6 py-4 border-b border-border flex items-center justify-between">
        <h2 class="text-base font-bold text-white flex items-center gap-2">
          <span>AUTOMATED CASE REVIEWS & ASSESSMENTS</span>
        </h2>
        <span class="text-xs text-text-muted font-mono">Showing recent evaluations</span>
      </div>

      {#if stats.recentReviews.length === 0}
        <div class="p-8 text-center text-text-muted text-sm font-mono">
          No automated AI reviews recorded yet. Cases are reviewed automatically upon submission (UNDER_REVIEW).
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-bg-elevated text-xs font-mono uppercase text-text-muted border-b border-border">
              <tr>
                <th class="px-6 py-3">Case</th>
                <th class="px-6 py-3">Review Decision</th>
                <th class="px-6 py-3">Evidence Health</th>
                <th class="px-6 py-3">Leading Hypothesis</th>
                <th class="px-6 py-3">Contradictions</th>
                <th class="px-6 py-3">Model</th>
                <th class="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {#each stats.recentReviews as review}
                <tr class="hover:bg-bg-card/50 transition-colors">
                  <td class="px-6 py-4 font-medium text-white">
                    <a href="/cases/{review.caseId?._id || review.caseId}?tab=ai_supervisor" class="hover:text-cyan-400 font-semibold">
                      {review.caseId?.title || 'Case ' + review.caseId}
                    </a>
                    <div class="text-xs text-text-muted font-mono mt-0.5">
                      Priority: <span class="capitalize">{review.caseId?.priority || 'normal'}</span>
                    </div>
                  </td>

                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded text-xs font-mono font-bold border {getDecisionBadgeClass(review.decision)}">
                      ● {formatDecisionLabel(review.decision)}
                    </span>
                  </td>

                  <td class="px-6 py-4 font-mono text-xs text-text-secondary">
                    <div>Total Items: {review.deterministicMetrics?.totalEvidence || 0}</div>
                    <div class="text-emerald-400">Verified: {review.deterministicMetrics?.verifiedCount || 0}</div>
                  </td>

                  <td class="px-6 py-4 font-mono text-xs">
                    <span class="text-cyan-400 font-bold">
                      {review.deterministicMetrics?.leadingConfidence || 50}%
                    </span>
                    <div class="text-text-muted text-[11px]">Deterministic Confidence</div>
                  </td>

                  <td class="px-6 py-4">
                    {#if (review.deterministicMetrics?.conflictCount || 0) > 0}
                      <span class="px-2 py-0.5 rounded text-xs font-mono bg-red-950 text-red-400 border border-red-800 font-bold">
                        ⚠️ {review.deterministicMetrics.conflictCount} Conflicts
                      </span>
                    {:else}
                      <span class="text-xs font-mono text-emerald-400">✓ Clean (0)</span>
                    {/if}
                  </td>

                  <td class="px-6 py-4 font-mono text-xs text-text-muted">
                    {review.modelName || 'Llama-3.3-70B'}
                  </td>

                  <td class="px-6 py-4 text-right">
                    <a
                      href="/cases/{review.caseId?._id || review.caseId}?tab=ai_supervisor"
                      class="btn btn-secondary btn-xs font-mono"
                    >
                      View AI Review →
                    </a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.3); }
  .badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3); }
  .badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }
  .badge-cyan { background: rgba(6, 182, 212, 0.15); color: #06b6d4; border-color: rgba(6, 182, 212, 0.3); }
</style>
