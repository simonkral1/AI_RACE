/**
 * ExpandedCommandCenter Component
 *
 * The main center panel for AGI Race, replacing the tech tree as the primary view.
 * Contains all key controls and information in a 2-column grid layout.
 *
 * Layout:
 * +---------------------------+--------------------+
 * | TURN HEADER (2026 Q1)                          |
 * +---------------------------+--------------------+
 * | [ADVANCE QUARTER BUTTON - full width]          |
 * +---------------------------+--------------------+
 * | Strategic Situations      | Victory Progress   |
 * | (AI-generated cards)      | (from VictoryTracker)
 * |                           |--------------------+
 * |                           | Faction Quick Stats|
 * +---------------------------+--------------------+
 * | Directive Input (full width)                   |
 * +---------------------------+--------------------+
 * | [Tech Tree] [Gamemaster] [Events Badge]        |
 * +---------------------------+--------------------+
 * | Recent Log (last 3-5 entries)                  |
 * +---------------------------+--------------------+
 * | [Reset] [Stats] [Keys]                         |
 * +---------------------------+--------------------+
 */

import { div, span, el, button } from './base.js';
import { renderMiniVictoryBars } from './VictoryTracker.js';
import type { GameState, FactionState } from '../../core/types.js';

export interface ExpandedCommandCenterOptions {
  /** Current game state */
  gameState: GameState;
  /** Currently selected player faction ID */
  playerFactionId: string;
  /** Whether the campaign has started */
  campaignStarted: boolean;
  /** Pending event (if any) */
  hasPendingEvent: boolean;
  /** Pending event count */
  pendingEventCount: number;
  /** Current directive text */
  directiveText: string;
  /** Recent log entries */
  recentLog: string[];
  /** Strategic situations (AI-generated) */
  situations?: StrategicSituation[];
}

export interface StrategicSituation {
  id: string;
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  potentialResponses: {
    id: string;
    title: string;
    description: string;
  }[];
}

export interface ExpandedCommandCenterCallbacks {
  /** Called when the Advance Quarter button is clicked */
  onAdvanceTurn: () => void;
  /** Called when directive text is submitted */
  onDirectiveSubmit: (text: string) => void;
  /** Called when Tech Tree button is clicked (opens modal) */
  onOpenTechTree: () => void;
  /** Called when Ask Gamemaster button is clicked (opens modal) */
  onOpenGamemaster: () => void;
  /** Called when event badge is clicked */
  onEventClick: () => void;
  /** Called when Reset button is clicked */
  onReset: () => void;
  /** Called when Stats button is clicked */
  onStats: () => void;
  /** Called when Help button is clicked */
  onHelp: () => void;
  /** Called when a suggested response is clicked */
  onSuggestedAction?: (responseText: string) => void;
}

/**
 * Create a section header element
 */
function createSectionHeader(title: string): HTMLElement {
  const header = div({ className: 'command-center__section-header' });
  const titleSpan = span({
    className: 'command-center__section-title',
    text: title,
  });
  header.appendChild(titleSpan);
  return header;
}

/**
 * Format the current turn date as "YYYY QN"
 */
function formatTurnDate(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

/**
 * Format the turn number display (1-indexed for user display)
 */
function formatTurnNumber(turn: number, maxTurns: number = 32): string {
  return `Turn ${turn + 1}/${maxTurns}`;
}

/**
 * Get advance button text based on state
 */
function getAdvanceButtonText(
  campaignStarted: boolean,
  hasPendingEvent: boolean,
  gameOver: boolean
): string {
  if (!campaignStarted) return 'Select Faction';
  if (hasPendingEvent) return 'Resolve Event';
  if (gameOver) return 'Campaign Ended';
  return 'Advance Quarter';
}

/**
 * Generate strategic situations based on game state
 */
function generateStrategicSituations(
  faction: FactionState,
  state: GameState
): StrategicSituation[] {
  const situations: StrategicSituation[] = [];

  if (faction.type === 'lab') {
    // Safety vs Capability Trade-off
    const safetyGap = faction.capabilityScore - faction.safetyScore;
    if (safetyGap > 15) {
      situations.push({
        id: 'safety-deficit',
        title: 'Safety Deficit',
        description: `Your capability outpaces safety by ${Math.round(safetyGap)} points. Regulators are watching.`,
        urgency: safetyGap > 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'pause', title: 'Safety Pause', description: 'Focus on alignment this quarter' },
          { id: 'parallel', title: 'Parallel Track', description: 'Split resources evenly' },
        ],
      });
    }

    // Trust issues
    if (faction.resources.trust < 40) {
      situations.push({
        id: 'trust-crisis',
        title: 'Public Trust Crisis',
        description: `Trust at ${Math.round(faction.resources.trust)}%. A scandal could trigger crackdown.`,
        urgency: faction.resources.trust < 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'open', title: 'Open Research', description: 'Publish openly to rebuild trust' },
          { id: 'pr', title: 'PR Campaign', description: 'Invest in positive messaging' },
        ],
      });
    }

    // Compute shortage
    if (faction.resources.compute < 30) {
      situations.push({
        id: 'compute-shortage',
        title: 'Compute Crunch',
        description: `Only ${Math.round(faction.resources.compute)} compute units. Training runs are limited.`,
        urgency: 'medium',
        potentialResponses: [
          { id: 'build', title: 'Build Infrastructure', description: 'Invest in datacenter capacity' },
          { id: 'efficient', title: 'Efficiency Focus', description: 'Research compute-efficient methods' },
        ],
      });
    }

    // Talent shortage for labs
    if (faction.resources.talent < 50) {
      situations.push({
        id: 'talent-shortage',
        title: 'Talent Gap',
        description: `Talent pool at ${Math.round(faction.resources.talent)}. Key researchers may leave.`,
        urgency: faction.resources.talent < 30 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'recruit', title: 'Aggressive Hiring', description: 'Increase compensation packages' },
          { id: 'retain', title: 'Retention Focus', description: 'Improve working conditions' },
        ],
      });
    }
  }

  // Government-specific situations
  if (faction.type === 'government') {
    // Low influence situation
    if (faction.resources.influence < 40) {
      situations.push({
        id: 'influence-waning',
        title: 'Waning Influence',
        description: `Influence at ${Math.round(faction.resources.influence)}%. Your regulatory power is diminishing.`,
        urgency: faction.resources.influence < 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'regulate', title: 'New Regulations', description: 'Assert authority through policy' },
          { id: 'cooperate', title: 'Industry Partnership', description: 'Build collaborative relationships' },
        ],
      });
    }

    // Labs racing ahead
    const labFactions = Object.values(state.factions).filter(f => f.type === 'lab');
    const maxLabCapability = Math.max(...labFactions.map(f => f.capabilityScore));
    if (maxLabCapability > 50 && faction.capabilityScore < maxLabCapability * 0.5) {
      situations.push({
        id: 'falling-behind',
        title: 'Technological Gap',
        description: `Private labs are racing ahead. Your oversight capability is limited.`,
        urgency: 'high',
        potentialResponses: [
          { id: 'invest', title: 'National AI Program', description: 'Increase government AI investment' },
          { id: 'monitor', title: 'Enhanced Monitoring', description: 'Strengthen oversight mechanisms' },
        ],
      });
    }

    // International tension - compute from total capability scores
    const totalCapability = Object.values(state.factions).reduce((sum, f) => sum + f.capabilityScore, 0);
    const tensionLevel = totalCapability > 140 ? 'critical' : totalCapability > 90 ? 'high' : 'moderate';
    if (tensionLevel === 'high' || tensionLevel === 'critical') {
      situations.push({
        id: 'geopolitical-risk',
        title: 'Geopolitical Tensions',
        description: `International AI competition is escalating. Cooperation is breaking down.`,
        urgency: tensionLevel === 'critical' ? 'high' : 'medium',
        potentialResponses: [
          { id: 'diplomacy', title: 'Diplomatic Outreach', description: 'Pursue international agreements' },
          { id: 'compete', title: 'Strategic Competition', description: 'Prioritize national advantage' },
        ],
      });
    }
  }

  // Global safety concern
  if (state.globalSafety < 50) {
    situations.push({
      id: 'global-risk',
      title: 'Rising Global Risk',
      description: `Global safety at ${Math.round(state.globalSafety)}%. The field is moving faster than safety.`,
      urgency: state.globalSafety < 35 ? 'high' : 'medium',
      potentialResponses: [
        { id: 'coalition', title: 'Safety Coalition', description: 'Coordinate with other factions' },
        { id: 'research', title: 'Safety Research', description: 'Prioritize alignment work' },
      ],
    });
  }

  return situations.slice(0, 3);
}

/**
 * Create the turn header section
 */
function createTurnHeader(year: number, quarter: number, turn: number): HTMLElement {
  const header = div({ className: 'command-center__turn-header' });

  const turnDate = span({
    className: 'command-center__turn-date',
    text: formatTurnDate(year, quarter),
  });

  const turnNumber = span({
    className: 'command-center__turn-number',
    text: formatTurnNumber(turn),
  });

  header.appendChild(turnDate);
  header.appendChild(turnNumber);

  return header;
}

/**
 * Create the advance button
 */
function createAdvanceButton(
  campaignStarted: boolean,
  hasPendingEvent: boolean,
  gameOver: boolean,
  onAdvance: () => void
): HTMLElement {
  const buttonText = getAdvanceButtonText(campaignStarted, hasPendingEvent, gameOver);
  const isDisabled = !campaignStarted || gameOver || hasPendingEvent;

  const btn = el('button', {
    className: 'command-center__advance-btn',
  }) as HTMLButtonElement;
  btn.textContent = buttonText;
  btn.disabled = isDisabled;
  btn.addEventListener('click', onAdvance);

  return btn;
}

/**
 * Create the strategic situations section
 */
function createSituationsSection(
  situations: StrategicSituation[],
  onSuggestedAction?: (text: string) => void
): HTMLElement {
  const section = div({ className: 'command-center__situations' });

  section.appendChild(createSectionHeader('Strategic Situations'));

  if (situations.length === 0) {
    const empty = div({
      className: 'command-center__situations-empty',
      text: 'No immediate concerns. Consider your long-term goals.',
    });
    section.appendChild(empty);
    return section;
  }

  const list = div({ className: 'command-center__situations-list' });

  for (const situation of situations) {
    const card = div({
      className: `command-center__situation-card command-center__situation-card--${situation.urgency}`,
    });

    const cardHeader = div({ className: 'command-center__situation-header' });
    const titleSpan = span({
      className: 'command-center__situation-title',
      text: situation.title,
    });
    const urgencySpan = span({
      className: `command-center__situation-urgency command-center__situation-urgency--${situation.urgency}`,
      text: situation.urgency.toUpperCase(),
    });
    cardHeader.appendChild(titleSpan);
    cardHeader.appendChild(urgencySpan);

    const cardDesc = div({
      className: 'command-center__situation-desc',
      text: situation.description,
    });

    card.appendChild(cardHeader);
    card.appendChild(cardDesc);

    // Add response buttons
    if (situation.potentialResponses.length > 0) {
      const responses = div({ className: 'command-center__situation-responses' });
      for (const response of situation.potentialResponses) {
        const responseBtn = button({
          className: 'command-center__response-btn',
        });
        const strongEl = el('strong', {});
        strongEl.textContent = response.title;
        responseBtn.appendChild(strongEl);
        responseBtn.title = response.description;
        responseBtn.addEventListener('click', () => {
          onSuggestedAction?.(`${response.title}: ${response.description}`);
        });
        responses.appendChild(responseBtn);
      }
      card.appendChild(responses);
    }

    list.appendChild(card);
  }

  section.appendChild(list);
  return section;
}

/**
 * Create the victory progress section
 */
function createVictorySection(state: GameState, factionId: string): HTMLElement {
  const section = div({ className: 'command-center__victory' });

  section.appendChild(createSectionHeader('Victory Progress'));

  // Use mini victory bars from VictoryTracker
  const bars = renderMiniVictoryBars(state, factionId);
  bars.className = 'command-center__victory-bars';
  section.appendChild(bars);

  return section;
}

/**
 * Create a single stat item
 */
function createStatItem(label: string, value: string): HTMLElement {
  const statDiv = div({ className: 'command-center__stat' });
  const labelSpan = span({
    className: 'command-center__stat-label',
    text: label,
  });
  const valueSpan = span({
    className: 'command-center__stat-value',
    text: value,
  });
  statDiv.appendChild(labelSpan);
  statDiv.appendChild(valueSpan);
  return statDiv;
}

/**
 * Create the faction quick stats section
 */
function createFactionStats(faction: FactionState): HTMLElement {
  const section = div({ className: 'command-center__faction-stats' });
  section.appendChild(createSectionHeader(faction.name));

  const stats = div({ className: 'command-center__stats-grid' });
  stats.appendChild(createStatItem('Capability', String(Math.round(faction.capabilityScore))));
  stats.appendChild(createStatItem('Safety', String(Math.round(faction.safetyScore))));
  stats.appendChild(createStatItem('Trust', `${Math.round(faction.resources.trust)}%`));
  stats.appendChild(createStatItem('Compute', String(Math.round(faction.resources.compute))));
  section.appendChild(stats);

  return section;
}

/**
 * Create the directive input section
 */
function createDirectiveInput(
  directiveText: string,
  onSubmit: (text: string) => void
): HTMLElement {
  const section = div({ className: 'command-center__directive' });

  const label = span({
    className: 'command-center__directive-label',
    text: 'Your Directive',
  });
  section.appendChild(label);

  const inputWrapper = div({ className: 'command-center__directive-wrapper' });

  const input = el('input', {
    className: 'command-center__directive-input',
  }) as HTMLInputElement;
  input.type = 'text';
  input.placeholder = 'Type your orders for this quarter...';
  input.value = directiveText;

  const submitBtn = button({
    className: 'command-center__directive-submit',
  });
  submitBtn.textContent = '\u27A4'; // ➤ arrow character
  submitBtn.title = 'Submit directive';

  const handleSubmit = () => {
    const text = input.value.trim();
    if (text) {
      onSubmit(text);
      input.value = '';
    }
  };

  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(submitBtn);
  section.appendChild(inputWrapper);

  return section;
}

/**
 * Create an action button with icon and text
 */
function createActionButton(
  icon: string,
  text: string,
  className: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = button({ className }) as HTMLButtonElement;
  const iconSpan = span({ className: 'command-center__action-icon', text: icon });
  btn.appendChild(iconSpan);
  btn.appendChild(document.createTextNode(` ${text}`));
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Create the action buttons row
 */
function createActionButtons(
  hasPendingEvent: boolean,
  pendingEventCount: number,
  callbacks: ExpandedCommandCenterCallbacks
): HTMLElement {
  const row = div({ className: 'command-center__actions' });

  // Tech Tree button
  const techBtn = createActionButton(
    '🔬',
    'Tech Tree (T)',
    'command-center__action-btn command-center__action-btn--tech',
    callbacks.onOpenTechTree
  );
  row.appendChild(techBtn);

  // Gamemaster button
  const gmBtn = createActionButton(
    '🎲',
    'Gamemaster',
    'command-center__action-btn command-center__action-btn--gamemaster',
    callbacks.onOpenGamemaster
  );
  row.appendChild(gmBtn);

  // Events badge (if pending)
  if (hasPendingEvent) {
    const eventBtn = button({
      className: 'command-center__action-btn command-center__action-btn--event',
    }) as HTMLButtonElement;
    const iconSpan = span({ className: 'command-center__action-icon', text: '⚡' });
    const countSpan = span({
      className: 'command-center__event-count',
      text: String(pendingEventCount),
    });
    eventBtn.appendChild(iconSpan);
    eventBtn.appendChild(document.createTextNode(' Events '));
    eventBtn.appendChild(countSpan);
    eventBtn.addEventListener('click', callbacks.onEventClick);
    row.appendChild(eventBtn);
  }

  return row;
}

/**
 * Create the recent log section
 */
function createRecentLog(entries: string[]): HTMLElement {
  const section = div({ className: 'command-center__log' });
  section.appendChild(createSectionHeader('Recent Activity'));

  const list = el('ul', { className: 'command-center__log-list' });

  if (entries.length === 0) {
    const emptyItem = el('li', {
      className: 'command-center__log-item command-center__log-item--empty',
    });
    emptyItem.textContent = 'No recent activity.';
    list.appendChild(emptyItem);
  } else {
    for (const entry of entries.slice(0, 5)) {
      const item = el('li', { className: 'command-center__log-item' });
      item.textContent = entry;
      list.appendChild(item);
    }
  }

  section.appendChild(list);
  return section;
}

/**
 * Create the footer row
 */
function createFooter(callbacks: ExpandedCommandCenterCallbacks): HTMLElement {
  const footer = div({ className: 'command-center__footer' });

  // Reset button
  const resetBtn = button({
    className: 'command-center__footer-btn',
  });
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', callbacks.onReset);
  footer.appendChild(resetBtn);

  // Stats button
  const statsBtn = button({
    className: 'command-center__footer-btn',
  });
  statsBtn.textContent = 'Stats';
  statsBtn.addEventListener('click', callbacks.onStats);
  footer.appendChild(statsBtn);

  // Keys/Help button
  const keysBtn = button({
    className: 'command-center__footer-btn',
  });
  keysBtn.textContent = 'Keys (?)';
  keysBtn.addEventListener('click', callbacks.onHelp);
  footer.appendChild(keysBtn);

  return footer;
}

/**
 * Renders the ExpandedCommandCenter component
 */
export function renderExpandedCommandCenter(
  options: ExpandedCommandCenterOptions,
  callbacks: ExpandedCommandCenterCallbacks
): HTMLElement {
  const {
    gameState,
    playerFactionId,
    campaignStarted,
    hasPendingEvent,
    pendingEventCount,
    situations: providedSituations,
  } = options;

  const faction = gameState.factions[playerFactionId];
  if (!faction) {
    return div({ className: 'command-center', text: 'No faction selected' });
  }

  // Generate situations if not provided
  const situations = providedSituations ?? generateStrategicSituations(faction, gameState);

  const container = div({ className: 'command-center' });

  // Compact turn header bar: date left, turn number center, advance button right
  const turnBar = div({ className: 'command-center__turn-bar' });

  const turnDate = span({
    className: 'command-center__turn-date',
    text: formatTurnDate(gameState.year, gameState.quarter),
  });
  turnBar.appendChild(turnDate);

  const turnNumber = span({
    className: 'command-center__turn-number',
    text: formatTurnNumber(gameState.turn),
  });
  turnBar.appendChild(turnNumber);

  // Advance button inline in the turn bar
  const buttonText = getAdvanceButtonText(campaignStarted, hasPendingEvent, gameState.gameOver);
  const isDisabled = !campaignStarted || gameState.gameOver || hasPendingEvent;
  const advanceBtn = el('button', {
    className: 'command-center__advance-btn',
  }) as HTMLButtonElement;
  advanceBtn.textContent = buttonText;
  advanceBtn.disabled = isDisabled;
  advanceBtn.addEventListener('click', callbacks.onAdvanceTurn);
  turnBar.appendChild(advanceBtn);

  container.appendChild(turnBar);

  // Main content area (2-column: situations + right sidebar)
  const mainContent = div({ className: 'command-center__main' });

  // Left column: Situations (the main game content)
  const leftCol = div({ className: 'command-center__left-col' });
  leftCol.appendChild(createSituationsSection(situations, callbacks.onSuggestedAction));
  mainContent.appendChild(leftCol);

  // Right column: Stats + Victory (tighter)
  const rightCol = div({ className: 'command-center__right-col' });
  rightCol.appendChild(createFactionStats(faction));
  rightCol.appendChild(createVictorySection(gameState, playerFactionId));
  mainContent.appendChild(rightCol);

  container.appendChild(mainContent);

  // Directive input
  container.appendChild(createDirectiveInput(
    options.directiveText || '',
    callbacks.onDirectiveSubmit
  ));

  // Action bar at bottom
  container.appendChild(createActionButtons(hasPendingEvent, pendingEventCount, callbacks));

  // Recent log
  container.appendChild(createRecentLog(options.recentLog || []));

  return container;
}

/**
 * Update the ExpandedCommandCenter with new state
 */
export function updateExpandedCommandCenter(
  container: HTMLElement,
  options: Partial<ExpandedCommandCenterOptions>
): void {
  // Update turn date
  if (options.gameState) {
    const turnDate = container.querySelector('.command-center__turn-date');
    if (turnDate) {
      turnDate.textContent = formatTurnDate(options.gameState.year, options.gameState.quarter);
    }

    const turnNumber = container.querySelector('.command-center__turn-number');
    if (turnNumber) {
      turnNumber.textContent = formatTurnNumber(options.gameState.turn);
    }
  }

  // More updates can be added as needed
}

/**
 * CSS styles for the ExpandedCommandCenter component
 */
export const EXPANDED_COMMAND_CENTER_STYLES = `
/* Expanded Command Center - v3 Intelligence Briefing Layout */
.command-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Turn Bar — compact single row */
.command-center__turn-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 32px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  background: var(--panel, #fff);
}

.command-center__turn-date {
  font-family: var(--serif, 'IBM Plex Serif', Georgia, serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1;
}

.command-center__turn-number {
  font-size: 11px;
  color: var(--text-3, var(--muted));
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  letter-spacing: 0.04em;
}

.command-center__advance-btn {
  margin-left: auto;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 2px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  cursor: pointer;
  transition: background 0.1s;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.command-center__advance-btn:hover:not(:disabled) {
  background: var(--accent-bright);
}

.command-center__advance-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Main Content Grid — situations take most space */
.command-center__main {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.command-center__left-col {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px 32px;
}

.command-center__right-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-left: 1px solid var(--line);
  overflow-y: auto;
  background: var(--bg-warm, #eae7e1);
}

/* Custom scrollbar */
.command-center__left-col::-webkit-scrollbar,
.command-center__right-col::-webkit-scrollbar {
  width: 3px;
}
.command-center__left-col::-webkit-scrollbar-track,
.command-center__right-col::-webkit-scrollbar-track {
  background: transparent;
}
.command-center__left-col::-webkit-scrollbar-thumb,
.command-center__right-col::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
}

/* Section Headers */
.command-center__section-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.command-center__section-title {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

/* Strategic Situations — the main game content */
.command-center__situations {
  flex: 1;
}

.command-center__situations-empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.command-center__situations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.command-center__situation-card {
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 20px 24px;
  transition: border-color 0.1s;
  position: relative;
}

.command-center__situation-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
}

.command-center__situation-card--high {
  border-left: 3px solid var(--danger, #8b2020);
}

.command-center__situation-card--medium {
  border-left: 3px solid var(--warning, #8b6914);
}

.command-center__situation-card--low {
  border-left: 3px solid var(--green-mid, #2d5a42);
}

.command-center__situation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.command-center__situation-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
}

.command-center__situation-urgency {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 1px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.command-center__situation-urgency--high {
  background: var(--danger-bg, rgba(139, 32, 32, 0.06));
  color: var(--danger, #8b2020);
}

.command-center__situation-urgency--medium {
  background: var(--warning-bg, rgba(139, 105, 20, 0.06));
  color: var(--warning, #8b6914);
}

.command-center__situation-urgency--low {
  background: var(--green-bg, rgba(26, 58, 42, 0.06));
  color: var(--green-mid, #2d5a42);
}

.command-center__situation-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
}

.command-center__situation-responses {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.command-center__response-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-2, #4a4a4a);
  cursor: pointer;
  transition: all 0.1s;
}

.command-center__response-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

/* Faction Stats — right sidebar */
.command-center__faction-stats {
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.command-center__stats-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.command-center__stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
}

.command-center__stat-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.command-center__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
}

/* Victory Progress — right sidebar */
.command-center__victory {
  padding: 16px;
}

.command-center__victory-bars {
  margin-top: 8px;
}

/* Action Bar — bottom of command center */
.command-center__actions {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}

.command-center__action-btn {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--line);
  border-radius: 0;
  color: var(--text-3, var(--muted));
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.command-center__action-btn:last-child {
  border-right: none;
}

.command-center__action-btn:hover {
  background: var(--panel, #fff);
  color: var(--accent);
}

.command-center__action-btn--tech:hover {
  color: var(--accent);
}

.command-center__action-btn--event {
  color: var(--danger);
}

.command-center__action-btn--event:hover {
  background: var(--danger-bg, rgba(139, 32, 32, 0.06));
}

.command-center__action-icon {
  font-size: 15px;
}

.command-center__event-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--danger);
  color: white;
  border-radius: 1px;
  font-size: 9px;
  font-weight: 700;
}

/* Action bar background */
.command-center__actions {
  background: var(--bg-warm, #eae7e1);
}

/* Directive Input */
.command-center__directive {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 32px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
  background: var(--bg-warm, #eae7e1);
}

.command-center__directive-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.command-center__directive-wrapper {
  display: flex;
  flex: 1;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 2px;
  overflow: hidden;
  background: var(--panel, #fff);
}

.command-center__directive-input {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-family: var(--font, 'IBM Plex Sans', sans-serif);
  outline: none;
}

.command-center__directive-input::placeholder {
  color: var(--text-4, #aaa);
}

.command-center__directive-submit {
  padding: 8px 14px;
  background: var(--accent);
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.command-center__directive-submit:hover {
  background: var(--accent-bright);
}

/* Recent Log */
.command-center__log {
  padding: 12px 32px;
  flex-shrink: 0;
  border-top: 1px solid var(--line);
  max-height: 120px;
  overflow-y: auto;
}

.command-center__log-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.command-center__log-item {
  font-size: 11px;
  color: var(--muted);
  padding: 3px 0;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
}

.command-center__log-item:last-child {
  border-bottom: none;
}

.command-center__log-item--empty {
  color: var(--text-4, #aaa);
  font-style: italic;
}

/* Footer */
.command-center__footer {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}

.command-center__footer-btn {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--line);
  color: var(--text-4, #aaa);
  font-size: 10px;
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.1s;
}

.command-center__footer-btn:last-child {
  border-right: none;
}

.command-center__footer-btn:hover {
  background: var(--panel, #fff);
  color: var(--ink);
}

/* Responsive */
@media (max-width: 768px) {
  .command-center__main {
    grid-template-columns: 1fr;
  }

  .command-center__right-col {
    border-left: none;
    border-top: 1px solid var(--line);
  }

  .command-center__turn-date {
    font-size: 18px;
  }
}
`;
