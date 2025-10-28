import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Required Slack OAuth scopes
    const scopes = [
      'channels:read',
      'channels:history',
      'groups:read',
      'im:history',
      'mpim:history',
      'users:read',
      'team:read',
      'channels:join',
    ].join(',');

    // Build Slack OAuth URL
    const authUrl = new URL('https://slack.com/oauth/v2/authorize');
    authUrl.searchParams.set('client_id', process.env.SLACK_CLIENT_ID!);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', process.env.SLACK_REDIRECT_URI!);
    authUrl.searchParams.set('state', userId); // Use user ID as state for security

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Slack connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Slack connection' },
      { status: 500 }
    );
  }
}
