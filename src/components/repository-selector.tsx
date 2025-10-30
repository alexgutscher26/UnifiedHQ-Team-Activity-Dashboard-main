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
  IconBrandGithub,
  IconLoader2,
  IconSearch,
  IconSettings,
  IconStar,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';

interface Repository {
  id: number;
  name: string;
  owner: string;
  url: string;
  description?: string;
  isPrivate: boolean;
  isSelected: boolean;
  updatedAt: string;
  language?: string;
  stars: number;
}

interface RepositorySelectorProps {
  isConnected: boolean;
}

/**
 * Renders a dialog for selecting GitHub repositories to track.
 *
 * The component fetches repositories from an API when opened and allows users to select or deselect repositories.
 * It manages loading states, displays error messages using toast notifications, and updates the selection count dynamically.
 * The component also includes a search feature to filter repositories based on user input.
 *
 * @param {RepositorySelectorProps} props - The properties for the RepositorySelector component.
 * @param {boolean} props.isConnected - Indicates if the user is connected to the GitHub integration.
 * @returns {JSX.Element | null} The rendered component or null if not connected.
 */
export function RepositorySelector({ isConnected }: RepositorySelectorProps) {
  const { toast } = useToast();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    if (isOpen && isConnected) {
      fetchRepositories();
    }
  }, [isOpen, isConnected]);

  useEffect(() => {
    setSelectedCount(repositories.filter(repo => repo.isSelected).length);
  }, [repositories]);

  const fetchRepositories = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/github/repositories');
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.repositories || []);
      } else {
        const errorData = await response.json();
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to fetch repositories',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to fetch repositories',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle the selection state of a repository by adding or removing it from tracking.
   *
   * The function checks if the repository is currently selected. If it is, it sends a DELETE request to remove the repository from tracking and updates the state accordingly. If it is not selected, it sends a POST request to add the repository, including its details in the request body. In both cases, it provides user feedback through toast notifications. Errors during the process are caught and displayed as a toast notification.
   *
   * @param repo - The repository object containing details such as id, name, owner, url, and selection state.
   */
  const toggleRepository = async (repo: Repository) => {
    try {
      if (repo.isSelected) {
        // Remove repository
        const response = await fetch(
          `/api/integrations/github/repositories?repoId=${repo.id}`,
          { method: 'DELETE' }
        );
        if (response.ok) {
          setRepositories(prev =>
            prev.map(r => (r.id === repo.id ? { ...r, isSelected: false } : r))
          );
          toast({
            title: 'Success',
            description: `Removed ${repo.name} from tracking`,
          });
        } else {
          throw new Error('Failed to remove repository');
        }
      } else {
        // Add repository
        const response = await fetch('/api/integrations/github/repositories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoName: repo.name,
            repoOwner: repo.owner,
            repoUrl: repo.url,
            isPrivate: repo.isPrivate,
          }),
        });
        if (response.ok) {
          setRepositories(prev =>
            prev.map(r => (r.id === repo.id ? { ...r, isSelected: true } : r))
          );
          toast({
            title: 'Success',
            description: `Added ${repo.name} to tracking`,
          });
        } else {
          throw new Error('Failed to add repository');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update repository selection',
        variant: 'destructive',
      });
    }
  };

  const filteredRepos = repositories.filter(
    repo =>
      repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Formats a date string into a human-readable relative time format.
   *
   * The function calculates the difference in days between the current date and the provided date string.
   * It returns a string indicating whether the date is today, yesterday, or how many days, weeks, or months ago it was.
   * The logic accounts for various time frames to provide a concise representation of the date's recency.
   *
   * @param dateString - The date string to be formatted.
   */
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  if (!isConnected) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          <IconSettings className='size-4 mr-2' />
          Manage Repos
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-4xl max-h-[80vh] overflow-hidden flex flex-col'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <IconBrandGithub className='size-5' />
            Select Repositories to Track
          </DialogTitle>
          <DialogDescription>
            Choose which repositories you want to monitor for activity updates.
            {selectedCount > 0 && (
              <span className='ml-2 text-green-600 font-medium'>
                {selectedCount} repository{selectedCount === 1 ? '' : 'ies'}{' '}
                selected
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className='flex-1 overflow-hidden flex flex-col'>
          {/* Search */}
          <div className='relative mb-4'>
            <IconSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground' />
            <Input
              placeholder='Search repositories...'
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className='pl-10'
            />
          </div>

          {/* Repository List */}
          <div className='flex-1 overflow-y-auto space-y-2'>
            {isLoading ? (
              <div className='flex items-center justify-center py-8'>
                <IconLoader2 className='size-6 animate-spin mr-2' />
                <span>Loading repositories...</span>
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                {searchTerm
                  ? 'No repositories match your search'
                  : 'No repositories found'}
              </div>
            ) : (
              filteredRepos.map(repo => (
                <div
                  key={repo.id}
                  className='flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <h4 className='font-medium text-sm truncate'>
                        {repo.name}
                      </h4>
                      {repo.isPrivate ? (
                        <IconEyeOff className='size-4 text-muted-foreground' />
                      ) : (
                        <IconEye className='size-4 text-muted-foreground' />
                      )}
                      {repo.language && (
                        <Badge variant='secondary' className='text-xs'>
                          {repo.language}
                        </Badge>
                      )}
                      {repo.stars > 0 && (
                        <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                          <IconStar className='size-3' />
                          {repo.stars}
                        </div>
                      )}
                    </div>
                    {repo.description && (
                      <p className='text-sm text-muted-foreground mb-2 line-clamp-2'>
                        {repo.description}
                      </p>
                    )}
                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <span>Updated {formatDate(repo.updatedAt)}</span>
                      <span>•</span>
                      <span>{repo.owner}</span>
                    </div>
                  </div>
                  <div className='ml-4'>
                    <Switch
                      checked={repo.isSelected}
                      onCheckedChange={() => toggleRepository(repo)}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className='flex justify-between items-center pt-4 border-t'>
          <div className='text-sm text-muted-foreground'>
            {selectedCount} of {repositories.length} repositories selected
          </div>
          <Button onClick={() => setIsOpen(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
