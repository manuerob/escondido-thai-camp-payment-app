// Database Types

export interface Member {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface Payment {
  id: number;
  member_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  description?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface Expense {
  id: number;
  category: string;
  amount: number;
  expense_date: string;
  description?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface SyncLog {
  id: number;
  table_name: string;
  record_id: number;
  sync_status: 'pending' | 'success' | 'failed';
  last_sync_at?: string;
  error_message?: string;
}
