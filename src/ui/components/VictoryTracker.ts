/**
 * Victory Tracker Component
 *
 * Displays progress toward each possible victory condition with progress bars,
 * warnings for loss conditions, and distance-to-victory calculations.
 */

import { GameState } from '../../core/types.js';
import {
  calculateVictoryProgress,
  getVictoryDistances,
  getClosestVictory,
  getMostUrgentThreat,
  VictoryProgress,
  VictoryDistances,
  VictoryType,
  LossType,
} from '../../core/victoryConditions.js';
import { createElement, createSvgElement } from './base.js';

export interface VictoryTrackerOptions {
  collapsed?: boolean;
  showDistances?: boolean;
  onToggle?: (collapsed: boolean) => void;
}

const VICTORY_ICONS: Record<VictoryType | LossType, string> = {
  safe_agi: '🧠',
  dominant: '👑',
  public_trust: '🤝',
  regulatory: '📜',
  alliance: '🌐',
  control: '🔒',
  catastrophe: '💥',
  obsolescence: '📉',
  collapse: '🏚️',
  coup: '⚔️',
};

const VICTORY_COLORS: Record<VictoryType | LossType, string> = {
  safe_agi: '#4CAF50',
  dominant: '#9C27B0',
  public_trust: '#2196F3',
  regulatory: '#FF9800',
  alliance: '#00BCD4',
  control: '#795548',
  catastrophe: '#f44336',
  obsolescence: '#FF5722',
  collapse: '#E91E63',
  coup: '#9E9E9E',
};

/**
 * Render the Victory Tracker panel
 */
export function renderVictoryTracker(
  state: GameState,
  factionId: string,
  options: VictoryTrackerOptions = {}
): HTMLElement {
  const {
    collapsed = false,
    showDistances = true,
    onToggle,
  } = options;

  const progress = calculateVictoryProgress(state, factionId);
  const distances = showDistances ? getVictoryDistances(state, factionId) : null;
  const closestVictory = getClosestVictory(state, factionId);
  const urgentThreat = getMostUrgentThreat(state, factionId);

  const container = createElement('div', {
    className: `victory-tracker ${collapsed ? 'victory-tracker--collapsed' : ''}`,
  });

  // Header with toggle
  const header = createElement('div', { className: 'victory-tracker__header' });

  const title = createElement('h3', {
    className: 'victory-tracker__title',
    textContent: 'Victory Conditions',
  });

  const toggleBtn = createElement('button', {
    className: 'victory-tracker__toggle',
    textContent: collapsed ? '▼' : '▲',
    onclick: () => onToggle?.(!collapsed),
  });

  header.appendChild(title);
  header.appendChild(toggleBtn);
  container.appendChild(header);

  // Summary bar (always visible)
  const summary = createElement('div', { className: 'victory-tracker__summary' });

  if (closestVictory) {
    const closestEl = createElement('span', {
      className: 'victory-tracker__closest',
      innerHTML: `${VICTORY_ICONS[closestVictory.type]} Closest: <strong>${closestVictory.label}</strong> (${(100 - closestVictory.distance).toFixed(0)}%)`,
    });
    summary.appendChild(closestEl);
  }

  if (urgentThreat && urgentThreat.urgency > 50) {
    const threatEl = createElement('span', {
      className: 'victory-tracker__threat',
      innerHTML: `${VICTORY_ICONS[urgentThreat.type]} Warning: <strong>${urgentThreat.label}</strong> (${urgentThreat.urgency.toFixed(0)}% risk)`,
    });
    summary.appendChild(threatEl);
  }

  container.appendChild(summary);

  // Collapsible content
  if (!collapsed) {
    const content = createElement('div', { className: 'victory-tracker__content' });

    // Victory conditions section
    const victoriesSection = createElement('div', { className: 'victory-tracker__section' });
    const victoriesTitle = createElement('h4', {
      className: 'victory-tracker__section-title',
      textContent: 'Victory Paths',
    });
    victoriesSection.appendChild(victoriesTitle);

    const victoryItems = progress.filter(p => !p.isWarning);
    for (const item of victoryItems) {
      victoriesSection.appendChild(renderProgressItem(item, distances));
    }

    content.appendChild(victoriesSection);

    // Warnings section (if any)
    const warningItems = progress.filter(p => p.isWarning);
    if (warningItems.length > 0) {
      const warningsSection = createElement('div', { className: 'victory-tracker__section victory-tracker__section--warnings' });
      const warningsTitle = createElement('h4', {
        className: 'victory-tracker__section-title',
        textContent: 'Threats',
      });
      warningsSection.appendChild(warningsTitle);

      for (const item of warningItems) {
        warningsSection.appendChild(renderProgressItem(item, distances));
      }

      content.appendChild(warningsSection);
    }

    container.appendChild(content);
  }

  return container;
}

/**
 * Render a single progress item with bar and details
 */
function renderProgressItem(
  item: VictoryProgress,
  distances: VictoryDistances | null
): HTMLElement {
  const container = createElement('div', {
    className: `victory-tracker__item ${item.isWarning ? 'victory-tracker__item--warning' : ''}`,
  });

  // Header row
  const headerRow = createElement('div', { className: 'victory-tracker__item-header' });

  const icon = createElement('span', {
    className: 'victory-tracker__item-icon',
    textContent: VICTORY_ICONS[item.type],
  });

  const label = createElement('span', {
    className: 'victory-tracker__item-label',
    textContent: item.label,
  });

  const percentage = createElement('span', {
    className: 'victory-tracker__item-percentage',
    textContent: `${item.progress}%`,
  });

  headerRow.appendChild(icon);
  headerRow.appendChild(label);
  headerRow.appendChild(percentage);
  container.appendChild(headerRow);

  // Progress bar
  const barContainer = createElement('div', { className: 'victory-tracker__bar-container' });
  const bar = createElement('div', {
    className: 'victory-tracker__bar',
    style: `width: ${item.progress}%; background-color: ${VICTORY_COLORS[item.type]};`,
  });
  barContainer.appendChild(bar);

  // Threshold marker at 100%
  if (!item.isWarning) {
    const marker = createElement('div', {
      className: 'victory-tracker__threshold-marker',
      style: 'left: 100%;',
    });
    barContainer.appendChild(marker);
  }

  container.appendChild(barContainer);

  // Current status
  const status = createElement('div', {
    className: 'victory-tracker__item-status',
    textContent: item.currentStatus,
  });
  container.appendChild(status);

  // Requirements tooltip/details (collapsible)
  if (item.requirements.length > 0) {
    const reqContainer = createElement('div', { className: 'victory-tracker__requirements' });
    const reqList = createElement('ul', { className: 'victory-tracker__req-list' });

    for (const req of item.requirements) {
      const li = createElement('li', { textContent: req });
      reqList.appendChild(li);
    }

    reqContainer.appendChild(reqList);
    container.appendChild(reqContainer);
  }

  return container;
}

/**
 * Render a compact victory summary for the header/dashboard
 */
export function renderVictorySummary(
  state: GameState,
  factionId: string
): HTMLElement {
  const closestVictory = getClosestVictory(state, factionId);
  const urgentThreat = getMostUrgentThreat(state, factionId);

  const container = createElement('div', { className: 'victory-summary' });

  if (closestVictory) {
    const victoryEl = createElement('div', {
      className: 'victory-summary__closest',
      innerHTML: `<span class="victory-summary__icon">${VICTORY_ICONS[closestVictory.type]}</span>
                  <span class="victory-summary__label">${closestVictory.label}</span>
                  <span class="victory-summary__progress">${(100 - closestVictory.distance).toFixed(0)}%</span>`,
    });
    container.appendChild(victoryEl);
  }

  if (urgentThreat && urgentThreat.urgency > 30) {
    const threatEl = createElement('div', {
      className: `victory-summary__threat ${urgentThreat.urgency > 70 ? 'victory-summary__threat--critical' : ''}`,
      innerHTML: `<span class="victory-summary__icon">${VICTORY_ICONS[urgentThreat.type]}</span>
                  <span class="victory-summary__label">${urgentThreat.label}</span>
                  <span class="victory-summary__risk">${urgentThreat.urgency.toFixed(0)}%</span>`,
    });
    container.appendChild(threatEl);
  }

  return container;
}

/**
 * Render mini progress bars for multiple victory conditions
 */
export function renderMiniVictoryBars(
  state: GameState,
  factionId: string
): HTMLElement {
  const progress = calculateVictoryProgress(state, factionId);
  const victoryItems = progress.filter(p => !p.isWarning).slice(0, 3);

  const container = createElement('div', { className: 'victory-mini-bars' });

  for (const item of victoryItems) {
    const barWrapper = createElement('div', {
      className: 'victory-mini-bars__item',
      title: `${item.label}: ${item.progress}%`,
    });

    const icon = createElement('span', {
      className: 'victory-mini-bars__icon',
      textContent: VICTORY_ICONS[item.type],
    });

    const bar = createElement('div', { className: 'victory-mini-bars__bar' });
    const fill = createElement('div', {
      className: 'victory-mini-bars__fill',
      style: `width: ${item.progress}%; background-color: ${VICTORY_COLORS[item.type]};`,
    });
    bar.appendChild(fill);

    barWrapper.appendChild(icon);
    barWrapper.appendChild(bar);
    container.appendChild(barWrapper);
  }

  return container;
}

// CSS styles for the component
export const VICTORY_TRACKER_STYLES = `
.victory-tracker {
  background: var(--panel-bg, #1a1a2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
}

.victory-tracker--collapsed .victory-tracker__content {
  display: none;
}

.victory-tracker__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.victory-tracker__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
}

.victory-tracker__toggle {
  background: none;
  border: none;
  color: var(--text-secondary, #888);
  cursor: pointer;
  font-size: 12px;
  padding: 4px 8px;
}

.victory-tracker__toggle:hover {
  color: var(--text-primary, #e0e0e0);
}

.victory-tracker__summary {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary, #888);
  padding: 4px 0;
  border-bottom: 1px solid var(--border-color, #333);
  margin-bottom: 8px;
}

.victory-tracker__closest {
  color: var(--success-color, #4CAF50);
}

.victory-tracker__threat {
  color: var(--warning-color, #FF9800);
}

.victory-tracker__content {
  margin-top: 8px;
}

.victory-tracker__section {
  margin-bottom: 16px;
}

.victory-tracker__section--warnings {
  background: rgba(244, 67, 54, 0.1);
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid var(--danger-color, #f44336);
}

.victory-tracker__section-title {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.victory-tracker__item {
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
}

.victory-tracker__item--warning {
  background: rgba(244, 67, 54, 0.05);
}

.victory-tracker__item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.victory-tracker__item-icon {
  font-size: 16px;
}

.victory-tracker__item-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
}

.victory-tracker__item-percentage {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #e0e0e0);
  min-width: 40px;
  text-align: right;
}

.victory-tracker__bar-container {
  position: relative;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.victory-tracker__bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.victory-tracker__threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.5);
  transform: translateX(-1px);
}

.victory-tracker__item-status {
  font-size: 11px;
  color: var(--text-secondary, #888);
  margin-top: 4px;
}

.victory-tracker__requirements {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color, #333);
}

.victory-tracker__req-list {
  margin: 0;
  padding-left: 16px;
  font-size: 10px;
  color: var(--text-secondary, #888);
}

.victory-tracker__req-list li {
  margin: 2px 0;
}

/* Summary component styles */
.victory-summary {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 11px;
}

.victory-summary__closest,
.victory-summary__threat {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.victory-summary__closest {
  border: 1px solid var(--success-color, #4CAF50);
}

.victory-summary__threat {
  border: 1px solid var(--warning-color, #FF9800);
}

.victory-summary__threat--critical {
  border-color: var(--danger-color, #f44336);
  background: rgba(244, 67, 54, 0.1);
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.victory-summary__icon {
  font-size: 14px;
}

.victory-summary__label {
  color: var(--text-primary, #e0e0e0);
}

.victory-summary__progress,
.victory-summary__risk {
  font-weight: 600;
}

/* Mini bars styles */
.victory-mini-bars {
  display: flex;
  gap: 8px;
}

.victory-mini-bars__item {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}

.victory-mini-bars__icon {
  font-size: 12px;
}

.victory-mini-bars__bar {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.victory-mini-bars__fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}
`;
