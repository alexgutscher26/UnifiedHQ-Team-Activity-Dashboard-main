// IndexedDB utilities for offline action storage

export interface DBSchema {
  actions: {
    key: string;
    value: any;
    indexes: {
      status: string;
      timestamp: number;
      resource: string;
    };
  };
  conflicts: {
    key: string;
    value: any;
    indexes: {
      timestamp: number;
      resolved: boolean;
    };
  };
}

export class IndexedDBManager {
  private dbName = 'UnifiedHQ-Offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(
          new Error(`Failed to open IndexedDB: ${request.error?.message}`)
        );
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.setupSchema(db);
      };
    });
  }

  /**
   * Set up the database schema
   */
  private setupSchema(db: IDBDatabase): void {
    // Actions store for offline queue
    if (!db.objectStoreNames.contains('actions')) {
      const actionsStore = db.createObjectStore('actions', { keyPath: 'id' });
      actionsStore.createIndex('status', 'status', { unique: false });
      actionsStore.createIndex('timestamp', 'timestamp', { unique: false });
      actionsStore.createIndex('resource', 'resource', { unique: false });
      console.log('[IndexedDB] Actions store created');
    }

    // Conflicts store for conflict resolution
    if (!db.objectStoreNames.contains('conflicts')) {
      const conflictsStore = db.createObjectStore('conflicts', {
        keyPath: 'actionId',
      });
      conflictsStore.createIndex('timestamp', 'timestamp', { unique: false });
      conflictsStore.createIndex('resolved', 'resolved', { unique: false });
      console.log('[IndexedDB] Conflicts store created');
    }
  }

  /**
   * Get a transaction for the specified stores
   */
  private getTransaction(
    storeNames: string[],
    mode: IDBTransactionMode = 'readonly'
  ): IDBTransaction {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.transaction(storeNames, mode);
  }

  /**
   * Add an item to a store
   */
  async add<T>(storeName: string, item: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to add item: ${request.error?.message}`));
    });
  }

  /**
   * Update an item in a store
   */
  async put<T>(storeName: string, item: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to update item: ${request.error?.message}`));
    });
  }

  /**
   * Get an item by key
   */
  async get<T>(storeName: string, key: string): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName]);
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to get item: ${request.error?.message}`));
    });
  }

  /**
   * Delete an item by key
   */
  async delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to delete item: ${request.error?.message}`));
    });
  }

  /**
   * Get all items from a store
   */
  async getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName]);
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to get all items: ${request.error?.message}`));
    });
  }

  /**
   * Get items by index
   */
  async getByIndex<T>(
    storeName: string,
    indexName: string,
    value: any
  ): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName]);
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new Error(`Failed to get items by index: ${request.error?.message}`)
        );
    });
  }

  /**
   * Count items in a store
   */
  async count(
    storeName: string,
    query?: IDBValidKey | IDBKeyRange
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName]);
      const store = transaction.objectStore(storeName);
      const request = store.count(query);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(new Error(`Failed to count items: ${request.error?.message}`));
    });
  }

  /**
   * Clear all items from a store
   */
  async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () =>
        reject(new Error(`Failed to clear store: ${request.error?.message}`));
    });
  }

  /**
   * Execute a cursor operation
   */
  async cursor<T>(
    storeName: string,
    callback: (cursor: IDBCursorWithValue | null) => void,
    query?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction([storeName]);
      const store = transaction.objectStore(storeName);
      const request = store.openCursor(query, direction);

      request.onsuccess = () => {
        const cursor = request.result;
        callback(cursor);
        if (cursor) {
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () =>
        reject(new Error(`Cursor operation failed: ${request.error?.message}`));
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[IndexedDB] Database connection closed');
    }
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<void> {
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);

      request.onsuccess = () => {
        console.log('[IndexedDB] Database deleted successfully');
        resolve();
      };

      request.onerror = () => {
        reject(
          new Error(`Failed to delete database: ${request.error?.message}`)
        );
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database deletion blocked - close all tabs');
      };
    });
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'indexedDB' in window;
  }

  /**
   * Get database size estimate
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { usage: 0, quota: 0 };
  }
}

// Export singleton instance
export const indexedDBManager = new IndexedDBManager();
