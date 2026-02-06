import { ActionDefinition } from '../core/types.js';

export const ACTIONS: ActionDefinition[] = [
  {
    id: 'research_capabilities',
    name: 'Capabilities Research',
    kind: 'research_capabilities',
    allowedFor: ['lab'],
    baseResearch: { capabilities: 12 },
    baseResourceDelta: {},
    exposure: 1,
  },
  {
    id: 'research_safety',
    name: 'Safety Research',
    kind: 'research_safety',
    allowedFor: ['lab', 'government'],
    baseResearch: { safety: 12 },
    baseResourceDelta: {},
    exposure: 1,
  },
  {
    id: 'build_compute',
    name: 'Build Compute',
    kind: 'build_compute',
    allowedFor: ['lab'],
    baseResearch: {},
    baseResourceDelta: { capital: -10, compute: 8 },
    exposure: 0,
  },
  {
    id: 'deploy_products',
    name: 'Deploy Products',
    kind: 'deploy_products',
    allowedFor: ['lab'],
    baseResearch: {},
    baseResourceDelta: { capital: 12, trust: 2 },
    exposure: 0,
  },
  {
    id: 'deploy_agi',
    name: 'Deploy AGI',
    kind: 'deploy_agi',
    allowedFor: ['lab'],
    baseResearch: {},
    baseResourceDelta: {},
    exposure: 0,
  },
  {
    id: 'policy',
    name: 'Policy & Diplomacy',
    kind: 'policy',
    allowedFor: ['lab', 'government'],
    baseResearch: { policy: 10 },
    baseResourceDelta: { influence: 3, trust: 1 },
    exposure: 0,
  },
  {
    id: 'espionage',
    name: 'Espionage',
    kind: 'espionage',
    allowedFor: ['lab', 'government'],
    baseResearch: {},
    baseResourceDelta: {},
    exposure: 2,
  },
  {
    id: 'subsidize',
    name: 'Subsidize Lab',
    kind: 'subsidize',
    allowedFor: ['government'],
    baseResearch: {},
    baseResourceDelta: { capital: -8 },
    exposure: 0,
  },
  {
    id: 'regulate',
    name: 'Regulate Lab',
    kind: 'regulate',
    allowedFor: ['government'],
    baseResearch: {},
    baseResourceDelta: {},
    exposure: 0,
  },
  {
    id: 'counterintel',
    name: 'Counter-Intelligence',
    kind: 'counterintel',
    allowedFor: ['government'],
    baseResearch: {},
    baseResourceDelta: { capital: -4 },
    exposure: 0,
  },

  // ============================================================
  // NEW EXPANDED ACTIONS
  // ============================================================

  // Hire Talent - increase talent resource
  {
    id: 'hire_talent',
    name: 'Hire Talent',
    kind: 'hire_talent',
    allowedFor: ['lab'],
    baseResearch: {},
    baseResourceDelta: { capital: -8, talent: 10 },
    exposure: 0,
  },

  // Publish Research - gain trust, share knowledge
  {
    id: 'publish_research',
    name: 'Publish Research',
    kind: 'publish_research',
    allowedFor: ['lab'],
    baseResearch: { safety: 4 },
    baseResourceDelta: { trust: 6, influence: 2 },
    exposure: 0,
  },

  // Form Alliance - diplomatic action
  {
    id: 'form_alliance',
    name: 'Form Alliance',
    kind: 'form_alliance',
    allowedFor: ['lab', 'government'],
    baseResearch: { policy: 5 },
    baseResourceDelta: { influence: 3, trust: 2 },
    exposure: 0,
  },

  // Secure Funding - government action for capital
  {
    id: 'secure_funding',
    name: 'Secure Funding',
    kind: 'secure_funding',
    allowedFor: ['government'],
    baseResearch: {},
    baseResourceDelta: { capital: 15, influence: -2 },
    exposure: 0,
  },

  // Hardware Partnership - compute deals
  {
    id: 'hardware_partnership',
    name: 'Hardware Partnership',
    kind: 'hardware_partnership',
    allowedFor: ['lab'],
    baseResearch: {},
    baseResourceDelta: { compute: 12, capital: -6 },
    exposure: 0,
  },

  // Open Source Release - high trust gain, capability leak
  {
    id: 'open_source_release',
    name: 'Open Source Release',
    kind: 'open_source_release',
    allowedFor: ['lab'],
    baseResearch: { capabilities: -5 },
    baseResourceDelta: { trust: 10, influence: 4 },
    exposure: 0,
    scoreEffects: { capabilityDelta: -3 },
  },

  // Defensive Measures - protect from espionage
  {
    id: 'defensive_measures',
    name: 'Defensive Measures',
    kind: 'defensive_measures',
    allowedFor: ['lab'],
    baseResearch: { ops: 6 },
    baseResourceDelta: { capital: -5 },
    exposure: 0,
    securityLevelDelta: 1,
  },

  // Accelerate Timeline - risky capability push
  {
    id: 'accelerate_timeline',
    name: 'Accelerate Timeline',
    kind: 'accelerate_timeline',
    allowedFor: ['lab'],
    baseResearch: { capabilities: 18 },
    baseResourceDelta: { trust: -4 },
    exposure: 3,
    scoreEffects: { capabilityDelta: 8, safetyDelta: -6 },
  },

  // Safety Pause - slow down, gain safety
  {
    id: 'safety_pause',
    name: 'Safety Pause',
    kind: 'safety_pause',
    allowedFor: ['lab'],
    baseResearch: { safety: 15 },
    baseResourceDelta: { trust: 5 },
    exposure: 0,
    scoreEffects: { safetyDelta: 6, capabilityDelta: -2 },
  },

  // ============================================================
  // FACTION-SPECIFIC SPECIAL ABILITIES
  // ============================================================

  // OpenBrain: Open Research - share capability for trust
  {
    id: 'open_research',
    name: 'Open Research (OpenBrain)',
    kind: 'open_research',
    allowedFor: ['lab'],
    factionSpecific: 'us_lab_a',
    baseResearch: { capabilities: 8, safety: 4 },
    baseResourceDelta: { trust: 8, influence: 3 },
    exposure: 0,
    scoreEffects: { capabilityDelta: 2 },
  },

  // Nexus Labs: Move Fast - extra capability but risky
  {
    id: 'move_fast',
    name: 'Move Fast (Nexus Labs)',
    kind: 'move_fast',
    allowedFor: ['lab'],
    factionSpecific: 'us_lab_b',
    baseResearch: { capabilities: 20 },
    baseResourceDelta: { trust: -3 },
    exposure: 4,
    scoreEffects: { capabilityDelta: 10, safetyDelta: -4 },
  },

  // DeepCent: State Resources - more compute access
  {
    id: 'state_resources',
    name: 'State Resources (DeepCent)',
    kind: 'state_resources',
    allowedFor: ['lab'],
    factionSpecific: 'cn_lab',
    baseResearch: { capabilities: 10 },
    baseResourceDelta: { compute: 15, data: 8 },
    exposure: 0,
  },

  // US Gov: Executive Order - instant regulation
  {
    id: 'executive_order',
    name: 'Executive Order (US Gov)',
    kind: 'executive_order',
    allowedFor: ['government'],
    factionSpecific: 'us_gov',
    baseResearch: { policy: 8 },
    baseResourceDelta: { influence: -5 },
    exposure: 0,
  },

  // CN Gov: Strategic Initiative - boost allied labs
  {
    id: 'strategic_initiative',
    name: 'Strategic Initiative (CN Gov)',
    kind: 'strategic_initiative',
    allowedFor: ['government'],
    factionSpecific: 'cn_gov',
    baseResearch: { policy: 6 },
    baseResourceDelta: { capital: -10 },
    exposure: 0,
  },
];
