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
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import { useCurrency } from '../hooks';
import type { PaymentWithDetails, PaymentStatus, PaymentMethod } from '../types/database';

type DateFilter = 'all' | 'today' | 'this_month';
type StatusFilter = 'all' | 'completed' | 'pending' | 'failed' | 'refunded';

export default function PaymentsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { formatCurrency } = useCurrency();

  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Load payments when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadPayments();
    }, [])
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

  const formatPaymentMethod = (method: PaymentMethod): string => {
    return method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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
          <Ionicons name="cash-outline" size={isTablet ? 20 : 18} color="#1f2937" />
          <Text style={[styles.amount, isTablet && styles.tabletAmount]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="card-outline" size={isTablet ? 20 : 18} color="#6b7280" />
          <Text style={[styles.detailText, isTablet && styles.tabletDetailText]}>
            {formatPaymentMethod(item.payment_method)}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={isTablet ? 20 : 18} color="#6b7280" />
          <Text style={[styles.detailText, isTablet && styles.tabletDetailText]}>
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

      {/* Date Filter Chips */}
      <View style={[styles.filterContainer, isTablet && styles.tabletFilterContainer]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              dateFilter === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setDateFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                dateFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              dateFilter === 'today' && styles.filterChipActive,
            ]}
            onPress={() => setDateFilter('today')}
          >
            <Ionicons
              name="today"
              size={16}
              color={dateFilter === 'today' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                dateFilter === 'today' && styles.filterChipTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              dateFilter === 'this_month' && styles.filterChipActive,
            ]}
            onPress={() => setDateFilter('this_month')}
          >
            <Ionicons
              name="calendar"
              size={16}
              color={dateFilter === 'this_month' ? '#2563eb' : '#6b7280'}
            />
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                dateFilter === 'this_month' && styles.filterChipTextActive,
              ]}
            >
              This Month
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Status Filter Chips */}
      <View style={[styles.filterContainer, isTablet && styles.tabletFilterContainer]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              statusFilter === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                statusFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All Status
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              statusFilter === 'completed' && styles.filterChipActive,
              statusFilter === 'completed' && { backgroundColor: getStatusColor('completed'), borderColor: getStatusColor('completed') },
            ]}
            onPress={() => setStatusFilter('completed')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                statusFilter === 'completed' && styles.filterChipTextActive,
              ]}
            >
              Completed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              statusFilter === 'pending' && styles.filterChipActive,
              statusFilter === 'pending' && { backgroundColor: getStatusColor('pending'), borderColor: getStatusColor('pending') },
            ]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                statusFilter === 'pending' && styles.filterChipTextActive,
              ]}
            >
              Pending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              isTablet && styles.tabletFilterChip,
              statusFilter === 'failed' && styles.filterChipActive,
              statusFilter === 'failed' && { backgroundColor: getStatusColor('failed'), borderColor: getStatusColor('failed') },
            ]}
            onPress={() => setStatusFilter('failed')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                statusFilter === 'failed' && styles.filterChipTextActive,
              ]}
            >
              Failed
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

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

  // Filter Container
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabletFilterContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  filterScroll: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletFilterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletFilterChipText: {
    fontSize: 16,
  },
  filterChipTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },

  // Total Container
  totalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  tabletTotalContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabletTotalLabel: {
    fontSize: 16,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletTotalAmount: {
    fontSize: 22,
  },
  totalCount: {
    fontSize: 13,
    color: '#9ca3af',
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
    gap: 8,
  },
  detailRow: {
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
  detailText: {
    fontSize: 15,
    color: '#6b7280',
  },
  tabletDetailText: {
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
