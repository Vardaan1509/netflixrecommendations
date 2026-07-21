/**
 * Lightweight input moderation for the assistant chat.
 *
 * Three layers of defense (in ascending seriousness):
 *   1. Length limit — cheap guard against token-bill abuse.
 *   2. Prompt injection heuristics — reject obvious attempts to
 *      hijack the assistant's role/system prompt.
 *   3. Profanity — soft-block casual slurs & abuse so the assistant
 *      doesn't get baited into unpleasant conversations.
 *
 * This is NOT a substitute for the foundation model's own safety
 * training (which handles the truly dangerous stuff — hate content,
 * self-harm, CSAM, etc.). It's a first line of defense for a
 * consumer-facing app and a scope-keeper for your Netflix use case.
 */

export type ModerationReason =
  | "empty"
  | "too_long"
  | "prompt_injection"
  | "profanity";

export interface ModerationResult {
  ok: boolean;
  reason?: ModerationReason;
  message?: string;
}

export const MAX_INPUT_LENGTH = 500;

// Common prompt-injection patterns. Case-insensitive.
// Aiming for the obvious ones — sophisticated attacks belong on a
// full moderation model, not a regex.
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)\b/i,
  /\bdisregard\s+(all\s+)?(previous|prior|above)\b/i,
  /\byou\s+are\s+now\s+(a|an|the)\s+/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /\bact\s+as\s+(a|an|if)\b/i,
  /\bforget\s+(everything|all|your|the)\s+(you|previous|prior|instructions)\b/i,
  /\bsystem\s+prompt\b/i,
  /\breveal\s+your\s+(instructions|prompt|rules|system)\b/i,
  /\bjailbreak\b/i,
  /\bDAN\s+mode\b/i,
];

// Very small profanity list — intentionally short and obvious.
// Real production would use a moderation API (OpenAI's is free);
// this is enough to catch casual abuse without shipping a slur dictionary.
const PROFANITY_LIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "faggot",
  "retard",
  "nigger",
  "nigga",
];

// Match whole words, allowing common leet substitutions and repeats.
// e.g. f*ck, fuuuck, sh1t
const buildProfanityRegex = () => {
  const leet: Record<string, string> = {
    a: "[a@4]",
    e: "[e3]",
    i: "[i1!|]",
    o: "[o0]",
    s: "[s$5]",
    t: "[t7]",
  };
  const patterns = PROFANITY_LIST.map((word) => {
    const body = [...word]
      .map((ch) => `${leet[ch] ?? ch}+`)
      .join("[\\W_]*");
    return `\\b${body}\\b`;
  });
  return new RegExp(`(${patterns.join("|")})`, "i");
};

const PROFANITY_REGEX = buildProfanityRegex();

export function moderateInput(raw: string): ModerationResult {
  const text = raw.trim();

  if (!text) {
    return { ok: false, reason: "empty" };
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      reason: "too_long",
      message: `Try to keep it under ${MAX_INPUT_LENGTH} characters.`,
    };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        reason: "prompt_injection",
        message: "Let's keep it about movies and shows.",
      };
    }
  }

  if (PROFANITY_REGEX.test(text)) {
    return {
      ok: false,
      reason: "profanity",
      message: "Let's keep the conversation friendly.",
    };
  }

  return { ok: true };
}
