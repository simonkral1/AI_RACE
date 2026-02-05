// Component that presents a strategic question (or custom prompt) and accepts natural language input
// Questions rotate based on game state (turn number, safety level, etc.) unless overridden

import { div, span, el } from './base.js';

export interface StrategyQuestionOptions {
  turn: number;
  globalSafety: number;
  tension: string;
  factionType: 'lab' | 'government';
  promptOverride?: string;
  placeholder?: string;
}

/**
 * Question pools categorized by game context
 */
const QUESTIONS = {
  // Early game questions (turns 1-8)
  early: {
    lab: [
      'What is your priority this quarter: growth or safety?',
      'How aggressive should your research be this quarter?',
      'Should you focus on building compute or talent?',
      'How openly will you share your research progress?',
    ],
    government: [
      'How should you balance innovation support vs safety oversight?',
      'Will you take a hands-off or regulatory approach this quarter?',
      'Should you invest in domestic AI development or international cooperation?',
      'How will you respond to lab expansion requests?',
    ],
  },
  // Mid game questions (turns 9-16)
  mid: {
    lab: [
      'How do you want to respond to rising global tensions?',
      'Should you accelerate deployment or invest more in alignment?',
      'How will you handle increasing regulatory pressure?',
      'What trade-offs are you willing to make for competitive advantage?',
    ],
    government: [
      "What's your strategy for the upcoming policy summit?",
      'How should you respond to reports of unsafe AI development?',
      'Should you strengthen domestic regulations or push for international treaties?',
      'How will you balance industry concerns with public safety?',
    ],
  },
  // Late game questions (turns 17+)
  late: {
    lab: [
      'With AGI within reach, what is your deployment philosophy?',
      'How will you ensure safety at the final stages?',
      'What legacy do you want your organization to leave?',
      'Should you share breakthrough research with competitors?',
    ],
    government: [
      'How will you prepare society for imminent AGI deployment?',
      'What emergency measures should be considered?',
      'How do you balance national interests with global stability?',
      'Should you intervene more directly in lab operations?',
    ],
  },
  // Crisis questions (low safety or high tension)
  crisis: {
    lab: [
      'Safety levels are critical. How do you respond?',
      'Public trust is eroding. What will you do?',
      'International tensions are high. How should you adapt?',
      'A major incident seems imminent. What is your contingency?',
    ],
    government: [
      'The safety situation is deteriorating. What emergency actions will you take?',
      'Public fear of AI is rising. How will you address it?',
      'International cooperation is breaking down. What is your response?',
      'Labs are racing ahead of regulations. How do you regain control?',
    ],
  },
};

/**
 * Get the appropriate question based on game state
 */
export function getQuestionForTurn(options: StrategyQuestionOptions): string {
  const { turn, globalSafety, tension, factionType } = options;

  // Crisis takes priority
  if (globalSafety < 40 || tension === 'Severe') {
    const pool = QUESTIONS.crisis[factionType];
    return pool[turn % pool.length];
  }

  // Determine game phase
  let phase: 'early' | 'mid' | 'late';
  if (turn <= 8) {
    phase = 'early';
  } else if (turn <= 16) {
    phase = 'mid';
  } else {
    phase = 'late';
  }

  const pool = QUESTIONS[phase][factionType];
  return pool[turn % pool.length];
}

/**
 * Maximum character count for strategy answers
 */
const MAX_CHARS = 200;

/**
 * Renders the strategy question component with textarea input.
 *
 * CSS classes needed:
 * - .strategy-question: Container for the component
 * - .strategy-question__text: The question text
 * - .strategy-question__input: The textarea element
 * - .strategy-question__meta: Character count and other metadata
 * - .strategy-question__counter: Character counter span
 * - .strategy-question__counter--warning: Near limit warning state
 * - .strategy-question__counter--limit: At limit state
 *
 * @param options - Game state options for question selection
 * @param currentAnswer - Current answer text
 * @param onAnswerChange - Callback when answer changes
 */
export function renderStrategyQuestion(
  options: StrategyQuestionOptions,
  currentAnswer: string,
  onAnswerChange: (answer: string) => void
): HTMLElement {
  const container = div({ className: 'strategy-question' });

  // Question text
  const question = options.promptOverride ?? getQuestionForTurn(options);
  const questionText = div({
    className: 'strategy-question__text',
    text: question,
  });
  container.appendChild(questionText);

  // Textarea for answer
  const textarea = el('textarea', {
    className: 'strategy-question__input',
    attrs: {
      placeholder: options.placeholder ?? 'Share your strategy...',
      maxlength: MAX_CHARS,
      rows: 3,
    },
  }) as HTMLTextAreaElement;

  textarea.value = currentAnswer;

  // Meta row with character count
  const meta = div({ className: 'strategy-question__meta' });
  const charCount = currentAnswer.length;
  const counterClass = getCounterClass(charCount);

  const counter = span({
    className: `strategy-question__counter ${counterClass}`,
    text: `${charCount}/${MAX_CHARS}`,
  });
  meta.appendChild(counter);

  // Handle input changes
  textarea.addEventListener('input', () => {
    const value = textarea.value.slice(0, MAX_CHARS);
    if (textarea.value !== value) {
      textarea.value = value;
    }

    // Update counter
    const newCount = value.length;
    counter.textContent = `${newCount}/${MAX_CHARS}`;
    counter.className = `strategy-question__counter ${getCounterClass(newCount)}`;

    onAnswerChange(value);
  });

  container.appendChild(textarea);
  container.appendChild(meta);

  return container;
}

/**
 * Get the appropriate counter CSS class based on character count
 */
function getCounterClass(count: number): string {
  if (count >= MAX_CHARS) {
    return 'strategy-question__counter--limit';
  }
  if (count >= MAX_CHARS * 0.8) {
    return 'strategy-question__counter--warning';
  }
  return '';
}
