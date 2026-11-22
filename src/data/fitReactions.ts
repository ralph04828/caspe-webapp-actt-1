/**
 * Pre-written welcome fit reaction lines for SWOOOSH onboarding.
 * Add, remove, or edit lines freely per vibe category.
 * Use {name} wherever the member's display name should appear.
 */
export const FIT_REACTIONS: Record<string, string[]> = {
  General: [
    '{name}, that fit is tough. Welcome to SWOOOSH.',
    'Okay {name}. Your style just walked in first.',
    "That's a statement, {name}. We're keeping an eye on you.",
    'Bold move, {name}. SWOOOSH needed this.',
    'Fit check passed, {name}. Easily.',
  ],
  Streetwear: [
    'Streetwear energy, loud without even trying. Respect, {name}.',
    "That's a street-ready fit, {name}. The pavement approves.",
    '{name} came in with the heat. Welcome.',
  ],
  Minimalist: [
    "Clean lines, zero noise. That's confidence, {name}.",
    'Less is more, and you proved it, {name}.',
    'Quiet fit, loud taste. Nicely done, {name}.',
  ],
  Vintage: [
    'Time-travel fit, {name}. Someone has thrift-store taste.',
    "That's a throwback with attitude, {name}.",
    'Old pieces, brand-new energy. Love it, {name}.',
  ],
  'Old Money': [
    'Quiet money, loud taste, {name}.',
    "That's refined, {name}. The room just got classier.",
    'Effortless elegance, {name}. Welcome.',
  ],
  Casual: [
    'Easy, effortless, exactly right, {name}.',
    "Comfortable and sharp at the same time. That's a skill, {name}.",
    'Everyday fit, main-character energy, {name}.',
  ],
  Oversized: [
    'Big silhouette, bigger presence, {name}.',
    'That oversized fit is doing the talking, {name}.',
    'Roomy and ready. Nicely done, {name}.',
  ],
  Y2K: [
    'Y2K called. They want their style back, but you wear it better, {name}.',
    "That's a throwback with sparkle, {name}.",
  ],
  Sporty: [
    'Sporty with swagger, {name}. In the lead already.',
    'Athletic edge, street energy. Strong start, {name}.',
  ],
  Techwear: [
    'Techwear mode, {name}. Built for the future.',
    'Functional and fierce. Respect, {name}.',
  ],
  Colorful: [
    'Color on color on color. You make it look easy, {name}.',
    'That palette is a mood, {name}. We love it.',
  ],
};

const LAST_REACTION_STORAGE_KEY = 'swooosh_last_fit_reaction_tpl';

export function pickFitReaction(
  selectedVibes: string[],
  displayName: string,
  previousTemplate?: string
): { line: string; template: string } {
  const validVibes = selectedVibes.filter((v) => v !== 'Not sure' && FIT_REACTIONS[v]?.length);
  const pool =
    validVibes.length > 0
      ? validVibes.flatMap((v) => FIT_REACTIONS[v])
      : FIT_REACTIONS.General;

  let lastUsed = previousTemplate;
  if (!lastUsed && typeof window !== 'undefined') {
    try {
      lastUsed = localStorage.getItem(LAST_REACTION_STORAGE_KEY) || undefined;
    } catch {
      // ignore storage errors
    }
  }

  const filtered = pool.length > 1 && lastUsed ? pool.filter((t) => t !== lastUsed) : pool;
  const candidates = filtered.length > 0 ? filtered : pool;
  const template = candidates[Math.floor(Math.random() * candidates.length)];

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LAST_REACTION_STORAGE_KEY, template);
    } catch {
      // ignore
    }
  }

  const safeName = displayName.trim() || 'friend';
  return {
    template,
    line: template.replace(/\{name\}/g, safeName),
  };
}
