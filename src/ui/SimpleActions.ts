// Simple Action Buttons - Clear, usable action selection
import { ActionDefinition, ActionChoice, FactionState, GameState } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';

export interface SimpleActionCallbacks {
  onActionSelect: (actions: ActionChoice[]) => void;
}

function getActionDescription(action: ActionDefinition): string {
  switch (action.kind) {
    case 'research_capabilities': return '+12 Capability RP';
    case 'research_safety': return '+12 Safety RP';
    case 'build_compute': return '-10 Capital, +8 Compute';
    case 'deploy_products': return '+12 Capital, +2 Trust';
    case 'deploy_agi': return 'Deploy AGI (win condition)';
    case 'policy': return '+10 Policy RP, +3 Influence';
    case 'espionage': return 'Steal intel (high exposure)';
    case 'subsidize': return '-8 Capital → Target gains resources';
    case 'regulate': return 'Slow down target lab';
    case 'counterintel': return '-4 Capital, protect from espionage';
    default: return action.name;
  }
}

export function renderSimpleActions(
  container: HTMLElement,
  faction: FactionState,
  state: GameState,
  selectedActions: ActionChoice[],
  callbacks: SimpleActionCallbacks
): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'simple-actions';

  // Get allowed actions for this faction type
  const allowedActions = ACTIONS.filter(a => a.allowedFor.includes(faction.type));

  // Get other factions as targets
  const targets = Object.values(state.factions).filter(f => f.id !== faction.id);

  // Header
  const header = document.createElement('div');
  header.className = 'simple-actions__header';
  header.innerHTML = `
    <h3>Your Actions (${selectedActions.length}/2)</h3>
    <p>Select up to 2 actions per turn</p>
  `;
  wrapper.appendChild(header);

  // Selected actions display
  const selectedEl = document.createElement('div');
  selectedEl.className = 'simple-actions__selected';

  for (let i = 0; i < 2; i++) {
    const action = selectedActions[i];
    const slotEl = document.createElement('div');
    slotEl.className = 'simple-actions__slot';

    if (action) {
      const actionDef = ACTIONS.find(a => a.id === action.actionId);
      slotEl.innerHTML = `
        <span class="simple-actions__slot-num">${i + 1}.</span>
        <span class="simple-actions__slot-name">${actionDef?.name || action.actionId}</span>
        ${action.targetFactionId ? `<span class="simple-actions__slot-target">→ ${state.factions[action.targetFactionId]?.name}</span>` : ''}
        <button class="simple-actions__slot-remove" data-index="${i}">×</button>
      `;
    } else {
      slotEl.innerHTML = `
        <span class="simple-actions__slot-num">${i + 1}.</span>
        <span class="simple-actions__slot-empty">Select an action below</span>
      `;
    }

    selectedEl.appendChild(slotEl);
  }
  wrapper.appendChild(selectedEl);

  // Action buttons
  const actionsGrid = document.createElement('div');
  actionsGrid.className = 'simple-actions__grid';

  for (const action of allowedActions) {
    const needsTarget = ['espionage', 'subsidize', 'regulate'].includes(action.id);
    const isDeployAgi = action.id === 'deploy_agi';
    const canDeploy = isDeployAgi && faction.canDeployAgi;

    const btnEl = document.createElement('div');
    btnEl.className = 'simple-actions__action';
    if (isDeployAgi && !faction.canDeployAgi) {
      btnEl.classList.add('simple-actions__action--disabled');
    }

    let actionHtml = `
      <div class="simple-actions__action-name">${action.name}</div>
      <div class="simple-actions__action-desc">${getActionDescription(action)}</div>
    `;

    if (needsTarget) {
      actionHtml += `
        <select class="simple-actions__target-select" data-action="${action.id}">
          <option value="">Select target...</option>
          ${targets.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
        </select>
      `;
    } else if (isDeployAgi) {
      if (canDeploy) {
        actionHtml += `<button class="simple-actions__add-btn" data-action="${action.id}">🎯 DEPLOY AGI</button>`;
      } else {
        actionHtml += `<div class="simple-actions__locked">Requires Superintelligence tech</div>`;
      }
    } else {
      actionHtml += `<button class="simple-actions__add-btn" data-action="${action.id}">+ Add</button>`;
    }

    btnEl.innerHTML = actionHtml;
    actionsGrid.appendChild(btnEl);
  }

  wrapper.appendChild(actionsGrid);
  container.appendChild(wrapper);

  // Bind events
  container.querySelectorAll<HTMLButtonElement>('.simple-actions__add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const actionId = btn.dataset.action!;
      if (selectedActions.length < 2) {
        callbacks.onActionSelect([...selectedActions, { actionId, openness: 'open' }]);
      }
    });
  });

  container.querySelectorAll<HTMLSelectElement>('.simple-actions__target-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const actionId = sel.dataset.action!;
      const targetId = sel.value;
      if (targetId && selectedActions.length < 2) {
        callbacks.onActionSelect([...selectedActions, { actionId, openness: 'secret', targetFactionId: targetId }]);
        sel.value = '';
      }
    });
  });

  container.querySelectorAll<HTMLButtonElement>('.simple-actions__slot-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index!);
      const newActions = selectedActions.filter((_, i) => i !== index);
      callbacks.onActionSelect(newActions);
    });
  });
}
