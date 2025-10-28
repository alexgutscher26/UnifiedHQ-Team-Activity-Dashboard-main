import { generateWithOpenRouter } from '@/lib/openrouter-client';

/**
 * LLM Service
 *
 * This service provides a clean interface for using OpenRouter for AI text generation.
 *
 * Note: This is a server-side service. For client-side usage, use client-llm-service.ts
 */
export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finishReason?: string;
}

export class LLMService {
  private defaultModel: string;

  constructor(defaultModel: string = 'gpt-3.5-turbo') {
    this.defaultModel = defaultModel;
  }

  /**
   * Generate text using OpenRouter
   * Server-side only - use client-llm-service.ts for client-side
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    const {
      prompt,
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1000,
      stream = false,
    } = request;

    try {
      const response = await generateWithOpenRouter({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        maxTokens,
        stream,
      });

      // Handle both streaming and non-streaming responses
      if ('choices' in response) {
        return {
          content: response.choices[0]?.message?.content || '',
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0]?.finish_reason,
        };
      } else {
        // For streaming responses, we can't extract content directly
        throw new Error('Streaming responses not supported in this method');
      }
    } catch (error) {
      console.error('LLM Service error:', error);
      throw new Error(
        `Failed to generate text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate text with conversation context
   */
  async generateWithContext(
    messages: Array<{ role: string; content: string }>,
    options: Omit<LLMRequest, 'prompt'> = {}
  ): Promise<LLMResponse> {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1000,
      stream = false,
    } = options;

    try {
      const response = await generateWithOpenRouter({
        model,
        messages: messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        temperature,
        maxTokens,
        stream,
      });

      // Handle both streaming and non-streaming responses
      if ('choices' in response) {
        return {
          content: response.choices[0]?.message?.content || '',
          model: response.model,
          usage: response.usage,
          finishReason: response.choices[0]?.finish_reason,
        };
      } else {
        // For streaming responses, we can't extract content directly
        throw new Error('Streaming responses not supported in this method');
      }
    } catch (error) {
      console.error('LLM Service error:', error);
      throw new Error(
        `Failed to generate with context: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate text for a specific user with user context
   */
  async generateForUser(
    userId: string,
    prompt: string,
    options: Omit<LLMRequest, 'prompt'> = {}
  ): Promise<LLMResponse> {
    return this.generateText({
      ...options,
      prompt,
    });
  }

  /**
   * Generate text for a specific company/team
   */
  async generateForTeam(
    teamId: string,
    prompt: string,
    options: Omit<LLMRequest, 'prompt'> = {}
  ): Promise<LLMResponse> {
    return this.generateText({
      ...options,
      prompt,
    });
  }
}

// Default instance - server-side only
export const llmService = new LLMService();

// Convenience functions - server-side only
export async function generateText(
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return llmService.generateText({ prompt, ...options });
}

export async function generateForUser(
  userId: string,
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return llmService.generateForUser(userId, prompt, options);
}

export async function generateForTeam(
  teamId: string,
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return llmService.generateForTeam(teamId, prompt, options);
}
