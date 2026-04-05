import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

/**
 * Robust AI Service Handler
 * Handles 429 Quota Exceeded errors with exponential backoff and model fallback.
 */

// Configuration
const CONFIG = {
  MAX_RETRIES: 2, // Reduced for faster failure/fallback
  INITIAL_BACKOFF: 500, // 0.5s
  PRIMARY_MODEL: "gemini-3-flash-preview",
  FALLBACK_MODEL: "gemini-3.1-flash-lite-preview",
  USE_FALLBACK: process.env.USE_FALLBACK === 'true' || true,
  ENV: process.env.NODE_ENV || 'production',
  TIMEOUT_MS: 15000, // 15s timeout
};

interface AIRequestOptions {
  model?: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
  maxOutputTokens?: number;
  cacheKey?: string;
}

class AIService {
  private ai: GoogleGenAI;
  private cache: Map<string, { response: GenerateContentResponse, timestamp: number }> = new Map();

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  private log(data: any) {
    console.log(`[AI_PERF] ${new Date().toISOString()} |`, JSON.stringify(data));
  }

  private compressPrompt(prompt: string): string {
    return prompt.replace(/\s+/g, ' ').trim();
  }

  async generateContent(
    prompt: string, 
    options: AIRequestOptions = {}, 
    onStatusUpdate?: (status: string) => void
  ): Promise<GenerateContentResponse> {
    const startTime = performance.now();
    
    // Check Cache
    if (options.cacheKey && this.cache.has(options.cacheKey)) {
      const cached = this.cache.get(options.cacheKey)!;
      if (Date.now() - cached.timestamp < 1000 * 60 * 10) { // 10 min cache
        this.log({ event: 'cache_hit', key: options.cacheKey });
        return cached.response;
      }
    }

    let currentModel = options.model || CONFIG.PRIMARY_MODEL;
    let attempt = 0;
    let backoff = CONFIG.INITIAL_BACKOFF;
    let isFallbackTriggered = false;

    const finalPrompt = (attempt > 0 || isFallbackTriggered) 
      ? this.compressPrompt(prompt) 
      : prompt;

    while (attempt <= CONFIG.MAX_RETRIES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

        const responsePromise = this.ai.models.generateContent({
          model: currentModel,
          contents: finalPrompt,
          config: {
            systemInstruction: options.systemInstruction,
            responseMimeType: options.responseMimeType as any,
            responseSchema: options.responseSchema,
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens || 1024, // Limit tokens for speed
          },
        });

        // Race against timeout
        const response = await Promise.race([
          responsePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), CONFIG.TIMEOUT_MS))
        ]) as GenerateContentResponse;

        clearTimeout(timeoutId);

        const duration = performance.now() - startTime;
        this.log({
          event: 'success',
          model: currentModel,
          duration: `${duration.toFixed(2)}ms`,
          attempt,
          fallback: isFallbackTriggered
        });

        // Store in Cache
        if (options.cacheKey) {
          this.cache.set(options.cacheKey, { response, timestamp: Date.now() });
        }

        return response;

      } catch (error: any) {
        attempt++;
        const errorMsg = error?.message || String(error);
        const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED');
        const isTimeout = errorMsg === 'TIMEOUT';

        this.log({
          event: 'error',
          errorType: isTimeout ? 'TIMEOUT' : (isQuotaError ? 'QUOTA' : 'OTHER'),
          message: errorMsg,
          model: currentModel,
          attempt
        });

        if ((isQuotaError || isTimeout) && attempt <= CONFIG.MAX_RETRIES) {
          onStatusUpdate?.(isTimeout ? "Optimizing for speed..." : "High demand detected, optimizing...");
          await new Promise(resolve => setTimeout(resolve, backoff));
          backoff *= 1.5;
          continue;
        }

        if (CONFIG.USE_FALLBACK && !isFallbackTriggered) {
          isFallbackTriggered = true;
          currentModel = CONFIG.FALLBACK_MODEL;
          attempt = 0;
          onStatusUpdate?.("Switching to ultra-fast backup...");
          continue;
        }

        throw new Error(`AI Generation failed. ${errorMsg}`);
      }
    }

    throw new Error("Maximum retries exceeded");
  }
}

export const aiService = new AIService();
