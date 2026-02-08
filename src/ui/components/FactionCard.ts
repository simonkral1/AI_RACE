// Enhanced Faction Card component with radar charts and fog of war
// Displays faction info, resources via radar chart, capability/safety scores, exposure
// Click to open detailed faction dossier view

import { el, div, span, button, ICONS } from './base.js';
import {
  renderMiniRadarChart,
  renderFogOfWarRadarChart,
  valueToBand,
  RADAR_COLORS,
} from './RadarChart.js';
import type { FactionState, FactionType, Resources, ResourceKey, GameState } from '../../core/types.js';

// Resource display order and labels
const RESOURCE_DISPLAY: { key: ResourceKey; label: string }[] = [
  { key: 'compute', label: 'Compute' },
  { key: 'trust', label: 'Trust' },
  { key: 'talent', label: 'Talent' },
  { key: 'capital', label: 'Capital' },
  { key: 'data', label: 'Data' },
  { key: 'influence', label: 'Influence' },
];

// Relationship indicator types
export type RelationshipIndicator = 'ally' | 'neutral' | 'tension' | 'rival';

export interface FactionCardOptions {
  isPlayer: boolean;
  isFocused: boolean;
  onClick: () => void;
  onOpenDetail?: () => void;
  relationshipIndicators?: Record<string, RelationshipIndicator>;
  moodStatus?: 'stable' | 'aggressive' | 'defensive' | 'opportunistic';
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
 * Get mood status icon and color
 */
function getMoodIndicator(mood?: string): { icon: string; color: string; label: string } | null {
  if (!mood) return null;

  switch (mood) {
    case 'aggressive':
      return { icon: '!', color: '#e26d5a', label: 'Aggressive' };
    case 'defensive':
      return { icon: 'D', color: '#5a9de2', label: 'Defensive' };
    case 'opportunistic':
      return { icon: '?', color: '#f6c06a', label: 'Opportunistic' };
    case 'stable':
    default:
      return { icon: '-', color: '#6ec7a2', label: 'Stable' };
  }
}

/**
 * Get relationship indicator color
 */
function getRelationshipColor(type: RelationshipIndicator): string {
  switch (type) {
    case 'ally': return '#6ec7a2';
    case 'tension': return '#f6c06a';
    case 'rival': return '#e26d5a';
    case 'neutral':
    default: return '#7d9182';
  }
}

/**
 * Create mini relationship indicators showing relations with other factions
 */
function createRelationshipIndicators(
  relationships?: Record<string, RelationshipIndicator>
): HTMLElement | null {
  if (!relationships || Object.keys(relationships).length === 0) return null;

  const container = div({ className: 'faction-card__relationships' });

  for (const [factionId, type] of Object.entries(relationships)) {
    // Just show first letter of faction
    const initial = factionId.charAt(0).toUpperCase();
    const color = getRelationshipColor(type);

    const indicator = span({
      className: `faction-card__rel-indicator faction-card__rel-indicator--${type}`,
    });
    indicator.innerHTML = `<span style="color: ${color}">${initial}</span>`;
    indicator.title = `${factionId}: ${type}`;
    container.appendChild(indicator);
  }

  return container;
}

/**
 * Create mood/status icon
 */
function createMoodIndicator(mood?: string): HTMLElement | null {
  const moodData = getMoodIndicator(mood);
  if (!moodData) return null;

  const indicator = span({ className: 'faction-card__mood' });
  indicator.innerHTML = `<span class="faction-card__mood-icon" style="color: ${moodData.color}">${moodData.icon}</span>`;
  indicator.title = `Status: ${moodData.label}`;
  return indicator;
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
  onClick: () => void,
  options?: {
    onOpenDetail?: () => void;
    relationshipIndicators?: Record<string, RelationshipIndicator>;
    moodStatus?: string;
  }
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

  // Mood indicator (only for non-player factions)
  if (!isPlayer && options?.moodStatus) {
    const moodIndicator = createMoodIndicator(options.moodStatus);
    if (moodIndicator) {
      titleRow.appendChild(moodIndicator);
    }
  }

  // Exposure indicator (if any exposure)
  const exposureIndicator = createExposureIndicator(faction.exposure);
  if (exposureIndicator) {
    titleRow.appendChild(exposureIndicator);
  }

  header.appendChild(titleRow);

  // Type tag with icon and detail button
  const tagRow = div({ className: 'faction-card__tag-row' });

  const tag = span({ className: 'faction-card__tag' });
  tag.innerHTML = `${getFactionIcon(faction.type)} ${getFactionTypeLabel(faction.type)}`;
  tagRow.appendChild(tag);

  // Detail button (opens dossier)
  if (options?.onOpenDetail) {
    const detailBtn = button({
      className: 'faction-card__detail-btn',
      onClick: (e) => {
        e.stopPropagation();
        options.onOpenDetail?.();
      },
    });
    detailBtn.innerHTML = `<span class="faction-card__detail-icon">[ ]</span>`;
    detailBtn.title = 'View Dossier';
    tagRow.appendChild(detailBtn);
  }

  header.appendChild(tagRow);

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

  // Mini relationship indicators (if provided)
  if (options?.relationshipIndicators) {
    const relIndicators = createRelationshipIndicators(options.relationshipIndicators);
    if (relIndicators) {
      card.appendChild(relIndicators);
    }
  }

  // Player indicator badge
  if (isPlayer) {
    const playerBadge = span({ className: 'faction-card__player-badge', text: 'YOU' });
    card.appendChild(playerBadge);
  }

  return card;
}

export interface FactionListCallbacks {
  onFocusChange: (id: string) => void;
  onOpenDetail?: (id: string) => void;
}

export interface FactionListOptions {
  showRelationshipIndicators?: boolean;
  showMoodStatus?: boolean;
}

/**
 * Calculate simple relationship indicators based on faction attributes
 */
function calculateSimpleRelationships(
  faction: FactionState,
  allFactions: FactionState[],
  playerFactionId: string
): Record<string, RelationshipIndicator> {
  const relationships: Record<string, RelationshipIndicator> = {};

  for (const other of allFactions) {
    if (other.id === faction.id) continue;

    // Simple heuristics for relationships
    const sameSide = (faction.id.startsWith('us') && other.id.startsWith('us')) ||
                     (faction.id.startsWith('cn') && other.id.startsWith('cn'));
    const sameType = faction.type === other.type;

    // Calculate a simple score
    let score = 0;
    if (sameSide) score += 2;
    if (!sameType) score += 1; // Lab-gov tends to cooperate
    if (sameType && faction.type === 'lab') score -= 2; // Labs compete

    // Safety culture alignment
    const safetyCultureDiff = Math.abs(faction.safetyCulture - other.safetyCulture);
    if (safetyCultureDiff > 30) score -= 1;

    // Determine relationship type
    if (score >= 2) {
      relationships[other.id] = 'ally';
    } else if (score >= 0) {
      relationships[other.id] = 'neutral';
    } else if (score >= -2) {
      relationships[other.id] = 'tension';
    } else {
      relationships[other.id] = 'rival';
    }
  }

  return relationships;
}

/**
 * Determine mood status based on faction attributes
 */
function determineMoodStatus(faction: FactionState): string {
  // Simple heuristics
  const capabilityRatio = faction.capabilityScore / Math.max(faction.safetyScore, 1);

  if (capabilityRatio > 1.5 && faction.exposure > 0) {
    return 'aggressive';
  } else if (faction.safetyScore > faction.capabilityScore * 1.2) {
    return 'defensive';
  } else if (faction.exposure >= 2) {
    return 'opportunistic';
  }
  return 'stable';
}

/**
 * Render a list of faction cards
 */
/**
 * Create the player faction header shown at the top of the sidebar
 */
function createPlayerHeader(faction: FactionState): HTMLElement {
  const header = div({ className: 'faction-player-header' });

  const nameEl = div({ className: 'faction-player-header__name', text: faction.name });
  header.appendChild(nameEl);

  const typeEl = div({
    className: 'faction-player-header__type',
    text: getFactionTypeLabel(faction.type),
  });
  header.appendChild(typeEl);

  const statEl = div({ className: 'faction-player-header__stat' });
  const labelEl = span({ className: 'faction-player-header__stat-label', text: 'Capability' });
  const valueEl = span({
    className: 'faction-player-header__stat-value',
    text: String(Math.round(faction.capabilityScore)),
  });
  statEl.appendChild(labelEl);
  statEl.appendChild(valueEl);
  header.appendChild(statEl);

  return header;
}

export function renderFactionList(
  factions: FactionState[],
  playerFactionId: string,
  focusFactionId: string,
  onFocusChange: (id: string) => void,
  options?: {
    onOpenDetail?: (id: string) => void;
    showRelationshipIndicators?: boolean;
    showMoodStatus?: boolean;
  }
): HTMLElement {
  // Return a wrapper that includes the player header + faction list
  const wrapper = div({ className: 'faction-list-wrapper' });

  // Sort factions: player first, then by type (labs before governments)
  const sortedFactions = [...factions].sort((a, b) => {
    if (a.id === playerFactionId) return -1;
    if (b.id === playerFactionId) return 1;
    if (a.type !== b.type) {
      return a.type === 'lab' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  const playerFaction = sortedFactions.find(f => f.id === playerFactionId);
  const otherFactions = sortedFactions.filter(f => f.id !== playerFactionId);

  // Player faction header
  if (playerFaction) {
    wrapper.appendChild(createPlayerHeader(playerFaction));
  }

  // "OTHER FACTIONS" section label
  if (otherFactions.length > 0) {
    const sectionLabel = div({ className: 'faction-section-label', text: 'OTHER FACTIONS' });
    wrapper.appendChild(sectionLabel);
  }

  const container = div({ className: 'faction-list' });

  for (const faction of otherFactions) {
    const isPlayer = false;
    const isFocused = faction.id === focusFactionId;

    // Calculate relationship indicators if enabled
    const relationshipIndicators = options?.showRelationshipIndicators
      ? calculateSimpleRelationships(faction, factions, playerFactionId)
      : undefined;

    // Determine mood status if enabled
    const moodStatus = options?.showMoodStatus
      ? determineMoodStatus(faction)
      : undefined;

    const card = renderFactionCard(
      faction,
      isPlayer,
      isFocused,
      () => {
        onFocusChange(faction.id);
      },
      {
        onOpenDetail: options?.onOpenDetail ? () => options.onOpenDetail?.(faction.id) : undefined,
        relationshipIndicators,
        moodStatus,
      }
    );

    container.appendChild(card);
  }

  wrapper.appendChild(container);
  return wrapper;
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
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.03);
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
  background: rgba(0, 0, 0, 0.12);
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
  border-radius: 2px;
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
  font-family: var(--font), sans-serif;
}
`;
