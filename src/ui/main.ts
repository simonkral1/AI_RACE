import './styles.css';

import { createInitialState } from '../core/state.js';
import { resolveTurn } from '../core/engine.js';
import { decideActions } from '../ai/decideActions.js';
import { mulberry32, round1 } from '../core/utils.js';
import { GameState, TechNode } from '../core/types.js';
import { ACTIONS } from '../data/actions.js';
import { TECH_TREE } from '../data/techTree.js';

const turnLabel = document.getElementById('turnLabel');
const globalSafety = document.getElementById('globalSafety');
const tension = document.getElementById('tension');
const factionList = document.getElementById('factionList');
const recentActions = document.getElementById('recentActions');
const agiClock = document.getElementById('agiClock');
const nextTurnBtn = document.getElementById('nextTurn');
const resetBtn = document.getElementById('reset');
const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
const playerFactionSelect = document.getElementById('playerFaction') as HTMLSelectElement | null;
const orderRows = Array.from(document.querySelectorAll<HTMLDivElement>('.orders__row'));
const techTree = document.getElementById('techTree');
const techTreeMeta = document.getElementById('techTreeMeta');
const focusCard = document.getElementById('focusCard');
const startOverlay = document.getElementById('startOverlay');
const startOptions = document.getElementById('startOptions');
const startGameButton = document.getElementById('startGame');

let seed = 21;
let rng = mulberry32(seed);
let state: GameState = createInitialState();
let playerFactionId = 'us_lab_a';
let focusFactionId = 'us_lab_a';
let activeOrderIndex = 0;

const BOARD_NODES = [
  { id: 'us_lab_a', label: 'Orion', x: 200, y: 210 },
  { id: 'us_lab_b', label: 'Apex', x: 270, y: 300 },
  { id: 'us_gov', label: 'US Exec', x: 140, y: 320 },
  { id: 'cn_lab', label: 'Red Horizon', x: 660, y: 230 },
  { id: 'cn_gov', label: 'PRC Exec', x: 740, y: 300 },
];

const formatQuarter = (year: number, quarter: number): string => `${year} Q${quarter}`;

const getSafetyBand = (safety: number): 'low' | 'mid' | 'high' => {
  if (safety < 40) return 'low';
  if (safety < 70) return 'mid';
  return 'high';
};

const getTension = (state: GameState): string => {
  const capability = Object.values(state.factions).reduce((sum, f) => sum + f.capabilityScore, 0);
  if (capability > 140) return 'Severe';
  if (capability > 90) return 'Elevated';
  if (capability > 50) return 'Rising';
  return 'Low';
};

const getAgiClock = (state: GameState): string => {
  const best = Math.max(...Object.values(state.factions).map((f) => f.capabilityScore));
  if (best > 70) return 'Late phase';
  if (best > 45) return 'Mid phase';
  if (best > 25) return 'Early phase';
  return 'Nascent';
};

const renderFactions = (state: GameState): void => {
  if (!factionList) return;
  factionList.innerHTML = '';
  for (const faction of Object.values(state.factions)) {
    const card = document.createElement('div');
    card.className = 'faction-card';
    if (faction.id === focusFactionId) card.classList.add('is-focused');
    card.dataset.faction = faction.id;

    card.innerHTML = `
      <div class="faction-card__header">
        <div class="faction-card__title">${faction.name}</div>
        <div class="faction-card__tag">${faction.type.toUpperCase()}</div>
      </div>
      <div class="stat-row">
        ${renderStat('Capability', faction.capabilityScore, 'stat__fill', canSeeExact(faction.id))}
        ${renderStat('Safety', faction.safetyScore, 'stat__fill--safety', canSeeExact(faction.id))}
        ${renderStat('Trust', faction.resources.trust, 'stat__fill--trust', true)}
        ${renderStat('Compute', faction.resources.compute, 'stat__fill', canSeeExact(faction.id))}
      </div>
    `;

    factionList.appendChild(card);
  }
};

const bandFor = (value: number) => {
  if (value < 40) return { label: 'Low', pct: 25 };
  if (value < 70) return { label: 'Med', pct: 55 };
  return { label: 'High', pct: 85 };
};

const canSeeExact = (factionId: string): boolean => factionId === playerFactionId;

const renderStat = (label: string, value: number, fillClass = '', reveal = true): string => {
  const clamped = Math.max(0, Math.min(100, value));
  const band = bandFor(clamped);
  const displayValue = reveal ? round1(clamped).toString() : band.label;
  const displayWidth = reveal ? clamped : band.pct;
  return `
    <div class="stat">
      <span>${label}</span>
      <div class="stat__bar"><div class="stat__fill ${fillClass}" style="width: ${displayWidth}%"></div></div>
      <span class="stat__value">${displayValue}</span>
    </div>
  `;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const renderBoard = (state: GameState): void => {
  if (!gameCanvas) return;
  const ctx = gameCanvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = gameCanvas;
  ctx.clearRect(0, 0, width, height);

  const ocean = ctx.createLinearGradient(0, 0, width, height);
  ocean.addColorStop(0, '#0f1e1f');
  ocean.addColorStop(1, '#122a2a');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const land = ctx.createLinearGradient(0, 0, width, 0);
  land.addColorStop(0, '#2b3a2f');
  land.addColorStop(1, '#3b4f3a');
  ctx.fillStyle = land;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(80, 140);
  ctx.lineTo(330, 110);
  ctx.lineTo(420, 180);
  ctx.lineTo(360, 300);
  ctx.lineTo(120, 320);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(520, 120);
  ctx.lineTo(820, 150);
  ctx.lineTo(860, 260);
  ctx.lineTo(760, 360);
  ctx.lineTo(560, 300);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(410, 330);
  ctx.lineTo(510, 330);
  ctx.lineTo(540, 400);
  ctx.lineTo(460, 450);
  ctx.lineTo(380, 410);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  for (const node of BOARD_NODES) {
    const faction = state.factions[node.id];
    if (!faction) continue;
    const reveal = canSeeExact(node.id);
    const safetyBand = reveal ? getSafetyBand(faction.safetyScore) : 'mid';
    const color =
      safetyBand === 'low' ? '#e26d5a' : safetyBand === 'mid' ? '#f6c06a' : '#8ac06c';

    ctx.save();
    ctx.globalAlpha = reveal ? 1 : 0.65;
    ctx.fillStyle = '#0c130f';
    drawRoundedRect(ctx, node.x - 48, node.y - 26, 96, 44, 10);
    ctx.fill();
    ctx.strokeStyle = node.id === focusFactionId ? 'rgba(246, 192, 106, 0.7)' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = node.id === focusFactionId ? 2 : 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x + 32, node.y - 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#e7efe7';
    ctx.font = '12px \"Space Grotesk\", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label.toUpperCase(), node.x, node.y);
    ctx.restore();
  }
};

const renderLog = (state: GameState): void => {
  if (!recentActions) return;
  recentActions.innerHTML = '';
  const entries = state.log.slice(-6).reverse();
  for (const entry of entries) {
    const li = document.createElement('li');
    li.textContent = entry;
    recentActions.appendChild(li);
  }
  state.log.length = 0;
};

const renderFocusCard = (state: GameState): void => {
  if (!focusCard) return;
  const faction = state.factions[focusFactionId];
  if (!faction) return;
  const reveal = canSeeExact(faction.id);
  const capability = reveal ? round1(faction.capabilityScore) : bandFor(faction.capabilityScore).label;
  const safety = reveal ? round1(faction.safetyScore) : bandFor(faction.safetyScore).label;
  const compute = reveal ? round1(faction.resources.compute) : bandFor(faction.resources.compute).label;
  const trust = round1(faction.resources.trust);

  focusCard.innerHTML = `
    <div class="focus-card__title">${faction.name}</div>
    <div class="focus-card__row"><span>Type</span><span class="focus-card__value">${faction.type.toUpperCase()}</span></div>
    <div class="focus-card__row"><span>Capability</span><span class="focus-card__value">${capability}</span></div>
    <div class="focus-card__row"><span>Safety</span><span class="focus-card__value">${safety}</span></div>
    <div class="focus-card__row"><span>Compute</span><span class="focus-card__value">${compute}</span></div>
    <div class="focus-card__row"><span>Trust</span><span class="focus-card__value">${trust}</span></div>
  `;
};

const groupByBranch = (nodes: TechNode[]): Record<string, TechNode[]> => {
  const grouped: Record<string, TechNode[]> = {};
  for (const node of nodes) {
    if (!grouped[node.branch]) grouped[node.branch] = [];
    grouped[node.branch].push(node);
  }
  return grouped;
};

const renderTechTree = (state: GameState): void => {
  if (!techTree) return;
  const faction = state.factions[playerFactionId];
  if (!faction) return;
  if (techTreeMeta) techTreeMeta.textContent = `Progress for ${faction.name}`;
  techTree.innerHTML = '';

  const grouped = groupByBranch(TECH_TREE);
  const branches: Array<keyof typeof grouped> = ['capabilities', 'safety', 'ops', 'policy'];

  for (const branch of branches) {
    const nodes = grouped[branch] ?? [];
    const container = document.createElement('div');
    container.className = 'tech-branch';

    const progressValue = faction.research[branch] ?? 0;
    const progressPct = Math.min(100, (progressValue / 50) * 100);

    container.innerHTML = `
      <div class="tech-branch__title">${branch}</div>
      <div class="tech-branch__progress">
        <span>${Math.round(progressValue)} RP</span>
        <div class="tech-progress__bar"><div class="tech-progress__fill" style="width: ${progressPct}%"></div></div>
      </div>
      <div class="tech-nodes"></div>
    `;

    const nodeList = container.querySelector('.tech-nodes') as HTMLDivElement;
    for (const node of nodes) {
      const unlocked = faction.unlockedTechs.has(node.id);
      const prereqsMet = node.prereqs.every((id) => faction.unlockedTechs.has(id));
      const status = unlocked ? 'unlocked' : prereqsMet ? 'available' : 'locked';
      const row = document.createElement('div');
      row.className = `tech-node tech-node--${status}`;
      row.innerHTML = `
        <div>${node.name}</div>
        <div class="tech-node__status">${status}</div>
      `;
      nodeList.appendChild(row);
    }

    techTree.appendChild(container);
  }
};

const needsTarget = (actionId: string): boolean =>
  actionId === 'espionage' || actionId === 'subsidize' || actionId === 'regulate';

const getAllowedActions = (factionId: string) => {
  const faction = state.factions[factionId];
  if (!faction) return [];
  return ACTIONS.filter((action) => action.allowedFor.includes(faction.type));
};

const renderPlayerControls = (): void => {
  if (!playerFactionSelect) return;
  playerFactionSelect.innerHTML = '';
  for (const faction of Object.values(state.factions)) {
    const option = document.createElement('option');
    option.value = faction.id;
    option.textContent = faction.name;
    if (faction.id === playerFactionId) option.selected = true;
    playerFactionSelect.appendChild(option);
  }

  const allowedActions = getAllowedActions(playerFactionId);
  const targets = Object.values(state.factions).filter((f) => f.id !== playerFactionId);

  for (const row of orderRows) {
    const actionSelect = row.querySelector<HTMLSelectElement>('.orders__action');
    const targetSelect = row.querySelector<HTMLSelectElement>('.orders__target');
    if (!actionSelect || !targetSelect) continue;
    actionSelect.innerHTML = '';
    for (const action of allowedActions) {
      const option = document.createElement('option');
      option.value = action.id;
      option.textContent = action.name;
      actionSelect.appendChild(option);
    }

    targetSelect.innerHTML = '';
    const none = document.createElement('option');
    none.value = '';
    none.textContent = 'No target';
    targetSelect.appendChild(none);
    for (const target of targets) {
      const option = document.createElement('option');
      option.value = target.id;
      option.textContent = target.name;
      targetSelect.appendChild(option);
    }

    const updateTargetState = () => {
      const selected = actionSelect.value;
      const requires = needsTarget(selected);
      targetSelect.disabled = !requires;
      if (!requires) targetSelect.value = '';
    };

    actionSelect.onchange = updateTargetState;
    updateTargetState();
  }
};

const setActiveOrderRow = (index: number) => {
  activeOrderIndex = Math.max(0, Math.min(orderRows.length - 1, index));
  orderRows.forEach((row, idx) => row.classList.toggle('is-active', idx === activeOrderIndex));
};

const render = (state: GameState): void => {
  if (turnLabel) turnLabel.textContent = formatQuarter(state.year, state.quarter);
  if (globalSafety) globalSafety.textContent = String(round1(state.globalSafety));
  if (tension) tension.textContent = getTension(state);
  if (agiClock) agiClock.textContent = getAgiClock(state);
  renderFactions(state);
  renderBoard(state);
  renderLog(state);
  renderTechTree(state);
  renderFocusCard(state);
};

const readPlayerOrders = (): ReturnType<typeof decideActions> => {
  const orders: ReturnType<typeof decideActions> = [];
  for (const row of orderRows) {
    const actionSelect = row.querySelector<HTMLSelectElement>('.orders__action');
    const opennessSelect = row.querySelector<HTMLSelectElement>('.orders__openness');
    const targetSelect = row.querySelector<HTMLSelectElement>('.orders__target');
    if (!actionSelect || !opennessSelect) continue;
    const actionId = actionSelect.value;
    if (!actionId) continue;
    const openness = opennessSelect.value === 'secret' ? 'secret' : 'open';
    const targetFactionId = targetSelect?.value || undefined;
    orders.push({ actionId, openness, targetFactionId: targetFactionId || undefined });
  }
  return orders;
};

const advance = (): void => {
  if (state.gameOver) return;
  const choices: Record<string, ReturnType<typeof decideActions>> = {};
  for (const factionId of Object.keys(state.factions)) {
    if (factionId === playerFactionId) {
      choices[factionId] = readPlayerOrders();
    } else {
      choices[factionId] = decideActions(state, factionId, rng);
    }
  }
  resolveTurn(state, choices, rng);
  render(state);
};

const reset = (): void => {
  seed += 7;
  rng = mulberry32(seed);
  state = createInitialState();
  playerFactionId = 'us_lab_a';
  focusFactionId = playerFactionId;
  startOverlay?.classList.remove('is-hidden');
  if (playerFactionSelect) playerFactionSelect.disabled = false;
  setActiveOrderRow(0);
  renderPlayerControls();
  renderStartOverlay();
  render(state);
};

playerFactionSelect?.addEventListener('change', (event) => {
  const value = (event.target as HTMLSelectElement).value;
  playerFactionId = value || playerFactionId;
  focusFactionId = playerFactionId;
  renderPlayerControls();
  render(state);
});

const bindFocusHandlers = () => {
  factionList?.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest('.faction-card') as HTMLElement | null;
    const id = target?.dataset.faction;
    if (!id) return;
    focusFactionId = id;
    render(state);
  });

  gameCanvas?.addEventListener('click', (event) => {
    if (!gameCanvas) return;
    const rect = gameCanvas.getBoundingClientRect();
    const scaleX = gameCanvas.width / rect.width;
    const scaleY = gameCanvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    const hit = BOARD_NODES.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.hypot(dx, dy) < 28;
    });

    if (!hit) return;
    focusFactionId = hit.id;

    if (hit.id !== playerFactionId) {
      const row = orderRows[activeOrderIndex];
      const actionSelect = row?.querySelector<HTMLSelectElement>('.orders__action');
      const targetSelect = row?.querySelector<HTMLSelectElement>('.orders__target');
      if (actionSelect && targetSelect && needsTarget(actionSelect.value)) {
        targetSelect.disabled = false;
        targetSelect.value = hit.id;
      }
    }
    render(state);
  });

  orderRows.forEach((row, index) => {
    row.addEventListener('click', () => setActiveOrderRow(index));
  });
};

const renderStartOverlay = () => {
  if (!startOverlay || !startOptions || !startGameButton) return;
  startOptions.innerHTML = '';
  const factions = Object.values(state.factions);
  for (const faction of factions) {
    const option = document.createElement('div');
    option.className = 'overlay__option';
    if (faction.id === playerFactionId) option.classList.add('is-selected');
    option.textContent = `${faction.name} · ${faction.type.toUpperCase()}`;
    option.dataset.faction = faction.id;
    option.addEventListener('click', () => {
      playerFactionId = faction.id;
      focusFactionId = faction.id;
      renderStartOverlay();
    });
    startOptions.appendChild(option);
  }

  startGameButton.onclick = () => {
    startOverlay.classList.add('is-hidden');
    if (playerFactionSelect) playerFactionSelect.disabled = true;
    setActiveOrderRow(0);
    renderPlayerControls();
    render(state);
  };
};

nextTurnBtn?.addEventListener('click', advance);
resetBtn?.addEventListener('click', reset);

bindFocusHandlers();
renderStartOverlay();
renderPlayerControls();
setActiveOrderRow(0);
render(state);

const renderGameToText = (): string => {
  const payload = {
    mode: state.gameOver ? 'ended' : 'running',
    year: state.year,
    quarter: state.quarter,
    playerFactionId,
    focusFactionId,
    globalSafety: round1(state.globalSafety),
    coordSystem: 'origin top-left, +x right, +y down',
    boardNodes: BOARD_NODES.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      label: node.label,
    })),
    factions: Object.values(state.factions).map((faction) => ({
      id: faction.id,
      name: faction.name,
      type: faction.type,
      capability: canSeeExact(faction.id) ? round1(faction.capabilityScore) : bandFor(faction.capabilityScore).label,
      safety: canSeeExact(faction.id) ? round1(faction.safetyScore) : bandFor(faction.safetyScore).label,
      trust: round1(faction.resources.trust),
      compute: canSeeExact(faction.id) ? round1(faction.resources.compute) : bandFor(faction.resources.compute).label,
    })),
  };
  return JSON.stringify(payload);
};

const advanceTime = (ms: number): void => {
  if (!Number.isFinite(ms)) return;
  render(state);
};

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

window.render_game_to_text = renderGameToText;
window.advanceTime = advanceTime;
