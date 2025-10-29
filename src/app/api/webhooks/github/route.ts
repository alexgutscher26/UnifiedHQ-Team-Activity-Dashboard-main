import { NextRequest, NextResponse } from 'next/server';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';
import crypto from 'crypto';

/**
 * GitHub webhook handler for cache invalidation
 * Handles GitHub events and invalidates relevant cache entries
 */

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
  sender?: {
    login: string;
    id: number;
  };
  pull_request?: {
    id: number;
    number: number;
    state: string;
  };
  issue?: {
    id: number;
    number: number;
    state: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
  }>;
}

/**
 * Verify GitHub webhook signature
 */
function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const actualSignature = signature.replace('sha256=', '');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(actualSignature, 'hex')
  );
}

/**
 * Get user ID from GitHub username (placeholder implementation)
 * In a real implementation, this would query the database to find the user
 */
async function getUserIdFromGitHubUsername(
  githubUsername: string
): Promise<string | null> {
  // TODO: Implement actual user lookup from database
  // For now, return a placeholder user ID
  console.log(`Looking up user ID for GitHub username: ${githubUsername}`);
  return `user_${githubUsername}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload: GitHubWebhookPayload = JSON.parse(body);

    // Get headers
    const githubEvent = request.headers.get('x-github-event');
    const githubSignature = request.headers.get('x-hub-signature-256');
    const githubDelivery = request.headers.get('x-github-delivery');

    console.log(
      `Received GitHub webhook: ${githubEvent} (delivery: ${githubDelivery})`
    );

    // Verify webhook signature if secret is configured
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (webhookSecret && githubSignature) {
      const isValid = verifyGitHubSignature(
        body,
        githubSignature,
        webhookSecret
      );
      if (!isValid) {
        console.error('Invalid GitHub webhook signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Extract repository and user information
    const repository = payload.repository;
    const sender = payload.sender;

    if (!repository || !sender) {
      console.warn('GitHub webhook missing repository or sender information');
      return NextResponse.json(
        { error: 'Missing required data' },
        { status: 400 }
      );
    }

    // Get user ID from GitHub username
    const userId = await getUserIdFromGitHubUsername(sender.login);
    if (!userId) {
      console.warn(`No user found for GitHub username: ${sender.login}`);
      return NextResponse.json(
        { message: 'User not found, skipping cache invalidation' },
        { status: 200 }
      );
    }

    let invalidatedCount = 0;

    // Handle different GitHub events
    switch (githubEvent) {
      case 'push':
        console.log(
          `Processing push event for repository: ${repository.full_name}`
        );

        // Invalidate commit-related cache
        invalidatedCount += await CacheInvalidationService.realtimeInvalidation(
          'commit',
          userId,
          repository.name
        );

        // Smart invalidation for GitHub changes
        invalidatedCount += await CacheInvalidationService.smartInvalidation(
          'github',
          userId,
          { repository: repository.name }
        );
        break;

      case 'pull_request':
        console.log(
          `Processing pull request event: ${payload.action} for PR #${payload.pull_request?.number}`
        );

        // Invalidate PR-related cache
        if (payload.pull_request) {
          invalidatedCount +=
            await CacheInvalidationService.realtimeInvalidation(
              'pr',
              userId,
              repository.name
            );
        }

        // Smart invalidation for GitHub changes
        invalidatedCount += await CacheInvalidationService.smartInvalidation(
          'github',
          userId,
          { repository: repository.name }
        );
        break;

      case 'issues':
        console.log(
          `Processing issues event: ${payload.action} for issue #${payload.issue?.number}`
        );

        // Invalidate issue-related cache
        if (payload.issue) {
          invalidatedCount +=
            await CacheInvalidationService.realtimeInvalidation(
              'issue',
              userId,
              repository.name
            );
        }

        // Smart invalidation for GitHub changes
        invalidatedCount += await CacheInvalidationService.smartInvalidation(
          'github',
          userId,
          { repository: repository.name }
        );
        break;

      case 'repository':
        console.log(
          `Processing repository event: ${payload.action} for repository: ${repository.full_name}`
        );

        // Invalidate all repository-related cache
        invalidatedCount += await CacheInvalidationService.invalidateGitHubData(
          userId,
          repository.name
        );
        break;

      case 'release':
        console.log(
          `Processing release event: ${payload.action} for repository: ${repository.full_name}`
        );

        // Invalidate repository cache for releases
        invalidatedCount += await CacheInvalidationService.invalidateGitHubData(
          userId,
          repository.name
        );
        break;

      default:
        console.log(`Unhandled GitHub event: ${githubEvent}`);
        // For unhandled events, do a general GitHub cache invalidation
        invalidatedCount += await CacheInvalidationService.invalidateGitHubData(
          userId,
          repository.name
        );
    }

    console.log(
      `GitHub webhook processed successfully. Invalidated ${invalidatedCount} cache entries.`
    );

    return NextResponse.json({
      message: 'Webhook processed successfully',
      event: githubEvent,
      repository: repository.full_name,
      invalidated_entries: invalidatedCount,
      delivery_id: githubDelivery,
    });
  } catch (error) {
    console.error('GitHub webhook processing failed:', error);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle GET requests for webhook verification
export async function GET() {
  return NextResponse.json({
    message: 'GitHub webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
