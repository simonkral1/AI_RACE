// Enhanced Faction Card component with radar charts and fog of war
// Displays faction info, resources via radar chart, capability/safety scores, exposure

import { el, div, span, ICONS } from './base.js';
import {
  renderMiniRadarChart,
  renderFogOfWarRadarChart,
  valueToBand,
  RADAR_COLORS,
} from './RadarChart.js';
import type { FactionState, FactionType, Resources, ResourceKey } from '../../core/types.js';

// Resource display order and labels
const RESOURCE_DISPLAY: { key: ResourceKey; label: string }[] = [
  { key: 'compute', label: 'Compute' },
  { key: 'trust', label: 'Trust' },
  { key: 'talent', label: 'Talent' },
  { key: 'capital', label: 'Capital' },
  { key: 'data', label: 'Data' },
  { key: 'influence', label: 'Influence' },
];

export interface FactionCardOptions {
  isPlayer: boolean;
  isFocused: boolean;
  onClick: () => void;
}

/**
 * Get the appropriate icon for faction type
 */
function getFactionIcon(type: FactionType): string {
  return type === 'lab' ? ICONS.lab : ICONS.government;
}

/**
 * Get type label for display
 */
function getFactionTypeLabel(type: FactionType): string {
  return type === 'lab' ? 'AI Lab' : 'Government';
}

/**
 * Create exposure indicator dots
 * Yellow for exposure 1-2, Red for exposure 3+
 */
function createExposureIndicator(exposure: number): HTMLElement | null {
  if (exposure <= 0) return null;

  const container = div({ className: 'faction-card__exposure' });

  // Max 3 dots
  const maxDots = 3;
  const filledDots = Math.min(exposure, maxDots);

  for (let i = 0; i < maxDots; i++) {
    const dot = span({
      className: `exposure-dot ${i < filledDots ? 'exposure-dot--filled' : 'exposure-dot--empty'} ${i < filledDots && exposure >= 2 ? (exposure >= 3 ? 'exposure-dot--danger' : 'exposure-dot--warning') : ''}`,
    });
    container.appendChild(dot);
  }

  return container;
}

/**
 * Format score for display
 */
function formatScore(value: number): string {
  return Math.round(value).toString();
}

/**
 * Create the scores display (Capability and Safety)
 */
function createScoresDisplay(
  capabilityScore: number,
  safetyScore: number,
  isPlayer: boolean
): HTMLElement {
  const container = div({ className: 'faction-card__scores' });

  // Capability score
  const capabilityEl = div({ className: 'faction-card__score faction-card__score--capability' });
  capabilityEl.innerHTML = `
    <span class="score-label">CAP</span>
    <span class="score-value">${isPlayer ? formatScore(capabilityScore) : valueToBand(capabilityScore)}</span>
  `;
  container.appendChild(capabilityEl);

  // Safety score
  const safetyEl = div({ className: 'faction-card__score faction-card__score--safety' });
  safetyEl.innerHTML = `
    <span class="score-label">SAFE</span>
    <span class="score-value">${isPlayer ? formatScore(safetyScore) : valueToBand(safetyScore)}</span>
  `;
  container.appendChild(safetyEl);

  return container;
}

/**
 * Create the resources grid showing all 6 resource values
 * For player factions: shows exact values
 * For non-player factions: shows Low/Med/High bands (fog of war)
 */
function createResourcesGrid(
  resources: Resources,
  isPlayer: boolean
): HTMLElement {
  const container = div({ className: 'faction-card__resources' });

  for (const { key, label } of RESOURCE_DISPLAY) {
    const value = resources[key];
    const displayValue = isPlayer ? Math.round(value).toString() : valueToBand(value);

    const resourceEl = div({ className: 'faction-card__resource' });
    resourceEl.innerHTML = `
      <span class="faction-card__resource-label">${label}</span>
      <span class="faction-card__resource-value">${displayValue}</span>
    `;
    container.appendChild(resourceEl);
  }

  return container;
}

/**
 * Render a single faction card
 */
export function renderFactionCard(
  faction: FactionState,
  isPlayer: boolean,
  isFocused: boolean,
  onClick: () => void
): HTMLElement {
  const card = div({
    className: `faction-card ${isFocused ? 'is-focused' : ''} ${isPlayer ? 'faction-card--player' : ''}`,
    dataset: { factionId: faction.id },
    onClick,
  });

  // Header with name, type badge
  const header = div({ className: 'faction-card__header' });

  const titleRow = div({ className: 'faction-card__title-row' });

  const title = span({ className: 'faction-card__title', text: faction.name });
  titleRow.appendChild(title);

  // Exposure indicator (if any exposure)
  const exposureIndicator = createExposureIndicator(faction.exposure);
  if (exposureIndicator) {
    titleRow.appendChild(exposureIndicator);
  }

  header.appendChild(titleRow);

  // Type tag with icon
  const tag = span({ className: 'faction-card__tag' });
  tag.innerHTML = `${getFactionIcon(faction.type)} ${getFactionTypeLabel(faction.type)}`;
  header.appendChild(tag);

  card.appendChild(header);

  // Content area with radar chart and scores
  const content = div({ className: 'faction-card__content' });

  // Radar chart (mini version)
  const radarContainer = div({ className: 'faction-card__radar' });

  // Determine colors based on faction type and player status
  let fillColor: string;
  let strokeColor: string;

  if (isPlayer) {
    fillColor = RADAR_COLORS.player.fill;
    strokeColor = RADAR_COLORS.player.stroke;
  } else {
    const colorScheme = RADAR_COLORS[faction.type];
    fillColor = colorScheme.fill;
    strokeColor = colorScheme.stroke;
  }

  // Use fog-of-war for non-player factions
  const radarChart = isPlayer
    ? renderMiniRadarChart(faction.resources, {
        size: 72,
        fillColor,
        strokeColor,
      })
    : renderFogOfWarRadarChart(faction.resources, { size: 72 });

  radarContainer.appendChild(radarChart);
  content.appendChild(radarContainer);

  // Scores display
  const scoresDisplay = createScoresDisplay(
    faction.capabilityScore,
    faction.safetyScore,
    isPlayer
  );
  content.appendChild(scoresDisplay);

  card.appendChild(content);

  // Resources grid (all 6 resource values)
  const resourcesGrid = createResourcesGrid(faction.resources, isPlayer);
  card.appendChild(resourcesGrid);

  // Player indicator badge
  if (isPlayer) {
    const playerBadge = span({ className: 'faction-card__player-badge', text: 'YOU' });
    card.appendChild(playerBadge);
  }

  return card;
}

/**
 * Render a list of faction cards
 */
export function renderFactionList(
  factions: FactionState[],
  playerFactionId: string,
  focusFactionId: string,
  onFocusChange: (id: string) => void
): HTMLElement {
  const container = div({ className: 'faction-list' });

  // Sort factions: player first, then by type (labs before governments)
  const sortedFactions = [...factions].sort((a, b) => {
    if (a.id === playerFactionId) return -1;
    if (b.id === playerFactionId) return 1;
    if (a.type !== b.type) {
      return a.type === 'lab' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const faction of sortedFactions) {
    const isPlayer = faction.id === playerFactionId;
    const isFocused = faction.id === focusFactionId;

    const card = renderFactionCard(faction, isPlayer, isFocused, () => {
      onFocusChange(faction.id);
    });

    container.appendChild(card);
  }

  return container;
}

/**
 * CSS additions needed for faction cards
 * (Document these for adding to styles.css)
 */
export const FACTION_CARD_CSS = `
/* Enhanced Faction Card Styles */
.faction-card {
  position: relative;
}

.faction-card--player {
  border-color: rgba(138, 192, 108, 0.4);
}

.faction-card--player.is-focused {
  border-color: rgba(138, 192, 108, 0.7);
}

.faction-card__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.faction-card__content {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.faction-card__radar {
  flex-shrink: 0;
}

.faction-card__scores {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.faction-card__score {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 6px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
}

.faction-card__score--capability {
  border-left: 3px solid var(--branch-capabilities);
}

.faction-card__score--safety {
  border-left: 3px solid var(--branch-safety);
}

.score-label {
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

.score-value {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
}

.faction-card__exposure {
  display: flex;
  gap: 3px;
}

.exposure-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
}

.exposure-dot--filled {
  background: var(--accent-2);
}

.exposure-dot--warning {
  background: var(--accent-2);
}

.exposure-dot--danger {
  background: var(--danger);
  animation: exposure-pulse 1.5s ease-in-out infinite;
}

@keyframes exposure-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.faction-card__player-badge {
  position: absolute;
  top: -6px;
  right: 10px;
  font-size: 9px;
  letter-spacing: 0.2em;
  padding: 3px 8px;
  background: var(--accent);
  color: #0c130f;
  border-radius: 4px;
  font-weight: 600;
}

.faction-card__tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.faction-card__tag .icon {
  width: 14px;
  height: 14px;
}

/* Radar chart mini styles */
.radar-chart-mini {
  display: block;
}

.radar-chart-mini--fog {
  opacity: 0.8;
}

.radar-label {
  font-family: 'Space Grotesk', sans-serif;
}
`;
