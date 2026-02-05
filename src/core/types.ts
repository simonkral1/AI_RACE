export type FactionType = 'lab' | 'government';

export type ResourceKey =
  | 'compute'
  | 'talent'
  | 'capital'
  | 'data'
  | 'influence'
  | 'trust';

export type StatKey = ResourceKey | 'safetyCulture' | 'opsec';

export type BranchId = 'capabilities' | 'safety' | 'ops' | 'policy';

export type Openness = 'open' | 'secret';

export interface Resources {
  compute: number;
  talent: number;
  capital: number;
  data: number;
  influence: number;
  trust: number;
}

export interface FactionState {
  id: string;
  name: string;
  type: FactionType;
  resources: Resources;
  safetyCulture: number;
  opsec: number;
  capabilityScore: number;
  safetyScore: number;
  exposure: number;
  unlockedTechs: Set<string>;
  research: Record<BranchId, number>;
  canDeployAgi: boolean;
}

export interface TechNode {
  id: string;
  name: string;
  branch: BranchId;
  cost: number;
  prereqs: string[];
  effects: TechEffect[];
}

export type TechEffect =
  | { kind: 'capability'; delta: number }
  | { kind: 'safety'; delta: number }
  | { kind: 'resource'; key: ResourceKey; delta: number }
  | { kind: 'stat'; key: 'safetyCulture' | 'opsec'; delta: number }
  | { kind: 'unlockAgi' };

export type ActionKind =
  | 'research_capabilities'
  | 'research_safety'
  | 'build_compute'
  | 'deploy_products'
  | 'deploy_agi'
  | 'policy'
  | 'espionage'
  | 'subsidize'
  | 'regulate'
  | 'counterintel';

export interface ActionDefinition {
  id: string;
  name: string;
  kind: ActionKind;
  allowedFor: FactionType[];
  baseResearch: Partial<Record<BranchId, number>>;
  baseResourceDelta: Partial<Record<ResourceKey, number>>;
  exposure: number;
}

export interface ActionChoice {
  actionId: string;
  openness: Openness;
  targetFactionId?: string;
}

export interface TurnContext {
  year: number;
  quarter: number;
  turn: number;
}

export interface GameState {
  turn: number;
  year: number;
  quarter: number;
  factions: Record<string, FactionState>;
  globalSafety: number;
  gameOver: boolean;
  winnerId?: string;
  log: string[];
}

export interface StrategyProfile {
  riskTolerance: number;
  safetyFocus: number;
  opennessPreference: number;
  espionageFocus: number;
}
