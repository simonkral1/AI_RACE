import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { GameState } from '../../src/core/types.js';
import { EVENTS, type EventDefinition, type EventChoice } from '../../src/data/events.js';
import { ACTIONS } from '../../src/data/actions.js';

// Mock gmClient to avoid actual API/server calls.
// vi.mock is hoisted, so define mocks inside the factory and retrieve with vi.mocked after import.
vi.mock('../../src/ai/gmClient.js', () => ({
  gmExplain: vi.fn(),
  gmAdvice: vi.fn(),
  gmNarrateEvent: vi.fn(),
  gmRespondDirective: vi.fn(),
  gmInterpretDirective: vi.fn(),
  gmSummary: vi.fn(),
  gmAsk: vi.fn(),
  gmOpening: vi.fn(),
  gmTurnSummary: vi.fn(),
  gmIntroduceEvent: vi.fn(),
  gmActionReview: vi.fn(),
  setGmGameId: vi.fn(),
  getGmGameId: vi.fn(() => 'default'),
}));

// Import after mocking
import {
  createGamemaster,
  type Gamemaster,
  type GamemasterConfig,
  type DirectiveResponse,
  type GameEvent,
} from '../../src/ai/gamemaster.js';
import {
  gmExplain,
  gmAdvice,
  gmNarrateEvent,
  gmRespondDirective,
  gmInterpretDirective,
  gmSummary,
  gmAsk,
  gmOpening,
  gmTurnSummary,
  gmIntroduceEvent,
  gmActionReview,
} from '../../src/ai/gmClient.js';

// Typed mock references
const mockGmExplain = vi.mocked(gmExplain);
const mockGmAdvice = vi.mocked(gmAdvice);
const mockGmNarrateEvent = vi.mocked(gmNarrateEvent);
const mockGmRespondDirective = vi.mocked(gmRespondDirective);
const mockGmInterpretDirective = vi.mocked(gmInterpretDirective);
const mockGmSummary = vi.mocked(gmSummary);
const mockGmAsk = vi.mocked(gmAsk);
const _mockGmOpening = vi.mocked(gmOpening);
const _mockGmTurnSummary = vi.mocked(gmTurnSummary);
const _mockGmIntroduceEvent = vi.mocked(gmIntroduceEvent);
const _mockGmActionReview = vi.mocked(gmActionReview);

describe('Gamemaster AI', () => {
  let state: GameState;
  let gamemaster: Gamemaster;

  beforeEach(() => {
    state = createInitialState();
    gamemaster = createGamemaster();
    vi.clearAllMocks();
  });

  describe('explainMechanics', () => {
    it('returns explanation for safety topic', async () => {
      mockGmExplain.mockResolvedValueOnce(
        '{"answer":"Safety score determines how aligned your AI systems are. Higher safety means safer AGI deployment."}'
      );

      const explanation = await gamemaster.explainMechanics('safety');

      expect(explanation).toContain('safety');
      expect(mockGmExplain).toHaveBeenCalledTimes(1);
      // Prompt should contain the topic
      expect(mockGmExplain.mock.calls[0][0]).toContain('safety');
    });

    it('returns explanation for capability topic', async () => {
      mockGmExplain.mockResolvedValueOnce(
        '{"answer":"Capability score measures how advanced your AI systems are. Race toward AGI wisely."}'
      );

      const explanation = await gamemaster.explainMechanics('capability');

      expect(explanation).toContain('Capability');
      expect(mockGmExplain).toHaveBeenCalledTimes(1);
    });

    it('returns fallback when server returns null', async () => {
      mockGmExplain.mockResolvedValueOnce(null);

      const explanation = await gamemaster.explainMechanics('resources');

      expect(explanation).toBeTruthy();
      expect(explanation.toLowerCase()).toContain('mechanic');
    });

    it('falls back when response contains self-referential drafting text', async () => {
      mockGmExplain.mockResolvedValueOnce(
        'The key points are safety is important. My personality should stay ominous and helpful.'
      );

      const explanation = await gamemaster.explainMechanics('safety');
      expect(explanation.toLowerCase()).toContain('safety score');
    });

    it('falls back when mechanics reply uses template drafting phrasing', async () => {
      mockGmExplain.mockResolvedValueOnce(
        'First, define capability. Check the key points: capability measures what AGI can do.'
      );

      const explanation = await gamemaster.explainMechanics('capability');
      expect(explanation.toLowerCase()).toContain('capability score');
    });

    it('extracts answer field from JSON response envelope', async () => {
      mockGmExplain.mockResolvedValueOnce(
        '{"answer":"Capability score tracks how advanced your AI systems are."}'
      );

      const explanation = await gamemaster.explainMechanics('capability');
      expect(explanation.toLowerCase()).toContain('capability score');
    });
  });

  describe('getStrategicAdvice', () => {
    it('provides advice based on current game state', async () => {
      mockGmAdvice.mockResolvedValueOnce(
        '{"answer":"Your safety score is falling behind. Consider investing in alignment research before pushing capabilities further."}'
      );

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice).toBeTruthy();
      expect(mockGmAdvice).toHaveBeenCalledTimes(1);
    });

    it('includes faction data in prompt', async () => {
      mockGmAdvice.mockResolvedValueOnce('{"answer":"Focus on building compute infrastructure."}');

      await gamemaster.getStrategicAdvice(state, 'us_lab_a');

      const prompt = mockGmAdvice.mock.calls[0][0];
      expect(prompt).toContain('us_lab_a');
    });

    it('returns fallback advice when server returns null', async () => {
      mockGmAdvice.mockResolvedValueOnce(null);

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice).toBeTruthy();
      expect(advice.toLowerCase()).toContain('capability');
    });

    it('warns about low global safety', async () => {
      state.globalSafety = 30;
      mockGmAdvice.mockResolvedValueOnce(
        '{"answer":"Warning: Global safety is critically low. All factions risk catastrophe if AGI is deployed now."}'
      );

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice.toLowerCase()).toContain('safety');
    });

    it('falls back when response looks like raw state-analysis dump', async () => {
      mockGmAdvice.mockResolvedValueOnce(
        'The year is 2026, quarter 1, turn 0. The factions are OpenBrain, Nexus Labs, DeepCent. Looking at their resources, none can deploy AGI yet.'
      );

      const advice = await gamemaster.getStrategicAdvice(state, 'us_lab_a');
      expect(advice.toLowerCase()).toContain('safety');
    });
  });

  describe('narrateEvent', () => {
    const testEvent: EventDefinition = EVENTS[0];
    const testChoice: EventChoice = testEvent.choices[0];

    it('generates dramatic narrative for event', async () => {
      mockGmNarrateEvent.mockResolvedValueOnce(
        '{"answer":"The boardroom falls silent as reports flood in. Export controls have tightened overnight, and the compute you counted on may never arrive."}'
      );

      const narrative = await gamemaster.narrateEvent(testEvent, testChoice);

      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(50);
    });

    it('includes event title and choice in prompt', async () => {
      mockGmNarrateEvent.mockResolvedValueOnce('{"answer":"A fateful decision was made."}');

      await gamemaster.narrateEvent(testEvent, testChoice);

      const prompt = mockGmNarrateEvent.mock.calls[0][0];
      expect(prompt).toContain(testEvent.title);
      expect(prompt).toContain(testChoice.label);
    });

    it('returns fallback narrative when server returns null', async () => {
      mockGmNarrateEvent.mockResolvedValueOnce(null);

      const narrative = await gamemaster.narrateEvent(testEvent, testChoice);

      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toContain('outcome brief');
    });
  });

  describe('respondToDirective', () => {
    it('parses directive and returns narrative with effects', async () => {
      mockGmRespondDirective.mockResolvedValueOnce(JSON.stringify({
        narrative: 'Your bold move to accelerate research has caught the attention of rivals.',
        effects: [
          { kind: 'score', factionId: 'us_lab_a', key: 'capabilityScore', delta: 3 }
        ]
      }));

      const response = await gamemaster.respondToDirective(
        'Push hard on capabilities research this quarter',
        state,
        'us_lab_a'
      );

      expect(response.narrative).toBeTruthy();
      expect(response.effects).toHaveLength(1);
      expect(response.effects[0]).toMatchObject({
        kind: 'score',
        delta: 3
      });
    });

    it('validates effects against allowed types', async () => {
      mockGmRespondDirective.mockResolvedValueOnce(JSON.stringify({
        narrative: 'The directive has been processed.',
        effects: [
          { kind: 'invalid_type', factionId: 'us_lab_a', delta: 100 },
          { kind: 'resource', factionId: 'us_lab_a', key: 'compute', delta: 5 }
        ]
      }));

      const response = await gamemaster.respondToDirective(
        'Do something',
        state,
        'us_lab_a'
      );

      // Invalid effect should be filtered out
      expect(response.effects).toHaveLength(1);
      expect(response.effects[0].kind).toBe('resource');
    });

    it('clamps effect deltas to safe ranges', async () => {
      mockGmRespondDirective.mockResolvedValueOnce(JSON.stringify({
        narrative: 'Massive changes requested.',
        effects: [
          { kind: 'resource', factionId: 'us_lab_a', key: 'compute', delta: 1000 }
        ]
      }));

      const response = await gamemaster.respondToDirective(
        'Give me infinite compute',
        state,
        'us_lab_a'
      );

      // Delta should be clamped to max allowed (e.g., 15)
      expect(response.effects[0].delta).toBeLessThanOrEqual(15);
    });

    it('returns empty effects array when server returns null', async () => {
      mockGmRespondDirective.mockResolvedValueOnce(null);

      const response = await gamemaster.respondToDirective(
        'Test directive',
        state,
        'us_lab_a'
      );

      expect(response.effects).toEqual([]);
      expect(response.narrative).toBeTruthy();
    });
  });

  describe('interpretDirectiveActions', () => {
    const getAllowedActions = () =>
      ACTIONS.filter((action) => (
        action.allowedFor.includes('lab')
        && (!action.factionSpecific || action.factionSpecific === 'us_lab_a')
      ));
    const getTargets = () =>
      Object.values(state.factions)
        .filter((faction) => faction.id !== 'us_lab_a')
        .map((faction) => ({ id: faction.id, name: faction.name, type: faction.type }));

    it('uses LLM output when available', async () => {
      mockGmInterpretDirective.mockResolvedValueOnce(JSON.stringify({
        orders: [
          { actionId: 'build_compute', openness: 'open' },
          { actionId: 'espionage', openness: 'secret', targetFactionId: 'us_lab_b' },
        ],
      }));

      const result = await gamemaster.interpretDirectiveActions(
        'Build compute and quietly run espionage on Nexus Labs.',
        state,
        'us_lab_a',
        getAllowedActions(),
        getTargets(),
        2,
      );

      expect(result.source).toBe('llm');
      expect(result.orders).toHaveLength(2);
      expect(result.orders[0].actionId).toBe('build_compute');
      expect(result.orders[1]).toMatchObject({
        actionId: 'espionage',
        targetFactionId: 'us_lab_b',
      });
    });

    it('maps LLM target names to target ids', async () => {
      mockGmInterpretDirective.mockResolvedValueOnce(JSON.stringify({
        orders: [
          { actionId: 'espionage', openness: 'secret', targetFactionId: 'Nexus Labs' },
          { actionId: 'build_compute', openness: 'open' },
        ],
      }));

      const result = await gamemaster.interpretDirectiveActions(
        'Spy on Nexus Labs.',
        state,
        'us_lab_a',
        getAllowedActions(),
        getTargets(),
        2,
      );

      expect(result.orders[0].actionId).toBe('espionage');
      expect(result.orders[0].targetFactionId).toBe('us_lab_b');
    });

    it('returns an AI error when server returns null', async () => {
      mockGmInterpretDirective.mockResolvedValueOnce(null);

      const result = await gamemaster.interpretDirectiveActions(
        'Conduct espionage against Nexus Labs in secret and build compute capacity.',
        state,
        'us_lab_a',
        getAllowedActions(),
        getTargets(),
        2,
      );

      expect(result.source).toBe('error');
      expect(result.orders).toHaveLength(0);
      expect(result.note).toContain('[AI Error]');
    });
  });

  describe('getGameSummary', () => {
    it('generates summary of current game state', async () => {
      mockGmSummary.mockResolvedValueOnce(
        '{"answer":"Year 2027 Q2: The race intensifies. US Lab A leads in capabilities while safety concerns mount globally."}'
      );

      const summary = await gamemaster.getGameSummary(state);

      expect(summary).toBeTruthy();
      expect(mockGmSummary).toHaveBeenCalledTimes(1);
    });

    it('includes turn information in prompt', async () => {
      state.year = 2028;
      state.quarter = 3;
      mockGmSummary.mockResolvedValueOnce('{"answer":"The year 2028 Q3 marks a turning point."}');

      await gamemaster.getGameSummary(state);

      const prompt = mockGmSummary.mock.calls[0][0];
      expect(prompt).toContain('2028');
    });

    it('returns fallback summary when server returns null', async () => {
      mockGmSummary.mockResolvedValueOnce(null);

      const summary = await gamemaster.getGameSummary(state);

      expect(summary).toBeTruthy();
      expect(summary).toContain('Q');
    });

    it('includes recent history in prompt', async () => {
      gamemaster.recordEvent({ turn: 1, type: 'event_resolved', eventId: 'supply_shock', choiceId: 'lobby_exemptions', factionId: 'us_lab_a' });
      gamemaster.recordEvent({ turn: 2, type: 'event_resolved', eventId: 'alignment_incident', choiceId: 'full_transparency', factionId: 'us_lab_a' });

      mockGmSummary.mockResolvedValueOnce(
        '{"answer":"After weathering supply shocks and an alignment incident, the lab chose transparency..."}'
      );

      await gamemaster.getGameSummary(state);

      const prompt = mockGmSummary.mock.calls[0][0];
      expect(prompt).toContain('supply_shock');
    });
  });

  describe('trackHistory', () => {
    it('records events to history', () => {
      const event: GameEvent = {
        turn: 5,
        type: 'event_resolved',
        eventId: 'supply_shock',
        choiceId: 'lobby_exemptions',
        factionId: 'us_lab_a'
      };

      gamemaster.recordEvent(event);
      const history = gamemaster.getHistory();

      expect(history).toContainEqual(event);
    });

    it('records narrative directives to history', () => {
      gamemaster.recordDirective(3, 'us_lab_a', 'Focus on safety research');
      const history = gamemaster.getHistory();

      expect(history).toContainEqual(expect.objectContaining({
        turn: 3,
        type: 'directive',
        factionId: 'us_lab_a'
      }));
    });

    it('limits history size', () => {
      // Add many events
      for (let i = 0; i < 200; i++) {
        gamemaster.recordEvent({
          turn: i,
          type: 'turn_advanced',
        });
      }

      const history = gamemaster.getHistory();
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('personality configuration', () => {
    it('accepts custom personality config', () => {
      const customConfig: GamemasterConfig = {
        personality: {
          tone: 'ominous',
          verbosity: 'verbose',
          riskEmphasis: 'high'
        }
      };

      const customGm = createGamemaster(customConfig);
      expect(customGm).toBeDefined();
    });

    it('uses default personality when not configured', () => {
      const defaultGm = createGamemaster();
      expect(defaultGm).toBeDefined();
    });
  });

  describe('askQuestion', () => {
    it('answers free-form questions about the game', async () => {
      mockGmAsk.mockResolvedValueOnce(
        '{"answer":"Trust represents how much the public and governments believe in your commitment to safety."}'
      );

      const answer = await gamemaster.askQuestion('What does trust do?', state);

      expect(answer.toLowerCase()).toContain('trust');
      expect(mockGmAsk).toHaveBeenCalledTimes(1);
    });

    it('includes game context in question prompt', async () => {
      mockGmAsk.mockResolvedValueOnce('{"answer":"Based on current standings..."}');

      await gamemaster.askQuestion('Who is winning?', state);

      const prompt = mockGmAsk.mock.calls[0][0];
      // The prompt contains serialized game state with globalSafety
      expect(prompt).toMatch(/globalSafety|global.?safety/i);
    });

    it('falls back when model returns reasoning-leak style text', async () => {
      mockGmAsk.mockResolvedValueOnce(
        'Okay, the player is asking about strategy. Let me think through the game state before answering.'
      );

      const answer = await gamemaster.askQuestion('What should I do?', state);
      expect(answer).toContain('[AI Error]');
    });

    it('falls back when response contains rewrite-draft meta leakage', async () => {
      mockGmAsk.mockResolvedValueOnce(
        'Okay, let\'s see. Looking at the draft: "Greetings, strategist. The year is 2026."'
      );

      const answer = await gamemaster.askQuestion('hi', state);
      expect(answer).toContain('[AI Error]');
    });

    it('routes off-topic question through GM path', async () => {
      mockGmAsk.mockResolvedValueOnce('{"answer":"10 plus 10 is 20."}');
      const answer = await gamemaster.askQuestion('what is 10 plus 10', state);
      expect(answer).toContain('20');
      expect(mockGmAsk).toHaveBeenCalledTimes(1);
    });

    it('routes identity question through GM path', async () => {
      mockGmAsk.mockResolvedValueOnce('{"answer":"I am the Strategic Analyst for this simulation."}');
      const answer = await gamemaster.askQuestion('who are you?', state);
      expect(answer.toLowerCase()).toContain('strategic analyst');
      expect(mockGmAsk).toHaveBeenCalledTimes(1);
    });

    it('routes short unclear prompt through GM path', async () => {
      mockGmAsk.mockResolvedValueOnce('{"answer":"Can you clarify what you want analyzed?"}');
      const answer = await gamemaster.askQuestion('what?', state);
      expect(answer.toLowerCase()).toContain('clarify');
      expect(mockGmAsk).toHaveBeenCalledTimes(1);
    });

    it('extracts answer from JSON envelope for free-form question', async () => {
      mockGmAsk.mockResolvedValueOnce(
        '{"answer":"You should prioritize safety research this quarter while monitoring rivals."}'
      );

      const answer = await gamemaster.askQuestion('What should I focus on this turn?', state);
      expect(answer.toLowerCase()).toContain('prioritize safety research');
    });

    it('removes drafting-style prompt leakage from otherwise useful output', async () => {
      mockGmAsk.mockResolvedValueOnce(
        'Year is 2026, quarter 1, turn 0. Global safety is 23.8. None can deploy AGI yet. Maybe something like acknowledging the start of the race. Need to keep it under 100 words.'
      );

      const answer = await gamemaster.askQuestion('What is the current situation?', state);
      expect(answer).toContain('[AI Error]');
    });
  });
});
