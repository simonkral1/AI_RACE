// Faction Detail Screen - Intelligence dossier modal for comprehensive faction info
// Shows resources, research, tech, actions, relationships, and faction personality

import { el, div, span, button, ICONS, BRANCH_COLORS, clamp, formatNum } from './base.js';
import { renderMiniRadarChart, renderFogOfWarRadarChart, valueToBand, RADAR_COLORS } from './RadarChart.js';
import type { FactionState, FactionType, Resources, ResourceKey, BranchId, GameState } from '../../core/types.js';
import { TECH_TREE } from '../../data/techTree.js';

// Faction personality profiles - flavor text and characteristics
const FACTION_PROFILES: Record<string, {
  motto: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  personality: string;
}> = {
  us_lab_a: {
    motto: '"Move thoughtfully, but move."',
    description: 'A pioneer in safety-conscious AI development, known for publishing breakthrough research while maintaining careful oversight protocols.',
    strengths: ['Strong safety culture', 'Top-tier talent pool', 'Public trust'],
    weaknesses: ['Slower deployment cycles', 'High operational costs', 'Regulatory scrutiny'],
    personality: 'Methodical and transparent, prioritizing long-term safety over short-term gains.',
  },
  us_lab_b: {
    motto: '"Speed is safety."',
    description: 'An aggressive competitor focused on rapid capability advancement, believing that being first to AGI is the only way to ensure it\'s safe.',
    strengths: ['Massive compute infrastructure', 'High capital reserves', 'Fast iteration'],
    weaknesses: ['Lower safety culture', 'Public perception issues', 'Talent retention'],
    personality: 'Bold and competitive, willing to take calculated risks to maintain their lead.',
  },
  cn_lab: {
    motto: '"National interest, global impact."',
    description: 'A state-backed research collective with access to unprecedented data resources and computational infrastructure.',
    strengths: ['Vast data access', 'Government backing', 'Operational security'],
    weaknesses: ['Trust deficit internationally', 'Isolated from Western talent', 'Oversight opacity'],
    personality: 'Strategic and patient, playing a long game with state resources.',
  },
  us_gov: {
    motto: '"Governance before deployment."',
    description: 'The executive branch working to establish AI safety frameworks while balancing innovation and national security.',
    strengths: ['Regulatory authority', 'International influence', 'Public mandate'],
    weaknesses: ['Slow decision cycles', 'Limited technical depth', 'Political pressures'],
    personality: 'Cautious and procedural, seeking consensus while preparing for contingencies.',
  },
  cn_gov: {
    motto: '"Technology sovereignty."',
    description: 'Central planning authority coordinating national AI strategy and maintaining technological independence.',
    strengths: ['Centralized coordination', 'Long-term planning', 'Resource mobilization'],
    weaknesses: ['Information asymmetry', 'Trust challenges abroad', 'Flexibility limitations'],
    personality: 'Calculating and strategic, balancing control with competitive advancement.',
  },
};

// Resource display configuration
const RESOURCE_CONFIG: { key: ResourceKey; label: string; icon: string; color: string }[] = [
  { key: 'compute', label: 'Compute', icon: '[ ]', color: '#5a9de2' },
  { key: 'talent', label: 'Talent', icon: '[ ]', color: '#8ac06c' },
  { key: 'capital', label: 'Capital', icon: '$', color: '#f6c06a' },
  { key: 'data', label: 'Data', icon: '{ }', color: '#c79af5' },
  { key: 'influence', label: 'Influence', icon: '[ ]', color: '#e26d5a' },
  { key: 'trust', label: 'Trust', icon: '[ ]', color: '#6ec7a2' },
];

// Branch display configuration
const BRANCH_CONFIG: { id: BranchId; label: string; color: string }[] = [
  { id: 'capabilities', label: 'Capabilities', color: '#b84c42' },
  { id: 'safety', label: 'Safety', color: '#3d7a3a' },
  { id: 'ops', label: 'Operations', color: '#4a6eb8' },
  { id: 'policy', label: 'Policy', color: '#8a5cb8' },
];

export interface FactionDetailCallbacks {
  onClose: () => void;
  onCompare?: (factionId: string) => void;
  onViewRelationships?: () => void;
}

export interface FactionDetailOptions {
  isPlayer: boolean;
  intelQuality: number; // 0-1, affects how much detail is revealed
  gameState?: GameState;
}

/**
 * Create a resource bar with value
 */
function createResourceBar(
  key: ResourceKey,
  value: number,
  isPlayer: boolean,
  config: typeof RESOURCE_CONFIG[0]
): HTMLElement {
  const container = div({ className: 'dossier-resource' });

  const labelRow = div({ className: 'dossier-resource__header' });
  labelRow.innerHTML = `
    <span class="dossier-resource__label">${config.label}</span>
    <span class="dossier-resource__value" style="color: ${config.color}">
      ${isPlayer ? Math.round(value) : valueToBand(value)}
    </span>
  `;
  container.appendChild(labelRow);

  const barContainer = div({ className: 'dossier-resource__bar-container' });
  const barFill = div({ className: 'dossier-resource__bar-fill' });
  barFill.style.width = `${clamp(value, 0, 100)}%`;
  barFill.style.background = `linear-gradient(90deg, ${config.color}44, ${config.color})`;
  barContainer.appendChild(barFill);
  container.appendChild(barContainer);

  return container;
}

/**
 * Create research progress section
 */
function createResearchSection(
  faction: FactionState,
  isPlayer: boolean
): HTMLElement {
  const section = div({ className: 'dossier-section' });

  const header = div({ className: 'dossier-section__header' });
  header.innerHTML = '<span class="dossier-section__title">RESEARCH PROGRESS</span>';
  section.appendChild(header);

  const grid = div({ className: 'dossier-research-grid' });

  for (const branch of BRANCH_CONFIG) {
    const progress = faction.research[branch.id];
    const maxProgress = 100; // Research is 0-100 scale
    const percentage = (progress / maxProgress) * 100;

    const item = div({ className: 'dossier-research-item' });
    item.innerHTML = `
      <div class="dossier-research-item__header">
        <span class="dossier-research-item__label" style="color: ${branch.color}">${branch.label}</span>
        <span class="dossier-research-item__value">${isPlayer ? Math.round(progress) : valueToBand(progress)}</span>
      </div>
      <div class="dossier-research-item__bar">
        <div class="dossier-research-item__fill" style="width: ${percentage}%; background: ${branch.color}"></div>
      </div>
    `;
    grid.appendChild(item);
  }

  section.appendChild(grid);
  return section;
}

/**
 * Create unlocked technologies list
 */
function createTechSection(
  faction: FactionState,
  isPlayer: boolean,
  intelQuality: number
): HTMLElement {
  const section = div({ className: 'dossier-section' });

  const header = div({ className: 'dossier-section__header' });
  header.innerHTML = '<span class="dossier-section__title">UNLOCKED TECHNOLOGIES</span>';
  section.appendChild(header);

  const unlockedTechs = Array.from(faction.unlockedTechs);

  if (unlockedTechs.length === 0) {
    const empty = div({ className: 'dossier-tech-empty' });
    empty.textContent = 'No technologies unlocked yet.';
    section.appendChild(empty);
    return section;
  }

  // If not player and low intel, only show partial info
  const visibleTechs = isPlayer || intelQuality > 0.5
    ? unlockedTechs
    : unlockedTechs.slice(0, Math.ceil(unlockedTechs.length * intelQuality));

  const techList = div({ className: 'dossier-tech-list' });

  for (const techId of visibleTechs) {
    const tech = TECH_TREE.find(t => t.id === techId);
    if (!tech) continue;

    const techItem = div({ className: 'dossier-tech-item' });
    const branchColor = BRANCH_COLORS[tech.branch]?.primary || '#888';

    techItem.innerHTML = `
      <span class="dossier-tech-item__indicator" style="background: ${branchColor}"></span>
      <span class="dossier-tech-item__name">${tech.name}</span>
      <span class="dossier-tech-item__branch">${tech.branch}</span>
    `;
    techList.appendChild(techItem);
  }

  if (!isPlayer && intelQuality < 0.5 && unlockedTechs.length > visibleTechs.length) {
    const hidden = div({ className: 'dossier-tech-hidden' });
    hidden.textContent = `+ ${unlockedTechs.length - visibleTechs.length} classified entries`;
    techList.appendChild(hidden);
  }

  section.appendChild(techList);
  return section;
}

/**
 * Create faction personality/profile section
 */
function createProfileSection(
  faction: FactionState,
  isPlayer: boolean,
  intelQuality: number
): HTMLElement {
  const section = div({ className: 'dossier-section dossier-section--profile' });

  const profile = FACTION_PROFILES[faction.id] || {
    motto: '"Unknown directive."',
    description: 'Intelligence on this faction is limited.',
    strengths: ['Unknown'],
    weaknesses: ['Unknown'],
    personality: 'Assessment unavailable.',
  };

  const header = div({ className: 'dossier-section__header' });
  header.innerHTML = '<span class="dossier-section__title">FACTION PROFILE</span>';
  section.appendChild(header);

  const content = div({ className: 'dossier-profile-content' });

  // Motto
  const motto = div({ className: 'dossier-profile__motto' });
  motto.textContent = profile.motto;
  content.appendChild(motto);

  // Description
  const desc = div({ className: 'dossier-profile__description' });
  desc.textContent = profile.description;
  content.appendChild(desc);

  // Strengths & Weaknesses (only with good intel or player)
  if (isPlayer || intelQuality > 0.3) {
    const traits = div({ className: 'dossier-profile__traits' });

    const strengthsEl = div({ className: 'dossier-profile__trait-group' });
    strengthsEl.innerHTML = `
      <div class="dossier-profile__trait-label">Strengths</div>
      <ul class="dossier-profile__trait-list dossier-profile__trait-list--positive">
        ${profile.strengths.map(s => `<li>${s}</li>`).join('')}
      </ul>
    `;
    traits.appendChild(strengthsEl);

    const weaknessesEl = div({ className: 'dossier-profile__trait-group' });
    weaknessesEl.innerHTML = `
      <div class="dossier-profile__trait-label">Weaknesses</div>
      <ul class="dossier-profile__trait-list dossier-profile__trait-list--negative">
        ${profile.weaknesses.map(w => `<li>${w}</li>`).join('')}
      </ul>
    `;
    traits.appendChild(weaknessesEl);

    content.appendChild(traits);
  }

  // Personality assessment
  if (isPlayer || intelQuality > 0.5) {
    const personality = div({ className: 'dossier-profile__personality' });
    personality.innerHTML = `
      <span class="dossier-profile__personality-label">Assessment:</span>
      <span class="dossier-profile__personality-text">${profile.personality}</span>
    `;
    content.appendChild(personality);
  }

  section.appendChild(content);
  return section;
}

/**
 * Create status indicators section (AGI readiness, exposure, etc.)
 */
function createStatusSection(
  faction: FactionState,
  isPlayer: boolean
): HTMLElement {
  const section = div({ className: 'dossier-section' });

  const header = div({ className: 'dossier-section__header' });
  header.innerHTML = '<span class="dossier-section__title">CURRENT STATUS</span>';
  section.appendChild(header);

  const grid = div({ className: 'dossier-status-grid' });

  // AGI Readiness
  const agiStatus = div({ className: 'dossier-status-item' });
  const agiReady = faction.canDeployAgi;
  agiStatus.innerHTML = `
    <span class="dossier-status-item__label">AGI Readiness</span>
    <span class="dossier-status-item__value ${agiReady ? 'dossier-status-item__value--positive' : ''}">
      ${isPlayer ? (agiReady ? 'READY' : 'NOT READY') : (agiReady ? 'SUSPECTED' : 'UNKNOWN')}
    </span>
  `;
  grid.appendChild(agiStatus);

  // Capability Score
  const capStatus = div({ className: 'dossier-status-item' });
  capStatus.innerHTML = `
    <span class="dossier-status-item__label">Capability</span>
    <span class="dossier-status-item__value" style="color: var(--branch-capabilities)">
      ${isPlayer ? Math.round(faction.capabilityScore) : valueToBand(faction.capabilityScore)}
    </span>
  `;
  grid.appendChild(capStatus);

  // Safety Score
  const safeStatus = div({ className: 'dossier-status-item' });
  safeStatus.innerHTML = `
    <span class="dossier-status-item__label">Safety</span>
    <span class="dossier-status-item__value" style="color: var(--branch-safety)">
      ${isPlayer ? Math.round(faction.safetyScore) : valueToBand(faction.safetyScore)}
    </span>
  `;
  grid.appendChild(safeStatus);

  // Exposure (only for player)
  if (isPlayer) {
    const expStatus = div({ className: 'dossier-status-item' });
    const expLevel = faction.exposure >= 3 ? 'CRITICAL' : faction.exposure >= 1 ? 'ELEVATED' : 'CLEAR';
    const expClass = faction.exposure >= 3 ? 'negative' : faction.exposure >= 1 ? 'warning' : 'positive';
    expStatus.innerHTML = `
      <span class="dossier-status-item__label">Exposure Risk</span>
      <span class="dossier-status-item__value dossier-status-item__value--${expClass}">
        ${expLevel} (${faction.exposure})
      </span>
    `;
    grid.appendChild(expStatus);
  }

  // Safety Culture
  const cultureStatus = div({ className: 'dossier-status-item' });
  cultureStatus.innerHTML = `
    <span class="dossier-status-item__label">Safety Culture</span>
    <span class="dossier-status-item__value">
      ${isPlayer ? Math.round(faction.safetyCulture) : valueToBand(faction.safetyCulture)}
    </span>
  `;
  grid.appendChild(cultureStatus);

  // OPSEC
  const opsecStatus = div({ className: 'dossier-status-item' });
  opsecStatus.innerHTML = `
    <span class="dossier-status-item__label">OPSEC Level</span>
    <span class="dossier-status-item__value">
      ${isPlayer ? Math.round(faction.opsec) : valueToBand(faction.opsec)}
    </span>
  `;
  grid.appendChild(opsecStatus);

  section.appendChild(grid);
  return section;
}

/**
 * Render the full faction detail modal
 */
export function renderFactionDetailScreen(
  faction: FactionState,
  options: FactionDetailOptions,
  callbacks: FactionDetailCallbacks
): HTMLElement {
  const { isPlayer, intelQuality, gameState } = options;

  // Create overlay backdrop
  const overlay = div({ className: 'faction-detail-overlay' });

  // Create modal container
  const modal = div({ className: 'faction-detail-modal' });

  // Header with faction name and classification
  const headerEl = div({ className: 'faction-detail__header' });

  const classification = isPlayer ? 'YOUR ORGANIZATION' : 'INTELLIGENCE DOSSIER';
  const classificationClass = isPlayer ? 'faction-detail__classification--player' : 'faction-detail__classification--intel';

  headerEl.innerHTML = `
    <div class="faction-detail__classification ${classificationClass}">${classification}</div>
    <div class="faction-detail__title-row">
      <div class="faction-detail__icon">${faction.type === 'lab' ? ICONS.lab : ICONS.government}</div>
      <div class="faction-detail__title-group">
        <h2 class="faction-detail__title">${faction.name}</h2>
        <span class="faction-detail__type">${faction.type === 'lab' ? 'AI Laboratory' : 'Government Entity'}</span>
      </div>
    </div>
    <button class="faction-detail__close">&times;</button>
  `;
  modal.appendChild(headerEl);

  // Close button handler
  const closeBtn = headerEl.querySelector('.faction-detail__close') as HTMLButtonElement;
  closeBtn.onclick = callbacks.onClose;

  // Main content area
  const content = div({ className: 'faction-detail__content' });

  // Left column - Radar chart and resources
  const leftCol = div({ className: 'faction-detail__column faction-detail__column--left' });

  // Radar chart
  const radarSection = div({ className: 'dossier-section dossier-section--radar' });
  const radarHeader = div({ className: 'dossier-section__header' });
  radarHeader.innerHTML = '<span class="dossier-section__title">RESOURCE PROFILE</span>';
  radarSection.appendChild(radarHeader);

  const radarContainer = div({ className: 'faction-detail__radar' });
  const radarChart = isPlayer
    ? renderMiniRadarChart(faction.resources, {
        size: 180,
        fillColor: RADAR_COLORS.player.fill,
        strokeColor: RADAR_COLORS.player.stroke,
        showLabels: true,
      })
    : renderFogOfWarRadarChart(faction.resources, { size: 180, showLabels: true });
  radarContainer.appendChild(radarChart);
  radarSection.appendChild(radarContainer);
  leftCol.appendChild(radarSection);

  // Resources list
  const resourcesSection = div({ className: 'dossier-section' });
  const resourcesHeader = div({ className: 'dossier-section__header' });
  resourcesHeader.innerHTML = '<span class="dossier-section__title">RESOURCES</span>';
  resourcesSection.appendChild(resourcesHeader);

  const resourcesList = div({ className: 'dossier-resources-list' });
  for (const config of RESOURCE_CONFIG) {
    const bar = createResourceBar(config.key, faction.resources[config.key], isPlayer, config);
    resourcesList.appendChild(bar);
  }
  resourcesSection.appendChild(resourcesList);
  leftCol.appendChild(resourcesSection);

  content.appendChild(leftCol);

  // Right column - Status, Research, Tech, Profile
  const rightCol = div({ className: 'faction-detail__column faction-detail__column--right' });

  rightCol.appendChild(createStatusSection(faction, isPlayer));
  rightCol.appendChild(createResearchSection(faction, isPlayer));
  rightCol.appendChild(createTechSection(faction, isPlayer, intelQuality));
  rightCol.appendChild(createProfileSection(faction, isPlayer, intelQuality));

  content.appendChild(rightCol);
  modal.appendChild(content);

  // Footer with action buttons
  const footer = div({ className: 'faction-detail__footer' });

  if (callbacks.onCompare) {
    const compareBtn = button({ className: 'faction-detail__btn faction-detail__btn--secondary' });
    compareBtn.textContent = 'Compare Factions';
    compareBtn.onclick = () => callbacks.onCompare?.(faction.id);
    footer.appendChild(compareBtn);
  }

  if (callbacks.onViewRelationships) {
    const relBtn = button({ className: 'faction-detail__btn faction-detail__btn--secondary' });
    relBtn.textContent = 'View Relationships';
    relBtn.onclick = callbacks.onViewRelationships;
    footer.appendChild(relBtn);
  }

  const closeFooterBtn = button({ className: 'faction-detail__btn faction-detail__btn--primary' });
  closeFooterBtn.textContent = 'Close Dossier';
  closeFooterBtn.onclick = callbacks.onClose;
  footer.appendChild(closeFooterBtn);

  modal.appendChild(footer);

  // Intel quality indicator (for non-player factions)
  if (!isPlayer) {
    const intelBadge = div({ className: 'faction-detail__intel-badge' });
    const intelLevel = intelQuality > 0.7 ? 'HIGH' : intelQuality > 0.4 ? 'MEDIUM' : 'LOW';
    const intelClass = intelQuality > 0.7 ? 'high' : intelQuality > 0.4 ? 'medium' : 'low';
    intelBadge.innerHTML = `
      <span class="faction-detail__intel-label">Intel Quality:</span>
      <span class="faction-detail__intel-value faction-detail__intel-value--${intelClass}">${intelLevel}</span>
    `;
    modal.appendChild(intelBadge);
  }

  overlay.appendChild(modal);

  // Close on backdrop click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      callbacks.onClose();
    }
  };

  return overlay;
}

/**
 * Show faction detail screen as a modal
 */
export function showFactionDetail(
  faction: FactionState,
  options: FactionDetailOptions,
  callbacks: FactionDetailCallbacks
): () => void {
  const modal = renderFactionDetailScreen(faction, options, callbacks);
  document.body.appendChild(modal);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    modal.classList.add('faction-detail-overlay--visible');
  });

  // Return cleanup function
  return () => {
    modal.classList.remove('faction-detail-overlay--visible');
    setTimeout(() => {
      modal.remove();
    }, 200);
  };
}
