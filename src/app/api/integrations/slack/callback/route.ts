import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import {
  fetchSlackActivity,
  saveSlackActivities,
} from '@/lib/integrations/slack-cached';

const prisma = new PrismaClient();

/**
 * Handles the GET request for Slack OAuth callback.
 *
 * This function processes the incoming request, verifies the user, exchanges the authorization code for an access token,
 * and stores the connection details in the database. It also auto-selects the first three public channels for the user
 * and triggers an initial sync of Slack activities. If any errors occur during the process, appropriate redirects are made.
 *
 * @param request - The incoming NextRequest object containing the OAuth callback parameters.
 * @returns A NextResponse redirecting to the appropriate URL based on the outcome of the operation.
 * @throws Error If an internal error occurs during processing.
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
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI!,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=${encodeURIComponent(tokenData.error || 'oauth_failed')}`
      );
    }

    // Store the connection
    await prisma.connection.upsert({
      where: {
        userId_type: {
          userId: user.id,
          type: 'slack',
        },
      },
      update: {
        accessToken: tokenData.access_token,
        teamId: tokenData.team?.id,
        teamName: tokenData.team?.name,
        botToken: tokenData.bot_token || process.env.SLACK_BOT_TOKEN,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        type: 'slack',
        accessToken: tokenData.access_token,
        teamId: tokenData.team?.id,
        teamName: tokenData.team?.name,
        botToken: tokenData.bot_token || process.env.SLACK_BOT_TOKEN,
      },
    });

    // Auto-select first 3 channels for initial sync
    try {
      console.log(
        `[Slack Callback] Auto-selecting channels for user: ${user.id}`
      );

      // Import the Slack client to get channels
      const { CachedSlackClient } = await import(
        '@/lib/integrations/slack-cached'
      );
      const client = new CachedSlackClient(tokenData.access_token, user.id);
      const channels = await client.getChannels();

      // Select first 3 public channels
      const channelsToSelect = channels
        .filter(
          channel =>
            channel.is_channel && !channel.is_private && !channel.is_archived
        )
        .slice(0, 3);

      for (const channel of channelsToSelect) {
        await prisma.selectedChannel.upsert({
          where: {
            userId_channelId: {
              userId: user.id,
              channelId: channel.id,
            },
          },
          update: {
            channelName: channel.name,
            channelType: channel.is_channel
              ? 'public_channel'
              : 'private_channel',
            isPrivate: channel.is_private,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.is_channel
              ? 'public_channel'
              : 'private_channel',
            isPrivate: channel.is_private,
          },
        });
      }

      console.log(
        `[Slack Callback] Auto-selected ${channelsToSelect.length} channels for user: ${user.id}`
      );
    } catch (channelError) {
      console.error(
        '[Slack Callback] Failed to auto-select channels:',
        channelError
      );
      // Don't fail the callback if channel selection fails
    }

    // Trigger initial Slack activity sync
    try {
      console.log(
        `[Slack Callback] Starting initial sync for user: ${user.id}`
      );
      const activities = await fetchSlackActivity(user.id);
      await saveSlackActivities(user.id, activities);
      console.log(
        `[Slack Callback] Synced ${activities.length} activities for user: ${user.id}`
      );
    } catch (syncError) {
      console.error('[Slack Callback] Failed to sync activities:', syncError);
      // Don't fail the callback if sync fails - user can manually sync later
    }

    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?success=slack_connected`
    );
  } catch (error) {
    console.error('Slack callback error:', error);
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/integrations?error=internal_error`
    );
  }
}
