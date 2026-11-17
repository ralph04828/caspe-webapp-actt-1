import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '12mb' }));

const MODEL_NAME = 'gemini-4-hydrogen';

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
  description?: string;
}

function formatWardrobeSummary(wardrobe: WardrobeContextItem[]): string {
  if (!wardrobe || wardrobe.length === 0) {
    return 'The user currently has 0 clothing items in their wardrobe.';
  }
  return wardrobe
    .map(
      (item) =>
        `- ID: "${item.id}" | Name: "${item.name}" | Category: ${item.category} | Brand: ${item.brand} | Color: ${item.color} | Size: ${item.size}${item.description ? ` | Notes: ${item.description}` : ''}`
    )
    .join('\n');
}

// Health & Gemini configuration status
app.get('/api/ai/status', (_req, res) => {
  const configured = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim() !== ''
  );
  res.json({ configured });
});

// A. AI Outfit Generator
app.post('/api/ai/generate-outfit', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
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

    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI, an elite personal streetwear and editorial fashion stylist.
Analyze the user's ACTUAL wardrobe below and create up to 2 cohesive outfit recommendations based on their preferences.

CRITICAL RULES:
1. You MUST ONLY use item IDs that explicitly exist in the user's wardrobe list below.
2. NEVER invent fake clothing items or fake IDs and present them as owned items.
3. If the wardrobe is missing a required category (for example, no shoes or no bottoms or no tops), leave that item ID empty string "" and clearly explain what is missing in "missingNote", along with helpful advice on what piece to add.
4. Explain WHY the combination works (silhouettes, textures, color balance, streetwear proportions).

USER PREFERENCES:
- Occasion: ${preferences.occasion || 'Casual day'}
- Preferred Style: ${preferences.style || 'Streetwear'}
- Preferred Colors: ${preferences.colors || 'No preference'}
- Weather / Temperature: ${preferences.weather || 'Mild / Not specified'}
- Styling Notes: ${preferences.notes || 'None'}

USER'S ACTUAL WARDROBE (${wardrobe.length} items):
${formatWardrobeSummary(wardrobe)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are SWOOOSH AI, a sharp, modern streetwear and luxury minimalist fashion stylist. Always return valid JSON matching the schema.',
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
                  topId: { type: Type.STRING, description: 'Exact ID of a top from the wardrobe, or empty string if none fits/available.' },
                  bottomId: { type: Type.STRING, description: 'Exact ID of a bottom from the wardrobe, or empty string if none fits/available.' },
                  shoesId: { type: Type.STRING, description: 'Exact ID of footwear from the wardrobe, or empty string if none fits/available.' },
                  accessoryIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Exact IDs of accessories from the wardrobe.',
                  },
                  explanation: { type: Type.STRING },
                  occasion: { type: Type.STRING },
                  stylingTips: { type: Type.STRING },
                  missingNote: { type: Type.STRING, description: 'Note explaining any missing category if wardrobe lacks items, otherwise empty string.' },
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
    // Strictly validate returned IDs against actual wardrobe
    const sanitizedOutfits = (parsed.outfits || []).map((outfit: any) => ({
      ...outfit,
      topId: validIds.has(outfit.topId) ? outfit.topId : '',
      bottomId: validIds.has(outfit.bottomId) ? outfit.bottomId : '',
      shoesId: validIds.has(outfit.shoesId) ? outfit.shoesId : '',
      accessoryIds: Array.isArray(outfit.accessoryIds)
        ? outfit.accessoryIds.filter((id: string) => validIds.has(id))
        : [],
    }));

    res.json({
      outfits: sanitizedOutfits,
      wardrobeReadinessNote: parsed.wardrobeReadinessNote || '',
    });
  } catch (error: any) {
    console.error('Gemini generate-outfit error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to generate outfit recommendations from SWOOOSH AI.',
    });
  }
});

// B. AI Style Recommendations
app.post('/api/ai/style-recommendations', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const { wardrobe = [], aesthetic = 'Streetwear' } = req.body as {
      wardrobe: WardrobeContextItem[];
      aesthetic: string;
    };
    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI. The user wants to dress in the "${aesthetic}" fashion aesthetic.
Analyze their actual wardrobe below and suggest 2 concrete ways to achieve the "${aesthetic}" aesthetic using ONLY items they own (referencing exact item IDs), plus clear silhouette & layering guidance.
If key pieces for "${aesthetic}" are missing from their wardrobe, state that transparently in "gapsToConsider".

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
    });
  } catch (error: any) {
    console.error('Gemini style-recommendations error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to generate style recommendations.',
    });
  }
});

// C. AI Color Matching
app.post('/api/ai/color-match', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const { targetItem, wardrobe = [] } = req.body as {
      targetItem: WardrobeContextItem;
      wardrobe: WardrobeContextItem[];
    };
    const validIds = new Set(wardrobe.map((w) => w.id));

    const prompt = `You are SWOOOSH AI. The user selected this clothing item to style:
TARGET ITEM:
- ID: "${targetItem.id}" | Name: "${targetItem.name}" | Category: ${targetItem.category} | Brand: ${targetItem.brand} | Color: ${targetItem.color}

Analyze what colors and categories complement this piece.
First, identify exact matching items ALREADY in the user's wardrobe (strictly using valid IDs from the list below, excluding the target item itself).
Second, suggest general complementary color + category pairings (like "Black cargo pants" or "Cream sneakers") that work with this piece.

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
    });
  } catch (error: any) {
    console.error('Gemini color-match error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to generate color matching recommendations.',
    });
  }
});

// D. AI Outfit Feedback (Multimodal Image Analysis)
app.post('/api/ai/outfit-feedback', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const { imageBase64, mimeType, notes = '' } = req.body as {
      imageBase64: string;
      mimeType: string;
      notes?: string;
    };

    if (!imageBase64 || !mimeType) {
      return res.status(400).json({ error: 'An outfit photo is required for AI Outfit Feedback.' });
    }

    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const imagePart = {
      inlineData: {
        mimeType,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: `You are SWOOOSH AI, a supportive, expert fashion and streetwear stylist.
Analyze the outfit shown in this photo constructively and respectfully.
NEVER make judgmental or insulting comments about the person's body, face, or physical appearance—focus strictly on the garments, styling, proportions, and coordination.
${notes ? `User context: ${notes}` : ''}

Evaluate:
1. Color coordination
2. Clothing proportions & silhouette
3. Outfit balance
4. Style consistency
5. Actionable improvements or styling tweaks`,
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [imagePart, textPart] },
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
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
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
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini outfit-feedback error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to analyze outfit photo.',
    });
  }
});

// E. AI Fashion Chat
app.post('/api/ai/chat', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const { messages = [], wardrobe = [] } = req.body as {
      messages: { role: 'user' | 'assistant'; content: string }[];
      wardrobe: WardrobeContextItem[];
    };

    const systemInstruction = `You are SWOOOSH AI ("YOUR PERSONAL AI FASHION STYLIST."), a concise, knowledgeable streetwear and fashion styling assistant.
Always prioritize referencing clothing items the user actually owns in their wardrobe below when answering styling questions. Never invent fake items and claim they are in the user's wardrobe. Keep responses clear, practical, and structured.

USER'S ACTUAL WARDROBE (${wardrobe.length} items):
${formatWardrobeSummary(wardrobe)}`;

    const conversationText = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'SWOOOSH AI'}: ${m.content}`)
      .join('\n\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: conversationText || 'What should I wear today?',
      config: {
        systemInstruction,
      },
    });

    res.json({ reply: (response.text ?? '').trim() });
  } catch (error: any) {
    console.error('Gemini chat error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to get response from SWOOOSH AI.',
    });
  }
});

// F. AI Missing Piece Suggestions
app.post('/api/ai/missing-pieces', async (req, res) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'SWOOOSH AI requires a Gemini API key. Configure GEMINI_API_KEY in Settings > Secrets.',
      code: 'GEMINI_NOT_CONFIGURED',
    });
  }

  try {
    const { wardrobe = [] } = req.body as { wardrobe: WardrobeContextItem[] };

    const prompt = `You are SWOOOSH AI. Audit the user's current wardrobe below and identify the highest-impact missing categories or specific garment types that would unlock the most new outfit combinations with what they already own.

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
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini missing-pieces error:', error);
    res.status(error?.status || 500).json({
      error: error?.message || 'Failed to analyze wardrobe gaps.',
    });
  }
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
