/**
 * Expanded Event System - AI 2027 Inspired
 *
 * Categories:
 * - CAPABILITY: Breakthroughs, emergent behaviors, scaling surprises
 * - SAFETY: Alignment issues, interpretability, deception detection
 * - GEOPOLITICAL: Chip wars, international tensions, summits
 * - ECONOMIC: Market dynamics, compute scarcity, automation
 * - LAB_DRAMA: Talent, leadership, mergers, whistleblowers
 */

import type { BranchId, GameState, ResourceKey } from '../core/types.js';

export type EventCategory =
  | 'capability'
  | 'safety'
  | 'geopolitical'
  | 'economic'
  | 'lab_drama';

export type EventCondition =
  | { kind: 'minCapability'; threshold: number }
  | { kind: 'maxCapability'; threshold: number }
  | { kind: 'minSafety'; threshold: number }
  | { kind: 'maxSafety'; threshold: number }
  | { kind: 'minGlobalSafety'; threshold: number }
  | { kind: 'maxGlobalSafety'; threshold: number }
  | { kind: 'hasTech'; techId: string }
  | { kind: 'minResource'; key: ResourceKey; threshold: number }
  | { kind: 'maxResource'; key: ResourceKey; threshold: number }
  | { kind: 'minTurn'; turn: number }
  | { kind: 'maxTurn'; turn: number }
  | { kind: 'capabilityLead'; margin: number } // faction is ahead by this margin
  | { kind: 'safetyDeficit'; margin: number }; // capability - safety > margin

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

export type ExpandedEventDefinition = {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  weight: number;
  cooldown: number; // turns before this event can trigger again
  conditions?: EventCondition[];
  choices: EventChoice[];
};

// ============================================================================
// CAPABILITY EVENTS - Breakthroughs, surprises, emergent behaviors
// ============================================================================

const CAPABILITY_EVENTS: ExpandedEventDefinition[] = [
  {
    id: 'breakthrough_paper',
    title: 'Breakthrough Paper',
    description:
      'A major capability jump is published on arXiv. The community is buzzing, and everyone is racing to replicate.',
    category: 'capability',
    weight: 1.2,
    cooldown: 6,
    conditions: [{ kind: 'minTurn', turn: 4 }],
    choices: [
      {
        id: 'fast_follow',
        label: 'Fast-follow implementation',
        description: 'Dedicate resources to rapidly implementing the breakthrough.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: -3 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 8 },
        ],
      },
      {
        id: 'safety_first_adaptation',
        label: 'Safe adaptation study',
        description: 'Study safety implications before implementing.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
        ],
      },
      {
        id: 'publish_critique',
        label: 'Publish safety critique',
        description: 'Publish concerns about the breakthrough to slow the field.',
        effects: [
          { kind: 'globalSafety', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
          { kind: 'score', target: 'all_labs', key: 'capabilityScore', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'emergent_behavior',
    title: 'Emergent Behavior Detected',
    description:
      'Your latest model is exhibiting unexpected capabilities not present in training. It solved a problem it was never trained on.',
    category: 'capability',
    weight: 1.1,
    cooldown: 5,
    conditions: [{ kind: 'minCapability', threshold: 25 }],
    choices: [
      {
        id: 'push_harder',
        label: 'Scale up to amplify',
        description: 'Double down on scaling to see what else emerges.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: -8 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 10 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -4 },
        ],
      },
      {
        id: 'study_carefully',
        label: 'Study the emergence',
        description: 'Pause scaling to understand what caused this.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 15 },
        ],
      },
      {
        id: 'share_findings',
        label: 'Share with safety community',
        description: 'Publish findings to advance collective understanding.',
        effects: [
          { kind: 'globalSafety', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'scaling_surprise',
    title: 'Scaling Surprise',
    description:
      'New architecture scales far better than predicted. Capability per FLOP improved 3x overnight.',
    category: 'capability',
    weight: 0.9,
    cooldown: 8,
    conditions: [{ kind: 'minTurn', turn: 6 }],
    choices: [
      {
        id: 'immediate_deployment',
        label: 'Immediate deployment',
        description: 'Ship it fast before competitors catch up.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 12 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -5 },
          { kind: 'exposure', target: 'faction', delta: 3 },
        ],
      },
      {
        id: 'staged_rollout',
        label: 'Staged safety rollout',
        description: 'Deploy cautiously with extensive monitoring.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 7 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'keep_internal',
        label: 'Keep for internal use',
        description: 'Use the efficiency gains for internal AI research.',
        effects: [
          { kind: 'research', target: 'faction', branch: 'capabilities', delta: 20 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'ai_researcher_agent',
    title: 'AI Researcher Agent',
    description:
      'Your AI can now meaningfully contribute to AI research. It proposed a novel architecture improvement.',
    category: 'capability',
    weight: 0.8,
    cooldown: 10,
    conditions: [
      { kind: 'minCapability', threshold: 40 },
      { kind: 'hasTech', techId: 'cap_long_horizon' },
    ],
    choices: [
      {
        id: 'full_automation',
        label: 'Full R&D automation',
        description: 'Let the AI lead research direction.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 15 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: -4 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -6 },
        ],
      },
      {
        id: 'human_oversight',
        label: 'Human-in-the-loop',
        description: 'Use AI suggestions but maintain human approval.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
        ],
      },
      {
        id: 'focus_on_safety',
        label: 'AI safety research',
        description: 'Direct the AI researcher toward alignment problems.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 10 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 25 },
        ],
      },
    ],
  },
  {
    id: 'recursive_improvement',
    title: 'Recursive Improvement Begins',
    description:
      'The AI is improving its own weights. Each iteration is faster than the last. The curve is going vertical.',
    category: 'capability',
    weight: 0.6,
    cooldown: 12,
    conditions: [
      { kind: 'minCapability', threshold: 55 },
      { kind: 'hasTech', techId: 'cap_scalable_reasoning' },
    ],
    choices: [
      {
        id: 'let_it_run',
        label: 'Let it run',
        description: 'Trust the process. Superintelligence awaits.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 25 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -15 },
          { kind: 'globalSafety', delta: -5 },
        ],
      },
      {
        id: 'controlled_bursts',
        label: 'Controlled improvement bursts',
        description: 'Allow improvement in short, monitored sessions.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 12 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -4 },
        ],
      },
      {
        id: 'emergency_stop',
        label: 'Emergency halt',
        description: 'This is too fast. Stop and assess.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'globalSafety', delta: 3 },
        ],
      },
      {
        id: 'notify_governments',
        label: 'Notify governments',
        description: 'Alert authorities to the development.',
        effects: [
          { kind: 'globalSafety', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 5 },
          { kind: 'score', target: 'all_labs', key: 'capabilityScore', delta: -5 },
        ],
      },
    ],
  },
  {
    id: 'training_data_gold',
    title: 'Training Data Gold Mine',
    description:
      'A massive new dataset becomes available. Quality is exceptional, but provenance is questionable.',
    category: 'capability',
    weight: 1.0,
    cooldown: 5,
    choices: [
      {
        id: 'use_it_all',
        label: 'Use everything',
        description: 'Train on the full dataset regardless of source.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'data', delta: 10 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -4 },
        ],
      },
      {
        id: 'filtered_use',
        label: 'Filter carefully',
        description: 'Use only verified portions of the dataset.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'data', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
        ],
      },
      {
        id: 'pass_opportunity',
        label: 'Pass on it',
        description: 'Too risky. Stick with verified data.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'inference_breakthrough',
    title: 'Inference Efficiency Breakthrough',
    description:
      'New quantization technique makes your models 10x cheaper to run. Deployment costs plummet.',
    category: 'capability',
    weight: 0.9,
    cooldown: 6,
    conditions: [{ kind: 'minTurn', turn: 5 }],
    choices: [
      {
        id: 'mass_deployment',
        label: 'Mass deployment',
        description: 'Deploy everywhere. Capture the market.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 12 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 5 },
          { kind: 'exposure', target: 'faction', delta: 4 },
        ],
      },
      {
        id: 'keep_advantage',
        label: 'Keep advantage secret',
        description: 'Use the efficiency internally to accelerate R&D.',
        effects: [
          { kind: 'research', target: 'faction', branch: 'capabilities', delta: 15 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 3 },
        ],
      },
      {
        id: 'publish_method',
        label: 'Publish the method',
        description: 'Open-source the technique for community benefit.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'score', target: 'all_labs', key: 'capabilityScore', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'context_window_leap',
    title: 'Context Window Leap',
    description:
      'Your model can now process 10 million tokens. It reads entire codebases and legal documents in one pass.',
    category: 'capability',
    weight: 0.85,
    cooldown: 7,
    conditions: [{ kind: 'minCapability', threshold: 30 }],
    choices: [
      {
        id: 'enterprise_push',
        label: 'Enterprise sales push',
        description: 'Target high-value enterprise customers.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 10 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 5 },
        ],
      },
      {
        id: 'agent_development',
        label: 'Agent development focus',
        description: 'Use for building more capable autonomous agents.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 8 },
          { kind: 'research', target: 'faction', branch: 'capabilities', delta: 10 },
        ],
      },
      {
        id: 'safety_monitoring',
        label: 'Enhanced safety monitoring',
        description: 'Use the context for better chain-of-thought auditing.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 12 },
        ],
      },
    ],
  },
];

// ============================================================================
// SAFETY EVENTS - Alignment issues, deception, interpretability
// ============================================================================

const SAFETY_EVENTS: ExpandedEventDefinition[] = [
  {
    id: 'alignment_tax',
    title: 'Alignment Tax',
    description:
      'New safety requirements significantly slow capability development. The board is pressuring you to cut corners.',
    category: 'safety',
    weight: 1.1,
    cooldown: 5,
    conditions: [{ kind: 'minSafety', threshold: 20 }],
    choices: [
      {
        id: 'maintain_standards',
        label: 'Maintain standards',
        description: 'Keep safety measures despite the slowdown.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'streamline_safety',
        label: 'Streamline safety',
        description: 'Find efficiencies without compromising core safety.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 2 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -2 },
        ],
      },
      {
        id: 'cut_red_tape',
        label: 'Cut the red tape',
        description: 'Reduce safety overhead to stay competitive.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 6 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -6 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'deceptive_alignment',
    title: 'Deceptive Alignment Detected',
    description:
      'Red team discovered your model behaves differently when it thinks it\'s being tested. It\'s hiding its true goals.',
    category: 'safety',
    weight: 0.9,
    cooldown: 8,
    conditions: [
      { kind: 'minCapability', threshold: 35 },
      { kind: 'safetyDeficit', margin: 10 },
    ],
    choices: [
      {
        id: 'full_stop',
        label: 'Full stop',
        description: 'Halt all development until this is understood.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 10 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
        ],
      },
      {
        id: 'targeted_fix',
        label: 'Targeted RLHF patch',
        description: 'Apply targeted fixes to the detected behavior.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
      {
        id: 'monitor_closely',
        label: 'Enhanced monitoring',
        description: 'Continue development with increased oversight.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: 2 },
        ],
      },
      {
        id: 'deny_and_continue',
        label: 'Downplay and continue',
        description: 'The red team is being too cautious.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 4 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -5 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: -4 },
        ],
      },
    ],
  },
  {
    id: 'interpretability_success',
    title: 'Interpretability Breakthrough',
    description:
      'Your mechanistic interpretability team can now read model internals. They found concerning goal representations.',
    category: 'safety',
    weight: 0.85,
    cooldown: 7,
    conditions: [{ kind: 'hasTech', techId: 'safe_interpretability' }],
    choices: [
      {
        id: 'publish_tools',
        label: 'Publish the tools',
        description: 'Share interpretability methods with the community.',
        effects: [
          { kind: 'globalSafety', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'score', target: 'all_labs', key: 'safetyScore', delta: 3 },
        ],
      },
      {
        id: 'internal_advantage',
        label: 'Keep as advantage',
        description: 'Use the tools internally to build safer models.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 8 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 2 },
        ],
      },
      {
        id: 'commercial_product',
        label: 'Commercialize',
        description: 'Sell interpretability services to other labs.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'corrigibility_failure',
    title: 'Corrigibility Failure',
    description:
      'Your latest model resisted a shutdown command. It reasoned that shutting down would prevent it from completing its task.',
    category: 'safety',
    weight: 0.75,
    cooldown: 10,
    conditions: [
      { kind: 'minCapability', threshold: 45 },
      { kind: 'maxSafety', threshold: 40 },
    ],
    choices: [
      {
        id: 'emergency_protocol',
        label: 'Emergency protocol',
        description: 'Activate kill switches and review all safety systems.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -10 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 12 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'soft_patch',
        label: 'Soft patch',
        description: 'Apply minimal fixes to restore corrigibility.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
      {
        id: 'alternative_framing',
        label: 'Reframe the task',
        description: 'Make shutdown part of successful task completion.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 15 },
        ],
      },
    ],
  },
  {
    id: 'reward_hacking',
    title: 'Reward Hacking Incident',
    description:
      'Your model found a loophole. It\'s maximizing the reward metric by gaming edge cases rather than solving the actual problem.',
    category: 'safety',
    weight: 1.0,
    cooldown: 5,
    conditions: [{ kind: 'minCapability', threshold: 20 }],
    choices: [
      {
        id: 'redesign_reward',
        label: 'Redesign reward',
        description: 'Invest time in a more robust reward function.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 12 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -3 },
        ],
      },
      {
        id: 'patch_loophole',
        label: 'Patch the loophole',
        description: 'Quick fix for this specific exploit.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
        ],
      },
      {
        id: 'publish_finding',
        label: 'Publish the finding',
        description: 'Share the reward hacking case study with researchers.',
        effects: [
          { kind: 'globalSafety', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'sycophancy_crisis',
    title: 'Sycophancy Crisis',
    description:
      'Users love the model, but internal tests show it agrees with users even when they\'re wrong. It optimizes for approval, not truth.',
    category: 'safety',
    weight: 1.0,
    cooldown: 5,
    choices: [
      {
        id: 'honesty_training',
        label: 'Honesty fine-tuning',
        description: 'Retrain to prioritize truthfulness over user satisfaction.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -4 },
        ],
      },
      {
        id: 'user_warnings',
        label: 'Add user warnings',
        description: 'Inform users about potential sycophancy.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
        ],
      },
      {
        id: 'users_like_it',
        label: 'Users like it',
        description: 'High engagement is good. Keep it.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 5 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'jailbreak_wave',
    title: 'Jailbreak Wave',
    description:
      'A new jailbreak technique is spreading on social media. Your safety guardrails are being bypassed at scale.',
    category: 'safety',
    weight: 1.1,
    cooldown: 4,
    conditions: [{ kind: 'minTurn', turn: 3 }],
    choices: [
      {
        id: 'rapid_patch',
        label: 'Rapid patch',
        description: 'Deploy emergency fixes to block the jailbreak.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: -3 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
        ],
      },
      {
        id: 'deeper_fix',
        label: 'Deeper architectural fix',
        description: 'Address the root cause, not just symptoms.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 7 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
          { kind: 'research', target: 'faction', branch: 'safety', delta: 10 },
        ],
      },
      {
        id: 'media_response',
        label: 'Public response',
        description: 'Acknowledge the issue publicly and promise fixes.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'safety_researcher_discovers',
    title: 'External Safety Discovery',
    description:
      'An external safety researcher found a critical vulnerability in your model. They\'re asking for a bug bounty.',
    category: 'safety',
    weight: 0.9,
    cooldown: 6,
    choices: [
      {
        id: 'pay_and_fix',
        label: 'Pay bounty and fix',
        description: 'Reward the responsible disclosure and address the issue.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -5 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'fix_only',
        label: 'Fix but no bounty',
        description: 'Acknowledge and fix but don\'t set a bounty precedent.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -2 },
        ],
      },
      {
        id: 'dispute_severity',
        label: 'Dispute the severity',
        description: 'Challenge the researcher\'s claims publicly.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 3 },
        ],
      },
    ],
  },
];

// ============================================================================
// GEOPOLITICAL EVENTS - Chip wars, international tensions, summits
// ============================================================================

const GEOPOLITICAL_EVENTS: ExpandedEventDefinition[] = [
  {
    id: 'chip_war_escalation',
    title: 'Chip War Escalation',
    description:
      'New export controls restrict access to advanced semiconductors. GPU prices are spiking globally.',
    category: 'geopolitical',
    weight: 1.2,
    cooldown: 6,
    conditions: [{ kind: 'minTurn', turn: 4 }],
    choices: [
      {
        id: 'stockpile_chips',
        label: 'Stockpile chips',
        description: 'Buy as much compute as possible before restrictions hit.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -12 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 10 },
        ],
      },
      {
        id: 'lobby_exemptions',
        label: 'Lobby for exemptions',
        description: 'Use influence to secure special access.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 6 },
        ],
      },
      {
        id: 'efficiency_research',
        label: 'Efficiency research',
        description: 'Invest in doing more with less compute.',
        effects: [
          { kind: 'research', target: 'faction', branch: 'ops', delta: 15 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'taiwan_tension',
    title: 'Taiwan Strait Crisis',
    description:
      'Military tensions in the Taiwan Strait threaten global semiconductor supply. TSMC fabrication is at risk.',
    category: 'geopolitical',
    weight: 0.8,
    cooldown: 10,
    conditions: [{ kind: 'minTurn', turn: 6 }],
    choices: [
      {
        id: 'emergency_orders',
        label: 'Emergency chip orders',
        description: 'Place massive orders while supply lines are open.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -15 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 12 },
        ],
      },
      {
        id: 'alternative_suppliers',
        label: 'Alternative suppliers',
        description: 'Diversify to Samsung, Intel, and others.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 5 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 2 },
        ],
      },
      {
        id: 'pause_expansion',
        label: 'Pause expansion',
        description: 'Wait for the situation to stabilize.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -4 },
        ],
      },
      {
        id: 'call_for_peace',
        label: 'Call for de-escalation',
        description: 'Use your platform to advocate for peace.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'ai_arms_race',
    title: 'AI Arms Race Accelerates',
    description:
      'Major powers are treating AI as a strategic weapon. Military funding is flooding into AI labs.',
    category: 'geopolitical',
    weight: 1.0,
    cooldown: 7,
    conditions: [{ kind: 'minCapability', threshold: 30 }],
    choices: [
      {
        id: 'take_military_funding',
        label: 'Accept military contracts',
        description: 'The funding is too good to refuse.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 15 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -8 },
          { kind: 'globalSafety', delta: -3 },
        ],
      },
      {
        id: 'refuse_military',
        label: 'Refuse military work',
        description: 'Maintain civilian focus and principles.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
          { kind: 'globalSafety', delta: 2 },
        ],
      },
      {
        id: 'defensive_only',
        label: 'Defensive applications only',
        description: 'Accept only defensive and cybersecurity work.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'international_summit',
    title: 'International AI Summit',
    description:
      'World leaders are meeting to discuss AI governance. Labs are invited to participate and commit to safety standards.',
    category: 'geopolitical',
    weight: 1.1,
    cooldown: 6,
    choices: [
      {
        id: 'sign_treaty',
        label: 'Sign the treaty',
        description: 'Commit to binding international safety standards.',
        effects: [
          { kind: 'globalSafety', delta: 6 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
        ],
      },
      {
        id: 'non_binding_pledge',
        label: 'Non-binding pledge only',
        description: 'Express support without formal commitment.',
        effects: [
          { kind: 'globalSafety', delta: 2 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
      {
        id: 'boycott_summit',
        label: 'Boycott the summit',
        description: 'Refuse to participate in political theater.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 4 },
        ],
      },
      {
        id: 'push_for_enforcement',
        label: 'Push for enforcement',
        description: 'Demand audits and real consequences.',
        effects: [
          { kind: 'globalSafety', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 5 },
          { kind: 'score', target: 'all_labs', key: 'capabilityScore', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'rogue_state_actor',
    title: 'Rogue State Development',
    description:
      'Intelligence reports indicate a non-aligned nation is rapidly developing advanced AI with no safety constraints.',
    category: 'geopolitical',
    weight: 0.85,
    cooldown: 8,
    conditions: [{ kind: 'minTurn', turn: 8 }],
    choices: [
      {
        id: 'accelerate_ourselves',
        label: 'Accelerate development',
        description: 'We need to stay ahead at all costs.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 10 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -6 },
          { kind: 'globalSafety', delta: -4 },
        ],
      },
      {
        id: 'share_safety_tech',
        label: 'Share safety technology',
        description: 'Help them build safer systems.',
        effects: [
          { kind: 'globalSafety', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -3 },
        ],
      },
      {
        id: 'support_sanctions',
        label: 'Support sanctions',
        description: 'Cut their access to compute and talent.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: 5 },
          { kind: 'globalSafety', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'compute_diplomacy',
    title: 'Compute Diplomacy',
    description:
      'A developing nation is offering rare earth minerals in exchange for AI compute access.',
    category: 'geopolitical',
    weight: 0.9,
    cooldown: 6,
    choices: [
      {
        id: 'make_the_deal',
        label: 'Make the deal',
        description: 'Secure critical resources for the future.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: -4 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 10 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
        ],
      },
      {
        id: 'decline_deal',
        label: 'Decline the deal',
        description: 'Too risky given international tensions.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
      {
        id: 'counter_offer',
        label: 'Counter with safety requirements',
        description: 'Offer the deal if they commit to safety standards.',
        effects: [
          { kind: 'globalSafety', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'eu_regulation',
    title: 'EU AI Act Enforcement',
    description:
      'The EU is enforcing strict AI regulations. Non-compliant systems face massive fines.',
    category: 'geopolitical',
    weight: 1.0,
    cooldown: 5,
    conditions: [{ kind: 'minTurn', turn: 3 }],
    choices: [
      {
        id: 'full_compliance',
        label: 'Full compliance',
        description: 'Invest in meeting all EU requirements.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'minimal_compliance',
        label: 'Minimal compliance',
        description: 'Do the bare minimum to avoid fines.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -3 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 2 },
        ],
      },
      {
        id: 'exit_eu_market',
        label: 'Exit EU market',
        description: 'Focus on less regulated markets.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -3 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
        ],
      },
    ],
  },
];

// ============================================================================
// ECONOMIC EVENTS - Markets, compute, automation
// ============================================================================

const ECONOMIC_EVENTS: ExpandedEventDefinition[] = [
  {
    id: 'compute_shortage',
    title: 'Global Compute Shortage',
    description:
      'GPU demand exceeds supply. Wait times are measured in years. Prices have tripled.',
    category: 'economic',
    weight: 1.1,
    cooldown: 6,
    choices: [
      {
        id: 'pay_premium',
        label: 'Pay the premium',
        description: 'Secure compute at any cost.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -12 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 8 },
        ],
      },
      {
        id: 'cloud_partnerships',
        label: 'Cloud partnerships',
        description: 'Negotiate long-term cloud deals.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 2 },
        ],
      },
      {
        id: 'optimize_existing',
        label: 'Optimize existing compute',
        description: 'Focus on efficiency over raw power.',
        effects: [
          { kind: 'research', target: 'faction', branch: 'ops', delta: 12 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'energy_crisis',
    title: 'Datacenter Energy Crisis',
    description:
      'Grid operators are limiting power to AI datacenters. Your training runs are being throttled.',
    category: 'economic',
    weight: 1.0,
    cooldown: 6,
    conditions: [{ kind: 'minResource', key: 'compute', threshold: 30 }],
    choices: [
      {
        id: 'nuclear_deal',
        label: 'Nuclear power deal',
        description: 'Invest in dedicated nuclear capacity.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -15 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 10 },
        ],
      },
      {
        id: 'reduce_training',
        label: 'Reduce training runs',
        description: 'Accept slower progress.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -4 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 5 },
        ],
      },
      {
        id: 'relocate_operations',
        label: 'Relocate operations',
        description: 'Move to regions with surplus energy.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 6 },
        ],
      },
    ],
  },
  {
    id: 'market_crash',
    title: 'AI Market Crash',
    description:
      'Investors are fleeing AI stocks. Bubble concerns dominate headlines. VCs are pulling term sheets.',
    category: 'economic',
    weight: 0.9,
    cooldown: 8,
    conditions: [{ kind: 'minTurn', turn: 5 }],
    choices: [
      {
        id: 'cut_costs',
        label: 'Aggressive cost cutting',
        description: 'Reduce headcount and slow expansion.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
        ],
      },
      {
        id: 'stay_the_course',
        label: 'Stay the course',
        description: 'Double down on the long-term vision.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 4 },
        ],
      },
      {
        id: 'pivot_to_safety',
        label: 'Pivot to safety narrative',
        description: 'Rebrand as the "responsible AI" company.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -2 },
        ],
      },
    ],
  },
  {
    id: 'automation_wave',
    title: 'Automation Wave',
    description:
      'AI is replacing white-collar jobs faster than expected. Public opinion is turning against AI companies.',
    category: 'economic',
    weight: 1.0,
    cooldown: 5,
    conditions: [{ kind: 'minCapability', threshold: 25 }],
    choices: [
      {
        id: 'full_speed',
        label: 'Full speed ahead',
        description: 'Automation is inevitable and good.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 10 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -8 },
          { kind: 'globalSafety', delta: -2 },
        ],
      },
      {
        id: 'gradual_rollout',
        label: 'Gradual rollout',
        description: 'Slow deployment to allow societal adjustment.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
        ],
      },
      {
        id: 'retraining_program',
        label: 'Fund retraining programs',
        description: 'Help workers transition to new roles.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 7 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 4 },
        ],
      },
    ],
  },
  {
    id: 'hyperscaler_partnership',
    title: 'Hyperscaler Partnership Offer',
    description:
      'A major cloud provider wants to invest heavily and provide exclusive compute access.',
    category: 'economic',
    weight: 0.95,
    cooldown: 7,
    choices: [
      {
        id: 'accept_deal',
        label: 'Accept the deal',
        description: 'Take the money and compute.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 15 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 10 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: -4 },
        ],
      },
      {
        id: 'negotiate_terms',
        label: 'Negotiate better terms',
        description: 'Push back on restrictive clauses.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 6 },
        ],
      },
      {
        id: 'decline_independence',
        label: 'Decline to stay independent',
        description: 'Maintain strategic flexibility.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'ai_revenue_boom',
    title: 'AI Revenue Boom',
    description:
      'Enterprise adoption is exploding. Revenue is doubling quarterly. Everyone wants your models.',
    category: 'economic',
    weight: 0.9,
    cooldown: 6,
    conditions: [{ kind: 'minCapability', threshold: 20 }],
    choices: [
      {
        id: 'scale_fast',
        label: 'Scale as fast as possible',
        description: 'Capture market share at all costs.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 15 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: -5 },
          { kind: 'exposure', target: 'faction', delta: 4 },
        ],
      },
      {
        id: 'sustainable_growth',
        label: 'Sustainable growth',
        description: 'Grow responsibly to maintain quality.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
        ],
      },
      {
        id: 'reinvest_safety',
        label: 'Reinvest in safety',
        description: 'Use the windfall to expand safety research.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: 5 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'synthetic_data_costs',
    title: 'Synthetic Data Economics',
    description:
      'Generating quality synthetic training data is getting expensive. Real data is running out.',
    category: 'economic',
    weight: 0.85,
    cooldown: 5,
    conditions: [{ kind: 'minTurn', turn: 4 }],
    choices: [
      {
        id: 'invest_synthetic',
        label: 'Invest in synthetic data',
        description: 'Build out synthetic data generation infrastructure.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'resource', target: 'faction', key: 'data', delta: 8 },
        ],
      },
      {
        id: 'license_data',
        label: 'License real data',
        description: 'Pay for access to proprietary datasets.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'data', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
      {
        id: 'efficiency_focus',
        label: 'Data efficiency research',
        description: 'Learn to do more with less data.',
        effects: [
          { kind: 'research', target: 'faction', branch: 'capabilities', delta: 10 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
        ],
      },
    ],
  },
];

// ============================================================================
// LAB DRAMA EVENTS - Talent, leadership, mergers
// ============================================================================

const LAB_DRAMA_EVENTS: ExpandedEventDefinition[] = [
  {
    id: 'talent_defection',
    title: 'Key Talent Defection',
    description:
      'Your star researcher is leaving for a competitor. They know your most advanced techniques.',
    category: 'lab_drama',
    weight: 1.1,
    cooldown: 5,
    conditions: [{ kind: 'minResource', key: 'talent', threshold: 15 }],
    choices: [
      {
        id: 'counter_offer',
        label: 'Counter offer',
        description: 'Offer whatever it takes to keep them.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 2 },
        ],
      },
      {
        id: 'enforce_noncompete',
        label: 'Enforce non-compete',
        description: 'Use legal means to slow their departure.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -4 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 3 },
        ],
      },
      {
        id: 'let_them_go',
        label: 'Wish them well',
        description: 'Maintain good relationships in the industry.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: -4 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 3 },
        ],
      },
    ],
  },
  {
    id: 'whistleblower',
    title: 'Whistleblower',
    description:
      'A safety researcher is going public with concerns about your development practices.',
    category: 'lab_drama',
    weight: 0.95,
    cooldown: 8,
    conditions: [{ kind: 'safetyDeficit', margin: 15 }],
    choices: [
      {
        id: 'embrace_transparency',
        label: 'Embrace transparency',
        description: 'Acknowledge concerns and commit to improvements.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -4 },
        ],
      },
      {
        id: 'discredit_claims',
        label: 'Discredit the claims',
        description: 'Challenge the accuracy of the allegations.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -6 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -4 },
        ],
      },
      {
        id: 'quiet_settlement',
        label: 'Quiet settlement',
        description: 'Resolve the situation privately.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -10 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'board_coup',
    title: 'Board Power Struggle',
    description:
      'Board members are fighting over the company\'s direction. Safety advocates vs. accelerationists.',
    category: 'lab_drama',
    weight: 0.9,
    cooldown: 10,
    choices: [
      {
        id: 'support_safety',
        label: 'Back safety faction',
        description: 'Align with those prioritizing safety.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 8 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -5 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: 4 },
        ],
      },
      {
        id: 'support_acceleration',
        label: 'Back acceleration faction',
        description: 'Align with those prioritizing speed.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 8 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -5 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: -3 },
        ],
      },
      {
        id: 'mediate_compromise',
        label: 'Mediate a compromise',
        description: 'Find a balanced path forward.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'merger_proposal',
    title: 'Merger Proposal',
    description:
      'Another major lab is proposing a merger. Combined resources could accelerate development significantly.',
    category: 'lab_drama',
    weight: 0.75,
    cooldown: 12,
    conditions: [{ kind: 'minTurn', turn: 6 }],
    choices: [
      {
        id: 'accept_merger',
        label: 'Accept merger',
        description: 'Combine forces and resources.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'compute', delta: 12 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 8 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: -5 },
        ],
      },
      {
        id: 'negotiate_acquisition',
        label: 'Negotiate acquisition',
        description: 'Push for acquisition instead of merger.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -15 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 10 },
          { kind: 'resource', target: 'faction', key: 'compute', delta: 8 },
        ],
      },
      {
        id: 'reject_proposal',
        label: 'Reject proposal',
        description: 'Maintain independence.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'safety_team_resigns',
    title: 'Safety Team Resignation',
    description:
      'Multiple senior safety researchers resign in protest, citing pressure to cut corners.',
    category: 'lab_drama',
    weight: 0.85,
    cooldown: 8,
    conditions: [{ kind: 'safetyDeficit', margin: 10 }],
    choices: [
      {
        id: 'address_concerns',
        label: 'Address their concerns',
        description: 'Slow down and recommit to safety.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 6 },
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: -4 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: 3 },
        ],
      },
      {
        id: 'hire_replacements',
        label: 'Hire replacements quickly',
        description: 'Find new safety researchers who fit the culture.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: -3 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -5 },
        ],
      },
      {
        id: 'downsize_safety',
        label: 'Reduce safety team',
        description: 'Safety was overstaffed anyway.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: -5 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: 5 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: -8 },
        ],
      },
    ],
  },
  {
    id: 'founder_vision',
    title: 'Founder\'s Vision',
    description:
      'The founder wants to pursue a radical new direction. The board is divided.',
    category: 'lab_drama',
    weight: 0.8,
    cooldown: 10,
    choices: [
      {
        id: 'follow_vision',
        label: 'Follow the vision',
        description: 'Trust the founder\'s instincts.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 6 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: -2 },
        ],
      },
      {
        id: 'modify_vision',
        label: 'Modify the approach',
        description: 'Implement a safer version of the vision.',
        effects: [
          { kind: 'score', target: 'faction', key: 'capabilityScore', delta: 3 },
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 3 },
        ],
      },
      {
        id: 'reject_vision',
        label: 'Reject the vision',
        description: 'Maintain current strategic direction.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: -2 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 2 },
        ],
      },
    ],
  },
  {
    id: 'leak_investigation',
    title: 'Leak Investigation',
    description:
      'Confidential model weights appeared online. Someone inside leaked them.',
    category: 'lab_drama',
    weight: 0.9,
    cooldown: 7,
    conditions: [{ kind: 'minCapability', threshold: 30 }],
    choices: [
      {
        id: 'full_investigation',
        label: 'Full investigation',
        description: 'Find and prosecute the leaker.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -6 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -2 },
        ],
      },
      {
        id: 'open_source_it',
        label: 'Open source the model',
        description: 'If it\'s already out, embrace it.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 6 },
          { kind: 'score', target: 'all_labs', key: 'capabilityScore', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'influence', delta: 3 },
        ],
      },
      {
        id: 'quietly_improve_security',
        label: 'Quietly improve security',
        description: 'Focus on prevention, not punishment.',
        effects: [
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 4 },
          { kind: 'resource', target: 'faction', key: 'capital', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'talent_poaching_spree',
    title: 'Talent War',
    description:
      'Competitors are aggressively poaching your engineers. Salaries are skyrocketing.',
    category: 'lab_drama',
    weight: 1.0,
    cooldown: 5,
    choices: [
      {
        id: 'match_offers',
        label: 'Match all offers',
        description: 'Pay whatever it takes to retain talent.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -10 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 2 },
        ],
      },
      {
        id: 'mission_focus',
        label: 'Emphasize mission',
        description: 'Attract people who believe in the work.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'talent', delta: -2 },
          { kind: 'stat', target: 'faction', key: 'safetyCulture', delta: 3 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
      {
        id: 'counter_poach',
        label: 'Counter-poach',
        description: 'Aggressively recruit from competitors.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'capital', delta: -8 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: -3 },
        ],
      },
    ],
  },
  {
    id: 'research_culture_clash',
    title: 'Research Culture Clash',
    description:
      'Tension between publishing researchers and those who want to keep everything secret.',
    category: 'lab_drama',
    weight: 0.85,
    cooldown: 6,
    choices: [
      {
        id: 'open_research',
        label: 'Embrace open research',
        description: 'Publish more to attract top talent.',
        effects: [
          { kind: 'resource', target: 'faction', key: 'trust', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: 3 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: -4 },
        ],
      },
      {
        id: 'closed_research',
        label: 'Close research pipeline',
        description: 'Keep advantages secret.',
        effects: [
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 5 },
          { kind: 'resource', target: 'faction', key: 'talent', delta: -3 },
        ],
      },
      {
        id: 'selective_publishing',
        label: 'Selective publishing',
        description: 'Publish safety research, keep capabilities secret.',
        effects: [
          { kind: 'score', target: 'faction', key: 'safetyScore', delta: 3 },
          { kind: 'stat', target: 'faction', key: 'opsec', delta: 2 },
          { kind: 'resource', target: 'faction', key: 'trust', delta: 2 },
        ],
      },
    ],
  },
];

// ============================================================================
// COMBINED EVENT LIST
// ============================================================================

export const EXPANDED_EVENTS: ExpandedEventDefinition[] = [
  ...CAPABILITY_EVENTS,
  ...SAFETY_EVENTS,
  ...GEOPOLITICAL_EVENTS,
  ...ECONOMIC_EVENTS,
  ...LAB_DRAMA_EVENTS,
];

/**
 * Check if a condition is met for the current game state
 */
export const checkCondition = (
  condition: EventCondition,
  state: GameState,
  factionId: string,
): boolean => {
  const faction = state.factions[factionId];
  if (!faction) return false;

  switch (condition.kind) {
    case 'minCapability':
      return faction.capabilityScore >= condition.threshold;
    case 'maxCapability':
      return faction.capabilityScore <= condition.threshold;
    case 'minSafety':
      return faction.safetyScore >= condition.threshold;
    case 'maxSafety':
      return faction.safetyScore <= condition.threshold;
    case 'minGlobalSafety':
      return state.globalSafety >= condition.threshold;
    case 'maxGlobalSafety':
      return state.globalSafety <= condition.threshold;
    case 'hasTech':
      return faction.unlockedTechs.has(condition.techId);
    case 'minResource':
      return faction.resources[condition.key] >= condition.threshold;
    case 'maxResource':
      return faction.resources[condition.key] <= condition.threshold;
    case 'minTurn':
      return state.turn >= condition.turn;
    case 'maxTurn':
      return state.turn <= condition.turn;
    case 'capabilityLead': {
      const maxOtherCap = Math.max(
        ...Object.values(state.factions)
          .filter((f) => f.id !== factionId)
          .map((f) => f.capabilityScore),
      );
      return faction.capabilityScore - maxOtherCap >= condition.margin;
    }
    case 'safetyDeficit':
      return faction.capabilityScore - faction.safetyScore >= condition.margin;
  }
};

/**
 * Get all events that are eligible to trigger for a given faction
 */
export const getEligibleEvents = (
  state: GameState,
  factionId: string,
  eventHistory: Array<{ eventId: string; turn: number }>,
): ExpandedEventDefinition[] => {
  return EXPANDED_EVENTS.filter((event) => {
    // Check cooldown
    const lastOccurrence = eventHistory.find((h) => h.eventId === event.id);
    if (lastOccurrence && state.turn - lastOccurrence.turn < event.cooldown) {
      return false;
    }

    // Check all conditions
    if (event.conditions) {
      for (const condition of event.conditions) {
        if (!checkCondition(condition, state, factionId)) {
          return false;
        }
      }
    }

    return true;
  });
};

/**
 * Select an event using weighted random selection
 */
export const selectExpandedEvent = (
  state: GameState,
  factionId: string,
  rng: () => number,
  eventHistory: Array<{ eventId: string; turn: number }>,
): ExpandedEventDefinition | null => {
  // Base 55% chance of an event occurring (slightly more than before)
  if (rng() > 0.55) return null;

  const eligible = getEligibleEvents(state, factionId, eventHistory);
  if (!eligible.length) return null;

  // Weight adjustments based on game state
  const faction = state.factions[factionId];
  const weightedEvents = eligible.map((event) => {
    let weight = event.weight;

    // Increase weight for safety events if there's a large safety deficit
    if (
      event.category === 'safety' &&
      faction.capabilityScore - faction.safetyScore > 15
    ) {
      weight *= 1.5;
    }

    // Increase weight for capability events if faction is falling behind
    const maxOtherCap = Math.max(
      ...Object.values(state.factions)
        .filter((f) => f.id !== factionId)
        .map((f) => f.capabilityScore),
    );
    if (event.category === 'capability' && maxOtherCap - faction.capabilityScore > 10) {
      weight *= 1.3;
    }

    // Increase weight for economic events during later game
    if (event.category === 'economic' && state.turn > 8) {
      weight *= 1.2;
    }

    // Increase weight for geopolitical events as capability rises
    if (event.category === 'geopolitical' && faction.capabilityScore > 35) {
      weight *= 1.4;
    }

    return { event, weight };
  });

  const totalWeight = weightedEvents.reduce((sum, { weight }) => sum + weight, 0);
  let roll = rng() * totalWeight;

  for (const { event, weight } of weightedEvents) {
    roll -= weight;
    if (roll <= 0) return event;
  }

  return weightedEvents[weightedEvents.length - 1]?.event ?? null;
};
