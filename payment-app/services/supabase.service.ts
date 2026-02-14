import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project credentials
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  // Sync helpers - to be implemented when needed
  async syncMembersToSupabase(members: any[]): Promise<void> {
    // Implementation for syncing local members to Supabase
    console.log('Syncing members to Supabase:', members.length);
  }

  async syncPaymentsToSupabase(payments: any[]): Promise<void> {
    // Implementation for syncing local payments to Supabase
    console.log('Syncing payments to Supabase:', payments.length);
  }

  async syncExpensesToSupabase(expenses: any[]): Promise<void> {
    // Implementation for syncing local expenses to Supabase
    console.log('Syncing expenses to Supabase:', expenses.length);
  }

  async pullDataFromSupabase(): Promise<void> {
    // Implementation for pulling data from Supabase to local DB
    console.log('Pulling data from Supabase');
  }

  async checkConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from('members').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();
export const supabase = supabaseService.getClient();
