// Faction Relationships - Visual relationship web showing alliances, tensions, and treaties
// Displays colored lines between factions representing their relationship status

import { el, div, span, button, ICONS } from './base.js';
import { createSvgElement, createSvgContainer, polarToCartesian } from '../utils/svg.js';
import type { FactionState, FactionType, GameState } from '../../core/types.js';

// Relationship types and their visual properties
export type RelationshipType = 'ally' | 'neutral' | 'tension' | 'rival' | 'treaty';

export interface FactionRelationship {
  fromId: string;
  toId: string;
  type: RelationshipType;
  strength: number; // 0-1 intensity
  label?: string;
}

// Color scheme for relationship types
const RELATIONSHIP_COLORS: Record<RelationshipType, { stroke: string; glow: string }> = {
  ally: { stroke: '#6ec7a2', glow: 'rgba(110, 199, 162, 0.4)' },
  neutral: { stroke: '#7d9182', glow: 'rgba(125, 145, 130, 0.2)' },
  tension: { stroke: '#f6c06a', glow: 'rgba(246, 192, 106, 0.4)' },
  rival: { stroke: '#e26d5a', glow: 'rgba(226, 109, 90, 0.4)' },
  treaty: { stroke: '#5a9de2', glow: 'rgba(90, 157, 226, 0.4)' },
};

// Faction position configuration for the web layout
const FACTION_POSITIONS: Record<string, { angle: number; radius: number }> = {
  us_lab_a: { angle: -90, radius: 0.85 },   // Top
  us_lab_b: { angle: -30, radius: 0.85 },   // Top right
  cn_lab: { angle: 30, radius: 0.85 },      // Bottom right
  us_gov: { angle: 150, radius: 0.85 },     // Bottom left
  cn_gov: { angle: 210, radius: 0.85 },     // Left
};

export interface RelationshipsCallbacks {
  onClose: () => void;
  onSelectFaction?: (factionId: string) => void;
  onSelectRelationship?: (fromId: string, toId: string) => void;
}

export interface RelationshipsOptions {
  playerFactionId: string;
  highlightedFactionId?: string;
}

/**
 * Calculate dynamic relationships based on faction states
 * This generates relationships based on faction attributes
 */
export function calculateRelationships(
  factions: Record<string, FactionState>,
  playerFactionId: string
): FactionRelationship[] {
  const relationships: FactionRelationship[] = [];
  const factionIds = Object.keys(factions);

  for (let i = 0; i < factionIds.length; i++) {
    for (let j = i + 1; j < factionIds.length; j++) {
      const f1 = factions[factionIds[i]];
      const f2 = factions[factionIds[j]];

      if (!f1 || !f2) continue;

      const relationship = calculatePairRelationship(f1, f2);
      relationships.push(relationship);
    }
  }

  return relationships;
}

/**
 * Calculate relationship between two factions based on their attributes
 */
function calculatePairRelationship(f1: FactionState, f2: FactionState): FactionRelationship {
  // Base relationship factors
  const sameType = f1.type === f2.type;
  const sameSide = (f1.id.startsWith('us') && f2.id.startsWith('us')) ||
                   (f1.id.startsWith('cn') && f2.id.startsWith('cn'));

  // Calculate relationship score (-1 to 1)
  let score = 0;

  // Same national alignment boosts relationship
  if (sameSide) score += 0.4;

  // Same type (both labs or both govs) creates competition or alliance
  if (sameType) {
    if (f1.type === 'lab') {
      // Labs compete
      score -= 0.3;
    } else {
      // Governments tend to cooperate (with same alignment)
      score += sameSide ? 0.2 : -0.2;
    }
  } else {
    // Lab-gov relationships depend on trust
    const trustDiff = Math.abs(f1.resources.trust - f2.resources.trust);
    score += sameSide ? 0.3 : -0.1;
    score += (f1.resources.trust + f2.resources.trust) / 200 * 0.3;
  }

  // Safety culture alignment
  const safetyCultureDiff = Math.abs(f1.safetyCulture - f2.safetyCulture);
  score -= (safetyCultureDiff / 100) * 0.3;

  // Capability gap creates tension
  const capGap = Math.abs(f1.capabilityScore - f2.capabilityScore);
  if (capGap > 20) score -= 0.2;

  // Clamp score
  score = Math.max(-1, Math.min(1, score));

  // Determine relationship type
  let type: RelationshipType;
  let label: string | undefined;

  if (score > 0.5) {
    type = 'ally';
    label = sameSide ? 'Aligned' : 'Cooperative';
  } else if (score > 0.1) {
    type = sameType && f1.type === 'government' ? 'treaty' : 'neutral';
    label = type === 'treaty' ? 'Agreement' : undefined;
  } else if (score > -0.3) {
    type = 'neutral';
  } else if (score > -0.6) {
    type = 'tension';
    label = 'Competitive';
  } else {
    type = 'rival';
    label = 'Adversarial';
  }

  return {
    fromId: f1.id,
    toId: f2.id,
    type,
    strength: Math.abs(score),
    label,
  };
}

/**
 * Create SVG visualization of faction relationships
 */
function createRelationshipsSVG(
  factions: Record<string, FactionState>,
  relationships: FactionRelationship[],
  options: RelationshipsOptions,
  onSelectFaction: ((id: string) => void) | undefined,
  onSelectRelationship: ((fromId: string, toId: string) => void) | undefined
): SVGSVGElement {
  const size = 400;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size / 2 - 50;

  const svg = createSvgContainer(size, size);
  svg.classList.add('relationships-web');

  // Create definitions for glow effects
  const defs = createSvgElement('defs', {});

  // Add glow filters for each relationship type
  for (const [type, colors] of Object.entries(RELATIONSHIP_COLORS)) {
    const filter = createSvgElement('filter', {
      id: `glow-${type}`,
      x: '-50%',
      y: '-50%',
      width: '200%',
      height: '200%',
    });

    const feGaussianBlur = createSvgElement('feGaussianBlur', {
      stdDeviation: 3,
      result: 'coloredBlur',
    });
    filter.appendChild(feGaussianBlur);

    const feMerge = createSvgElement('feMerge', {});
    const feMergeNode1 = createSvgElement('feMergeNode', { in: 'coloredBlur' });
    const feMergeNode2 = createSvgElement('feMergeNode', { in: 'SourceGraphic' });
    feMerge.appendChild(feMergeNode1);
    feMerge.appendChild(feMergeNode2);
    filter.appendChild(feMerge);

    defs.appendChild(filter);
  }
  svg.appendChild(defs);

  // Draw relationship lines
  const linesGroup = createSvgElement('g', { class: 'relationships-lines' });

  for (const rel of relationships) {
    const pos1 = FACTION_POSITIONS[rel.fromId];
    const pos2 = FACTION_POSITIONS[rel.toId];
    if (!pos1 || !pos2) continue;

    const p1 = polarToCartesian(cx, cy, maxRadius * pos1.radius, (pos1.angle * Math.PI) / 180);
    const p2 = polarToCartesian(cx, cy, maxRadius * pos2.radius, (pos2.angle * Math.PI) / 180);

    const colors = RELATIONSHIP_COLORS[rel.type];
    const strokeWidth = 1 + rel.strength * 2;

    const line = createSvgElement('line', {
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      stroke: colors.stroke,
      'stroke-width': strokeWidth,
      'stroke-opacity': 0.3 + rel.strength * 0.5,
      filter: `url(#glow-${rel.type})`,
      class: `relationship-line relationship-line--${rel.type}`,
    });

    // Add click handler
    if (onSelectRelationship) {
      line.style.cursor = 'pointer';
      line.addEventListener('click', () => onSelectRelationship(rel.fromId, rel.toId));
    }

    linesGroup.appendChild(line);

    // Add label at midpoint for significant relationships
    if (rel.label && rel.strength > 0.3) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const labelBg = createSvgElement('rect', {
        x: midX - 30,
        y: midY - 8,
        width: 60,
        height: 16,
        rx: 4,
        fill: 'rgba(10, 15, 12, 0.8)',
        stroke: colors.stroke,
        'stroke-width': 0.5,
      });
      linesGroup.appendChild(labelBg);

      const labelText = createSvgElement('text', {
        x: midX,
        y: midY + 4,
        'text-anchor': 'middle',
        fill: colors.stroke,
        'font-size': 9,
        'font-family': 'Space Grotesk, sans-serif',
        class: 'relationship-label',
      });
      labelText.textContent = rel.label;
      linesGroup.appendChild(labelText);
    }
  }

  svg.appendChild(linesGroup);

  // Draw faction nodes
  const nodesGroup = createSvgElement('g', { class: 'faction-nodes' });

  for (const [factionId, pos] of Object.entries(FACTION_POSITIONS)) {
    const faction = factions[factionId];
    if (!faction) continue;

    const point = polarToCartesian(cx, cy, maxRadius * pos.radius, (pos.angle * Math.PI) / 180);
    const isPlayer = factionId === options.playerFactionId;
    const isHighlighted = factionId === options.highlightedFactionId;

    // Node background
    const nodeGroup = createSvgElement('g', {
      class: `faction-node ${isPlayer ? 'faction-node--player' : ''} ${isHighlighted ? 'faction-node--highlighted' : ''}`,
      transform: `translate(${point.x}, ${point.y})`,
    });

    // Outer ring
    const outerRing = createSvgElement('circle', {
      cx: 0,
      cy: 0,
      r: 28,
      fill: 'none',
      stroke: isPlayer ? 'rgba(138, 192, 108, 0.5)' : 'rgba(255, 255, 255, 0.15)',
      'stroke-width': isHighlighted ? 2 : 1,
    });
    nodeGroup.appendChild(outerRing);

    // Inner circle
    const innerCircle = createSvgElement('circle', {
      cx: 0,
      cy: 0,
      r: 24,
      fill: faction.type === 'lab' ? 'rgba(90, 157, 226, 0.2)' : 'rgba(199, 154, 245, 0.2)',
      stroke: faction.type === 'lab' ? 'rgba(90, 157, 226, 0.6)' : 'rgba(199, 154, 245, 0.6)',
      'stroke-width': 1.5,
    });
    nodeGroup.appendChild(innerCircle);

    // Faction initial
    const initial = createSvgElement('text', {
      x: 0,
      y: 4,
      'text-anchor': 'middle',
      fill: 'var(--ink)',
      'font-size': 14,
      'font-weight': 600,
      'font-family': 'Space Grotesk, sans-serif',
    });
    initial.textContent = faction.name.charAt(0);
    nodeGroup.appendChild(initial);

    // Faction name label
    const nameLabel = createSvgElement('text', {
      x: 0,
      y: 42,
      'text-anchor': 'middle',
      fill: 'var(--ink)',
      'font-size': 10,
      'font-weight': 500,
      'font-family': 'Space Grotesk, sans-serif',
    });
    nameLabel.textContent = faction.name;
    nodeGroup.appendChild(nameLabel);

    // Player badge
    if (isPlayer) {
      const badge = createSvgElement('text', {
        x: 0,
        y: -32,
        'text-anchor': 'middle',
        fill: 'var(--accent)',
        'font-size': 8,
        'font-weight': 600,
        'letter-spacing': '0.1em',
      });
      badge.textContent = 'YOU';
      nodeGroup.appendChild(badge);
    }

    // Click handler
    if (onSelectFaction) {
      nodeGroup.style.cursor = 'pointer';
      nodeGroup.addEventListener('click', () => onSelectFaction(factionId));
    }

    nodesGroup.appendChild(nodeGroup);
  }

  svg.appendChild(nodesGroup);

  return svg;
}

/**
 * Create relationship details panel
 */
function createRelationshipDetails(
  relationships: FactionRelationship[],
  factions: Record<string, FactionState>,
  selectedPair?: { fromId: string; toId: string }
): HTMLElement {
  const container = div({ className: 'relationships-details' });

  const header = div({ className: 'relationships-details__header' });
  header.innerHTML = '<span class="relationships-details__title">RELATIONSHIP STATUS</span>';
  container.appendChild(header);

  // Legend
  const legend = div({ className: 'relationships-legend' });
  for (const [type, colors] of Object.entries(RELATIONSHIP_COLORS)) {
    const item = div({ className: 'relationships-legend__item' });
    item.innerHTML = `
      <span class="relationships-legend__color" style="background: ${colors.stroke}"></span>
      <span class="relationships-legend__label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
    `;
    legend.appendChild(item);
  }
  container.appendChild(legend);

  // Relationship list
  const list = div({ className: 'relationships-list' });

  for (const rel of relationships) {
    const f1 = factions[rel.fromId];
    const f2 = factions[rel.toId];
    if (!f1 || !f2) continue;

    const isSelected = selectedPair &&
      ((selectedPair.fromId === rel.fromId && selectedPair.toId === rel.toId) ||
       (selectedPair.fromId === rel.toId && selectedPair.toId === rel.fromId));

    const item = div({ className: `relationships-list__item ${isSelected ? 'relationships-list__item--selected' : ''}` });
    const colors = RELATIONSHIP_COLORS[rel.type];

    item.innerHTML = `
      <div class="relationships-list__factions">
        <span class="relationships-list__faction">${f1.name}</span>
        <span class="relationships-list__connector" style="color: ${colors.stroke}">---</span>
        <span class="relationships-list__faction">${f2.name}</span>
      </div>
      <div class="relationships-list__status">
        <span class="relationships-list__type" style="color: ${colors.stroke}">${rel.type.toUpperCase()}</span>
        ${rel.label ? `<span class="relationships-list__label">${rel.label}</span>` : ''}
      </div>
    `;

    list.appendChild(item);
  }

  container.appendChild(list);
  return container;
}

/**
 * Render the faction relationships modal
 */
export function renderFactionRelationships(
  factions: Record<string, FactionState>,
  options: RelationshipsOptions,
  callbacks: RelationshipsCallbacks
): HTMLElement {
  const overlay = div({ className: 'relationships-overlay' });
  const modal = div({ className: 'relationships-modal' });

  // Header
  const headerEl = div({ className: 'relationships-header' });
  headerEl.innerHTML = `
    <div class="relationships-header__classification">INTELLIGENCE NETWORK</div>
    <h2 class="relationships-header__title">Faction Relationships</h2>
    <button class="relationships-header__close">&times;</button>
  `;
  modal.appendChild(headerEl);

  const closeBtn = headerEl.querySelector('.relationships-header__close') as HTMLButtonElement;
  closeBtn.onclick = callbacks.onClose;

  // Calculate relationships
  const relationships = calculateRelationships(factions, options.playerFactionId);

  // Content area
  const content = div({ className: 'relationships-content' });

  // SVG web visualization
  const webContainer = div({ className: 'relationships-web-container' });
  const svg = createRelationshipsSVG(
    factions,
    relationships,
    options,
    callbacks.onSelectFaction,
    callbacks.onSelectRelationship
  );
  webContainer.appendChild(svg);
  content.appendChild(webContainer);

  // Details panel
  const details = createRelationshipDetails(relationships, factions);
  content.appendChild(details);

  modal.appendChild(content);

  // Footer
  const footer = div({ className: 'relationships-footer' });
  const closeFooterBtn = button({ className: 'relationships-footer__btn' });
  closeFooterBtn.textContent = 'Close';
  closeFooterBtn.onclick = callbacks.onClose;
  footer.appendChild(closeFooterBtn);
  modal.appendChild(footer);

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
 * Show relationships modal
 */
export function showFactionRelationships(
  factions: Record<string, FactionState>,
  options: RelationshipsOptions,
  callbacks: RelationshipsCallbacks
): () => void {
  const modal = renderFactionRelationships(factions, options, callbacks);
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('relationships-overlay--visible');
  });

  return () => {
    modal.classList.remove('relationships-overlay--visible');
    setTimeout(() => {
      modal.remove();
    }, 200);
  };
}
