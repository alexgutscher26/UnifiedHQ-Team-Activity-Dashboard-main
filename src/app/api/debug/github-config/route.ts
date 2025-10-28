import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  const config = {
    githubClientId: process.env.GITHUB_CLIENT_ID ? 'Set' : 'Not set',
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ? 'Set' : 'Not set',
    betterAuthUrl: process.env.BETTER_AUTH_URL || 'Not set',
    betterAuthSecret: process.env.BETTER_AUTH_SECRET ? 'Set' : 'Not set',
    nodeEnv: process.env.NODE_ENV,
  };

  return NextResponse.json({
    success: true,
    config,
    message: 'GitHub configuration status',
  });
}
