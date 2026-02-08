// CompactActionsPanel - Simplified right panel for AGI Race
// 320px fixed width, no scrolling needed
// Contains: turn indicator, advance button, faction selector, directive input, gamemaster button

import { div, span, el, button } from './base.js';
import type { FactionState, GameState } from '../../core/types.js';

/**
 * Options for the CompactActionsPanel
 */
export interface CompactActionsPanelOptions {
  /** Current game state */
  gameState: GameState;
  /** Currently selected player faction ID */
  playerFactionId: string;
  /** List of playable factions */
  factions: FactionState[];
  /** Number of pending events to display */
  pendingEventCount: number;
  /** Current directive text */
  directiveText: string;
}

/**
 * Callbacks for the CompactActionsPanel
 */
export interface CompactActionsPanelCallbacks {
  /** Called when the Advance Quarter button is clicked */
  onAdvanceTurn: () => void;
  /** Called when player faction selection changes */
  onFactionChange: (factionId: string) => void;
  /** Called when directive text changes */
  onDirectiveChange: (text: string) => void;
  /** Called when Ask Gamemaster button is clicked (should open modal) */
  onAskGamemaster: () => void;
  /** Called when event notification badge is clicked */
  onEventClick: () => void;
  /** Called when Reset button is clicked */
  onReset: () => void;
  /** Called when Stats button is clicked */
  onStats: () => void;
  /** Called when Help button is clicked */
  onHelp: () => void;
}

/**
 * CSS styles for the CompactActionsPanel
 * These styles work with both light and dark themes via CSS variables
 */
export const COMPACT_ACTIONS_PANEL_STYLES = `
/* Compact Actions Panel - 320px fixed width */
.compact-actions-panel {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  background: var(--panel);
  border-radius: 2px;
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
}

/* Turn Indicator Header */
.compact-actions-panel__turn {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}

.compact-actions-panel__turn-date {
  font-family: var(--serif), Georgia, serif;
  font-size: 24px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: 0.02em;
}

.compact-actions-panel__turn-number {
  font-size: 13px;
  color: var(--muted);
  font-family: 'IBM Plex Mono', monospace;
}

/* Advance Quarter Button */
.compact-actions-panel__advance-btn {
  width: 100%;
  padding: 14px 20px;
  background: var(--accent);
  border: none;
  border-radius: 2px;
  color: white;
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font), sans-serif;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.compact-actions-panel__advance-btn:hover {
  background: var(--accent-bright);
  transform: translateY(-1px);
}

.compact-actions-panel__advance-btn:active {
  transform: translateY(0);
}

.compact-actions-panel__advance-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* Section styling */
.compact-actions-panel__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compact-actions-panel__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Faction Selector Dropdown */
.compact-actions-panel__faction-select {
  width: 100%;
  padding: 10px 12px;
  background: var(--panel-soft);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--ink);
  font-size: 14px;
  font-family: var(--font), sans-serif;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237d9182' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.compact-actions-panel__faction-select:hover {
  border-color: var(--accent);
}

.compact-actions-panel__faction-select:focus {
  outline: none;
  border-color: var(--accent-bright);
  box-shadow: 0 0 0 2px rgba(61, 122, 58, 0.2);
}

/* Directive Input */
.compact-actions-panel__directive-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--panel-soft);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--ink);
  font-size: 14px;
  font-family: var(--font), sans-serif;
  transition: border-color var(--duration-fast) var(--ease-out);
}

.compact-actions-panel__directive-input::placeholder {
  color: var(--muted);
  font-style: italic;
}

.compact-actions-panel__directive-input:hover {
  border-color: var(--accent);
}

.compact-actions-panel__directive-input:focus {
  outline: none;
  border-color: var(--accent-bright);
  box-shadow: 0 0 0 2px rgba(61, 122, 58, 0.2);
}

/* Ask Gamemaster Button */
.compact-actions-panel__gamemaster-btn {
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font), sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all var(--duration-fast) var(--ease-out);
}

.compact-actions-panel__gamemaster-btn:hover {
  background: var(--panel-soft);
  border-color: var(--accent);
  color: var(--accent-bright);
}

.compact-actions-panel__gamemaster-icon {
  font-size: 16px;
}

/* Event Notification Badge */
.compact-actions-panel__event-badge {
  width: 100%;
  padding: 10px 14px;
  background: rgba(180, 76, 66, 0.1);
  border: 1px solid var(--danger);
  border-radius: 2px;
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font), sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all var(--duration-fast) var(--ease-out);
}

.compact-actions-panel__event-badge:hover {
  background: rgba(180, 76, 66, 0.2);
}

.compact-actions-panel__event-badge--hidden {
  display: none;
}

.compact-actions-panel__event-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--danger);
  color: white;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
}

/* Footer Row */
.compact-actions-panel__footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.compact-actions-panel__footer-btn {
  flex: 1;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font), sans-serif;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.compact-actions-panel__footer-btn:hover {
  background: var(--panel-soft);
  border-color: var(--accent);
  color: var(--ink);
}

.compact-actions-panel__footer-btn--icon {
  flex: 0 0 36px;
  padding: 8px;
}

`;

/**
 * Format the current turn date as "YYYY QN"
 */
function formatTurnDate(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

/**
 * Format the turn number display
 */
function formatTurnNumber(turn: number, maxTurns: number = 32): string {
  return `Turn ${turn}/${maxTurns}`;
}

/**
 * Renders the CompactActionsPanel component
 *
 * This is a simplified actions panel designed for a 320px fixed-width right sidebar.
 * It contains all the essential player controls without scrolling.
 *
 * Layout (top to bottom):
 * - Turn indicator: "2026 Q1" + "Turn 1/32"
 * - ADVANCE QUARTER button
 * - Player faction selector dropdown
 * - Directive input (freeform text, single line)
 * - "Ask Gamemaster" button
 * - Event notification badge (if pending)
 * - Footer row: Reset, Stats, Help
 */
export function renderCompactActionsPanel(
  options: CompactActionsPanelOptions,
  callbacks: CompactActionsPanelCallbacks
): HTMLElement {
  const { gameState, playerFactionId, factions, pendingEventCount, directiveText } = options;
  const {
    onAdvanceTurn,
    onFactionChange,
    onDirectiveChange,
    onAskGamemaster,
    onEventClick,
    onReset,
    onStats,
    onHelp,
  } = callbacks;

  const panel = div({ className: 'compact-actions-panel' });

  // === Turn Indicator ===
  const turnRow = div({ className: 'compact-actions-panel__turn' });

  const turnDate = span({
    className: 'compact-actions-panel__turn-date',
    text: formatTurnDate(gameState.year, gameState.quarter),
  });
  turnRow.appendChild(turnDate);

  const turnNumber = span({
    className: 'compact-actions-panel__turn-number',
    text: formatTurnNumber(gameState.turn),
  });
  turnRow.appendChild(turnNumber);

  panel.appendChild(turnRow);

  // === Advance Quarter Button ===
  const advanceBtn = el('button', {
    className: 'compact-actions-panel__advance-btn',
  }) as HTMLButtonElement;
  advanceBtn.textContent = 'Advance Quarter';
  advanceBtn.disabled = gameState.gameOver;
  advanceBtn.addEventListener('click', onAdvanceTurn);
  panel.appendChild(advanceBtn);

  // === Faction Selector Section ===
  const factionSection = div({ className: 'compact-actions-panel__section' });

  const factionLabel = span({
    className: 'compact-actions-panel__label',
    text: 'Playing As',
  });
  factionSection.appendChild(factionLabel);

  const factionSelect = el('select', {
    className: 'compact-actions-panel__faction-select',
  }) as HTMLSelectElement;

  for (const faction of factions) {
    const option = document.createElement('option');
    option.value = faction.id;
    option.textContent = faction.name;
    if (faction.id === playerFactionId) {
      option.selected = true;
    }
    factionSelect.appendChild(option);
  }

  factionSelect.addEventListener('change', () => {
    onFactionChange(factionSelect.value);
  });

  factionSection.appendChild(factionSelect);
  panel.appendChild(factionSection);

  // === Directive Input Section ===
  const directiveSection = div({ className: 'compact-actions-panel__section' });

  const directiveLabel = span({
    className: 'compact-actions-panel__label',
    text: 'Your Directive',
  });
  directiveSection.appendChild(directiveLabel);

  const directiveInput = el('input', {
    className: 'compact-actions-panel__directive-input',
  }) as HTMLInputElement;
  directiveInput.type = 'text';
  directiveInput.placeholder = 'Type your orders...';
  directiveInput.value = directiveText;

  directiveInput.addEventListener('input', () => {
    onDirectiveChange(directiveInput.value);
  });

  directiveSection.appendChild(directiveInput);
  panel.appendChild(directiveSection);

  // === Ask Gamemaster Button ===
  const gamemasterBtn = button({
    className: 'compact-actions-panel__gamemaster-btn',
    onClick: onAskGamemaster,
  });

  const gmIcon = span({
    className: 'compact-actions-panel__gamemaster-icon',
    text: '?',
  });
  gamemasterBtn.appendChild(gmIcon);
  gamemasterBtn.appendChild(document.createTextNode('Ask Gamemaster'));
  panel.appendChild(gamemasterBtn);

  // === Event Notification Badge ===
  const eventBadge = button({
    className: `compact-actions-panel__event-badge ${pendingEventCount === 0 ? 'compact-actions-panel__event-badge--hidden' : ''}`,
    onClick: onEventClick,
  });

  const alertIcon = span({ text: '!' });
  eventBadge.appendChild(alertIcon);
  eventBadge.appendChild(document.createTextNode(' Event Pending '));

  const eventCount = span({
    className: 'compact-actions-panel__event-count',
    text: String(pendingEventCount),
  });
  eventBadge.appendChild(eventCount);
  panel.appendChild(eventBadge);

  // === Footer Row ===
  const footer = div({ className: 'compact-actions-panel__footer' });

  // Reset button
  const resetBtn = button({
    className: 'compact-actions-panel__footer-btn',
    onClick: onReset,
  });
  resetBtn.textContent = 'Reset';
  footer.appendChild(resetBtn);

  // Stats button (icon)
  const statsBtn = button({
    className: 'compact-actions-panel__footer-btn compact-actions-panel__footer-btn--icon',
    onClick: onStats,
  });
  statsBtn.textContent = 'I';
  statsBtn.title = 'Intel (Stats)';
  footer.appendChild(statsBtn);

  // Help button (icon)
  const helpBtn = button({
    className: 'compact-actions-panel__footer-btn compact-actions-panel__footer-btn--icon',
    onClick: onHelp,
  });
  helpBtn.textContent = '?';
  helpBtn.title = 'Help';
  footer.appendChild(helpBtn);

  panel.appendChild(footer);

  return panel;
}

/**
 * Updates the CompactActionsPanel with new state
 * Use this for efficient updates without full re-render
 */
export function updateCompactActionsPanel(
  panel: HTMLElement,
  options: Partial<CompactActionsPanelOptions>
): void {
  // Update turn date
  if (options.gameState) {
    const turnDate = panel.querySelector('.compact-actions-panel__turn-date');
    if (turnDate) {
      turnDate.textContent = formatTurnDate(options.gameState.year, options.gameState.quarter);
    }

    const turnNumber = panel.querySelector('.compact-actions-panel__turn-number');
    if (turnNumber) {
      turnNumber.textContent = formatTurnNumber(options.gameState.turn);
    }

    // Update advance button disabled state
    const advanceBtn = panel.querySelector('.compact-actions-panel__advance-btn') as HTMLButtonElement;
    if (advanceBtn) {
      advanceBtn.disabled = options.gameState.gameOver;
    }
  }

  // Update pending event count
  if (options.pendingEventCount !== undefined) {
    const eventBadge = panel.querySelector('.compact-actions-panel__event-badge');
    if (eventBadge) {
      if (options.pendingEventCount === 0) {
        eventBadge.classList.add('compact-actions-panel__event-badge--hidden');
      } else {
        eventBadge.classList.remove('compact-actions-panel__event-badge--hidden');
        const countEl = eventBadge.querySelector('.compact-actions-panel__event-count');
        if (countEl) {
          countEl.textContent = String(options.pendingEventCount);
        }
      }
    }
  }

  // Update directive text
  if (options.directiveText !== undefined) {
    const input = panel.querySelector('.compact-actions-panel__directive-input') as HTMLInputElement;
    if (input && input.value !== options.directiveText) {
      input.value = options.directiveText;
    }
  }

  // Update faction selector
  if (options.playerFactionId !== undefined) {
    const select = panel.querySelector('.compact-actions-panel__faction-select') as HTMLSelectElement;
    if (select && select.value !== options.playerFactionId) {
      select.value = options.playerFactionId;
    }
  }
}
