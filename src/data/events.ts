import type { BranchId, GameState, ResourceKey } from '../core/types.js';
import {
  EXPANDED_EVENTS,
  selectExpandedEvent,
  type ExpandedEventDefinition,
  type EventCategory,
  type EventCondition,
} from './eventsExpanded.js';

export type EventEffect =
  | {
      kind: 'resource';
      target: 'faction' | 'all_labs' | 'all_factions';
      key: ResourceKey;
      delta: number;
    }
  | {
      kind: 'score';
      target: 'faction' | 'all_labs' | 'all_factions';
      key: 'capabilityScore' | 'safetyScore';
      delta: number;
    }
  | {
      kind: 'stat';
      target: 'faction' | 'all_labs' | 'all_factions';
      key: 'safetyCulture' | 'opsec';
      delta: number;
    }
  | {
      kind: 'research';
      target: 'faction';
      branch: BranchId;
      delta: number;
    }
  | {
      kind: 'globalSafety';
      delta: number;
    }
  | {
      kind: 'exposure';
      target: 'faction';
      delta: number;
    };

export type EventChoice = {
  id: string;
  label: string;
  description: string;
  effects: EventEffect[];
};

export type EventDefinition = {
  id: string;
  title: string;
  description: string;
  weight: number;
  minTurn?: number;
  maxTurn?: number;
  category?: EventCategory;
  cooldown?: number;
  conditions?: EventCondition[];
  choices: EventChoice[];
};

// Re-export expanded event types and utilities
export { EXPANDED_EVENTS, selectExpandedEvent, type ExpandedEventDefinition, type EventCategory, type EventCondition };

export const EVENTS: EventDefinition[] = [
  {
    id: 'supply_shock',
    title: 'Supply Chain Shock',
    description:
      'A sudden export clampdown tightens access to advanced accelerators. Compute prices spike across the board.',
    weight: 1.2,
    choices: [
      {
        id: 'lobby_exemptions',
        label: 'Lobby for exemptions',
        description: 'Spend influence and capital to secure limited exemptions.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: -4 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 6 },
        ],
      },
      {
        id: 'domestic_build',
        label: 'Shift to domestic buildout',
        description: 'Pay the premium to secure domestic supply lines.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -10 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
        ],
      },
      {
        id: 'pause_scaling',
        label: 'Pause scaling',
        description: 'Slow expansion and redirect effort to safety and efficiency.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'alignment_incident',
    title: 'Alignment Incident',
    description:
      'A deployed model exhibits unsafe goal pursuit. Media attention spikes; regulators are watching.',
    weight: 1.1,
    choices: [
      {
        id: 'full_transparency',
        label: 'Full transparency',
        description: 'Openly share details and issue a public safety response.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
      {
        id: 'contain_quietly',
        label: 'Contain quietly',
        description: 'Patch internally and keep the incident out of headlines.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -5 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 4 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -2 },
        ],
      },
      {
        id: 'suspend_deployments',
        label: 'Suspend deployments',
        description: 'Freeze releases while safety investigations complete.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 7 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
        ],
      },
    ],
  },
  {
    id: 'breakthrough_rumor',
    title: 'Breakthrough Rumor',
    description:
      'Leaked hints suggest a rival is close to a major capability jump. Investors are restless.',
    weight: 1.0,
    choices: [
      {
        id: 'accelerate_training',
        label: 'Accelerate training',
        description: 'Push compute to match the rumored surge.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: -4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 6 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -3 },
        ],
      },
      {
        id: 'joint_review',
        label: 'Joint safety review',
        description: 'Invite external safety teams to assess the risk.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
      {
        id: 'ignore_rumor',
        label: 'Ignore the rumor',
        description: 'Stay the course and avoid overreaction.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'funding_surge',
    title: 'Funding Surge',
    description:
      'A wave of capital looks for safe returns in frontier AI. Terms are aggressive but flexible.',
    weight: 0.9,
    choices: [
      {
        id: 'invest_compute',
        label: 'Expand compute',
        description: 'Allocate new funding to infrastructure buildout.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 8 },
        ],
      },
      {
        id: 'hire_safety',
        label: 'Hire safety team',
        description: 'Use the capital to expand alignment headcount.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: 5 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
        ],
      },
      {
        id: 'policy_push',
        label: 'Policy push',
        description: 'Route funding into lobbying and standards influence.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'global_summit',
    title: 'Global Safety Summit',
    description:
      'Governments propose a binding safety summit to slow capability races.',
    weight: 1.0,
    choices: [
      {
        id: 'sign_pact',
        label: 'Sign the pact',
        description: 'Commit to mutual inspections and safety standards.',
        effects: [
          { kind: 'globalSafety', delta: 4 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
      {
        id: 'no_commitment',
        label: 'No commitment',
        description: 'Avoid binding rules; keep options open.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: -2 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 2 },
        ],
      },
      {
        id: 'demand_audits',
        label: 'Demand audits',
        description: 'Push for enforceable audits before agreeing.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 2 },
        ],
      },
    ],
  },
];

/**
 * Legacy event selection - selects from EVENTS list
 * @deprecated Use selectExpandedEvent for the full event system
 */
export const selectEvent = (
  state: GameState,
  rng: () => number,
  history: string[],
): EventDefinition | null => {
  if (rng() > 0.45) return null;
  const eligible = EVENTS.filter((event) => {
    if (event.minTurn !== undefined && state.turn < event.minTurn) return false;
    if (event.maxTurn !== undefined && state.turn > event.maxTurn) return false;
    const recent = history.slice(-3);
    return !recent.includes(event.id);
  });

  if (!eligible.length) return null;
  const totalWeight = eligible.reduce((sum, event) => sum + event.weight, 0);
  let roll = rng() * totalWeight;
  for (const event of eligible) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return eligible[eligible.length - 1];
};

/**
 * Enhanced event selection using the expanded event system
 * Combines legacy events with the new expanded events for a richer experience
 */
export const selectSmartEvent = (
  state: GameState,
  factionId: string,
  rng: () => number,
  eventHistory: Array<{ eventId: string; turn: number }>,
): EventDefinition | null => {
  // Use the expanded event system with smarter selection logic
  const expandedEvent = selectExpandedEvent(state, factionId, rng, eventHistory);

  if (expandedEvent) {
    // Convert ExpandedEventDefinition to EventDefinition for compatibility
    return {
      id: expandedEvent.id,
      title: expandedEvent.title,
      description: expandedEvent.description,
      weight: expandedEvent.weight,
      category: expandedEvent.category,
      cooldown: expandedEvent.cooldown,
      conditions: expandedEvent.conditions,
      choices: expandedEvent.choices,
    };
  }

  return null;
};

/**
 * Get events filtered by category
 */
export const getEventsByCategory = (category: EventCategory): ExpandedEventDefinition[] => {
  return EXPANDED_EVENTS.filter(event => event.category === category);
};

/**
 * Get event statistics for the expanded event system
 */
export const getEventStats = () => {
  const categories: Record<EventCategory, number> = {
    capability: 0,
    safety: 0,
    geopolitical: 0,
    economic: 0,
    lab_drama: 0,
  };

  for (const event of EXPANDED_EVENTS) {
    categories[event.category]++;
  }

  return {
    total: EXPANDED_EVENTS.length,
    byCategory: categories,
  };
};
