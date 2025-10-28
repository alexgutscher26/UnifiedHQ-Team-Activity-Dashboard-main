import { NextRequest, NextResponse } from 'next/server';
import { generateWithOpenRouter } from '@/lib/openrouter-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      temperature = 0.7,
      maxTokens = 1000,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({
      success: true,
      data: {
        content: response.choices[0]?.message?.content || '',
        model: response.model,
        usage: response.usage,
        finishReason: response.choices[0]?.finish_reason,
      },
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
    message: 'OpenRouter API endpoint',
    usage: 'POST with { prompt, model?, temperature?, maxTokens? }',
    example: {
      prompt: 'Tell me a fun fact about hedgehogs',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
    },
  });
}
