// RadarChart component for faction resource visualization
// Uses 6 axes: compute, talent, capital, data, influence, trust

import {
  createSvgContainer,
  createRadarChart,
  type RadarAxis,
} from '../utils/svg.js';
import type { Resources, ResourceKey } from '../../core/types.js';

export interface RadarChartOptions {
  size?: number;
  fillColor?: string;
  strokeColor?: string;
  gridColor?: string;
  showLabels?: boolean;
}

// Resource display configuration
const RESOURCE_CONFIG: { key: ResourceKey; label: string; max: number }[] = [
  { key: 'compute', label: 'Compute', max: 100 },
  { key: 'talent', label: 'Talent', max: 100 },
  { key: 'capital', label: 'Capital', max: 100 },
  { key: 'data', label: 'Data', max: 100 },
  { key: 'influence', label: 'Influence', max: 100 },
  { key: 'trust', label: 'Trust', max: 100 },
];

// Color schemes for different faction types
export const RADAR_COLORS = {
  lab: {
    fill: 'rgba(226, 109, 90, 0.25)',
    stroke: 'rgba(226, 109, 90, 0.8)',
  },
  government: {
    fill: 'rgba(199, 154, 245, 0.25)',
    stroke: 'rgba(199, 154, 245, 0.8)',
  },
  player: {
    fill: 'rgba(138, 192, 108, 0.3)',
    stroke: 'rgba(138, 192, 108, 0.9)',
  },
  fogOfWar: {
    fill: 'rgba(159, 178, 165, 0.15)',
    stroke: 'rgba(159, 178, 165, 0.5)',
  },
};

/**
 * Convert fog-of-war band (Low/Med/High) to approximate value
 */
function bandToValue(band: 'Low' | 'Med' | 'High'): number {
  switch (band) {
    case 'Low':
      return 25;
    case 'Med':
      return 55;
    case 'High':
      return 85;
  }
}

/**
 * Convert actual value to fog-of-war band
 */
export function valueToBand(value: number): 'Low' | 'Med' | 'High' {
  if (value < 35) return 'Low';
  if (value < 70) return 'Med';
  return 'High';
}

/**
 * Create radar chart axes from resources
 */
export function createResourceAxes(
  resources: Resources,
  isFogOfWar: boolean = false
): RadarAxis[] {
  return RESOURCE_CONFIG.map(({ key, label, max }) => {
    const actualValue = resources[key];
    const value = isFogOfWar ? bandToValue(valueToBand(actualValue)) : actualValue;
    return {
      label,
      value,
      max,
    };
  });
}

/**
 * Render a mini radar chart for faction resources
 */
export function renderMiniRadarChart(
  resources: Resources,
  options: RadarChartOptions = {}
): SVGSVGElement {
  const {
    size = 80,
    fillColor = RADAR_COLORS.player.fill,
    strokeColor = RADAR_COLORS.player.stroke,
    gridColor = 'rgba(255, 255, 255, 0.08)',
    showLabels = false,
  } = options;

  const axes = createResourceAxes(resources, false);
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - 8; // Leave padding for visual breathing room

  const svg = createSvgContainer(size, size);
  svg.classList.add('radar-chart-mini');

  const chartGroup = createRadarChart(axes, cx, cy, radius, {
    fillColor,
    strokeColor,
    gridColor,
    gridLevels: 2, // Fewer grid lines for mini version
  });

  svg.appendChild(chartGroup);

  // Optionally add axis labels for larger versions
  if (showLabels && size >= 120) {
    const angleStep = (2 * Math.PI) / axes.length;
    const startAngle = -Math.PI / 2;
    const labelRadius = radius + 12;

    axes.forEach((axis, i) => {
      const angle = startAngle + i * angleStep;
      const x = cx + labelRadius * Math.cos(angle);
      const y = cy + labelRadius * Math.sin(angle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'radar-label');
      text.setAttribute('fill', 'var(--muted)');
      text.setAttribute('font-size', '8');
      text.textContent = axis.label.substring(0, 3).toUpperCase();
      svg.appendChild(text);
    });
  }

  return svg;
}

/**
 * Render a fog-of-war radar chart (shows approximate bands, not exact values)
 */
export function renderFogOfWarRadarChart(
  resources: Resources,
  options: Omit<RadarChartOptions, 'fillColor' | 'strokeColor'> = {}
): SVGSVGElement {
  const {
    size = 80,
    gridColor = 'rgba(255, 255, 255, 0.06)',
    showLabels = false,
  } = options;

  const axes = createResourceAxes(resources, true);
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) - 8;

  const svg = createSvgContainer(size, size);
  svg.classList.add('radar-chart-mini', 'radar-chart-mini--fog');

  const chartGroup = createRadarChart(axes, cx, cy, radius, {
    fillColor: RADAR_COLORS.fogOfWar.fill,
    strokeColor: RADAR_COLORS.fogOfWar.stroke,
    gridColor,
    gridLevels: 2,
  });

  svg.appendChild(chartGroup);

  // Add optional labels
  if (showLabels && size >= 120) {
    const angleStep = (2 * Math.PI) / axes.length;
    const startAngle = -Math.PI / 2;
    const labelRadius = radius + 12;

    axes.forEach((axis, i) => {
      const angle = startAngle + i * angleStep;
      const x = cx + labelRadius * Math.cos(angle);
      const y = cy + labelRadius * Math.sin(angle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(x));
      text.setAttribute('y', String(y));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'radar-label');
      text.setAttribute('fill', 'var(--muted)');
      text.setAttribute('font-size', '8');
      text.textContent = axis.label.substring(0, 3).toUpperCase();
      svg.appendChild(text);
    });
  }

  return svg;
}

/**
 * Get fog-of-war resource bands for display
 */
export function getResourceBands(resources: Resources): Record<ResourceKey, 'Low' | 'Med' | 'High'> {
  return {
    compute: valueToBand(resources.compute),
    talent: valueToBand(resources.talent),
    capital: valueToBand(resources.capital),
    data: valueToBand(resources.data),
    influence: valueToBand(resources.influence),
    trust: valueToBand(resources.trust),
  };
}
