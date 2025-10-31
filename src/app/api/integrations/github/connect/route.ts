import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

/**
 * Handles the GET request for GitHub OAuth authentication.
 *
 * This function retrieves the user session using the provided request headers.
 * If the user is not authenticated, it returns a 401 Unauthorized response.
 * If authenticated, it constructs a GitHub OAuth URL with the necessary parameters
 * and redirects the user to GitHub for authorization. In case of an error,
 * it logs the error and returns a 500 Internal Server Error response.
 *
 * @param request - The NextRequest object containing the request details.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate GitHub OAuth URL
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/api/integrations/github/callback`;
    const scope = 'read:user repo read:org';
    const state = session.user.id; // Use user ID as state for security

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

    return NextResponse.redirect(githubAuthUrl);
  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
