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

/**
 * Renders a dialog for resolving data conflicts.
 *
 * This component displays options for resolving conflicts between client and server data. It allows the user to choose a resolution strategy, such as using client changes, server version, or merging both. The selected strategy determines the resolved data that is passed to the onResolve callback. The dialog also provides visual feedback on the conflict type and displays the relevant data for each option.
 *
 * @param conflict - The data conflict object containing client and server data, conflict type, and action ID.
 * @param isOpen - A boolean indicating whether the dialog is open or closed.
 * @param onResolve - A callback function to be called with the resolution strategy and resolved data.
 * @param onCancel - A callback function to be called when the dialog is canceled.
 * @returns A JSX element representing the conflict resolution dialog.
 */
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

  /**
   * Handle the resolution of a conflict based on the selected strategy.
   *
   * The function determines the resolved data by evaluating the selectedStrategy.
   * It uses different strategies such as 'client-wins', 'server-wins', and 'merge'
   * to decide which data to resolve. Finally, it calls the onResolve function with
   * the selected strategy and the resolved data.
   *
   * @param selectedStrategy - The strategy to use for resolving the conflict.
   * @param conflict - The conflict object containing clientData and serverData.
   * @param mergedData - Optional merged data to use in the 'merge' strategy.
   * @param onResolve - Callback function to handle the resolved data.
   */
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

  /**
   * Retrieves a human-readable label for a given conflict type.
   *
   * The function takes a conflict type from the DataConflict type and returns a corresponding label.
   * It handles specific cases for 'concurrent-modification', 'deleted-on-server', and 'version-mismatch',
   * returning 'Unknown Conflict' for any other type.
   *
   * @param type - The conflict type to retrieve the label for.
   */
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

  /**
   * Retrieves the corresponding color classes for a given data conflict type.
   *
   * The function takes a conflict type and returns a string representing the
   * appropriate background and text color classes based on the type of conflict.
   * It handles specific cases for 'concurrent-modification', 'deleted-on-server',
   * and 'version-mismatch', defaulting to a gray color for any unrecognized types.
   *
   * @param type - The type of data conflict to determine the color for.
   */
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
