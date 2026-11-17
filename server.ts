import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createRemoteJWKSet, jwtVerify } from 'jose';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

const FIREBASE_PROJECT_ID = 'spiritual-slice-w7cvm';
const FIRESTORE_DB_ID = 'ai-studio-d1f4653b-eae1-4844-bf3a-ff13ea0fa6c2';

app.use(express.json({ limit: '8mb' }));

// Cached JWKS for verifying Firebase ID Tokens
const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

interface VerifiedCaller {
  uid: string;
  isDemo: boolean;
  idToken?: string;
}

async function verifyCaller(req: express.Request): Promise<VerifiedCaller> {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      throw Object.assign(new Error('Missing Firebase authentication token.'), { status: 401 });
    }
    try {
      const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      });
      const uid = typeof payload.sub === 'string' ? payload.sub : '';
      if (!uid) throw new Error('Invalid token subject.');
      return { uid, isDemo: false, idToken: token };
    } catch {
      throw Object.assign(new Error('Invalid or expired session token. Please sign in again.'), {
        status: 401,
      });
    }
  }

  // Allow explicit demo session with strict per-IP limits
  const ip =
    (typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : req.socket.remoteAddress) || 'local';
  return { uid: `demo_ip_${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 12)}`, isDemo: true };
}

// =====================================
// SERVER-SIDE DAILY QUOTA & BURST GUARD
// =====================================
const SIGNED_IN_DAILY_LIMIT = 20;
const DEMO_DAILY_LIMIT = 5;
const BURST_PER_MIN_LIMIT = 5;
const QUOTA_LEDGER_PATH = path.resolve(__dirname, '.swooosh_ai_quotas.json');

interface QuotaLedger {
  date: string;
  usage: Record<string, number>;
}

const burstMap = new Map<string, number[]>();
const responseCache = new Map<string, { expiresAt: number; payload: any }>();

function getUtcDay(): string {
  return new Date().toISOString().split('T')[0];
}

function loadQuotaLedger(): QuotaLedger {
  const today = getUtcDay();
  try {
    if (fs.existsSync(QUOTA_LEDGER_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(QUOTA_LEDGER_PATH, 'utf-8')) as QuotaLedger;
      if (parsed.date === today && parsed.usage) {
        return parsed;
      }
    }
  } catch {
    // start fresh ledger
  }
  return { date: today, usage: {} };
}

function saveQuotaLedger(ledger: QuotaLedger) {
  try {
    fs.writeFileSync(QUOTA_LEDGER_PATH, JSON.stringify(ledger));
  } catch {
    // ignore ephemeral fs errors
  }
}

async function syncQuotaToFirestore(uid: string, day: string, used: number, idToken?: string) {
  if (!idToken) return;
  const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/aiQuotas/${uid}_${day}`;
  try {
    await fetch(docUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          userId: { stringValue: uid },
          date: { stringValue: day },
          used: { integerValue: String(used) },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    });
  } catch {
    // Firestore quota mirror is best-effort; server ledger remains authoritative
  }
}

function getQuotaStatus(caller: VerifiedCaller) {
  const configured = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim() !== ''
  );
  const killSwitch = process.env.AI_KILL_SWITCH === 'true';
  const ledger = loadQuotaLedger();
  const limit = caller.isDemo ? DEMO_DAILY_LIMIT : SIGNED_IN_DAILY_LIMIT;
  const used = ledger.usage[caller.uid] || 0;
  return {
    configured,
    killSwitch,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    isDemo: caller.isDemo,
  };
}

function consumeQuotaOrThrow(caller: VerifiedCaller, cost: number) {
  if (process.env.AI_KILL_SWITCH === 'true') {
    throw Object.assign(new Error('SWOOOSH AI is temporarily paused for maintenance.'), { status: 503 });
  }

  // Burst check (max 5/min)
  const now = Date.now();
  const recent = (burstMap.get(caller.uid) || []).filter((t) => now - t < 60_000);
  if (recent.length >= BURST_PER_MIN_LIMIT) {
    throw Object.assign(new Error('Too many AI requests in one minute. Please pause briefly and try again.'), {
      status: 429,
    });
  }

  const ledger = loadQuotaLedger();
  const limit = caller.isDemo ? DEMO_DAILY_LIMIT : SIGNED_IN_DAILY_LIMIT;
  const used = ledger.usage[caller.uid] || 0;
  if (used + cost > limit) {
    throw Object.assign(
      new Error(
        caller.isDemo
          ? `Demo daily limit reached (${DEMO_DAILY_LIMIT} requests/day). Sign in for ${SIGNED_IN_DAILY_LIMIT} daily requests.`
          : `Daily SWOOOSH AI limit reached (${used}/${limit}). Your quota resets tomorrow UTC.`
      ),
      { status: 429 }
    );
  }

  recent.push(now);
  burstMap.set(caller.uid, recent);

  const nextUsed = used + cost;
  ledger.usage[caller.uid] = nextUsed;
  saveQuotaLedger(ledger);
  syncQuotaToFirestore(caller.uid, ledger.date, nextUsed, caller.idToken).catch(() => {});

  return {
    configured: true,
    used: nextUsed,
    limit,
    remaining: Math.max(0, limit - nextUsed),
    isDemo: caller.isDemo,
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface WardrobeContextItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  color: string;
  size: string;
  seasons?: string[];
  styleTags?: string[];
  laundryStatus?: string;
  description?: string;
}

function formatWardrobeSummary(wardrobe: WardrobeContextItem[]): string {
  if (!wardrobe || wardrobe.length === 0) {
    return 'The user currently has 0 clothing items in their wardrobe.';
  }
  return wardrobe
    .slice(0, 60)
    .map(
      (item) =>
        `- ID: "${item.id}" | Name: "${String(item.name).slice(0, 80)}" | Category: ${item.category} | Brand: ${String(item.brand).slice(0, 50)} | Color: ${String(item.color).slice(0, 40)} | Laundry: ${item.laundryStatus || 'clean'}${
          item.seasons?.length ? ` | Seasons: ${item.seasons.join(', ')}` : ''
        }${item.styleTags?.length ? ` | Tags: ${item.styleTags.join(', ')}` : ''}`
    )
    .join('\n');
}

function getCached(key: string) {
  const hit = responseCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.payload;
  responseCache.delete(key);
  return null;
}

function setCached(key: string, payload: any, ttlMs = 180_000) {
  responseCache.set(key, { expiresAt: Date.now() + ttlMs, payload });
}

// =====================================
// AI STATUS
// =====================================
app.get('/api/ai/status', async (req, res) => {
  try {
    const caller = await verifyCaller(req);
    res.json(getQuotaStatus(caller));
  } catch (err: any) {
    res.status(err?.status || 401).json({ error: err?.message || 'Unauthorized' });
  }
});

// A. AI Outfit Generator
app.post('/api/ai/generate-outfit', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key configured on the server.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const caller = await verifyCaller(req);
    const { wardrobe = [], preferences = {} } = req.body as {
      wardrobe: WardrobeContextItem[];
      preferences: {
        occasion?: string;
        style?: string;
        colors?: string;
        weather?: string;
        notes?: string;
      };
    };

    const cacheKey = crypto
      .createHash('sha256')
      .update(`gen:${caller.uid}:${JSON.stringify({ wardrobe: wardrobe.map((w) => w.id), preferences })}`)
      .digest('hex');

    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, quota: getQuotaStatus(caller) });
    }

    const quota = consumeQuotaOrThrow(caller, 1);
    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI ("YOUR PERSONAL AI FASHION STYLIST."), an expert streetwear and minimalist fashion stylist.
Analyze the user's ACTUAL wardrobe below and create up to 2 cohesive outfit recommendations based on their preferences and weather.

CRITICAL RULES:
1. ONLY use item IDs that explicitly exist in the user's wardrobe list below.
2. NEVER invent fake clothing items or fake IDs.
3. NEVER mention prices, budgets, stores, or shopping links.
4. Prefer items marked "clean" and suited to the weather/seasons provided.
5. If a category is missing (e.g. no shoes), return "" for that ID and explain clearly in "missingNote".

USER PREFERENCES:
- Occasion: ${String(preferences.occasion || 'Casual day').slice(0, 120)}
- Preferred Style: ${String(preferences.style || 'Streetwear').slice(0, 120)}
- Preferred Colors: ${String(preferences.colors || 'No preference').slice(0, 120)}
- Weather / Temperature: ${String(preferences.weather || 'Mild').slice(0, 140)}
- Styling Notes: ${String(preferences.notes || 'None').slice(0, 300)}

USER'S ACTUAL WARDROBE (${wardrobe.length} items):
${formatWardrobeSummary(wardrobe)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are SWOOOSH AI. Return valid JSON only. Never mention prices or shopping.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  outfitName: { type: Type.STRING },
                  topId: { type: Type.STRING },
                  bottomId: { type: Type.STRING },
                  shoesId: { type: Type.STRING },
                  accessoryIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  explanation: { type: Type.STRING },
                  occasion: { type: Type.STRING },
                  stylingTips: { type: Type.STRING },
                  missingNote: { type: Type.STRING },
                },
                required: ['outfitName', 'topId', 'bottomId', 'shoesId', 'accessoryIds', 'explanation', 'occasion', 'stylingTips', 'missingNote'],
              },
            },
            wardrobeReadinessNote: { type: Type.STRING },
          },
          required: ['outfits', 'wardrobeReadinessNote'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const sanitizedOutfits = (parsed.outfits || []).slice(0, 2).map((outfit: any) => ({
      ...outfit,
      topId: validIds.has(outfit.topId) ? outfit.topId : '',
      bottomId: validIds.has(outfit.bottomId) ? outfit.bottomId : '',
      shoesId: validIds.has(outfit.shoesId) ? outfit.shoesId : '',
      accessoryIds: Array.isArray(outfit.accessoryIds)
        ? outfit.accessoryIds.filter((id: string) => validIds.has(id))
        : [],
    }));

    const result = {
      outfits: sanitizedOutfits,
      wardrobeReadinessNote: parsed.wardrobeReadinessNote || '',
    };
    setCached(cacheKey, result);
    res.json({ ...result, quota });
  } catch (error: any) {
    console.error('Gemini generate-outfit error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to generate outfit recommendations.',
    });
  }
});

// B. AI Style Recommendations
app.post('/api/ai/style-recommendations', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { wardrobe = [], aesthetic = 'Streetwear' } = req.body as {
      wardrobe: WardrobeContextItem[];
      aesthetic: string;
    };
    const quota = consumeQuotaOrThrow(caller, 1);
    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI. The user wants to dress in the "${String(aesthetic).slice(0, 80)}" fashion aesthetic.
Suggest 2 combinations using ONLY exact item IDs from their wardrobe, plus silhouette guidance. Never mention prices or stores.

USER'S ACTUAL WARDROBE:
${formatWardrobeSummary(wardrobe)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aestheticSummary: { type: Type.STRING },
            combinations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  itemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  howToWear: { type: Type.STRING },
                },
                required: ['title', 'itemIds', 'howToWear'],
              },
            },
            gapsToConsider: { type: Type.STRING },
          },
          required: ['aestheticSummary', 'combinations', 'gapsToConsider'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const combinations = (parsed.combinations || []).map((c: any) => ({
      ...c,
      itemIds: Array.isArray(c.itemIds) ? c.itemIds.filter((id: string) => validIds.has(id)) : [],
    }));

    res.json({
      aestheticSummary: parsed.aestheticSummary || '',
      combinations,
      gapsToConsider: parsed.gapsToConsider || '',
      quota,
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Style recommendation failed.' });
  }
});

// C. AI Color Matching
app.post('/api/ai/color-match', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { targetItem, wardrobe = [] } = req.body as {
      targetItem: WardrobeContextItem;
      wardrobe: WardrobeContextItem[];
    };
    const quota = consumeQuotaOrThrow(caller, 1);
    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI. Style this target piece with matching owned pieces from the user's wardrobe and complementary color ideas. Never mention prices or shopping links.
TARGET ITEM:
- ID: "${targetItem.id}" | Name: "${targetItem.name}" | Category: ${targetItem.category} | Brand: ${targetItem.brand} | Color: ${targetItem.color}

USER'S WARDROBE:
${formatWardrobeSummary(wardrobe.filter((w) => w.id !== targetItem.id))}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colorTheoryNote: { type: Type.STRING },
            ownedMatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemId: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['itemId', 'reason'],
              },
            },
            complementaryIdeas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  color: { type: Type.STRING },
                  category: { type: Type.STRING },
                  pairingAdvice: { type: Type.STRING },
                },
                required: ['color', 'category', 'pairingAdvice'],
              },
            },
          },
          required: ['colorTheoryNote', 'ownedMatches', 'complementaryIdeas'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const ownedMatches = (parsed.ownedMatches || []).filter((m: any) => validIds.has(m.itemId));

    res.json({
      colorTheoryNote: parsed.colorTheoryNote || '',
      ownedMatches,
      complementaryIdeas: parsed.complementaryIdeas || [],
      quota,
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Color match failed.' });
  }
});

// D. AI Outfit Feedback (Counts as 2 requests; photo processed & discarded)
app.post('/api/ai/outfit-feedback', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { imageBase64, mimeType, notes = '' } = req.body as {
      imageBase64: string;
      mimeType: string;
      notes?: string;
    };
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'An outfit photo is required for AI Outfit Feedback.' });
    }
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    if (cleanBase64.length > 5_000_000) {
      return res.status(413).json({ error: 'Image is too large. Please upload a smaller photo.' });
    }

    const quota = consumeQuotaOrThrow(caller, 2);

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          {
            text: `You are SWOOOSH AI, a supportive fashion and streetwear stylist.
Analyze the outfit in this photo constructively. NEVER comment on body shape, face, or physical appearance—focus strictly on garments, proportions, textures, and color balance. Never mention prices or shopping.
${notes ? `User note: ${String(notes).slice(0, 300)}` : ''}`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallImpression: { type: Type.STRING },
            colorCoordination: { type: Type.STRING },
            proportionsAndSilhouette: { type: Type.STRING },
            outfitBalance: { type: Type.STRING },
            styleConsistency: { type: Type.STRING },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'overallImpression',
            'colorCoordination',
            'proportionsAndSilhouette',
            'outfitBalance',
            'styleConsistency',
            'improvements',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ...parsed, quota });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Failed to analyze outfit photo.' });
  }
});

// E. AI Fashion Chat
app.post('/api/ai/chat', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { messages = [], wardrobe = [] } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      wardrobe: WardrobeContextItem[];
    };
    const quota = consumeQuotaOrThrow(caller, 1);

    const systemInstruction = `You are SWOOOSH AI ("YOUR PERSONAL AI FASHION STYLIST.").
Reference clothing items the user actually owns in their wardrobe below. Never invent fake owned items. NEVER mention prices, costs, budgets, or shopping links. Keep answers concise, practical, and style-focused.

USER'S ACTUAL WARDROBE (${wardrobe.length} items):
${formatWardrobeSummary(wardrobe)}`;

    const conversationText = messages
      .slice(-8)
      .map((m) => `${m.role === 'user' ? 'User' : 'SWOOOSH AI'}: ${String(m.content).slice(0, 600)}`)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: conversationText || 'What should I wear today?',
      config: { systemInstruction },
    });

    res.json({ reply: (response.text ?? '').trim(), quota });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Fashion chat failed.' });
  }
});

// F. AI Missing Piece Suggestions (Strict No Prices / No Shopping)
app.post('/api/ai/missing-pieces', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { wardrobe = [] } = req.body as { wardrobe: WardrobeContextItem[] };
    const quota = consumeQuotaOrThrow(caller, 1);

    const prompt = `You are SWOOOSH AI. Audit the user's wardrobe below and identify up to 4 silhouette or category gaps that would unlock more outfit combinations with what they already own. Do NOT mention prices, currency, brands to buy, or store links.

USER'S ACTUAL WARDROBE:
${formatWardrobeSummary(wardrobe)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wardrobeSummary: { type: Type.STRING },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pieceName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  recommendedColor: { type: Type.STRING },
                  impactReason: { type: Type.STRING },
                },
                required: ['pieceName', 'category', 'recommendedColor', 'impactReason'],
              },
            },
          },
          required: ['wardrobeSummary', 'suggestions'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ...parsed, quota });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Gap analysis failed.' });
  }
});

// G. AI Auto-tagging on Garment Upload (Counts as 2 requests)
app.post('/api/ai/auto-tag', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType: string };
    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'A garment photo is required for auto-tagging.' });
    }
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    if (cleanBase64.length > 5_000_000) {
      return res.status(413).json({ error: 'Image is too large for auto-tagging.' });
    }

    const quota = consumeQuotaOrThrow(caller, 2);

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          {
            text: `Identify this clothing item for a digital wardrobe catalog.
Choose category strictly from: ["T-shirts","Shirts","Hoodies","Jackets","Pants","Shorts","Jorts","Shoes","Sneakers","Slides","Accessories","Other"].
Choose seasons strictly from: ["Spring","Summer","Fall","Winter","All-Season"].
Choose styleTags from: ["Streetwear","Minimalist","Casual","Vintage","Oversized","Smart Casual","Techwear","Workwear"].
Generate a concise descriptive name, primary color, 1-sentence altText for screen readers, and a brief fabric/cut description. No prices.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            color: { type: Type.STRING },
            styleTags: { type: Type.ARRAY, items: { type: Type.STRING } },
            seasons: { type: Type.ARRAY, items: { type: Type.STRING } },
            altText: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ['name', 'category', 'color', 'styleTags', 'seasons', 'altText', 'description'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({ ...parsed, quota });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'Auto-tagging failed.' });
  }
});

// H. AI Outfit Remix ("Swap one piece" / "Remix this fit")
app.post('/api/ai/remix-outfit', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) return res.status(503).json({ error: 'SWOOOSH AI requires a Gemini API key.' });

  try {
    const caller = await verifyCaller(req);
    const { sourcePieces = [], wardrobe = [], instruction = '' } = req.body as {
      sourcePieces: { slot: string; name: string; category: string; color: string }[];
      wardrobe: WardrobeContextItem[];
      instruction?: string;
    };
    const quota = consumeQuotaOrThrow(caller, 1);
    const validIds = new Set(wardrobe.map((w) => w.id));

    const sourceSummary = sourcePieces
      .map((p) => `- ${p.slot}: ${p.name} (${p.category}, ${p.color})`)
      .join('\n');

    const prompt = `You are SWOOOSH AI. The user wants to remix this outfit by swapping ONE piece with an item from their own clean wardrobe below.
SOURCE OUTFIT:
${sourceSummary || 'No pieces provided.'}

USER REQUEST: ${String(instruction || 'Give this fit a fresh twist using my wardrobe.').slice(0, 200)}

USER'S CLEAN WARDROBE:
${formatWardrobeSummary(wardrobe)}

Pick ONE slot ("top", "bottom", "shoes", or "accessory") and choose the single best replacementItemId strictly from the user's wardrobe above.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            slotToSwap: { type: Type.STRING },
            replacementItemId: { type: Type.STRING },
            replacementSummary: { type: Type.STRING },
            rationale: { type: Type.STRING },
          },
          required: ['slotToSwap', 'replacementItemId', 'replacementSummary', 'rationale'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const validSlot = ['top', 'bottom', 'shoes', 'accessory'].includes(parsed.slotToSwap)
      ? parsed.slotToSwap
      : 'top';

    res.json({
      slotToSwap: validSlot,
      replacementItemId: validIds.has(parsed.replacementItemId) ? parsed.replacementItemId : '',
      replacementSummary: parsed.replacementSummary || '',
      rationale: parsed.rationale || '',
      quota,
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({ error: error?.message || 'AI Remix failed.' });
  }
});

// =====================================
// DYNAMIC OPENGRAPH SHARE PAGE (/share/:token)
// =====================================
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

app.get('/share/:token', async (req, res) => {
  const token = String(req.params.token || '').replace(/[^a-zA-Z0-9_-]/g, '');
  let title = 'SWOOOSH — Shared Lookbook';
  let description = 'Explore a curated lookbook on SWOOOSH. PLAN. ORGANIZE. WEAR. SHARE YOUR FIT.';

  if (token) {
    try {
      const docUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DB_ID}/documents/shareLinks/${token}`;
      const r = await fetch(docUrl);
      if (r.ok) {
        const docJson = (await r.json()) as any;
        const fields = docJson?.fields || {};
        const visibility = fields.visibility?.stringValue;
        if (visibility && visibility !== 'revoked') {
          const t = fields.title?.stringValue;
          const d = fields.description?.stringValue;
          const author = fields.authorName?.stringValue;
          if (t) title = `${t}${author ? ` by ${author}` : ''} — SWOOOSH`;
          if (d) description = d;
        }
      }
    } catch {
      // fall back to generic SWOOOSH OG tags
    }
  }

  const targetUrl = `/?share=${encodeURIComponent(token)}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/pwa-512x512.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta http-equiv="refresh" content="0;url=${targetUrl}" />
  </head>
  <body style="background:#171717;color:#e5e1da;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
    <p>Opening SWOOOSH lookbook... <a href="${targetUrl}" style="color:#e5e1da;">Continue</a></p>
  </body>
</html>`);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SWOOOSH server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
