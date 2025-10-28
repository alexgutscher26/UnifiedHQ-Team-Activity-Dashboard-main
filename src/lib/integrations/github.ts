import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@/generated/prisma';

const prisma = new PrismaClient();

export interface GitHubActivity {
  source: 'github';
  title: string;
  description?: string;
  timestamp: Date;
  externalId: string;
  metadata?: any;
}

export interface GitHubEvent {
  id: string;
  type: string | null;
  actor: {
    login: string;
    display_login?: string;
    avatar_url: string;
  };
  repo: {
    name: string;
    id: number;
  };
  payload?: any;
  created_at: string | null;
  public: boolean;
}

/**
 * Fetch GitHub activity for a user using their stored access token
 * Only includes activity from selected repositories
 * Enhanced to fetch commits, PRs, and issues directly from repositories
 */
export async function fetchGithubActivity(
  userId: string
): Promise<GitHubActivity[]> {
  console.log(`[GitHub Sync] Starting sync for user: ${userId}`);

  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      type: 'github',
    },
  });

  if (!connection) {
    console.log(`[GitHub Sync] No GitHub connection found for user: ${userId}`);
    throw new Error('GitHub not connected');
  }

  // Get selected repositories
  const selectedRepos = await prisma.selectedRepository.findMany({
    where: {
      userId,
    },
  });

  if (selectedRepos.length === 0) {
    // If no repositories are selected, return empty array
    return [];
  }

  const octokit = new Octokit({
    auth: connection.accessToken,
    userAgent: 'UnifiedHQ/1.0.0',
  });

  try {
    const allActivities: GitHubActivity[] = [];

    // Fetch activity from each selected repository
    for (const repo of selectedRepos) {
      const [owner, repoName] = repo.repoName.split('/');

      try {
        // Fetch recent commits
        const commits = await octokit.rest.repos.listCommits({
          owner,
          repo: repoName,
          per_page: 10,
        });

        // Fetch recent pull requests
        const pullRequests = await octokit.rest.pulls.list({
          owner,
          repo: repoName,
          state: 'all',
          per_page: 10,
          sort: 'updated',
        });

        // Fetch recent issues
        const issues = await octokit.rest.issues.listForRepo({
          owner,
          repo: repoName,
          state: 'all',
          per_page: 10,
          sort: 'updated',
        });

        // Convert commits to activities
        commits.data.forEach(commit => {
          allActivities.push({
            source: 'github',
            title: `Committed to ${repo.repoName}`,
            description: commit.commit.message.split('\n')[0], // First line of commit message
            timestamp: new Date(
              commit.commit.author?.date ||
                commit.commit.committer?.date ||
                new Date()
            ),
            externalId: commit.sha,
            metadata: {
              eventType: 'commit',
              repo: { id: repo.repoId, name: repo.repoName },
              actor: commit.author || commit.committer,
              payload: {
                commit: {
                  sha: commit.sha,
                  message: commit.commit.message,
                  url: commit.html_url,
                },
              },
            },
          });
        });

        // Convert pull requests to activities
        pullRequests.data.forEach(pr => {
          allActivities.push({
            source: 'github',
            title: `${pr.state === 'open' ? 'Opened' : pr.state === 'closed' ? 'Closed' : 'Updated'} PR #${pr.number} in ${repo.repoName}`,
            description: pr.title,
            timestamp: new Date(pr.updated_at),
            externalId: `pr-${pr.id}`,
            metadata: {
              eventType: 'pull_request',
              repo: { id: repo.repoId, name: repo.repoName },
              actor: pr.user,
              payload: {
                pull_request: {
                  number: pr.number,
                  title: pr.title,
                  state: pr.state,
                  url: pr.html_url,
                },
              },
            },
          });
        });

        // Convert issues to activities (filter out pull requests)
        issues.data
          .filter(issue => !issue.pull_request) // Exclude PRs since they're handled separately
          .forEach(issue => {
            allActivities.push({
              source: 'github',
              title: `${issue.state === 'open' ? 'Opened' : issue.state === 'closed' ? 'Closed' : 'Updated'} issue #${issue.number} in ${repo.repoName}`,
              description: issue.title,
              timestamp: new Date(issue.updated_at),
              externalId: `issue-${issue.id}`,
              metadata: {
                eventType: 'issue',
                repo: { id: repo.repoId, name: repo.repoName },
                actor: issue.user,
                payload: {
                  issue: {
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    url: issue.html_url,
                  },
                },
              },
            });
          });
      } catch (repoError: any) {
        console.warn(
          `Failed to fetch activity for ${repo.repoName}:`,
          repoError.message
        );
        // Continue with other repositories even if one fails
      }
    }

    console.log(
      `[GitHub Sync] Total activities fetched: ${allActivities.length}`
    );

    // Sort by timestamp (most recent first) and limit to 50 activities
    const sortedActivities = allActivities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    console.log(
      `[GitHub Sync] Returning ${sortedActivities.length} activities`
    );
    return sortedActivities;
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error(
        'GitHub token expired or invalid. Please reconnect your GitHub account.'
      );
    }
    throw new Error(`Failed to fetch GitHub activity: ${error.message}`);
  }
}

/**
 * Map GitHub event to our unified activity format
 */
function mapGitHubEventToActivity(event: GitHubEvent): GitHubActivity {
  const actor = event.actor.display_login || event.actor.login;
  const repoName = event.repo.name;

  let title = '';
  let description = '';

  switch (event.type || 'UnknownEvent') {
    case 'PushEvent':
      const commits = event.payload?.commits || [];
      const commitCount = commits.length;
      title = `Pushed ${commitCount} commit${commitCount === 1 ? '' : 's'} to ${repoName}`;
      description = commits.length > 0 ? commits[0].message : undefined;
      break;

    case 'PullRequestEvent':
      const pr = event.payload?.pull_request;
      const action = event.payload?.action;
      title = `${action === 'opened' ? 'Opened' : action === 'closed' ? 'Closed' : action} PR #${pr?.number} in ${repoName}`;
      description = pr?.title;
      break;

    case 'IssuesEvent':
      const issue = event.payload?.issue;
      const issueAction = event.payload?.action;
      title = `${issueAction === 'opened' ? 'Opened' : issueAction === 'closed' ? 'Closed' : issueAction} issue #${issue?.number} in ${repoName}`;
      description = issue?.title;
      break;

    case 'IssueCommentEvent':
      const comment = event.payload?.comment;
      const issueForComment = event.payload?.issue;
      title = `Commented on issue #${issueForComment?.number} in ${repoName}`;
      description =
        comment?.body?.substring(0, 100) +
        (comment?.body?.length > 100 ? '...' : '');
      break;

    case 'PullRequestReviewEvent':
      const review = event.payload?.review;
      const prForReview = event.payload?.pull_request;
      title = `Reviewed PR #${prForReview?.number} in ${repoName}`;
      description =
        review?.body?.substring(0, 100) +
        (review?.body?.length > 100 ? '...' : '');
      break;

    case 'CreateEvent':
      const ref = event.payload?.ref;
      const refType = event.payload?.ref_type;
      title = `Created ${refType} ${ref ? `'${ref}'` : ''} in ${repoName}`;
      break;

    case 'DeleteEvent':
      const deletedRef = event.payload?.ref;
      const deletedRefType = event.payload?.ref_type;
      title = `Deleted ${deletedRefType} ${deletedRef ? `'${deletedRef}'` : ''} in ${repoName}`;
      break;

    case 'ForkEvent':
      const forkedRepo = event.payload?.forkee;
      title = `Forked ${repoName}`;
      description = forkedRepo?.full_name;
      break;

    case 'WatchEvent':
      title = `Starred ${repoName}`;
      break;

    case 'ReleaseEvent':
      const release = event.payload?.release;
      title = `Released ${release?.tag_name} in ${repoName}`;
      description = release?.name;
      break;

    default:
      title = `${event.type} in ${repoName}`;
      break;
  }

  return {
    source: 'github',
    title,
    description,
    timestamp: new Date(event.created_at || new Date()),
    externalId: event.id,
    metadata: {
      eventType: event.type,
      actor: event.actor,
      repo: event.repo,
      payload: event.payload,
    },
  };
}

/**
 * Save GitHub activities to the database, avoiding duplicates
 */
export async function saveGithubActivities(
  userId: string,
  activities: GitHubActivity[]
): Promise<void> {
  for (const activity of activities) {
    await prisma.activity.upsert({
      where: {
        userId_source_externalId: {
          userId,
          source: activity.source,
          externalId: activity.externalId,
        },
      },
      update: {
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      },
      create: {
        userId,
        source: activity.source,
        title: activity.title,
        description: activity.description,
        timestamp: activity.timestamp,
        externalId: activity.externalId,
        metadata: activity.metadata,
      },
    });
  }
}

/**
 * Get stored GitHub activities for a user
 * Only returns activities from selected repositories
 */
export async function getGithubActivities(
  userId: string,
  limit: number = 10
): Promise<GitHubActivity[]> {
  // Get selected repositories
  const selectedRepos = await prisma.selectedRepository.findMany({
    where: {
      userId,
    },
  });

  if (selectedRepos.length === 0) {
    // If no repositories are selected, return empty array
    return [];
  }

  const selectedRepoIds = new Set(selectedRepos.map(repo => repo.repoId));

  const activities = await prisma.activity.findMany({
    where: {
      userId,
      source: 'github',
    },
    orderBy: {
      timestamp: 'desc',
    },
    take: limit * 2, // Get more activities to filter
  });

  // Filter activities to only include those from selected repositories
  const filteredActivities = activities.filter(activity => {
    const metadata = activity.metadata as any;
    const repoId = metadata?.repo?.id;
    return repoId && selectedRepoIds.has(repoId);
  });

  return filteredActivities.slice(0, limit).map(activity => ({
    source: activity.source as 'github',
    title: activity.title,
    description: activity.description || undefined,
    timestamp: activity.timestamp,
    externalId: activity.externalId || '',
    metadata: activity.metadata,
  }));
}

/**
 * Check if user has GitHub connected
 */
export async function isGithubConnected(userId: string): Promise<boolean> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      type: 'github',
    },
  });
  return !!connection;
}

/**
 * Get count of selected repositories for a user
 */
export async function getSelectedRepositoryCount(
  userId: string
): Promise<number> {
  const count = await prisma.selectedRepository.count({
    where: {
      userId,
    },
  });
  return count;
}

/**
 * Disconnect GitHub integration
 */
export async function disconnectGithub(userId: string): Promise<void> {
  await prisma.connection.deleteMany({
    where: {
      userId,
      type: 'github',
    },
  });

  // Clean up selected repositories
  await prisma.selectedRepository.deleteMany({
    where: {
      userId,
    },
  });

  // Optionally clean up old activities
  await prisma.activity.deleteMany({
    where: {
      userId,
      source: 'github',
    },
  });
}
