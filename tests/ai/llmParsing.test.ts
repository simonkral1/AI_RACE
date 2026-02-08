import { describe, expect, it } from 'vitest';
import { extractJsonSnippet, extractLlmText } from '../../src/ai/llmParsing.js';

describe('llmParsing helpers', () => {
  it('strips think blocks from plain text', () => {
    const content = '<think>internal reasoning</think>{"choiceId":"share_research"}';
    expect(extractLlmText(content)).toBe('{"choiceId":"share_research"}');
  });

  it('merges content parts and ignores reasoning part types', () => {
    const content = [
      { type: 'reasoning', text: 'private chain of thought' },
      { type: 'text', text: '{"actions":[{"actionId":"policy","openness":"open"}]}' },
    ];
    expect(extractLlmText(content)).toBe('{"actions":[{"actionId":"policy","openness":"open"}]}');
  });

  it('extracts first valid JSON object from noisy response', () => {
    const response = `
      I considered multiple outcomes first.
      <think>{"scratch":"ignore this"}</think>
      \`\`\`json
      {"summary":"Done","effects":[{"kind":"log","message":"ok"}]}
      \`\`\`
    `;
    const json = extractJsonSnippet(response, 'object');
    expect(json).toBe('{"summary":"Done","effects":[{"kind":"log","message":"ok"}]}');
  });

  it('extracts first valid JSON array from mixed output', () => {
    const response = `
      Here are comms lines:
      [{"factionId":"us_lab_a","speaker":"A","text":"Proceed carefully."}]
      End.
    `;
    const json = extractJsonSnippet(response, 'array');
    expect(json).toBe('[{"factionId":"us_lab_a","speaker":"A","text":"Proceed carefully."}]');
  });
});
