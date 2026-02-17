import React, { useState, useEffect, useCallback } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import { useCurrency } from '../hooks';
import type { PaymentWithDetails, PaymentStatus, PaymentMethod } from '../types/database';
import { FilterBar, type FilterOption, type FilterGroup } from '../components/FilterBar';

const PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'pending', 'failed', 'refunded'];

type DateFilter = 'all' | 'today' | 'this_month';
type StatusFilter = 'all' | 'completed' | 'pending' | 'failed' | 'refunded';

export default function PaymentsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { formatCurrency, getCurrencySymbol } = useCurrency();

  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filtersLocked, setFiltersLocked] = useState(false);

  // Load payments when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset filters unless locked
      if (!filtersLocked) {
        setDateFilter('all');
        setStatusFilter('all');
      }
      loadPayments();
    }, [filtersLocked])
  );

  // Apply filters whenever payments or filters change
  useEffect(() => {
    applyFilters();
  }, [payments, dateFilter, statusFilter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getPaymentsWithDetails();
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...payments];

    // Apply date filter
    if (dateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      result = result.filter(payment => {
        const paymentDate = new Date(payment.payment_date);
        paymentDate.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          return paymentDate.getTime() === today.getTime();
        } else if (dateFilter === 'this_month') {
          return (
            paymentDate.getMonth() === today.getMonth() &&
            paymentDate.getFullYear() === today.getFullYear()
          );
        }
        return true;
      });
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(payment => payment.status === statusFilter);
    }

    setFilteredPayments(result);
  };

  const getTotalAmount = (): number => {
    return filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const handleMarkAsCompleted = async (paymentId: number, memberName: string) => {
    Alert.alert(
      'Confirm Payment',
      `Mark payment from ${memberName} as completed?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await databaseService.updatePayment(paymentId, { status: 'completed' });
              await loadPayments();
            } catch (error) {
              console.error('Error updating payment:', error);
              Alert.alert('Error', 'Failed to update payment status');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: PaymentStatus): string => {
    const colors: Record<PaymentStatus, string> = {
      'completed': '#10b981',
      'pending': '#f59e0b',
      'failed': '#ef4444',
      'refunded': '#6b7280',
    };
    return colors[status] || '#6b7280';
  };

  // Build filter options
  const dateFilterOptions: FilterOption[] = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today', icon: 'today' },
    { value: 'this_month', label: 'This Month', icon: 'calendar' },
  ];

  const statusFilterOptions: FilterOption[] = [
    { value: 'all', label: 'All Status' },
    { value: 'completed', label: 'Completed', color: getStatusColor('completed') },
    { value: 'pending', label: 'Pending', color: getStatusColor('pending') },
    { value: 'failed', label: 'Failed', color: getStatusColor('failed') },
    { value: 'refunded', label: 'Refunded', color: getStatusColor('refunded') },
  ];

  const filters: FilterGroup[] = [
    {
      id: 'date',
      label: 'Date Range',
      options: dateFilterOptions,
      activeValue: dateFilter,
      onChange: (value) => setDateFilter(value as DateFilter),
    },
    {
      id: 'status',
      label: 'Payment Status',
      options: statusFilterOptions,
      activeValue: statusFilter,
      onChange: (value) => setStatusFilter(value as StatusFilter),
    },
  ];

  const formatPaymentMethod = (method: PaymentMethod): string => {
    return method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getPaymentMethodIcon = (method: PaymentMethod): string => {
    const icons: Record<PaymentMethod, string> = {
      'cash': 'cash-outline',
      'card': 'card-outline',
      'bank_transfer': 'business-outline',
      'digital_wallet': 'phone-portrait-outline',
      'other': 'ellipsis-horizontal-circle-outline',
    };
    return icons[method] || 'ellipsis-horizontal-circle-outline';
  };

  const renderPaymentItem = ({ item }: { item: PaymentWithDetails }) => (
    <View style={[styles.paymentCard, isTablet && styles.tabletPaymentCard]}>
      <View style={styles.paymentHeader}>
        <View style={styles.titleContainer}>
          <Text style={[styles.memberName, isTablet && styles.tabletMemberName]}>
            {item.member_name}
          </Text>
          {item.package_name && (
            <Text style={[styles.packageName, isTablet && styles.tabletPackageName]}>
              {item.package_name}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={[styles.statusText, isTablet && styles.tabletStatusText]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={isTablet ? 20 : 18} color="#6b7280" />
          <Text style={[styles.detailText, isTablet && styles.tabletDetailText]}>
            {formatDate(item.payment_date)}
          </Text>
        </View>

        <View style={styles.detailRow}>

          <View style={styles.amountContainer}>
            {item.discount_amount && item.discount_amount > 0 && (
              <Text style={[styles.discountBadge, isTablet && styles.tabletDiscountBadge]}>
                -{item.discount_amount}{item.discount_type}
              </Text>
            )}
                      <Ionicons 
            name={getPaymentMethodIcon(item.payment_method) as any} 
            size={isTablet ? 20 : 18} 
            color="#6b7280" 
          />
            <Text style={[styles.amount, isTablet && styles.tabletAmount]}>
              {formatCurrency(item.amount)}
            </Text>
          </View>
        </View>
      </View>

      {/* Mark as Completed Button for Pending Payments */}
      {item.status === 'pending' && (
        <TouchableOpacity
          style={[styles.completeButton, isTablet && styles.tabletCompleteButton]}
          onPress={() => handleMarkAsCompleted(item.id, item.member_name)}
        >
          <Ionicons name="checkmark-circle-outline" size={isTablet ? 22 : 20} color="#10b981" />
          <Text style={[styles.completeButtonText, isTablet && styles.tabletCompleteButtonText]}>
            Mark as Completed
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color="#d1d5db" />
      <Text style={[styles.emptyText, isTablet && styles.tabletEmptyText]}>
        No payments found
      </Text>
      <Text style={[styles.emptySubtext, isTablet && styles.tabletEmptySubtext]}>
        Payments will appear here once recorded
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

      {/* Filters */}
      <FilterBar 
        filters={filters}
        isLocked={filtersLocked}
        onToggleLock={() => setFiltersLocked(!filtersLocked)}
      />

      {/* Total Display */}
      {filteredPayments.length > 0 && (
        <View style={[styles.totalContainer, isTablet && styles.tabletTotalContainer]}>
          <Text style={[styles.totalLabel, isTablet && styles.tabletTotalLabel]}>Total:</Text>
          <Text style={[styles.totalAmount, isTablet && styles.tabletTotalAmount]}>
            {formatCurrency(getTotalAmount())}
          </Text>
          <Text style={[styles.totalCount, isTablet && styles.tabletTotalCount]}>
            ({filteredPayments.length} {filteredPayments.length === 1 ? 'payment' : 'payments'})
          </Text>
        </View>
      )}

      <FlatList
        data={filteredPayments}
        renderItem={renderPaymentItem}
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

  // Total Container
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#eff6ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    gap: 8,
  },
  tabletTotalContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletTotalLabel: {
    fontSize: 16,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabletTotalAmount: {
    fontSize: 22,
  },
  totalCount: {
    fontSize: 13,
    color: '#6b7280',
  },
  tabletTotalCount: {
    fontSize: 15,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  tabletListContent: {
    padding: 24,
    paddingBottom: 48,
  },

  // Payment Card
  paymentCard: {
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
  tabletPaymentCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },

  // Payment Header
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  memberName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletMemberName: {
    fontSize: 20,
  },
  packageName: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletPackageName: {
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  tabletStatusText: {
    fontSize: 14,
  },

  // Payment Details
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletAmount: {
    fontSize: 22,
  },
  discountBadge: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabletDiscountBadge: {
    fontSize: 15,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  detailText: {
    fontSize: 15,
    color: '#6b7280',
  },
  tabletDetailText: {
    fontSize: 17,
  },

  // Complete Button
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  tabletCompleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    borderRadius: 10,
  },
  completeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10b981',
  },
  tabletCompleteButtonText: {
    fontSize: 17,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: 16,
    marginBottom: 8,
  },
  tabletEmptyText: {
    fontSize: 22,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
    textAlign: 'center',
  },
  tabletEmptySubtext: {
    fontSize: 16,
  },
});
