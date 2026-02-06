// Faction Comparison - Side-by-side comparison of multiple factions
// Shows radar charts, stat comparisons, and relative strengths

import { el, div, span, button, ICONS, clamp, formatNum } from './base.js';
import { renderMiniRadarChart, renderFogOfWarRadarChart, valueToBand, RADAR_COLORS } from './RadarChart.js';
import { createSvgElement, createSvgContainer, polarToCartesian, type RadarAxis } from '../utils/svg.js';
import type { FactionState, FactionType, Resources, ResourceKey, BranchId } from '../../core/types.js';

// Resource and stat configuration
const COMPARISON_STATS: { key: string; label: string; getter: (f: FactionState) => number; color: string }[] = [
  { key: 'capabilityScore', label: 'Capability', getter: f => f.capabilityScore, color: '#b84c42' },
  { key: 'safetyScore', label: 'Safety', getter: f => f.safetyScore, color: '#3d7a3a' },
  { key: 'compute', label: 'Compute', getter: f => f.resources.compute, color: '#5a9de2' },
  { key: 'talent', label: 'Talent', getter: f => f.resources.talent, color: '#8ac06c' },
  { key: 'capital', label: 'Capital', getter: f => f.resources.capital, color: '#f6c06a' },
  { key: 'data', label: 'Data', getter: f => f.resources.data, color: '#c79af5' },
  { key: 'influence', label: 'Influence', getter: f => f.resources.influence, color: '#e26d5a' },
  { key: 'trust', label: 'Trust', getter: f => f.resources.trust, color: '#6ec7a2' },
  { key: 'safetyCulture', label: 'Safety Culture', getter: f => f.safetyCulture, color: '#6ec7a2' },
  { key: 'opsec', label: 'OPSEC', getter: f => f.opsec, color: '#7d9182' },
];

// Faction colors for comparison charts
const FACTION_COMPARISON_COLORS: Record<string, { fill: string; stroke: string }> = {
  us_lab_a: { fill: 'rgba(138, 192, 108, 0.25)', stroke: 'rgba(138, 192, 108, 0.8)' },
  us_lab_b: { fill: 'rgba(226, 109, 90, 0.25)', stroke: 'rgba(226, 109, 90, 0.8)' },
  cn_lab: { fill: 'rgba(90, 157, 226, 0.25)', stroke: 'rgba(90, 157, 226, 0.8)' },
  us_gov: { fill: 'rgba(199, 154, 245, 0.25)', stroke: 'rgba(199, 154, 245, 0.8)' },
  cn_gov: { fill: 'rgba(246, 192, 106, 0.25)', stroke: 'rgba(246, 192, 106, 0.8)' },
};

export interface ComparisonCallbacks {
  onClose: () => void;
  onSelectFaction?: (factionId: string) => void;
  onRemoveFaction?: (factionId: string) => void;
}

export interface ComparisonOptions {
  playerFactionId: string;
  intelQuality: Record<string, number>; // factionId -> intel quality 0-1
}

/**
 * Determine if we can see exact values for a faction
 */
function canSeeExact(factionId: string, playerFactionId: string, intelQuality: number): boolean {
  return factionId === playerFactionId || intelQuality > 0.7;
}

/**
 * Create an overlaid radar chart comparing multiple factions
 */
function createComparisonRadarChart(
  factions: FactionState[],
  options: ComparisonOptions
): SVGSVGElement {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - 40;

  const svg = createSvgContainer(size, size);
  svg.classList.add('comparison-radar');

  // Grid circles
  const gridGroup = createSvgElement('g', { class: 'comparison-radar__grid' });
  for (let level = 1; level <= 3; level++) {
    const r = (radius * level) / 3;
    const circle = createSvgElement('circle', {
      cx,
      cy,
      r,
      fill: 'none',
      stroke: 'rgba(255, 255, 255, 0.08)',
      'stroke-width': 1,
    });
    gridGroup.appendChild(circle);
  }
  svg.appendChild(gridGroup);

  // Resource axes (6 resources)
  const resources: ResourceKey[] = ['compute', 'talent', 'capital', 'data', 'influence', 'trust'];
  const labels = ['Compute', 'Talent', 'Capital', 'Data', 'Influence', 'Trust'];
  const n = resources.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2;

  // Draw axes and labels
  const axesGroup = createSvgElement('g', { class: 'comparison-radar__axes' });
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const end = polarToCartesian(cx, cy, radius, angle);

    // Axis line
    const line = createSvgElement('line', {
      x1: cx,
      y1: cy,
      x2: end.x,
      y2: end.y,
      stroke: 'rgba(255, 255, 255, 0.1)',
      'stroke-width': 1,
    });
    axesGroup.appendChild(line);

    // Label
    const labelRadius = radius + 20;
    const labelPos = polarToCartesian(cx, cy, labelRadius, angle);
    const text = createSvgElement('text', {
      x: labelPos.x,
      y: labelPos.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: 'var(--muted)',
      'font-size': 9,
      'font-family': 'Space Grotesk, sans-serif',
    });
    text.textContent = labels[i].substring(0, 3).toUpperCase();
    axesGroup.appendChild(text);
  }
  svg.appendChild(axesGroup);

  // Draw each faction's polygon
  for (const faction of factions) {
    const colors = FACTION_COMPARISON_COLORS[faction.id] || { fill: 'rgba(128, 128, 128, 0.2)', stroke: 'rgba(128, 128, 128, 0.6)' };
    const intelQuality = options.intelQuality[faction.id] || 0;
    const isPlayer = faction.id === options.playerFactionId;

    // If intel is low and not player, use fog of war (bands instead of exact)
    const useFog = !isPlayer && intelQuality < 0.5;

    const points: { x: number; y: number }[] = resources.map((key, i) => {
      const angle = startAngle + i * angleStep;
      let value = faction.resources[key];

      // Apply fog of war
      if (useFog) {
        const band = valueToBand(value);
        value = band === 'Low' ? 25 : band === 'Med' ? 55 : 85;
      }

      const normalizedValue = Math.min(1, Math.max(0, value / 100));
      const r = radius * normalizedValue;
      return polarToCartesian(cx, cy, r, angle);
    });

    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

    const polygon = createSvgElement('polygon', {
      points: pointsStr,
      fill: colors.fill,
      stroke: colors.stroke,
      'stroke-width': 2,
      class: `comparison-radar__polygon comparison-radar__polygon--${faction.id}`,
    });
    svg.appendChild(polygon);

    // Data points
    for (const point of points) {
      const dot = createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 3,
        fill: colors.stroke,
      });
      svg.appendChild(dot);
    }
  }

  return svg;
}

/**
 * Create a bar comparison chart for a specific stat
 */
function createStatComparison(
  stat: typeof COMPARISON_STATS[0],
  factions: FactionState[],
  options: ComparisonOptions
): HTMLElement {
  const container = div({ className: 'comparison-stat' });

  const header = div({ className: 'comparison-stat__header' });
  header.innerHTML = `<span class="comparison-stat__label">${stat.label}</span>`;
  container.appendChild(header);

  const bars = div({ className: 'comparison-stat__bars' });

  // Find max value for scaling
  const values = factions.map(f => stat.getter(f));
  const maxValue = Math.max(...values, 1);

  for (const faction of factions) {
    const value = stat.getter(faction);
    const intelQuality = options.intelQuality[faction.id] || 0;
    const isPlayer = faction.id === options.playerFactionId;
    const showExact = canSeeExact(faction.id, options.playerFactionId, intelQuality);

    const barRow = div({ className: 'comparison-stat__bar-row' });
    const colors = FACTION_COMPARISON_COLORS[faction.id] || { fill: 'rgba(128, 128, 128, 0.2)', stroke: 'rgba(128, 128, 128, 0.6)' };

    const percentage = (value / 100) * 100; // Assuming max 100 for stats

    barRow.innerHTML = `
      <span class="comparison-stat__faction-name">${faction.name.substring(0, 8)}</span>
      <div class="comparison-stat__bar-container">
        <div class="comparison-stat__bar-fill" style="width: ${percentage}%; background: ${colors.stroke}"></div>
      </div>
      <span class="comparison-stat__value" style="color: ${colors.stroke}">
        ${showExact ? Math.round(value) : valueToBand(value)}
      </span>
    `;

    bars.appendChild(barRow);
  }

  container.appendChild(bars);
  return container;
}

/**
 * Create faction comparison legend
 */
function createComparisonLegend(
  factions: FactionState[],
  options: ComparisonOptions,
  onRemove?: (factionId: string) => void
): HTMLElement {
  const legend = div({ className: 'comparison-legend' });

  for (const faction of factions) {
    const colors = FACTION_COMPARISON_COLORS[faction.id] || { fill: 'rgba(128, 128, 128, 0.2)', stroke: 'rgba(128, 128, 128, 0.6)' };
    const isPlayer = faction.id === options.playerFactionId;
    const intelQuality = options.intelQuality[faction.id] || 0;
    const intelLevel = isPlayer ? 'FULL' : intelQuality > 0.7 ? 'HIGH' : intelQuality > 0.4 ? 'MED' : 'LOW';

    const item = div({ className: `comparison-legend__item ${isPlayer ? 'comparison-legend__item--player' : ''}` });

    item.innerHTML = `
      <span class="comparison-legend__color" style="background: ${colors.stroke}"></span>
      <span class="comparison-legend__name">${faction.name}</span>
      <span class="comparison-legend__type">${faction.type === 'lab' ? 'Lab' : 'Gov'}</span>
      ${!isPlayer ? `<span class="comparison-legend__intel comparison-legend__intel--${intelLevel.toLowerCase()}">${intelLevel}</span>` : ''}
      ${isPlayer ? '<span class="comparison-legend__you">YOU</span>' : ''}
    `;

    if (onRemove && !isPlayer && factions.length > 2) {
      const removeBtn = button({ className: 'comparison-legend__remove' });
      removeBtn.innerHTML = '&times;';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        onRemove(faction.id);
      };
      item.appendChild(removeBtn);
    }

    legend.appendChild(item);
  }

  return legend;
}

/**
 * Create summary analysis of comparison
 */
function createComparisonAnalysis(
  factions: FactionState[],
  options: ComparisonOptions
): HTMLElement {
  const analysis = div({ className: 'comparison-analysis' });

  const header = div({ className: 'comparison-analysis__header' });
  header.innerHTML = '<span class="comparison-analysis__title">COMPARATIVE ANALYSIS</span>';
  analysis.appendChild(header);

  // Find leaders in each category
  const leaders: { category: string; leader: FactionState; value: number }[] = [];

  // Capability leader
  const capLeader = factions.reduce((a, b) => a.capabilityScore > b.capabilityScore ? a : b);
  leaders.push({ category: 'Capability', leader: capLeader, value: capLeader.capabilityScore });

  // Safety leader
  const safeLeader = factions.reduce((a, b) => a.safetyScore > b.safetyScore ? a : b);
  leaders.push({ category: 'Safety', leader: safeLeader, value: safeLeader.safetyScore });

  // Compute leader
  const compLeader = factions.reduce((a, b) => a.resources.compute > b.resources.compute ? a : b);
  leaders.push({ category: 'Compute', leader: compLeader, value: compLeader.resources.compute });

  // Trust leader
  const trustLeader = factions.reduce((a, b) => a.resources.trust > b.resources.trust ? a : b);
  leaders.push({ category: 'Trust', leader: trustLeader, value: trustLeader.resources.trust });

  const list = div({ className: 'comparison-analysis__list' });

  for (const { category, leader, value } of leaders) {
    const isPlayer = leader.id === options.playerFactionId;
    const intelQuality = options.intelQuality[leader.id] || 0;
    const showExact = canSeeExact(leader.id, options.playerFactionId, intelQuality);

    const item = div({ className: 'comparison-analysis__item' });
    const colors = FACTION_COMPARISON_COLORS[leader.id] || { fill: 'rgba(128, 128, 128, 0.2)', stroke: 'rgba(128, 128, 128, 0.6)' };

    item.innerHTML = `
      <span class="comparison-analysis__category">${category} Leader:</span>
      <span class="comparison-analysis__leader" style="color: ${colors.stroke}">
        ${leader.name} ${isPlayer ? '(You)' : ''}
      </span>
      <span class="comparison-analysis__value">${showExact ? Math.round(value) : valueToBand(value)}</span>
    `;

    list.appendChild(item);
  }

  analysis.appendChild(list);

  // Player position summary
  const playerFaction = factions.find(f => f.id === options.playerFactionId);
  if (playerFaction) {
    const summary = div({ className: 'comparison-analysis__summary' });

    // Calculate player rank in capability
    const capRank = factions.filter(f => f.capabilityScore > playerFaction.capabilityScore).length + 1;
    const safeRank = factions.filter(f => f.safetyScore > playerFaction.safetyScore).length + 1;

    summary.innerHTML = `
      <div class="comparison-analysis__summary-title">Your Position</div>
      <div class="comparison-analysis__summary-text">
        Ranked #${capRank} in capability and #${safeRank} in safety among ${factions.length} factions.
        ${capRank === 1 ? 'Leading the race!' : capRank === factions.length ? 'Falling behind - consider prioritizing capability research.' : 'Competitive position - maintain pressure.'}
      </div>
    `;

    analysis.appendChild(summary);
  }

  return analysis;
}

/**
 * Render the faction comparison modal
 */
export function renderFactionComparison(
  factions: FactionState[],
  options: ComparisonOptions,
  callbacks: ComparisonCallbacks
): HTMLElement {
  const overlay = div({ className: 'comparison-overlay' });
  const modal = div({ className: 'comparison-modal' });

  // Header
  const headerEl = div({ className: 'comparison-header' });
  headerEl.innerHTML = `
    <div class="comparison-header__classification">COMPARATIVE INTELLIGENCE</div>
    <h2 class="comparison-header__title">Faction Comparison</h2>
    <button class="comparison-header__close">&times;</button>
  `;
  modal.appendChild(headerEl);

  const closeBtn = headerEl.querySelector('.comparison-header__close') as HTMLButtonElement;
  closeBtn.onclick = callbacks.onClose;

  // Content
  const content = div({ className: 'comparison-content' });

  // Legend
  const legend = createComparisonLegend(factions, options, callbacks.onRemoveFaction);
  content.appendChild(legend);

  // Two-column layout
  const columns = div({ className: 'comparison-columns' });

  // Left column - Radar chart
  const leftCol = div({ className: 'comparison-column comparison-column--left' });

  const radarSection = div({ className: 'comparison-section' });
  const radarHeader = div({ className: 'comparison-section__header' });
  radarHeader.innerHTML = '<span class="comparison-section__title">RESOURCE COMPARISON</span>';
  radarSection.appendChild(radarHeader);

  const radarContainer = div({ className: 'comparison-radar-container' });
  const radarChart = createComparisonRadarChart(factions, options);
  radarContainer.appendChild(radarChart);
  radarSection.appendChild(radarContainer);

  leftCol.appendChild(radarSection);
  columns.appendChild(leftCol);

  // Right column - Stat bars
  const rightCol = div({ className: 'comparison-column comparison-column--right' });

  const statsSection = div({ className: 'comparison-section' });
  const statsHeader = div({ className: 'comparison-section__header' });
  statsHeader.innerHTML = '<span class="comparison-section__title">STAT BREAKDOWN</span>';
  statsSection.appendChild(statsHeader);

  const statsGrid = div({ className: 'comparison-stats-grid' });

  // Only show key stats
  const keyStats = COMPARISON_STATS.filter(s =>
    ['capabilityScore', 'safetyScore', 'compute', 'trust', 'influence'].includes(s.key)
  );

  for (const stat of keyStats) {
    const statComparison = createStatComparison(stat, factions, options);
    statsGrid.appendChild(statComparison);
  }

  statsSection.appendChild(statsGrid);
  rightCol.appendChild(statsSection);
  columns.appendChild(rightCol);

  content.appendChild(columns);

  // Analysis section
  const analysisSection = createComparisonAnalysis(factions, options);
  content.appendChild(analysisSection);

  modal.appendChild(content);

  // Footer
  const footer = div({ className: 'comparison-footer' });
  const closeFooterBtn = button({ className: 'comparison-footer__btn' });
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
 * Show faction comparison modal
 */
export function showFactionComparison(
  factions: FactionState[],
  options: ComparisonOptions,
  callbacks: ComparisonCallbacks
): () => void {
  const modal = renderFactionComparison(factions, options, callbacks);
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    modal.classList.add('comparison-overlay--visible');
  });

  return () => {
    modal.classList.remove('comparison-overlay--visible');
    setTimeout(() => {
      modal.remove();
    }, 200);
  };
}
