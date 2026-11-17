import {
  AIColorMatchResponse,
  AIMissingPiecesResponse,
  AIOutfitFeedbackResponse,
  AIOutfitGeneratorResponse,
  AIStyleRecommendationResponse,
  ClothingItem,
} from '../types';

function serializeWardrobe(wardrobe: ClothingItem[]) {
  return wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    color: item.color,
    size: item.size,
    description: item.description || '',
  }));
}

async function postAI<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `SWOOOSH AI request failed (${res.status}).`);
  }
  return data as T;
}

export async function checkAIStatus(): Promise<{ configured: boolean }> {
  try {
    const res = await fetch('/api/ai/status');
    if (!res.ok) return { configured: false };
    return await res.json();
  } catch {
    return { configured: false };
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
  }
): Promise<AIOutfitGeneratorResponse> {
  return postAI<AIOutfitGeneratorResponse>('/api/ai/generate-outfit', {
    wardrobe: serializeWardrobe(wardrobe),
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
): Promise<{ reply: string }> {
  return postAI<{ reply: string }>('/api/ai/chat', {
    messages,
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
