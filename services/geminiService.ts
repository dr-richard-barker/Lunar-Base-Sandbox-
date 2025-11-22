/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";
import { AIGoal, BuildingType, CityStats, Grid, NewsItem } from "../types";
import { BUILDINGS } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = 'gemini-2.5-flash';

// --- Goal Generation ---

// @google/genai-schema-fix: The `Schema` type is not exported from @google/genai. Use a const object for the schema.
const goalSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description: "A short, creative objective from the perspective of the Lunar Command AI or Base Commander.",
    },
    targetType: {
      type: Type.STRING,
      enum: ['population', 'money', 'building_count'],
      description: "The metric to track.",
    },
    targetValue: {
      type: Type.INTEGER,
      description: "The target numeric value to reach.",
    },
    buildingType: {
      type: Type.STRING,
      enum: [BuildingType.Residential, BuildingType.Commercial, BuildingType.Industrial, BuildingType.Park, BuildingType.Road],
      description: "Required if targetType is building_count.",
    },
    reward: {
      type: Type.INTEGER,
      description: "Credit reward for completion.",
    },
  },
  required: ['description', 'targetType', 'targetValue', 'reward'],
};

export const generateCityGoal = async (stats: CityStats, grid: Grid): Promise<AIGoal | null> => {
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`. Do not add checks for its existence.

  // Count buildings
  const counts: Record<string, number> = {};
  grid.flat().forEach(tile => {
    counts[tile.buildingType] = (counts[tile.buildingType] || 0) + 1;
  });

  const context = `
    Current Lunar Base Stats:
    Sol: ${stats.day}
    Credits: ${stats.money}
    Colonists: ${stats.population}
    Modules: ${JSON.stringify(counts)}
    Module Costs/Stats: ${JSON.stringify(
      Object.values(BUILDINGS).filter(b => b.type !== BuildingType.None).map(b => ({type: b.type, cost: b.cost, pop: b.popGen, income: b.incomeGen}))
    )}
  `;

  const prompt = `You are the Central AI for a lunar colony. Based on the current base stats, generate a challenging but achievable short-term mission for the commander to ensure colony survival and growth. Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: goalSchema,
        temperature: 0.7,
      },
    });

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const goalData = JSON.parse(response.text) as Omit<AIGoal, 'completed'>;
      return { ...goalData, completed: false };
    }
  } catch (error) {
    console.error("Error generating goal:", error);
  }
  return null;
};

// --- News Feed Generation ---

// @google/genai-schema-fix: The `Schema` type is not exported from @google/genai. Use a const object for the schema.
const newsSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "A one-sentence system alert or news headline from the lunar colony." },
    type: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
  },
  required: ['text', 'type'],
};

export const generateNewsEvent = async (stats: CityStats, recentAction: string | null): Promise<NewsItem | null> => {
  // @google/genai-api-key-fix: The API key must be obtained exclusively from the environment variable `process.env.API_KEY`. Do not add checks for its existence.

  const context = `Base Stats - Crew: ${stats.population}, Credits: ${stats.money}, Sol: ${stats.day}. ${recentAction ? `Recent Action: ${recentAction}` : ''}`;
  const prompt = "Generate a very short, sci-fi style system alert or news headline for a moon base. Topics: oxygen, meteors, discoveries, rations, morale. Can be dry humour or serious warning.";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      // @google/genai-generate-content-fix: For text-only prompts, `contents` should be a single string.
      contents: `${context}\n${prompt}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: newsSchema,
        temperature: 1.1, // High temp for variety
      },
    });

    // @google/genai-response-text-fix: Access the `text` property directly from the response.
    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        id: Date.now().toString() + Math.random(),
        text: data.text,
        type: data.type,
      };
    }
  } catch (error) {
    console.error("Error generating news:", error);
  }
  return null;
};