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
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { MemberWithSubscription, SubscriptionStatus, Package, PaymentMethod, PaymentStatus } from '../types/database';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'digital_wallet'];
const PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'pending'];

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

  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  
  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  
  // Package/payment state
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('completed');
  
  const [saving, setSaving] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Load members when screen comes into focus or filter/search changes
  useFocusEffect(
    React.useCallback(() => {
      if (searchQuery.trim()) {
        searchMembers();
      } else {
        loadMembers();
      }
    }, [filter, searchQuery])
  );

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

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      const data = await databaseService.getActivePackages();
      setPackages(data);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleAddMember = () => {
    // Reset form
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setInstagram('');
    setSelectedPackageId(null);
    setPaymentMethod('cash');
    setPaymentStatus('completed');
    
    // Load packages and show modal
    loadPackages();
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required');
      return;
    }

    try {
      setSaving(true);

      // 1. Create member
      const member = await databaseService.createMember({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        instagram: instagram.trim() || undefined,
      });

      // 2. Create subscription if package selected
      if (selectedPackageId) {
        const selectedPackage = packages.find(p => p.id === selectedPackageId);
        if (selectedPackage) {
          const startDate = new Date().toISOString();
          const endDate = new Date(Date.now() + selectedPackage.duration_days * 24 * 60 * 60 * 1000).toISOString();

          const subscription = await databaseService.createSubscription({
            member_id: member.id,
            package_id: selectedPackageId,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            sessions_remaining: selectedPackage.sessions_included || undefined,
            auto_renew: false,
          });

          // 3. Create payment record
          await databaseService.createPayment({
            member_id: member.id,
            subscription_id: subscription.id,
            amount: selectedPackage.price,
            payment_date: new Date().toISOString(),
            payment_method: paymentMethod,
            status: paymentStatus,
          });
        }
      }

      Alert.alert('Success', 'Member added successfully');
      handleCloseModal();
      loadMembers(); // Refresh list
    } catch (error) {
      console.error('Error saving member:', error);
      Alert.alert('Error', 'Failed to save member');
    } finally {
      setSaving(false);
    }
  };

  const formatPaymentMethod = (method: PaymentMethod): string => {
    const labels: Record<PaymentMethod, string> = {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
      digital_wallet: 'Digital Wallet',
      other: 'Other',
    };
    return labels[method];
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
    <TouchableOpacity 
      style={[styles.memberCard, isTablet && styles.tabletMemberCard]}
      onPress={() => router.push(`/member-detail?id=${item.id}`)}
      activeOpacity={0.7}
    >
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
          onPress={(e) => {
            e.stopPropagation();
            handleRenew(item);
          }}
        >
          <Ionicons name="refresh" size={isTablet ? 22 : 18} color="#fff" />
          <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
            Renew
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.paymentButton, isTablet && styles.tabletActionButton]}
          onPress={(e) => {
            e.stopPropagation();
            handleAddPayment(item);
          }}
        >
          <Ionicons name="card" size={isTablet ? 22 : 18} color="#fff" />
          <Text style={[styles.actionButtonText, isTablet && styles.tabletActionButtonText]}>
            Payment
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
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

      {/* Add Member Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1}
            onPress={handleCloseModal}
          />
          <View style={[styles.modalCard, isTablet && styles.tabletModalCard]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseModal} style={styles.backButton}>
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                Add Member
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Member Information Section */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>
                Member Information
              </Text>

              {/* Name Row */}
              <View style={styles.row}>
                <View style={[styles.formSection, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                    First Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, isTablet && styles.tabletInput]}
                    placeholder="First name"
                    placeholderTextColor="#9ca3af"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>

                <View style={[styles.formSection, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                    Last Name <Text style={styles.required}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.input, isTablet && styles.tabletInput]}
                    placeholder="Last name"
                    placeholderTextColor="#9ca3af"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              {/* Contact Fields */}
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Phone</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  placeholder="Phone number"
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Email</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  placeholder="Email address"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Instagram</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  placeholder="@username"
                  placeholderTextColor="#9ca3af"
                  value={instagram}
                  onChangeText={setInstagram}
                  autoCapitalize="none"
                />
              </View>

              {/* Package Selection Section */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                Package (Optional)
              </Text>

              {loadingPackages ? (
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 20 }} />
              ) : packages.length === 0 ? (
                <Text style={styles.noPackagesText}>No packages available</Text>
              ) : (
                <View style={styles.packageList}>
                  {packages.map((pkg) => (
                    <TouchableOpacity
                      key={pkg.id}
                      style={[
                        styles.packageCard,
                        isTablet && styles.tabletPackageCard,
                        selectedPackageId === pkg.id && styles.packageCardSelected,
                      ]}
                      onPress={() => setSelectedPackageId(selectedPackageId === pkg.id ? null : pkg.id)}
                    >
                      <View style={styles.packageHeader}>
                        <Text style={[styles.packageName, isTablet && styles.tabletPackageName]}>
                          {pkg.name}
                        </Text>
                        <Text style={[styles.packagePrice, isTablet && styles.tabletPackagePrice]}>
                          ฿{pkg.price.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={[styles.packageDetails, isTablet && styles.tabletPackageDetails]}>
                        {pkg.duration_days} days{pkg.sessions_included ? ` • ${pkg.sessions_included} sessions` : ''}
                      </Text>
                      {selectedPackageId === pkg.id && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Payment Details (if package selected) */}
              {selectedPackageId && (
                <>
                  <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                    Payment Details
                  </Text>

                  <View style={styles.formSection}>
                    <Text style={[styles.label, isTablet && styles.tabletLabel]}>Payment Method</Text>
                    <View style={styles.paymentMethodGrid}>
                      {PAYMENT_METHODS.map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.paymentMethodButton,
                            isTablet && styles.tabletPaymentMethodButton,
                            paymentMethod === method && styles.paymentMethodButtonActive,
                          ]}
                          onPress={() => setPaymentMethod(method)}
                        >
                          <Ionicons
                            name={
                              method === 'cash' ? 'cash-outline' :
                              method === 'card' ? 'card-outline' :
                              method === 'bank_transfer' ? 'business-outline' :
                              'phone-portrait-outline'
                            }
                            size={isTablet ? 22 : 20}
                            color={paymentMethod === method ? '#2563eb' : '#6b7280'}
                          />
                          <Text
                            style={[
                              styles.paymentMethodText,
                              isTablet && styles.tabletPaymentMethodText,
                              paymentMethod === method && styles.paymentMethodTextActive,
                            ]}
                          >
                            {formatPaymentMethod(method)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.formSection}>
                    <Text style={[styles.label, isTablet && styles.tabletLabel]}>Payment Status</Text>
                    <View style={styles.paymentStatusRow}>
                      {PAYMENT_STATUSES.map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.statusButton,
                            isTablet && styles.tabletStatusButton,
                            paymentStatus === status && styles.statusButtonActive,
                          ]}
                          onPress={() => setPaymentStatus(status)}
                        >
                          <Text
                            style={[
                              styles.statusButtonText,
                              isTablet && styles.tabletStatusButtonText,
                              paymentStatus === status && styles.statusButtonTextActive,
                            ]}
                          >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isTablet && styles.tabletSaveButton,
                  saving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={isTablet ? 24 : 20} color="#fff" />
                    <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                      Save Member
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Modal Overlay
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  tabletModalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },

  // Modal Header
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletModalTitle: {
    fontSize: 24,
  },

  // Modal Content
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  tabletSectionTitle: {
    fontSize: 18,
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  formSection: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  tabletLabel: {
    fontSize: 16,
  },
  required: {
    color: '#dc2626',
  },

  // Input Fields
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  tabletInput: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    borderRadius: 14,
  },

  // Package Selection
  noPackagesText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  packageList: {
    gap: 12,
  },
  packageCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    position: 'relative',
  },
  tabletPackageCard: {
    padding: 20,
    borderRadius: 14,
  },
  packageCardSelected: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletPackageName: {
    fontSize: 18,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabletPackagePrice: {
    fontSize: 20,
  },
  packageDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletPackageDetails: {
    fontSize: 16,
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // Payment Method Selection
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  paymentMethodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tabletPaymentMethodButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  paymentMethodButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  paymentMethodText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletPaymentMethodText: {
    fontSize: 16,
  },
  paymentMethodTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },

  // Payment Status Selection
  paymentStatusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statusButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  tabletStatusButton: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  statusButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletStatusButtonText: {
    fontSize: 16,
  },
  statusButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  tabletSaveButton: {
    paddingVertical: 18,
    borderRadius: 14,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tabletSaveButtonText: {
    fontSize: 18,
  },
});

