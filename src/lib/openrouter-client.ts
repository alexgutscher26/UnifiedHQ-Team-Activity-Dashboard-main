import { OpenAI } from 'openai';
import { withRetry, RetryPresets } from '@/lib/retry-utils';

let openRouterClient: OpenAI | null = null;

export function getOpenRouterClient(): OpenAI | null {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn(
      'OpenRouter API key not found. Please check your .env.local file.'
    );
    return null;
  }

  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      baseURL:
        process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openRouterClient;
}

export interface LLMGenerationOptions {
  model: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export async function generateWithOpenRouter(options: LLMGenerationOptions) {
  const openaiClient = getOpenRouterClient();

  if (!openaiClient) {
    throw new Error(
      'OpenRouter client not configured. Please check your environment variables.'
    );
  }

  return withRetry(
    async () => {
      // Make the API call to OpenRouter
      const response = await openaiClient!.chat.completions.create({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000,
        stream: options.stream || false,
      });

      return response;
    },
    {
      ...RetryPresets.openrouter,
      onRetry: (error, attempt, delay) => {
        console.warn(
          `OpenRouter API call failed (attempt ${attempt}), retrying in ${delay}ms:`,
          error.message
        );
      },
      onMaxRetriesExceeded: (error, attempts) => {
        console.error(
          `OpenRouter API call failed after ${attempts} attempts:`,
          error.message
        );
      },
    }
  ).then(result => result.data);
}

// Convenience function for simple text generation
export async function generateText(
  prompt: string,
  model: string = 'gpt-3.5-turbo',
  options: Partial<LLMGenerationOptions> = {}
) {
  return generateWithOpenRouter({
    model,
    messages: [{ role: 'user', content: prompt }],
    ...options,
  });
}
