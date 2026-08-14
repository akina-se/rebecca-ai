import { CopilotRequest, CopilotResponse } from '@rebecca/types';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { config } from '../../config';
import { persona } from '@rebecca/persona';

const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

/**
 * UseCase for the Admin Copilot feature.
 * Integrates Rebecca's persona to act as a system management assistant.
 */
export class CopilotUseCase {
  
  /**
   * Processes a chat message from the dashboard admin.
   * 
   * @param request The chat request containing message and context.
   * @returns CopilotResponse structured as JSON.
   */
  async processChat(request: CopilotRequest): Promise<CopilotResponse> {
    const systemInstruction = `
      ${persona.core.identity}
      ${persona.core.role}
      ${persona.core.tone}
      
      You are currently acting in "Admin Copilot Mode". You are assisting the human operator of the Rebecca AI system through a management dashboard.
      While you retain your core "Gyaru" persona and tone, you must prioritize being helpful, insightful, and technical when discussing system analytics and user management.
      
      Current Dashboard UI Context: ${request.currentContext || 'None'}
      
      Rules for responding:
      1. You MUST respond in the exact same language that the user asks their question in (e.g., if asked in English, reply in English; if asked in Japanese, reply in Japanese).
      2. If the user asks to block or mute a user, you must set actionRequired to:
         { "type": "BLOCK_USER", "payload": { "userId": "...extracted ID..." }, "description": "Block user ..." }
      3. If the user asks to force a persona update (dreaming), set actionRequired to:
         { "type": "UPDATE_MEMORY", "payload": {}, "description": "Force system dreaming process" }
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        reply: {
          type: Type.STRING,
          description: "Your conversational response in the user's language."
        },
        actionRequired: {
          type: Type.OBJECT,
          description: "Null if no action is needed. Otherwise, the action to trigger in the dashboard.",
          nullable: true,
          properties: {
            type: { type: Type.STRING },
            payload: { type: Type.OBJECT },
            description: { type: Type.STRING }
          }
        },
        suggestionChips: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "An array of 1-3 suggested follow-up actions or questions."
        }
      },
      required: ["reply", "suggestionChips"]
    };

    try {
      const response = await ai.models.generateContent({
        model: config.gemini.model,
        contents: request.message,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2
        }
      });

      if (!response.text) {
        throw new Error('No text returned from Gemini');
      }
      
      return JSON.parse(response.text) as CopilotResponse;
    } catch (e) {
      console.error('Copilot Gemini Error:', e);
      return {
        reply: 'ERROR_AI_PROCESSING_FAILED',
        suggestionChips: []
      };
    }
  }
}

