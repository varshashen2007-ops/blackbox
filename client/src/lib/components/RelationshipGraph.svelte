<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client.js';

  export let caseId;

  let graphData = { nodes: [], links: [] };
  let loading = true;
  let errorMsg = null;

  // Add Relationship Modal
  let showAddRelModal = false;
  let sourceEvidenceId = '';
  let targetEvidenceId = '';
  let relationshipType = 'corroborates';
  let weight = 0.5;
  let notes = '';
  let submittingRel = false;
  let relError = null;

  let evidenceNodes = [];

  async function loadGraph() {
    loading = true;
    errorMsg = null;

    try {
      const res = await api.get(`/cases/${caseId}/relationships/graph`);
      if (res && res.success) {
        graphData = res.data;
        evidenceNodes = graphData.nodes.filter((n) => n.nodeType === 'evidence');
        if (evidenceNodes.length >= 2) {
          sourceEvidenceId = evidenceNodes[0].id;
          targetEvidenceId = evidenceNodes[1].id;
        }
      }
    } catch (err) {
      errorMsg = err.message || 'Failed to load case relationship graph.';
    } finally {
      loading = false;
    }
  }

  async function handleCreateRelationship() {
    if (sourceEvidenceId === targetEvidenceId) {
      relError = 'Source and target evidence cannot be the same item.';
      return;
    }

    submittingRel = true;
    relError = null;

    try {
      const res = await api.post(`/cases/${caseId}/relationships`, {
        sourceEvidenceId,
        targetEvidenceId,
        relationshipType,
        weight: parseFloat(weight.toString()),
        notes
      });

      if (res && res.success) {
        showAddRelModal = false;
        notes = '';
        await loadGraph();
      }
    } catch (err) {
      relError = err.message || 'Failed to establish relationship.';
    } finally {
      submittingRel = false;
    }
  }

  // Calculate circular layout positions for nodes
  function getNodePositions(nodes) {
    const width = 800;
    const height = 450;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.38;

    const positions = new Map();
    nodes.forEach((node, idx) => {
      const angle = (2 * Math.PI * idx) / (nodes.length || 1);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      positions.set(node.id, { x, y });
    });

    return positions;
  }

  $: nodePositions = getNodePositions(graphData.nodes);

  function getLinkColor(type) {
    switch (type) {
      case 'corroborates': return '#10b981'; // green
      case 'supports': return '#3b82f6'; // blue
      case 'contradicts': return '#ef4444'; // red
      case 'references': return '#8b5cf6'; // purple
      case 'derived_from': return '#6b7280'; // gray
      default: return '#9ca3af';
    }
  }

  onMount(() => {
    loadGraph();
  });
</script>

<div class="graph-wrapper">
  <div class="graph-header">
    <div>
      <h2>Evidence & Intelligence Topology Graph</h2>
      <p class="text-muted">
        Visualizing corroborating evidence clusters, contradictory paths, and hypothesis stance links.
      </p>
    </div>

    <button
      class="btn btn-primary"
      on:click={() => (showAddRelModal = true)}
      disabled={evidenceNodes.length < 2}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      Link Evidence Items
    </button>
  </div>

  {#if errorMsg}
    <div class="alert alert-danger">{errorMsg}</div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Rendering investigation graph topology...</p>
    </div>
  {:else if graphData.nodes.length === 0}
    <div class="empty-state">
      <p class="empty-title">No entities in graph</p>
      <p class="text-muted">Add evidence items and hypotheses to visualize connections.</p>
    </div>
  {:else}
    <div class="graph-canvas-box">
      <!-- Legend -->
      <div class="graph-legend">
        <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> Corroborates (+Boost)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span> Supports</div>
        <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> Contradicts (Conflict)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6"></span> References</div>
      </div>

      <svg class="graph-svg" viewBox="0 0 800 450">
        <!-- Render Links -->
        {#each graphData.links as link}
          {@const srcPos = nodePositions.get(link.source)}
          {@const tgtPos = nodePositions.get(link.target)}
          {#if srcPos && tgtPos}
            <line
              x1={srcPos.x}
              y1={srcPos.y}
              x2={tgtPos.x}
              y2={tgtPos.y}
              stroke={getLinkColor(link.type)}
              stroke-width={link.type === 'corroborates' ? 3 : 2}
              stroke-dasharray={link.type === 'contradicts' ? '4,4' : 'none'}
              opacity="0.8"
            />
          {/if}
        {/each}

        <!-- Render Nodes -->
        {#each graphData.nodes as node}
          {@const pos = nodePositions.get(node.id)}
          {#if pos}
            <g class="graph-node-group" transform={`translate(${pos.x}, ${pos.y})`}>
              {#if node.nodeType === 'hypothesis'}
                <!-- Diamond for Hypothesis -->
                <polygon
                  points="0,-22 22,0 0,22 -22,0"
                  fill="#1e1b4b"
                  stroke="var(--accent-cyan)"
                  stroke-width="2.5"
                />
                <text y="4" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">H</text>
              {:else}
                <!-- Circle for Evidence -->
                <circle
                  r="18"
                  fill={node.verificationStatus === 'verified' ? '#064e3b' : '#1f2937'}
                  stroke={node.verificationStatus === 'verified' ? '#10b981' : '#6b7280'}
                  stroke-width="2"
                />
                <text y="4" text-anchor="middle" fill="#fff" font-size="10" font-weight="600">EV</text>
              {/if}

              <!-- Label text -->
              <text
                y="32"
                text-anchor="middle"
                fill="var(--text-primary)"
                font-size="11"
                font-weight="600"
                class="node-label"
              >
                {node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label}
              </text>
            </g>
          {/if}
        {/each}
      </svg>
    </div>
  {/if}

  <!-- Add Relationship Modal -->
  {#if showAddRelModal}
    <div
      class="modal-backdrop"
      role="presentation"
      on:click|self={() => (showAddRelModal = false)}
      on:keydown={(e) => e.key === 'Escape' && (showAddRelModal = false)}
    >
      <div class="modal-card">
        <div class="modal-header">
          <h3>Create Evidence Relationship</h3>
          <button class="close-btn" on:click={() => (showAddRelModal = false)}>✕</button>
        </div>

        {#if relError}
          <div class="alert alert-danger" style="margin: 0.75rem 0;">{relError}</div>
        {/if}

        <form on:submit|preventDefault={handleCreateRelationship} class="modal-form">
          <div class="form-group">
            <label for="srcEv">Source Evidence Node</label>
            <select id="srcEv" bind:value={sourceEvidenceId} class="form-input">
              {#each evidenceNodes as ev}
                <option value={ev.id}>
                  [{ev.evidenceType.toUpperCase()}] {ev.label}
                </option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="relType">Relationship Type</label>
            <select id="relType" bind:value={relationshipType} class="form-input">
              <option value="corroborates">Corroborates (+10% Boost to Hypothesis Confidence)</option>
              <option value="supports">Supports</option>
              <option value="contradicts">Contradicts (Conflict Warning)</option>
              <option value="references">References</option>
              <option value="derived_from">Derived From</option>
            </select>
          </div>

          <div class="form-group">
            <label for="tgtEv">Target Evidence Node</label>
            <select id="tgtEv" bind:value={targetEvidenceId} class="form-input">
              {#each evidenceNodes as ev}
                <option value={ev.id}>
                  [{ev.evidenceType.toUpperCase()}] {ev.label}
                </option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="relWeight">Relationship Weight: {weight}</label>
            <input
              id="relWeight"
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              bind:value={weight}
              class="form-range"
            />
          </div>

          <div class="form-group">
            <label for="relNotes">Analytical Notes</label>
            <input
              id="relNotes"
              type="text"
              bind:value={notes}
              placeholder="e.g. Timestamps match within 3 seconds of server login event"
              class="form-input"
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" on:click={() => (showAddRelModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" disabled={submittingRel}>
              {submittingRel ? 'Creating...' : 'Establish Edge in Graph'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .graph-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .graph-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .graph-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .graph-canvas-box {
    position: relative;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    overflow: hidden;
  }

  .graph-legend {
    position: absolute;
    top: 1rem;
    left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    background-color: rgba(10, 14, 23, 0.85);
    border: 1px solid var(--border-color);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    z-index: 10;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .graph-svg {
    width: 100%;
    height: auto;
    max-height: 480px;
  }

  .node-label {
    paint-order: stroke;
    stroke: var(--bg-primary);
    stroke-width: 3px;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
  }

  .modal-card {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    width: 100%;
    max-width: 520px;
    padding: 1.75rem;
    box-shadow: 0 15px 30px rgba(0,0,0,0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
  }

  .modal-header h3 {
    font-size: 1.25rem;
    font-weight: 700;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.25rem;
    cursor: pointer;
  }

  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
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

  .form-input, .form-range {
    background-color: var(--bg-primary);
    border: 1px solid var(--border-color);
    color: var(--text-primary);
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    font-size: 0.875rem;
    outline: none;
    font-family: inherit;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
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
