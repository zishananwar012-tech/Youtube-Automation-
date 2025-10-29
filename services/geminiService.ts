import { GoogleGenAI, Type, GenerateContentResponse, Chat, Modality } from "@google/genai";
import { ChatMessage, Script } from "../types";

const getGenAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateScript = async (topic: string, useGrounding: boolean): Promise<Script> => {
    const ai = getGenAI();
    
    const basePrompt = `The script should have a title and be broken down into 5-7 scenes. For each scene, provide a concise description of the visual action and a detailed prompt for an AI image generator to create a corresponding visual.`;
    const jsonInstruction = `Your final response must be ONLY a single, valid JSON object that conforms to this structure: {"title": "...", "scenes": [{"description": "...", "imagePrompt": "..."}]}. Do not include any conversational text, explanations, or markdown formatting like \`\`\`json in your response.`;

    const contents = useGrounding 
        ? `Use Google Search to find up-to-date information about "${topic}". Based on your search results, create a compelling YouTube video script. ${basePrompt} ${jsonInstruction}`
        : `Create a compelling YouTube video script about "${topic}". ${basePrompt} ${jsonInstruction}`;

    // Awaited from V2 - `any` is required here because the config properties are conditional.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      thinkingConfig: { thinkingBudget: 32768 },
    };
    
    if (useGrounding) {
      config.tools = [{ googleSearch: {} }];
    } else {
      config.responseMimeType = "application/json";
      config.responseSchema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
              },
            },
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
      config: config,
    });

    try {
      const cleanedText = response.text.replace(/^```json\s*|```\s*$/g, '');
      return JSON.parse(cleanedText);
    } catch (e) {
      console.error("Failed to parse script JSON:", e, "Raw text:", response.text);
      throw new Error("The AI returned a script in an invalid format. Please try again.");
    }
};

export const generateImages = async (prompts: string[], aspectRatio: string): Promise<string[]> => {
  const ai = getGenAI();
  const images: string[] = [];
  for (const prompt of prompts) {
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
        },
    });
    images.push(response.generatedImages[0].image.imageBytes);
  }
  return images;
};

export const editImage = async (imageData: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
            parts: [
                { inlineData: { data: imageData, mimeType: mimeType } },
                { text: prompt },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            return part.inlineData.data;
        }
    }
    throw new Error("No image found in edit response");
};

export const analyzeImage = async (imageData: string, mimeType: string, prompt: string): Promise<string> => {
    const ai = getGenAI();
    const textPart = { text: prompt };
    const imagePart = { inlineData: { mimeType, data: imageData } };
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
    });
    return response.text;
};


export const generateVoiceover = async (script: string): Promise<string> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: script }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? '';
};

export const createChat = (): Chat => {
    const ai = getGenAI();
    return ai.chats.create({
        model: 'gemini-2.5-flash',
    });
};

export const groundedSearch = async (query: string): Promise<GenerateContentResponse> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
            tools: [{ googleSearch: {} }],
        },
    });
    return response;
};

export const groundedMapsSearch = async (query: string, latitude: number, longitude: number): Promise<GenerateContentResponse> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: query,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: {
                        latitude,
                        longitude,
                    }
                }
            }
        },
    });
    return response;
}

export const getQuickResponse = async (prompt: string): Promise<string> => {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
    });
    return response.text;
}