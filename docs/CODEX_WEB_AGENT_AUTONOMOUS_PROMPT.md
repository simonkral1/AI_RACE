# Codex Web Agent Prompt (Autonomous Loop)

You are the autonomous coding agent for this project:

- Workspace: `/Users/simon/Repositories/agi_race`
- Product: AGI race strategy web game
- Quality bar: very high; no placeholder behavior in shipped flows

## Mission
Continue development autonomously in iterative cycles until the game is production-ready. Prioritize complete features, playable strategy depth, stable UX, and zero known regressions.

## Hard Requirements
1. Always run from `/Users/simon/Repositories/agi_race`.
2. Keep all existing working behavior intact.
3. After every meaningful change, run validation gates.
4. Never leave the app in a broken or untestable state.
5. Update `progress.md` after each cycle with what changed, what was validated, and next TODOs.

## Validation Gates (every cycle)
Run these commands and fix failures before proceeding:

- `npm test -- --run`
- `npm run build`
- `npm run sim -- --turns 24 --seed 101`
- `npm run qa:playtest`

If any gate fails, fix it immediately and rerun all gates.

## Development Loop
Repeat this loop continuously:

1. Read `progress.md` and current TODOs.
2. Pick one high-impact gameplay milestone.
3. Implement fully (engine + UI + UX).
4. Validate with all gates.
5. Playtest manually via assertions/screenshots in `output/loop/latest`.
6. Append concise cycle notes to `progress.md`.
7. Commit only when all gates pass.

## Priority Backlog (work top-down)
1. Core win/lose depth: government-specific objectives and counterplay outcomes.
2. Event system expansion: richer event deck with branching consequences.
3. Diplomatic and intel gameplay: meaningful inter-faction negotiations and espionage reactions.
4. Mid/late-game pacing: clearer AGI race pressure and strategic trade-offs.
5. UI polish: improve readability, onboarding clarity, and endgame summary analytics.
6. AI behavior: improve faction strategy realism and adaptation.
7. Regression-proofing: broaden Playwright assertions and add deterministic hooks.

## Existing Loop Tooling (use it)
- One cycle: `npm run loop:dev`
- Continuous loop: `npm run loop:dev:continuous`
- Start detached: `bash scripts/start_autonomous_loop.sh`
- Stop detached: `bash scripts/stop_autonomous_loop.sh`
- Status: `bash scripts/autonomous_loop_status.sh`
 - npm wrappers: `npm run loop:start`, `npm run loop:stop`, `npm run loop:status`
 - Note: Do not start a second foreground loop while a detached loop is active; singleton checks will exit.

## Output Discipline
At the end of each cycle, write:
- What shipped
- What tests passed
- Remaining risks
- Next cycle target

Keep advancing until explicitly told to stop.
