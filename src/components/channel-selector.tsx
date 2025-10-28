'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  IconBrandSlack,
  IconLoader2,
  IconSearch,
  IconSettings,
  IconUsers,
  IconLock,
  IconMessage,
  IconHash,
} from '@tabler/icons-react';

interface Channel {
  id: string;
  name: string;
  type: 'public_channel' | 'private_channel' | 'im' | 'mpim';
  isPrivate: boolean;
  isArchived: boolean;
  isMember: boolean;
  numMembers?: number;
  topic?: string;
  purpose?: string;
  selected: boolean;
}

interface ChannelSelectorProps {
  isConnected: boolean;
}

/**
 * Renders a channel selection dialog for managing Slack channels.
 *
 * This component fetches channels from the Slack API when opened and allows users to select channels for monitoring. It handles loading states, error notifications, and saves the selected channels back to the API. The component also provides filtering capabilities based on user input and displays relevant channel information, including accessibility and type.
 *
 * @param {ChannelSelectorProps} props - The properties for the ChannelSelector component.
 * @param {boolean} props.isConnected - Indicates if the user is connected to Slack.
 * @returns {JSX.Element | null} The rendered component or null if not connected.
 */
export function ChannelSelector({ isConnected }: ChannelSelectorProps) {
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && isConnected) {
      fetchChannels();
    }
  }, [isOpen, isConnected]);

  useEffect(() => {
    setSelectedCount(channels.filter(channel => channel.selected).length);
  }, [channels]);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/slack/channels');
      if (response.ok) {
        const data = await response.json();
        setChannels(data.channels || []);
      } else {
        const errorData = await response.json();
        if (errorData.code === 'TOKEN_EXPIRED') {
          toast({
            title: 'Slack Token Expired',
            description: 'Please reconnect your Slack account.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: errorData.error || 'Failed to fetch channels',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch channels',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleChannel = (channel: Channel) => {
    setChannels(prev =>
      prev.map(c => (c.id === channel.id ? { ...c, selected: !c.selected } : c))
    );
  };

  const saveSelections = async () => {
    setIsSaving(true);
    try {
      const selectedChannelIds = channels
        .filter(channel => channel.selected)
        .map(channel => channel.id);

      const response = await fetch('/api/integrations/slack/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: selectedChannelIds }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Success',
          description: data.message,
        });
        setIsOpen(false);
      } else {
        const errorData = await response.json();
        if (errorData.code === 'TOKEN_EXPIRED') {
          toast({
            title: 'Slack Token Expired',
            description: 'Please reconnect your Slack account.',
            variant: 'destructive',
          });
        } else {
          throw new Error(errorData.error || 'Failed to save selections');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save channel selections',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredChannels = channels.filter(
    channel =>
      channel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      channel.purpose?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getChannelIcon = (channel: Channel) => {
    switch (channel.type) {
      case 'public_channel':
        return <IconHash className='size-4' />;
      case 'private_channel':
        return <IconLock className='size-4' />;
      case 'im':
        return <IconMessage className='size-4' />;
      case 'mpim':
        return <IconUsers className='size-4' />;
      default:
        return <IconHash className='size-4' />;
    }
  };

  const getChannelTypeLabel = (channel: Channel) => {
    switch (channel.type) {
      case 'public_channel':
        return 'Public';
      case 'private_channel':
        return 'Private';
      case 'im':
        return 'DM';
      case 'mpim':
        return 'Group';
      default:
        return 'Channel';
    }
  };

  const getChannelTypeColor = (channel: Channel) => {
    switch (channel.type) {
      case 'public_channel':
        return 'bg-green-100 text-green-800';
      case 'private_channel':
        return 'bg-orange-100 text-orange-800';
      case 'im':
        return 'bg-blue-100 text-blue-800';
      case 'mpim':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <IconSettings className='size-4 mr-2' />
          Manage Channels
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[80vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <IconBrandSlack className='size-5' />
            Select Channels to Track
          </DialogTitle>
          <DialogDescription>
            Choose which channels you want to monitor for message activity.
            <br />
            <span className='text-sm text-muted-foreground'>
              ✅ Accessible channels can be monitored immediately
              <br />❌ Channels requiring invitation need to be added manually
              in Slack
            </span>
            {selectedCount > 0 && (
              <span className='ml-2 text-green-600 font-medium'>
                {selectedCount} channel{selectedCount === 1 ? '' : 's'} selected
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-hidden flex flex-col'>
          {/* Search */}
          <div className='relative mb-4'>
            <IconSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground' />
            <Input
              placeholder='Search channels...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10'
            />
          </div>

          {/* Channel List */}
          <div className='flex-1 overflow-y-auto space-y-2'>
            {isLoading ? (
              <div className='flex items-center justify-center py-8'>
                <IconLoader2 className='size-6 animate-spin mr-2' />
                <span>Loading channels...</span>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                {searchTerm
                  ? 'No channels match your search'
                  : 'No channels found'}
              </div>
            ) : (
              filteredChannels.map(channel => (
                <div
                  key={channel.id}
                  className='flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <div className='flex items-center gap-1'>
                        {getChannelIcon(channel)}
                        <h4 className='font-medium text-sm truncate'>
                          {channel.name}
                        </h4>
                      </div>
                      <Badge
                        variant='secondary'
                        className={`text-xs ${getChannelTypeColor(channel)}`}
                      >
                        {getChannelTypeLabel(channel)}
                      </Badge>
                      {channel.isArchived && (
                        <Badge variant='outline' className='text-xs'>
                          Archived
                        </Badge>
                      )}
                      {channel.numMembers && (
                        <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                          <IconUsers className='size-3' />
                          {channel.numMembers}
                        </div>
                      )}
                    </div>
                    {channel.topic && (
                      <p className='text-sm text-muted-foreground mb-1 line-clamp-1'>
                        {channel.topic}
                      </p>
                    )}
                    {channel.purpose && (
                      <p className='text-sm text-muted-foreground mb-2 line-clamp-1'>
                        {channel.purpose}
                      </p>
                    )}
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      {channel.isMember ? (
                        <span className='text-green-600'>✅ Accessible</span>
                      ) : channel.isPrivate ? (
                        <span className='text-red-600'>
                          ❌ Requires invitation
                        </span>
                      ) : (
                        <span className='text-blue-600'>🔓 Public channel</span>
                      )}
                    </div>
                  </div>
                  <div className='ml-4'>
                    <Switch
                      checked={channel.selected}
                      onCheckedChange={() => toggleChannel(channel)}
                      disabled={channel.isArchived}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='flex justify-between items-center pt-4 border-t'>
          <div className='text-sm text-muted-foreground'>
            {selectedCount} of {channels.length} channels selected
            <br />
            <span className='text-xs'>
              💡 For channels showing &quot;❌ Requires invitation&quot;, add
              the app to the channel in Slack first
            </span>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSelections} disabled={isSaving}>
              {isSaving ? (
                <>
                  <IconLoader2 className='size-4 mr-2 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Selection'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
