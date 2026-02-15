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
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  address: string | null;
  emergency_contact: string | null;
  notes: string | null;
}

export interface CreateMemberInput {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  instagram?: string;
  address?: string;
  emergency_contact?: string;
  notes?: string;
}

export interface UpdateMemberInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  instagram?: string;
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
  package_name?: string;
  package_price?: number;
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
  payment_method: PaymentMethod;
  vendor: string | null;
  description: string | null;
  receipt_url: string | null;
}

export interface CreateExpenseInput {
  category: string;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  vendor?: string;
  description?: string;
  receipt_url?: string;
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
// TODO INTERFACE
// ============================================

export interface Todo extends BaseEntity {
  title: string;
  is_checked: boolean;
  completed_at: string | null;
  is_archived: boolean;
}

export interface CreateTodoInput {
  title: string;
  is_checked?: boolean;
  is_archived?: boolean;
}

export interface UpdateTodoInput {
  title?: string;
  is_checked?: boolean;
  is_archived?: boolean;
}

// ============================================
// SCHEDULE BLOCK INTERFACE
// ============================================

export type RepeatType = 'daily' | 'weekly' | 'custom';
export type CustomRepeatFrequency = 'daily' | 'weekly';

export interface ScheduleBlock extends BaseEntity {
  day_of_week: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  specific_date: string | null; // For one-time blocks; if set, overrides day_of_week recurrence
  start_time: string; // Format: "HH:MM"
  end_time: string; // Format: "HH:MM"
  title: string;
  description: string | null;
  color: string | null;
}

export interface CreateScheduleBlockInput {
  day_of_week: number;
  specific_date?: string;
  start_time: string;
  end_time: string;
  title: string;
  description?: string;
  color?: string;
}

export interface UpdateScheduleBlockInput {
  day_of_week?: number;
  specific_date?: string;
  start_time?: string;
  end_time?: string;
  title?: string;
  description?: string;
  color?: string;
}

// ============================================
// PARTICIPATION INTERFACE
// ============================================

export interface Participation extends BaseEntity {
  schedule_block_id: number;
  participation_date: string; // Format: "YYYY-MM-DD"
  participants_count: number;
}

export interface CreateParticipationInput {
  schedule_block_id: number;
  participation_date: string;
  participants_count: number;
}

export interface UpdateParticipationInput {
  participants_count?: number;
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
// MEMBER WITH SUBSCRIPTION
// ============================================

export interface MemberWithSubscription extends Member {
  subscription_id: number | null;
  subscription_status: SubscriptionStatus | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  package_id: number | null;
  package_name: string | null;
  package_price: number | null;
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
