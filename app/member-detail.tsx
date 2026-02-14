import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { Member, Subscription, Payment, SubscriptionStatus } from '../types/database';

export default function MemberDetailScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const params = useLocalSearchParams();
  const memberId = Number(params.id);

  const [member, setMember] = useState<Member | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [subscriptionHistory, setSubscriptionHistory] = useState<Subscription[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load member data when screen comes into focus or member ID changes
  useFocusEffect(
    React.useCallback(() => {
      loadMemberData();
    }, [memberId])
  );

  const loadMemberData = async () => {
    try {
      setLoading(true);

      const [memberData, subscriptions, payments] = await Promise.all([
        databaseService.getMemberById(memberId),
        databaseService.getSubscriptionsByMember(memberId),
        databaseService.getPaymentsByMember(memberId),
      ]);

      if (!memberData) {
        Alert.alert('Error', 'Member not found', [
          { text: 'OK', onPress: () => router.back() }
        ]);
        return;
      }

      setMember(memberData);
      
      // Find active subscription
      const active = subscriptions.find(s => s.status === 'active');
      setCurrentSubscription(active || null);
      
      setSubscriptionHistory(subscriptions);
      setPaymentHistory(payments);
    } catch (error) {
      console.error('Error loading member data:', error);
      Alert.alert('Error', 'Failed to load member details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMemberData();
    setRefreshing(false);
  };

  const handleRenew = () => {
    Alert.alert('Renew Subscription', 'Renew flow coming soon');
  };

  const handleAddPayment = () => {
    Alert.alert('Add Payment', 'Payment flow coming soon');
  };

  const getDaysRemaining = (): number | null => {
    if (!currentSubscription) return null;
    const endDate = new Date(currentSubscription.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: SubscriptionStatus): string => {
    switch (status) {
      case 'active': return '#10b981';
      case 'expired': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount: number): string => {
    return `฿${amount.toFixed(2)}`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!member) {
    return null;
  }

  const daysRemaining = getDaysRemaining();

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={[styles.header, isTablet && styles.tabletHeader]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isTablet && styles.tabletHeaderTitle]}>
          Member Details
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.tabletScrollContent
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Member Info Card */}
        <View style={[styles.card, isTablet && styles.tabletCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="person" size={isTablet ? 28 : 24} color="#2563eb" />
            <Text style={[styles.cardTitle, isTablet && styles.tabletCardTitle]}>
              Member Information
            </Text>
          </View>
          
          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Name</Text>
              <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                {member.first_name} {member.last_name}
              </Text>
            </View>

            {member.phone && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Phone</Text>
                <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                  {member.phone}
                </Text>
              </View>
            )}

            {member.email && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Email</Text>
                <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                  {member.email}
                </Text>
              </View>
            )}

            {member.instagram && (
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Instagram</Text>
                <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                  {member.instagram}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Member Since</Text>
              <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                {formatDate(member.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Subscription Card */}
        <View style={[styles.card, isTablet && styles.tabletCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={isTablet ? 28 : 24} color="#2563eb" />
            <Text style={[styles.cardTitle, isTablet && styles.tabletCardTitle]}>
              Current Subscription
            </Text>
          </View>

          {currentSubscription ? (
            <>
              <View style={styles.subscriptionInfo}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(currentSubscription.status) }
                ]}>
                  <Text style={[styles.statusText, isTablet && styles.tabletStatusText]}>
                    {currentSubscription.status.toUpperCase()}
                  </Text>
                </View>

                {daysRemaining !== null && (
                  <View style={[
                    styles.daysRemainingBadge,
                    daysRemaining <= 7 && styles.daysRemainingWarning
                  ]}>
                    <Ionicons 
                      name="time-outline" 
                      size={isTablet ? 20 : 16} 
                      color={daysRemaining <= 7 ? '#ea580c' : '#10b981'} 
                    />
                    <Text style={[
                      styles.daysRemainingText,
                      isTablet && styles.tabletDaysRemainingText,
                      daysRemaining <= 7 && styles.daysRemainingTextWarning
                    ]}>
                      {daysRemaining} days left
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>Start Date</Text>
                  <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                    {formatDate(currentSubscription.start_date)}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>End Date</Text>
                  <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                    {formatDate(currentSubscription.end_date)}
                  </Text>
                </View>

                {currentSubscription.sessions_remaining !== null && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, isTablet && styles.tabletInfoLabel]}>
                      Sessions Remaining
                    </Text>
                    <Text style={[styles.infoValue, isTablet && styles.tabletInfoValue]}>
                      {currentSubscription.sessions_remaining}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.renewButton, isTablet && styles.tabletActionButton]}
                  onPress={handleRenew}
                >
                  <Ionicons name="refresh" size={isTablet ? 24 : 20} color="#fff" />
                  <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
                    Renew Subscription
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.paymentButton, isTablet && styles.tabletActionButton]}
                  onPress={handleAddPayment}
                >
                  <Ionicons name="card" size={isTablet ? 24 : 20} color="#fff" />
                  <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
                    Add Payment
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={[styles.emptyText, isTablet && styles.tabletEmptyText]}>
                No active subscription
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.renewButton, { marginTop: 16 }]}
                onPress={handleRenew}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Create Subscription</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Subscription History */}
        <View style={[styles.card, isTablet && styles.tabletCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="time" size={isTablet ? 28 : 24} color="#2563eb" />
            <Text style={[styles.cardTitle, isTablet && styles.tabletCardTitle]}>
              Subscription History
            </Text>
          </View>

          {subscriptionHistory.length > 0 ? (
            <View style={styles.historyList}>
              {subscriptionHistory.map((sub) => (
                <View key={sub.id} style={[styles.historyItem, isTablet && styles.tabletHistoryItem]}>
                  <View style={styles.historyItemHeader}>
                    <View style={[
                      styles.historyStatusBadge,
                      { backgroundColor: getStatusColor(sub.status) }
                    ]}>
                      <Text style={styles.historyStatusText}>
                        {sub.status}
                      </Text>
                    </View>
                    <Text style={[styles.historyDate, isTablet && styles.tabletHistoryDate]}>
                      {formatDate(sub.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.historyDetail, isTablet && styles.tabletHistoryDetail]}>
                    {formatDate(sub.start_date)} - {formatDate(sub.end_date)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isTablet && styles.tabletEmptyText]}>
                No subscription history
              </Text>
            </View>
          )}
        </View>

        {/* Payment History */}
        <View style={[styles.card, isTablet && styles.tabletCard]}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={isTablet ? 28 : 24} color="#2563eb" />
            <Text style={[styles.cardTitle, isTablet && styles.tabletCardTitle]}>
              Payment History
            </Text>
          </View>

          {paymentHistory.length > 0 ? (
            <View style={styles.historyList}>
              {paymentHistory.map((payment) => (
                <View key={payment.id} style={[styles.historyItem, isTablet && styles.tabletHistoryItem]}>
                  <View style={styles.historyItemHeader}>
                    <Text style={[styles.paymentAmount, isTablet && styles.tabletPaymentAmount]}>
                      {formatCurrency(payment.amount)}
                    </Text>
                    <Text style={[styles.historyDate, isTablet && styles.tabletHistoryDate]}>
                      {formatDate(payment.payment_date)}
                    </Text>
                  </View>
                  <View style={styles.paymentDetails}>
                    <Text style={[styles.paymentMethod, isTablet && styles.tabletPaymentMethod]}>
                      {payment.payment_method.replace('_', ' ')}
                    </Text>
                    <View style={[
                      styles.paymentStatusBadge,
                      { backgroundColor: payment.status === 'completed' ? '#10b981' : '#f59e0b' }
                    ]}>
                      <Text style={styles.paymentStatusText}>
                        {payment.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, isTablet && styles.tabletEmptyText]}>
                No payment history
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabletHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletHeaderTitle: {
    fontSize: 24,
  },

  // Scroll Content
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabletScrollContent: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabletCard: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletCardTitle: {
    fontSize: 22,
  },

  // Info Grid
  infoGrid: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletInfoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  tabletInfoValue: {
    fontSize: 16,
  },

  // Subscription Info
  subscriptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tabletStatusText: {
    fontSize: 14,
  },
  daysRemainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
  },
  daysRemainingWarning: {
    backgroundColor: '#fed7aa',
  },
  daysRemainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  tabletDaysRemainingText: {
    fontSize: 16,
  },
  daysRemainingTextWarning: {
    color: '#ea580c',
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  tabletActionButton: {
    paddingVertical: 18,
  },
  renewButton: {
    backgroundColor: '#2563eb',
  },
  paymentButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  tabletActionButtonText: {
    fontSize: 17,
  },

  // History
  historyList: {
    gap: 12,
  },
  historyItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  tabletHistoryItem: {
    padding: 16,
    borderRadius: 10,
  },
  historyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },
  historyDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  tabletHistoryDate: {
    fontSize: 14,
  },
  historyDetail: {
    fontSize: 13,
    color: '#374151',
  },
  tabletHistoryDetail: {
    fontSize: 15,
  },

  // Payment History
  paymentAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletPaymentAmount: {
    fontSize: 18,
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethod: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  tabletPaymentMethod: {
    fontSize: 15,
  },
  paymentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'capitalize',
  },

  // Empty State
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  tabletEmptyText: {
    fontSize: 16,
  },
});
