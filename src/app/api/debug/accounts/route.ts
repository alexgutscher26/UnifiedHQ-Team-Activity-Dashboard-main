import { NextRequest } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get the session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user with accounts
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        accounts: true,
        preferences: true,
      },
    });

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        lastLoginMethod: user.lastLoginMethod,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accounts: user.accounts.map(account => ({
        id: account.id,
        providerId: account.providerId,
        accountId: account.accountId,
        hasAccessToken: !!account.accessToken,
        hasRefreshToken: !!account.refreshToken,
        scope: account.scope,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
      preferences: user.preferences,
    });
  } catch (error) {
    console.error('Debug accounts error:', error);
    return Response.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
