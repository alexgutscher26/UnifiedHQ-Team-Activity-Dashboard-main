'use client';

import { useState } from 'react';
import { DataConflict, ConflictResolution } from '@/lib/offline/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConflictResolutionDialogProps {
  conflict: DataConflict | null;
  isOpen: boolean;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}

export function ConflictResolutionDialog({
  conflict,
  isOpen,
  onResolve,
  onCancel,
}: ConflictResolutionDialogProps) {
  const [selectedStrategy, setSelectedStrategy] =
    useState<ConflictResolution['strategy']>('server-wins');
  const [mergedData, setMergedData] = useState<any>(null);

  if (!conflict) return null;

  const handleResolve = () => {
    let resolvedData: any;

    switch (selectedStrategy) {
      case 'client-wins':
        resolvedData = conflict.clientData;
        break;
      case 'server-wins':
        resolvedData = conflict.serverData;
        break;
      case 'merge':
        resolvedData = mergedData || {
          ...conflict.serverData,
          ...conflict.clientData,
        };
        break;
      default:
        resolvedData = conflict.serverData;
    }

    onResolve({
      strategy: selectedStrategy,
      resolvedData,
    });
  };

  const getConflictTypeLabel = (type: DataConflict['conflictType']) => {
    switch (type) {
      case 'concurrent-modification':
        return 'Concurrent Modification';
      case 'deleted-on-server':
        return 'Deleted on Server';
      case 'version-mismatch':
        return 'Version Mismatch';
      default:
        return 'Unknown Conflict';
    }
  };

  const getConflictTypeColor = (type: DataConflict['conflictType']) => {
    switch (type) {
      case 'concurrent-modification':
        return 'bg-yellow-100 text-yellow-800';
      case 'deleted-on-server':
        return 'bg-red-100 text-red-800';
      case 'version-mismatch':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className='max-w-4xl max-h-[80vh]'>
        <DialogHeader>
          <DialogTitle>Resolve Data Conflict</DialogTitle>
          <DialogDescription>
            A conflict was detected while syncing your offline changes. Please
            choose how to resolve it.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='flex items-center gap-2'>
            <Badge className={getConflictTypeColor(conflict.conflictType)}>
              {getConflictTypeLabel(conflict.conflictType)}
            </Badge>
            <span className='text-sm text-muted-foreground'>
              Action ID: {conflict.actionId}
            </span>
          </div>

          <Tabs
            value={selectedStrategy}
            onValueChange={value => setSelectedStrategy(value as any)}
          >
            <TabsList className='grid w-full grid-cols-3'>
              <TabsTrigger value='client-wins'>Use Your Changes</TabsTrigger>
              <TabsTrigger value='server-wins'>Use Server Version</TabsTrigger>
              <TabsTrigger value='merge'>Merge Changes</TabsTrigger>
            </TabsList>

            <TabsContent value='client-wins' className='space-y-4'>
              <div>
                <h4 className='font-medium mb-2'>Your Changes (Client)</h4>
                <ScrollArea className='h-48 w-full border rounded-md p-3'>
                  <pre className='text-sm'>
                    {JSON.stringify(conflict.clientData, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value='server-wins' className='space-y-4'>
              <div>
                <h4 className='font-medium mb-2'>Server Version</h4>
                <ScrollArea className='h-48 w-full border rounded-md p-3'>
                  <pre className='text-sm'>
                    {JSON.stringify(conflict.serverData, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value='merge' className='space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <h4 className='font-medium mb-2'>Your Changes</h4>
                  <ScrollArea className='h-32 w-full border rounded-md p-3'>
                    <pre className='text-xs'>
                      {JSON.stringify(conflict.clientData, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
                <div>
                  <h4 className='font-medium mb-2'>Server Version</h4>
                  <ScrollArea className='h-32 w-full border rounded-md p-3'>
                    <pre className='text-xs'>
                      {JSON.stringify(conflict.serverData, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
              <div>
                <h4 className='font-medium mb-2'>Merged Result (Preview)</h4>
                <ScrollArea className='h-32 w-full border rounded-md p-3'>
                  <pre className='text-xs'>
                    {JSON.stringify(
                      mergedData || {
                        ...conflict.serverData,
                        ...conflict.clientData,
                      },
                      null,
                      2
                    )}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleResolve}>Resolve Conflict</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
