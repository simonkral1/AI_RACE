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
  // New expanded resources
  /** Public opinion rating (0-100) */
  publicOpinion: number;
  /** Security level (1-5, like AI 2027) */
  securityLevel: number;
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
  | 'counterintel'
  // New expanded actions
  | 'hire_talent'
  | 'publish_research'
  | 'form_alliance'
  | 'secure_funding'
  | 'hardware_partnership'
  | 'open_source_release'
  | 'defensive_measures'
  | 'accelerate_timeline'
  | 'safety_pause'
  // Faction-specific abilities
  | 'open_research'      // OpenBrain
  | 'move_fast'          // Nexus Labs
  | 'state_resources'    // DeepCent
  | 'executive_order'    // US Gov
  | 'strategic_initiative'; // CN Gov

export interface ActionDefinition {
  id: string;
  name: string;
  kind: ActionKind;
  allowedFor: FactionType[];
  baseResearch: Partial<Record<BranchId, number>>;
  baseResourceDelta: Partial<Record<ResourceKey, number>>;
  exposure: number;
  /** If set, only this specific faction can use this action */
  factionSpecific?: string;
  /** Effects on capability and safety scores */
  scoreEffects?: {
    capabilityDelta?: number;
    safetyDelta?: number;
  };
  /** Security level change (1-5 scale) */
  securityLevelDelta?: number;
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
  // New faction relationship systems
  /** Alliances between factions: factionId -> array of allied faction IDs */
  alliances: Map<string, string[]>;
  /** Tension levels between factions: "factionA:factionB" -> tension level (0-100) */
  tensions: Map<string, number>;
  /** Active treaties/agreements (treaty IDs) */
  treaties: string[];
  // Victory/loss tracking
  /** Victory type if game ended with a victor */
  victoryType?: string;
  /** Loss type if game ended without a victor */
  lossType?: string;
  /** Faction that lost (if specific faction lost) */
  loserId?: string;
}

export interface StrategyProfile {
  riskTolerance: number;
  safetyFocus: number;
  opennessPreference: number;
  espionageFocus: number;
}
