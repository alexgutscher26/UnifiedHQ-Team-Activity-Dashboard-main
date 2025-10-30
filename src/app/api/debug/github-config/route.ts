import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles GET requests to retrieve GitHub configuration status.
 *
 * This function checks if the application is running in a development environment.
 * If not, it returns a 403 error response. If in development, it constructs a configuration
 * object containing the status of various environment variables related to GitHub and
 * returns it in a JSON response along with a success message.
 *
 * @param request - The incoming NextRequest object.
 */
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
