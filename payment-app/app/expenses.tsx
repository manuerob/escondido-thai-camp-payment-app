import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { Expense } from '../types/database';

export default function ExpensesScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load expenses when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadExpenses();
    }, [])
  );

  const loadExpenses = async () => {
    try {
      setLoading(true);
      console.log('Loading expenses...');
      const data = await databaseService.getExpensesByDateRange({});
      console.log('Expenses loaded:', data.length, 'items');
      setExpenses(data);
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const handleAddExpense = () => {
    router.push('/add-expense');
  };

  const formatCurrency = (amount: number): string => {
    return `฿${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'Equipment': '#3b82f6',
      'Utilities': '#f59e0b',
      'Rent': '#8b5cf6',
      'Supplies': '#10b981',
      'Maintenance': '#ef4444',
      'Marketing': '#ec4899',
      'Staff': '#06b6d4',
    };
    return colors[category] || '#6b7280';
  };

  const renderExpenseItem = ({ item }: { item: Expense }) => (
    <View style={[styles.expenseCard, isTablet && styles.tabletExpenseCard]}>
      <View style={styles.expenseHeader}>
        <View style={styles.titleContainer}>
          <Text style={[styles.expenseTitle, isTablet && styles.tabletExpenseTitle]}>
            {item.description || 'Expense'}
          </Text>
          {item.vendor && (
            <Text style={[styles.vendor, isTablet && styles.tabletVendor]}>
              {item.vendor}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: getCategoryColor(item.category) },
          ]}
        >
          <Text style={[styles.categoryText, isTablet && styles.tabletCategoryText]}>
            {item.category}
          </Text>
        </View>
      </View>

      <View style={styles.expenseDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={isTablet ? 20 : 18} color="#1f2937" />
          <Text style={[styles.amount, isTablet && styles.tabletAmount]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={isTablet ? 20 : 18} color="#6b7280" />
          <Text style={[styles.date, isTablet && styles.tabletDate]}>
            {formatDate(item.expense_date)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
      <Text style={[styles.emptyText, isTablet && styles.tabletEmptyText]}>
        No expenses recorded
      </Text>
      <Text style={[styles.emptySubtext, isTablet && styles.tabletEmptySubtext]}>
        Tap the + button to add an expense
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.listContent,
          isTablet && styles.tabletListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={[styles.fab, isTablet && styles.tabletFab]}
        onPress={handleAddExpense}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={isTablet ? 32 : 28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  tabletListContent: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 100,
  },

  // Expense Card
  expenseCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabletExpenseCard: {
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
  },

  // Header
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletExpenseTitle: {
    fontSize: 18,
  },
  vendor: {
    fontSize: 13,
    color: '#6b7280',
  },
  tabletVendor: {
    fontSize: 15,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  tabletCategoryText: {
    fontSize: 13,
  },

  // Details
  expenseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletAmount: {
    fontSize: 18,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletDate: {
    fontSize: 16,
  },

  // Empty State
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  tabletEmptyText: {
    fontSize: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  tabletEmptySubtext: {
    fontSize: 16,
  },

  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabletFab: {
    right: 32,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
  },
});
