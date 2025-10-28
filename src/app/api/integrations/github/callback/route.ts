import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import {
  fetchGithubActivity,
  saveGithubActivities,
} from '@/lib/integrations/github';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=missing_parameters`
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: state },
    });

    if (!user) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=user_not_found`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GH_CLIENT_ID,
          client_secret: process.env.GH_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`
      );
    }

    // Store the connection
    await prisma.connection.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: 'github',
        },
      },
      update: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        type: 'github',
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000)
          : null,
      },
    });

    // Trigger initial GitHub activity sync
    try {
      console.log(
        `[GitHub Callback] Starting initial sync for user: ${user.id}`
      );
      const activities = await fetchGithubActivity(user.id);
      await saveGithubActivities(user.id, activities);
      console.log(
        `[GitHub Callback] Synced ${activities.length} activities for user: ${user.id}`
      );
    } catch (syncError) {
      console.error('[GitHub Callback] Failed to sync activities:', syncError);
      // Don't fail the callback if sync fails - user can manually sync later
    }

    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?success=github_connected`
    );
  } catch (error) {
    console.error('GitHub callback error:', error);
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=internal_error`
    );
  }
}
