import { describe, test, expect, beforeEach } from '@jest/globals';
import { ConflictResolutionManager } from '../conflict-resolution';
import { DataConflict, OfflineAction } from '../types';

describe('ConflictResolutionManager', () => {
  let conflictManager: ConflictResolutionManager;

  beforeEach(() => {
    conflictManager = new ConflictResolutionManager();
  });

  describe('conflict detection logic', () => {
    test('should detect concurrent modification conflict', async () => {
      const action: OfflineAction = {
        id: 'action-1',
        type: 'UPDATE',
        resource: 'posts',
        payload: {
          id: '123',
          title: 'Client Title',
          updatedAt: '2024-01-01T10:00:00Z',
        },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const serverData = {
        id: '123',
        title: 'Server Title',
        updatedAt: '2024-01-01T11:00:00Z',
      };

      const conflict = await conflictManager.detectConflict(action, serverData);

      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('concurrent-modification');
      expect(conflict?.clientData).toEqual(action.payload);
      expect(conflict?.serverData).toEqual(serverData);
    });

    test('should detect deleted-on-server conflict', async () => {
      const action: OfflineAction = {
        id: 'action-1',
        type: 'UPDATE',
        resource: 'posts',
        payload: { id: '123', title: 'Updated Title' },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const serverData = null; // Resource deleted on server

      const conflict = await conflictManager.detectConflict(action, serverData);

      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('deleted-on-server');
    });

    test('should detect version mismatch conflict', async () => {
      const action: OfflineAction = {
        id: 'action-1',
        type: 'UPDATE',
        resource: 'posts',
        payload: { id: '123', title: 'Updated Title', version: 1 },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const serverData = {
        id: '123',
        title: 'Server Title',
        version: 3,
      };

      const conflict = await conflictManager.detectConflict(action, serverData);

      expect(conflict).not.toBeNull();
      expect(conflict?.conflictType).toBe('version-mismatch');
    });

    test('should return null when no conflict exists', async () => {
      const action: OfflineAction = {
        id: 'action-1',
        type: 'CREATE', // CREATE actions don't check for conflicts
        resource: 'posts',
        payload: { title: 'New Title' },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
      };

      const serverData = null; // No server data for CREATE

      const conflict = await conflictManager.detectConflict(action, serverData);

      expect(conflict).toBeNull();
    });
  });

  describe('resolver registration', () => {
    test('should register custom resolvers', () => {
      const mockResolver = {
        canResolve: () => true,
        resolve: async () => ({
          strategy: 'client-wins' as const,
          resolvedData: {},
        }),
      };

      expect(() => {
        conflictManager.registerResolver('custom/resource', mockResolver);
      }).not.toThrow();
    });
  });

  describe('conflict type detection helpers', () => {
    test('should detect concurrent modifications correctly', () => {
      const clientData = {
        id: '123',
        title: 'Client',
        updatedAt: '2024-01-01T10:00:00Z',
      };
      const serverData = {
        id: '123',
        title: 'Server',
        updatedAt: '2024-01-01T11:00:00Z',
      };

      // Access private method for testing
      const hasConflict = (conflictManager as any).hasConcurrentModification(
        clientData,
        serverData
      );
      expect(hasConflict).toBe(true);
    });

    test('should detect server deletions correctly', () => {
      // Access private method for testing
      const isDeleted1 = (conflictManager as any).isDeletedOnServer(null);
      const isDeleted2 = (conflictManager as any).isDeletedOnServer(undefined);
      const isDeleted3 = (conflictManager as any).isDeletedOnServer({
        deleted: true,
      });
      const isNotDeleted = (conflictManager as any).isDeletedOnServer({
        id: '123',
      });

      expect(isDeleted1).toBe(true);
      expect(isDeleted2).toBe(true);
      expect(isDeleted3).toBe(true);
      expect(isNotDeleted).toBe(false);
    });

    test('should detect version mismatches correctly', () => {
      const clientData = { version: 1 };
      const serverData = { version: 3 };

      // Access private method for testing
      const hasMismatch = (conflictManager as any).hasVersionMismatch(
        clientData,
        serverData
      );
      expect(hasMismatch).toBe(true);
    });
  });
});
