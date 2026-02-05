// SVG helper utilities for charts and connectors

export const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Point {
  x: number;
  y: number;
}

export function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

export function createSvgContainer(
  width: number,
  height: number,
  viewBox?: string
): SVGSVGElement {
  return createSvgElement('svg', {
    width,
    height,
    viewBox: viewBox ?? `0 0 ${width} ${height}`,
  });
}

// Bezier curve between two points with horizontal flow
export function bezierPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const cp1x = from.x + dx * 0.5;
  const cp2x = to.x - dx * 0.5;
  return `M ${from.x} ${from.y} C ${cp1x} ${from.y}, ${cp2x} ${to.y}, ${to.x} ${to.y}`;
}

// Create a path element for a connector line
export function createConnectorPath(
  from: Point,
  to: Point,
  className = 'tech-connector'
): SVGPathElement {
  const path = createSvgElement('path', {
    d: bezierPath(from, to),
    class: className,
    fill: 'none',
  });
  return path;
}

// Radar chart utilities
export interface RadarAxis {
  label: string;
  value: number;
  max: number;
}

export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleRad: number
): Point {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

export function createRadarChart(
  axes: RadarAxis[],
  cx: number,
  cy: number,
  radius: number,
  options: {
    fillColor?: string;
    strokeColor?: string;
    gridColor?: string;
    gridLevels?: number;
  } = {}
): SVGGElement {
  const {
    fillColor = 'rgba(138, 192, 108, 0.3)',
    strokeColor = 'rgba(138, 192, 108, 0.8)',
    gridColor = 'rgba(255, 255, 255, 0.1)',
    gridLevels = 3,
  } = options;

  const g = createSvgElement('g', { class: 'radar-chart' });
  const n = axes.length;
  const angleStep = (2 * Math.PI) / n;
  const startAngle = -Math.PI / 2; // Start from top

  // Draw grid circles
  for (let level = 1; level <= gridLevels; level++) {
    const r = (radius * level) / gridLevels;
    const circle = createSvgElement('circle', {
      cx,
      cy,
      r,
      fill: 'none',
      stroke: gridColor,
      'stroke-width': 1,
    });
    g.appendChild(circle);
  }

  // Draw axes
  for (let i = 0; i < n; i++) {
    const angle = startAngle + i * angleStep;
    const end = polarToCartesian(cx, cy, radius, angle);
    const line = createSvgElement('line', {
      x1: cx,
      y1: cy,
      x2: end.x,
      y2: end.y,
      stroke: gridColor,
      'stroke-width': 1,
    });
    g.appendChild(line);
  }

  // Draw data polygon
  const points: Point[] = axes.map((axis, i) => {
    const angle = startAngle + i * angleStep;
    const normalizedValue = Math.min(1, Math.max(0, axis.value / axis.max));
    const r = radius * normalizedValue;
    return polarToCartesian(cx, cy, r, angle);
  });

  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(' ');
  const polygon = createSvgElement('polygon', {
    points: pointsStr,
    fill: fillColor,
    stroke: strokeColor,
    'stroke-width': 2,
  });
  g.appendChild(polygon);

  // Draw data points
  for (const point of points) {
    const dot = createSvgElement('circle', {
      cx: point.x,
      cy: point.y,
      r: 3,
      fill: strokeColor,
    });
    g.appendChild(dot);
  }

  return g;
}

// Semi-circular gauge for safety meter
export function createGauge(
  value: number,
  max: number,
  threshold: number,
  width: number,
  height: number,
  options: {
    safeColor?: string;
    dangerColor?: string;
    bgColor?: string;
    thresholdColor?: string;
  } = {}
): SVGSVGElement {
  const {
    safeColor = '#8ac06c',
    dangerColor = '#e26d5a',
    bgColor = 'rgba(255, 255, 255, 0.1)',
    thresholdColor = '#f6c06a',
  } = options;

  const svg = createSvgContainer(width, height);
  const cx = width / 2;
  const cy = height - 10;
  const radius = Math.min(width / 2, height) - 20;
  const strokeWidth = 12;

  // Background arc
  const bgArc = describeArc(cx, cy, radius, 180, 360);
  const bgPath = createSvgElement('path', {
    d: bgArc,
    fill: 'none',
    stroke: bgColor,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
  });
  svg.appendChild(bgPath);

  // Value arc
  const normalizedValue = Math.min(1, Math.max(0, value / max));
  const endAngle = 180 + normalizedValue * 180;
  const isSafe = value >= threshold;
  const valueArc = describeArc(cx, cy, radius, 180, endAngle);
  const valuePath = createSvgElement('path', {
    d: valueArc,
    fill: 'none',
    stroke: isSafe ? safeColor : dangerColor,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    class: isSafe ? '' : 'gauge-danger',
  });
  svg.appendChild(valuePath);

  // Threshold marker
  const thresholdNormalized = Math.min(1, Math.max(0, threshold / max));
  const thresholdAngle = 180 + thresholdNormalized * 180;
  const thresholdRad = (thresholdAngle * Math.PI) / 180;
  const thresholdPoint = polarToCartesian(cx, cy, radius, thresholdRad);
  const marker = createSvgElement('circle', {
    cx: thresholdPoint.x,
    cy: thresholdPoint.y,
    r: 4,
    fill: thresholdColor,
    class: 'gauge-threshold',
  });
  svg.appendChild(marker);

  // Value text
  const text = createSvgElement('text', {
    x: cx,
    y: cy - radius / 3,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    class: 'gauge-value',
    fill: isSafe ? safeColor : dangerColor,
  });
  text.textContent = Math.round(value).toString();
  svg.appendChild(text);

  return svg;
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const start = polarToCartesian(cx, cy, radius, startRad);
  const end = polarToCartesian(cx, cy, radius, endRad);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

// Risk indicator dots
export function createRiskDots(
  exposure: number,
  maxExposure: number = 3
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'risk-dots';

  for (let i = 0; i < maxExposure; i++) {
    const dot = document.createElement('span');
    dot.className = `risk-dot ${i < exposure ? 'risk-dot--filled' : 'risk-dot--empty'}`;
    container.appendChild(dot);
  }

  return container;
}
