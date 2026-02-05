// Action selector component - complete action row
// Combines: action dropdown, openness toggle, risk indicator, target selector
// Shows inline effect preview: "+12 RP Capabilities - Exposure: 1"
// Target selector only visible when action requires it
// Highlights active row

import { ActionDefinition, ActionChoice, Openness, BranchId, ResourceKey } from '../../core/types.js';
import { div, span, el } from './base.js';
import { renderRiskIndicator, getExposureLabel } from './RiskIndicator.js';
import { renderOpennessToggle } from './OpennessToggle.js';

export interface ActionTarget {
  id: string;
  name: string;
}

/**
 * Actions that require a target faction to be selected
 */
const TARGETED_ACTIONS = new Set(['espionage', 'subsidize', 'regulate']);

/**
 * Check if an action requires a target
 */
export function needsTarget(actionId: string): boolean {
  return TARGETED_ACTIONS.has(actionId);
}

/**
 * Format the effect preview string for an action
 */
function formatEffectPreview(action: ActionDefinition): string {
  const parts: string[] = [];

  // Research effects
  for (const [branch, amount] of Object.entries(action.baseResearch)) {
    if (amount && amount > 0) {
      const branchLabel = (branch as BranchId).charAt(0).toUpperCase() + branch.slice(1);
      parts.push(`+${amount} RP ${branchLabel}`);
    }
  }

  // Resource effects
  for (const [resource, delta] of Object.entries(action.baseResourceDelta)) {
    if (delta && delta !== 0) {
      const sign = delta > 0 ? '+' : '';
      const resourceLabel = (resource as ResourceKey).charAt(0).toUpperCase() + resource.slice(1);
      parts.push(`${sign}${delta} ${resourceLabel}`);
    }
  }

  // Handle special actions with no base effects
  if (parts.length === 0) {
    switch (action.kind) {
      case 'espionage':
        return 'Steal intel from target';
      case 'deploy_agi':
        return 'Deploy AGI (if unlocked)';
      case 'regulate':
        return 'Apply regulations to target lab';
      default:
        return 'Special action';
    }
  }

  return parts.join(' | ');
}

/**
 * Renders a single action selector row.
 *
 * CSS classes needed:
 * - .action-selector: Container for the row
 * - .action-selector--active: Active/highlighted state
 * - .action-selector__dropdown: Action dropdown container
 * - .action-selector__select: The select element
 * - .action-selector__toggle: Openness toggle container
 * - .action-selector__risk: Risk indicator container
 * - .action-selector__target: Target selector container
 * - .action-selector__target--hidden: Hide target when not needed
 * - .action-selector__preview: Effect preview container
 * - .action-selector__preview-text: The preview text
 *
 * @param allowedActions - Actions available to this faction
 * @param targets - Possible target factions
 * @param value - Current action choice
 * @param onChange - Callback when any value changes
 * @param isActive - Whether this row is currently active/selected
 */
export function renderActionSelector(
  allowedActions: ActionDefinition[],
  targets: ActionTarget[],
  value: ActionChoice,
  onChange: (choice: ActionChoice) => void,
  isActive: boolean
): HTMLElement {
  const container = div({
    className: `action-selector ${isActive ? 'action-selector--active' : ''}`,
  });

  const currentAction = allowedActions.find((a) => a.id === value.actionId) || allowedActions[0];
  const requiresTarget = needsTarget(value.actionId);

  // === Row 1: Controls (dropdown, toggle, risk, target) ===
  const controlsRow = div({ className: 'action-selector__controls' });

  // Action dropdown
  const dropdownContainer = div({ className: 'action-selector__dropdown' });
  const select = el('select', { className: 'action-selector__select' }) as HTMLSelectElement;

  for (const action of allowedActions) {
    const option = document.createElement('option');
    option.value = action.id;
    option.textContent = action.name;
    if (action.id === value.actionId) {
      option.selected = true;
    }
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    const newActionId = select.value;
    const newAction = allowedActions.find((a) => a.id === newActionId);
    onChange({
      ...value,
      actionId: newActionId,
      // Clear target if new action doesn't need one
      targetFactionId: needsTarget(newActionId) ? value.targetFactionId : undefined,
    });
  });

  dropdownContainer.appendChild(select);
  controlsRow.appendChild(dropdownContainer);

  // Openness toggle
  const toggleContainer = div({ className: 'action-selector__toggle' });
  const toggle = renderOpennessToggle(value.openness, (newOpenness: Openness) => {
    onChange({ ...value, openness: newOpenness });
  });
  toggleContainer.appendChild(toggle);
  controlsRow.appendChild(toggleContainer);

  // Risk indicator
  const riskContainer = div({ className: 'action-selector__risk' });
  const riskIndicator = renderRiskIndicator(currentAction?.exposure ?? 0);
  riskContainer.appendChild(riskIndicator);

  // Add exposure label
  const riskLabel = span({
    className: 'action-selector__risk-label',
    text: getExposureLabel(currentAction?.exposure ?? 0),
  });
  riskContainer.appendChild(riskLabel);
  controlsRow.appendChild(riskContainer);

  // Target selector (conditionally visible)
  const targetContainer = div({
    className: `action-selector__target ${requiresTarget ? '' : 'action-selector__target--hidden'}`,
  });

  const targetSelect = el('select', {
    className: 'action-selector__target-select',
  }) as HTMLSelectElement;

  // Empty option
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Select target...';
  targetSelect.appendChild(emptyOption);

  for (const target of targets) {
    const option = document.createElement('option');
    option.value = target.id;
    option.textContent = target.name;
    if (target.id === value.targetFactionId) {
      option.selected = true;
    }
    targetSelect.appendChild(option);
  }

  targetSelect.disabled = !requiresTarget;

  targetSelect.addEventListener('change', () => {
    onChange({
      ...value,
      targetFactionId: targetSelect.value || undefined,
    });
  });

  targetContainer.appendChild(targetSelect);
  controlsRow.appendChild(targetContainer);

  container.appendChild(controlsRow);

  // === Row 2: Effect preview ===
  const previewRow = div({ className: 'action-selector__preview' });
  const previewText = span({
    className: 'action-selector__preview-text',
    text: formatEffectPreview(currentAction),
  });
  previewRow.appendChild(previewText);

  // Add exposure info to preview
  const exposureInfo = span({
    className: 'action-selector__exposure-info',
    text: ` | Exposure: ${currentAction?.exposure ?? 0}`,
  });
  previewRow.appendChild(exposureInfo);

  container.appendChild(previewRow);

  return container;
}

/**
 * Renders the complete orders panel with multiple action rows.
 *
 * CSS classes needed:
 * - .orders-panel: Container for all order rows
 * - .orders-panel__header: Header with title
 * - .orders-panel__title: Title text
 * - .orders-panel__list: Container for action rows
 * - .orders-panel__row: Individual row wrapper
 * - .orders-panel__row-number: Row number indicator
 * - .orders-panel__hint: Hint text at bottom
 *
 * @param allowedActions - Actions available to the player faction
 * @param targets - Possible target factions
 * @param orders - Current orders array
 * @param onOrderChange - Callback when an order changes
 * @param activeIndex - Currently active/selected row index
 * @param onActiveChange - Callback when active row changes
 */
export function renderOrdersPanel(
  allowedActions: ActionDefinition[],
  targets: ActionTarget[],
  orders: ActionChoice[],
  onOrderChange: (index: number, choice: ActionChoice) => void,
  activeIndex: number,
  onActiveChange: (index: number) => void
): HTMLElement {
  const panel = div({ className: 'orders-panel' });

  // Header
  const header = div({ className: 'orders-panel__header' });
  const title = el('h3', {
    className: 'orders-panel__title',
    text: 'Orders',
  });
  header.appendChild(title);
  panel.appendChild(header);

  // Orders list
  const list = div({ className: 'orders-panel__list' });

  orders.forEach((order, index) => {
    const rowWrapper = div({
      className: `orders-panel__row ${index === activeIndex ? 'orders-panel__row--active' : ''}`,
      onClick: () => onActiveChange(index),
    });

    // Row number
    const rowNumber = span({
      className: 'orders-panel__row-number',
      text: `${index + 1}`,
    });
    rowWrapper.appendChild(rowNumber);

    // Action selector
    const selector = renderActionSelector(
      allowedActions,
      targets,
      order,
      (newChoice) => onOrderChange(index, newChoice),
      index === activeIndex
    );
    rowWrapper.appendChild(selector);

    list.appendChild(rowWrapper);
  });

  panel.appendChild(list);

  // Hint
  const hint = div({
    className: 'orders-panel__hint',
    text: 'Click a row to select it, then use the Tech Tree to set research focus',
  });
  panel.appendChild(hint);

  return panel;
}
