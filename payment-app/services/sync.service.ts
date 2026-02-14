import { databaseService } from './database.service';
import { supabaseService } from './supabase.service';
import { Member, Payment, Expense } from '@/types/database';

class SyncService {
  private isSyncing = false;

  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    
    try {
      console.log('Starting sync...');
      
      // Check Supabase connection
      const isConnected = await supabaseService.checkConnection();
      if (!isConnected) {
        console.log('Supabase not configured or connection failed');
        return;
      }

      // Get unsynced records from local database
      const db = await databaseService.getDatabase();
      
      // Sync members
      const unsyncedMembers = await db.getAllAsync<Member>(
        'SELECT * FROM members WHERE synced = 0'
      );
      if (unsyncedMembers.length > 0) {
        await supabaseService.syncMembersToSupabase(unsyncedMembers);
      }

      // Sync payments
      const unsyncedPayments = await db.getAllAsync<Payment>(
        'SELECT * FROM payments WHERE synced = 0'
      );
      if (unsyncedPayments.length > 0) {
        await supabaseService.syncPaymentsToSupabase(unsyncedPayments);
      }

      // Sync expenses
      const unsyncedExpenses = await db.getAllAsync<Expense>(
        'SELECT * FROM expenses WHERE synced = 0'
      );
      if (unsyncedExpenses.length > 0) {
        await supabaseService.syncExpensesToSupabase(unsyncedExpenses);
      }

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  async pullFromSupabase(): Promise<void> {
    try {
      await supabaseService.pullDataFromSupabase();
    } catch (error) {
      console.error('Pull from Supabase failed:', error);
    }
  }

  getSyncStatus(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();
