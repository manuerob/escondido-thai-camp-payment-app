import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Member, Package, Subscription, Payment, Expense, Todo, ScheduleBlock, Participation } from '@/types/database';

// Replace these with your actual Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

type SyncableRecord = Member | Package | Subscription | Payment | Expense | Todo | ScheduleBlock | Participation;

class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // Only initialize if credentials are provided
    if (SUPABASE_URL && SUPABASE_ANON_KEY && 
        SUPABASE_URL !== '' && 
        SUPABASE_ANON_KEY !== '') {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        this.isConfigured = true;
        console.log('Supabase client initialized');
      } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        this.isConfigured = false;
      }
    } else {
      console.log('Supabase credentials not configured - sync disabled');
      this.isConfigured = false;
    }
  }

  getClient(): SupabaseClient | null {
    return this.client;
  }

  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Check if Supabase is accessible
   */
  async checkConnection(): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const { error } = await this.client!
        .from('members')
        .select('id')
        .limit(1);
      
      return !error;
    } catch (error) {
      console.error('Supabase connection check failed:', error);
      return false;
    }
  }

  /**
   * Push records to Supabase
   * Uses upsert to handle both inserts and updates
   */
  async pushRecords<T extends SyncableRecord>(
    table: string,
    records: T[]
  ): Promise<{ success: boolean; syncedIds: number[]; error?: string }> {
    if (!this.isReady()) {
      return { success: false, syncedIds: [], error: 'Supabase not configured' };
    }

    if (records.length === 0) {
      return { success: true, syncedIds: [] };
    }

    try {
      // Upsert records to Supabase
      const { data, error } = await this.client!
        .from(table)
        .upsert(records, { onConflict: 'id' })
        .select('id');

      if (error) {
        console.error(`Error pushing ${table}:`, error);
        return { success: false, syncedIds: [], error: error.message };
      }

      const syncedIds = (data || []).map((r: any) => r.id);
      console.log(`Pushed ${syncedIds.length} ${table} to Supabase`);
      
      return { success: true, syncedIds };
    } catch (error: any) {
      console.error(`Exception pushing ${table}:`, error);
      return { success: false, syncedIds: [], error: error.message };
    }
  }

  /**
   * Pull records from Supabase that have been updated since last sync
   */
  async pullRecords<T extends SyncableRecord>(
    table: string,
    lastSyncTime: string | null
  ): Promise<{ success: boolean; records: T[]; error?: string }> {
    if (!this.isReady()) {
      return { success: false, records: [], error: 'Supabase not configured' };
    }

    try {
      let query = this.client!.from(table).select('*');

      // Only get records updated after last sync
      if (lastSyncTime) {
        query = query.gt('updated_at', lastSyncTime);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`Error pulling ${table}:`, error);
        return { success: false, records: [], error: error.message };
      }

      console.log(`Pulled ${data?.length || 0} ${table} from Supabase`);
      return { success: true, records: (data as T[]) || [] };
    } catch (error: any) {
      console.error(`Exception pulling ${table}:`, error);
      return { success: false, records: [], error: error.message };
    }
  }

  /**
   * Get all tables that need to be synced
   * Order is CRITICAL - tables must be synced in dependency order:
   * 1. Independent tables (no foreign keys)
   * 2. Tables with foreign keys to independent tables
   * 3. Tables with foreign keys to dependent tables
   */
  getSyncTables(): string[] {
    return [
      // Independent tables - no foreign key dependencies
      'members',
      'packages',
      'expense_categories',
      'todos',
      'schedule_blocks',
      
      // First level dependencies
      'subscriptions',       // depends on: members, packages
      'expenses',           // depends on: expense_categories (optional FK)
      'participations',     // depends on: schedule_blocks
      
      // Second level dependencies
      'payments',           // depends on: members, subscriptions
      
      // Settings (can be last)
      'app_settings',
    ];
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.getClient();
