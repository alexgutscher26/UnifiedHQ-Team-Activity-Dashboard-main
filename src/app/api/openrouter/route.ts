import { NextRequest, NextResponse } from 'next/server';
import { generateWithOpenRouter } from '@/lib/openrouter-client';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 1000,
      useCache = true,
      forceRegenerate = false,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Generate cache key for OpenRouter responses
    const cacheKey = CacheKeyGenerator.generate(
      'openrouter',
      'response',
      Buffer.from(JSON.stringify({ prompt, model, temperature, maxTokens }))
        .toString('base64')
        .slice(0, 32)
    );

    // Try to get cached response if caching is enabled and not forcing regeneration
    if (useCache && !forceRegenerate) {
      const cachedResponse = await RedisCache.get(cacheKey);
      if (cachedResponse) {
        console.log('📋 Using cached OpenRouter response');
        return NextResponse.json({
          success: true,
          data: cachedResponse,
          cached: true,
        });
      }
    }

    console.log('🤖 Generating new OpenRouter response');

    // Generate response using OpenRouter
    const response = await generateWithOpenRouter({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      maxTokens,
    });

    // Handle both streaming and non-streaming responses
    if (!('choices' in response)) {
      return NextResponse.json(
        { error: 'Streaming responses not supported in this endpoint' },
        { status: 400 }
      );
    }

    const responseData = {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: response.usage,
      finishReason: response.choices[0]?.finish_reason,
    };

    // Cache the response if caching is enabled
    if (useCache) {
      await RedisCache.set(
        cacheKey,
        responseData,
        TTLManager.getTTL('AI_SUMMARY')
      );
      console.log('💾 Cached OpenRouter response');
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      cached: false,
    });
  } catch (error) {
    console.error('OpenRouter API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate response',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'OpenRouter API endpoint with Redis caching',
    usage:
      'POST with { prompt, model?, temperature?, maxTokens?, useCache?, forceRegenerate? }',
    example: {
      prompt: 'Tell me a fun fact about hedgehogs',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      useCache: true,
      forceRegenerate: false,
    },
    caching: {
      useCache: 'Enable/disable Redis caching (default: true)',
      forceRegenerate: 'Force new generation, bypassing cache (default: false)',
      ttl: `${TTLManager.getTTL('AI_SUMMARY')} seconds (${TTLManager.getTTL('AI_SUMMARY') / 60} minutes)`,
    },
  });
}
