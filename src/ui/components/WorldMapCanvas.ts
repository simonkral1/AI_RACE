import type { GameState, FactionState } from '../../core/types.js';
import type { NegotiationExchange } from '../../ai/negotiation.js';

/**
 * WorldMapCanvas — cinematic satellite world map (canvas 2D).
 *
 * Renders NASA Blue Marble imagery with night-light city glow, a dark
 * command-room treatment, glowing faction markers, animated tension /
 * alliance / diplomatic arcs, and smooth pan/zoom. DOM overlays provide
 * the dossier, legend, diplomacy feed, and accessible marker hit areas
 * (which also keep test selectors stable).
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
  targetActions: MapTargetAction[];
  campaignStarted: boolean;
};

export type WorldMapCallbacks = {
  onSelectFaction: (factionId: string | null) => void;
  onTargetAction: (actionId: string, targetFactionId: string) => void;
  onOpenChat?: (factionId: string) => void;
};

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

const FACTION_GEO: Record<string, { lon: number; lat: number; align: 'left' | 'right' }> = {
  us_lab_a: { lon: -122.4, lat: 37.8, align: 'right' },   // OpenBrain — San Francisco
  us_lab_b: { lon: -97.7, lat: 30.3, align: 'right' },    // Nexus Labs — Austin
  us_gov: { lon: -77.0, lat: 38.9, align: 'left' },       // US Executive — Washington DC
  cn_lab: { lon: 120.2, lat: 30.3, align: 'left' },       // DeepCent — Hangzhou
  cn_gov: { lon: 116.4, lat: 39.9, align: 'right' },      // PRC Executive — Beijing
};

// Bright palette tuned for the dark satellite backdrop
export const FACTION_MAP_COLORS: Record<string, string> = {
  us_lab_a: '#4da3ff',
  us_lab_b: '#b78aff',
  cn_lab: '#ff6b5e',
  us_gov: '#53e0a6',
  cn_gov: '#ffb84d',
};

const INTENT_LABELS: Record<string, string> = {
  propose_alliance: 'Alliance proposal',
  coordinate_safety: 'Safety coordination',
  offer_cooperation: 'Cooperation offer',
  warn: 'Warning',
  demand: 'Demand',
  probe: 'Probe',
  alliance_formed: '🤝 Alliance formed',
  alliance_declined: 'Alliance declined',
};

// World coordinates: u in [0,1] (lon), v in [0,0.5] (lat, 2:1 equirect)
const WORLD_H = 0.5;

const projectWorld = (lon: number, lat: number): { x: number; y: number } => ({
  x: (lon + 180) / 360,
  y: ((90 - lat) / 180) * WORLD_H,
});

const tensionKeyFor = (a: string, b: string): string => [a, b].sort().join(':');

// ---------------------------------------------------------------------------
// Singleton instance (survives re-renders; main.ts calls mountWorldMap often)
// ---------------------------------------------------------------------------

type View = { cx: number; cy: number; zoom: number };

type Instance = {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  hitLayer: HTMLElement;
  hudLayer: HTMLElement;
  feedEl: HTMLElement;
  statusEl: HTMLElement;
  props: WorldMapProps;
  callbacks: WorldMapCallbacks;
  view: View;
  targetView: View;
  raf: number;
  dayImg: HTMLImageElement;
  nightImg: HTMLImageElement;
  dayReady: boolean;
  nightReady: boolean;
  resizeObserver: ResizeObserver;
  destroyed: boolean;
  lastPropsKey: string;
};

let instance: Instance | null = null;

export const resetWorldMapView = (): void => {
  if (instance) {
    instance.targetView = { ...HOME_VIEW };
  }
};

// Centered between the US west coast and eastern China so all five faction
// HQs are on screen at game start; vertical letterboxing is allowed.
const HOME_VIEW: View = { cx: 0.485, cy: 0.21, zoom: 1.3 };

// ---------------------------------------------------------------------------
// Mount / update
// ---------------------------------------------------------------------------

export const mountWorldMap = (
  container: HTMLElement,
  props: WorldMapProps,
  callbacks: WorldMapCallbacks,
): void => {
  if (instance && !instance.destroyed && container.contains(instance.root)) {
    instance.props = props;
    instance.callbacks = callbacks;
    syncOverlays(instance);
    return;
  }

  if (instance) {
    destroyInstance(instance);
    instance = null;
  }

  const root = document.createElement('div');
  root.className = 'world-map world-map--cinematic';

  const canvas = document.createElement('canvas');
  canvas.className = 'world-map__canvas';
  root.appendChild(canvas);

  const hitLayer = document.createElement('div');
  hitLayer.className = 'world-map__hit-layer';
  root.appendChild(hitLayer);

  const hudLayer = document.createElement('div');
  hudLayer.className = 'world-map__hud-layer';
  root.appendChild(hudLayer);

  const statusEl = document.createElement('div');
  statusEl.className = 'world-map__status';
  root.appendChild(statusEl);

  const feedEl = document.createElement('div');
  feedEl.className = 'world-map__feed world-map__feed--hud';
  root.appendChild(feedEl);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    container.replaceChildren(root);
    return;
  }

  const dayImg = new Image();
  const nightImg = new Image();

  const inst: Instance = {
    root,
    canvas,
    ctx,
    hitLayer,
    hudLayer,
    feedEl,
    statusEl,
    props,
    callbacks,
    view: { ...HOME_VIEW },
    targetView: { ...HOME_VIEW },
    raf: 0,
    dayImg,
    nightImg,
    dayReady: false,
    nightReady: false,
    resizeObserver: new ResizeObserver(() => resizeCanvas(inst)),
    destroyed: false,
    lastPropsKey: '',
  };

  dayImg.onload = () => { inst.dayReady = true; };
  nightImg.onload = () => { inst.nightReady = true; };
  // 8192x4096 textures; fall back to the smaller NASA set if missing
  dayImg.onerror = () => { dayImg.onerror = null; dayImg.src = '/assets/earth-day.jpg'; };
  nightImg.onerror = () => { nightImg.onerror = null; nightImg.src = '/assets/earth-night.jpg'; };
  dayImg.src = '/assets/earth-day-8k.jpg';
  nightImg.src = '/assets/earth-night-8k.jpg';

  attachInteractions(inst);
  inst.resizeObserver.observe(root);

  container.replaceChildren(root);
  resizeCanvas(inst);
  syncOverlays(inst);

  const loop = (): void => {
    if (inst.destroyed) return;
    drawFrame(inst);
    inst.raf = requestAnimationFrame(loop);
  };
  inst.raf = requestAnimationFrame(loop);

  instance = inst;
};

const destroyInstance = (inst: Instance): void => {
  inst.destroyed = true;
  cancelAnimationFrame(inst.raf);
  inst.resizeObserver.disconnect();
  inst.root.remove();
};

const resizeCanvas = (inst: Instance): void => {
  const rect = inst.root.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  inst.canvas.width = Math.round(rect.width * dpr);
  inst.canvas.height = Math.round(rect.height * dpr);
  inst.canvas.style.width = `${rect.width}px`;
  inst.canvas.style.height = `${rect.height}px`;
};

// ---------------------------------------------------------------------------
// View math
// ---------------------------------------------------------------------------

const viewScale = (inst: Instance, width: number): number => width * inst.view.zoom;

const worldToScreen = (inst: Instance, wx: number, wy: number, w: number, h: number): { x: number; y: number } => {
  const s = viewScale(inst, w);
  return {
    x: (wx - inst.view.cx) * s + w / 2,
    y: (wy - inst.view.cy) * s + h / 2,
  };
};

const screenToWorld = (inst: Instance, sx: number, sy: number, w: number, h: number): { x: number; y: number } => {
  const s = viewScale(inst, w);
  return {
    x: (sx - w / 2) / s + inst.view.cx,
    y: (sy - h / 2) / s + inst.view.cy,
  };
};

const clampView = (view: View, w: number, h: number): void => {
  view.zoom = Math.min(14, Math.max(1, view.zoom));
  const s = w * view.zoom;
  const halfW = (w / 2) / s;
  view.cx = Math.min(1 - halfW, Math.max(halfW, view.cx));
  if (s * WORLD_H <= h) {
    // Whole world height fits: letterbox against the space backdrop
    view.cy = WORLD_H / 2;
  } else {
    const halfH = (h / 2) / s;
    view.cy = Math.min(WORLD_H - halfH, Math.max(halfH, view.cy));
  }
};

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

const attachInteractions = (inst: Instance): void => {
  const el = inst.canvas;
  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;

  el.addEventListener('pointerdown', (event) => {
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    el.setPointerCapture(event.pointerId);
  });

  el.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    const s = viewScale(inst, rect.width);
    inst.targetView.cx -= dx / s;
    inst.targetView.cy -= dy / s;
    inst.view.cx -= dx / s;
    inst.view.cy -= dy / s;
    clampView(inst.targetView, rect.width, rect.height);
    clampView(inst.view, rect.width, rect.height);
    lastX = event.clientX;
    lastY = event.clientY;
  });

  const endDrag = (): void => { dragging = false; };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);

  el.addEventListener('click', () => {
    if (moved) { moved = false; return; }
    inst.callbacks.onSelectFaction(null);
  });

  el.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = el.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const before = screenToWorld(inst, mx, my, rect.width, rect.height);
    const factor = event.deltaY > 0 ? 1 / 1.18 : 1.18;
    inst.targetView.zoom *= factor;
    clampView(inst.targetView, rect.width, rect.height);
    // Keep the point under the cursor fixed
    const s = rect.width * inst.targetView.zoom;
    inst.targetView.cx = before.x - (mx - rect.width / 2) / s;
    inst.targetView.cy = before.y - (my - rect.height / 2) / s;
    clampView(inst.targetView, rect.width, rect.height);
  }, { passive: false });
};

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const easeView = (inst: Instance, w: number, h: number): void => {
  const k = 0.18;
  inst.view.cx += (inst.targetView.cx - inst.view.cx) * k;
  inst.view.cy += (inst.targetView.cy - inst.view.cy) * k;
  inst.view.zoom += (inst.targetView.zoom - inst.view.zoom) * k;
  clampView(inst.view, w, h);
};

const arcControlPoint = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  bow: number,
): { x: number; y: number } => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    x: mx - (dy / dist) * dist * bow,
    y: my + (dx / dist) * dist * bow - dist * 0.18,
  };
};

const drawArc = (
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  options: { color: string; width: number; alpha: number; dash?: number[]; dashOffset?: number; glow?: number; bow?: number },
): void => {
  const cp = arcControlPoint(a, b, options.bow ?? 0.22);
  ctx.save();
  ctx.globalAlpha = options.alpha;
  ctx.strokeStyle = options.color;
  ctx.lineWidth = options.width;
  ctx.lineCap = 'round';
  if (options.glow) {
    ctx.shadowColor = options.color;
    ctx.shadowBlur = options.glow;
  }
  if (options.dash) {
    ctx.setLineDash(options.dash);
    ctx.lineDashOffset = options.dashOffset ?? 0;
  }
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y);
  ctx.stroke();
  ctx.restore();
};

const drawFrame = (inst: Instance): void => {
  const { ctx, canvas } = inst;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  if (w < 2 || h < 2) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  easeView(inst, w, h);

  const now = performance.now();
  const s = viewScale(inst, w);
  const origin = worldToScreen(inst, 0, 0, w, h);
  const mapW = s;
  const mapH = s * WORLD_H;

  // Space backdrop
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, w, h);

  // Earth day texture
  if (inst.dayReady) {
    ctx.drawImage(inst.dayImg, origin.x, origin.y, mapW, mapH);
  } else {
    ctx.fillStyle = '#0a1626';
    ctx.fillRect(origin.x, origin.y, mapW, mapH);
  }

  // Night lights — additive city glow
  if (inst.nightReady) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(inst.nightImg, origin.x, origin.y, mapW, mapH);
    ctx.restore();
  }

  // Cinematic dark-blue grade
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = 'rgb(158, 182, 215)';
  ctx.fillRect(origin.x, origin.y, mapW, mapH);
  ctx.restore();
  ctx.fillStyle = 'rgba(4, 10, 22, 0.12)';
  ctx.fillRect(origin.x, origin.y, mapW, mapH);

  // Faint graticule
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 180, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) {
    const p = worldToScreen(inst, (lon + 180) / 360, 0, w, h);
    if (p.x < -2 || p.x > w + 2) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, Math.max(0, origin.y));
    ctx.lineTo(p.x, Math.min(h, origin.y + mapH));
    ctx.stroke();
  }
  for (let lat = -60; lat <= 80; lat += 30) {
    const p = worldToScreen(inst, 0, ((90 - lat) / 180) * WORLD_H, w, h);
    if (p.y < -2 || p.y > h + 2) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, origin.x), p.y);
    ctx.lineTo(Math.min(w, origin.x + mapW), p.y);
    ctx.stroke();
  }
  ctx.restore();

  const { state, negotiations, playerFactionId, selectedFactionId } = inst.props;
  const screenPos = new Map<string, { x: number; y: number }>();
  for (const [id, geo] of Object.entries(FACTION_GEO)) {
    const wp = projectWorld(geo.lon, geo.lat);
    screenPos.set(id, worldToScreen(inst, wp.x, wp.y, w, h));
  }

  // Tension arcs
  for (const [key, tension] of state.tensions.entries()) {
    if (tension < 12) continue;
    const [a, b] = key.split(':');
    const pa = screenPos.get(a);
    const pb = screenPos.get(b);
    if (!pa || !pb) continue;
    drawArc(ctx, pa, pb, {
      color: '#ff4545',
      width: 1 + tension / 30,
      alpha: Math.min(0.8, 0.25 + tension / 110),
      glow: 8,
      bow: 0.16,
    });
  }

  // Alliance arcs
  const allianceDrawn = new Set<string>();
  for (const [factionId, allies] of state.alliances.entries()) {
    for (const allyId of allies) {
      const key = tensionKeyFor(factionId, allyId);
      if (allianceDrawn.has(key)) continue;
      allianceDrawn.add(key);
      const pa = screenPos.get(factionId);
      const pb = screenPos.get(allyId);
      if (!pa || !pb) continue;
      drawArc(ctx, pa, pb, { color: '#39e69a', width: 1.6, alpha: 0.7, glow: 6, bow: 0.1 });
    }
  }

  // Diplomatic comms arcs — animated dashes
  for (const exchange of negotiations) {
    const pa = screenPos.get(exchange.fromFactionId);
    const pb = screenPos.get(exchange.toFactionId);
    if (!pa || !pb) continue;
    drawArc(ctx, pa, pb, {
      color: '#5fd4ff',
      width: 1.4,
      alpha: 0.85,
      dash: [7, 9],
      dashOffset: -(now / 40) % 16,
      glow: 9,
      bow: 0.3,
    });
  }

  // Markers — clamp to visible canvas with margin so labels and glyphs are
  // never clipped under the left panel or outside canvas edges.
  const MARKER_MARGIN = 32; // px clearance from each edge
  for (const faction of Object.values(state.factions)) {
    const rawPos = screenPos.get(faction.id);
    const geo = FACTION_GEO[faction.id];
    if (!rawPos || !geo) continue;
    const clampedPos = {
      x: Math.max(MARKER_MARGIN, Math.min(w - MARKER_MARGIN, rawPos.x)),
      y: Math.max(MARKER_MARGIN, Math.min(h - MARKER_MARGIN, rawPos.y)),
    };
    drawMarker(ctx, faction, clampedPos, geo.align, {
      color: FACTION_MAP_COLORS[faction.id] ?? '#ffffff',
      isPlayer: faction.id === playerFactionId,
      isSelected: faction.id === selectedFactionId,
      time: now,
    });
  }

  // Vignette
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0, 2, 8, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  syncHitAreas(inst, screenPos, w, h);
};

const drawMarker = (
  ctx: CanvasRenderingContext2D,
  faction: FactionState,
  pos: { x: number; y: number },
  align: 'left' | 'right',
  opts: { color: string; isPlayer: boolean; isSelected: boolean; time: number },
): void => {
  const { color, isPlayer, isSelected, time } = opts;
  const pulse = 1 + 0.12 * Math.sin(time / 320);

  // Outer glow
  ctx.save();
  const glow = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 26);
  glow.addColorStop(0, `${color}55`);
  glow.addColorStop(1, `${color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Capability ring
  const ringR = 12;
  const capShare = Math.max(0.02, Math.min(1, faction.capabilityScore / 100));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, ringR, -Math.PI / 2, -Math.PI / 2 + capShare * Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Core glyph: circle = lab, diamond = government
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = isPlayer ? '#ffffff' : 'rgba(255,255,255,0.7)';
  ctx.lineWidth = isPlayer ? 2 : 1.2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  if (faction.type === 'lab') {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 6 * (isSelected ? pulse : 1), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    const r = 7 * (isSelected ? pulse : 1);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - r);
    ctx.lineTo(pos.x + r, pos.y);
    ctx.lineTo(pos.x, pos.y + r);
    ctx.lineTo(pos.x - r, pos.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Selection pulse ring
  if (isSelected) {
    const phase = (time % 1600) / 1600;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7 * (1 - phase);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 14 + phase * 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Label with dark halo
  ctx.save();
  ctx.font = '600 12px "IBM Plex Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = align === 'right' ? 'right' : 'left';
  const lx = align === 'right' ? pos.x - 20 : pos.x + 20;
  const label = faction.name + (isPlayer ? ' ◂ you' : '');
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(2, 8, 16, 0.85)';
  ctx.strokeText(label, lx, pos.y);
  ctx.fillStyle = '#e8f2ff';
  ctx.fillText(label, lx, pos.y);
  ctx.restore();
};

// ---------------------------------------------------------------------------
// DOM overlays: hit areas, dossier, legend, feed
// ---------------------------------------------------------------------------

const syncHitAreas = (
  inst: Instance,
  screenPos: Map<string, { x: number; y: number }>,
  w: number,
  h: number,
): void => {
  for (const [factionId, pos] of screenPos.entries()) {
    let btn = inst.hitLayer.querySelector<HTMLButtonElement>(
      `.world-map__marker[data-faction-id="${factionId}"]`,
    );
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'world-map__marker';
      btn.dataset.factionId = factionId;
      const core = document.createElement('span');
      core.className = 'world-map__marker-core';
      btn.appendChild(core);
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const current = inst.props.selectedFactionId;
        inst.callbacks.onSelectFaction(current === factionId ? null : factionId);
      });
      inst.hitLayer.appendChild(btn);
    }
    const visible = pos.x > -30 && pos.x < w + 30 && pos.y > -30 && pos.y < h + 30;
    const display = visible ? 'block' : 'none';
    if (btn.style.display !== display) btn.style.display = display;
    const transform = `translate(${Math.round(pos.x - 16)}px, ${Math.round(pos.y - 16)}px)`;
    if (btn.dataset.t !== transform) {
      btn.dataset.t = transform;
      btn.style.transform = transform;
    }
    const label = inst.props.state.factions[factionId]?.name ?? factionId;
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
  }
};

const bandFor = (value: number): string => {
  if (value >= 80) return 'Very High';
  if (value >= 60) return 'High';
  if (value >= 40) return 'Moderate';
  if (value >= 20) return 'Low';
  return 'Very Low';
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

const buildDossier = (inst: Instance): HTMLElement | null => {
  const { props, callbacks } = inst;
  const factionId = props.selectedFactionId;
  if (!factionId) return null;
  const faction = props.state.factions[factionId];
  if (!faction) return null;

  const isPlayer = factionId === props.playerFactionId;
  const dossier = document.createElement('aside');
  dossier.className = 'world-map__dossier world-map__dossier--hud';
  dossier.dataset.factionId = factionId;

  const header = document.createElement('div');
  header.className = 'world-map__dossier-header';
  const swatch = document.createElement('span');
  swatch.className = 'world-map__dossier-swatch';
  swatch.style.background = FACTION_MAP_COLORS[factionId] ?? '#fff';
  const titleWrap = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'world-map__dossier-title';
  title.textContent = faction.name;
  const subtitle = document.createElement('div');
  subtitle.className = 'world-map__dossier-subtitle';
  subtitle.textContent = faction.type === 'lab' ? 'AI Laboratory' : 'Government';
  titleWrap.append(title, subtitle);
  const closeBtn = document.createElement('button');
  closeBtn.className = 'world-map__dossier-close';
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => callbacks.onSelectFaction(null));
  header.append(swatch, titleWrap, closeBtn);
  dossier.appendChild(header);

  const stats = document.createElement('div');
  stats.className = 'world-map__dossier-stats';
  const fmt = (value: number): string => (isPlayer ? String(Math.round(value)) : bandFor(value));
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

const buildLegend = (): HTMLElement => {
  const legend = document.createElement('div');
  legend.className = 'world-map__legend world-map__legend--hud';
  legend.innerHTML = [
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--tension"></span>Tension</span>',
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--alliance"></span>Alliance</span>',
    '<span class="world-map__legend-item"><span class="world-map__legend-line world-map__legend-line--comms"></span>Diplomatic traffic</span>',
  ].join('');
  return legend;
};

const buildFeed = (inst: Instance): void => {
  const { props, feedEl } = inst;
  feedEl.replaceChildren();

  const title = document.createElement('div');
  title.className = 'world-map__feed-title';
  title.textContent = 'Diplomatic traffic';
  feedEl.appendChild(title);

  if (!props.negotiations.length) {
    const empty = document.createElement('div');
    empty.className = 'world-map__feed-empty';
    empty.textContent = props.campaignStarted
      ? 'No intercepts this quarter. Advance the turn to open the diplomatic phase.'
      : 'Start the campaign to see factions negotiate.';
    feedEl.appendChild(empty);
    return;
  }

  for (const exchange of props.negotiations.slice(0, 10)) {
    const item = document.createElement('div');
    item.className = 'world-map__feed-item';
    item.dataset.intent = exchange.intent;
    const from = props.state.factions[exchange.fromFactionId]?.name ?? exchange.fromFactionId;
    const to = props.state.factions[exchange.toFactionId]?.name ?? exchange.toFactionId;
    const meta = document.createElement('div');
    meta.className = 'world-map__feed-meta';
    meta.textContent = `${from} → ${to} · ${INTENT_LABELS[exchange.intent] ?? exchange.intent}`;
    const body = document.createElement('div');
    body.className = 'world-map__feed-message';
    body.textContent = exchange.message;
    item.append(meta, body);
    feedEl.appendChild(item);
  }
};

/** Compact relations readout: active alliances + hottest tensions. */
const buildRelationsCard = (inst: Instance): HTMLElement | null => {
  const { state } = inst.props;
  const name = (id: string): string => state.factions[id]?.name ?? id;

  const allianceRows: string[] = [];
  const seen = new Set<string>();
  for (const [factionId, allies] of state.alliances.entries()) {
    for (const allyId of allies) {
      const key = tensionKeyFor(factionId, allyId);
      if (seen.has(key)) continue;
      seen.add(key);
      allianceRows.push(`${name(factionId)} + ${name(allyId)}`);
    }
  }

  const tensionRows = [...state.tensions.entries()]
    .filter(([, value]) => value >= 15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, value]) => {
      const [a, b] = key.split(':');
      return { label: `${name(a)} ↔ ${name(b)}`, value: Math.round(value) };
    });

  if (!allianceRows.length && !tensionRows.length) return null;

  const card = document.createElement('div');
  card.className = 'world-map__relations';
  const title = document.createElement('div');
  title.className = 'world-map__relations-title';
  title.textContent = 'World relations';
  card.appendChild(title);

  for (const row of allianceRows) {
    const el = document.createElement('div');
    el.className = 'world-map__relations-row world-map__relations-row--alliance';
    el.textContent = `🤝 ${row}`;
    card.appendChild(el);
  }
  for (const row of tensionRows) {
    const el = document.createElement('div');
    el.className = 'world-map__relations-row world-map__relations-row--tension';
    el.textContent = `⚡ ${row.label} — ${row.value}`;
    card.appendChild(el);
  }
  return card;
};

/** Show a transient phase-status line on the map HUD (e.g. "Factions negotiating…"). */
export const setWorldMapStatus = (text: string | null): void => {
  if (!instance) return;
  instance.statusEl.textContent = text ?? '';
  instance.statusEl.classList.toggle('is-visible', !!text);
};

const syncOverlays = (inst: Instance): void => {
  const propsKey = JSON.stringify({
    sel: inst.props.selectedFactionId,
    neg: inst.props.negotiations.map((n) => `${n.fromFactionId}>${n.toFactionId}:${n.intent}:${n.message}`),
    started: inst.props.campaignStarted,
    actions: inst.props.targetActions.map((a) => a.id),
    alliances: [...inst.props.state.alliances.entries()].map(([k, v]) => `${k}:${v.join(',')}`),
    tensions: [...inst.props.state.tensions.entries()].map(([k, v]) => `${k}:${Math.round(v)}`),
    stats: inst.props.selectedFactionId
      ? (() => {
        const f = inst.props.state.factions[inst.props.selectedFactionId!];
        return f ? [f.capabilityScore, f.safetyScore, f.resources.trust] : [];
      })()
      : [],
  });
  if (propsKey === inst.lastPropsKey) return;
  inst.lastPropsKey = propsKey;

  inst.hudLayer.replaceChildren();
  inst.hudLayer.appendChild(buildLegend());
  const dossier = buildDossier(inst);
  if (dossier) inst.hudLayer.appendChild(dossier);
  const relations = buildRelationsCard(inst);
  if (relations) inst.hudLayer.appendChild(relations);
  buildFeed(inst);
};
