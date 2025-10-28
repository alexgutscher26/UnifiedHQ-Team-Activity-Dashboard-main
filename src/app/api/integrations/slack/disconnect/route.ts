import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { disconnectSlack } from '@/lib/integrations/slack-cached';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Disconnect Slack integration
    await disconnectSlack(userId);

    return NextResponse.json({
      success: true,
      message: 'Slack integration disconnected successfully',
    });
  } catch (error: any) {
    console.error('Slack disconnect error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to disconnect Slack',
      },
      { status: 500 }
    );
  }
}
