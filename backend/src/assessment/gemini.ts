// ---------------------------------------------------------------------------
// Assessment Module – Isolated Gemini Client
// Uses gemini-2.5-flash with thinkingBudget: 0 for fast structured output.
// ---------------------------------------------------------------------------

import { GoogleGenAI } from "@google/genai";
import config from "../config/index.ts";

const MODEL = "gemini-2.5-flash";
const TIMEOUT_MS = 60_000;

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({
      apiKey: config.geminiApiKey(),
      httpOptions: { timeout: TIMEOUT_MS },
    });
  }
  return _ai;
}

/**
 * Send a structured-output prompt to Gemini and get back a JSON string.
 * Falls back through models if the primary one is unavailable.
 */
export async function generateJSON(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const candidateModels = [
    MODEL,
    "gemini-3.8-flash",
    "gemini-2.0-flash",
  ];

  let lastError: unknown;

  for (const model of candidateModels) {
    try {
      const ai = getAI();
      const res = await ai.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          temperature: 0.3,
          // @ts-ignore — thinkingConfig may not be in type defs yet
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      if (res.text) {
        console.info(`[Assessment] Gemini responded using model: ${model}`);
        return res.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const is404 =
        err?.status === 404 ||
        err?.code === 404 ||
        errMsg.includes("not found") ||
        errMsg.includes("NOT_FOUND") ||
        errMsg.includes("no longer available");

      if (is404) {
        console.warn(`[Assessment] Model ${model} unavailable, trying next...`);
        continue;
      }
      // Non-404 errors should fail fast
      throw err;
    }
  }

  throw lastError || new Error("[Assessment] All Gemini models failed");
}
