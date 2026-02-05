import { createInitialState } from './core/state.js';
import { resolveTurn } from './core/engine.js';
import { mulberry32, round1 } from './core/utils.js';
import { decideActions } from './ai/decideActions.js';

const args = process.argv.slice(2);
const getArgValue = (flag: string, fallback: string): string => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
};

const isSim = args.includes('--sim');
const turns = Number(getArgValue('--turns', '32'));
const seed = Number(getArgValue('--seed', '42'));
const showLog = args.includes('--log');

if (!isSim) {
  console.log('Usage: npm run sim -- --turns 32 --seed 42 --log');
  process.exit(0);
}

const run = async (): Promise<void> => {
  const rng = mulberry32(seed);
  const state = createInitialState();

  for (let i = 0; i < turns; i += 1) {
    const choices: Record<string, Awaited<ReturnType<typeof decideActions>>> = {};
    for (const factionId of Object.keys(state.factions)) {
      choices[factionId] = await decideActions(state, factionId, rng);
    }

    resolveTurn(state, choices, rng);

    if (showLog) {
      for (const entry of state.log) {
        console.log(entry);
      }
      state.log.length = 0;
    }

    if (state.gameOver) break;
  }

  console.log('--- Summary ---');
  for (const faction of Object.values(state.factions)) {
    console.log(
      `${faction.name}: cap ${round1(faction.capabilityScore)} / safety ${round1(faction.safetyScore)} / trust ${round1(
        faction.resources.trust,
      )} / compute ${round1(faction.resources.compute)}`,
    );
  }
  console.log(`Global Safety: ${round1(state.globalSafety)}`);
  if (state.gameOver) {
    if (state.winnerId) {
      console.log(`Winner: ${state.factions[state.winnerId].name}`);
    } else {
      console.log('Outcome: Global catastrophe');
    }
  } else {
    console.log('Outcome: No AGI deployment yet');
  }
};

run().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
