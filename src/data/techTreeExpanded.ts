/**
 * Expanded Tech Tree for AGI Race
 * Based on AI 2027 scenario research and real AI safety/capabilities research
 *
 * 6 Branches:
 * - capabilities: AI model capabilities progression (Agent-1 through ASI)
 * - safety: Alignment research and safety measures
 * - compute: Hardware and training infrastructure
 * - ops: Operational security and deployment
 * - policy: Governance and international coordination
 * - talent: Workforce and organizational capabilities
 *
 * Total: 78 technologies
 *
 * Sources:
 * - AI 2027 scenario (ai-2027.com)
 * - Anthropic's RSP and ASL framework
 * - OpenAI's chain-of-thought monitoring research
 * - RAND's weight security levels (WSL1-5)
 * - Epoch AI compute forecasts
 */

import { TechNode, BranchId } from '../core/types.js';

// Extended branch type to include new branches
export type ExtendedBranchId = BranchId | 'compute' | 'talent';

export interface ExtendedTechNode extends Omit<TechNode, 'branch'> {
  branch: ExtendedBranchId;
  description?: string;
  tier?: number; // 1-5, indicates tech level
}

export const TECH_TREE_EXPANDED: ExtendedTechNode[] = [
  // ============================================================================
  // CAPABILITIES BRANCH (14 techs)
  // Progression: Basic LLM -> Unreliable Agents -> Reliable Agents -> AI Researchers -> ASI
  // Based on AI 2027's Agent-1 through Agent-5 evolution
  // ============================================================================

  {
    id: 'cap_foundation_model',
    name: 'Foundation Model',
    branch: 'capabilities',
    tier: 1,
    cost: 15,
    prereqs: [],
    effects: [{ kind: 'capability', delta: 4 }],
    description: 'Large language model with broad general capabilities',
  },
  {
    id: 'cap_unreliable_agent',
    name: 'Unreliable Agent',
    branch: 'capabilities',
    tier: 1,
    cost: 20,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 5 }],
    description: 'AI 2027: First agent phase - useful but inconsistent autonomous systems',
  },
  {
    id: 'cap_tool_use',
    name: 'Tool Use Integration',
    branch: 'capabilities',
    tier: 1,
    cost: 18,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 4 }],
    description: 'Agents can browse web, execute code, use APIs',
  },
  {
    id: 'cap_coding_automation',
    name: 'Coding Automation',
    branch: 'capabilities',
    tier: 2,
    cost: 25,
    prereqs: ['cap_unreliable_agent', 'cap_tool_use'],
    effects: [{ kind: 'capability', delta: 6 }],
    description: 'AI 2027: Agents that write, debug, and optimize code autonomously',
  },
  {
    id: 'cap_long_context',
    name: 'Long Context Windows',
    branch: 'capabilities',
    tier: 2,
    cost: 22,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 5 }],
    description: '1M+ token context enabling complex document analysis',
  },
  {
    id: 'cap_multimodal',
    name: 'Multimodal Understanding',
    branch: 'capabilities',
    tier: 2,
    cost: 24,
    prereqs: ['cap_foundation_model'],
    effects: [{ kind: 'capability', delta: 5 }],
    description: 'Vision, audio, and video processing integrated with language',
  },
  {
    id: 'cap_reliable_agent',
    name: 'Reliable Agent',
    branch: 'capabilities',
    tier: 3,
    cost: 32,
    prereqs: ['cap_coding_automation', 'cap_long_context'],
    effects: [{ kind: 'capability', delta: 7 }],
    description: 'AI 2027 Agent-2: Consistent performance on complex multi-step tasks',
  },
  {
    id: 'cap_reasoning_models',
    name: 'Extended Reasoning',
    branch: 'capabilities',
    tier: 3,
    cost: 30,
    prereqs: ['cap_reliable_agent'],
    effects: [{ kind: 'capability', delta: 7 }],
    description: 'Chain-of-thought models with explicit reasoning traces (o1-style)',
  },
  {
    id: 'cap_superhuman_coder',
    name: 'Superhuman Coder',
    branch: 'capabilities',
    tier: 4,
    cost: 40,
    prereqs: ['cap_reliable_agent', 'cap_reasoning_models'],
    effects: [{ kind: 'capability', delta: 9 }],
    description: 'AI 2027 Agent-3: Outperforms top human programmers at every task',
  },
  {
    id: 'cap_agent_swarms',
    name: 'Agent Swarms',
    branch: 'capabilities',
    tier: 4,
    cost: 38,
    prereqs: ['cap_superhuman_coder'],
    effects: [{ kind: 'capability', delta: 8 }, { kind: 'resource', key: 'compute', delta: -5 }],
    description: 'AI 2027: 200K+ parallel agent instances at 30x human speed',
  },
  {
    id: 'cap_ai_researcher',
    name: 'AI Research Automation',
    branch: 'capabilities',
    tier: 4,
    cost: 45,
    prereqs: ['cap_superhuman_coder', 'cap_agent_swarms'],
    effects: [{ kind: 'capability', delta: 10 }],
    description: 'AI 2027 Agent-4: Superhuman AI research capabilities, 50x progress',
  },
  {
    id: 'cap_recursive_improvement',
    name: 'Recursive Self-Improvement',
    branch: 'capabilities',
    tier: 5,
    cost: 50,
    prereqs: ['cap_ai_researcher'],
    effects: [{ kind: 'capability', delta: 12 }],
    description: 'AI 2027: AI designs better AI architectures autonomously',
  },
  {
    id: 'cap_superintelligence',
    name: 'Artificial Superintelligence',
    branch: 'capabilities',
    tier: 5,
    cost: 60,
    prereqs: ['cap_recursive_improvement'],
    effects: [{ kind: 'capability', delta: 15 }, { kind: 'unlockAgi' }],
    description: 'AI 2027 Agent-5: Dramatically exceeds best humans at all cognitive tasks',
  },
  {
    id: 'cap_world_model',
    name: 'World Models',
    branch: 'capabilities',
    tier: 3,
    cost: 35,
    prereqs: ['cap_multimodal', 'cap_reasoning_models'],
    effects: [{ kind: 'capability', delta: 8 }],
    description: 'Internal simulation of physical and social world dynamics',
  },

  // ============================================================================
  // SAFETY BRANCH (14 techs)
  // Progression: Basic alignment -> Interpretability -> Monitoring -> Provable safety
  // Based on Anthropic RSP, Constitutional AI, mechanistic interpretability
  // ============================================================================

  {
    id: 'safe_model_spec',
    name: 'Model Specification',
    branch: 'safety',
    tier: 1,
    cost: 15,
    prereqs: [],
    effects: [{ kind: 'safety', delta: 4 }],
    description: 'AI 2027: Written constitution defining model behavior and values',
  },
  {
    id: 'safe_rlhf',
    name: 'RLHF Training',
    branch: 'safety',
    tier: 1,
    cost: 18,
    prereqs: ['safe_model_spec'],
    effects: [{ kind: 'safety', delta: 5 }],
    description: 'Reinforcement Learning from Human Feedback for alignment',
  },
  {
    id: 'safe_constitutional_ai',
    name: 'Constitutional AI',
    branch: 'safety',
    tier: 2,
    cost: 22,
    prereqs: ['safe_rlhf', 'safe_model_spec'],
    effects: [{ kind: 'safety', delta: 6 }, { kind: 'stat', key: 'safetyCulture', delta: 2 }],
    description: 'RLAIF: AI feedback based on constitutional principles',
  },
  {
    id: 'safe_red_teaming',
    name: 'Adversarial Red Teaming',
    branch: 'safety',
    tier: 2,
    cost: 20,
    prereqs: ['safe_model_spec'],
    effects: [{ kind: 'safety', delta: 5 }],
    description: 'Systematic probing for harmful behaviors and jailbreaks',
  },
  {
    id: 'safe_mech_interp_basic',
    name: 'Basic Interpretability',
    branch: 'safety',
    tier: 2,
    cost: 24,
    prereqs: ['safe_rlhf'],
    effects: [{ kind: 'safety', delta: 6 }],
    description: 'Attention visualization and probing classifiers',
  },
  {
    id: 'safe_sparse_autoencoders',
    name: 'Sparse Autoencoders',
    branch: 'safety',
    tier: 3,
    cost: 28,
    prereqs: ['safe_mech_interp_basic'],
    effects: [{ kind: 'safety', delta: 7 }],
    description: 'SAEs for decomposing activations into monosemantic features',
  },
  {
    id: 'safe_circuit_analysis',
    name: 'Circuit Analysis',
    branch: 'safety',
    tier: 3,
    cost: 30,
    prereqs: ['safe_sparse_autoencoders'],
    effects: [{ kind: 'safety', delta: 8 }],
    description: 'Identifying computational circuits responsible for behaviors',
  },
  {
    id: 'safe_cot_monitoring',
    name: 'Chain-of-Thought Monitoring',
    branch: 'safety',
    tier: 3,
    cost: 32,
    prereqs: ['safe_constitutional_ai', 'safe_mech_interp_basic'],
    effects: [{ kind: 'safety', delta: 8 }],
    description: 'AI 2027: Automated monitoring of reasoning traces for misalignment',
  },
  {
    id: 'safe_deception_detection',
    name: 'Deception Detection',
    branch: 'safety',
    tier: 3,
    cost: 30,
    prereqs: ['safe_cot_monitoring', 'safe_red_teaming'],
    effects: [{ kind: 'safety', delta: 8 }],
    description: 'AI 2027: Identifying sycophancy, manipulation, and hidden goals',
  },
  {
    id: 'safe_scalable_oversight',
    name: 'Scalable Oversight',
    branch: 'safety',
    tier: 4,
    cost: 36,
    prereqs: ['safe_deception_detection', 'safe_circuit_analysis'],
    effects: [{ kind: 'safety', delta: 9 }],
    description: 'Human-AI teams for supervising superhuman systems',
  },
  {
    id: 'safe_alignment_tax_reduction',
    name: 'Alignment Tax Reduction',
    branch: 'safety',
    tier: 4,
    cost: 38,
    prereqs: ['safe_scalable_oversight'],
    effects: [{ kind: 'safety', delta: 9 }, { kind: 'capability', delta: 3 }],
    description: 'AI 2027: Safety measures that dont reduce capability',
  },
  {
    id: 'safe_corrigibility',
    name: 'Corrigibility Protocols',
    branch: 'safety',
    tier: 4,
    cost: 40,
    prereqs: ['safe_deception_detection', 'safe_scalable_oversight'],
    effects: [{ kind: 'safety', delta: 10 }],
    description: 'AI 2027: Ensuring AI remains controllable and correctable',
  },
  {
    id: 'safe_formal_verification',
    name: 'Formal Safety Verification',
    branch: 'safety',
    tier: 5,
    cost: 45,
    prereqs: ['safe_corrigibility', 'safe_circuit_analysis'],
    effects: [{ kind: 'safety', delta: 11 }],
    description: 'Mathematical proofs of alignment properties',
  },
  {
    id: 'safe_ai_safety_researcher',
    name: 'Automated Safety Research',
    branch: 'safety',
    tier: 5,
    cost: 50,
    prereqs: ['safe_formal_verification', 'safe_alignment_tax_reduction'],
    effects: [{ kind: 'safety', delta: 12 }, { kind: 'stat', key: 'safetyCulture', delta: 4 }],
    description: 'AI systems that autonomously improve alignment techniques',
  },

  // ============================================================================
  // COMPUTE BRANCH (13 techs)
  // Progression: Basic datacenter -> Mega clusters -> Exascale training
  // Based on AI 2027 compute forecasts and Epoch AI projections
  // ============================================================================

  {
    id: 'comp_h100_cluster',
    name: 'H100 Cluster',
    branch: 'compute',
    tier: 1,
    cost: 16,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'compute', delta: 5 }],
    description: '10K H100 GPUs - baseline frontier training capability',
  },
  {
    id: 'comp_networking',
    name: 'High-Speed Interconnect',
    branch: 'compute',
    tier: 1,
    cost: 14,
    prereqs: ['comp_h100_cluster'],
    effects: [{ kind: 'resource', key: 'compute', delta: 4 }],
    description: 'InfiniBand and NVLink for efficient distributed training',
  },
  {
    id: 'comp_1e26_training',
    name: '10^26 FLOP Training',
    branch: 'compute',
    tier: 2,
    cost: 22,
    prereqs: ['comp_h100_cluster', 'comp_networking'],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }],
    description: 'GPT-4.5 scale: 10x GPT-4 training compute',
  },
  {
    id: 'comp_next_gen_chips',
    name: 'Next-Gen AI Chips',
    branch: 'compute',
    tier: 2,
    cost: 24,
    prereqs: ['comp_h100_cluster'],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }],
    description: 'H200/B100 or custom TPUs with improved efficiency',
  },
  {
    id: 'comp_energy_contracts',
    name: 'Dedicated Power Infrastructure',
    branch: 'compute',
    tier: 2,
    cost: 20,
    prereqs: ['comp_h100_cluster'],
    effects: [{ kind: 'resource', key: 'capital', delta: 4 }],
    description: 'AI 2027: Nuclear or renewable power deals for datacenters',
  },
  {
    id: 'comp_mega_datacenter',
    name: 'Mega-Datacenter',
    branch: 'compute',
    tier: 3,
    cost: 30,
    prereqs: ['comp_1e26_training', 'comp_energy_contracts'],
    effects: [{ kind: 'resource', key: 'compute', delta: 8 }],
    description: 'AI 2027: 100K+ GPU clusters with GW-scale power',
  },
  {
    id: 'comp_1e27_training',
    name: '10^27 FLOP Training',
    branch: 'compute',
    tier: 3,
    cost: 32,
    prereqs: ['comp_mega_datacenter', 'comp_next_gen_chips'],
    effects: [{ kind: 'resource', key: 'compute', delta: 8 }],
    description: 'AI 2027 Agent-1 scale: 100x GPT-4 compute',
  },
  {
    id: 'comp_inference_fleet',
    name: 'Inference Optimization Fleet',
    branch: 'compute',
    tier: 3,
    cost: 26,
    prereqs: ['comp_mega_datacenter'],
    effects: [{ kind: 'resource', key: 'compute', delta: 6 }],
    description: 'Dedicated inference chips for running agent swarms',
  },
  {
    id: 'comp_1e28_training',
    name: '10^28 FLOP Training',
    branch: 'compute',
    tier: 4,
    cost: 40,
    prereqs: ['comp_1e27_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 10 }],
    description: 'AI 2027 Agent-2/3 scale: 1000x GPT-4 compute',
  },
  {
    id: 'comp_distributed_global',
    name: 'Global Distributed Training',
    branch: 'compute',
    tier: 4,
    cost: 35,
    prereqs: ['comp_1e28_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 8 }],
    description: 'Training across multiple datacenters worldwide',
  },
  {
    id: 'comp_centralized_zone',
    name: 'Centralized Development Zone',
    branch: 'compute',
    tier: 4,
    cost: 42,
    prereqs: ['comp_mega_datacenter', 'comp_1e28_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 10 }, { kind: 'stat', key: 'opsec', delta: 3 }],
    description: 'AI 2027: Chinas CDZ with 10% of global compute, airgapped',
  },
  {
    id: 'comp_1e29_training',
    name: '10^29 FLOP Training',
    branch: 'compute',
    tier: 5,
    cost: 50,
    prereqs: ['comp_1e28_training', 'comp_distributed_global'],
    effects: [{ kind: 'resource', key: 'compute', delta: 12 }],
    description: 'AI 2027: 5GW datacenter enabling ASI training',
  },
  {
    id: 'comp_quantum_advantage',
    name: 'Quantum-Classical Hybrid',
    branch: 'compute',
    tier: 5,
    cost: 55,
    prereqs: ['comp_1e29_training'],
    effects: [{ kind: 'resource', key: 'compute', delta: 15 }],
    description: 'Quantum computing acceleration for specific AI workloads',
  },

  // ============================================================================
  // OPS BRANCH (13 techs)
  // Progression: Basic security -> Weight protection -> Full airgapping
  // Based on RAND WSL1-5 framework and AI 2027 security forecast
  // ============================================================================

  {
    id: 'ops_basic_security',
    name: 'Basic InfoSec (WSL1)',
    branch: 'ops',
    tier: 1,
    cost: 14,
    prereqs: [],
    effects: [{ kind: 'stat', key: 'opsec', delta: 3 }],
    description: 'RAND WSL1: Defend against amateur hackers (~$1K budget)',
  },
  {
    id: 'ops_access_controls',
    name: 'Access Control Systems',
    branch: 'ops',
    tier: 1,
    cost: 16,
    prereqs: ['ops_basic_security'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 3 }],
    description: 'Role-based access, privileged user monitoring',
  },
  {
    id: 'ops_professional_security',
    name: 'Professional Security (WSL2)',
    branch: 'ops',
    tier: 2,
    cost: 20,
    prereqs: ['ops_access_controls'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 4 }],
    description: 'RAND WSL2: Defend against professional opportunistic attacks (~$10K)',
  },
  {
    id: 'ops_insider_threat',
    name: 'Insider Threat Program',
    branch: 'ops',
    tier: 2,
    cost: 22,
    prereqs: ['ops_access_controls'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 4 }],
    description: 'AI 2027: Counter employee compromise (0.5-1% baseline rate)',
  },
  {
    id: 'ops_syndicate_defense',
    name: 'Syndicate Defense (WSL3)',
    branch: 'ops',
    tier: 3,
    cost: 28,
    prereqs: ['ops_professional_security', 'ops_insider_threat'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }],
    description: 'RAND WSL3: Defend against cybercrime syndicates (~$1M)',
  },
  {
    id: 'ops_weight_encryption',
    name: 'Model Weight Encryption',
    branch: 'ops',
    tier: 3,
    cost: 26,
    prereqs: ['ops_syndicate_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }],
    description: 'End-to-end encryption of model weights at rest and in transit',
  },
  {
    id: 'ops_state_defense',
    name: 'Nation-State Defense (WSL4)',
    branch: 'ops',
    tier: 4,
    cost: 35,
    prereqs: ['ops_syndicate_defense', 'ops_weight_encryption'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 6 }],
    description: 'RAND WSL4: Defend against state intelligence agencies (~$10M/yr)',
  },
  {
    id: 'ops_airgapping',
    name: 'Critical System Airgapping',
    branch: 'ops',
    tier: 4,
    cost: 32,
    prereqs: ['ops_state_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 6 }],
    description: 'AI 2027: Physical isolation of training infrastructure',
  },
  {
    id: 'ops_compartmentalization',
    name: 'Employee Compartmentalization',
    branch: 'ops',
    tier: 4,
    cost: 30,
    prereqs: ['ops_insider_threat', 'ops_state_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 5 }],
    description: 'AI 2027: Extreme siloing - no employee sees full picture',
  },
  {
    id: 'ops_top_nation_defense',
    name: 'Top Nation Defense (WSL5)',
    branch: 'ops',
    tier: 5,
    cost: 45,
    prereqs: ['ops_airgapping', 'ops_compartmentalization'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 8 }],
    description: 'RAND WSL5: Defend against $1B multi-year operations',
  },
  {
    id: 'ops_ai_security',
    name: 'AI-Powered Security',
    branch: 'ops',
    tier: 5,
    cost: 42,
    prereqs: ['ops_top_nation_defense'],
    effects: [{ kind: 'stat', key: 'opsec', delta: 7 }, { kind: 'resource', key: 'trust', delta: 3 }],
    description: 'AI 2027: Superhuman AI for security monitoring and decision-making',
  },
  {
    id: 'ops_agent_orchestration',
    name: 'Agent Orchestration Platform',
    branch: 'ops',
    tier: 3,
    cost: 28,
    prereqs: ['ops_professional_security'],
    effects: [{ kind: 'resource', key: 'compute', delta: 4 }],
    description: 'AI 2027: Infrastructure for deploying thousands of agent copies',
  },
  {
    id: 'ops_synthetic_data',
    name: 'Synthetic Data Pipeline',
    branch: 'ops',
    tier: 2,
    cost: 22,
    prereqs: ['ops_basic_security'],
    effects: [{ kind: 'resource', key: 'data', delta: 6 }],
    description: 'AI 2027: AI-generated high-quality training data',
  },

  // ============================================================================
  // POLICY BRANCH (13 techs)
  // Progression: Industry standards -> National regulation -> International treaties
  // Based on AI governance research and compute threshold frameworks
  // ============================================================================

  {
    id: 'pol_frontier_forum',
    name: 'Frontier Model Forum',
    branch: 'policy',
    tier: 1,
    cost: 14,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'trust', delta: 4 }],
    description: 'AI 2027: Industry coordination on safety standards',
  },
  {
    id: 'pol_voluntary_commitments',
    name: 'Voluntary Safety Commitments',
    branch: 'policy',
    tier: 1,
    cost: 16,
    prereqs: ['pol_frontier_forum'],
    effects: [{ kind: 'resource', key: 'trust', delta: 4 }, { kind: 'stat', key: 'safetyCulture', delta: 1 }],
    description: 'Public pledges for responsible development practices',
  },
  {
    id: 'pol_aisi_partnership',
    name: 'AISI Partnership',
    branch: 'policy',
    tier: 2,
    cost: 20,
    prereqs: ['pol_voluntary_commitments'],
    effects: [{ kind: 'safety', delta: 4 }, { kind: 'resource', key: 'influence', delta: 3 }],
    description: 'AI 2027: Collaboration with government AI Safety Institutes',
  },
  {
    id: 'pol_compute_reporting',
    name: '10^26 FLOP Reporting',
    branch: 'policy',
    tier: 2,
    cost: 18,
    prereqs: ['pol_frontier_forum'],
    effects: [{ kind: 'resource', key: 'influence', delta: 4 }],
    description: 'Mandatory reporting for training runs above threshold',
  },
  {
    id: 'pol_rsp_adoption',
    name: 'Responsible Scaling Policy',
    branch: 'policy',
    tier: 2,
    cost: 22,
    prereqs: ['pol_aisi_partnership', 'pol_compute_reporting'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'stat', key: 'safetyCulture', delta: 2 }],
    description: 'Anthropic-style ASL framework with capability thresholds',
  },
  {
    id: 'pol_chip_export_controls',
    name: 'Chip Export Controls',
    branch: 'policy',
    tier: 3,
    cost: 26,
    prereqs: ['pol_compute_reporting'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }],
    description: 'AI 2027: Restrictions on advanced semiconductor exports',
  },
  {
    id: 'pol_international_network',
    name: 'International AISI Network',
    branch: 'policy',
    tier: 3,
    cost: 28,
    prereqs: ['pol_aisi_partnership', 'pol_rsp_adoption'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'resource', key: 'trust', delta: 4 }],
    description: 'Seoul Declaration: Global network of AI Safety Institutes',
  },
  {
    id: 'pol_kyc_compute',
    name: 'Know-Your-Customer for Compute',
    branch: 'policy',
    tier: 3,
    cost: 24,
    prereqs: ['pol_chip_export_controls'],
    effects: [{ kind: 'resource', key: 'influence', delta: 5 }],
    description: 'Cloud providers verify customer identity and use cases',
  },
  {
    id: 'pol_flop_treaty',
    name: 'FLOP Threshold Treaty',
    branch: 'policy',
    tier: 4,
    cost: 34,
    prereqs: ['pol_international_network', 'pol_kyc_compute'],
    effects: [{ kind: 'safety', delta: 6 }, { kind: 'resource', key: 'influence', delta: 6 }],
    description: 'AI 2027: International agreement on compute governance',
  },
  {
    id: 'pol_taiwan_accord',
    name: 'Taiwan Semiconductor Accord',
    branch: 'policy',
    tier: 4,
    cost: 32,
    prereqs: ['pol_chip_export_controls', 'pol_flop_treaty'],
    effects: [{ kind: 'resource', key: 'influence', delta: 7 }],
    description: 'AI 2027: Geopolitical agreement on chip supply chains',
  },
  {
    id: 'pol_iaea_for_ai',
    name: 'International AI Agency',
    branch: 'policy',
    tier: 4,
    cost: 38,
    prereqs: ['pol_flop_treaty', 'pol_international_network'],
    effects: [{ kind: 'safety', delta: 7 }, { kind: 'resource', key: 'trust', delta: 5 }],
    description: 'IAEA-style body for AI verification and inspection',
  },
  {
    id: 'pol_npt_for_ai',
    name: 'AI Non-Proliferation Treaty',
    branch: 'policy',
    tier: 5,
    cost: 45,
    prereqs: ['pol_iaea_for_ai', 'pol_taiwan_accord'],
    effects: [{ kind: 'safety', delta: 8 }, { kind: 'resource', key: 'influence', delta: 8 }],
    description: 'Comprehensive international AI arms control agreement',
  },
  {
    id: 'pol_ai_arms_control',
    name: 'Mutual AI Inspection',
    branch: 'policy',
    tier: 5,
    cost: 50,
    prereqs: ['pol_npt_for_ai'],
    effects: [{ kind: 'safety', delta: 10 }, { kind: 'resource', key: 'trust', delta: 6 }],
    description: 'AI 2027: Verification protocols for AI development limits',
  },

  // ============================================================================
  // TALENT BRANCH (11 techs)
  // Progression: Hiring -> Training -> AI-augmented research
  // Based on AI 2027 organizational dynamics
  // ============================================================================

  {
    id: 'tal_ml_hiring',
    name: 'ML Engineer Pipeline',
    branch: 'talent',
    tier: 1,
    cost: 14,
    prereqs: [],
    effects: [{ kind: 'resource', key: 'talent', delta: 5 }],
    description: 'Recruiting and onboarding ML engineering talent',
  },
  {
    id: 'tal_research_culture',
    name: 'Research Culture',
    branch: 'talent',
    tier: 1,
    cost: 16,
    prereqs: ['tal_ml_hiring'],
    effects: [{ kind: 'resource', key: 'talent', delta: 4 }, { kind: 'stat', key: 'safetyCulture', delta: 1 }],
    description: 'Environment fostering breakthrough research',
  },
  {
    id: 'tal_safety_team',
    name: 'Dedicated Safety Team',
    branch: 'talent',
    tier: 2,
    cost: 20,
    prereqs: ['tal_research_culture'],
    effects: [{ kind: 'safety', delta: 4 }, { kind: 'resource', key: 'talent', delta: 3 }],
    description: 'AI 2027: Separate team focused on alignment research',
  },
  {
    id: 'tal_elite_researchers',
    name: 'Elite Researcher Acquisition',
    branch: 'talent',
    tier: 2,
    cost: 24,
    prereqs: ['tal_ml_hiring'],
    effects: [{ kind: 'resource', key: 'talent', delta: 6 }],
    description: 'Recruiting top-tier AI researchers from academia and competitors',
  },
  {
    id: 'tal_internal_training',
    name: 'Internal Training Programs',
    branch: 'talent',
    tier: 2,
    cost: 18,
    prereqs: ['tal_research_culture'],
    effects: [{ kind: 'resource', key: 'talent', delta: 5 }],
    description: 'Upskilling existing employees on frontier techniques',
  },
  {
    id: 'tal_ai_assisted_research',
    name: 'AI-Assisted Research',
    branch: 'talent',
    tier: 3,
    cost: 26,
    prereqs: ['tal_elite_researchers', 'tal_internal_training'],
    effects: [{ kind: 'resource', key: 'talent', delta: 6 }, { kind: 'capability', delta: 2 }],
    description: 'AI tools augmenting human researcher productivity',
  },
  {
    id: 'tal_safety_researcher_pipeline',
    name: 'Safety Researcher Pipeline',
    branch: 'talent',
    tier: 3,
    cost: 28,
    prereqs: ['tal_safety_team', 'tal_internal_training'],
    effects: [{ kind: 'safety', delta: 5 }, { kind: 'resource', key: 'talent', delta: 4 }],
    description: 'Dedicated track for training alignment researchers',
  },
  {
    id: 'tal_human_ai_teams',
    name: 'Human-AI Research Teams',
    branch: 'talent',
    tier: 4,
    cost: 35,
    prereqs: ['tal_ai_assisted_research'],
    effects: [{ kind: 'resource', key: 'talent', delta: 8 }, { kind: 'capability', delta: 3 }],
    description: 'AI 2027: Integrated teams of humans and AI researchers',
  },
  {
    id: 'tal_global_talent_network',
    name: 'Global Talent Network',
    branch: 'talent',
    tier: 4,
    cost: 32,
    prereqs: ['tal_elite_researchers'],
    effects: [{ kind: 'resource', key: 'talent', delta: 7 }, { kind: 'resource', key: 'influence', delta: 3 }],
    description: 'International research collaborations and partnerships',
  },
  {
    id: 'tal_automated_researchers',
    name: 'Automated AI Researchers',
    branch: 'talent',
    tier: 5,
    cost: 45,
    prereqs: ['tal_human_ai_teams'],
    effects: [{ kind: 'resource', key: 'talent', delta: 10 }, { kind: 'capability', delta: 5 }],
    description: 'AI 2027: 200K parallel AI researcher instances',
  },
  {
    id: 'tal_cognitive_enhancement',
    name: 'Researcher Cognitive Enhancement',
    branch: 'talent',
    tier: 5,
    cost: 48,
    prereqs: ['tal_automated_researchers', 'tal_global_talent_network'],
    effects: [{ kind: 'resource', key: 'talent', delta: 12 }],
    description: 'Brain-computer interfaces augmenting human researchers',
  },
];

// Helper functions for the expanded tech tree

export const getTechsByBranch = (branch: ExtendedBranchId): ExtendedTechNode[] =>
  TECH_TREE_EXPANDED.filter((tech) => tech.branch === branch);

export const getTechsByTier = (tier: number): ExtendedTechNode[] =>
  TECH_TREE_EXPANDED.filter((tech) => tech.tier === tier);

export const getTechById = (id: string): ExtendedTechNode | undefined =>
  TECH_TREE_EXPANDED.find((tech) => tech.id === id);

export const getPrereqTree = (techId: string): string[] => {
  const tech = getTechById(techId);
  if (!tech) return [];

  const prereqs: string[] = [...tech.prereqs];
  for (const prereqId of tech.prereqs) {
    prereqs.push(...getPrereqTree(prereqId));
  }
  return [...new Set(prereqs)];
};

// Statistics
export const TECH_TREE_STATS = {
  totalTechs: TECH_TREE_EXPANDED.length,
  byBranch: {
    capabilities: getTechsByBranch('capabilities').length,
    safety: getTechsByBranch('safety').length,
    compute: getTechsByBranch('compute').length,
    ops: getTechsByBranch('ops').length,
    policy: getTechsByBranch('policy').length,
    talent: getTechsByBranch('talent').length,
  },
  byTier: {
    tier1: getTechsByTier(1).length,
    tier2: getTechsByTier(2).length,
    tier3: getTechsByTier(3).length,
    tier4: getTechsByTier(4).length,
    tier5: getTechsByTier(5).length,
  },
};
