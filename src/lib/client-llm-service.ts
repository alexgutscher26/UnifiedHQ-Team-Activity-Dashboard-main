import { withRetry, RetryPresets } from '@/lib/retry-utils';

export interface LLMRequest {
  prompt: string;
  model?: string;
  distinctId?: string;
  traceId?: string;
  properties?: Record<string, any>;
  groups?: Record<string, string>;
  temperature?: number;
  maxTokens?: number;
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

export class ClientLLMService {
  private apiEndpoint: string;

  constructor(apiEndpoint: string = '/api/openrouter') {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Generate text using OpenRouter via API endpoint.
   *
   * This function constructs a request to the OpenRouter API with the provided parameters, including prompt, model, and other optional settings. It handles the response, checking for errors and retrying the request if necessary. The function also tracks analytics by including distinctId and traceId, and it formats the request body with additional properties and groups.
   *
   * @param {LLMRequest} request - The request object containing parameters for generating text.
   */
  async generateText(request: LLMRequest): Promise<LLMResponse> {
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      distinctId = 'client-user',
      traceId = `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      properties = {},
      groups = {},
      temperature = 0.7,
      maxTokens = 1000,
    } = request;

    return withRetry(
      async () => {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            model,
            distinctId,
            traceId,
            properties: {
              source: 'client',
              timestamp: new Date().toISOString(),
              ...properties,
            },
            groups,
            temperature,
            maxTokens,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const error = new Error(errorData.error || `HTTP ${response.status}`);
          (error as any).status = response.status;
          throw error;
        }

        const data = await response.json();
        return data.data;
      },
      {
        ...RetryPresets.openrouter,
        onRetry: (error, attempt, delay) => {
          console.warn(
            `LLM request failed (attempt ${attempt}), retrying in ${delay}ms:`,
            error.message
          );
        },
        onMaxRetriesExceeded: (error, attempts) => {
          console.error(
            `LLM request failed after ${attempts} attempts:`,
            error.message
          );
        },
      }
    ).then(result => result.data);
  }

  /**
   * Generate text for a specific user
   */
  async generateForUser(
    userId: string,
    prompt: string,
    options: Omit<LLMRequest, 'prompt' | 'distinctId'> = {}
  ): Promise<LLMResponse> {
    return this.generateText({
      ...options,
      prompt,
      distinctId: userId,
      properties: {
        user_id: userId,
        ...options.properties,
      },
    });
  }

  /**
   * Generate text for a specific team
   */
  async generateForTeam(
    teamId: string,
    prompt: string,
    options: Omit<LLMRequest, 'prompt'> = {}
  ): Promise<LLMResponse> {
    return this.generateText({
      ...options,
      prompt,
      groups: {
        team: teamId,
        ...options.groups,
      },
    });
  }
}

// Default client instance
export const clientLLMService = new ClientLLMService();

// Convenience functions
export async function generateTextClient(
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return clientLLMService.generateText({ prompt, ...options });
}

export async function generateForUserClient(
  userId: string,
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return clientLLMService.generateForUser(userId, prompt, options);
}

export async function generateForTeamClient(
  teamId: string,
  prompt: string,
  options: Partial<LLMRequest> = {}
) {
  return clientLLMService.generateForTeam(teamId, prompt, options);
}
