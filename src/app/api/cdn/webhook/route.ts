// Webhook handler for automatic cache invalidation
// Responds to external service updates and triggers cache purging

import { NextRequest, NextResponse } from 'next/server';
import { CacheUtils } from '@/lib/cdn/cache-manager';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const signature = headersList.get('x-hub-signature-256');
    const githubEvent = headersList.get('x-github-event');
    const slackEvent = headersList.get('x-slack-signature');

    const body = await request.json();

    // Handle GitHub webhooks
    if (githubEvent && userAgent.includes('GitHub-Hookshot')) {
      return await handleGitHubWebhook(githubEvent, body, signature);
    }

    // Handle Slack webhooks
    if (slackEvent) {
      return await handleSlackWebhook(body, slackEvent);
    }

    // Handle Vercel deployment webhooks
    if (userAgent.includes('vercel') || body.type === 'deployment') {
      return await handleDeploymentWebhook(body);
    }

    return NextResponse.json(
      { error: 'Unknown webhook source' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleGitHubWebhook(
  event: string,
  payload: any,
  signature: string | null
): Promise<NextResponse> {
  // Verify webhook signature (in production)
  if (
    process.env.NODE_ENV === 'production' &&
    !verifyGitHubSignature(payload, signature)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let invalidated = false;
  const repoId = payload.repository?.id?.toString();

  switch (event) {
    case 'push':
      // Invalidate repository cache on push
      await CacheUtils.onGitHubUpdate(repoId);
      invalidated = true;
      break;

    case 'pull_request':
      // Invalidate on PR events
      if (
        ['opened', 'closed', 'merged', 'synchronize'].includes(payload.action)
      ) {
        await CacheUtils.onGitHubUpdate(repoId);
        invalidated = true;
      }
      break;

    case 'issues':
      // Invalidate on issue events
      if (['opened', 'closed', 'edited'].includes(payload.action)) {
        await CacheUtils.onGitHubUpdate(repoId);
        invalidated = true;
      }
      break;

    case 'repository':
      // Invalidate on repository changes
      if (
        ['created', 'deleted', 'archived', 'unarchived'].includes(
          payload.action
        )
      ) {
        await CacheUtils.onGitHubUpdate(repoId);
        invalidated = true;
      }
      break;

    case 'release':
      // Invalidate on release events
      if (
        ['published', 'unpublished', 'created', 'edited', 'deleted'].includes(
          payload.action
        )
      ) {
        await CacheUtils.onGitHubUpdate(repoId);
        invalidated = true;
      }
      break;
  }

  return NextResponse.json({
    success: true,
    event,
    invalidated,
    repository: payload.repository?.full_name,
    timestamp: new Date().toISOString(),
  });
}

async function handleSlackWebhook(
  payload: any,
  signature: string
): Promise<NextResponse> {
  // Verify Slack signature (in production)
  if (
    process.env.NODE_ENV === 'production' &&
    !verifySlackSignature(payload, signature)
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let invalidated = false;
  const channelId = payload.event?.channel;

  switch (payload.event?.type) {
    case 'message':
      // Invalidate channel cache on new messages
      await CacheUtils.onSlackUpdate(channelId);
      invalidated = true;
      break;

    case 'channel_created':
    case 'channel_deleted':
    case 'channel_archive':
    case 'channel_unarchive':
      // Invalidate all Slack cache on channel structure changes
      await CacheUtils.onSlackUpdate();
      invalidated = true;
      break;

    case 'member_joined_channel':
    case 'member_left_channel':
      // Invalidate channel cache on membership changes
      await CacheUtils.onSlackUpdate(channelId);
      invalidated = true;
      break;
  }

  return NextResponse.json({
    success: true,
    event: payload.event?.type,
    invalidated,
    channel: channelId,
    timestamp: new Date().toISOString(),
  });
}

async function handleDeploymentWebhook(payload: any): Promise<NextResponse> {
  let invalidated = false;

  if (payload.type === 'deployment' && payload.deployment?.state === 'READY') {
    // Invalidate static assets on successful deployment
    await CacheUtils.onAssetUpdate(['/static/*', '/_next/static/*']);
    invalidated = true;
  }

  return NextResponse.json({
    success: true,
    deployment: payload.deployment?.id,
    invalidated,
    timestamp: new Date().toISOString(),
  });
}

function verifyGitHubSignature(
  payload: any,
  signature: string | null
): boolean {
  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function verifySlackSignature(payload: any, signature: string): boolean {
  if (!process.env.SLACK_SIGNING_SECRET) {
    return false;
  }

  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const baseString = `v0:${timestamp}:${JSON.stringify(payload)}`;
  const expectedSignature =
    'v0=' +
    crypto
      .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
      .update(baseString)
      .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
