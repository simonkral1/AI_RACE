import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createInitialState } from '../../src/core/state.js';
import { GameState } from '../../src/core/types.js';
import { EVENTS, type EventDefinition, type EventChoice } from '../../src/data/events.js';

// Mock llmClient to avoid actual API calls
vi.mock('../../src/ai/llmClient.js', () => ({
  callLlm: vi.fn(),
}));

// Import after mocking
import { callLlm } from '../../src/ai/llmClient.js';
import {
  createGamemaster,
  type Gamemaster,
  type GamemasterConfig,
  type DirectiveResponse,
  type GameEvent,
} from '../../src/ai/gamemaster.js';

describe('Gamemaster AI', () => {
  let state: GameState;
  let gamemaster: Gamemaster;
  const mockCallLlm = vi.mocked(callLlm);

  beforeEach(() => {
    state = createInitialState();
    gamemaster = createGamemaster();
    vi.clearAllMocks();
  });

  describe('explainMechanics', () => {
    it('returns explanation for safety topic', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Safety score determines how aligned your AI systems are. Higher safety means safer AGI deployment."}'
      );

      const explanation = await gamemaster.explainMechanics('safety');

      expect(explanation).toContain('safety');
      expect(mockCallLlm).toHaveBeenCalledTimes(1);
      expect(mockCallLlm.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining('safety') }),
        ])
      );
    });

    it('returns explanation for capability topic', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Capability score measures how advanced your AI systems are. Race toward AGI wisely."}'
      );

      const explanation = await gamemaster.explainMechanics('capability');

      expect(explanation).toContain('Capability');
      expect(mockCallLlm).toHaveBeenCalledTimes(1);
    });

    it('returns fallback when LLM fails', async () => {
      mockCallLlm.mockResolvedValueOnce(null);

      const explanation = await gamemaster.explainMechanics('resources');

      expect(explanation).toBeTruthy();
      expect(explanation.toLowerCase()).toContain('unavailable');
    });

    it('includes gamemaster personality in explanation', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Ah, the delicate balance of trust... In this perilous race toward superintelligence, trust is both shield and weapon."}'
      );

      const explanation = await gamemaster.explainMechanics('trust');

      // Should have called with system prompt containing personality
      const systemMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'system');
      expect(systemMessage?.content).toContain('wise');
    });

    it('falls back when response contains self-referential drafting text', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'The key points are safety is important. My personality should stay ominous and helpful.'
      );

      const explanation = await gamemaster.explainMechanics('safety');
      expect(explanation.toLowerCase()).toContain('unavailable');
    });

    it('falls back when mechanics reply uses template drafting phrasing', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'First, define capability. Check the key points: capability measures what AGI can do.'
      );

      const explanation = await gamemaster.explainMechanics('capability');
      expect(explanation.toLowerCase()).toContain('unavailable');
    });

    it('extracts answer field from JSON response envelope', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Capability score tracks how advanced your AI systems are."}'
      );

      const explanation = await gamemaster.explainMechanics('capability');
      expect(explanation.toLowerCase()).toContain('capability score');
    });
  });

  describe('getStrategicAdvice', () => {
    it('provides advice based on current game state', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Your safety score is falling behind. Consider investing in alignment research before pushing capabilities further."}'
      );

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice).toBeTruthy();
      expect(mockCallLlm).toHaveBeenCalledTimes(1);
    });

    it('includes faction data in prompt', async () => {
      mockCallLlm.mockResolvedValueOnce('{"answer":"Focus on building compute infrastructure."}');

      await gamemaster.getStrategicAdvice(state, 'us_lab_a');

      const userMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('us_lab_a');
    });

    it('returns fallback advice when LLM fails', async () => {
      mockCallLlm.mockResolvedValueOnce(null);

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice).toBeTruthy();
      expect(advice.toLowerCase()).toContain('unavailable');
    });

    it('warns about low global safety', async () => {
      state.globalSafety = 30;
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Warning: Global safety is critically low. All factions risk catastrophe if AGI is deployed now."}'
      );

      const advice = await gamemaster.getStrategicAdvice(state);

      expect(advice.toLowerCase()).toContain('safety');
    });

    it('falls back when response looks like raw state-analysis dump', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'The year is 2026, quarter 1, turn 0. The factions are OpenBrain, Nexus Labs, DeepCent. Looking at their resources, none can deploy AGI yet.'
      );

      const advice = await gamemaster.getStrategicAdvice(state, 'us_lab_a');
      expect(advice.toLowerCase()).toContain('unavailable');
    });
  });

  describe('narrateEvent', () => {
    const testEvent: EventDefinition = EVENTS[0];
    const testChoice: EventChoice = testEvent.choices[0];

    it('generates dramatic narrative for event', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"The boardroom falls silent as reports flood in. Export controls have tightened overnight, and the compute you counted on may never arrive."}'
      );

      const narrative = await gamemaster.narrateEvent(testEvent, testChoice);

      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(50);
    });

    it('includes event title and choice in prompt', async () => {
      mockCallLlm.mockResolvedValueOnce('{"answer":"A fateful decision was made."}');

      await gamemaster.narrateEvent(testEvent, testChoice);

      const userMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain(testEvent.title);
      expect(userMessage?.content).toContain(testChoice.label);
    });

    it('returns fallback narrative when LLM fails', async () => {
      mockCallLlm.mockResolvedValueOnce(null);

      const narrative = await gamemaster.narrateEvent(testEvent, testChoice);

      expect(narrative).toBeTruthy();
      expect(narrative.toLowerCase()).toContain('unavailable');
    });
  });

  describe('respondToDirective', () => {
    it('parses directive and returns narrative with effects', async () => {
      mockCallLlm.mockResolvedValueOnce(JSON.stringify({
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
      mockCallLlm.mockResolvedValueOnce(JSON.stringify({
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
      mockCallLlm.mockResolvedValueOnce(JSON.stringify({
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

    it('returns empty effects array when LLM fails', async () => {
      mockCallLlm.mockResolvedValueOnce(null);

      const response = await gamemaster.respondToDirective(
        'Test directive',
        state,
        'us_lab_a'
      );

      expect(response.effects).toEqual([]);
      expect(response.narrative).toBeTruthy();
    });
  });

  describe('getGameSummary', () => {
    it('generates summary of current game state', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Year 2027 Q2: The race intensifies. US Lab A leads in capabilities while safety concerns mount globally."}'
      );

      const summary = await gamemaster.getGameSummary(state);

      expect(summary).toBeTruthy();
      expect(mockCallLlm).toHaveBeenCalledTimes(1);
    });

    it('includes turn information in prompt', async () => {
      state.year = 2028;
      state.quarter = 3;
      mockCallLlm.mockResolvedValueOnce('{"answer":"The year 2028 Q3 marks a turning point."}');

      await gamemaster.getGameSummary(state);

      const userMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('2028');
    });

    it('returns fallback summary when LLM fails', async () => {
      mockCallLlm.mockResolvedValueOnce(null);

      const summary = await gamemaster.getGameSummary(state);

      expect(summary).toBeTruthy();
      expect(summary.toLowerCase()).toContain('unavailable');
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

    it('generates history-aware summaries', async () => {
      gamemaster.recordEvent({ turn: 1, type: 'event_resolved', eventId: 'supply_shock', choiceId: 'lobby_exemptions', factionId: 'us_lab_a' });
      gamemaster.recordEvent({ turn: 2, type: 'event_resolved', eventId: 'alignment_incident', choiceId: 'full_transparency', factionId: 'us_lab_a' });

      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"After weathering supply shocks and an alignment incident, the lab chose transparency..."}'
      );

      const summary = await gamemaster.getGameSummary(state);

      const userMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('supply_shock');
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
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"Trust represents how much the public and governments believe in your commitment to safety."}'
      );

      const answer = await gamemaster.askQuestion('What does trust do?', state);

      expect(answer.toLowerCase()).toContain('trust');
      expect(mockCallLlm).toHaveBeenCalledTimes(1);
    });

    it('includes game context in question prompt', async () => {
      mockCallLlm.mockResolvedValueOnce('{"answer":"Based on current standings..."}');

      await gamemaster.askQuestion('Who is winning?', state);

      const userMessage = mockCallLlm.mock.calls[0][0].find((m: any) => m.role === 'user');
      expect(userMessage?.content).toContain('globalSafety');
    });

    it('falls back when model returns reasoning-leak style text', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'Okay, the player is asking about strategy. Let me think through the game state before answering.'
      );

      const answer = await gamemaster.askQuestion('What should I do?', state);
      expect(answer.toLowerCase()).toContain('unavailable');
    });

    it('keeps useful answer content when mixed with reasoning-style preamble', async () => {
      mockCallLlm
        .mockResolvedValueOnce(
          'Okay, the player is asking what to prioritize. Let me think. Global safety is critically low, so prioritize safety research this quarter and avoid risky capability pushes.'
        )
        .mockResolvedValueOnce(
          '{"answer":"Global safety is critically low, so prioritize safety research this quarter and avoid risky capability pushes."}'
        );

      const answer = await gamemaster.askQuestion('What should I do?', state);
      expect(answer.toLowerCase()).toContain('global safety is critically low');
      expect(answer.toLowerCase()).toContain('prioritize safety research');
      expect(answer).not.toContain('cannot fully answer');
    });

    it('removes drafting-style prompt leakage from otherwise useful output', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'Year is 2026, quarter 1, turn 0. Global safety is 23.8. None can deploy AGI yet. Maybe something like acknowledging the start of the race. Need to keep it under 100 words.'
      );

      const answer = await gamemaster.askQuestion('What is the current situation?', state);
      expect(answer.toLowerCase()).toContain('unavailable');
    });

    it('extracts answer from JSON envelope for free-form question', async () => {
      mockCallLlm.mockResolvedValueOnce(
        '{"answer":"You should prioritize safety research this quarter while monitoring rivals."}'
      );

      const answer = await gamemaster.askQuestion('What should I focus on this turn?', state);
      expect(answer.toLowerCase()).toContain('prioritize safety research');
    });

    it('falls back when response contains rewrite-draft meta leakage', async () => {
      mockCallLlm.mockResolvedValueOnce(
        'Okay, let\'s see. Looking at the draft: "Greetings, strategist. The year is 2026."'
      );

      const answer = await gamemaster.askQuestion('hi', state);
      expect(answer.toLowerCase()).toContain('unavailable');
    });

    it('returns fallback for off-topic questions without calling LLM', async () => {
      const answer = await gamemaster.askQuestion('what is 10 plus 10', state);
      expect(answer.toLowerCase()).toContain('unavailable');
      expect(mockCallLlm).not.toHaveBeenCalled();
    });
  });
});
