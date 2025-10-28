import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate GitHub OAuth URL
    const githubClientId = process.env.GH_CLIENT_ID;
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
