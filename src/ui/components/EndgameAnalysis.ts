/**
 * Endgame Analysis Component
 *
 * Displays detailed breakdown when game ends:
 * - What went right/wrong
 * - Key turning points
 * - Statistics and achievements
 */

import { GameState, FactionState } from '../../core/types.js';
import {
  VictoryType,
  LossType,
  VICTORY_THRESHOLDS,
  calculateVictoryProgress,
} from '../../core/victoryConditions.js';
import { createElement } from './base.js';

export interface EndgameStats {
  turnsPlayed: number;
  peakCapability: number;
  peakSafety: number;
  peakTrust: number;
  techsUnlocked: number;
  timesDetected?: number;
  espionageAttempts?: number;
}

export interface TurningPoint {
  turn: number;
  year: number;
  quarter: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface EndgameAnalysisOptions {
  victoryType?: VictoryType;
  lossType?: LossType;
  winnerId?: string;
  stats?: EndgameStats;
  turningPoints?: TurningPoint[];
  onRestart?: () => void;
  onMainMenu?: () => void;
}

const OUTCOME_TITLES: Record<string, { title: string; subtitle: string; icon: string }> = {
  safe_agi: {
    title: 'Victory: Safe AGI',
    subtitle: 'You successfully deployed safe artificial general intelligence!',
    icon: '🧠',
  },
  dominant: {
    title: 'Victory: Technological Dominance',
    subtitle: 'Your faction achieved overwhelming technological superiority!',
    icon: '👑',
  },
  public_trust: {
    title: 'Victory: Public Champion',
    subtitle: 'Through trust and transparency, you won the hearts and minds of the public!',
    icon: '🤝',
  },
  regulatory: {
    title: 'Victory: Regulatory Success',
    subtitle: 'Your careful oversight kept AI development safe and controlled!',
    icon: '📜',
  },
  alliance: {
    title: 'Victory: Global Alliance',
    subtitle: 'You forged a powerful international coalition for AI safety!',
    icon: '🌐',
  },
  control: {
    title: 'Victory: Total Control',
    subtitle: 'You established complete governmental control over AI development!',
    icon: '🔒',
  },
  catastrophe: {
    title: 'Defeat: Global Catastrophe',
    subtitle: 'Unsafe AGI was deployed, bringing disaster to humanity.',
    icon: '💥',
  },
  obsolescence: {
    title: 'Defeat: Obsolescence',
    subtitle: 'Your faction fell too far behind and became irrelevant.',
    icon: '📉',
  },
  collapse: {
    title: 'Defeat: Public Collapse',
    subtitle: 'Loss of public trust destroyed your organization.',
    icon: '🏚️',
  },
  coup: {
    title: 'Defeat: Government Overthrown',
    subtitle: 'AI labs grew too powerful and seized control.',
    icon: '⚔️',
  },
  stalemate: {
    title: 'Stalemate',
    subtitle: 'The AGI race ended without a clear victor.',
    icon: '⏱️',
  },
};

/**
 * Render the endgame analysis panel
 */
export function renderEndgameAnalysis(
  state: GameState,
  factionId: string,
  options: EndgameAnalysisOptions = {}
): HTMLElement {
  const {
    victoryType,
    lossType,
    winnerId,
    stats,
    turningPoints = [],
    onRestart,
    onMainMenu,
  } = options;

  const faction = state.factions[factionId];
  const winner = winnerId ? state.factions[winnerId] : null;
  const outcomeKey = victoryType || lossType || 'stalemate';
  const outcome = OUTCOME_TITLES[outcomeKey] || OUTCOME_TITLES.stalemate;

  const isVictory = !!victoryType;
  const isPlayerWinner = winnerId === factionId;

  const container = createElement('div', {
    className: `endgame-analysis ${isVictory ? 'endgame-analysis--victory' : 'endgame-analysis--defeat'}`,
  });

  // Header section
  const header = createElement('div', { className: 'endgame-analysis__header' });

  const icon = createElement('div', {
    className: 'endgame-analysis__icon',
    textContent: outcome.icon,
  });

  const titleContainer = createElement('div', { className: 'endgame-analysis__title-container' });

  const title = createElement('h2', {
    className: 'endgame-analysis__title',
    textContent: outcome.title,
  });

  const subtitle = createElement('p', {
    className: 'endgame-analysis__subtitle',
    textContent: outcome.subtitle,
  });

  titleContainer.appendChild(title);
  titleContainer.appendChild(subtitle);
  header.appendChild(icon);
  header.appendChild(titleContainer);
  container.appendChild(header);

  // Winner info (if applicable)
  if (winner) {
    const winnerSection = createElement('div', { className: 'endgame-analysis__winner' });

    const winnerLabel = createElement('span', {
      className: 'endgame-analysis__winner-label',
      textContent: isPlayerWinner ? 'You won as:' : 'Winner:',
    });

    const winnerName = createElement('span', {
      className: 'endgame-analysis__winner-name',
      textContent: winner.name,
    });

    winnerSection.appendChild(winnerLabel);
    winnerSection.appendChild(winnerName);
    container.appendChild(winnerSection);
  }

  // Game summary
  const summarySection = createElement('div', { className: 'endgame-analysis__section' });
  const summaryTitle = createElement('h3', {
    className: 'endgame-analysis__section-title',
    textContent: 'Game Summary',
  });
  summarySection.appendChild(summaryTitle);

  const summaryGrid = createElement('div', { className: 'endgame-analysis__summary-grid' });

  // Final year/quarter
  summaryGrid.appendChild(createStatCard('Final Year', `${state.year} Q${state.quarter}`));
  summaryGrid.appendChild(createStatCard('Turns Played', `${state.turn}`));
  summaryGrid.appendChild(createStatCard('Global Safety', `${state.globalSafety.toFixed(0)}`));

  if (faction) {
    summaryGrid.appendChild(createStatCard('Your Capability', `${faction.capabilityScore.toFixed(0)}`));
    summaryGrid.appendChild(createStatCard('Your Safety', `${faction.safetyScore.toFixed(0)}`));
    summaryGrid.appendChild(createStatCard('Your Trust', `${faction.resources.trust.toFixed(0)}`));
    summaryGrid.appendChild(createStatCard('Techs Unlocked', `${faction.unlockedTechs.size}`));
  }

  summarySection.appendChild(summaryGrid);
  container.appendChild(summarySection);

  // Final standings
  const standingsSection = createElement('div', { className: 'endgame-analysis__section' });
  const standingsTitle = createElement('h3', {
    className: 'endgame-analysis__section-title',
    textContent: 'Final Standings',
  });
  standingsSection.appendChild(standingsTitle);

  const standingsTable = renderFinalStandings(state, factionId);
  standingsSection.appendChild(standingsTable);
  container.appendChild(standingsSection);

  // What went right/wrong analysis
  const analysisSection = createElement('div', { className: 'endgame-analysis__section' });
  const analysisTitle = createElement('h3', {
    className: 'endgame-analysis__section-title',
    textContent: 'Analysis',
  });
  analysisSection.appendChild(analysisTitle);

  const analysisList = generateAnalysis(state, factionId, victoryType, lossType);
  analysisSection.appendChild(analysisList);
  container.appendChild(analysisSection);

  // Turning points (if provided)
  if (turningPoints.length > 0) {
    const turningPointsSection = createElement('div', { className: 'endgame-analysis__section' });
    const turningPointsTitle = createElement('h3', {
      className: 'endgame-analysis__section-title',
      textContent: 'Key Turning Points',
    });
    turningPointsSection.appendChild(turningPointsTitle);

    const timeline = renderTurningPoints(turningPoints);
    turningPointsSection.appendChild(timeline);
    container.appendChild(turningPointsSection);
  }

  // Action buttons
  const actions = createElement('div', { className: 'endgame-analysis__actions' });

  if (onRestart) {
    const restartBtn = createElement('button', {
      className: 'endgame-analysis__btn endgame-analysis__btn--primary',
      textContent: 'Play Again',
      onclick: onRestart,
    });
    actions.appendChild(restartBtn);
  }

  if (onMainMenu) {
    const menuBtn = createElement('button', {
      className: 'endgame-analysis__btn endgame-analysis__btn--secondary',
      textContent: 'Main Menu',
      onclick: onMainMenu,
    });
    actions.appendChild(menuBtn);
  }

  container.appendChild(actions);

  return container;
}

/**
 * Create a stat card element
 */
function createStatCard(label: string, value: string): HTMLElement {
  const card = createElement('div', { className: 'endgame-analysis__stat-card' });

  const labelEl = createElement('div', {
    className: 'endgame-analysis__stat-label',
    textContent: label,
  });

  const valueEl = createElement('div', {
    className: 'endgame-analysis__stat-value',
    textContent: value,
  });

  card.appendChild(labelEl);
  card.appendChild(valueEl);
  return card;
}

/**
 * Render final standings table
 */
function renderFinalStandings(state: GameState, playerFactionId: string): HTMLElement {
  const table = createElement('table', { className: 'endgame-analysis__standings' });

  // Header
  const thead = createElement('thead');
  const headerRow = createElement('tr');
  ['Rank', 'Faction', 'Type', 'Capability', 'Safety', 'Trust'].forEach(text => {
    const th = createElement('th', { textContent: text });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Sort factions by capability
  const sortedFactions = Object.values(state.factions)
    .sort((a, b) => b.capabilityScore - a.capabilityScore);

  // Body
  const tbody = createElement('tbody');
  sortedFactions.forEach((faction, index) => {
    const row = createElement('tr', {
      className: faction.id === playerFactionId ? 'endgame-analysis__standings-player' : '',
    });

    const rankCell = createElement('td', { textContent: `#${index + 1}` });
    const nameCell = createElement('td', { textContent: faction.name });
    const typeCell = createElement('td', { textContent: faction.type.toUpperCase() });
    const capCell = createElement('td', { textContent: faction.capabilityScore.toFixed(0) });
    const safetyCell = createElement('td', { textContent: faction.safetyScore.toFixed(0) });
    const trustCell = createElement('td', { textContent: faction.resources.trust.toFixed(0) });

    row.appendChild(rankCell);
    row.appendChild(nameCell);
    row.appendChild(typeCell);
    row.appendChild(capCell);
    row.appendChild(safetyCell);
    row.appendChild(trustCell);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);

  return table;
}

/**
 * Generate analysis text based on game outcome
 */
function generateAnalysis(
  state: GameState,
  factionId: string,
  victoryType?: VictoryType,
  lossType?: LossType
): HTMLElement {
  const list = createElement('ul', { className: 'endgame-analysis__analysis-list' });
  const faction = state.factions[factionId];
  if (!faction) return list;

  const items: { text: string; type: 'positive' | 'negative' | 'neutral' }[] = [];

  // Capability analysis
  const labs = Object.values(state.factions).filter(f => f.type === 'lab');
  const maxCapability = Math.max(...labs.map(f => f.capabilityScore));
  const capabilityRank = labs.sort((a, b) => b.capabilityScore - a.capabilityScore)
    .findIndex(f => f.id === faction.id) + 1;

  if (faction.type === 'lab') {
    if (capabilityRank === 1) {
      items.push({ text: 'You achieved the highest capability among all labs.', type: 'positive' });
    } else {
      items.push({ text: `You ranked #${capabilityRank} in capability among labs.`, type: 'neutral' });
    }
  }

  // Safety analysis
  if (faction.safetyScore >= VICTORY_THRESHOLDS.safeAgi.factionSafety) {
    items.push({ text: 'You maintained safe AGI deployment standards.', type: 'positive' });
  } else if (faction.safetyScore < 40) {
    items.push({ text: 'Your safety practices were dangerously low.', type: 'negative' });
  }

  // Trust analysis
  if (faction.resources.trust >= 80) {
    items.push({ text: 'You maintained excellent public trust throughout.', type: 'positive' });
  } else if (faction.resources.trust < 40) {
    items.push({ text: 'Public trust in your organization eroded significantly.', type: 'negative' });
  }

  // Global safety analysis
  if (state.globalSafety >= VICTORY_THRESHOLDS.safeAgi.globalSafety) {
    items.push({ text: 'Global AI safety standards remained adequate.', type: 'positive' });
  } else {
    items.push({ text: 'Global AI safety was compromised.', type: 'negative' });
  }

  // Victory/loss specific analysis
  if (victoryType === 'safe_agi') {
    items.push({ text: 'You successfully balanced capability advancement with safety.', type: 'positive' });
  } else if (victoryType === 'dominant') {
    items.push({ text: 'Your aggressive capability push paid off.', type: 'positive' });
  } else if (lossType === 'catastrophe') {
    items.push({ text: 'The push for capability without adequate safety led to disaster.', type: 'negative' });
  } else if (lossType === 'obsolescence') {
    items.push({ text: 'Falling behind in capability made you irrelevant.', type: 'negative' });
  } else if (lossType === 'collapse') {
    items.push({ text: 'Lack of transparency destroyed public confidence.', type: 'negative' });
  }

  // Tech unlock analysis
  const techCount = faction.unlockedTechs.size;
  if (techCount >= 10) {
    items.push({ text: `Unlocked ${techCount} technologies - strong research output.`, type: 'positive' });
  } else if (techCount < 3) {
    items.push({ text: `Only unlocked ${techCount} technologies - research lagged.`, type: 'negative' });
  }

  // Render items
  for (const item of items) {
    const li = createElement('li', {
      className: `endgame-analysis__analysis-item endgame-analysis__analysis-item--${item.type}`,
    });

    const icon = item.type === 'positive' ? '✓' : item.type === 'negative' ? '✗' : '•';
    li.innerHTML = `<span class="endgame-analysis__analysis-icon">${icon}</span> ${item.text}`;
    list.appendChild(li);
  }

  return list;
}

/**
 * Render turning points timeline
 */
function renderTurningPoints(turningPoints: TurningPoint[]): HTMLElement {
  const timeline = createElement('div', { className: 'endgame-analysis__timeline' });

  for (const point of turningPoints) {
    const item = createElement('div', {
      className: `endgame-analysis__timeline-item endgame-analysis__timeline-item--${point.impact}`,
    });

    const marker = createElement('div', { className: 'endgame-analysis__timeline-marker' });

    const content = createElement('div', { className: 'endgame-analysis__timeline-content' });

    const time = createElement('div', {
      className: 'endgame-analysis__timeline-time',
      textContent: `${point.year} Q${point.quarter}`,
    });

    const desc = createElement('div', {
      className: 'endgame-analysis__timeline-desc',
      textContent: point.description,
    });

    content.appendChild(time);
    content.appendChild(desc);
    item.appendChild(marker);
    item.appendChild(content);
    timeline.appendChild(item);
  }

  return timeline;
}

// CSS styles for the component
export const ENDGAME_ANALYSIS_STYLES = `
.endgame-analysis {
  background: var(--panel-bg, #ffffff);
  border-radius: 2px;
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  color: var(--text-primary, #1a1a1a);
}

.endgame-analysis--victory {
  border: 2px solid var(--success-color, #4CAF50);
}

.endgame-analysis--defeat {
  border: 2px solid var(--danger-color, #f44336);
}

.endgame-analysis__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__icon {
  font-size: 48px;
}

.endgame-analysis__title-container {
  flex: 1;
}

.endgame-analysis__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.endgame-analysis--victory .endgame-analysis__title {
  color: var(--success-color, #4CAF50);
}

.endgame-analysis--defeat .endgame-analysis__title {
  color: var(--danger-color, #f44336);
}

.endgame-analysis__subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-secondary, #7a7a7a);
}

.endgame-analysis__winner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 2px;
  margin-bottom: 24px;
}

.endgame-analysis__winner-label {
  color: var(--text-secondary, #7a7a7a);
}

.endgame-analysis__winner-name {
  font-weight: 600;
  font-size: 18px;
}

.endgame-analysis__section {
  margin-bottom: 24px;
}

.endgame-analysis__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary, #7a7a7a);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.endgame-analysis__summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.endgame-analysis__stat-card {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 2px;
  padding: 12px;
  text-align: center;
}

.endgame-analysis__stat-label {
  font-size: 11px;
  color: var(--text-secondary, #7a7a7a);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.endgame-analysis__stat-value {
  font-size: 20px;
  font-weight: 700;
}

.endgame-analysis__standings {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.endgame-analysis__standings th,
.endgame-analysis__standings td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__standings th {
  font-weight: 600;
  color: var(--text-secondary, #7a7a7a);
  text-transform: uppercase;
  font-size: 11px;
}

.endgame-analysis__standings-player {
  background: rgba(33, 150, 243, 0.1);
}

.endgame-analysis__standings-player td {
  font-weight: 600;
}

.endgame-analysis__analysis-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.endgame-analysis__analysis-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__analysis-item:last-child {
  border-bottom: none;
}

.endgame-analysis__analysis-icon {
  font-size: 14px;
  width: 20px;
  text-align: center;
}

.endgame-analysis__analysis-item--positive .endgame-analysis__analysis-icon {
  color: var(--success-color, #4CAF50);
}

.endgame-analysis__analysis-item--negative .endgame-analysis__analysis-icon {
  color: var(--danger-color, #f44336);
}

.endgame-analysis__analysis-item--neutral .endgame-analysis__analysis-icon {
  color: var(--text-secondary, #7a7a7a);
}

.endgame-analysis__timeline {
  position: relative;
  padding-left: 24px;
}

.endgame-analysis__timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__timeline-item {
  position: relative;
  padding: 8px 0 16px 24px;
}

.endgame-analysis__timeline-marker {
  position: absolute;
  left: -20px;
  top: 8px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--panel-bg, #ffffff);
  border: 2px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__timeline-item--positive .endgame-analysis__timeline-marker {
  border-color: var(--success-color, #4CAF50);
  background: var(--success-color, #4CAF50);
}

.endgame-analysis__timeline-item--negative .endgame-analysis__timeline-marker {
  border-color: var(--danger-color, #f44336);
  background: var(--danger-color, #f44336);
}

.endgame-analysis__timeline-time {
  font-size: 11px;
  color: var(--text-secondary, #7a7a7a);
  margin-bottom: 4px;
}

.endgame-analysis__timeline-desc {
  font-size: 13px;
}

.endgame-analysis__actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__btn {
  padding: 12px 32px;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.endgame-analysis__btn--primary {
  background: var(--accent-color, #2196F3);
  color: white;
}

.endgame-analysis__btn--primary:hover {
  background: var(--accent-hover, #1976D2);
}

.endgame-analysis__btn--secondary {
  background: transparent;
  color: var(--text-primary, #1a1a1a);
  border: 1px solid var(--border-color, rgba(0,0,0,0.08));
}

.endgame-analysis__btn--secondary:hover {
  background: rgba(0, 0, 0, 0.04);
}
`;
