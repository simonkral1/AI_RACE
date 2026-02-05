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
}

export const FACTION_TEMPLATES: FactionTemplate[] = [
  {
    id: 'us_lab_a',
    name: 'OpenBrain',  // AI 2027-inspired: leading US AI lab
    type: 'lab',
    resources: {
      compute: 60,
      talent: 80,
      capital: 60,
      data: 60,
      influence: 40,
      trust: 60,
    },
    safetyCulture: 80,
    opsec: 55,
    capabilityScore: 10,
    safetyScore: 25,
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
      talent: 70,
      capital: 80,
      data: 60,
      influence: 40,
      trust: 55,
    },
    safetyCulture: 60,
    opsec: 60,
    capabilityScore: 15,
    safetyScore: 20,
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
      talent: 60,
      capital: 70,
      data: 80,
      influence: 40,
      trust: 45,
    },
    safetyCulture: 45,
    opsec: 70,
    capabilityScore: 15,
    safetyScore: 15,
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
      talent: 30,
      capital: 70,
      data: 20,
      influence: 90,
      trust: 70,
    },
    safetyCulture: 60,
    opsec: 50,
    capabilityScore: 0,
    safetyScore: 35,
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
      talent: 30,
      capital: 70,
      data: 20,
      influence: 85,
      trust: 55,
    },
    safetyCulture: 50,
    opsec: 55,
    capabilityScore: 0,
    safetyScore: 30,
    strategy: {
      riskTolerance: 40,
      safetyFocus: 50,
      opennessPreference: 50,
      espionageFocus: 30,
    },
  },
];
