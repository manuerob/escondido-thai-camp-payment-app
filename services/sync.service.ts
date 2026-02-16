import { databaseService } from './database.service';
import { supabaseService } from './supabase.service';
import { networkService } from './network.service';
import type { BaseEntity } from '@/types/database';

export interface SyncResult {
  success: boolean;
  tablesProcessed: string[];
  recordsPushed: number;
  recordsPulled: number;
  errors: string[];
  timestamp: string;
}

class SyncService {
  private isSyncing = false;
  private lastSyncResult: SyncResult | null = null;
  private syncListeners: Set<(result: SyncResult) => void> = new Set();

  /**
   * Perform full bidirectional sync
   * 1. Check network connectivity
   * 2. Push unsynced local records to Supabase
   * 3. Pull remote changes from Supabase
   * 4. Handle conflicts (latest updated_at wins)
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return this.lastSyncResult || this.createEmptyResult('Sync already in progress');
    }

    this.isSyncing = true;
    const startTime = new Date().toISOString();
    const result: SyncResult = {
      success: true,
      tablesProcessed: [],
      recordsPushed: 0,
      recordsPulled: 0,
      errors: [],
      timestamp: startTime,
    };

    try {
      console.log('🔄 Starting sync...');

      // Check if Supabase is configured
      if (!supabaseService.isReady()) {
        const msg = 'Supabase not configured - skipping sync';
        console.log(msg);
        result.success = false;
        result.errors.push(msg);
        return result;
      }

      // Check network connectivity
      const isConnected = await networkService.checkConnection();
      if (!isConnected) {
        const msg = 'No internet connection - skipping sync';
        console.log(msg);
        result.success = false;
        result.errors.push(msg);
        return result;
      }

      // Verify Supabase connection
      const canConnect = await supabaseService.checkConnection();
      if (!canConnect) {
        const msg = 'Cannot connect to Supabase - skipping sync';
        console.log(msg);
        result.success = false;
        result.errors.push(msg);
        return result;
      }

      // Get all tables to sync
      const tables = supabaseService.getSyncTables();

      // Process each table
      for (const table of tables) {
        try {
          await this.syncTable(table, result);
          result.tablesProcessed.push(table);
        } catch (error: any) {
          const errorMsg = `Error syncing ${table}: ${error.message}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
          result.success = false;
        }
      }

      if (result.success) {
        console.log(`✅ Sync completed: ${result.recordsPushed} pushed, ${result.recordsPulled} pulled`);
      } else {
        console.log('⚠️ Sync completed with errors');
        console.log('Errors:');
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

      this.lastSyncResult = result;
      this.notifyListeners(result);
      
      return result;
    } catch (error: any) {
      const errorMsg = `Sync failed: ${error.message}`;
      console.error(errorMsg);
      result.success = false;
      result.errors.push(errorMsg);
      this.lastSyncResult = result;
      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single table bidirectionally
   */
  private async syncTable(table: string, result: SyncResult): Promise<void> {
    // Step 1: Push local changes to Supabase
    await this.pushTableChanges(table, result);

    // Step 2: Pull remote changes from Supabase
    await this.pullTableChanges(table, result);
  }

  /**
   * Push unsynced local records to Supabase
   */
  private async pushTableChanges(table: string, result: SyncResult): Promise<void> {
    try {
      // Get all pending records (including soft-deleted)
      const pendingRecords = await databaseService.getAllPendingRecordsIncludingDeleted<any>(table);
      
      if (pendingRecords.length === 0) {
        console.log(`No pending ${table} to push`);
        return;
      }

      console.log(`Pushing ${pendingRecords.length} ${table}...`);

      // Push to Supabase
      const pushResult = await supabaseService.pushRecords(table, pendingRecords);

      if (!pushResult.success) {
        result.errors.push(`Failed to push ${table}: ${pushResult.error}`);
        result.success = false;
        return;
      }

      // Mark successfully synced records
      if (pushResult.syncedIds.length > 0) {
        await databaseService.markMultipleAsSynced(table, pushResult.syncedIds);
        result.recordsPushed += pushResult.syncedIds.length;
        console.log(`✓ Pushed ${pushResult.syncedIds.length} ${table}`);
      }
    } catch (error: any) {
      const errorMsg = `Error pushing ${table}: ${error.message}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  /**
   * Pull remote changes from Supabase and merge with local data
   */
  private async pullTableChanges(table: string, result: SyncResult): Promise<void> {
    try {
      // Get last sync time for this table
      const lastSyncTime = await databaseService.getLastSyncTime(table);

      console.log(`Pulling ${table} since ${lastSyncTime || 'beginning'}...`);

      // Pull from Supabase
      const pullResult = await supabaseService.pullRecords<any>(table, lastSyncTime);

      if (!pullResult.success) {
        result.errors.push(`Failed to pull ${table}: ${pullResult.error}`);
        result.success = false;
        return;
      }

      if (pullResult.records.length === 0) {
        console.log(`No new ${table} to pull`);
        // Still update sync time even if no records
        await databaseService.setLastSyncTime(table, new Date().toISOString());
        return;
      }

      console.log(`Merging ${pullResult.records.length} remote ${table}...`);

      // Upsert with conflict resolution (latest updated_at wins)
      const upsertResult = await databaseService.upsertFromRemote(table, pullResult.records);

      result.recordsPulled += upsertResult.inserted + upsertResult.updated;
      
      console.log(
        `✓ Pulled ${table}: ${upsertResult.inserted} inserted, ` +
        `${upsertResult.updated} updated, ${upsertResult.skipped} skipped (local newer)`
      );

      // Update last sync time
      await databaseService.setLastSyncTime(table, new Date().toISOString());
    } catch (error: any) {
      const errorMsg = `Error pulling ${table}: ${error.message}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }
  }

  /**
   * Push only (useful for immediate sync after changes)
   */
  async pushChanges(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    const isConnected = await networkService.checkConnection();
    if (!isConnected || !supabaseService.isReady()) {
      console.log('Cannot push: offline or not configured');
      return;
    }

    this.isSyncing = true;

    try {
      const tables = supabaseService.getSyncTables();
      const result = this.createEmptyResult();

      for (const table of tables) {
        await this.pushTableChanges(table, result);
      }

      console.log(`Pushed ${result.recordsPushed} records`);
    } catch (error) {
      console.error('Error pushing changes:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Pull only (useful for manual refresh)
   */
  async pullChanges(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    const isConnected = await networkService.checkConnection();
    if (!isConnected || !supabaseService.isReady()) {
      console.log('Cannot pull: offline or not configured');
      return;
    }

    this.isSyncing = true;

    try {
      const tables = supabaseService.getSyncTables();
      const result = this.createEmptyResult();

      for (const table of tables) {
        await this.pullTableChanges(table, result);
      }

      console.log(`Pulled ${result.recordsPulled} records`);
    } catch (error) {
      console.error('Error pulling changes:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Get the last sync result
   */
  getLastSyncResult(): SyncResult | null {
    return this.lastSyncResult;
  }

  /**
   * Listen to sync completion events
   */
  onSyncComplete(listener: (result: SyncResult) => void): () => void {
    this.syncListeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  private notifyListeners(result: SyncResult): void {
    this.syncListeners.forEach(listener => {
      try {
        listener(result);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  private createEmptyResult(error?: string): SyncResult {
    return {
      success: !error,
      tablesProcessed: [],
      recordsPushed: 0,
      recordsPulled: 0,
      errors: error ? [error] : [],
      timestamp: new Date().toISOString(),
    };
  }
}

export const syncService = new SyncService();
