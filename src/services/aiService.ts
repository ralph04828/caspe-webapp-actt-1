import { auth } from '../firebase';
import {
  AIAutoTagResponse,
  AIColorMatchResponse,
  AIMissingPiecesResponse,
  AIOutfitFeedbackResponse,
  AIOutfitGeneratorResponse,
  AIQuotaStatus,
  AIRemixResponse,
  AIStyleRecommendationResponse,
  ClothingItem,
  OutfitPieceSnapshot,
} from '../types';

function serializeWardrobe(wardrobe: ClothingItem[]) {
  return wardrobe.slice(0, 60).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    color: item.color,
    size: item.size,
    seasons: item.seasons || [],
    styleTags: item.styleTags || [],
    laundryStatus: item.laundryStatus || 'clean',
    description: item.description || '',
  }));
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['X-Swooosh-Demo'] = 'true';
  }
  return headers;
}

async function postAI<T>(endpoint: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `SWOOOSH AI request failed (${res.status}).`);
  }
  return data as T;
}

export async function checkAIStatus(): Promise<AIQuotaStatus> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/ai/status', { headers });
    if (!res.ok) {
      return { configured: false, used: 0, limit: 20, remaining: 20, isDemo: !auth.currentUser };
    }
    return await res.json();
  } catch {
    return { configured: false, used: 0, limit: 20, remaining: 20, isDemo: !auth.currentUser };
  }
}

export async function generateAIOutfit(
  wardrobe: ClothingItem[],
  preferences: {
    occasion: string;
    style: string;
    colors: string;
    weather: string;
    notes: string;
    cleanOnly?: boolean;
  }
): Promise<AIOutfitGeneratorResponse> {
  const pool =
    preferences.cleanOnly !== false
      ? wardrobe.filter((w) => w.laundryStatus === 'clean')
      : wardrobe;
  const activePool = pool.length > 0 ? pool : wardrobe;

  return postAI<AIOutfitGeneratorResponse>('/api/ai/generate-outfit', {
    wardrobe: serializeWardrobe(activePool),
    preferences,
  });
}

export async function getAIStyleRecommendations(
  wardrobe: ClothingItem[],
  aesthetic: string
): Promise<AIStyleRecommendationResponse> {
  return postAI<AIStyleRecommendationResponse>('/api/ai/style-recommendations', {
    wardrobe: serializeWardrobe(wardrobe),
    aesthetic,
  });
}

export async function getAIColorMatch(
  targetItem: ClothingItem,
  wardrobe: ClothingItem[]
): Promise<AIColorMatchResponse> {
  return postAI<AIColorMatchResponse>('/api/ai/color-match', {
    targetItem: {
      id: targetItem.id,
      name: targetItem.name,
      category: targetItem.category,
      brand: targetItem.brand,
      color: targetItem.color,
      size: targetItem.size,
      seasons: targetItem.seasons || [],
      styleTags: targetItem.styleTags || [],
      laundryStatus: targetItem.laundryStatus || 'clean',
      description: targetItem.description || '',
    },
    wardrobe: serializeWardrobe(wardrobe),
  });
}

export async function getAIOutfitFeedback(
  imageBase64: string,
  mimeType: string,
  notes?: string
): Promise<AIOutfitFeedbackResponse> {
  return postAI<AIOutfitFeedbackResponse>('/api/ai/outfit-feedback', {
    imageBase64,
    mimeType,
    notes,
  });
}

export async function sendAIFashionChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  wardrobe: ClothingItem[]
): Promise<{ reply: string; quota?: AIQuotaStatus }> {
  return postAI<{ reply: string; quota?: AIQuotaStatus }>('/api/ai/chat', {
    messages: messages.slice(-10),
    wardrobe: serializeWardrobe(wardrobe),
  });
}

export async function getAIMissingPieces(
  wardrobe: ClothingItem[]
): Promise<AIMissingPiecesResponse> {
  return postAI<AIMissingPiecesResponse>('/api/ai/missing-pieces', {
    wardrobe: serializeWardrobe(wardrobe),
  });
}

export async function autoTagGarmentPhoto(
  imageBase64: string,
  mimeType: string
): Promise<AIAutoTagResponse> {
  return postAI<AIAutoTagResponse>('/api/ai/auto-tag', {
    imageBase64,
    mimeType,
  });
}

export async function remixOutfitWithAI(
  sourcePieces: OutfitPieceSnapshot[],
  wardrobe: ClothingItem[],
  instruction?: string
): Promise<AIRemixResponse> {
  return postAI<AIRemixResponse>('/api/ai/remix-outfit', {
    sourcePieces: sourcePieces.filter((p) => !p.isPrivatePlaceholder),
    wardrobe: serializeWardrobe(wardrobe.filter((w) => w.laundryStatus === 'clean')),
    instruction: instruction || '',
  });
}
