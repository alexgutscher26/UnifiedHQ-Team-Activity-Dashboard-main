import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  fetchGithubActivity,
  saveGithubActivities,
  isGithubConnected,
  getSelectedRepositoryCount,
} from '@/lib/integrations/github-cached';

/**
 * Handles the POST request to sync GitHub activities for the authenticated user.
 *
 * This function retrieves the user's session and checks if they are authorized. It verifies if GitHub is connected and counts the selected repositories. If no repositories are selected, it returns a message indicating this. If everything is in order, it fetches the user's GitHub activity and saves it, returning a success message with the count of activities synced.
 *
 * @param request - The NextRequest object containing the request details.
 * @returns A JSON response indicating the success or failure of the sync operation.
 * @throws Error If the GitHub token is expired or invalid, or if there is a failure in syncing the activities.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if GitHub is connected
    const connected = await isGithubConnected(userId);
    if (!connected) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Get selected repository count
    const selectedRepoCount = await getSelectedRepositoryCount(userId);

    if (selectedRepoCount === 0) {
      return NextResponse.json({
        success: true,
        message:
          'No repositories selected. Please select repositories to track activity.',
        count: 0,
        selectedRepositories: 0,
      });
    }

    // Fetch and save GitHub activity
    const activities = await fetchGithubActivity(userId);
    await saveGithubActivities(userId, activities);

    return NextResponse.json({
      success: true,
      message: `Synced ${activities.length} GitHub activities from ${selectedRepoCount} selected repositories`,
      count: activities.length,
      selectedRepositories: selectedRepoCount,
    });
  } catch (error: any) {
    console.error('GitHub sync error:', error);

    if (
      error.message.includes('token expired') ||
      error.message.includes('invalid')
    ) {
      return NextResponse.json(
        {
          error: 'GitHub token expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to sync GitHub activity',
      },
      { status: 500 }
    );
  }
}

/**
 * Handles the GET request to check the GitHub connection status of the user.
 *
 * This function retrieves the user session from the request headers and checks if the user is authenticated.
 * If authenticated, it verifies the GitHub connection status for the user and returns the appropriate message.
 * In case of an error during the process, it logs the error and returns a 500 status response.
 *
 * @param request - The NextRequest object containing the request headers.
 * @returns A JSON response indicating the GitHub connection status and a message.
 * @throws Error If there is an internal server error during the process.
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
    const connected = await isGithubConnected(userId);

    return NextResponse.json({
      connected,
      message: connected ? 'GitHub is connected' : 'GitHub not connected',
    });
  } catch (error) {
    console.error('GitHub status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
