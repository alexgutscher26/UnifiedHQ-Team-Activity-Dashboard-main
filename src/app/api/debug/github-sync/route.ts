import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { Octokit } from '@octokit/rest';

const prisma = new PrismaClient();

/**
 * Handles the GET request to retrieve user-related GitHub data.
 *
 * This function first checks the user's session for authentication. If authenticated, it verifies the GitHub connection and retrieves selected repositories and stored activities. It tests access to the GitHub API and the first selected repository, returning relevant data or error messages as JSON responses. The function also handles various error scenarios and returns appropriate status codes.
 *
 * @param request - The incoming NextRequest object containing request headers.
 * @returns A JSON response containing user information, connection status, selected repositories, stored activities, and results of GitHub API tests.
 * @throws Error If an error occurs during the process, a JSON response with the error message is returned.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check GitHub connection
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'github',
      },
    });

    if (!connection) {
      return NextResponse.json({
        error: 'GitHub not connected',
        userId,
        hasConnection: false,
      });
    }

    // Get selected repositories
    const selectedRepos = await prisma.selectedRepository.findMany({
      where: {
        userId,
      },
    });

    // Get stored activities
    const storedActivities = await prisma.activity.findMany({
      where: {
        userId,
        source: 'github',
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    // Test GitHub API access
    const octokit = new Octokit({
      auth: connection.accessToken,
      userAgent: 'UnifiedHQ/1.0.0',
    });

    let githubTest = null;
    try {
      const user = await octokit.rest.users.getAuthenticated();
      githubTest = {
        success: true,
        username: user.data.login,
        userId: user.data.id,
      };
    } catch (error: any) {
      githubTest = {
        success: false,
        error: error.message,
        status: error.status,
      };
    }

    // Test repository access for first selected repo
    let repoTest = null;
    if (selectedRepos.length > 0) {
      const firstRepo = selectedRepos[0];
      const [owner, repoName] = firstRepo.repoName.split('/');

      try {
        const commits = await octokit.rest.repos.listCommits({
          owner,
          repo: repoName,
          per_page: 1,
        });

        repoTest = {
          success: true,
          repo: firstRepo.repoName,
          commitsCount: commits.data.length,
        };
      } catch (error: any) {
        repoTest = {
          success: false,
          repo: firstRepo.repoName,
          error: error.message,
          status: error.status,
        };
      }
    }

    return NextResponse.json({
      userId,
      hasConnection: Boolean(connection),
      connectionExpiresAt: connection?.expiresAt,
      selectedRepositories: selectedRepos.length,
      selectedRepos: selectedRepos.map(repo => ({
        id: repo.repoId,
        name: repo.repoName,
        owner: repo.repoOwner,
        url: repo.repoUrl,
        isPrivate: repo.isPrivate,
      })),
      storedActivities: storedActivities.length,
      activities: storedActivities.map(activity => ({
        id: activity.id,
        title: activity.title,
        timestamp: activity.timestamp,
        externalId: activity.externalId,
        eventType: (activity.metadata as any)?.eventType,
      })),
      githubTest,
      repoTest,
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
