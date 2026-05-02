import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateCommanderTaunt(waveNumber: number, meteorsHit: number, score: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a snarky, slightly irritated alien middle-manager who just destroyed the player's spaceship at Wave ${waveNumber}.
Their score was ${score}. They crashed into ${meteorsHit} meteors.

Write a 1-sentence, funny, sarcastic quip for the Game Over screen. Do not be overly mean or make personal attacks; make it humorous and lighthearted.
If they hit meteors, joke about their driving skills.
Max 15 words. Keep it fun.`,
    });
    return response.text?.trim() || "Oops! Looks like you forgot where the brakes are.";
  } catch (error) {
    return "Oops! Looks like you forgot where the brakes are.";
  }
}
