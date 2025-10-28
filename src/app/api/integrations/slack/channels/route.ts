import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PrismaClient } from '@/generated/prisma';
import { CachedSlackClient } from '@/lib/integrations/slack-cached';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if Slack is connected
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'slack',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    // Get available channels from Slack
    const client = new CachedSlackClient(connection.accessToken, userId);
    const channels = await client.getChannels();

    // Get currently selected channels
    const selectedChannels = await prisma.selectedChannel.findMany({
      where: {
        userId,
      },
    });

    const selectedChannelIds = new Set(selectedChannels.map(c => c.channelId));

    // Format channels with selection status
    const channelsWithSelection = channels.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.is_channel
        ? 'public_channel'
        : channel.is_group
          ? 'private_channel'
          : channel.is_im
            ? 'im'
            : 'mpim',
      isPrivate: channel.is_private,
      isArchived: channel.is_archived,
      isMember: channel.is_member,
      numMembers: channel.num_members,
      topic: channel.topic?.value,
      purpose: channel.purpose?.value,
      selected: selectedChannelIds.has(channel.id),
    }));

    return NextResponse.json({
      channels: channelsWithSelection,
      selectedCount: selectedChannels.length,
    });
  } catch (error: any) {
    console.error('Slack channels fetch error:', error);

    if (
      error.message.includes('invalid_auth') ||
      error.message.includes('token_revoked')
    ) {
      return NextResponse.json(
        {
          error: 'Slack token expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch Slack channels',
      },
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

    const userId = session.user.id;
    const { channelIds } = await request.json();

    if (!Array.isArray(channelIds)) {
      return NextResponse.json(
        { error: 'channelIds must be an array' },
        { status: 400 }
      );
    }

    // Check if Slack is connected
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        type: 'slack',
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Slack not connected' },
        { status: 400 }
      );
    }

    // Get channel details from Slack
    const client = new CachedSlackClient(connection.accessToken, userId);
    const channels = await client.getChannels();
    const channelMap = new Map(channels.map(c => [c.id, c]));

    // Clear existing selections
    await prisma.selectedChannel.deleteMany({
      where: {
        userId,
      },
    });

    // Add new selections
    const selectedChannels = [];
    for (const channelId of channelIds) {
      const channel = channelMap.get(channelId);
      if (channel) {
        const selectedChannel = await prisma.selectedChannel.create({
          data: {
            userId,
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.is_channel
              ? 'public_channel'
              : channel.is_group
                ? 'private_channel'
                : channel.is_im
                  ? 'im'
                  : 'mpim',
            isPrivate: channel.is_private,
          },
        });
        selectedChannels.push(selectedChannel);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Selected ${selectedChannels.length} channels for syncing`,
      selectedChannels: selectedChannels.length,
    });
  } catch (error: any) {
    console.error('Slack channel selection error:', error);

    if (
      error.message.includes('invalid_auth') ||
      error.message.includes('token_revoked')
    ) {
      return NextResponse.json(
        {
          error: 'Slack token expired. Please reconnect your account.',
          code: 'TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error.message || 'Failed to save channel selections',
      },
      { status: 500 }
    );
  }
}
