import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { disconnectGithub } from '@/lib/integrations/github';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Disconnect GitHub
    await disconnectGithub(userId);

    return NextResponse.json({
      success: true,
      message: 'GitHub disconnected successfully',
    });
  } catch (error) {
    console.error('GitHub disconnect error:', error);
    return NextResponse.json(
      {
        error: 'Failed to disconnect GitHub',
      },
      { status: 500 }
    );
  }
}
