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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { PaymentWithDetails, PaymentStatus, PaymentMethod } from '../types/database';

type DateFilter = 'all' | 'today' | 'this_month';
type StatusFilter = 'all' | 'completed' | 'pending';

export default function PaymentsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [total, setTotal] = useState(0);

  // Load payments when screen comes into focus or filters change
  useFocusEffect(
    React.useCallback(() => {
      loadPayments();
    }, [dateFilter, statusFilter])
  );

  const loadPayments = async () => {
    try {
      setLoading(true);
      const filter: any = {};
      
      if (dateFilter === 'today') {
        filter.dateFilter = 'today';
      } else if (dateFilter === 'this_month') {
        filter.dateFilter = 'this_month';
      }
      
      if (statusFilter !== 'all') {
        filter.statusFilter = statusFilter;
      }

      const data = await databaseService.getPaymentsWithDetails(filter);
      setPayments(data);
      
      // Calculate total
      const totalAmount = data.reduce((sum, payment) => sum + payment.amount, 0);
      setTotal(totalAmount);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
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
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'pending':
        return '#f59e0b';
      case 'failed':
        return '#ef4444';
      case 'refunded':
        return '#6b7280';
      default:
        return '#6b7280';
    }
  };

  const formatPaymentMethod = (method: PaymentMethod): string => {
    return method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderPaymentItem = ({ item }: { item: PaymentWithDetails }) => (
    <View style={[styles.paymentCard, isTablet && styles.tabletPaymentCard]}>
      <View style={styles.paymentHeader}>
        <View style={styles.memberInfo}>
          <Ionicons name="person" size={isTablet ? 20 : 18} color="#6b7280" />
          <Text style={[styles.memberName, isTablet && styles.tabletMemberName]}>
            {item.member_name}
          </Text>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) },
        ]}>
          <Text style={[styles.statusText, isTablet && styles.tabletStatusText]}>
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.paymentBody}>
        <View style={styles.paymentRow}>
          <View style={styles.paymentDetail}>
            <Ionicons name="cash-outline" size={isTablet ? 20 : 18} color="#2563eb" />
            <Text style={[styles.amountLabel, isTablet && styles.tabletAmountLabel]}>
              Amount
            </Text>
          </View>
          <Text style={[styles.amountValue, isTablet && styles.tabletAmountValue]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={styles.paymentRow}>
          <View style={styles.paymentDetail}>
            <Ionicons name="card-outline" size={isTablet ? 20 : 18} color="#6b7280" />
            <Text style={[styles.detailLabel, isTablet && styles.tabletDetailLabel]}>
              Method
            </Text>
          </View>
          <Text style={[styles.detailValue, isTablet && styles.tabletDetailValue]}>
            {formatPaymentMethod(item.payment_method)}
          </Text>
        </View>

        <View style={styles.paymentRow}>
          <View style={styles.paymentDetail}>
            <Ionicons name="calendar-outline" size={isTablet ? 20 : 18} color="#6b7280" />
            <Text style={[styles.detailLabel, isTablet && styles.tabletDetailLabel]}>
              Date
            </Text>
          </View>
          <Text style={[styles.detailValue, isTablet && styles.tabletDetailValue]}>
            {formatDate(item.payment_date)}
          </Text>
        </View>
      </View>
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

      {/* Total Section */}
      <View style={[styles.totalSection, isTablet && styles.tabletTotalSection]}>
        <View style={styles.totalContent}>
          <Text style={[styles.totalLabel, isTablet && styles.tabletTotalLabel]}>
            Total{dateFilter === 'today' ? ' Today' : dateFilter === 'this_month' ? ' This Month' : ''}
          </Text>
          <Text style={[styles.totalAmount, isTablet && styles.tabletTotalAmount]}>
            {formatCurrency(total)}
          </Text>
          <Text style={[styles.totalCount, isTablet && styles.tabletTotalCount]}>
            {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
          </Text>
        </View>
      </View>

      {/* Date Filters */}
      <View style={[styles.filterSection, isTablet && styles.tabletFilterSection]}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              dateFilter === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setDateFilter('all')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                dateFilter === 'all' && styles.filterTextActive,
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              dateFilter === 'today' && styles.filterButtonActive,
            ]}
            onPress={() => setDateFilter('today')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                dateFilter === 'today' && styles.filterTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              dateFilter === 'this_month' && styles.filterButtonActive,
            ]}
            onPress={() => setDateFilter('this_month')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                dateFilter === 'this_month' && styles.filterTextActive,
              ]}
            >
              This Month
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filters */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              statusFilter === 'all' && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                statusFilter === 'all' && styles.filterTextActive,
              ]}
            >
              All Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              statusFilter === 'completed' && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter('completed')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                statusFilter === 'completed' && styles.filterTextActive,
              ]}
            >
              Paid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterButton,
              isTablet && styles.tabletFilterButton,
              statusFilter === 'pending' && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text
              style={[
                styles.filterText,
                isTablet && styles.tabletFilterText,
                statusFilter === 'pending' && styles.filterTextActive,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Payments List */}
      <FlatList
        data={payments}
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

  // Total Section
  totalSection: {
    backgroundColor: '#2563eb',
    padding: 20,
    paddingBottom: 24,
  },
  tabletTotalSection: {
    padding: 28,
    paddingBottom: 32,
  },
  totalContent: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#bfdbfe',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabletTotalLabel: {
    fontSize: 16,
  },
  totalAmount: {
    fontSize: 40,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  tabletTotalAmount: {
    fontSize: 48,
  },
  totalCount: {
    fontSize: 14,
    color: '#bfdbfe',
  },
  tabletTotalCount: {
    fontSize: 16,
  },

  // Filter Section
  filterSection: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  tabletFilterSection: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  tabletFilterButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletFilterText: {
    fontSize: 15,
  },
  filterTextActive: {
    color: '#fff',
  },

  // Payment List
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabletListContent: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },
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
    padding: 20,
    borderRadius: 14,
    marginBottom: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletMemberName: {
    fontSize: 18,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  tabletStatusText: {
    fontSize: 13,
  },

  // Payment Body
  paymentBody: {
    gap: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563eb',
  },
  tabletAmountLabel: {
    fontSize: 16,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabletAmountValue: {
    fontSize: 20,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletDetailLabel: {
    fontSize: 16,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  tabletDetailValue: {
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
});

