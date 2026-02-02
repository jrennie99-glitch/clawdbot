/**
 * Security Dashboard View - SUPER SUPREME GOD MODE
 */

import { html, nothing, type TemplateResult } from "lit";
import type { MoltbotApp } from "../app.js";
import {
  loadSecurityStatus,
  toggleKillSwitch,
  toggleLockdown,
  loadPolicyDecisions,
  loadPendingApprovals,
  approvePending,
  denyPending,
  loadAttacks,
  loadQuarantine,
  deleteQuarantineEntry,
  loadCostStatus,
  type SecurityStatus,
  type PolicyDecision,
  type PendingApproval,
  type AttackEntry,
  type QuarantineEntry,
  type CostStatus,
} from "../controllers/security.js";

// State stored in app
interface SecurityViewState {
  status: SecurityStatus | null;
  decisions: PolicyDecision[];
  pending: PendingApproval[];
  attacks: AttackEntry[];
  quarantine: QuarantineEntry[];
  cost: CostStatus | null;
  loading: boolean;
  error: string | null;
  killSwitchConfirmCode: string;
}

const securityState: SecurityViewState = {
  status: null,
  decisions: [],
  pending: [],
  attacks: [],
  quarantine: [],
  cost: null,
  loading: false,
  error: null,
  killSwitchConfirmCode: "",
};

export async function loadSecurityData(state: MoltbotApp): Promise<void> {
  securityState.loading = true;
  securityState.error = null;
  state.requestUpdate();

  try {
    const [status, decisions, pending, attacks, quarantine, cost] = await Promise.all([
      loadSecurityStatus(state),
      loadPolicyDecisions(state),
      loadPendingApprovals(state),
      loadAttacks(state),
      loadQuarantine(state),
      loadCostStatus(state),
    ]);

    securityState.status = status;
    securityState.decisions = decisions;
    securityState.pending = pending;
    securityState.attacks = attacks;
    securityState.quarantine = quarantine;
    securityState.cost = cost;
  } catch (err) {
    securityState.error = String(err);
  } finally {
    securityState.loading = false;
    state.requestUpdate();
  }
}

async function handleKillSwitchToggle(state: MoltbotApp, enabled: boolean): Promise<void> {
  const confirmCode = enabled ? undefined : securityState.killSwitchConfirmCode || "CONFIRM_DEACTIVATE";
  const success = await toggleKillSwitch(state, enabled, confirmCode);
  if (success) {
    await loadSecurityData(state);
  } else {
    securityState.error = enabled ? "Failed to activate kill switch" : "Failed to deactivate - check confirmation code";
    state.requestUpdate();
  }
}

async function handleLockdownToggle(state: MoltbotApp, enabled: boolean): Promise<void> {
  const success = await toggleLockdown(state, enabled);
  if (success) {
    await loadSecurityData(state);
  } else {
    securityState.error = "Failed to toggle lockdown mode";
    state.requestUpdate();
  }
}

async function handleApprovePending(state: MoltbotApp, previewId: string): Promise<void> {
  await approvePending(state, previewId);
  await loadSecurityData(state);
}

async function handleDenyPending(state: MoltbotApp, previewId: string): Promise<void> {
  await denyPending(state, previewId, "Denied via dashboard");
  await loadSecurityData(state);
}

async function handleDeleteQuarantine(state: MoltbotApp, id: string): Promise<void> {
  await deleteQuarantineEntry(state, id);
  await loadSecurityData(state);
}

function renderGlobalControls(state: MoltbotApp): TemplateResult {
  const { status } = securityState;
  const killSwitchEnabled = status?.killSwitch?.enabled ?? false;
  const lockdownEnabled = status?.lockdown?.enabled ?? false;

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Global Controls</h3>
      <div class="security-controls">
        <div class="security-control security-control--danger">
          <div class="security-control__header">
            <span class="security-control__label">Kill Switch</span>
            <span class="security-control__status ${killSwitchEnabled ? 'security-control__status--active' : ''}">
              ${killSwitchEnabled ? "🔴 ACTIVE" : "⚪ Inactive"}
            </span>
          </div>
          <p class="security-control__desc">Instantly blocks ALL tool execution when active.</p>
          ${killSwitchEnabled ? html`
            <div class="security-control__deactivate">
              <input
                type="text"
                class="security-input"
                placeholder="Confirmation code"
                .value=${securityState.killSwitchConfirmCode}
                @input=${(e: Event) => {
                  securityState.killSwitchConfirmCode = (e.target as HTMLInputElement).value;
                  state.requestUpdate();
                }}
              />
              <button class="security-btn security-btn--warning" @click=${() => handleKillSwitchToggle(state, false)}>
                Deactivate
              </button>
            </div>
          ` : html`
            <button class="security-btn security-btn--danger" @click=${() => handleKillSwitchToggle(state, true)}>
              Activate Kill Switch
            </button>
          `}
        </div>

        <div class="security-control">
          <div class="security-control__header">
            <span class="security-control__label">Lockdown Mode</span>
            <span class="security-control__status ${lockdownEnabled ? 'security-control__status--active' : ''}">
              ${lockdownEnabled ? "🟡 ENABLED" : "⚪ Disabled"}
            </span>
          </div>
          <p class="security-control__desc">Forces confirmation for all sensitive operations.</p>
          <button
            class="security-btn ${lockdownEnabled ? 'security-btn--secondary' : 'security-btn--primary'}"
            @click=${() => handleLockdownToggle(state, !lockdownEnabled)}
          >
            ${lockdownEnabled ? "Disable Lockdown" : "Enable Lockdown"}
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderPolicyDecisions(): TemplateResult {
  const { decisions } = securityState;

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Recent Policy Decisions</h3>
      ${decisions.length === 0 ? html`
        <p class="security-empty">No policy decisions recorded yet.</p>
      ` : html`
        <div class="security-table-wrap">
          <table class="security-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Tool</th>
                <th>Decision</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              ${decisions.slice(0, 20).map(d => html`
                <tr class="security-row security-row--${d.decision.toLowerCase()}">
                  <td>${new Date(d.timestamp).toLocaleTimeString()}</td>
                  <td>${d.tool}${d.action ? `/${d.action}` : ""}</td>
                  <td>
                    <span class="security-badge security-badge--${d.decision.toLowerCase().replace("_", "-")}">
                      ${d.decision}
                    </span>
                  </td>
                  <td class="security-reason">${d.reason}</td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;
}

function renderPendingApprovals(state: MoltbotApp): TemplateResult {
  const { pending } = securityState;

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Pending Confirmations</h3>
      ${pending.length === 0 ? html`
        <p class="security-empty">No pending confirmations.</p>
      ` : html`
        <div class="security-pending-list">
          ${pending.map(p => html`
            <div class="security-pending-item">
              <div class="security-pending-info">
                <strong>${p.tool}</strong>
                ${p.action ? html` / ${p.action}` : nothing}
                <span class="security-pending-time">Expires: ${new Date(p.expiresAt).toLocaleTimeString()}</span>
              </div>
              <div class="security-pending-actions">
                <button class="security-btn security-btn--success" @click=${() => handleApprovePending(state, p.previewId)}>
                  Approve
                </button>
                <button class="security-btn security-btn--danger" @click=${() => handleDenyPending(state, p.previewId)}>
                  Deny
                </button>
              </div>
            </div>
          `)}
        </div>
      `}
    </section>
  `;
}

function renderBlockedEvents(): TemplateResult {
  const { attacks } = securityState;

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Blocked Events</h3>
      ${attacks.length === 0 ? html`
        <p class="security-empty">No blocked events recorded.</p>
      ` : html`
        <div class="security-table-wrap">
          <table class="security-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Source</th>
                <th>Type</th>
                <th>Blocked</th>
              </tr>
            </thead>
            <tbody>
              ${attacks.slice(0, 20).map(a => html`
                <tr>
                  <td>${new Date(a.timestamp).toLocaleTimeString()}</td>
                  <td>${a.source}</td>
                  <td>${a.patterns.map(p => p.pattern).join(", ")}</td>
                  <td>
                    <span class="security-badge ${a.blocked ? 'security-badge--deny' : 'security-badge--allow'}">
                      ${a.blocked ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;
}

function renderCostStatus(): TemplateResult {
  const { cost } = securityState;

  if (!cost) {
    return html`<section class="security-section"><p class="security-empty">Cost data unavailable.</p></section>`;
  }

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Cost & Model Usage</h3>
      <div class="security-cost-grid">
        <div class="security-cost-item">
          <span class="security-cost-label">Current Tier</span>
          <span class="security-cost-value security-cost-value--tier">${cost.tier}</span>
        </div>
        <div class="security-cost-item">
          <span class="security-cost-label">Daily Cost</span>
          <span class="security-cost-value">$${cost.dailyCost} / $${cost.dailyLimit}</span>
        </div>
        <div class="security-cost-item">
          <span class="security-cost-label">Run Cost</span>
          <span class="security-cost-value">$${cost.runCost} / $${cost.runLimit}</span>
        </div>
        <div class="security-cost-item">
          <span class="security-cost-label">Providers</span>
          <span class="security-cost-value">${cost.providers.map(p => p.id).join(", ") || "None"}</span>
        </div>
      </div>
    </section>
  `;
}

function renderQuarantine(state: MoltbotApp): TemplateResult {
  const { quarantine } = securityState;

  return html`
    <section class="security-section">
      <h3 class="security-section__title">Memory Quarantine</h3>
      ${quarantine.length === 0 ? html`
        <p class="security-empty">No quarantined entries.</p>
      ` : html`
        <div class="security-table-wrap">
          <table class="security-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Trust</th>
                <th>Preview</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${quarantine.map(q => html`
                <tr>
                  <td>${q.source}</td>
                  <td>
                    <span class="security-badge security-badge--${q.trustLevel}">${q.trustLevel}</span>
                  </td>
                  <td class="security-preview">${q.contentPreview}</td>
                  <td>${new Date(q.expiresAt).toLocaleTimeString()}</td>
                  <td>
                    <button class="security-btn security-btn--small security-btn--danger" @click=${() => handleDeleteQuarantine(state, q.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      `}
    </section>
  `;
}

export function renderSecurityView(state: MoltbotApp): TemplateResult {
  const { loading, error } = securityState;

  return html`
    <div class="security-dashboard">
      <div class="security-header">
        <h2 class="security-title">Security Dashboard</h2>
        <button class="security-btn security-btn--secondary" @click=${() => loadSecurityData(state)} ?disabled=${loading}>
          ${loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      ${error ? html`<div class="security-error">${error}</div>` : nothing}

      ${renderGlobalControls(state)}
      ${renderPendingApprovals(state)}
      ${renderPolicyDecisions()}
      ${renderBlockedEvents()}
      ${renderCostStatus()}
      ${renderQuarantine(state)}
    </div>

    <style>
      .security-dashboard {
        padding: 1.5rem;
        max-width: 1200px;
        margin: 0 auto;
      }
      .security-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
      }
      .security-title {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0;
      }
      .security-section {
        background: var(--color-surface, #1a1a2e);
        border: 1px solid var(--color-border, #333);
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .security-section__title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 1rem 0;
        color: var(--color-text-secondary, #aaa);
      }
      .security-controls {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 1rem;
      }
      .security-control {
        background: var(--color-surface-elevated, #252540);
        border: 1px solid var(--color-border, #333);
        border-radius: 6px;
        padding: 1rem;
      }
      .security-control--danger {
        border-color: #dc3545;
      }
      .security-control__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .security-control__label {
        font-weight: 600;
      }
      .security-control__status {
        font-size: 0.875rem;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        background: var(--color-surface, #1a1a2e);
      }
      .security-control__status--active {
        background: #dc354520;
        color: #dc3545;
      }
      .security-control__desc {
        font-size: 0.875rem;
        color: var(--color-text-secondary, #888);
        margin: 0 0 1rem 0;
      }
      .security-control__deactivate {
        display: flex;
        gap: 0.5rem;
      }
      .security-input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid var(--color-border, #333);
        border-radius: 4px;
        background: var(--color-surface, #1a1a2e);
        color: var(--color-text, #fff);
      }
      .security-btn {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.2s;
      }
      .security-btn:hover {
        opacity: 0.9;
      }
      .security-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .security-btn--primary {
        background: #0d6efd;
        color: white;
      }
      .security-btn--secondary {
        background: var(--color-surface-elevated, #333);
        color: var(--color-text, #fff);
      }
      .security-btn--danger {
        background: #dc3545;
        color: white;
      }
      .security-btn--warning {
        background: #ffc107;
        color: black;
      }
      .security-btn--success {
        background: #198754;
        color: white;
      }
      .security-btn--small {
        padding: 0.25rem 0.5rem;
        font-size: 0.75rem;
      }
      .security-table-wrap {
        overflow-x: auto;
      }
      .security-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      .security-table th,
      .security-table td {
        padding: 0.5rem;
        text-align: left;
        border-bottom: 1px solid var(--color-border, #333);
      }
      .security-table th {
        color: var(--color-text-secondary, #888);
        font-weight: 500;
      }
      .security-badge {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
      }
      .security-badge--allow {
        background: #19875420;
        color: #198754;
      }
      .security-badge--deny {
        background: #dc354520;
        color: #dc3545;
      }
      .security-badge--require-confirmation {
        background: #ffc10720;
        color: #ffc107;
      }
      .security-badge--untrusted {
        background: #dc354520;
        color: #dc3545;
      }
      .security-badge--quarantined {
        background: #ffc10720;
        color: #ffc107;
      }
      .security-badge--trusted {
        background: #19875420;
        color: #198754;
      }
      .security-reason {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .security-preview {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-family: monospace;
        font-size: 0.75rem;
      }
      .security-pending-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .security-pending-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        background: var(--color-surface-elevated, #252540);
        border-radius: 4px;
      }
      .security-pending-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .security-pending-time {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #888);
      }
      .security-pending-actions {
        display: flex;
        gap: 0.5rem;
      }
      .security-cost-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
      }
      .security-cost-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .security-cost-label {
        font-size: 0.75rem;
        color: var(--color-text-secondary, #888);
      }
      .security-cost-value {
        font-size: 1rem;
        font-weight: 600;
      }
      .security-cost-value--tier {
        color: #0d6efd;
      }
      .security-empty {
        color: var(--color-text-secondary, #888);
        font-style: italic;
      }
      .security-error {
        background: #dc354520;
        color: #dc3545;
        padding: 0.75rem;
        border-radius: 4px;
        margin-bottom: 1rem;
      }
    </style>
  `;
}
