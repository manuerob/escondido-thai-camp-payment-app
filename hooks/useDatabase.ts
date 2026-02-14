import { useEffect, useState, useCallback, useRef } from 'react';
import { databaseService, syncService } from '@/services';
import type { SyncResult } from '@/services/sync.service';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_SYNC_DELAY = 2000; // 2 seconds delay for initial sync

export function useDatabase() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const syncLock = useRef(false);

  // Initialize database
  useEffect(() => {
    async function initializeDatabase() {
      try {
        await databaseService.init();
        setIsReady(true);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to initialize database:', err);
      }
    }

    initializeDatabase();
  }, []);

  // Perform sync operation
  const performSync = useCallback(async () => {
    if (syncLock.current) {
      console.log('Sync already in progress');
      return;
    }

    syncLock.current = true;
    setIsSyncing(true);
    try {
      const result = await syncService.syncAll();
      setLastSyncResult(result);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, []);

  // Set up periodic background sync and initial delayed sync
  useEffect(() => {
    if (!isReady) return;

    // Perform initial sync after a delay to ensure DB is fully ready
    const initialSyncTimeout = setTimeout(() => {
      console.log('Performing initial sync...');
      performSync();
    }, INITIAL_SYNC_DELAY);

    // Set up interval for periodic sync
    const intervalId = setInterval(() => {
      performSync();
    }, SYNC_INTERVAL);

    // Listen to sync completion events
    const unsubscribe = syncService.onSyncComplete((result) => {
      setLastSyncResult(result);
    });

    // Cleanup
    return () => {
      clearTimeout(initialSyncTimeout);
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [isReady, performSync]);

  // Manual sync trigger
  const triggerSync = useCallback(async () => {
    return performSync();
  }, [performSync]);

  // Push-only sync (for immediate sync after changes)
  const pushChanges = useCallback(async () => {
    if (!isReady || syncLock.current) return;
    
    syncLock.current = true;
    setIsSyncing(true);
    try {
      await syncService.pushChanges();
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [isReady]);

  // Pull-only sync (for manual refresh)
  const pullChanges = useCallback(async () => {
    if (!isReady || syncLock.current) return;
    
    syncLock.current = true;
    setIsSyncing(true);
    try {
      await syncService.pullChanges();
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [isReady]);

  return { 
    isReady, 
    error,
    isSyncing,
    lastSyncResult,
    triggerSync,
    pushChanges,
    pullChanges,
  };
}
