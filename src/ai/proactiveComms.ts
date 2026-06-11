import type { GameState } from '../core/types.js';
import { clamp } from '../core/utils.js';

export type ProactiveComms = {
  fromFactionId: string;
  content: string;
};

const tensionKey = (a: string, b: string): string => [a, b].sort().join(':');

const getPairTension = (state: GameState, a: string, b: string): number =>
  state.tensions.get(tensionKey(a, b)) ?? 0;

const isAllied = (state: GameState, a: string, b: string): boolean =>
  (state.alliances.get(a) ?? []).includes(b) || (state.alliances.get(b) ?? []).includes(a);

type Candidate = {
  fromFactionId: string;
  score: number;
  content: string;
};

export const generateProactiveComms = (
  state: GameState,
  playerFactionId: string,
  rng: () => number,
  lastInboundTurnByFaction: Map<string, number>,
): ProactiveComms[] => {
  const player = state.factions[playerFactionId];
  if (!player) return [];

  const labs = Object.values(state.factions).filter((f) => f.type === 'lab');
  const leader = labs.sort((a, b) => b.capabilityScore - a.capabilityScore)[0];
  const playerLeads = leader?.id === playerFactionId;

  const candidates: Candidate[] = [];

  for (const faction of Object.values(state.factions)) {
    if (faction.id === playerFactionId) continue;

    const lastTurn = lastInboundTurnByFaction.get(faction.id) ?? -999;
    if (state.turn - lastTurn < 2) continue; // anti-spam: at most once every 2 turns per faction

    const tension = getPairTension(state, faction.id, playerFactionId);
    const allied = isAllied(state, faction.id, playerFactionId);
    const capabilityGap = player.capabilityScore - faction.capabilityScore;
    const playerSafetyGap = player.capabilityScore - player.safetyScore;

    // High tension: warnings / demands
    if (tension >= 45) {
      const severity = tension >= 70 ? 'high' : 'medium';
      const warning =
        faction.type === 'government'
          ? `${faction.name}: Your trajectory is driving instability. Provide credible safety assurances or expect tighter controls.`
          : `${faction.name}: We’re tracking your moves. If you escalate further, expect countermeasures.`;
      candidates.push({
        fromFactionId: faction.id,
        score: 120 + tension + (severity === 'high' ? 15 : 0),
        content: warning,
      });
      continue;
    }

    // Alliance maintenance: safety coordination when the world is risky
    if (allied && state.globalSafety < 50) {
      candidates.push({
        fromFactionId: faction.id,
        score: 95 + (50 - state.globalSafety),
        content: `${faction.name}: Channel check-in. We should coordinate safety posture this quarter to avoid accidental escalation.`,
      });
      continue;
    }

    // Governments proactively pressure unsafe leading labs
    if (faction.type === 'government' && player.type === 'lab') {
      if (playerSafetyGap >= 18 || player.resources.trust < 35 || state.globalSafety < 45) {
        const ask =
          player.resources.trust < 35
            ? `${faction.name}: Your public trust is fragile. Any major capability leap will trigger scrutiny—signal restraint and publish safety evidence.`
            : `${faction.name}: We need a clear safety case for your next capability push. Voluntary safeguards can prevent harsher intervention.`;
        candidates.push({
          fromFactionId: faction.id,
          score: 80 + clamp(0, 30, playerSafetyGap) + clamp(0, 20, 45 - state.globalSafety),
          content: ask,
        });
      }
    }

    // Rival labs reach out if the player is running away with capability
    if (faction.type === 'lab' && playerLeads && capabilityGap >= 12) {
      const offer =
        state.globalSafety < 48
          ? `${faction.name}: Quiet proposal: a limited safety standard (evaluations + incident reporting). It reduces mutual risk without full coordination.`
          : `${faction.name}: We’re open to limited cooperation—compute-sharing or joint benchmarks—if the terms are credible and reciprocal.`;
      candidates.push({
        fromFactionId: faction.id,
        score: 70 + clamp(0, 40, capabilityGap),
        content: offer,
      });
    }
  }

  if (!candidates.length) return [];
  candidates.sort((a, b) => b.score - a.score);
  const pick = candidates[0]!;

  // Probabilistic send to avoid “every turn” chatter; higher score => more likely.
  const probability = clamp(0.18, 0.78, pick.score / 170);
  if (rng() >= probability) return [];

  lastInboundTurnByFaction.set(pick.fromFactionId, state.turn);
  return [{ fromFactionId: pick.fromFactionId, content: pick.content }];
};

