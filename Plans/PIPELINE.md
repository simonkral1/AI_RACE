# AGI Race — Autonomous Overhaul Pipeline

**Director:** Claude (Fable 5, PAI primary). **Started:** 2026-06-11.
**Mandate from Simon:** Overhaul the whole game — visuals, playability, menus, icons, professional look & feel — and keep improving it continually toward an actually good strategy game that uses LLMs as the in-game AIs. Run through the night until finished or limits are hit.

This file is the pipeline's persistent memory. Every iteration reads it first and appends to the changelog. It supersedes the old shell-based loops in `scripts/` (autonomous_dev_loop.sh etc.) for this run — do not start those.

## Definition of done (v1.0)
A new player can: launch, pick a faction, understand what to do within 2 minutes, play a full 32-turn campaign without crashes or dead-ends, experience a narrative arc with consequential events, read every screen without squinting, and lose/win in a way that feels earned. The game looks like a shipped indie strategy title, not a prototype.

## Operating rules
1. **Model tiering:** sonnet for implementation agents and routine QA, haiku for mechanical chores, Fable (me) only for design direction, review, and hard debugging.
2. **Verification gates (every iteration):** `npx tsc --noEmit` clean → `npm test` green (known-failing `tests/ai/heuristic.test.ts` excluded — pre-existing, deprecated system) → headless Playwright smoke (`npm run qa:playtest` or targeted script) → screenshot review by director at 1440px before marking an item done.
3. **Never break:** `?no_llm=1` deterministic mode; the agent-server API contract (`/api/agents/respond` on :8788). The OpenRouter llm-proxy (:8787) is **deprecated** — GM narration migrates to the Claude Agent SDK (see P6.0); until migration lands, keep the client functional with the proxy running.
4. **Server health:** before browser verification, check ports 5173/8787/8788 with lsof; restart dead processes in background from the repo root.
5. **LLM spend:** automated playtests run deterministic (`?no_llm=1`); live-LLM smoke tests sparingly (decision pending Simon's answer).
6. **Git:** policy pending Simon's answer (branch vs main). Whatever the answer: commit after each verified item, descriptive messages, never force-push, never touch remotes unless asked.
7. **Surgical changes:** never delete/rearchitect a working component to fix a bug; smallest change that fixes the defect. Visual overhaul is allowed to restyle, not to silently drop features.
8. **Logs:** append one changelog line per completed item below; longer notes to `output/overnight/director-YYYYMMDD.md`.

## Workstreams (priority order)

### P0 — Stability & trust (blockers, do first)
- [x] **P0.1** ~~Fix campaign-ending crash~~ **Root-caused 2026-06-12 (director):** the "Campaign Complete / Safety 0" unstyled screen is index.html's *static skeleton* rendered with no CSS/JS — a hard page reload where Vite's module graph failed to boot (dev-env flake), NOT a game-logic bug. Event keys are correct camelCase; deterministic full event cycle verified clean via `output/overnight/repro_crash.mjs` (styles intact, no errors, game continues). Player-facing damage (run lost) already fixed by P0.2 autosave. Hardening folded into P0.3 (skeleton/boot fallback) and P0.4 (regression test, double-click guard).
- [x] **P0.2** Autosave + resume: persist campaign every turn (localStorage via saveManager), "Continue campaign" on load, survive Vite HMR and reload. *(Merged 52c649f; unit + boot verified. Interactive resume click-through rides on the P7.2 smoke-harness rebuild.)*
- [x] **P0.3** Endgame screen: style it properly (victory AND loss), with stats summary and "New campaign" CTA. No raw HTML fallback ever. PLUS skeleton hardening: endgame overlay hidden via `hidden` attribute (not CSS-class-only), inline critical shell CSS or styled boot-failure notice so a JS-dead page never shows raw markup; render() error boundary.
- [x] **P0.4** Quick-fix batch: `+-5` effect formatting; raw stat keys in UI chips (`safetyculture` → "Safety Culture"); modal fade ≤300ms; tech-tier headers scroll with canvas; "you" map marker clipped under left panel; victory-progress emoji bars get labels/tooltips; event-choice buttons disabled after first click (double-click guard); regression unit test applying EVERY event choice in events.ts asserting no NaN/undefined stats and no spurious turn-2 endgame.

### P1 — Visual foundation (design system before cosmetics)
- [ ] **P1.1** Design tokens: color palette (semantic roles), type scale, spacing, radii, shadows, motion durations in one CSS file; both themes (light editorial + dark map-centric) driven by tokens.
- [ ] **P1.2** Icon system: replace emoji/ad-hoc icons with a consistent SVG set (Lucide-style), sized/weighted uniformly; faction sigils.
- [ ] **P1.3** Component pass: buttons, chips, cards, modals, tabs, tooltips unified to the tokens. Fix locked-tech-card contrast (names must be readable).
- [ ] **P1.4** Menus & shell polish: faction select, intro/briefing, settings, top bar — professional layout, hierarchy, hover/focus states.

### P2 — Adjustable panel layout
- [ ] **P2.1** Resizable splitters on left/right panels (drag, persisted to localStorage).
- [ ] **P2.2** Collapsible sections (accordion) in both panels; faction cards collapse to one-line rows with microbars.
- [ ] **P2.3** Full panel collapse to icon rails, `[` / `]` shortcuts, map full-bleed mode.
- [ ] **P2.4** Bottom dockable console with tabs: Diplomacy / Turn log / Event history (replaces fixed diplomatic-traffic box). Fix right-panel sticky-section overlap.

### P3 — Map: from backdrop to instrument
- [ ] **P3.1** Marker interactivity: hover tooltips (name + key stats), click → faction inspector popover with "Open comms" action.
- [ ] **P3.2** Legend chips become toggles; persistent alliance/tension overlay lines reflecting current relations.
- [ ] **P3.3** State accumulation: datacenter dots scale with compute, capability glow per HQ, event pins at real locations that persist.
- [ ] **P3.4** Turn-resolution as theater: sequence phase beats as map animations with captions during the ~45s resolve.
- [ ] **P3.5** Timeline scrubber to replay past quarters.

### P4 — Tech tree overhaul
- [ ] **P4.1** Interaction model: click = select + detail; explicit Research button; no instant-spend misclicks.
- [ ] **P4.2** Unified zoomable graph across all branches (colored lanes, cross-branch prereq edges visible) replacing tabs-only view.
- [ ] **P4.3** Realism ladder & era bands: scaling → post-training → reasoning/inference-compute → agents → automated AI R&D → RSI; big runs gated by compute thresholds, not just RP.
- [ ] **P4.4** Doctrine forks (mutually exclusive): e.g. open-weights vs closed frontier; surveillance-monitoring vs audited transparency.
- [ ] **P4.5** QoL: turns-to-afford on nodes, research queue, path-to-target highlighting.

### P5 — Events & storyboard
- [ ] **P5.1** Write `Plans/STORYBOARD.md`: three acts keyed to capability milestones (Act I products/regulation, Act II agents/theft/state entanglement, Act III RSI/treaty/alignment crisis), beats, triggers, escalation rules.
- [ ] **P5.2** Act system in engine: acts gate event pools; GM and faction agents receive act context (tone escalates).
- [ ] **P5.3** Wire in `eventsExpanded.ts` (1,887 lines, currently fallback-only); dedupe with base events.
- [ ] **P5.4** Event chains with memory: choice flags schedule follow-up events 2–4 turns later.
- [ ] **P5.5** Deterministic milestone events as anchors (first AGI deploy, first lab-state alliance, capability−safety gap incident).
- [ ] **P5.6** Pacing: smooth tension/safety derivatives (no unexplained Low→Severe in one quarter); narrate causes.

### P6 — Agents & advisor (the LLM soul)
- [ ] **P6.0** Migrate GM narration off OpenRouter/Gemini onto the **Claude Agent SDK** (Simon's directive 2026-06-11): serve GM from agentServer.ts (:8788) alongside faction agents, default **Sonnet 4.6 low effort** (configurable up to Opus low reasoning). Point the client at it, then retire `server/llmProxy.ts` and the `llm-proxy` npm script; two-process dev workflow afterward.
- [ ] **P6.1** Persona stakes: faction agents counter-offer, demand exclusivity, refuse off-brand deals (Nexus shouldn't instantly accept safety pacts), occasionally deceive; act-aware stance.
- [ ] **P6.2** Binding proposals: a diplomacy action distinct from cheap talk, with mechanical effect and visible state.
- [ ] **P6.3** Analyst situational awareness: injected game-state summary (affordable techs, rival moves, victory distance).
- [ ] **P6.4** Latency UX: stream agent/GM text where possible; phase-progress indicators during resolve.

### P7 — Playability & balance
- [ ] **P7.1** Onboarding: first-turn guided callouts (existing tutorial.ts audit/extend); "what do I do" affordances.
- [x] **P7.2a** Rebuild `scripts/playtest_assert.mjs` against the current UI: boot → continue-or-new campaign → faction select → lock directive → advance quarter (deterministic) → event choice → assert no console errors/unstyled DOM at each step, screenshots to output/overnight/. This is the pipeline's regression smoke for every later wave.
- [ ] **P7.2** Automated playtest harness: scripted full-campaign runs in `?no_llm=1`, assert no crash, victory/loss reachable, stat ranges sane; run nightly each iteration.
- [ ] **P7.3** Balance pass from playtest telemetry: income curves, tech costs, victory condition tuning (typical win turn 18–28 target).
- [ ] **P7.4** Juice: micro-animations on stat changes, turn-start/end transitions, sound hooks (audio.ts exists).

## Iteration protocol (each wakeup)
1. Read this file + `output/overnight/director-<today>.md`; check server health.
2. Pick the highest-priority unchecked item(s); at most 2–3 concurrent implementation agents (sonnet), non-overlapping files.
3. Agents implement with tests; director reviews diffs, runs gates, screenshot-verifies in headless browser.
4. Commit per policy; tick checkbox; append changelog line; update director log.
5. Reassess priorities (playtest findings can reorder); schedule next wakeup.

## Changelog
- 2026-06-11: Pipeline charter created from live design review (see session). Baseline: repo clean at 75d9be2.
- 2026-06-11: P0.2 autosave/resume merged (52c649f): versioned v2 saves, autosave on turn+event resolution, Continue-campaign boot overlay, 13 new tests. Gates: tsc clean, 287 pass / 12 known-fail, headless boot clean.
- 2026-06-11: Infra: vitest now excludes `.claude/worktrees/**` and `.codex/**` (agent worktrees were being re-collected). `scripts/playtest_assert.mjs` found stale (`#startGame` no longer exists) → smoke-harness rebuild queued as urgent P7.2a.

## Changelog (cont.)
- 2026-06-12: Wave 2 merged — P0.3 endgame+hardening, P0.4 quick-fix batch (8 fixes, 37 tests), P7.2a smoke harness (6 scenarios, 61s). Gates: tsc clean, 324 pass/12 known-fail, smoke 6/6, screenshots reviewed. P0 COMPLETE.
- 2026-06-12: Watch-item: endgame banner shows internal faction id-style name ("US AI Lab Alpha") — fix display names in P1.3 component pass.

## Decisions log
- 2026-06-11: Old shell loops in `scripts/` superseded by director-run pipeline for this effort.
- 2026-06-11 (Simon): Git → all work on `overhaul` branch from 75d9be2; main untouched; he merges.
- 2026-06-11 (Simon): Art direction → **Hybrid**: dark cinematic command-center in-game, editorial light menus/briefings/reports.
- 2026-06-11 (Simon): LLM spend → deterministic `?no_llm=1` playtests + sparing live smoke tests per milestone.
- 2026-06-11 (Simon): **No OpenRouter anywhere.** All in-game LLM (faction agents, GM, analyst) through the Claude Agent SDK. GM = Sonnet low effort (or Opus low reasoning) → P6.0.
