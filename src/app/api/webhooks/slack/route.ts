import { NextRequest, NextResponse } from 'next/server';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';
import crypto from 'crypto';

/**
 * Slack webhook handler for cache invalidation
 * Handles Slack events and invalidates relevant cache entries
 */

interface SlackWebhookPayload {
  token?: string;
  team_id?: string;
  api_app_id?: string;
  event?: {
    type: string;
    channel?: string;
    user?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
    channel_type?: string;
  };
  type?: string;
  challenge?: string;
  event_id?: string;
  event_time?: number;
}

/**
 * Verify Slack webhook signature
 */
function verifySlackSignature(
  payload: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  if (!signature || !signingSecret || !timestamp) {
    return false;
  }

  // Check timestamp to prevent replay attacks (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);

  if (Math.abs(currentTime - requestTime) > 300) {
    console.warn('Slack webhook timestamp too old');
    return false;
  }

  const baseString = `v0:${timestamp}:${payload}`;
  const expectedSignature =
    'v0=' +
    crypto
      .createHmac('sha256', signingSecret)
      .update(baseString, 'utf8')
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
}

/**
 * Get user ID from Slack user ID (placeholder implementation)
 * In a real implementation, this would query the database to find the user
 */
async function getUserIdFromSlackUserId(
  slackUserId: string
): Promise<string | null> {
  // TODO: Implement actual user lookup from database
  // For now, return a placeholder user ID
  console.log(`Looking up user ID for Slack user: ${slackUserId}`);
  return `user_${slackUserId}`;
}

/**
 * Get all affected users in a channel (placeholder implementation)
 * In a real implementation, this would query the database for channel members
 */
async function getChannelMembers(channelId: string): Promise<string[]> {
  // TODO: Implement actual channel member lookup
  console.log(`Getting members for Slack channel: ${channelId}`);
  return [`user_member1`, `user_member2`]; // Placeholder
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload: SlackWebhookPayload = JSON.parse(body);

    // Get headers for signature verification
    const slackSignature = request.headers.get('x-slack-signature');
    const slackTimestamp = request.headers.get('x-slack-request-timestamp');

    console.log(`Received Slack webhook: ${payload.type}`);

    // Handle URL verification challenge
    if (payload.type === 'url_verification' && payload.challenge) {
      console.log('Responding to Slack URL verification challenge');
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Verify webhook signature if signing secret is configured
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    if (signingSecret && slackSignature && slackTimestamp) {
      const isValid = verifySlackSignature(
        body,
        slackTimestamp,
        slackSignature,
        signingSecret
      );
      if (!isValid) {
        console.error('Invalid Slack webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Handle event callbacks
    if (payload.type === 'event_callback' && payload.event) {
      const event = payload.event;

      let invalidatedCount = 0;

      // Handle different Slack events
      switch (event.type) {
        case 'message':
          console.log(`Processing message event in channel: ${event.channel}`);

          if (event.user && event.channel) {
            // Get user ID from Slack user ID
            const userId = await getUserIdFromSlackUserId(event.user);

            if (userId) {
              // Invalidate message cache for the channel
              invalidatedCount +=
                await CacheInvalidationService.realtimeInvalidation(
                  'message',
                  userId,
                  event.channel
                );

              // Get all channel members and invalidate their cache
              const channelMembers = await getChannelMembers(event.channel);

              // Smart invalidation for Slack changes
              invalidatedCount +=
                await CacheInvalidationService.smartInvalidation(
                  'slack',
                  userId,
                  {
                    channel: event.channel,
                    affectedUsers: channelMembers,
                  }
                );
            }
          }
          break;

        case 'channel_created':
        case 'channel_deleted':
        case 'channel_rename':
          console.log(
            `Processing channel event: ${event.type} for channel: ${event.channel}`
          );

          if (event.channel) {
            // Get all affected users and invalidate their Slack cache
            const channelMembers = await getChannelMembers(event.channel);

            const batchInvalidations = channelMembers.map(userId => ({
              type: 'slack' as const,
              userId,
              context: { channel: event.channel },
            }));

            invalidatedCount +=
              await CacheInvalidationService.batchInvalidation(
                batchInvalidations
              );
          }
          break;

        case 'member_joined_channel':
        case 'member_left_channel':
          console.log(
            `Processing member event: ${event.type} for channel: ${event.channel}`
          );

          if (event.user && event.channel) {
            const userId = await getUserIdFromSlackUserId(event.user);

            if (userId) {
              // Invalidate channel-specific cache for the user
              invalidatedCount +=
                await CacheInvalidationService.realtimeInvalidation(
                  'channel',
                  userId,
                  event.channel
                );

              // Also invalidate channels list cache
              invalidatedCount +=
                await CacheInvalidationService.invalidateSlackData(userId);
            }
          }
          break;

        case 'user_change':
          console.log(`Processing user change event for user: ${event.user}`);

          if (event.user) {
            const userId = await getUserIdFromSlackUserId(event.user);

            if (userId) {
              // Invalidate all Slack data for the user
              invalidatedCount +=
                await CacheInvalidationService.invalidateSlackData(userId);
            }
          }
          break;

        default:
          console.log(`Unhandled Slack event: ${event.type}`);

          // For unhandled events, do a general invalidation if we have user context
          if (event.user) {
            const userId = await getUserIdFromSlackUserId(event.user);
            if (userId) {
              invalidatedCount +=
                await CacheInvalidationService.invalidateSlackData(userId);
            }
          }
      }

      console.log(
        `Slack webhook processed successfully. Invalidated ${invalidatedCount} cache entries.`
      );

      return NextResponse.json({
        message: 'Event processed successfully',
        event_type: event.type,
        invalidated_entries: invalidatedCount,
        event_id: payload.event_id,
      });
    }

    // Handle other webhook types
    console.log(`Unhandled Slack webhook type: ${payload.type}`);
    return NextResponse.json({ message: 'Webhook received but not processed' });
  } catch (error) {
    console.error('Slack webhook processing failed:', error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    message: 'Slack webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
