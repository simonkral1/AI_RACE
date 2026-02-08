const THINK_BLOCK_RE = /<think\b[^>]*>[\s\S]*?<\/think>/gi;

type JsonTarget = 'object' | 'array' | 'any';

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stripThinkBlocks = (text: string): string => text.replace(THINK_BLOCK_RE, '').trim();

const partToText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value || typeof value !== 'object') return '';

  const part = value as Record<string, unknown>;
  const type = typeof part.type === 'string' ? part.type.toLowerCase() : '';
  if (type.includes('reasoning') || type.includes('thinking')) return '';

  if (typeof part.text === 'string') return part.text;
  if (typeof part.content === 'string') return part.content;
  if (Array.isArray(part.content)) return part.content.map(partToText).join('');
  return '';
};

export const extractLlmText = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const merged = stripThinkBlocks(value.map(partToText).join(''));
    return merged || null;
  }
  const merged = stripThinkBlocks(partToText(value));
  return merged || null;
};

const matchesTarget = (value: unknown, target: JsonTarget): boolean => {
  if (target === 'any') return isJsonObject(value) || Array.isArray(value);
  if (target === 'object') return isJsonObject(value);
  return Array.isArray(value);
};

const tryJsonCandidate = (raw: string, target: JsonTarget): string | null => {
  try {
    const parsed = JSON.parse(raw);
    return matchesTarget(parsed, target) ? raw : null;
  } catch {
    return null;
  }
};

const findClosingIndex = (text: string, start: number): number => {
  const open = text[start];
  if (open !== '{' && open !== '[') return -1;
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === open) {
      depth += 1;
      continue;
    }
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const preferredStarts = (target: JsonTarget): string[] => {
  if (target === 'object') return ['{'];
  if (target === 'array') return ['['];
  return ['{', '['];
};

export const extractJsonSnippet = (raw: string, target: JsonTarget = 'any'): string | null => {
  const cleaned = stripThinkBlocks(raw).trim();
  if (!cleaned) return null;

  const direct = tryJsonCandidate(cleaned, target);
  if (direct) return direct;

  const fencedPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of cleaned.matchAll(fencedPattern)) {
    const candidate = match[1]?.trim();
    if (!candidate) continue;
    const parsed = tryJsonCandidate(candidate, target);
    if (parsed) return parsed;
  }

  const starts = preferredStarts(target);
  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (!starts.includes(char)) continue;
    const end = findClosingIndex(cleaned, index);
    if (end === -1) continue;
    const candidate = cleaned.slice(index, end + 1).trim();
    const parsed = tryJsonCandidate(candidate, target);
    if (parsed) return parsed;
  }

  return null;
};
