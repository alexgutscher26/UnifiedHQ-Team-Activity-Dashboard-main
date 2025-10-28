import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { withErrorHandling } from '@/lib/api-error-handler';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: string;
  status: 'active' | 'away' | 'offline';
  lastActive: string;
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
}

async function getTeamMembers(request: NextRequest): Promise<NextResponse> {
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

  try {
    // TODO: For now, return the current user as the only team member
    // In a real implementation, this would fetch from a team management system
    const teamMembers: TeamMember[] = [
      {
        id: user.id,
        name: user.name || 'Unknown User',
        email: user.email || '',
        avatar: user.image,
        role: 'Developer',
        status: 'active',
        lastActive: new Date().toISOString(),
        commits: 0, // These would be calculated from actual activity
        pullRequests: 0,
        issues: 0,
        reviews: 0,
      },
    ];

    return NextResponse.json({
      data: teamMembers,
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching team members:', error);

    // Log error for debugging
    console.error('Team members API error:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch team members',
        success: false,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export const GET = withErrorHandling(getTeamMembers);
