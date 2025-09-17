import { GoogleGenerativeAI } from '@google/generative-ai';

const clientCache = new Map<string, GoogleGenerativeAI>();

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';
export const DEFAULT_GEMINI_VISION_MODEL = 'gemini-2.5-pro';

export interface GeminiModelOptions {
  model: string;
  generationConfig?: Record<string, unknown>;
  systemInstruction?: unknown;
}

export function getGeminiClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error('Gemini API key is required for this operation.');
  }

  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = new GoogleGenerativeAI(key);
  clientCache.set(key, client);
  return client;
}

export function getGeminiModel(apiKey: string, options: GeminiModelOptions) {
  const client = getGeminiClient(apiKey);
  const { model, generationConfig, systemInstruction } = options;

  return client.getGenerativeModel({
    model,
    generationConfig: generationConfig as any,
    systemInstruction,
  } as any);
}

const HTML_ENTITY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/&#x2F;/g, '/'],
  [/&#47;/g, '/'],
  [/&frasl;/g, '/'],
  [/&amp;/g, '&'],
];

export function decodeModelIdentifier(model?: string | null): string | undefined {
  if (!model) return undefined;
  let decoded = model;
  for (const [pattern, replacement] of HTML_ENTITY_REPLACEMENTS) {
    decoded = decoded.replace(pattern, replacement);
  }
  decoded = decoded.trim();
  return decoded || undefined;
}

export function resolvePreferredModel(preferred?: string | null, fallback: string = DEFAULT_GEMINI_MODEL) {
  const decoded = decodeModelIdentifier(preferred);
  return decoded ?? fallback;
}
