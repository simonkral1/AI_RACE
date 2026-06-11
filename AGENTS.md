# AGI Race Agent Handoff

Last updated: 2026-06-11

Update (2026-06-11): UI overhaul on branch `ui-overhaul`.
  - Command center decluttered: removed vestigial Geopolitical Map section (duplicated canvas world map). Remaining sections: turn bar (advance button), directive locker + locked directives, turn review / action dossier, AGI frontier race, strategic situations, faction stats, victory progress, directive input, action bar (tech/analyst/comms/events), narrative timeline.
  - Tech tree now renders as a left-to-right tier graph (BranchScreen.ts) with SVG bezier-curve connectors between prerequisite nodes. Locked/available/owned edges use distinct styles. Layout uses calcGridLayout which minimises line crossings.
  - Capabilities branch has 3 explicit sub-paths: Scaling (long_context → compute_optimal_training → world_models), Agents (tool_use → unreliable_agent → coding_automation → reliable_agent → agent_swarms), Reasoning (chain_of_thought → inference_time_compute → extended_reasoning). All three converge at superhuman_coder.
  - Safety branch has 3 explicit sub-paths: Interpretability (basic_interp → sparse_autoencoders → circuit_analysis → feature_steering), Alignment (rlhf → constitutional_ai → cot_monitoring → value_alignment), Governance (evals_framework → red_teaming → adversarial_robustness → staged_deployment). All converge at scalable_oversight.
  - IntroSequence rewritten as 4 narrative beats + 1 optional mechanics beat (techno-thriller tone). Faction selection screen adds 1-2 sentence descriptions per faction (identity, playstyle, special ability, victory path).

Update (2026-06-10): The central screen is a cinematic canvas satellite map
(`src/ui/components/WorldMapCanvas.ts`, NASA Blue Marble textures in `public/assets/`; the older SVG
`WorldMap.ts` is unused). Layout is `layout--three-col`: factions | map | command center. Turns run a
negotiation phase (`src/ai/negotiation.ts`) before AI decisions. AI factions are persistent Claude agents:
`server/agentServer.ts` (`npm run agent-server`, port 8788, claude-sonnet-4-6 at low effort, one resumed
session per faction per game) with browser client `src/ai/agentClient.ts`; fallback chain is agent ->
OpenRouter proxy -> deterministic. Alliances are consent-based: `propose_alliance` messages and the player's
"Propose Alliance" dossier button route through `/api/agents/respond` (the target's agent accepts/declines);
AI factions cannot take the unilateral `form_alliance` action. `npx tsc --noEmit` passes. Quick full check:
`node scripts/verify_map_setup.mjs` (needs Vite :5173 + llm-proxy :8787 + agent-server :8788; live turns
take ~1-2 min because Sonnet agents think).

This file is the fast-start context for future coding agents working in this repo.
For full chronology, also read `progress.md` from top to bottom.

TODO (2026-04-24): Re-scan for new workflows after the next script/package changes; no net-new commands were discovered in this run.

## Current Product State

- Game type: turn-based AGI strategy simulation with 5 factions (3 labs, 2 governments).
- Start flow:
  - `/` opens the multi-step intro briefing (`IntroSequence`) before faction selection.
  - `/?autostart=1` skips intro and starts immediately.
- Initial canonical game state (from `createInitialState()`):
  - `year=2026`, `quarter=1`, `turn=0`, `gameOver=false`
  - 5 factions loaded from templates
  - `globalSafety` computed at startup (do not hardcode)
- Player-facing control center is the expanded command center (not the old dashboard/orders layout).

## UI Contract (Use These Selectors)

Use these selectors in tests and automation:

- World map (central screen): `.world-map__svg`
- Map faction markers: `.world-map__marker[data-faction-id]` (click the inner `.world-map__marker-core`)
- Map dossier: `.world-map__dossier`, target actions `.world-map__dossier-action-btn[data-action-id]`
- Diplomacy feed: `.world-map__feed-item` / `.world-map__feed-message`
- Comms arcs: `.world-map__arc--comms` (tension: `--tension`, alliance: `--alliance`)
- Advance turn: `.command-center__advance-btn`
- Directive input: `.command-center__directive-input`
- Directive submit: `.command-center__directive-submit`
- Tech modal trigger: `.command-center__action-btn--tech`
- Event choices: `.event-modal__choice`
- Gear menu reset path: `#gearMenuBtn` then `#gearReset`
- Game state hook: `window.render_game_to_text()`

Avoid legacy selectors unless you confirm they still exist:

- `#nextTurn`
- `.global-dashboard__btn--advance`
- `.event-panel__choice` / `#eventPanel`
- `.orders` legacy assumptions

## LLM and Deterministic Test Mode

- Browser LLM calls are routed through `src/ai/llmClient.ts`.
- Query param `no_llm=1` disables browser-side LLM calls (`callLlm` returns `null`), which makes automated browser runs deterministic and faster.
- Use `?no_llm=1` in browser tests unless you are explicitly validating live LLM behavior.
- Proxy paths (`vite.config.ts`, `server/llmProxy.ts`) now degrade gracefully on failure (no hard 500 crash path for UI flows).
- Local LLM proxy: `npm run llm-proxy` (defaults to `http://127.0.0.1:8787` via `LLM_PROXY_PORT`; Vite proxy can be overridden with `VITE_LLM_PROXY_URL`). Requires `OPENROUTER_API_KEY` for real responses; otherwise returns `content: null` in degraded mode.

## Test Status Snapshot

- Browser E2E gameplay suites are aligned with current UI and passing:
  - `tests/e2e/game.spec.ts` (18 passing)
  - `tests/e2e/endgame.spec.ts` (8 passing)
- Focused deterministic gameplay slices are currently the most reliable quick check during ongoing intro/directive flow changes:
  - `npx playwright test tests/e2e/game.spec.ts -g "natural-language directive|action review does not auto-block" --reporter=list`
- Deterministic gameplay assertions:
  - `scripts/playtest_assert.mjs` uses `?autostart=1&no_llm=1` and current selectors.
- Type-checking is a separate gate and currently fails:
  - `npx tsc --noEmit`
  - Current failures include `src/core/persistence.ts` and `src/ui/main.ts` type mismatches.
- Unit/integration test suites outside E2E currently have known failures (see `progress.md` latest entries). Do not assume `npm test` is green.

## Continuous Browser Monitoring

Continuous in-browser gameplay testing is set up:

- Loop process PID file: `output/loop/browser-gameplay-loop.pid`
- Loop log: `output/loop/browser-gameplay-loop.log`
- Dev server PID file (when launched by loop tooling): `output/loop/dev-server.pid`
- Dev server log (when launched by loop tooling): `output/loop/dev-server.log`
- Watchdog script: `scripts/browser_gameplay_watchdog.sh`
- Watchdog PID file: `output/loop/browser-gameplay-watchdog.pid`
- Watchdog log: `output/loop/browser-gameplay-watchdog.log`

Watchdog checks every 30 seconds and restarts the gameplay loop if it dies.

## Autonomous Dev Loop (Codex Web Agent)

Autonomous loop guidance and gates live in `docs/CODEX_WEB_AGENT_AUTONOMOUS_PROMPT.md`.
It assumes you run from `/Users/simon/Repositories/agi_race` and update `progress.md` after each cycle.
Validation gates used by the loop (may currently fail; see `progress.md`):

- `npm test -- --run`
- `npm run build`
- `npm run sim -- --turns 24 --seed 101`
- `npm run qa:playtest`

Loop commands:

- One cycle: `npm run loop:dev`
- Continuous: `npm run loop:dev:continuous`
- Tunable foreground loop (custom cycles/sleep): `bash scripts/autonomous_dev_loop.sh --cycles 5 --sleep 10`
- Start detached: `npm run loop:start` (or `bash scripts/start_autonomous_loop.sh`)
- Stop detached: `npm run loop:stop` (or `bash scripts/stop_autonomous_loop.sh`)
- Status: `npm run loop:status` (or `bash scripts/autonomous_loop_status.sh`)
- Overnight validation loop (logs in `output/overnight`): `npm run loop:overnight`
- Tunable overnight loop (max-cycles/sleep-seconds args): `bash scripts/overnight_loop.sh 50 30`
- Claude task-queue loop (uses `scripts/task_queue.json`): `npm run loop:claude`
- Tunable Claude task-queue loop (max tasks): `bash scripts/claude_dev_loop.sh 20`
- Path note: `scripts/overnight_loop.sh` and `scripts/claude_dev_loop.sh` currently hardcode `ROOT="/Users/simon/Repositories/agi_race"`; run these from that repo path (or update `ROOT`) when using alternate worktrees.
- Note: Do not start a second foreground loop while a detached loop is active; singleton checks will exit.
- Autonomous dev loop artifacts (when running `loop:dev` / `loop:dev:continuous`):
  - Loop PID: `output/loop/loop.pid`
  - Loop lock: `output/loop/loop.lock`
  - Loop log: `output/loop/dev-loop.log`
  - Vite log (if loop starts dev server): `.vite.loop.log`
  - Per-cycle artifacts: `output/loop/cycle-*/`
  - Latest aggregated artifacts (playtest screenshots/state): `output/loop/latest/`
- Overnight loop artifacts:
  - Session logs: `output/overnight/session-*.log`
  - Metrics: `output/overnight/metrics-*.json`
  - Latest status: `output/overnight/latest.json`

## Operational Commands

- Start Vite dev server:
  - `npm run dev`
- Run CLI directly (no Vite UI):
  - `npm run dev:cli`
- Run gameplay suites once:
  - `npx playwright test tests/e2e/game.spec.ts tests/e2e/endgame.spec.ts --reporter=list`
- Start continuous browser gameplay loop (detached):
  - `mkdir -p output/loop && nohup bash -lc 'while true; do npx playwright test tests/e2e/game.spec.ts tests/e2e/endgame.spec.ts --reporter=line; sleep 20; done' >> output/loop/browser-gameplay-loop.log 2>&1 & echo $! > output/loop/browser-gameplay-loop.pid`
- Start watchdog (detached; auto-restarts gameplay loop):
  - `mkdir -p output/loop && nohup bash scripts/browser_gameplay_watchdog.sh >/dev/null 2>&1 & echo $! > output/loop/browser-gameplay-watchdog.pid`
- Run all E2E specs:
  - `npm run test:e2e`
- Run all tests (unit + E2E):
  - `npm run test:all`
- Watch unit tests:
  - `npm run test:watch`
- Preview production build locally:
  - `npm run preview`
- Run deterministic playtest assertions:
  - `npm run qa:playtest`
- Run CLI sim (24 turns, deterministic seed):
  - `npm run sim -- --turns 24 --seed 101`
- Check loop status:
  - `ps -p $(cat output/loop/browser-gameplay-loop.pid)`
- Check dev server status:
  - `ps -p $(cat output/loop/dev-server.pid)`
- Check watchdog status:
  - `ps -p $(cat output/loop/browser-gameplay-watchdog.pid)`
- Tail logs:
  - `tail -f output/loop/browser-gameplay-loop.log`
  - `tail -f output/loop/dev-server.log`
  - `tail -f output/loop/browser-gameplay-watchdog.log`
  - `tail -f output/loop/nohup.log`
- Stop both:
  - `kill $(cat output/loop/browser-gameplay-loop.pid) $(cat output/loop/browser-gameplay-watchdog.pid)`
- Vite dev server launched by agent tooling (if present):
  - PID file: `.vite.agent.pid`
  - Log file: `.vite.agent.log`
  - Stop: `kill $(cat .vite.agent.pid)`
- Copy the Codex Web Agent prompt to clipboard:
  - `npm run prompt:codex-web`

## Where to Continue Work

Short-term recommended focus:

1. Keep browser gameplay loop stable and green.
2. Fix currently failing non-E2E suites (`state`, `victoryConditions`, `engine`, `ai/gamemaster`, `ai/llmClient`).
3. Preserve command-center + intro-sequence architecture while extending game depth.
