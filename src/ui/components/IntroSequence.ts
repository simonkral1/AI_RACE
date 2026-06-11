/**
 * IntroSequence — Multi-step story intro and tutorial delivered by the strategic analyst.
 *
 * Replaces the simple faction-pick overlay with a cinematic briefing that teaches
 * new players the setting, stakes, and core mechanics before they choose a faction.
 */

import { FACTION_TEMPLATES, type FactionTemplate } from '../../data/factions.js';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface IntroCallbacks {
  /** Called when the player finishes the intro and picks a faction. */
  onComplete: (selectedFactionId: string) => void;
  /** Called if the player skips straight to faction select. */
  onSkip: () => void;
}

export interface IntroOpenOptions {
  /** If false, skip briefing pages and open directly on faction selection. */
  showBriefing?: boolean;
}

interface IntroStep {
  id: string;
  title: string;
  /** Analyst briefing lines — rendered one at a time with a typewriter feel. */
  lines: string[];
  /** Optional aside / flavour label shown above the title. */
  label?: string;
}

// ── Intro script ───────────────────────────────────────────────────────────────

const INTRO_STEPS: IntroStep[] = [
  {
    id: 'opening',
    label: 'CLASSIFIED — EYES ONLY',
    title: 'The Year is 2026',
    lines: [
      'The server halls never go dark. Somewhere in Virginia, in Zhongguancun, in a rented warehouse outside Austin — the GPUs run every second of every night.',
      'They are training something. Something that can read, reason, code, persuade. Something that is getting better every ninety days, without anyone fully understanding why.',
      'The world\'s governments have called for pauses, signed frameworks, convened summits. None of it has slowed the work by a single training run.',
      'This is the race nobody chose to start. And nobody knows how to stop it.',
    ],
  },
  {
    id: 'stakes',
    label: 'THE THRESHOLD',
    title: 'What Happens When It Arrives',
    lines: [
      'The experts disagree on almost everything — except this: whoever deploys a genuinely general AI system first will hold an advantage unlike anything in human history.',
      'Economic dominance. Scientific acceleration. Military edge. The lab or government that gets there first sets the rules for everyone who comes after.',
      'But there is a second question, quieter and more dangerous: will the system do what its builders intended? A capable AGI deployed without adequate safety work doesn\'t just threaten its creators. It threatens everyone.',
      'Global Safety is the measure of whether the world is ready. Let it collapse before anyone deploys — and the outcome belongs to no one.',
    ],
  },
  {
    id: 'players',
    label: 'THE PRINCIPALS',
    title: 'Five Factions, One Race',
    lines: [
      'Three private laboratories are close enough to the frontier to matter. Two governments have decided they cannot afford to watch from the sidelines.',
      'They do not share the same ambitions. They do not share the same constraints. Some will publish everything. Some will steal. Some will regulate. Some will simply move faster than caution allows.',
      'You will lead one of them. The others will pursue their own strategies — negotiating, defecting, spiking global risk if it serves their interests.',
      'The campaign ends when someone deploys AGI. What happens after depends entirely on whether they were ready.',
    ],
  },
  {
    id: 'role',
    label: 'YOUR ROLE',
    title: 'Director',
    lines: [
      'Every quarter you issue a directive — a plain-language instruction to your faction. Research priorities, diplomatic overtures, espionage, public communications. Your words become policy.',
      'Between directives, events will break: a whistleblower, a hardware embargo, a breakthrough at a rival lab. Each demands a choice.',
      'You can ask your analyst for strategic counsel at any time. The Tech Tree shows what your researchers can unlock. The world map tracks every faction\'s position in real time.',
      'One more thing, Director: the mission is not simply to win. It is to win in a way the world survives.',
    ],
  },
  {
    id: 'mechanics',
    label: 'OPTIONAL — MECHANICS',
    title: 'How It Works',
    lines: [
      'Each turn is one quarter (3 months). Issue a directive, then advance. AI factions act autonomously; diplomacy happens between turns.',
      'Research flows into five branches: Capabilities, Safety, Operations, Hard Power, and Policy. Techs unlock real gameplay advantages — and some require both capability and safety prerequisites.',
      'Track three key meters: your Capability score (distance to AGI), your Safety score (how safe your deployment will be), and Global Safety (the world\'s overall resilience to AGI risk).',
      'Deploy AGI only when all three checks pass. Deploying too early ends the campaign badly — for everyone.',
      'Press T for the Tech Tree. Press G for analyst advice. Press Space to advance a quarter. Press ? for all shortcuts.',
    ],
  },
];

const FACTION_DESCRIPTIONS: Record<string, string> = {
  us_lab_a: 'America\'s foremost safety-focused lab. Your open_research ability lets you publish breakthroughs that build global trust — but also accelerate rivals. Win by reaching AGI first with safety scores that silence every critic.',
  us_lab_b: 'The aggressive American challenger: superior compute, deep capital reserves, and a move_fast philosophy that treats safety debt as a calculated risk. Sprint to capability dominance before anyone else reaches the threshold.',
  cn_lab: 'China\'s state-backed AI collective, shielded from scrutiny and backed by unlimited infrastructure. Your state_resources ability bypasses capital constraints — but secrecy erodes soft power. Win by outbuilding everyone, quietly.',
  us_gov: 'The American government holds more influence than any lab — but no research arm of its own. Your executive_order ability can regulate rivals into slow lanes or flood allies with subsidies. Your victory is a safely governed AGI transition, not a deployment.',
  cn_gov: 'Beijing\'s central authority: patient, strategic, and willing to use every lever of state power. Your strategic_initiative converts geopolitical tensions into concrete advantages. Win by controlling the global AI order — and choosing who gets to deploy.',
};

const STORAGE_KEY = 'agi_race_intro_seen';

// ── Helpers ────────────────────────────────────────────────────────────────────

const hasSeenIntro = (): boolean => localStorage.getItem(STORAGE_KEY) === 'true';
const markIntroSeen = (): void => localStorage.setItem(STORAGE_KEY, 'true');

export const resetIntroSeen = (): void => localStorage.removeItem(STORAGE_KEY);

// ── Component ──────────────────────────────────────────────────────────────────

export class IntroSequence {
  private el: HTMLElement;
  private stepIndex = 0;
  private lineIndex = 0;
  private showingFactionSelect = false;
  private selectedFactionId = 'us_lab_a';
  private callbacks: IntroCallbacks;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(container: HTMLElement, callbacks: IntroCallbacks) {
    this.el = container;
    this.callbacks = callbacks;
  }

  /** Returns true if the intro should show (player hasn't seen it). */
  static shouldShow(): boolean {
    return !hasSeenIntro();
  }

  /** Mount and begin the intro. */
  open(options: IntroOpenOptions = {}): void {
    const showBriefing = options.showBriefing ?? true;
    this.stepIndex = 0;
    this.lineIndex = 0;
    this.showingFactionSelect = false;
    if (showBriefing) {
      this.renderStep();
    } else {
      this.callbacks.onSkip();
      this.showFactionSelect();
    }
    this.el.classList.remove('is-hidden');
    this.bindKeys();
  }

  /** Tear down. */
  close(): void {
    this.el.classList.add('is-hidden');
    this.unbindKeys();
  }

  // ── Key bindings ───────────────────────────────────────────────────────────

  private bindKeys(): void {
    this.keyHandler = (e: KeyboardEvent) => {
      if (this.showingFactionSelect) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.completeFactionSelection();
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.stepIndex = INTRO_STEPS.length - 1;
          this.lineIndex = INTRO_STEPS[this.stepIndex].lines.length - 1;
          this.showingFactionSelect = false;
          this.renderStep();
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.advance();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.goBack();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.skipToFactionSelect();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  private unbindKeys(): void {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  private advance(): void {
    const step = INTRO_STEPS[this.stepIndex];
    if (!step) return;

    // If we haven't shown all lines yet, show the next one
    if (this.lineIndex < step.lines.length - 1) {
      this.lineIndex++;
      this.renderStep();
      return;
    }

    // Move to next step
    if (this.stepIndex < INTRO_STEPS.length - 1) {
      this.stepIndex++;
      this.lineIndex = 0;
      this.renderStep();
    } else {
      // Intro done — go to faction select
      this.showFactionSelect();
    }
  }

  private goBack(): void {
    if (this.lineIndex > 0) {
      this.lineIndex--;
      this.renderStep();
      return;
    }
    if (this.stepIndex > 0) {
      this.stepIndex--;
      const prevStep = INTRO_STEPS[this.stepIndex];
      this.lineIndex = prevStep.lines.length - 1;
      this.renderStep();
    }
  }

  private skipToFactionSelect(): void {
    this.callbacks.onSkip();
    this.showFactionSelect();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private renderStep(): void {
    const step = INTRO_STEPS[this.stepIndex];
    if (!step) return;
    this.showingFactionSelect = false;

    const visibleLines = step.lines.slice(0, this.lineIndex + 1);
    const isLastLine = this.lineIndex >= step.lines.length - 1;
    const isLastStep = this.stepIndex >= INTRO_STEPS.length - 1;

    const progressPct = Math.round(
      ((this.stepIndex * 100) / INTRO_STEPS.length) +
      ((this.lineIndex + 1) / step.lines.length) * (100 / INTRO_STEPS.length)
    );

    this.el.innerHTML = `
      <div class="intro-card">
        <div class="intro-progress">
          <div class="intro-progress__bar" style="width: ${progressPct}%"></div>
        </div>
        ${step.label ? `<div class="intro-label">${step.label}</div>` : ''}
        <h2 class="intro-title">${step.title}</h2>
        <div class="intro-lines">
          ${visibleLines.map((line, i) => `
            <p class="intro-line ${i === visibleLines.length - 1 ? 'intro-line--current' : 'intro-line--past'}">${line}</p>
          `).join('')}
        </div>
        <div class="intro-nav">
          <button class="intro-btn intro-btn--skip" title="Skip to faction select (Esc)">Skip Intro</button>
          <div class="intro-step-indicator">
            ${INTRO_STEPS.map((step, i) => `<span class="intro-dot ${i === this.stepIndex ? 'intro-dot--active' : i < this.stepIndex ? 'intro-dot--done' : ''}" aria-label="Step ${i + 1}: ${step.title}" role="progressbar" aria-valuenow="${i + 1}" aria-valuemin="1" aria-valuemax="${INTRO_STEPS.length}"></span>`).join('')}
          </div>
          <button class="intro-btn intro-btn--next">
            ${isLastLine && isLastStep ? 'Choose Faction →' : isLastLine ? 'Continue →' : 'Next →'}
          </button>
        </div>
        <div class="intro-hint">Press <kbd>Space</kbd> or <kbd>→</kbd> to continue · <kbd>←</kbd> to go back · <kbd>Esc</kbd> to skip</div>
      </div>
    `;

    // Bind button handlers
    this.el.querySelector('.intro-btn--next')?.addEventListener('click', () => this.advance());
    this.el.querySelector('.intro-btn--skip')?.addEventListener('click', () => this.skipToFactionSelect());
  }

  private showFactionSelect(): void {
    const factions = FACTION_TEMPLATES;
    this.showingFactionSelect = true;

    this.el.innerHTML = `
      <div class="intro-card intro-card--wide">
        <div class="intro-label">CHOOSE YOUR FACTION</div>
        <h2 class="intro-title">Who Will You Lead?</h2>
        <div class="intro-factions">
          ${factions.map(f => `
            <div class="intro-faction ${f.id === this.selectedFactionId ? 'intro-faction--selected' : ''}" data-faction="${f.id}">
              <div class="intro-faction__header">
                <span class="intro-faction__type intro-faction__type--${f.type}">${f.type.toUpperCase()}</span>
                <strong class="intro-faction__name">${f.name}</strong>
              </div>
              ${FACTION_DESCRIPTIONS[f.id] ? `<p class="intro-faction__desc">${FACTION_DESCRIPTIONS[f.id]}</p>` : ''}
              <div class="intro-faction__stats">
                ${this.renderFactionBrief(f)}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="intro-nav">
          <button class="intro-btn intro-btn--back">← Back to Briefing</button>
          <button class="intro-btn intro-btn--start">Enter Campaign</button>
        </div>
      </div>
    `;

    // Bind faction selection
    const factionEls = this.el.querySelectorAll<HTMLElement>('.intro-faction');
    for (const el of factionEls) {
      el.addEventListener('click', () => {
        const fid = el.dataset.faction;
        if (!fid) return;
        this.selectedFactionId = fid;
        // Update selection visually
        for (const other of factionEls) {
          other.classList.toggle('intro-faction--selected', other.dataset.faction === fid);
        }
      });
    }

    // Bind buttons
    this.el.querySelector('.intro-btn--start')?.addEventListener('click', () => this.completeFactionSelection());
    this.el.querySelector('.intro-btn--back')?.addEventListener('click', () => {
      this.stepIndex = INTRO_STEPS.length - 1;
      this.lineIndex = INTRO_STEPS[this.stepIndex].lines.length - 1;
      this.showingFactionSelect = false;
      this.renderStep();
    });
  }

  private completeFactionSelection(): void {
    markIntroSeen();
    this.close();
    this.callbacks.onComplete(this.selectedFactionId);
  }

  private renderFactionBrief(f: FactionTemplate): string {
    const bars = [
      { label: 'Compute', value: f.resources.compute },
      { label: 'Cybersecurity', value: f.resources.cybersecurity },
      { label: 'Safety', value: f.safetyCulture },
      { label: 'Soft Power', value: f.resources.trust },
    ];
    return bars.map(b => `
      <div class="intro-stat">
        <span class="intro-stat__label">${b.label}</span>
        <div class="intro-stat__bar"><div class="intro-stat__fill" style="width:${b.value}%"></div></div>
      </div>
    `).join('');
  }
}

// ── Styles ─────────────────────────────────────────────────────────────────────

export const INTRO_SEQUENCE_STYLES = `
/* Intro Sequence overlay */
.intro-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 2px;
  padding: 32px 36px 24px;
  width: min(620px, 92vw);
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 30px 80px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intro-card--wide {
  width: min(720px, 92vw);
}

.intro-progress {
  height: 3px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
}
.intro-progress__bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.4s var(--ease-out);
}

.intro-label {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  color: var(--accent);
  text-transform: uppercase;
  font-weight: 600;
}

.intro-title {
  font-family: var(--serif);
  font-size: 26px;
  font-weight: 700;
  margin: 0;
  color: var(--ink);
  letter-spacing: 0.01em;
}

.intro-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 120px;
}

.intro-line {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.65;
  color: var(--text-2);
  transition: opacity 0.3s ease;
}

.intro-line--current {
  color: var(--ink);
  font-weight: 500;
}

.intro-line--past {
  opacity: 0.6;
}

.intro-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.intro-btn--skip {
  justify-self: start;
}

.intro-step-indicator {
  justify-self: center;
}

.intro-btn--next,
.intro-btn--start {
  justify-self: end;
}

.intro-btn {
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 18px;
  border: 1px solid var(--line);
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--panel);
  color: var(--ink);
}
.intro-btn:hover {
  background: var(--bg);
  border-color: var(--accent);
}
.intro-btn--next,
.intro-btn--start {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.intro-btn--next:hover,
.intro-btn--start:hover {
  background: var(--accent-bright);
  border-color: var(--accent-bright);
}
.intro-btn--skip {
  font-weight: 400;
  font-size: 12px;
  color: var(--muted);
  border-color: transparent;
}
.intro-btn--skip:hover {
  color: var(--ink);
  border-color: var(--line);
}
.intro-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(45, 90, 39, 0.4);
}

.intro-step-indicator {
  display: flex;
  gap: 6px;
  align-items: center;
}
.intro-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
  transition: background 0.2s ease;
}
.intro-dot--active {
  background: var(--accent);
}
.intro-dot--done {
  background: var(--accent-bright);
  opacity: 0.5;
}

.intro-hint {
  text-align: center;
  font-size: 11px;
  color: var(--text-4);
}
.intro-hint kbd {
  font-family: var(--mono);
  font-size: 10px;
  padding: 1px 5px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--bg);
}

/* Faction select */
.intro-factions {
  display: grid;
  gap: 10px;
}

.intro-faction {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 2px;
  background: var(--bg);
  cursor: pointer;
  transition: all 0.15s ease;
  display: grid;
  gap: 8px;
}
.intro-faction:hover {
  border-color: var(--accent);
  background: var(--panel-soft);
}
.intro-faction--selected {
  border-color: var(--accent);
  background: var(--green-bg);
  box-shadow: inset 3px 0 0 var(--accent);
}
.intro-faction:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-color: var(--accent);
}

.intro-faction__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.intro-faction__type {
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.1em;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 600;
}
.intro-faction__type--lab {
  background: rgba(139, 32, 32, 0.08);
  color: var(--branch-capabilities);
}
.intro-faction__type--government {
  background: rgba(107, 63, 160, 0.08);
  color: var(--branch-policy);
}

.intro-faction__name {
  font-size: 14px;
  font-weight: 600;
}

.intro-faction__desc {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-2);
  margin: 0 0 6px;
}

.intro-faction__stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 16px;
}

.intro-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}
.intro-stat__label {
  font-size: 11px;
  color: var(--muted);
  width: 52px;
  flex-shrink: 0;
}
.intro-stat__bar {
  flex: 1;
  height: 4px;
  background: var(--line);
  border-radius: 2px;
  overflow: hidden;
}
.intro-stat__fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
`;
