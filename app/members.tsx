import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { MemberWithSubscription, SubscriptionStatus } from '../types/database';

type FilterType = 'all' | 'active' | 'expired';

export default function MembersScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  const [members, setMembers] = useState<MemberWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [filter]);

  useEffect(() => {
    if (searchQuery.trim()) {
      searchMembers();
    } else {
      loadMembers();
    }
  }, [searchQuery]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getMembersWithSubscriptions(filter === 'all' ? undefined : filter);
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const searchMembers = async () => {
    try {
      const data = await databaseService.searchMembers(
        searchQuery, 
        filter === 'all' ? undefined : filter
      );
      setMembers(data);
    } catch (error) {
      console.error('Error searching members:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const handleAddMember = () => {
    router.push('/add-member');
  };

  const handleRenew = (member: MemberWithSubscription) => {
    Alert.alert(
      'Renew Subscription',
      `Renew membership for ${member.first_name} ${member.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Renew', onPress: () => console.log('Renew:', member.id) }
      ]
    );
  };

  const handleAddPayment = (member: MemberWithSubscription) => {
    Alert.alert(
      'Add Payment',
      `Add payment for ${member.first_name} ${member.last_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => console.log('Payment:', member.id) }
      ]
    );
  };

  const getStatusColor = (status: SubscriptionStatus | null): string => {
    if (!status) return '#6b7280';
    switch (status) {
      case 'active': return '#10b981';
      case 'expired': return '#ef4444';
      case 'cancelled': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: SubscriptionStatus | null): string => {
    if (!status) return 'No Subscription';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderMemberItem = ({ item }: { item: MemberWithSubscription }) => (
    <View style={[styles.memberCard, isTablet && styles.tabletMemberCard]}>
      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text style={[styles.memberName, isTablet && styles.tabletMemberName]}>
            {item.first_name} {item.last_name}
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.subscription_status) }
          ]}>
            <Text style={[styles.statusText, isTablet && styles.tabletStatusText]}>
              {getStatusLabel(item.subscription_status)}
            </Text>
          </View>
        </View>

        <View style={styles.memberDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="cube-outline" size={isTablet ? 18 : 16} color="#6b7280" />
            <Text style={[styles.detailText, isTablet && styles.tabletDetailText]}>
              {item.package_name || 'No package'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={isTablet ? 18 : 16} color="#6b7280" />
            <Text style={[styles.detailText, isTablet && styles.tabletDetailText]}>
              Expires: {formatDate(item.subscription_end_date)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.renewButton, isTablet && styles.tabletActionButton]}
          onPress={() => handleRenew(item)}
        >
          <Ionicons name="refresh" size={isTablet ? 22 : 18} color="#fff" />
          <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
            Renew
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.paymentButton, isTablet && styles.tabletActionButton]}
          onPress={() => handleAddPayment(item)}
        >
          <Ionicons name="card" size={isTablet ? 22 : 18} color="#fff" />
          <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
            Payment
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Search Bar */}
      <View style={[styles.searchContainer, isTablet && styles.tabletSearchContainer]}>
        <Ionicons name="search" size={isTablet ? 24 : 20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, isTablet && styles.tabletSearchInput]}
          placeholder="Search members..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={isTablet ? 24 : 20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      <View style={[styles.filterContainer, isTablet && styles.tabletFilterContainer]}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            isTablet && styles.tabletFilterButton,
            filter === 'all' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('all')}
        >
          <Text style={[
            styles.filterText,
            isTablet && styles.tabletFilterText,
            filter === 'all' && styles.filterTextActive
          ]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            isTablet && styles.tabletFilterButton,
            filter === 'active' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('active')}
        >
          <Text style={[
            styles.filterText,
            isTablet && styles.tabletFilterText,
            filter === 'active' && styles.filterTextActive
          ]}>
            Active
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            isTablet && styles.tabletFilterButton,
            filter === 'expired' && styles.filterButtonActive
          ]}
          onPress={() => setFilter('expired')}
        >
          <Text style={[
            styles.filterText,
            isTablet && styles.tabletFilterText,
            filter === 'expired' && styles.filterTextActive
          ]}>
            Expired
          </Text>
        </TouchableOpacity>
      </View>

      {/* Members List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            isTablet && styles.tabletListContent
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No members found</Text>
            </View>
          }
        />
      )}

      {/* Floating Add Button */}
      <TouchableOpacity 
        style={[styles.fab, isTablet && styles.tabletFab]} 
        onPress={handleAddMember}
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
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabletSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  tabletSearchInput: {
    fontSize: 18,
  },
  
  // Filters
  filterContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabletFilterContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 16,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletFilterButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  filterButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  tabletFilterText: {
    fontSize: 16,
  },
  filterTextActive: {
    color: '#fff',
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tabletListContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  
  // Member Card
  memberCard: {
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
  tabletMemberCard: {
    padding: 20,
    marginBottom: 16,
    borderRadius: 16,
  },
  memberInfo: {
    marginBottom: 12,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  tabletMemberName: {
    fontSize: 22,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  memberDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletDetailText: {
    fontSize: 16,
  },
  
  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabletActionButton: {
    paddingVertical: 14,
    gap: 8,
  },
  renewButton: {
    backgroundColor: '#2563eb',
  },
  paymentButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tabletActionButtonText: {
    fontSize: 16,
  },
  
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
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

