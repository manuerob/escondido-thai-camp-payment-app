# Expense Categories Migration

## Overview
Converted expense categories from a JSON array stored in `app_settings.expense_categories` to a proper database table with full CRUD operations, soft-delete support, and cross-device sync.

## Changes Made

### 1. Database Schema (`schema.sql`)
- **Created `expense_categories` table** with:
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `name` (TEXT NOT NULL UNIQUE)
  - `created_at`, `updated_at`, `sync_status`, `deleted_at`
- **Inserted 8 default categories**: Equipment, Utilities, Rent, Supplies, Maintenance, Marketing, Staff, Other
- **Removed `expense_categories` field** from `app_settings` table
- **Added indexes**: `idx_expense_categories_name`, `idx_expense_categories_sync_status`
- **Added triggers**:
  - `update_expense_categories_updated_at` - Auto-update timestamp on changes
  - `reset_expense_categories_sync_status` - Mark as pending when changed

### 2. TypeScript Types (`types/database.ts`)
- **Added `ExpenseCategory` interface** extending `BaseEntity`:
  ```typescript
  export interface ExpenseCategory extends BaseEntity {
    name: string;
  }
  ```
- **Added input types**: `CreateExpenseCategoryInput`, `UpdateExpenseCategoryInput`
- **Updated `AppSettings` interface**: Removed `expense_categories` field
- **Updated `UpdateAppSettingsInput`**: Removed `expense_categories` parameter

### 3. Database Service (`services/database.service.ts`)
- **Added imports**: `ExpenseCategory`, `CreateExpenseCategoryInput`, `UpdateExpenseCategoryInput`
- **Updated `createTables()`**: Added `expense_categories` table creation with default data
- **Updated `updateAppSettings()`**: Removed `expense_categories` parameter handling
- **Updated `upsertSettingsFromRemote()`**: Removed `expense_categories` sync logic
- **Added CRUD methods**:
  - `findSoftDeletedExpenseCategory(name: string): Promise<ExpenseCategory | null>` - Find deleted category by name
  - `reactivateExpenseCategory(id: number): Promise<ExpenseCategory>` - Restore soft-deleted category
  - `createExpenseCategory(input: CreateExpenseCategoryInput): Promise<ExpenseCategory>` - Create new or reactivate deleted
  - `getAllExpenseCategories(includeDeleted?: boolean): Promise<ExpenseCategory[]>` - Get all categories
  - `updateExpenseCategory(id: number, input: UpdateExpenseCategoryInput): Promise<ExpenseCategory>` - Update category
  - `deleteExpenseCategory(id: number): Promise<void>` - Soft-delete category

### 4. Supabase Migration (`supabase/migrations/20260217000001_add_expense_categories_table.sql`)
- **Created `expense_categories` table** in Supabase (PostgreSQL)
- **Added trigger** for `updated_at` auto-update
- **Migrated existing data**: Extracts categories from `app_settings.expense_categories` JSONB and inserts as rows
- **Dropped `expense_categories` column** from `app_settings`
- **Added indexes** for performance

### 5. Sync Service (`services/supabase.service.ts`)
- **Added `expense_categories`** to `getSyncTables()` array for cross-device sync

### 6. Settings Screen (`app/settings.tsx`)
- **Updated imports**: Added `ExpenseCategory` type
- **Changed state type**: `categories` from `string[]` to `ExpenseCategory[]`
- **Changed `editingCategory` type**: From `string | null` to `ExpenseCategory | null`
- **Updated `loadData()`**: Loads categories from database table instead of JSON
- **Updated `handleSaveCategory()`**:
  - Calls `createExpenseCategory()` or `updateExpenseCategory()`
  - Detects and alerts when category is reactivated
  - Handles UNIQUE constraint errors
  - Reloads data after save
- **Updated `handleDeleteCategory()`**: Calls `deleteExpenseCategory()` with category ID
- **Updated `handleEditCategory()`**: Accepts `ExpenseCategory` instead of `string`
- **Updated render**: Uses `category.id` and `category.name` instead of string

### 7. Expenses Screen (`app/expenses.tsx`)
- **Updated `loadSettings()`**:
  - Calls `getAllExpenseCategories()` to load categories
  - Maps category objects to names array
  - Loads payment methods separately from `app_settings`

## Migration Path

### For Existing Users
1. **SQLite (Local)**:
   - `createTables()` in `database.service.ts` creates table with default categories
   - Uses `INSERT OR IGNORE` so existing data isn't duplicated
   - Old `expense_categories` JSON in `app_settings` is ignored (but not deleted for backward compatibility)

2. **Supabase (Cloud)**:
   - Migration script extracts categories from `app_settings.expense_categories` JSONB
   - Inserts each category as a row (with ON CONFLICT DO NOTHING)
   - Drops the `expense_categories` column from `app_settings`

### Data Integrity
- **Unique constraint** on `name` prevents duplicates
- **Soft-delete pattern** allows reactivation of previously deleted categories
- **Sync support** ensures categories sync across devices
- **Default categories** inserted automatically on fresh installs

## Features Gained

### Soft-Delete & Reactivation
- When a category is deleted, `deleted_at` timestamp is set
- Creating a category with the same name reactivates the deleted one
- Preserves category IDs and relationships with expenses
- User is notified when a category is reactivated

### Database Benefits
- **Proper IDs**: Each category has a unique ID
- **Timestamps**: Track creation and updates
- **Sync support**: Categories sync across devices via Supabase
- **Query performance**: Indexed for fast lookups
- **Referential integrity**: Can add foreign key relationships to expenses in future

### API Improvements
- Full CRUD operations instead of JSON array manipulation
- Type-safe with `ExpenseCategory` interface
- Consistent with other entities (packages, members, etc.)

## Testing Checklist

- [ ] Fresh install creates default categories
- [ ] Add new category
- [ ] Edit existing category
- [ ] Delete category (soft-delete)
- [ ] Recreate deleted category (reactivation detected)
- [ ] Duplicate category name shows error
- [ ] Categories sync across devices
- [ ] Categories load correctly in expenses screen
- [ ] Expense creation uses new category list

## Breaking Changes

### None for Users
- Migration is automatic
- Existing categories are preserved
- UI/UX remains identical

### For Developers
- `AppSettings.expense_categories` field removed from types
- `UpdateAppSettingsInput.expense_categories` parameter removed
- Category state type changed from `string[]` to `ExpenseCategory[]` in settings
- Category handlers now work with `ExpenseCategory` objects instead of strings

## Rollback Plan

If needed, can roll back by:
1. Reverting migration files
2. Adding `expense_categories` back to `app_settings`
3. Reverting code changes in `settings.tsx`, `expenses.tsx`, `database.service.ts`
4. Dropping `expense_categories` table

## Future Enhancements

- Add category icons/colors
- Add category descriptions
- Add category-specific budgets
- Track category usage statistics
- Allow custom sort order
- Category grouping/hierarchy
