import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Slack client ID not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientId,
      message: 'Slack client ID retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching Slack client ID:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
