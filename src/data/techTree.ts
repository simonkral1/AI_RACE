import { TechNode } from '../core/types.js';

/**
 * AGI Race Tech Tree — 76 nodes across 4 branches
 *
 * Design principles (Civ/Stellaris-inspired):
 * - Branching prereqs: nodes fork and merge, not just A→B→C
 * - ~30% "must-have" core path, 70% optional specialization
 * - Multiple viable rush strategies (capability rush, safety-first, ops fortress)
 * - Cross-branch synergies rewarded (safety + capability combos)
 * - "Verb Rule": 75%+ nodes transform gameplay, not just stat bumps
 * - Tier cost scaling: T1(8-12) → T2(16-22) → T3(30-42) → T4(55-75) → T5(90-120)
 *   Early game: 1-2 techs/turn. Late game: multi-turn investment per tech.
 *
 * Branches:
 *   capabilities (19) — AI model progression from foundation to superintelligence
 *   safety (19)        — Alignment research from RLHF to formal verification
 *   ops (19)           — Infrastructure + security from datacenter to airgapped fortress
 *   policy (19)        — Governance from industry forum to international AI treaty
 */

export const TECH_TREE: TechNode[] = [
  // ============================================================================
  // CAPABILITIES BRANCH (19 nodes)
  // ============================================================================

  // --- Tier 1: Foundations (cost 8-12) ---
  {
    id: 'cap_foundation_model',
    name: 'Foundation Model',
    branch: 'capabilities',
    cost: 8,
    prereqs: [],
    effects: [{ kind: 'capability', delta: 3 }],
  },
  {
    id: 'cap_tool_use',
    name: 'Tool Use',
    branch: 'capabilities',
    cost: 10,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 4 }],
  },
  {
    id: 'cap_unreliable_agent',
    name: 'Unreliable Agent',
    branch: 'capabilities',
    cost: 12,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 5 }],
  },
  {
    id: 'cap_long_context',
    name: 'Long Context Windows',
    branch: 'capabilities',
    cost: 10,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 3 }, { kind: 'resource', key: 'data', delta: 4 }],
  },
  {
    id: 'cap_multimodal',
    name: 'Multimodal Understanding',
    branch: 'capabilities',
    cost: 11,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 4 }],
  },

  // --- Tier 2: Specialization (cost 16-22) ---
  {
    id: 'cap_chain_of_thought',
    name: 'Chain-of-Thought',
    branch: 'capabilities',
    cost: 16,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 4 }],
  },
  {
    id: 'cap_coding_automation',
    name: 'Coding Automation',
    branch: 'capabilities',
    cost: 20,
    prereqs: ['cap_unreliable_agent', 'cap_tool_use'],
    effects: [{ kind: 'capability', delta: 6 }],
  },

  // --- Tier 3: Integration (cost 30-42) ---
  {
    id: 'cap_reliable_agent',
    name: 'Reliable Agent',
    branch: 'capabilities',
    cost: 35,
    prereqs: ['cap_coding_automation', 'cap_long_context', 'cap_chain_of_thought'],
    effects: [{ kind: 'capability', delta: 7 }],
  },
  {
    id: 'cap_extended_reasoning',
    name: 'Extended Reasoning',
    branch: 'capabilities',
    cost: 32,
    prereqs: ['cap_reliable_agent'],
    effects: [{ kind: 'capability', delta: 6 }],
  },
  {
    id: 'cap_world_models',
    name: 'World Models',
    branch: 'capabilities',
    cost: 38,
    prereqs: ['cap_multimodal', 'cap_reliable_agent'],
    effects: [{ kind: 'capability', delta: 7 }],
  },

  // --- Tier 4: Superhuman (cost 55-75) ---
  {
    id: 'cap_superhuman_coder',
    name: 'Superhuman Coder',
    branch: 'capabilities',
    cost: 60,
    prereqs: ['cap_extended_reasoning', 'cap_world_models'],
    effects: [{ kind: 'capability', delta: 9 }],
  },
  {
    id: 'cap_agent_swarms',
    name: 'Agent Swarms',
    branch: 'capabilities',
    cost: 55,
    prereqs: ['cap_superhuman_coder'],
    effects: [{ kind: 'capability', delta: 8 }, { kind: 'resource', key: 'compute', delta: -5 }],
  },
  {
    id: 'cap_ai_researcher',
    name: 'AI Research Automation',
    branch: 'capabilities',
    cost: 70,
    prereqs: ['cap_agent_swarms'],
    effects: [{ kind: 'capability', delta: 10 }],
  },

  // --- Tier 5: Endgame (cost 90-120) ---
  {
    id: 'cap_recursive_improvement',
    name: 'Recursive Self-Improvement',
    branch: 'capabilities',
    cost: 95,
    prereqs: ['cap_ai_researcher'],
    effects: [{ kind: 'capability', delta: 12 }],
  },
  {
    id: 'cap_agi_breakthrough',
    name: 'Superintelligence',
    branch: 'capabilities',
    cost: 120,
    prereqs: ['cap_recursive_improvement'],
    effects: [{ kind: 'capability', delta: 15 }, { kind: 'unlockAgi' }],
  },

  // --- Capability side-branches (optional specializations) ---
  {
    id: 'cap_function_calling',
    name: 'Function Calling',
    branch: 'capabilities',
    cost: 9,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 2 }, { kind: 'resource', key: 'data', delta: 3 }],
  },
  {
    id: 'cap_distillation',
    name: 'Model Distillation',
    branch: 'capabilities',
    cost: 18,
    prereqs: ['cap_chain_of_thought'],
    effects: [{ kind: 'capability', delta: 3 }, { kind: 'resource', key: 'compute', delta: 5 }],
  },
  {
    id: 'cap_synthetic_reasoning',
    name: 'Synthetic Data Reasoning',
    branch: 'capabilities',
    cost: 22,
    prereqs: ['cap_distillation', 'cap_long_context'],
    effects: [{ kind: 'capability', delta: 5 }, { kind: 'resource', key: 'data', delta: 6 }],
  },
  {
    id: 'cap_embodied_ai',
    name: 'Embodied AI',
    branch: 'capabilities',
    cost: 55,
    prereqs: ['cap_world_models', 'cap_function_calling'],
    effects: [{ kind: 'capability', delta: 6 }, { kind: 'resource', key: 'influence', delta: 4 }],
  },

  // ============================================================================
  // SAFETY BRANCH (19 nodes)
  // ============================================================================

  // --- Tier 1: Foundations (cost 8-12) ---
  {
    id: 'safe_model_spec',
    name: 'Model Specification',
    branch: 'safety',
    cost: 8,
    prereqs: [],
    effects: [{ kind: 'safety', delta: 4 }],
  },
  {
    id: 'safe_evals_framework',
    name: 'Evals Framework',
    branch: 'safety',
    cost: 10,
    prereqs: [],
    effects: [{ kind: 'safety', delta: 3 }, { kind: 'stat', key: 'safetyCulture', delta: 1 }],
  },

  // --- Tier 2: Core Alignment (cost 16-22) ---
  {
    id: 'safe_rlhf',
    name: 'RLHF Training',
    branch: 'safety',
    cost: 16,
    prereqs: ['safe_model_spec'],
    effects: [{ kind: 'safety', delta: 5 }],
  },
  {
    id: 'safe_red_teaming',
    name: 'Red Teaming',
    branch: 'safety',
    cost: 16,
    prereqs: ['safe_model_spec', 'safe_evals_framework'],
    effects: [{ kind: 'safety', delta: 5 }],
  },
  {
    id: 'safe_constitutional_ai',
    name: 'Constitutional AI',
    branch: 'safety',
    cost: 19,
    prereqs: ['safe_rlhf'],
    effects: [{ kind: 'safety', delta: 6 }, { kind: 'stat', key: 'safetyCulture', delta: 2 }],
  },
  {
    id: 'safe_basic_interp',
    name: 'Basic Interpretability',
    branch: 'safety',
    cost: 20,
    prereqs: ['safe_rlhf'],
    effects: [{ kind: 'safety', delta: 5 }],
  },
  {
    id: 'safe_adversarial_robustness',
    name: 'Adversarial Robustness',
    branch: 'safety',
    cost: 18,
    prereqs: ['safe_red_teaming'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'stat', key: 'opsec', delta: 2 }],
  },

  // --- Tier 2.5: Side branches ---
  {
    id: 'safe_watermarking',
    name: 'Output Watermarking',
    branch: 'safety',
    cost: 17,
    prereqs: ['safe_constitutional_ai'],
    effects: [{ kind: 'safety', delta: 3 }, { kind: 'resource', key: 'trust', delta: 4 }],
  },
  {
    id: 'safe_sandboxing',
    name: 'Agent Sandboxing',
    branch: 'safety',
    cost: 20,
    prereqs: ['safe_red_teaming'],
    effects: [{ kind: 'safety', delta: 4 }, { kind: 'stat', key: 'opsec', delta: 3 }],
  },

  // --- Tier 3: Deep Safety (cost 30-42) ---
  {
    id: 'safe_sparse_autoencoders',
    name: 'Sparse Autoencoders',
    branch: 'safety',
    cost: 32,
    prereqs: ['safe_basic_interp'],
    effects: [{ kind: 'safety', delta: 7 }],
  },
  {
    id: 'safe_cot_monitoring',
    name: 'CoT Monitoring',
    branch: 'safety',
    cost: 34,
    prereqs: ['safe_constitutional_ai'],
    effects: [{ kind: 'safety', delta: 7 }],
  },
  {
    id: 'safe_deception_detection',
    name: 'Deception Detection',
    branch: 'safety',
    cost: 40,
    prereqs: ['safe_cot_monitoring', 'safe_adversarial_robustness'],
    effects: [{ kind: 'safety', delta: 8 }],
  },
  {
    id: 'safe_circuit_analysis',
    name: 'Circuit Analysis',
    branch: 'safety',
    cost: 35,
    prereqs: ['safe_sparse_autoencoders'],
    effects: [{ kind: 'safety', delta: 7 }],
  },

  // --- Tier 4: Advanced Safety (cost 55-75) ---
  {
    id: 'safe_scalable_oversight',
    name: 'Scalable Oversight',
    branch: 'safety',
    cost: 58,
    prereqs: ['safe_deception_detection', 'safe_circuit_analysis'],
    effects: [{ kind: 'safety', delta: 9 }],
  },
  {
    id: 'safe_alignment_tax',
    name: 'Alignment Tax Reduction',
    branch: 'safety',
    cost: 62,
    prereqs: ['safe_scalable_oversight'],
    effects: [{ kind: 'safety', delta: 8 }, { kind: 'capability', delta: 4 }],
  },
  {
    id: 'safe_corrigibility',
    name: 'Corrigibility Protocols',
    branch: 'safety',
    cost: 68,
    prereqs: ['safe_scalable_oversight'],
    effects: [{ kind: 'safety', delta: 10 }],
  },

  // --- Tier 5: Endgame Safety (cost 90-110) ---
  {
    id: 'safe_formal_verification',
    name: 'Formal Verification',
    branch: 'safety',
    cost: 92,
    prereqs: ['safe_corrigibility', 'safe_circuit_analysis'],
    effects: [{ kind: 'safety', delta: 11 }],
  },
  {
    id: 'safe_automated_research',
    name: 'Automated Safety Research',
    branch: 'safety',
    cost: 110,
    prereqs: ['safe_formal_verification', 'safe_alignment_tax'],
    effects: [{ kind: 'safety', delta: 12 }, { kind: 'stat', key: 'safetyCulture', delta: 4 }],
  },

  // ============================================================================
  // OPS BRANCH (19 nodes)
  // ============================================================================

  // --- Tier 1: Foundations (cost 8-12) ---
  {
    id: 'ops_basic_security',
    name: 'Basic InfoSec',
    branch: 'ops',
    cost: 8,
    prereqs: [],
    effects: [{ kind: 'stat', key: 'opsec', delta: 3 }],
  },
  {
    id: 'ops_h100_cluster',
    name: 'H100 GPU Cluster',
    branch: 'ops',
    cost: 10,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }],
  },

  // --- Tier 2: Scaling (cost 16-20) ---
  {
    id: 'ops_access_controls',
    name: 'Access Controls',
    branch: 'ops',
    cost: 16,
    prereqs: ['ops_basic_security'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 3 }],
  },
  {
    id: 'ops_synthetic_data',
    name: 'Synthetic Data Pipeline',
    branch: 'ops',
    cost: 17,
    prereqs: ['ops_basic_security'],
    effects: [{ kind: 'resource', key: 'data', delta: 6 }],
  },
  {
    id: 'ops_networking',
    name: 'High-Speed Interconnect',
    branch: 'ops',
    cost: 16,
    prereqs: ['ops_h100_cluster'],
    effects: [{ kind: 'resource', key: 'compute', delta: 4 }],
  },
  {
    id: 'ops_energy_contracts',
    name: 'Energy Contracts',
    branch: 'ops',
    cost: 17,
    prereqs: ['ops_h100_cluster'],
    effects: [{ kind: 'resource', key: 'capital', delta: 5 }],
  },

  // --- Tier 2.5: Compute path ---
  {
    id: 'ops_1e26_training',
    name: '10^26 FLOP Training',
    branch: 'ops',
    cost: 22,
    prereqs: ['ops_networking', 'ops_energy_contracts'],
    effects: [{ kind: 'resource', key: 'compute', delta: 7 }],
  },
  {
    id: 'ops_data_pipeline',
    name: 'Advanced Data Pipeline',
    branch: 'ops',
    cost: 19,
    prereqs: ['ops_synthetic_data'],
    effects: [{ kind: 'resource', key: 'data', delta: 7 }],
  },

  // --- Tier 3: Professional (cost 30-40) ---
  {
    id: 'ops_professional_security',
    name: 'Professional Security',
    branch: 'ops',
    cost: 30,
    prereqs: ['ops_access_controls'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 4 }],
  },
  {
    id: 'ops_next_gen_chips',
    name: 'Next-Gen AI Chips',
    branch: 'ops',
    cost: 34,
    prereqs: ['ops_1e26_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 8 }],
  },
  {
    id: 'ops_mega_datacenter',
    name: 'Mega-Datacenter',
    branch: 'ops',
    cost: 40,
    prereqs: ['ops_next_gen_chips', 'ops_energy_contracts'],
    effects: [{ kind: 'resource', key: 'compute', delta: 10 }],
  },

  // --- Tier 3.5: Security + Compute merge ---
  {
    id: 'ops_syndicate_defense',
    name: 'Syndicate Defense',
    branch: 'ops',
    cost: 36,
    prereqs: ['ops_professional_security'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }],
  },
  {
    id: 'ops_agent_orchestration',
    name: 'Agent Orchestration',
    branch: 'ops',
    cost: 38,
    prereqs: ['ops_professional_security', 'ops_mega_datacenter'],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }, { kind: 'resource', key: 'talent', delta: 4 }],
  },

  // --- Tier 4: Hardening (cost 55-70) ---
  {
    id: 'ops_weight_encryption',
    name: 'Weight Encryption',
    branch: 'ops',
    cost: 55,
    prereqs: ['ops_syndicate_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }],
  },
  {
    id: 'ops_compartmentalization',
    name: 'Compartmentalization',
    branch: 'ops',
    cost: 55,
    prereqs: ['ops_syndicate_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }, { kind: 'resource', key: 'trust', delta: -3 }],
  },
  {
    id: 'ops_nation_state_defense',
    name: 'Nation-State Defense',
    branch: 'ops',
    cost: 65,
    prereqs: ['ops_weight_encryption', 'ops_compartmentalization'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 6 }],
  },
  {
    id: 'ops_1e27_training',
    name: '10^27 FLOP Training',
    branch: 'ops',
    cost: 60,
    prereqs: ['ops_mega_datacenter'],
    effects: [{ kind: 'resource', key: 'compute', delta: 10 }],
  },

  // --- Tier 5: Endgame (cost 90-120) ---
  {
    id: 'ops_airgapping',
    name: 'Critical Airgapping',
    branch: 'ops',
    cost: 90,
    prereqs: ['ops_nation_state_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 7 }],
  },
  {
    id: 'ops_1e28_training',
    name: '10^28 FLOP Training',
    branch: 'ops',
    cost: 95,
    prereqs: ['ops_1e27_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 12 }],
  },
  {
    id: 'ops_top_nation_defense',
    name: 'Top Nation Defense',
    branch: 'ops',
    cost: 100,
    prereqs: ['ops_airgapping'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 8 }],
  },
  {
    id: 'ops_ai_security',
    name: 'AI-Powered Security',
    branch: 'ops',
    cost: 115,
    prereqs: ['ops_top_nation_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 8 }, { kind: 'resource', key: 'trust', delta: 4 }],
  },

  // ============================================================================
  // POLICY BRANCH (19 nodes)
  // ============================================================================

  // --- Tier 1: Foundations (cost 8-12) ---
  {
    id: 'pol_frontier_forum',
    name: 'Frontier Model Forum',
    branch: 'policy',
    cost: 8,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'trust', delta: 4 }],
  },

  // --- Tier 2: Early Governance (cost 14-18) ---
  {
    id: 'pol_voluntary_commitments',
    name: 'Voluntary Commitments',
    branch: 'policy',
    cost: 14,
    prereqs: ['pol_frontier_forum'],
    effects: [{ kind: 'resource', key: 'trust', delta: 4 }, { kind: 'stat', key: 'safetyCulture', delta: 1 }],
  },
  {
    id: 'pol_compute_reporting',
    name: 'Compute Reporting',
    branch: 'policy',
    cost: 14,
    prereqs: ['pol_frontier_forum'],
    effects: [{ kind: 'resource', key: 'influence', delta: 4 }],
  },
  {
    id: 'pol_lobbying',
    name: 'Strategic Lobbying',
    branch: 'policy',
    cost: 15,
    prereqs: ['pol_frontier_forum'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }, { kind: 'resource', key: 'trust', delta: -2 }],
  },
  {
    id: 'pol_public_engagement',
    name: 'Public Engagement',
    branch: 'policy',
    cost: 15,
    prereqs: ['pol_voluntary_commitments'],
    effects: [{ kind: 'resource', key: 'trust', delta: 6 }, { kind: 'resource', key: 'influence', delta: 2 }],
  },

  // --- Tier 3: Institutional (cost 22-34) ---
  {
    id: 'pol_aisi_partnership',
    name: 'AISI Partnership',
    branch: 'policy',
    cost: 22,
    prereqs: ['pol_voluntary_commitments'],
    effects: [{ kind: 'safety', delta: 4 }, { kind: 'resource', key: 'influence', delta: 3 }],
  },
  {
    id: 'pol_rsp_adoption',
    name: 'RSP Adoption',
    branch: 'policy',
    cost: 28,
    prereqs: ['pol_aisi_partnership', 'pol_compute_reporting'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'stat', key: 'safetyCulture', delta: 2 }],
  },
  {
    id: 'pol_chip_export_controls',
    name: 'Chip Export Controls',
    branch: 'policy',
    cost: 26,
    prereqs: ['pol_compute_reporting'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }],
  },
  {
    id: 'pol_whistleblower_protection',
    name: 'Whistleblower Protection',
    branch: 'policy',
    cost: 24,
    prereqs: ['pol_aisi_partnership'],
    effects: [{ kind: 'safety', delta: 3 }, { kind: 'resource', key: 'trust', delta: 5 }],
  },

  // --- Tier 3.5: Regulation ---
  {
    id: 'pol_kyc_compute',
    name: 'KYC for Compute',
    branch: 'policy',
    cost: 32,
    prereqs: ['pol_chip_export_controls'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }],
  },
  {
    id: 'pol_compute_sovereignty',
    name: 'Compute Sovereignty',
    branch: 'policy',
    cost: 34,
    prereqs: ['pol_chip_export_controls'],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }, { kind: 'resource', key: 'influence', delta: 3 }],
  },

  // --- Tier 4: International (cost 50-70) ---
  {
    id: 'pol_international_network',
    name: 'International AISI Network',
    branch: 'policy',
    cost: 50,
    prereqs: ['pol_rsp_adoption'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'resource', key: 'trust', delta: 4 }],
  },
  {
    id: 'pol_flop_treaty',
    name: 'FLOP Threshold Treaty',
    branch: 'policy',
    cost: 60,
    prereqs: ['pol_international_network', 'pol_kyc_compute'],
    effects: [{ kind: 'safety', delta: 6 }, { kind: 'resource', key: 'influence', delta: 6 }],
  },
  {
    id: 'pol_taiwan_accord',
    name: 'Taiwan Accord',
    branch: 'policy',
    cost: 55,
    prereqs: ['pol_chip_export_controls', 'pol_international_network'],
    effects: [{ kind: 'resource', key: 'influence', delta: 7 }],
  },
  {
    id: 'pol_iaea_for_ai',
    name: 'IAEA for AI',
    branch: 'policy',
    cost: 70,
    prereqs: ['pol_flop_treaty'],
    effects: [{ kind: 'safety', delta: 7 }, { kind: 'resource', key: 'trust', delta: 5 }],
  },

  // --- Tier 5: Endgame Governance (cost 90-110) ---
  {
    id: 'pol_npt_for_ai',
    name: 'AI Non-Proliferation Treaty',
    branch: 'policy',
    cost: 95,
    prereqs: ['pol_iaea_for_ai', 'pol_taiwan_accord'],
    effects: [{ kind: 'safety', delta: 8 }, { kind: 'resource', key: 'influence', delta: 8 }],
  },
  {
    id: 'pol_mutual_inspection',
    name: 'Mutual AI Inspection',
    branch: 'policy',
    cost: 110,
    prereqs: ['pol_npt_for_ai'],
    effects: [{ kind: 'safety', delta: 10 }, { kind: 'resource', key: 'trust', delta: 6 }],
  },
];
