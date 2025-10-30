import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Octokit } from '@octokit/rest';
import { PrismaClient } from '@/generated/prisma';
import { RedisCache, CacheKeyGenerator, TTLManager } from '@/lib/redis';
import { CacheInvalidationService } from '@/lib/cache-invalidation-service';

const prisma = new PrismaClient();

// Helper function to broadcast repository changes
function broadcastRepositoryChange(
  userId: string,
  action: 'added' | 'removed',
  repoName: string
) {
  const userConnections = (global as any).userConnections;
  if (userConnections?.has(userId)) {
    const controller = userConnections.get(userId);
    try {
      const message = JSON.stringify({
        type: 'repository_update',
        data: {
          action,
          repoName,
          message: `Repository ${repoName} ${action}`,
        },
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(`data: ${message}\n\n`);
    } catch (error) {
      console.error('Failed to broadcast repository change:', error);
      userConnections?.delete(userId);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };

    // Generate cache key for user's repositories
    const cacheKey = CacheKeyGenerator.github(user.id, 'repositories');

    // Try to get from cache first
    const cachedRepos = await RedisCache.get(cacheKey);
    if (cachedRepos) {
      console.log(`[GitHub Cache] Cache hit for repositories: ${user.id}`);
      return NextResponse.json(cachedRepos);
    }

    console.log(`[GitHub Cache] Cache miss for repositories: ${user.id}`);

    // Get GitHub connection
    const connection = await prisma.connection.findFirst({
      where: {
        userId: user.id,
        type: 'github',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    const octokit = new Octokit({
      auth: connection.accessToken,
      userAgent: 'UnifiedHQ/1.0.0',
    });

    // Fetch user repositories
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: 'updated',
      type: 'all', // Include both public and private repos
    });

    // Get currently selected repositories
    const selectedRepos = await prisma.selectedRepository.findMany({
      where: {
        userId: user.id,
      },
    });

    const selectedRepoIds = new Set(selectedRepos.map(repo => repo.repoId));

    // Format repositories with selection status
    const formattedRepos = repos.map(repo => ({
      id: repo.id,
      name: repo.full_name,
      owner: repo.owner.login,
      url: repo.html_url,
      description: repo.description,
      isPrivate: repo.private,
      isSelected: selectedRepoIds.has(repo.id),
      updatedAt: repo.updated_at,
      language: repo.language,
      stars: repo.stargazers_count,
    }));

    const responseData = {
      repositories: formattedRepos,
      total: repos.length,
      cached: false,
      timestamp: new Date().toISOString(),
    };

    // Cache the response for 30 minutes (repositories don't change frequently)
    await RedisCache.set(
      cacheKey,
      responseData,
      TTLManager.getTTL('GITHUB_REPOS')
    );

    // Schedule cache warming for frequently accessed repositories in the background
    const { GitHubCacheWarming } = await import(
      '@/lib/integrations/github-cached'
    );
    GitHubCacheWarming.scheduleRepositoryWarming(user.id, 'background-warming');

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error fetching repositories:', error);

    if (error.status === 401) {
      return NextResponse.json(
        { error: 'GitHub token expired. Please reconnect your account.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };

    const body = await request.json();
    const { repoId, repoName, repoOwner, repoUrl, isPrivate } = body;

    if (!repoId || !repoName || !repoOwner || !repoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Add repository to selected list
    await prisma.selectedRepository.upsert({
      where: {
        userId_repoId: {
          userId: user.id,
          repoId: repoId,
        },
      },
      update: {
        repoName,
        repoOwner,
        repoUrl,
        isPrivate: isPrivate || false,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        repoId,
        repoName,
        repoOwner,
        repoUrl,
        isPrivate: isPrivate || false,
      },
    });

    // Invalidate repositories cache since selection changed
    const cacheKey = CacheKeyGenerator.github(user.id, 'repositories');
    await RedisCache.del(cacheKey);

    // Invalidate GitHub activity cache since repository selection changed
    await CacheInvalidationService.invalidateGitHubData(user.id, repoName);

    // Broadcast repository change
    broadcastRepositoryChange(user.id, 'added', repoName);

    return NextResponse.json({ message: 'Repository added successfully' });
  } catch (error: any) {
    console.error('Error adding repository:', error);
    return NextResponse.json(
      { error: 'Failed to add repository' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    };

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId');

    if (!repoId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Get repository name before deletion for cache invalidation
    const selectedRepo = await prisma.selectedRepository.findFirst({
      where: {
        userId: user.id,
        repoId: parseInt(repoId),
      },
    });

    // Remove repository from selected list
    await prisma.selectedRepository.deleteMany({
      where: {
        userId: user.id,
        repoId: parseInt(repoId),
      },
    });

    // Invalidate repositories cache since selection changed
    const cacheKey = CacheKeyGenerator.github(user.id, 'repositories');
    await RedisCache.del(cacheKey);

    // Invalidate GitHub activity cache for this repository
    if (selectedRepo) {
      await CacheInvalidationService.invalidateGitHubData(
        user.id,
        selectedRepo.repoName
      );

      // Broadcast repository change
      broadcastRepositoryChange(user.id, 'removed', selectedRepo.repoName);
    }

    return NextResponse.json({ message: 'Repository removed successfully' });
  } catch (error: any) {
    console.error('Error removing repository:', error);
    return NextResponse.json(
      { error: 'Failed to remove repository' },
      { status: 500 }
    );
  }
}
