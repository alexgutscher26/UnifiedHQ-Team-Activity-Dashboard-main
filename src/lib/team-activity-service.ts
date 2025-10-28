import { fetchGithubActivity } from '@/lib/integrations/github-cached';
import { withRetry, RetryPresets } from '@/lib/retry-utils';

export interface TeamActivityData {
  activities: Array<{
    id: string;
    type: 'commit' | 'pull_request' | 'issue' | 'review' | 'comment';
    title: string;
    description?: string;
    author: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      status: 'active' | 'away' | 'offline';
      lastActive: string;
    };
    repository: string;
    timestamp: string;
    status?: 'open' | 'closed' | 'merged' | 'draft';
    url?: string;
    metadata?: Record<string, unknown>;
  }>;
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    status: 'active' | 'away' | 'offline';
    lastActive: string;
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
  }>;
  stats: {
    totalMembers: number;
    activeMembers: number;
    totalCommits: number;
    totalPullRequests: number;
    totalIssues: number;
    totalReviews: number;
    averageActivityPerDay: number;
    topContributors: Array<{
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      status: 'active' | 'away' | 'offline';
      lastActive: string;
      commits: number;
      pullRequests: number;
      issues: number;
      reviews: number;
    }>;
    activityTrends: Array<{
      date: string;
      commits: number;
      pullRequests: number;
      issues: number;
      reviews: number;
    }>;
    repositoryStats: Array<{
      name: string;
      commits: number;
      pullRequests: number;
      issues: number;
      contributors: number;
    }>;
  };
}

/**
 * Fetches comprehensive team activity data with caching
 * @param userId - The user ID to fetch activity for
 * @param timeRange - Time range for the data ('7d', '30d', '90d')
 * @returns Promise<TeamActivityData>
 */
export async function fetchTeamActivityData(
  userId: string,
  timeRange: '7d' | '30d' = '30d'
): Promise<TeamActivityData> {
  try {
    // Calculate date range
    const now = new Date();
    const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Fetch GitHub activity with retry mechanism
    const githubActivities = await withRetry(
      async () => {
        return await fetchGithubActivity(userId);
      },
      {
        ...RetryPresets.github,
        onRetry: (error, attempt, delay) => {
          console.warn(
            `Team activity fetch retry attempt ${attempt}:`,
            error.message
          );
        },
      }
    );

    // Process activities
    const activities: TeamActivityData['activities'] = [];
    const memberMap = new Map<string, TeamActivityData['members'][0]>();
    const repoMap = new Map<string, any>();
    const dailyActivity = new Map<string, any>();

    if (githubActivities && Array.isArray(githubActivities)) {
      for (const activity of githubActivities) {
        const activityDate = new Date(
          activity.created_at || activity.pushed_at || activity.updated_at
        );
        if (activityDate < startDate) continue;

        const actorId = activity.actor.id.toString();
        const actorLogin = activity.actor.login;
        const repoName = activity.repo.name;
        const dateKey = activityDate.toISOString().split('T')[0];

        // Initialize member if not exists
        if (!memberMap.has(actorId)) {
          memberMap.set(actorId, {
            id: actorId,
            name: actorLogin,
            email:
              activity.actor.email || `${actorLogin}@users.noreply.github.com`,
            avatar: activity.actor.avatar_url,
            role: 'Developer',
            status: 'active',
            lastActive: activity.created_at,
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0,
          });
        }

        // Initialize repository if not exists
        if (!repoMap.has(repoName)) {
          repoMap.set(repoName, {
            name: repoName,
            commits: 0,
            pullRequests: 0,
            issues: 0,
            contributors: new Set(),
          });
        }

        // Initialize daily activity if not exists
        if (!dailyActivity.has(dateKey)) {
          dailyActivity.set(dateKey, {
            date: dateKey,
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0,
          });
        }

        const member = memberMap.get(actorId)!;
        const repo = repoMap.get(repoName);
        const daily = dailyActivity.get(dateKey);

        // Process different activity types
        if (activity.type === 'PushEvent' && activity.payload?.commits) {
          // Handle commits
          for (const commit of activity.payload.commits) {
            activities.push({
              id: `commit-${commit.sha}`,
              type: 'commit',
              title: commit.message.split('\n')[0],
              description:
                commit.message.split('\n').slice(1).join('\n').trim() ||
                undefined,
              author: {
                id: actorId,
                name: actorLogin,
                email:
                  activity.actor.email ||
                  `${actorLogin}@users.noreply.github.com`,
                avatar: activity.actor.avatar_url,
                role: 'Developer',
                status: 'active',
                lastActive: activity.created_at,
              },
              repository: repoName,
              timestamp: activity.created_at,
              url: `https://github.com/${repoName}/commit/${commit.sha}`,
              metadata: {
                sha: commit.sha,
                additions: commit.additions || 0,
                deletions: commit.deletions || 0,
                files: commit.files || [],
              },
            });

            const commitCount = activity.payload.commits.length;
            member.commits += commitCount;
            repo.commits += commitCount;
            daily.commits += commitCount;
          }
        } else if (activity.type === 'PullRequestEvent') {
          // Handle pull requests
          const pr = activity.payload.pull_request;
          activities.push({
            id: `pr-${pr.number}`,
            type: 'pull_request',
            title: pr.title,
            description: pr.body,
            author: {
              id: actorId,
              name: actorLogin,
              email:
                activity.actor.email ||
                `${actorLogin}@users.noreply.github.com`,
              avatar: activity.actor.avatar_url,
              role: 'Developer',
              status: 'active',
              lastActive: activity.created_at,
            },
            repository: repoName,
            timestamp: activity.created_at,
            status:
              pr.state === 'open' ? 'open' : pr.merged_at ? 'merged' : 'closed',
            url: pr.html_url,
            metadata: {
              number: pr.number,
              additions: pr.additions,
              deletions: pr.deletions,
              changed_files: pr.changed_files,
              commits: pr.commits,
            },
          });

          member.pullRequests += 1;
          repo.pullRequests += 1;
          daily.pullRequests += 1;
        } else if (activity.type === 'IssuesEvent') {
          // Handle issues
          const issue = activity.payload.issue;
          activities.push({
            id: `issue-${issue.number}`,
            type: 'issue',
            title: issue.title,
            description: issue.body,
            author: {
              id: actorId,
              name: actorLogin,
              email:
                activity.actor.email ||
                `${actorLogin}@users.noreply.github.com`,
              avatar: activity.actor.avatar_url,
              role: 'Developer',
              status: 'active',
              lastActive: activity.created_at,
            },
            repository: repoName,
            timestamp: activity.created_at,
            status: issue.state === 'open' ? 'open' : 'closed',
            url: issue.html_url,
            metadata: {
              number: issue.number,
              labels: issue.labels?.map((label: any) => label.name) || [],
              assignees:
                issue.assignees?.map((assignee: any) => assignee.login) || [],
            },
          });

          member.issues += 1;
          repo.issues += 1;
          daily.issues += 1;
        } else if (activity.type === 'IssueCommentEvent') {
          // Handle issue comments
          const comment = activity.payload.comment;
          activities.push({
            id: `comment-${comment.id}`,
            type: 'comment',
            title: `Commented on issue #${activity.payload.issue.number}`,
            description: comment.body,
            author: {
              id: actorId,
              name: actorLogin,
              email:
                activity.actor.email ||
                `${actorLogin}@users.noreply.github.com`,
              avatar: activity.actor.avatar_url,
              role: 'Developer',
              status: 'active',
              lastActive: activity.created_at,
            },
            repository: repoName,
            timestamp: activity.created_at,
            url: comment.html_url,
            metadata: {
              issue_number: activity.payload.issue.number,
              comment_id: comment.id,
            },
          });

          member.reviews += 1;
          daily.reviews += 1;
        }

        // Update repository contributors
        repo.contributors.add(actorId);

        // Update last active time
        if (new Date(activity.created_at) > new Date(member.lastActive)) {
          member.lastActive = activity.created_at;
        }
      }
    }

    // Sort activities by timestamp (newest first)
    activities.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Convert member map to array and determine status
    const members = Array.from(memberMap.values()).map(member => {
      const lastActiveTime = new Date(member.lastActive).getTime();
      const hoursSinceActive =
        (now.getTime() - lastActiveTime) / (1000 * 60 * 60);

      let status: 'active' | 'away' | 'offline' = 'offline';
      if (hoursSinceActive < 2) {
        status = 'active';
      } else if (hoursSinceActive < 24) {
        status = 'away';
      }

      return {
        ...member,
        status,
      };
    });

    // Sort members by activity
    members.sort((a, b) => {
      const totalA = a.commits + a.pullRequests + a.issues + a.reviews;
      const totalB = b.commits + b.pullRequests + b.issues + b.reviews;
      return totalB - totalA;
    });

    // Calculate stats
    const totalCommits = members.reduce(
      (sum, member) => sum + member.commits,
      0
    );
    const totalPullRequests = members.reduce(
      (sum, member) => sum + member.pullRequests,
      0
    );
    const totalIssues = members.reduce((sum, member) => sum + member.issues, 0);
    const totalReviews = members.reduce(
      (sum, member) => sum + member.reviews,
      0
    );
    const totalActivity =
      totalCommits + totalPullRequests + totalIssues + totalReviews;

    const stats: TeamActivityData['stats'] = {
      totalMembers: members.length,
      activeMembers: members.filter(member => member.status === 'active')
        .length,
      totalCommits,
      totalPullRequests,
      totalIssues,
      totalReviews,
      averageActivityPerDay: Math.round(totalActivity / daysBack),
      topContributors: members.slice(0, 10),
      activityTrends: Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        return (
          dailyActivity.get(dateKey) || {
            date: dateKey,
            commits: 0,
            pullRequests: 0,
            issues: 0,
            reviews: 0,
          }
        );
      }).reverse(),
      repositoryStats: Array.from(repoMap.values())
        .map(repo => ({
          ...repo,
          contributors: repo.contributors.size,
        }))
        .sort((a, b) => {
          const totalA = a.commits + a.pullRequests + a.issues;
          const totalB = b.commits + b.pullRequests + b.issues;
          return totalB - totalA;
        })
        .slice(0, 10),
    };

    return {
      activities,
      members,
      stats,
    };
  } catch (error) {
    console.error('Team activity data fetch error:', error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to fetch team activity data';
    throw new Error(errorMessage);
  }
}

/**
 * Cached version of fetchTeamActivityData with TTL
 * @param userId - The user ID to fetch activity for
 * @param timeRange - Time range for the data ('7d', '30d', '90d')
 * @param ttl - Time to live in milliseconds (default: 5 minutes)
 * @returns Promise<TeamActivityData>
 */
export async function fetchTeamActivityDataCached(
  userId: string,
  timeRange: '7d' | '30d' = '30d',
  ttl: number = 5 * 60 * 1000 // 5 minutes
): Promise<TeamActivityData> {
  // TODO: For now, we'll use the GitHub cache system which already handles caching
  // In the future, we could implement a dedicated team activity cache
  return await fetchTeamActivityData(userId, timeRange);
}
