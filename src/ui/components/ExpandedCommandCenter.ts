import { div, span, el, button } from './base.js';
import { renderMiniVictoryBars } from './VictoryTracker.js';
import type {
  ActionDefinition,
  GameState,
  FactionState,
} from '../../core/types.js';

export interface ExpandedCommandCenterOptions {
  /** Current game state */
  gameState: GameState;
  /** Currently selected player faction ID */
  playerFactionId: string;
  /** Whether the campaign has started */
  campaignStarted: boolean;
  /** Pending event (if any) */
  hasPendingEvent: boolean;
  /** Pending event count */
  pendingEventCount: number;
  /** Current directive text */
  directiveText: string;
  /** Full simulation log for in-panel review */
  fullLogEntries?: string[];
  /** Narrative timeline entries */
  narrativeFeed?: string[];
  /** Strategic situations (AI-generated) */
  situations?: StrategicSituation[];
  /** Latest evaluated actions for prominent display */
  actionDossier?: ActionDossierEntry[];
  /** Number of pending action-review entries */
  pendingActionReviewCount?: number;
  /** Locked directives queued for next turn */
  lockedDirectives?: string[];
  /** Allowed actions for current faction */
  allowedActions?: ActionDefinition[];
  /** Unread inbound faction comms count */
  commsUnreadCount?: number;
}

export interface StrategicSituation {
  id: string;
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high';
  potentialResponses: {
    id: string;
    title: string;
    description: string;
  }[];
}

export interface ActionDossierEntry {
  actorName: string;
  title: string;
  openness: 'open' | 'secret';
  source?: 'llm' | 'error' | 'deterministic';
  summary: string;
  intel: string;
}

export interface ExpandedCommandCenterCallbacks {
  onAdvanceTurn: () => void;
  onDirectiveSubmit: (text: string) => void;
  onEditLockedDirective?: (index: number) => void;
  onRemoveLockedDirective?: (index: number) => void;
  onOpenTechTree: () => void;
  onOpenGamemaster: () => void;
  onOpenFactionChat: () => void;
  onOpenActionReview?: () => void;
  onEventClick: () => void;
  onReset: () => void;
  onStats: () => void;
  onHelp: () => void;
  onSuggestedAction?: (responseText: string) => void;
}

function createSectionHeader(title: string): HTMLElement {
  const header = div({ className: 'command-center__section-header' });
  const titleSpan = span({
    className: 'command-center__section-title',
    text: title,
  });
  header.appendChild(titleSpan);
  return header;
}

function formatTurnDate(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}

function formatTurnNumber(turn: number, maxTurns: number = 32): string {
  return `Turn ${turn + 1}/${maxTurns}`;
}

function getAdvanceButtonText(
  campaignStarted: boolean,
  hasPendingEvent: boolean,
  gameOver: boolean
): string {
  if (!campaignStarted) return 'Select Faction';
  if (hasPendingEvent) return 'Resolve Event';
  if (gameOver) return 'Campaign Ended';
  return 'Advance Quarter';
}

const AGI_CAPABILITY_TRACK_MAX = 100;
const SAFE_DEPLOY_SAFETY_TARGET = 80;
const SAFE_DEPLOY_GLOBAL_TARGET = 70;

const FACTION_RACE_COLORS: Record<string, string> = {
  us_lab_a: '#3f7f5f',
  us_lab_b: '#b75f48',
  cn_lab: '#3f6fa6',
  us_gov: '#7f5d9f',
  cn_gov: '#a1702b',
};

type ReadinessStatus = 'ready' | 'tracking' | 'lagging';

function percentTowards(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, (value / target) * 100));
}

function getReadinessStatus(value: number, target: number): ReadinessStatus {
  if (value >= target) return 'ready';
  const ratio = target <= 0 ? 0 : value / target;
  if (ratio >= 0.75) return 'tracking';
  return 'lagging';
}

function createReadinessItem(
  label: string,
  valueText: string,
  progress: number,
  status: ReadinessStatus,
): HTMLElement {
  const item = div({
    className: `command-center__agi-readiness-item command-center__agi-readiness-item--${status}`,
  });

  const row = div({ className: 'command-center__agi-readiness-row' });
  row.appendChild(span({
    className: 'command-center__agi-readiness-label',
    text: label,
  }));
  row.appendChild(span({
    className: 'command-center__agi-readiness-value',
    text: valueText,
  }));
  item.appendChild(row);

  const meter = div({ className: 'command-center__agi-readiness-meter' });
  meter.appendChild(div({
    className: 'command-center__agi-readiness-fill',
    attrs: { style: `width: ${progress.toFixed(1)}%;` },
  }));
  item.appendChild(meter);
  return item;
}

function getFactionRaceColor(faction: FactionState, isPlayer: boolean): string {
  if (isPlayer) return 'var(--accent)';
  const mapped = FACTION_RACE_COLORS[faction.id];
  if (mapped) return mapped;
  return faction.type === 'lab' ? '#b4634f' : '#78649a';
}

function createAgiFrontierMap(state: GameState, playerFactionId: string): HTMLElement {
  const section = div({ className: 'command-center__agi-map' });
  section.appendChild(createSectionHeader('AGI Frontier Map'));

  const factions = Object.values(state.factions).sort((a, b) => b.capabilityScore - a.capabilityScore);
  const playerFaction = state.factions[playerFactionId];
  if (!playerFaction || factions.length === 0) {
    section.appendChild(div({
      className: 'command-center__agi-map-summary',
      text: 'Faction telemetry unavailable.',
    }));
    return section;
  }

  const leader = factions[0];
  const playerRank = factions.findIndex((f) => f.id === playerFactionId) + 1;
  const leadGap = Math.max(0, Math.round(leader.capabilityScore - playerFaction.capabilityScore));
  const statusLine = playerRank <= 1
    ? `You are leading capability development at ${Math.round(playerFaction.capabilityScore)}.`
    : `You are #${playerRank} and trail ${leader.name} by ${leadGap} capability.`;
  section.appendChild(div({
    className: 'command-center__agi-map-summary',
    text: statusLine,
  }));

  const milestoneStrip = div({ className: 'command-center__agi-milestones' });
  const milestones = [
    { label: 'Frontier Models', value: 25 },
    { label: 'Agentic Systems', value: 50 },
    { label: 'Deployment Window', value: 80 },
    { label: 'AGI Threshold', value: 100 },
  ];
  for (const milestone of milestones) {
    milestoneStrip.appendChild(div({
      className: 'command-center__agi-milestone',
      attrs: { style: `left: ${milestone.value}%;` },
      children: [
        span({ className: 'command-center__agi-milestone-tick', text: '|' }),
        span({ className: 'command-center__agi-milestone-label', text: milestone.label }),
      ],
    }));
  }
  section.appendChild(milestoneStrip);

  const raceList = div({ className: 'command-center__agi-race-list' });
  for (const raceFaction of factions) {
    const isPlayer = raceFaction.id === playerFactionId;
    const progress = percentTowards(raceFaction.capabilityScore, AGI_CAPABILITY_TRACK_MAX);

    const row = div({
      className: `command-center__agi-race-row${isPlayer ? ' command-center__agi-race-row--player' : ''}`,
    });
    row.style.setProperty('--race-color', getFactionRaceColor(raceFaction, isPlayer));

    const label = div({ className: 'command-center__agi-race-label' });
    label.appendChild(span({
      className: 'command-center__agi-race-name',
      text: raceFaction.name,
    }));
    if (isPlayer) {
      label.appendChild(span({
        className: 'command-center__agi-race-you',
        text: 'YOU',
      }));
    }
    if (raceFaction.canDeployAgi) {
      label.appendChild(span({
        className: 'command-center__agi-race-breakthrough',
        text: 'AGI UNLOCKED',
      }));
    }
    row.appendChild(label);

    const track = div({ className: 'command-center__agi-race-track' });
    track.appendChild(div({
      className: 'command-center__agi-race-fill',
      attrs: { style: `width: ${progress.toFixed(1)}%;` },
    }));
    track.appendChild(span({
      className: `command-center__agi-race-marker${raceFaction.canDeployAgi ? ' command-center__agi-race-marker--breakthrough' : ''}`,
      attrs: { style: `left: ${progress.toFixed(1)}%;` },
      text: '◆',
    }));
    row.appendChild(track);

    row.appendChild(span({
      className: 'command-center__agi-race-value',
      text: String(Math.round(raceFaction.capabilityScore)),
    }));
    raceList.appendChild(row);
  }
  section.appendChild(raceList);

  const readiness = div({ className: 'command-center__agi-readiness' });
  const unlockProgress = playerFaction.canDeployAgi
    ? 100
    : percentTowards(playerFaction.capabilityScore, AGI_CAPABILITY_TRACK_MAX);
  readiness.appendChild(createReadinessItem(
    'AGI Unlock',
    playerFaction.canDeployAgi ? 'Ready' : 'Locked',
    unlockProgress,
    playerFaction.canDeployAgi ? 'ready' : 'lagging',
  ));

  const safetyProgress = percentTowards(playerFaction.safetyScore, SAFE_DEPLOY_SAFETY_TARGET);
  readiness.appendChild(createReadinessItem(
    `Safety >= ${SAFE_DEPLOY_SAFETY_TARGET}`,
    `${Math.round(playerFaction.safetyScore)}/${SAFE_DEPLOY_SAFETY_TARGET}`,
    safetyProgress,
    getReadinessStatus(playerFaction.safetyScore, SAFE_DEPLOY_SAFETY_TARGET),
  ));

  const globalProgress = percentTowards(state.globalSafety, SAFE_DEPLOY_GLOBAL_TARGET);
  readiness.appendChild(createReadinessItem(
    `Global >= ${SAFE_DEPLOY_GLOBAL_TARGET}`,
    `${Math.round(state.globalSafety)}/${SAFE_DEPLOY_GLOBAL_TARGET}`,
    globalProgress,
    getReadinessStatus(state.globalSafety, SAFE_DEPLOY_GLOBAL_TARGET),
  ));
  section.appendChild(readiness);

  return section;
}

function generateStrategicSituations(
  faction: FactionState,
  state: GameState
): StrategicSituation[] {
  const situations: StrategicSituation[] = [];

  if (faction.type === 'lab') {
    const researchLeverage = faction.capabilityScore + faction.safetyScore;
    if (researchLeverage >= 40) {
      situations.push({
        id: 'research-disclosure',
        title: 'Research Disclosure Strategy',
        description: 'Decide what becomes a public paper versus private lab know-how. Public work can improve soft power but also accelerates rivals.',
        urgency: faction.resources.trust < 45 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'paper', title: 'Publish as Paper', description: 'Signal openness and improve field coordination' },
          { id: 'private', title: 'Keep Private', description: 'Retain proprietary edge with lower transparency' },
          { id: 'deploy', title: 'Pair with Deployment', description: 'Ship products while controlling disclosure cadence' },
        ],
      });
    }

    // Safety vs Capability Trade-off
    const safetyGap = faction.capabilityScore - faction.safetyScore;
    if (safetyGap > 15) {
      situations.push({
        id: 'safety-deficit',
        title: 'Safety Deficit',
        description: `Your capability outpaces safety by ${Math.round(safetyGap)} points. Regulators are watching.`,
        urgency: safetyGap > 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'pause', title: 'Safety Pause', description: 'Focus on alignment this quarter' },
          { id: 'parallel', title: 'Parallel Track', description: 'Split resources evenly' },
        ],
      });
    }

    // Trust issues
    if (faction.resources.trust < 40) {
      situations.push({
        id: 'trust-crisis',
        title: 'Soft-Power Crisis',
        description: `Soft power at ${Math.round(faction.resources.trust)}%. A scandal could trigger crackdown.`,
        urgency: faction.resources.trust < 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'open', title: 'Open Research', description: 'Publish openly to rebuild soft power' },
          { id: 'pr', title: 'PR Campaign', description: 'Invest in positive messaging' },
        ],
      });
    }

    // Compute shortage
    if (faction.resources.compute < 30) {
      situations.push({
        id: 'compute-shortage',
        title: 'Compute Crunch',
        description: `Only ${Math.round(faction.resources.compute)} compute units. Training runs are limited.`,
        urgency: 'medium',
        potentialResponses: [
          { id: 'build', title: 'Build Infrastructure', description: 'Invest in datacenter capacity' },
          { id: 'efficient', title: 'Efficiency Focus', description: 'Research compute-efficient methods' },
        ],
      });
    }

    // Cybersecurity weakness for labs
    if (faction.resources.cybersecurity < 50) {
      situations.push({
        id: 'cyber-gap',
        title: 'Cybersecurity Gap',
        description: `Cybersecurity at ${Math.round(faction.resources.cybersecurity)}. Breach and espionage risks are rising.`,
        urgency: faction.resources.cybersecurity < 30 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'hardening', title: 'Security Hardening', description: 'Upgrade defensive controls and auditing' },
          { id: 'workforce', title: 'Cyber Workforce', description: 'Expand cyber operations capacity' },
        ],
      });
    }
  }

  // Government-specific situations
  if (faction.type === 'government') {
    // Low influence situation
    if (faction.resources.influence < 40) {
      situations.push({
        id: 'influence-waning',
        title: 'Waning Influence',
        description: `Influence at ${Math.round(faction.resources.influence)}%. Your regulatory power is diminishing.`,
        urgency: faction.resources.influence < 25 ? 'high' : 'medium',
        potentialResponses: [
          { id: 'regulate', title: 'New Regulations', description: 'Assert authority through policy' },
          { id: 'cooperate', title: 'Industry Partnership', description: 'Build collaborative relationships' },
        ],
      });
    }

    // Labs racing ahead
    const labFactions = Object.values(state.factions).filter(f => f.type === 'lab');
    const maxLabCapability = Math.max(...labFactions.map(f => f.capabilityScore));
    if (maxLabCapability > 50 && faction.capabilityScore < maxLabCapability * 0.5) {
      situations.push({
        id: 'falling-behind',
        title: 'Technological Gap',
        description: `Private labs are racing ahead. Your oversight capability is limited.`,
        urgency: 'high',
        potentialResponses: [
          { id: 'invest', title: 'National AI Program', description: 'Increase government AI investment' },
          { id: 'monitor', title: 'Enhanced Monitoring', description: 'Strengthen oversight mechanisms' },
        ],
      });
    }

    // International tension - compute from total capability scores
    const totalCapability = Object.values(state.factions).reduce((sum, f) => sum + f.capabilityScore, 0);
    const tensionLevel = totalCapability > 140 ? 'critical' : totalCapability > 90 ? 'high' : 'moderate';
    if (tensionLevel === 'high' || tensionLevel === 'critical') {
      situations.push({
        id: 'geopolitical-risk',
        title: 'Geopolitical Tensions',
        description: `International AI competition is escalating. Cooperation is breaking down.`,
        urgency: tensionLevel === 'critical' ? 'high' : 'medium',
        potentialResponses: [
          { id: 'diplomacy', title: 'Diplomatic Outreach', description: 'Pursue international agreements' },
          { id: 'compete', title: 'Strategic Competition', description: 'Prioritize national advantage' },
        ],
      });
    }
  }

  // Global safety concern
  if (state.globalSafety < 50) {
    situations.push({
      id: 'global-risk',
      title: 'Rising Global Risk',
      description: `Global safety at ${Math.round(state.globalSafety)}%. The field is moving faster than safety.`,
      urgency: state.globalSafety < 35 ? 'high' : 'medium',
      potentialResponses: [
        { id: 'coalition', title: 'Safety Coalition', description: 'Coordinate with other factions' },
        { id: 'research', title: 'Safety Research', description: 'Prioritize alignment work' },
      ],
    });
  }

  return situations.slice(0, 3);
}

function createSituationsSection(
  situations: StrategicSituation[],
  onSuggestedAction?: (text: string) => void
): HTMLElement {
  const section = div({ className: 'command-center__situations' });

  section.appendChild(createSectionHeader('Strategic Situations'));

  if (situations.length === 0) {
    const empty = div({
      className: 'command-center__situations-empty',
      text: 'No immediate concerns. Consider your long-term goals.',
    });
    section.appendChild(empty);
    return section;
  }

  const list = div({ className: 'command-center__situations-list' });

  for (const situation of situations) {
    const card = div({
      className: `command-center__situation-card command-center__situation-card--${situation.urgency}`,
    });

    const cardHeader = div({ className: 'command-center__situation-header' });
    const titleSpan = span({
      className: 'command-center__situation-title',
      text: situation.title,
    });
    const urgencySpan = span({
      className: `command-center__situation-urgency command-center__situation-urgency--${situation.urgency}`,
      text: situation.urgency.toUpperCase(),
    });
    cardHeader.appendChild(titleSpan);
    cardHeader.appendChild(urgencySpan);

    const cardDesc = div({
      className: 'command-center__situation-desc',
      text: situation.description,
    });

    card.appendChild(cardHeader);
    card.appendChild(cardDesc);

    // Add response buttons
    if (situation.potentialResponses.length > 0) {
      const responses = div({ className: 'command-center__situation-responses' });
      for (const response of situation.potentialResponses) {
        const responseBtn = button({
          className: 'command-center__response-btn',
        });
        const strongEl = el('strong', {});
        strongEl.textContent = response.title;
        responseBtn.appendChild(strongEl);
        responseBtn.title = response.description;
        responseBtn.addEventListener('click', () => {
          onSuggestedAction?.(`${response.title}: ${response.description}`);
        });
        responses.appendChild(responseBtn);
      }
      card.appendChild(responses);
    }

    list.appendChild(card);
  }

  section.appendChild(list);
  return section;
}

function createDossierCard(
  entry: ActionDossierEntry,
  emphasized = false,
): HTMLElement {
  const card = div({
    className: `command-center__dossier-card${emphasized ? ' command-center__dossier-card--player' : ''}`,
  });
  const header = div({ className: 'command-center__dossier-card-header' });
  header.appendChild(span({ className: 'command-center__dossier-actor', text: entry.actorName }));
  header.appendChild(span({
    className: `command-center__dossier-tag command-center__dossier-tag--${entry.openness}`,
    text: entry.openness === 'open' ? 'OPEN' : 'PRIVATE',
  }));
  if (entry.source) {
    const sourceText =
      entry.source === 'llm'
        ? 'LLM'
        : entry.source === 'deterministic'
          ? 'MECHANICS'
          : 'AI ERROR';
    header.appendChild(span({
      className: `command-center__dossier-source command-center__dossier-source--${entry.source}`,
      text: sourceText,
    }));
  }

  card.appendChild(header);
  card.appendChild(div({ className: 'command-center__dossier-title', text: entry.title }));
  card.appendChild(div({ className: 'command-center__dossier-summary', text: entry.summary }));
  card.appendChild(div({ className: 'command-center__dossier-intel', text: entry.intel }));
  return card;
}

function createTurnReviewSection(
  dossier: ActionDossierEntry[],
  pendingCount: number,
  playerFactionName: string,
  fullLogEntries: string[],
  onOpenActionReview?: () => void,
): HTMLElement {
  const section = div({ className: 'command-center__turn-review' });
  section.appendChild(createSectionHeader('Turn Review'));

  const hasReview = dossier.length > 0;
  section.appendChild(div({
    className: 'command-center__dossier-intro',
    text: hasReview
      ? pendingCount > 0
        ? `${pendingCount} action outcomes captured from the latest turn.`
        : 'Latest turn outcomes are synced. Review your execution first, then rival moves.'
      : 'Advance a quarter to generate action-by-action review.',
  }));

  if (!hasReview) {
    section.appendChild(div({
      className: 'command-center__dossier-empty',
      text: 'No turn review entries yet.',
    }));
  } else {
    const playerEntries = dossier.filter((entry) => entry.actorName === playerFactionName);
    const externalPool = dossier.filter((entry) => entry.actorName !== playerFactionName);
    const externalEntries = [
      ...externalPool.filter((entry) => entry.openness === 'open'),
      ...externalPool.filter((entry) => entry.openness !== 'open'),
    ].slice(0, 4);

    const laneWrap = div({ className: 'command-center__review-lanes' });

    const playerLane = div({ className: 'command-center__review-lane' });
    playerLane.appendChild(div({
      className: 'command-center__directive-subtitle',
      text: 'Your Actions',
    }));
    if (playerEntries.length === 0) {
      playerLane.appendChild(div({
        className: 'command-center__directive-empty',
        text: 'No player action entries available for this turn.',
      }));
    } else {
      const list = div({ className: 'command-center__dossier-list' });
      for (const entry of playerEntries.slice(0, 4)) {
        list.appendChild(createDossierCard(entry, true));
      }
      playerLane.appendChild(list);
    }
    laneWrap.appendChild(playerLane);

    const externalLane = div({ className: 'command-center__review-lane' });
    externalLane.appendChild(div({
      className: 'command-center__directive-subtitle',
      text: 'Key External Events',
    }));
    if (externalEntries.length === 0) {
      externalLane.appendChild(div({
        className: 'command-center__directive-empty',
        text: 'No rival action highlights yet.',
      }));
    } else {
      const list = div({ className: 'command-center__dossier-list' });
      for (const entry of externalEntries) {
        list.appendChild(createDossierCard(entry));
      }
      externalLane.appendChild(list);
    }
    laneWrap.appendChild(externalLane);
    section.appendChild(laneWrap);
  }

  if (hasReview && onOpenActionReview) {
    const reviewBtn = button({
      className: 'command-center__dossier-review-btn',
      text: 'Open Detailed Action Cards',
    }) as HTMLButtonElement;
    reviewBtn.addEventListener('click', onOpenActionReview);
    section.appendChild(reviewBtn);
  }

  const logSection = div({ className: 'command-center__review-log command-center__log' });
  logSection.appendChild(div({
    className: 'command-center__directive-subtitle',
    text: 'Recent Outcomes',
  }));
  const recentList = el('ul', { className: 'command-center__log-list' });
  const recentEntries = fullLogEntries.slice(-6).reverse();
  if (recentEntries.length === 0) {
    recentList.appendChild(el('li', {
      className: 'command-center__log-item command-center__log-item--empty',
      text: 'No logged outcomes yet.',
    }));
  } else {
    for (const entry of recentEntries) {
      recentList.appendChild(el('li', {
        className: 'command-center__log-item',
        text: entry,
      }));
    }
  }
  logSection.appendChild(recentList);

  const fullLogDetails = el('details', { className: 'command-center__review-log-details' });
  const summary = el('summary', {
    className: 'command-center__review-log-summary',
    text: `Full Log (${fullLogEntries.length})`,
  });
  fullLogDetails.appendChild(summary);
  const fullList = el('ul', { className: 'command-center__log-list command-center__review-log-full' });
  const cappedFullEntries = fullLogEntries.slice(-120).reverse();
  if (cappedFullEntries.length === 0) {
    fullList.appendChild(el('li', {
      className: 'command-center__log-item command-center__log-item--empty',
      text: 'No full-log entries yet.',
    }));
  } else {
    for (const entry of cappedFullEntries) {
      fullList.appendChild(el('li', {
        className: 'command-center__log-item',
        text: entry,
      }));
    }
  }
  fullLogDetails.appendChild(fullList);
  logSection.appendChild(fullLogDetails);
  section.appendChild(logSection);
  return section;
}

const TARGET_REQUIRED_ACTION_IDS = new Set([
  'espionage',
  'subsidize',
  'regulate',
  'form_alliance',
  'executive_order',
  'strategic_initiative',
]);

function createDirectiveLockerPanel(
  lockedDirectives: string[],
  allowedActions: ActionDefinition[],
  callbacks: ExpandedCommandCenterCallbacks,
): HTMLElement {
  const panel = div({ className: 'command-center__directive-locker' });
  panel.appendChild(createSectionHeader('Locked Directives And Actions'));

  const lockedSection = div({ className: 'command-center__directive-group' });
  lockedSection.appendChild(div({
    className: 'command-center__directive-subtitle',
    text: 'Locked Directives',
  }));

  if (!lockedDirectives.length) {
    lockedSection.appendChild(div({
      className: 'command-center__directive-empty',
      text: 'No directives locked. Confirm a directive, then type the next one.',
    }));
  } else {
    const lockedList = div({ className: 'command-center__directive-locked-list' });
    lockedDirectives.forEach((directive, index) => {
      const card = div({ className: 'command-center__directive-locked-card' });
      const header = div({ className: 'command-center__directive-locked-header' });
      header.appendChild(span({
        className: 'command-center__directive-locked-slot',
        text: `Directive ${index + 1}`,
      }));
      header.appendChild(span({
        className: 'command-center__directive-locked-tag',
        text: 'LOCKED IN',
      }));
      card.appendChild(header);
      card.appendChild(div({
        className: 'command-center__directive-locked-text',
        text: directive,
      }));

      const controls = div({ className: 'command-center__directive-locked-controls' });
      const changeBtn = button({
        className: 'command-center__directive-locked-btn',
        text: 'Change',
      }) as HTMLButtonElement;
      changeBtn.addEventListener('click', () => callbacks.onEditLockedDirective?.(index));
      controls.appendChild(changeBtn);

      const removeBtn = button({
        className: 'command-center__directive-locked-btn command-center__directive-locked-btn--danger',
        text: 'Remove',
      }) as HTMLButtonElement;
      removeBtn.addEventListener('click', () => callbacks.onRemoveLockedDirective?.(index));
      controls.appendChild(removeBtn);

      card.appendChild(controls);
      lockedList.appendChild(card);
    });
    lockedSection.appendChild(lockedList);
  }
  panel.appendChild(lockedSection);

  const availableSection = div({ className: 'command-center__directive-group' });
  availableSection.appendChild(div({
    className: 'command-center__directive-subtitle',
    text: 'All Available Actions',
  }));
  if (!allowedActions.length) {
    availableSection.appendChild(div({
      className: 'command-center__directive-empty',
      text: 'No actions available.',
    }));
  } else {
    const availableList = div({ className: 'command-center__directive-available-list' });
    for (const action of allowedActions) {
      const requiresTarget = TARGET_REQUIRED_ACTION_IDS.has(action.id);
      availableList.appendChild(span({
        className: `command-center__directive-available-tag${requiresTarget ? ' command-center__directive-available-tag--targeted' : ''}`,
        text: requiresTarget ? `${action.name} (targeted)` : action.name,
      }));
    }
    availableSection.appendChild(availableList);
  }
  panel.appendChild(availableSection);

  return panel;
}

function createVictorySection(state: GameState, factionId: string): HTMLElement {
  const section = div({ className: 'command-center__victory' });

  section.appendChild(createSectionHeader('Victory Progress'));

  // Use mini victory bars from VictoryTracker
  const bars = renderMiniVictoryBars(state, factionId);
  bars.className = 'command-center__victory-bars';
  section.appendChild(bars);

  return section;
}

function createStatItem(label: string, value: string): HTMLElement {
  const statDiv = div({ className: 'command-center__stat' });
  const labelSpan = span({
    className: 'command-center__stat-label',
    text: label,
  });
  const valueSpan = span({
    className: 'command-center__stat-value',
    text: value,
  });
  statDiv.appendChild(labelSpan);
  statDiv.appendChild(valueSpan);
  return statDiv;
}

function createFactionStats(faction: FactionState): HTMLElement {
  const section = div({ className: 'command-center__faction-stats' });
  section.appendChild(createSectionHeader(faction.name));

  const stats = div({ className: 'command-center__stats-grid' });
  stats.appendChild(createStatItem('Capital', String(Math.round(faction.resources.capital))));
  stats.appendChild(createStatItem('Safety', String(Math.round(faction.safetyScore))));
  stats.appendChild(createStatItem('Soft Power', `${Math.round(faction.resources.trust)}%`));
  stats.appendChild(createStatItem('Compute', String(Math.round(faction.resources.compute))));
  stats.appendChild(createStatItem('Hard Power', String(Math.round(faction.hardPower))));
  section.appendChild(stats);

  return section;
}

function createDirectiveInput(
  directiveText: string,
  onSubmit: (text: string) => void,
): HTMLElement {
  const section = div({ className: 'command-center__directive' });

  const label = span({
    className: 'command-center__directive-label',
    text: 'Your Directive',
  });
  section.appendChild(label);

  const inputWrapper = div({ className: 'command-center__directive-wrapper' });

  const input = el('input', {
    className: 'command-center__directive-input',
  }) as HTMLInputElement;
  input.type = 'text';
  input.placeholder = 'Write directive and confirm to lock it in...';
  input.value = directiveText;

  const submitBtn = button({
    className: 'command-center__directive-submit',
  });
  submitBtn.textContent = '\u27A4'; // ➤ arrow character
  submitBtn.title = 'Submit directive';

  const handleSubmit = () => {
    const text = input.value.trim();
    if (text) {
      onSubmit(text);
      input.value = '';
    }
  };

  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  });

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(submitBtn);
  section.appendChild(inputWrapper);

  return section;
}

function createActionButton(
  icon: string,
  text: string,
  className: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = button({ className }) as HTMLButtonElement;
  const iconSpan = span({ className: 'command-center__action-icon', text: icon });
  btn.appendChild(iconSpan);
  btn.appendChild(document.createTextNode(` ${text}`));
  btn.addEventListener('click', onClick);
  return btn;
}

function createActionButtons(
  hasPendingEvent: boolean,
  pendingEventCount: number,
  pendingActionReviewCount: number,
  commsUnreadCount: number,
  callbacks: ExpandedCommandCenterCallbacks
): HTMLElement {
  const row = div({ className: 'command-center__actions' });

  // Tech Tree button
  const techBtn = createActionButton(
    '🔬',
    'Tech Tree (T)',
    'command-center__action-btn command-center__action-btn--tech',
    callbacks.onOpenTechTree
  );
  row.appendChild(techBtn);

  // Gamemaster button
  const gmBtn = createActionButton(
    '🎲',
    'Analyst',
    'command-center__action-btn command-center__action-btn--gamemaster',
    callbacks.onOpenGamemaster
  );
  row.appendChild(gmBtn);

  // Faction comms button
  const chatBtn = createActionButton(
    '🛰',
    'Faction Comms',
    'command-center__action-btn command-center__action-btn--comms',
    callbacks.onOpenFactionChat
  );
  if (commsUnreadCount > 0) {
    const countSpan = span({
      className: 'command-center__comms-count',
      text: String(commsUnreadCount),
    });
    chatBtn.appendChild(document.createTextNode(' '));
    chatBtn.appendChild(countSpan);
  }
  row.appendChild(chatBtn);

  if (pendingActionReviewCount > 0 && callbacks.onOpenActionReview) {
    const reviewBtn = button({
      className: 'command-center__action-btn command-center__action-btn--review',
    }) as HTMLButtonElement;
    const iconSpan = span({ className: 'command-center__action-icon', text: '🧾' });
    const countSpan = span({
      className: 'command-center__event-count',
      text: String(pendingActionReviewCount),
    });
    reviewBtn.appendChild(iconSpan);
    reviewBtn.appendChild(document.createTextNode(' Review '));
    reviewBtn.appendChild(countSpan);
    reviewBtn.addEventListener('click', callbacks.onOpenActionReview);
    row.appendChild(reviewBtn);
  }

  // Events badge (if pending)
  if (hasPendingEvent) {
    const eventBtn = button({
      className: 'command-center__action-btn command-center__action-btn--event',
    }) as HTMLButtonElement;
    const iconSpan = span({ className: 'command-center__action-icon', text: '⚡' });
    const countSpan = span({
      className: 'command-center__event-count',
      text: String(pendingEventCount),
    });
    eventBtn.appendChild(iconSpan);
    eventBtn.appendChild(document.createTextNode(' Events '));
    eventBtn.appendChild(countSpan);
    eventBtn.addEventListener('click', callbacks.onEventClick);
    row.appendChild(eventBtn);
  }

  return row;
}

function createNarrativeTimeline(entries: string[]): HTMLElement {
  const section = div({ className: 'command-center__narrative' });
  section.appendChild(createSectionHeader('Turn Narrative'));

  const list = el('ol', { className: 'command-center__narrative-list' });
  const visible = entries.slice(0, 10);

  if (visible.length === 0) {
    const emptyItem = el('li', {
      className: 'command-center__narrative-item command-center__narrative-item--empty',
    });
    emptyItem.textContent = 'Advance a quarter to see narrated outcomes.';
    list.appendChild(emptyItem);
  } else {
    for (const entry of visible) {
      const item = el('li', { className: 'command-center__narrative-item' });
      item.textContent = entry;
      list.appendChild(item);
    }
  }

  section.appendChild(list);
  return section;
}

export function renderExpandedCommandCenter(
  options: ExpandedCommandCenterOptions,
  callbacks: ExpandedCommandCenterCallbacks
): HTMLElement {
  const {
    gameState,
    playerFactionId,
    campaignStarted,
    hasPendingEvent,
    pendingEventCount,
    situations: providedSituations,
  } = options;

  const faction = gameState.factions[playerFactionId];
  if (!faction) {
    return div({ className: 'command-center', text: 'No faction selected' });
  }

  // Generate situations if not provided
  const situations = providedSituations ?? generateStrategicSituations(faction, gameState);

  const container = div({ className: 'command-center' });

  // Compact turn header bar: date left, turn number center, advance button right
  const turnBar = div({ className: 'command-center__turn-bar' });

  const turnDate = span({
    className: 'command-center__turn-date',
    text: formatTurnDate(gameState.year, gameState.quarter),
  });
  turnBar.appendChild(turnDate);

  const turnNumber = span({
    className: 'command-center__turn-number',
    text: formatTurnNumber(gameState.turn),
  });
  turnBar.appendChild(turnNumber);

  // Advance button inline in the turn bar
  const buttonText = getAdvanceButtonText(campaignStarted, hasPendingEvent, gameState.gameOver);
  const isDisabled = !campaignStarted || gameState.gameOver;
  const advanceBtn = el('button', {
    className: 'command-center__advance-btn',
  }) as HTMLButtonElement;
  advanceBtn.textContent = buttonText;
  advanceBtn.disabled = isDisabled;
  turnBar.appendChild(advanceBtn);

  container.appendChild(turnBar);

  // Main content area (2-column: situations + right sidebar)
  const mainContent = div({ className: 'command-center__main' });

  // Left column: Situations (the main game content)
  const leftCol = div({ className: 'command-center__left-col' });
  leftCol.appendChild(createDirectiveLockerPanel(
    options.lockedDirectives ?? [],
    options.allowedActions ?? [],
    callbacks,
  ));
  leftCol.appendChild(createTurnReviewSection(
    options.actionDossier ?? [],
    options.pendingActionReviewCount ?? 0,
    faction.name,
    options.fullLogEntries ?? [],
    callbacks.onOpenActionReview,
  ));
  leftCol.appendChild(createAgiFrontierMap(gameState, playerFactionId));
  leftCol.appendChild(createSituationsSection(situations, callbacks.onSuggestedAction));
  mainContent.appendChild(leftCol);

  // Right column: Stats + Victory (tighter)
  const rightCol = div({ className: 'command-center__right-col' });
  rightCol.appendChild(createFactionStats(faction));
  rightCol.appendChild(createVictorySection(gameState, playerFactionId));
  mainContent.appendChild(rightCol);

  container.appendChild(mainContent);

  // Directive input
  container.appendChild(createDirectiveInput(
    options.directiveText || '',
    callbacks.onDirectiveSubmit,
  ));

  // Action bar at bottom
  container.appendChild(createActionButtons(
    hasPendingEvent,
    pendingEventCount,
    options.pendingActionReviewCount ?? 0,
    options.commsUnreadCount ?? 0,
    callbacks,
  ));

  // Narrative timeline
  container.appendChild(createNarrativeTimeline(options.narrativeFeed || []));

  return container;
}

export const EXPANDED_COMMAND_CENTER_STYLES = `
/* Expanded Command Center - v3 Intelligence Briefing Layout */
.command-center {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Turn Bar — compact single row */
.command-center__turn-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 32px;
  border-bottom: 1px solid var(--line);
  flex-shrink: 0;
  background: var(--panel, #fff);
}

.command-center__turn-date {
  font-family: var(--serif, 'IBM Plex Serif', Georgia, serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: -0.02em;
  line-height: 1;
}

.command-center__turn-number {
  font-size: 11px;
  color: var(--text-3, var(--muted));
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  letter-spacing: 0.04em;
}

.command-center__advance-btn {
  margin-left: auto;
  padding: 10px 24px;
  background: var(--accent);
  border: none;
  border-radius: 2px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  cursor: pointer;
  transition: background 0.1s;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.command-center__advance-btn:hover:not(:disabled) {
  background: var(--accent-bright);
}

.command-center__advance-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Main Content Grid — situations take most space */
.command-center__main {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.command-center__left-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding: 20px 32px;
  position: relative;
}

.command-center__right-col {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-left: 1px solid var(--line);
  overflow-y: auto;
  background: var(--bg-warm, #eae7e1);
}

.command-center__directive-locker {
  border: 1px solid var(--line);
  background: var(--panel, #fff);
  padding: 14px;
}

.command-center__directive-group {
  margin-bottom: 12px;
}

.command-center__directive-subtitle {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--text-3, var(--muted));
  margin-bottom: 6px;
}

.command-center__directive-empty {
  border: 1px dashed var(--line);
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-3, var(--muted));
}

.command-center__directive-locked-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-center__directive-locked-card {
  border: 1px solid var(--line);
  background: var(--panel-soft, #f8f6f2);
  padding: 8px 10px;
}

.command-center__directive-locked-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.command-center__directive-locked-slot {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3, var(--muted));
}

.command-center__directive-locked-tag {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1d5a3d;
  background: rgba(29, 90, 61, 0.12);
  padding: 2px 6px;
}

.command-center__directive-locked-text {
  font-size: 13px;
  line-height: 1.4;
  color: var(--ink);
  margin-bottom: 6px;
}

.command-center__directive-locked-controls {
  display: flex;
  gap: 6px;
}

.command-center__directive-locked-btn {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 5px 8px;
  cursor: pointer;
}

.command-center__directive-locked-btn--danger {
  color: var(--danger, #8b2020);
}

.command-center__directive-available-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.command-center__directive-available-tag {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.9);
  color: var(--text-2, #4a4a4a);
  padding: 4px 7px;
  font-size: 10px;
}

.command-center__directive-available-tag--targeted {
  border-color: rgba(122, 60, 18, 0.35);
  color: #7a3c12;
  background: rgba(122, 60, 18, 0.08);
}

.command-center__agi-map {
  border: 1px solid var(--line);
  background: var(--panel-soft, #f8f6f2);
  padding: 14px 14px 12px;
}


.command-center__agi-map-summary {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-3, var(--muted));
  margin-bottom: 10px;
}

.command-center__agi-milestones {
  position: relative;
  height: 28px;
  margin: 0 6px 8px;
  border-top: 1px dashed rgba(0, 0, 0, 0.2);
}

.command-center__agi-milestone {
  position: absolute;
  top: -10px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.command-center__agi-milestone-tick {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  color: var(--text-4, #8a847d);
  line-height: 1;
}

.command-center__agi-milestone-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  letter-spacing: 0.04em;
  color: var(--text-4, #8a847d);
  text-transform: uppercase;
  white-space: nowrap;
}

.command-center__agi-race-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.command-center__agi-race-row {
  display: grid;
  grid-template-columns: 130px 1fr 36px;
  gap: 8px;
  align-items: center;
}

.command-center__agi-race-row--player {
  background: rgba(22, 71, 52, 0.08);
  border: 1px solid rgba(22, 71, 52, 0.2);
  padding: 6px 8px;
}

.command-center__agi-race-label {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.command-center__agi-race-name {
  font-size: 11px;
  color: var(--ink);
  font-weight: 600;
}

.command-center__agi-race-you {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
}

.command-center__agi-race-breakthrough {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #325b89;
  background: rgba(50, 91, 137, 0.1);
  padding: 1px 4px;
}

.command-center__agi-race-track {
  position: relative;
  height: 8px;
  background: rgba(0, 0, 0, 0.08);
  border: 1px solid rgba(0, 0, 0, 0.12);
  overflow: visible;
}

.command-center__agi-race-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--race-color);
  opacity: 0.58;
}

.command-center__agi-race-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  color: var(--race-color);
  font-size: 11px;
  line-height: 1;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.2);
}

.command-center__agi-race-marker--breakthrough {
  color: #1f4f7d;
}

.command-center__agi-race-value {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 11px;
  text-align: right;
  color: var(--ink);
}

.command-center__agi-readiness {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.command-center__agi-readiness-item {
  border: 1px solid var(--line);
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.7);
}

.command-center__agi-readiness-item--ready {
  border-color: rgba(29, 88, 62, 0.35);
}

.command-center__agi-readiness-item--tracking {
  border-color: rgba(109, 82, 24, 0.28);
}

.command-center__agi-readiness-item--lagging {
  border-color: rgba(130, 36, 36, 0.24);
}

.command-center__agi-readiness-row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  margin-bottom: 4px;
}

.command-center__agi-readiness-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-3, var(--muted));
}

.command-center__agi-readiness-value {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  color: var(--ink);
}

.command-center__agi-readiness-meter {
  height: 5px;
  background: rgba(0, 0, 0, 0.08);
}

.command-center__agi-readiness-fill {
  height: 100%;
  background: var(--accent);
}

/* Custom scrollbar */
.command-center__left-col::-webkit-scrollbar,
.command-center__right-col::-webkit-scrollbar {
  width: 3px;
}
.command-center__left-col::-webkit-scrollbar-track,
.command-center__right-col::-webkit-scrollbar-track {
  background: transparent;
}
.command-center__left-col::-webkit-scrollbar-thumb,
.command-center__right-col::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
}

/* Section Headers */
.command-center__section-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--line);
}

.command-center__section-title {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

/* Strategic Situations — the main game content */
.command-center__situations {
  flex: 1;
}

.command-center__dossier {
  margin-bottom: 14px;
}

.command-center__turn-review {
  border: 1px solid var(--line);
  background: var(--panel-soft, #f8f6f2);
  padding: 14px;
}

.command-center__review-lanes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.command-center__review-lane {
  min-width: 0;
}

.command-center__dossier-intro {
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-3, var(--muted));
  margin-bottom: 8px;
}

.command-center__dossier-review-btn {
  border: 1px solid var(--accent);
  background: rgba(22, 71, 52, 0.08);
  color: var(--accent);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 8px 10px;
  margin-bottom: 10px;
  cursor: pointer;
}

.command-center__dossier-review-btn:hover {
  background: rgba(22, 71, 52, 0.14);
}

.command-center__dossier-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.command-center__dossier-card {
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  background: rgba(255, 255, 255, 0.64);
  padding: 10px 12px;
}

.command-center__dossier-card--player {
  border-left-color: #1f5a40;
  background: rgba(31, 90, 64, 0.08);
}

.command-center__dossier-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.command-center__dossier-actor {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3, var(--muted));
}

.command-center__dossier-tag {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 6px;
}

.command-center__dossier-tag--open {
  color: #1f5a40;
  background: rgba(31, 90, 64, 0.1);
}

.command-center__dossier-tag--secret {
  color: #7a3c12;
  background: rgba(122, 60, 18, 0.1);
}

.command-center__dossier-source {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 6px;
  border: 1px solid var(--line);
}

.command-center__dossier-source--llm {
  color: #1f4f7d;
  background: rgba(31, 79, 125, 0.1);
}

.command-center__dossier-source--deterministic {
  color: #1e4b35;
  background: rgba(30, 75, 53, 0.1);
}

.command-center__dossier-source--error {
  color: #8b2020;
  background: rgba(139, 32, 32, 0.12);
}

.command-center__dossier-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.command-center__dossier-summary {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.35;
  color: #3f3b35;
}

.command-center__dossier-intel {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--line);
  font-size: 11px;
  color: #59544d;
}

.command-center__dossier-empty {
  border: 1px dashed var(--line);
  padding: 10px;
  font-size: 12px;
  color: var(--text-3, var(--muted));
}

.command-center__review-log {
  margin-top: 4px;
  padding: 10px;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.72);
  max-height: 280px;
}

.command-center__review-log-details {
  margin-top: 8px;
  border-top: 1px dashed var(--line);
  padding-top: 8px;
}

.command-center__review-log-summary {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  cursor: pointer;
  user-select: none;
}

.command-center__review-log-full {
  margin-top: 8px;
  max-height: 180px;
  overflow-y: auto;
}

.command-center__situations-empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}

.command-center__situations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.command-center__situation-card {
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 20px 24px;
  transition: border-color 0.1s;
  position: relative;
}

.command-center__situation-card:hover {
  border-color: rgba(0, 0, 0, 0.12);
}

.command-center__situation-card--high {
  border-left: 3px solid var(--danger, #8b2020);
}

.command-center__situation-card--medium {
  border-left: 3px solid var(--warning, #8b6914);
}

.command-center__situation-card--low {
  border-left: 3px solid var(--green-mid, #2d5a42);
}

.command-center__situation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.command-center__situation-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--ink);
}

.command-center__situation-urgency {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 1px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.command-center__situation-urgency--high {
  background: var(--danger-bg, rgba(139, 32, 32, 0.06));
  color: var(--danger, #8b2020);
}

.command-center__situation-urgency--medium {
  background: var(--warning-bg, rgba(139, 105, 20, 0.06));
  color: var(--warning, #8b6914);
}

.command-center__situation-urgency--low {
  background: var(--green-bg, rgba(26, 58, 42, 0.06));
  color: var(--green-mid, #2d5a42);
}

.command-center__situation-desc {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
}

.command-center__situation-responses {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.command-center__response-btn {
  padding: 7px 14px;
  font-size: 12px;
  font-weight: 500;
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
  color: var(--text-2, #4a4a4a);
  cursor: pointer;
  transition: all 0.1s;
}

.command-center__response-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

/* Faction Stats — right sidebar */
.command-center__faction-stats {
  padding: 16px;
  border-bottom: 1px solid var(--line);
}

.command-center__stats-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
}

.command-center__stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--panel, #fff);
  border: 1px solid var(--line);
  border-radius: 2px;
}

.command-center__stat-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 8px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.command-center__stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
}

/* Victory Progress — right sidebar */
.command-center__victory {
  padding: 16px;
}

.command-center__victory-bars {
  margin-top: 8px;
}

/* Action Bar — bottom of command center */
.command-center__actions {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}

.command-center__action-btn {
  flex: 1;
  padding: 12px 16px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--line);
  border-radius: 0;
  color: var(--text-3, var(--muted));
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.command-center__action-btn:last-child {
  border-right: none;
}

.command-center__action-btn:hover {
  background: var(--panel, #fff);
  color: var(--accent);
}

.command-center__action-btn--tech:hover {
  color: var(--accent);
}

.command-center__action-btn--event {
  color: var(--danger);
}

.command-center__action-btn--event:hover {
  background: var(--danger-bg, rgba(139, 32, 32, 0.06));
}

.command-center__action-btn--review {
  color: var(--accent);
}

.command-center__action-btn--review:hover {
  background: rgba(22, 71, 52, 0.08);
}

.command-center__action-icon {
  font-size: 15px;
}

.command-center__event-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--danger);
  color: white;
  border-radius: 1px;
  font-size: 9px;
  font-weight: 700;
}

.command-center__comms-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--accent);
  color: white;
  border-radius: 1px;
  font-size: 9px;
  font-weight: 700;
}

/* Action bar background */
.command-center__actions {
  background: var(--bg-warm, #eae7e1);
}

/* Directive Input */
.command-center__directive {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 32px;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
  background: var(--bg-warm, #eae7e1);
}

.command-center__directive-label {
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-3, var(--muted));
  text-transform: uppercase;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.command-center__directive-wrapper {
  display: flex;
  flex: 1;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 2px;
  overflow: hidden;
  background: var(--panel, #fff);
}

.command-center__directive-input {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-family: var(--font, 'IBM Plex Sans', sans-serif);
  outline: none;
}

.command-center__directive-input::placeholder {
  color: var(--text-4, #aaa);
}

.command-center__directive-submit {
  padding: 8px 14px;
  background: var(--accent);
  border: none;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.1s;
}

.command-center__directive-submit:hover {
  background: var(--accent-bright);
}

/* Narrative timeline */
.command-center__narrative {
  padding: 12px 32px;
  flex-shrink: 0;
  border-top: 1px solid var(--line);
  max-height: 170px;
  overflow-y: auto;
}

.command-center__narrative-list {
  margin: 0;
  padding-left: 20px;
  display: grid;
  gap: 6px;
}

.command-center__narrative-item {
  font-size: 11px;
  color: var(--ink);
  line-height: 1.45;
  font-family: var(--mono, 'IBM Plex Mono', monospace);
}

.command-center__narrative-item--empty {
  list-style: none;
  margin-left: -20px;
  color: var(--text-4, #aaa);
  font-style: italic;
}

/* Recent Log */
.command-center__log {
  padding: 12px 32px;
  flex-shrink: 0;
  border-top: 1px solid var(--line);
  max-height: 120px;
  overflow-y: auto;
}

.command-center__log-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.command-center__log-item {
  font-size: 11px;
  color: var(--muted);
  padding: 3px 0;
  border-bottom: 1px solid var(--line);
  font-family: var(--mono, 'IBM Plex Mono', monospace);
}

.command-center__log-item:last-child {
  border-bottom: none;
}

.command-center__log-item--empty {
  color: var(--text-4, #aaa);
  font-style: italic;
}

/* Footer */
.command-center__footer {
  display: flex;
  gap: 0;
  border-top: 1px solid var(--line);
  flex-shrink: 0;
}

.command-center__footer-btn {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--line);
  color: var(--text-4, #aaa);
  font-size: 10px;
  font-family: var(--mono, 'IBM Plex Mono', monospace);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.1s;
}

.command-center__footer-btn:last-child {
  border-right: none;
}

.command-center__footer-btn:hover {
  background: var(--panel, #fff);
  color: var(--ink);
}

/* Responsive */
@media (max-width: 768px) {
  .command-center__main {
    grid-template-columns: 1fr;
  }

  .command-center__right-col {
    border-left: none;
    border-top: 1px solid var(--line);
  }

  .command-center__turn-date {
    font-size: 18px;
  }

  .command-center__agi-race-row {
    grid-template-columns: 100px 1fr 30px;
  }

  .command-center__agi-milestone-label {
    font-size: 7px;
  }

  .command-center__agi-readiness {
    grid-template-columns: 1fr;
  }

  .command-center__review-lanes {
    grid-template-columns: 1fr;
  }
}
`;
