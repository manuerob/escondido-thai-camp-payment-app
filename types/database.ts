// Database Types

// ============================================
// TYPE DEFINITIONS
// ============================================

export type SyncStatus = 'pending' | 'synced';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'digital_wallet' | 'other';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

// ============================================
// BASE INTERFACE
// ============================================

export interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
  deleted_at: string | null;
}

// ============================================
// MEMBER INTERFACE
// ============================================

export interface Member extends BaseEntity {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
}

export interface CreateMemberInput {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  notes?: string;
}

export interface UpdateMemberInput {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  notes?: string;
}

// ============================================
// PACKAGE INTERFACE
// ============================================

export interface Package extends BaseEntity {
  name: string;
  description: string | null;
  price: number;
  duration_days: number;
  sessions_included: number | null;
  is_active: boolean;
}

export interface CreatePackageInput {
  name: string;
  description?: string;
  price: number;
  duration_days: number;
  sessions_included?: number;
  is_active?: boolean;
}

export interface UpdatePackageInput {
  name?: string;
  description?: string;
  price?: number;
  duration_days?: number;
  sessions_included?: number;
  is_active?: boolean;
}

// ============================================
// SUBSCRIPTION INTERFACE
// ============================================

export interface Subscription extends BaseEntity {
  member_id: number;
  package_id: number;
  start_date: string;
  end_date: string;
  status: SubscriptionStatus;
  sessions_remaining: number | null;
  auto_renew: boolean;
  notes: string | null;
}

export interface CreateSubscriptionInput {
  member_id: number;
  package_id: number;
  start_date: string;
  end_date: string;
  status?: SubscriptionStatus;
  sessions_remaining?: number;
  auto_renew?: boolean;
  notes?: string;
}

export interface UpdateSubscriptionInput {
  member_id?: number;
  package_id?: number;
  start_date?: string;
  end_date?: string;
  status?: SubscriptionStatus;
  sessions_remaining?: number;
  auto_renew?: boolean;
  notes?: string;
}

// ============================================
// PAYMENT INTERFACE
// ============================================

export interface Payment extends BaseEntity {
  member_id: number;
  subscription_id: number | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  transaction_ref: string | null;
  status: PaymentStatus;
  notes: string | null;
}

export interface CreatePaymentInput {
  member_id: number;
  subscription_id?: number;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  transaction_ref?: string;
  status?: PaymentStatus;
  notes?: string;
}

export interface UpdatePaymentInput {
  member_id?: number;
  subscription_id?: number;
  amount?: number;
  payment_date?: string;
  payment_method?: PaymentMethod;
  transaction_ref?: string;
  status?: PaymentStatus;
  notes?: string;
}

// ============================================
// EXPENSE INTERFACE
// ============================================

export interface Expense extends BaseEntity {
  category: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
  payment_method: PaymentMethod | null;
}

export interface CreateExpenseInput {
  category: string;
  amount: number;
  expense_date: string;
  vendor?: string;
  description?: string;
  receipt_url?: string;
  payment_method?: PaymentMethod;
}

export interface UpdateExpenseInput {
  category?: string;
  amount?: number;
  expense_date?: string;
  vendor?: string;
  description?: string;
  receipt_url?: string;
  payment_method?: PaymentMethod;
}

// ============================================
// JOINED DATA INTERFACES
// ============================================

export interface SubscriptionWithDetails extends Subscription {
  member_name: string;
  member_email: string;
  package_name: string;
  package_price: number;
}

export interface PaymentWithDetails extends Payment {
  member_name: string;
  member_email: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  package_name?: string;
}

// ============================================
// UTILITY TYPES
// ============================================

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface DateRangeFilter {
  start_date?: string;
  end_date?: string;
}

export interface SyncResult {
  table: string;
  synced_count: number;
  failed_count: number;
  errors: Array<{ id: number; error: string }>;
}
