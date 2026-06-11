import type { GameState, FactionState } from '../../core/types.js';
import type { NegotiationExchange } from '../../ai/negotiation.js';

/**
 * WorldMap — the game's central screen.
 *
 * Stylized equirectangular SVG world map in the intelligence-briefing
 * aesthetic. Shows faction HQ markers, tension and alliance arcs, and
 * animated diplomatic comms lines from the latest negotiation round.
 * Clicking a marker opens a dossier with stats and target actions.
 */

export type MapTargetAction = {
  id: string;
  name: string;
};

export type WorldMapProps = {
  state: GameState;
  playerFactionId: string;
  selectedFactionId: string | null;
  negotiations: NegotiationExchange[];
  /** Targeted actions the player may aim at another faction */
  targetActions: MapTargetAction[];
  campaignStarted: boolean;
};

export type WorldMapCallbacks = {
  onSelectFaction: (factionId: string | null) => void;
  onTargetAction: (actionId: string, targetFactionId: string) => void;
  onOpenChat?: (factionId: string) => void;
};

const MAP_W = 1000;
const MAP_H = 500;

// Equirectangular projection
const project = (lon: number, lat: number): { x: number; y: number } => ({
  x: ((lon + 180) / 360) * MAP_W,
  y: ((90 - lat) / 180) * MAP_H,
});

// HQ geo positions per faction
const FACTION_GEO: Record<string, { lon: number; lat: number; align: 'left' | 'right' }> = {
  us_lab_a: { lon: -122.4, lat: 37.8, align: 'right' },   // OpenBrain — San Francisco
  us_lab_b: { lon: -97.7, lat: 30.3, align: 'right' },    // Nexus Labs — Austin
  us_gov: { lon: -77.0, lat: 38.9, align: 'left' },       // US Executive — Washington DC
  cn_lab: { lon: 120.2, lat: 30.3, align: 'left' },       // DeepCent — Hangzhou
  cn_gov: { lon: 116.4, lat: 39.9, align: 'right' },      // PRC Executive — Beijing
};

export const FACTION_MAP_COLORS: Record<string, string> = {
  us_lab_a: '#1a4a8b',
  us_lab_b: '#6b3fa0',
  cn_lab: '#8b2020',
  us_gov: '#1a3a2a',
  cn_gov: '#8f4f1f',
};

// Low-poly continent outlines (lon,lat), stylized — not cartographically exact.
const CONTINENTS: Array<Array<[number, number]>> = [
  // North America
  [[-168, 66], [-150, 70], [-128, 70], [-110, 72], [-95, 73], [-82, 73], [-70, 62], [-55, 52], [-65, 45], [-70, 43], [-75, 40], [-76, 35], [-81, 31], [-80, 25], [-90, 29], [-97, 26], [-100, 19], [-94, 16], [-105, 20], [-110, 23], [-117, 33], [-125, 40], [-124, 48], [-132, 55], [-152, 60], [-166, 60]],
  // Greenland
  [[-45, 60], [-53, 66], [-56, 71], [-50, 76], [-38, 78], [-25, 73], [-20, 70], [-32, 65], [-42, 60]],
  // South America
  [[-80, 9], [-75, 11], [-61, 10], [-52, 5], [-35, -7], [-39, -15], [-48, -26], [-53, -34], [-58, -39], [-65, -41], [-66, -48], [-69, -53], [-74, -46], [-73, -37], [-70, -18], [-77, -6], [-80, 0]],
  // Eurasia
  [[-10, 36], [-9, 44], [0, 47], [5, 58], [10, 65], [20, 70], [40, 68], [60, 70], [75, 73], [100, 77], [130, 72], [160, 70], [179, 67], [178, 63], [160, 60], [156, 53], [142, 47], [135, 43], [127, 40], [122, 37], [121, 31], [115, 22], [108, 12], [105, 9], [100, 8], [98, 13], [94, 17], [88, 22], [80, 15], [77, 8], [73, 20], [68, 24], [60, 25], [57, 27], [50, 30], [48, 30], [44, 38], [36, 36], [27, 37], [23, 36], [15, 38], [10, 38], [5, 36], [-6, 36]],
  // Africa
  [[-17, 15], [-16, 22], [-10, 30], [-6, 35], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 12], [48, 5], [40, -3], [36, -18], [33, -26], [27, -34], [20, -35], [15, -28], [12, -18], [9, -1], [8, 4], [-8, 5], [-13, 9]],
  // Australia
  [[114, -22], [122, -18], [132, -12], [137, -15], [141, -13], [146, -19], [150, -23], [153, -28], [150, -37], [144, -38], [140, -36], [134, -33], [129, -32], [124, -33], [115, -34], [113, -26]],
  // Japan (simplified)
  [[130, 31], [132, 34], [137, 35], [140, 36], [141, 40], [143, 43], [141, 45], [139, 42], [135, 35], [131, 31]],
  // British Isles (simplified)
  [[-5, 50], [-2, 53], [-4, 58], [-7, 57], [-6, 53], [-6, 50]],
];

// Pan/zoom state survives re-renders (module scope; re-render replaces the DOM)
let viewState = { x: 0, y: 0, w: MAP_W, h: MAP_H };

export const resetWorldMapView = (): void => {
  viewState = { x: 0, y: 0, w: MAP_W, h: MAP_H };
};

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
};

const continentPath = (points: Array<[number, number]>): string => {
  const parts = points.map(([lon, lat], index) => {
    const { x, y } = project(lon, lat);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `${parts.join(' ')} Z`;
};

/** Curved arc between two factions, bowing away from the equator midline. */
const arcPath = (fromId: string, toId: string, bow = 0.22): string | null => {
  const a = FACTION_GEO[fromId];
  const b = FACTION_GEO[toId];
  if (!a || !b) return null;
  const p1 = project(a.lon, a.lat);
  const p2 = project(b.lon, b.lat);
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular offset, always bowing upward (toward the pole) for readability
  const cx = mx - (dy / (dist || 1)) * dist * bow;
  const cy = my + (dx / (dist || 1)) * dist * bow - dist * 0.08;
  return `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
};

const tensionKeyFor = (a: string, b: string): string => [a, b].sort().join(':');

const INTENT_LABELS: Record<string, string> = {
  propose_alliance: 'Alliance proposal',
  coordinate_safety: 'Safety coordination',
  offer_cooperation: 'Cooperation offer',
  warn: 'Warning',
  demand: 'Demand',
  probe: 'Probe',
};

const buildGraticule = (group: SVGGElement): void => {
  for (let lon = -150; lon <= 180; lon += 30) {
    const { x } = project(lon, 0);
    group.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: MAP_H, class: 'world-map__graticule' }));
  }
  for (let lat = -60; lat <= 80; lat += 30) {
    const { y } = project(0, lat);
    group.appendChild(svgEl('line', { x1: 0, y1: y, x2: MAP_W, y2: y, class: 'world-map__graticule' }));
  }
};

const buildRelationArcs = (group: SVGGElement, state: GameState): void => {
  // Tension arcs (red, weight by tension)
  const drawn = new Set<string>();
  for (const [key, tension] of state.tensions.entries()) {
    if (tension < 12 || drawn.has(key)) continue;
    drawn.add(key);
    const [a, b] = key.split(':');
    const d = arcPath(a, b, 0.18);
    if (!d) continue;
    const path = svgEl('path', {
      d,
      class: 'world-map__arc world-map__arc--tension',
      'stroke-width': (1 + tension / 28).toFixed(2),
      opacity: Math.min(0.85, 0.25 + tension / 100).toFixed(2),
    });
    path.appendChild(svgElTitle(`Tension ${Math.round(tension)} / 100`));
    group.appendChild(path);
  }

  // Alliance lines (green)
  const allianceDrawn = new Set<string>();
  for (const [factionId, allies] of state.alliances.entries()) {
    for (const allyId of allies) {
      const key = tensionKeyFor(factionId, allyId);
      if (allianceDrawn.has(key)) continue;
      allianceDrawn.add(key);
      const d = arcPath(factionId, allyId, 0.12);
      if (!d) continue;
      const path = svgEl('path', { d, class: 'world-map__arc world-map__arc--alliance' });
      path.appendChild(svgElTitle('Alliance'));
      group.appendChild(path);
    }
  }
};

const svgElTitle = (text: string): SVGTitleElement => {
  const title = svgEl('title');
  title.textContent = text;
  return title;
};

const buildNegotiationArcs = (group: SVGGElement, negotiations: NegotiationExchange[]): void => {
  for (const exchange of negotiations) {
    const d = arcPath(exchange.fromFactionId, exchange.toFactionId, 0.3);
    if (!d) continue;
    const path = svgEl('path', {
      d,
      class: 'world-map__arc world-map__arc--comms',
      'data-intent': exchange.intent,
    });
    path.appendChild(svgElTitle(`${INTENT_LABELS[exchange.intent] ?? exchange.intent}: ${exchange.message}`));
    group.appendChild(path);
  }
};

const buildMarker = (
  group: SVGGElement,
  faction: FactionState,
  props: WorldMapProps,
  callbacks: WorldMapCallbacks,
): void => {
  const geo = FACTION_GEO[faction.id];
  if (!geo) return;
  const { x, y } = project(geo.lon, geo.lat);
  const color = FACTION_MAP_COLORS[faction.id] ?? '#1a1a1a';
  const isPlayer = faction.id === props.playerFactionId;
  const isSelected = faction.id === props.selectedFactionId;

  const marker = svgEl('g', {
    class: [
      'world-map__marker',
      isPlayer ? 'world-map__marker--player' : '',
      isSelected ? 'world-map__marker--selected' : '',
    ].filter(Boolean).join(' '),
    'data-faction-id': faction.id,
    transform: `translate(${x.toFixed(1)},${y.toFixed(1)})`,
  });

  // Invisible hit area so clicks near the marker register
  marker.appendChild(svgEl('circle', { r: 18, class: 'world-map__marker-hit' }));

  // Capability ring (progress toward 100)
  const ringRadius = 13;
  const circumference = 2 * Math.PI * ringRadius;
  const capabilityShare = Math.max(0, Math.min(1, faction.capabilityScore / 100));
  marker.appendChild(svgEl('circle', {
    r: ringRadius,
    class: 'world-map__marker-ring-bg',
  }));
  const ring = svgEl('circle', {
    r: ringRadius,
    class: 'world-map__marker-ring',
    stroke: color,
    'stroke-dasharray': `${(circumference * capabilityShare).toFixed(1)} ${circumference.toFixed(1)}`,
    transform: 'rotate(-90)',
  });
  ring.appendChild(svgElTitle(`Capability ${Math.round(faction.capabilityScore)}`));
  marker.appendChild(ring);

  // Core glyph: circle for labs, diamond for governments
  if (faction.type === 'lab') {
    marker.appendChild(svgEl('circle', { r: 7, fill: color, class: 'world-map__marker-core' }));
  } else {
    marker.appendChild(svgEl('rect', {
      x: -6.5, y: -6.5, width: 13, height: 13,
      fill: color,
      transform: 'rotate(45)',
      class: 'world-map__marker-core',
    }));
  }

  if (isSelected) {
    marker.appendChild(svgEl('circle', { r: 19, class: 'world-map__marker-pulse', stroke: color }));
  }

  // Label
  const labelOffset = geo.align === 'right' ? -22 : 22;
  const label = svgEl('text', {
    x: labelOffset,
    y: 4,
    class: 'world-map__marker-label',
    'text-anchor': geo.align === 'right' ? 'end' : 'start',
  });
  label.textContent = faction.name + (isPlayer ? ' (you)' : '');
  marker.appendChild(label);

  marker.addEventListener('click', (event) => {
    event.stopPropagation();
    callbacks.onSelectFaction(isSelected ? null : faction.id);
  });

  group.appendChild(marker);
};

const statRow = (label: string, value: string): HTMLElement => {
  const row = document.createElement('div');
  row.className = 'world-map__dossier-stat';
  const labelEl = document.createElement('span');
  labelEl.className = 'world-map__dossier-stat-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'world-map__dossier-stat-value';
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
};

const buildDossier = (
  props: WorldMapProps,
  callbacks: WorldMapCallbacks,
): HTMLElement | null => {
  const factionId = props.selectedFactionId;
  if (!factionId) return null;
  const faction = props.state.factions[factionId];
  if (!faction) return null;

  const isPlayer = factionId === props.playerFactionId;
  const dossier = document.createElement('aside');
  dossier.className = 'world-map__dossier';
  dossier.dataset.factionId = factionId;

  const header = document.createElement('div');
  header.className = 'world-map__dossier-header';
  const swatch = document.createElement('span');
  swatch.className = 'world-map__dossier-swatch';
  swatch.style.background = FACTION_MAP_COLORS[factionId] ?? '#1a1a1a';
  const title = document.createElement('div');
  title.className = 'world-map__dossier-title';
  title.textContent = faction.name;
  const subtitle = document.createElement('div');
  subtitle.className = 'world-map__dossier-subtitle';
  subtitle.textContent = faction.type === 'lab' ? 'AI Laboratory' : 'Government';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'world-map__dossier-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => callbacks.onSelectFaction(null));
  const titleWrap = document.createElement('div');
  titleWrap.append(title, subtitle);
  header.append(swatch, titleWrap, closeBtn);
  dossier.appendChild(header);

  const stats = document.createElement('div');
  stats.className = 'world-map__dossier-stats';
  const exact = isPlayer;
  const fmt = (value: number): string => (exact ? String(Math.round(value)) : bandFor(value));
  stats.append(
    statRow('Capability', fmt(faction.capabilityScore)),
    statRow('Safety', fmt(faction.safetyScore)),
    statRow('Trust', fmt(faction.resources.trust)),
    statRow('Compute', fmt(faction.resources.compute)),
    statRow('Influence', fmt(faction.resources.influence)),
  );
  if (!isPlayer) {
    const tension = props.state.tensions.get(tensionKeyFor(factionId, props.playerFactionId)) ?? 0;
    stats.append(statRow('Tension with you', String(Math.round(tension))));
  }
  dossier.appendChild(stats);

  if (!isPlayer && props.campaignStarted) {
    const actions = document.createElement('div');
    actions.className = 'world-map__dossier-actions';
    const actionsTitle = document.createElement('div');
    actionsTitle.className = 'world-map__dossier-actions-title';
    actionsTitle.textContent = 'Target with action';
    actions.appendChild(actionsTitle);
    for (const action of props.targetActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'world-map__dossier-action-btn';
      btn.dataset.actionId = action.id;
      btn.textContent = action.name;
      btn.addEventListener('click', () => callbacks.onTargetAction(action.id, factionId));
      actions.appendChild(btn);
    }
    if (callbacks.onOpenChat) {
      const chatBtn = document.createElement('button');
      chatBtn.type = 'button';
      chatBtn.className = 'world-map__dossier-action-btn world-map__dossier-action-btn--chat';
      chatBtn.textContent = 'Open channel';
      chatBtn.addEventListener('click', () => callbacks.onOpenChat?.(factionId));
      actions.appendChild(chatBtn);
    }
    dossier.appendChild(actions);
  }

  return dossier;
};

const bandFor = (value: number): string => {
  if (value >= 80) return 'Very High';
  if (value >= 60) return 'High';
  if (value >= 40) return 'Moderate';
  if (value >= 20) return 'Low';
  return 'Very Low';
};

const buildFeed = (props: WorldMapProps): HTMLElement => {
  const feed = document.createElement('div');
  feed.className = 'world-map__feed';
  const title = document.createElement('div');
  title.className = 'world-map__feed-title';
  title.textContent = 'Diplomatic traffic';
  feed.appendChild(title);

  if (!props.negotiations.length) {
    const empty = document.createElement('div');
    empty.className = 'world-map__feed-empty';
    empty.textContent = props.campaignStarted
      ? 'No intercepts this quarter. Advance the turn to open the diplomatic phase.'
      : 'Start the campaign to see factions negotiate.';
    feed.appendChild(empty);
    return feed;
  }

  for (const exchange of props.negotiations.slice(0, 8)) {
    const item = document.createElement('div');
    item.className = 'world-map__feed-item';
    const from = props.state.factions[exchange.fromFactionId]?.name ?? exchange.fromFactionId;
    const to = props.state.factions[exchange.toFactionId]?.name ?? exchange.toFactionId;
    const meta = document.createElement('div');
    meta.className = 'world-map__feed-meta';
    meta.textContent = `${from} → ${to} · ${INTENT_LABELS[exchange.intent] ?? exchange.intent}`;
    const body = document.createElement('div');
    body.className = 'world-map__feed-message';
    body.textContent = exchange.message;
    item.append(meta, body);
    feed.appendChild(item);
  }
  return feed;
};

const attachPanZoom = (svg: SVGSVGElement, didDrag: { value: boolean }): void => {
  const applyViewBox = (): void => {
    svg.setAttribute('viewBox', `${viewState.x} ${viewState.y} ${viewState.w} ${viewState.h}`);
  };
  applyViewBox();

  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    const scale = event.deltaY > 0 ? 1.12 : 1 / 1.12;
    const newW = Math.min(MAP_W, Math.max(180, viewState.w * scale));
    const newH = newW * (MAP_H / MAP_W);
    const rect = svg.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    viewState.x = Math.min(MAP_W - newW, Math.max(0, viewState.x + (viewState.w - newW) * px));
    viewState.y = Math.min(MAP_H - newH, Math.max(0, viewState.y + (viewState.h - newH) * py));
    viewState.w = newW;
    viewState.h = newH;
    applyViewBox();
  }, { passive: false });

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  svg.addEventListener('pointerdown', (event) => {
    // Don't start a pan from a marker: pointer capture would retarget the
    // click to the svg and swallow the marker selection.
    if ((event.target as Element).closest?.('.world-map__marker')) return;
    dragging = true;
    didDrag.value = false;
    lastX = event.clientX;
    lastY = event.clientY;
    svg.setPointerCapture(event.pointerId);
  });
  svg.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    if (Math.abs(event.clientX - lastX) + Math.abs(event.clientY - lastY) > 2) {
      didDrag.value = true;
    }
    const rect = svg.getBoundingClientRect();
    const dx = ((event.clientX - lastX) / rect.width) * viewState.w;
    const dy = ((event.clientY - lastY) / rect.height) * viewState.h;
    viewState.x = Math.min(MAP_W - viewState.w, Math.max(0, viewState.x - dx));
    viewState.y = Math.min(MAP_H - viewState.h, Math.max(0, viewState.y - dy));
    lastX = event.clientX;
    lastY = event.clientY;
    applyViewBox();
  });
  const endDrag = (): void => { dragging = false; };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
};

export const renderWorldMap = (
  props: WorldMapProps,
  callbacks: WorldMapCallbacks,
): HTMLElement => {
  const container = document.createElement('div');
  container.className = 'world-map';

  const svg = svgEl('svg', {
    class: 'world-map__svg',
    viewBox: `0 0 ${MAP_W} ${MAP_H}`,
    preserveAspectRatio: 'xMidYMid meet',
  }) as SVGSVGElement;

  // Ocean backdrop
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: MAP_W, height: MAP_H, class: 'world-map__ocean' }));

  const graticuleGroup = svgEl('g');
  buildGraticule(graticuleGroup);
  svg.appendChild(graticuleGroup);

  const landGroup = svgEl('g');
  for (const continent of CONTINENTS) {
    landGroup.appendChild(svgEl('path', { d: continentPath(continent), class: 'world-map__land' }));
  }
  svg.appendChild(landGroup);

  const arcsGroup = svgEl('g');
  buildRelationArcs(arcsGroup, props.state);
  buildNegotiationArcs(arcsGroup, props.negotiations);
  svg.appendChild(arcsGroup);

  const markersGroup = svgEl('g');
  for (const faction of Object.values(props.state.factions)) {
    buildMarker(markersGroup, faction, props, callbacks);
  }
  svg.appendChild(markersGroup);

  const didDrag = { value: false };
  svg.addEventListener('click', () => {
    if (didDrag.value) {
      didDrag.value = false;
      return;
    }
    callbacks.onSelectFaction(null);
  });
  attachPanZoom(svg, didDrag);
  container.appendChild(svg);

  // Legend
  const legend = document.createElement('div');
  legend.className = 'world-map__legend';
  legend.innerHTML = [
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--tension"></span>Tension</span>',
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--alliance"></span>Alliance</span>',
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--comms"></span>Diplomatic traffic</span>',
  ].join('');
  container.appendChild(legend);

  const dossier = buildDossier(props, callbacks);
  if (dossier) container.appendChild(dossier);

  container.appendChild(buildFeed(props));

  return container;
};
