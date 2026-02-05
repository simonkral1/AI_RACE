import { TechNode } from '../core/types.js';

export const TECH_TREE: TechNode[] = [
  // Capabilities - AI 2027-inspired progression
  {
    id: 'cap_eff_training',
    name: 'Unreliable Agent',  // AI 2027: first agent phase
    branch: 'capabilities',
    cost: 20,
    prereqs: [],
    effects: [{ kind: 'capability', delta: 6 }],
  },
  {
    id: 'cap_arch_breakthrough',
    name: 'Coding Automation',  // AI 2027: agents that code
    branch: 'capabilities',
    cost: 25,
    prereqs: ['cap_eff_training'],
    effects: [{ kind: 'capability', delta: 7 }],
  },
  {
    id: 'cap_multimodal',
    name: 'Reliable Agent',  // AI 2027: improved agent phase
    branch: 'capabilities',
    cost: 30,
    prereqs: ['cap_arch_breakthrough'],
    effects: [{ kind: 'capability', delta: 8 }],
  },
  {
    id: 'cap_long_horizon',
    name: 'AI R&D Automation',  // AI 2027: AI doing AI research
    branch: 'capabilities',
    cost: 35,
    prereqs: ['cap_multimodal'],
    effects: [{ kind: 'capability', delta: 9 }],
  },
  {
    id: 'cap_scalable_reasoning',
    name: 'Agent Swarms',  // AI 2027: thousands of agent copies
    branch: 'capabilities',
    cost: 40,
    prereqs: ['cap_long_horizon'],
    effects: [{ kind: 'capability', delta: 10 }],
  },
  {
    id: 'cap_agi_breakthrough',
    name: 'Superintelligence',  // AI 2027: the endgame
    branch: 'capabilities',
    cost: 50,
    prereqs: ['cap_scalable_reasoning'],
    effects: [{ kind: 'capability', delta: 12 }, { kind: 'unlockAgi' }],
  },

  // Safety - AI 2027-inspired alignment tech
  {
    id: 'safe_alignment_benchmarks',
    name: 'Model Specification',  // AI 2027: the "Spec" document
    branch: 'safety',
    cost: 18,
    prereqs: [],
    effects: [{ kind: 'safety', delta: 6 }],
  },
  {
    id: 'safe_interpretability',
    name: 'Mechanistic Interp',  // AI 2027: reading the model's mind
    branch: 'safety',
    cost: 22,
    prereqs: ['safe_alignment_benchmarks'],
    effects: [{ kind: 'safety', delta: 7 }, { kind: 'stat', key: 'safetyCulture', delta: 2 }],
  },
  {
    id: 'safe_adversarial',
    name: 'Deception Detection',  // AI 2027: catching sycophantic behavior
    branch: 'safety',
    cost: 26,
    prereqs: ['safe_interpretability'],
    effects: [{ kind: 'safety', delta: 8 }],
  },
  {
    id: 'safe_monitoring',
    name: 'Chain-of-Thought Audit',  // AI 2027: monitoring agent reasoning
    branch: 'safety',
    cost: 30,
    prereqs: ['safe_adversarial'],
    effects: [{ kind: 'safety', delta: 9 }],
  },
  {
    id: 'safe_scaling_laws',
    name: 'Alignment Tax Reduction',  // AI 2027: safety without capability loss
    branch: 'safety',
    cost: 34,
    prereqs: ['safe_monitoring'],
    effects: [{ kind: 'safety', delta: 10 }, { kind: 'stat', key: 'safetyCulture', delta: 3 }],
  },
  {
    id: 'safe_guardrails',
    name: 'Corrigibility Lock',  // AI 2027: maintaining human control
    branch: 'safety',
    cost: 40,
    prereqs: ['safe_scaling_laws'],
    effects: [{ kind: 'safety', delta: 12 }],
  },

  // Ops / Infrastructure - AI 2027-inspired
  {
    id: 'ops_compute_scaling',
    name: 'Mega-Datacenter',  // AI 2027: massive compute clusters
    branch: 'ops',
    cost: 16,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }],
  },
  {
    id: 'ops_energy_contracts',
    name: 'Nuclear Power Deal',  // AI 2027: Tianwan-style power plants
    branch: 'ops',
    cost: 20,
    prereqs: ['ops_compute_scaling'],
    effects: [{ kind: 'resource', key: 'capital', delta: 5 }],
  },
  {
    id: 'ops_data_pipeline',
    name: 'Synthetic Data Engine',  // AI 2027: AI-generated training data
    branch: 'ops',
    cost: 22,
    prereqs: ['ops_energy_contracts'],
    effects: [{ kind: 'resource', key: 'data', delta: 6 }],
  },
  {
    id: 'ops_ai_ops',
    name: 'Weight Security (SL3)',  // AI 2027: security levels for model weights
    branch: 'ops',
    cost: 26,
    prereqs: ['ops_data_pipeline'],
    effects: [{ kind: 'resource', key: 'capital', delta: 6 }],
  },
  {
    id: 'ops_model_compression',
    name: '10^28 FLOP Training',  // AI 2027: massive compute scaling
    branch: 'ops',
    cost: 30,
    prereqs: ['ops_ai_ops'],
    effects: [{ kind: 'resource', key: 'compute', delta: 7 }],
  },
  {
    id: 'ops_reliability',
    name: 'Agent Orchestration',  // AI 2027: managing thousands of agent copies
    branch: 'ops',
    cost: 34,
    prereqs: ['ops_model_compression'],
    effects: [{ kind: 'resource', key: 'trust', delta: 6 }],
  },

  // Policy / Diplomacy - AI 2027-inspired
  {
    id: 'pol_audit_standards',
    name: 'Frontier Model Forum',  // AI 2027: industry coordination
    branch: 'policy',
    cost: 16,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'trust', delta: 4 }],
  },
  {
    id: 'pol_compute_reporting',
    name: 'FLOP Threshold Treaty',  // AI 2027: compute governance
    branch: 'policy',
    cost: 20,
    prereqs: ['pol_audit_standards'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }],
  },
  {
    id: 'pol_joint_safety_lab',
    name: 'AISI Partnership',  // AI 2027: government safety institutes
    branch: 'policy',
    cost: 24,
    prereqs: ['pol_compute_reporting'],
    effects: [{ kind: 'safety', delta: 6 }],
  },
  {
    id: 'pol_non_prolif',
    name: 'Chip Export Ban',  // AI 2027: hardware controls
    branch: 'policy',
    cost: 28,
    prereqs: ['pol_joint_safety_lab'],
    effects: [{ kind: 'resource', key: 'influence', delta: 6 }],
  },
  {
    id: 'pol_export_controls',
    name: 'Taiwan Accord',  // AI 2027: semiconductor geopolitics
    branch: 'policy',
    cost: 30,
    prereqs: ['pol_non_prolif'],
    effects: [{ kind: 'resource', key: 'influence', delta: 7 }],
  },
  {
    id: 'pol_mutual_inspection',
    name: 'AI Arms Control',  // AI 2027: international oversight
    branch: 'policy',
    cost: 34,
    prereqs: ['pol_export_controls'],
    effects: [{ kind: 'safety', delta: 8 }, { kind: 'resource', key: 'trust', delta: 4 }],
  },
];
