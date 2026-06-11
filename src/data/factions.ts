import { FactionState, StrategyProfile } from '../core/types.js';

export interface FactionTemplate {
  id: string;
  name: string;
  type: FactionState['type'];
  resources: FactionState['resources'];
  safetyCulture: number;
  opsec: number;
  capabilityScore: number;
  safetyScore: number;
  strategy: StrategyProfile;
  /** Initial public opinion (0-100) */
  publicOpinion?: number;
  /** Initial security level (1-5) */
  securityLevel?: number;
  /** Faction's unique special ability action ID */
  specialAbility?: string;
  /** Optional initial hard-power value (0-100) */
  hardPower?: number;
}

export const FACTION_TEMPLATES: FactionTemplate[] = [
  {
    id: 'us_lab_a',
    name: 'OpenBrain',  // AI 2027-inspired: leading US AI lab
    type: 'lab',
    resources: {
      compute: 60,
      cybersecurity: 58,
      capital: 60,
      influence: 40,
      trust: 60,
    },
    safetyCulture: 80,
    opsec: 55,
    capabilityScore: 10,
    safetyScore: 25,
    publicOpinion: 65,
    securityLevel: 3,
    hardPower: 26,
    specialAbility: 'open_research',
    strategy: {
      riskTolerance: 35,
      safetyFocus: 75,
      opennessPreference: 70,
      espionageFocus: 15,
    },
  },
  {
    id: 'us_lab_b',
    name: 'Nexus Labs',  // AI 2027-inspired: aggressive US competitor
    type: 'lab',
    resources: {
      compute: 80,
      cybersecurity: 52,
      capital: 80,
      influence: 40,
      trust: 55,
    },
    safetyCulture: 60,
    opsec: 60,
    capabilityScore: 15,
    safetyScore: 20,
    publicOpinion: 55,
    securityLevel: 2,
    hardPower: 30,
    specialAbility: 'move_fast',
    strategy: {
      riskTolerance: 55,
      safetyFocus: 45,
      opennessPreference: 45,
      espionageFocus: 25,
    },
  },
  {
    id: 'cn_lab',
    name: 'DeepCent',  // AI 2027-inspired: China's leading AI collective
    type: 'lab',
    resources: {
      compute: 75,
      cybersecurity: 70,
      capital: 70,
      influence: 40,
      trust: 55,
    },
    safetyCulture: 45,
    opsec: 70,
    capabilityScore: 15,
    safetyScore: 15,
    publicOpinion: 45,
    securityLevel: 4,
    hardPower: 34,
    specialAbility: 'state_resources',
    strategy: {
      riskTolerance: 65,
      safetyFocus: 35,
      opennessPreference: 30,
      espionageFocus: 45,
    },
  },
  {
    id: 'us_gov',
    name: 'US Executive',
    type: 'government',
    resources: {
      compute: 20,
      cybersecurity: 62,
      capital: 70,
      influence: 90,
      trust: 70,
    },
    safetyCulture: 60,
    opsec: 50,
    capabilityScore: 0,
    safetyScore: 35,
    publicOpinion: 55,
    securityLevel: 4,
    hardPower: 74,
    specialAbility: 'executive_order',
    strategy: {
      riskTolerance: 30,
      safetyFocus: 65,
      opennessPreference: 60,
      espionageFocus: 20,
    },
  },
  {
    id: 'cn_gov',
    name: 'PRC Executive',
    type: 'government',
    resources: {
      compute: 20,
      cybersecurity: 68,
      capital: 70,
      influence: 85,
      trust: 55,
    },
    safetyCulture: 50,
    opsec: 55,
    capabilityScore: 0,
    safetyScore: 30,
    publicOpinion: 45,
    securityLevel: 5,
    hardPower: 72,
    specialAbility: 'strategic_initiative',
    strategy: {
      riskTolerance: 40,
      safetyFocus: 50,
      opennessPreference: 50,
      espionageFocus: 30,
    },
  },
];
