import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import {
  fetchGithubActivity,
  saveGithubActivities,
} from '@/lib/integrations/github';

const prisma = new PrismaClient();

/**
 * Handles the GET request for GitHub OAuth callback.
 *
 * This function processes the incoming request, checks for errors, and verifies the user based on the state parameter.
 * It exchanges the provided code for an access token from GitHub, stores the connection in the database,
 * and triggers an initial sync of GitHub activities for the user. Additionally, it warms the cache for the GitHub integration.
 *
 * @param request - The incoming NextRequest object containing the request details.
 * @returns A NextResponse redirecting to the appropriate URL based on the outcome of the operation.
 * @throws Error If an unexpected error occurs during the processing of the request.
 */
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
    console.log('[GitHub Callback] Exchanging code for token...', {
      client_id: process.env.GITHUB_CLIENT_ID,
      code: code?.substring(0, 10) + '...',
      state,
    });

    const tokenResponse = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenResponse.json();
    console.log('[GitHub Callback] Token response:', tokenData);

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

    // Trigger cache warming for GitHub integration
    try {
      const { warmCacheOnIntegrationConnect } = await import(
        '@/lib/cache-warming'
      );
      // Run in background - don't block the redirect
      warmCacheOnIntegrationConnect(
        user.id,
        'github',
        tokenData.access_token
      ).catch(error => {
        console.error('Background cache warming failed:', error);
      });
    } catch (error) {
      console.error('Failed to import cache warming:', error);
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
