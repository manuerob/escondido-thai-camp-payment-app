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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import { useCurrency } from '../hooks';
import type { MemberWithSubscription, SubscriptionStatus, Package, PaymentMethod, PaymentStatus, DiscountType } from '../types/database';
import { FilterBar, type FilterOption, type FilterGroup } from '../components/FilterBar';

const PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'pending'];

type StatusFilterType = 'all' | 'active' | 'expired' | 'expires_soon' | 'pending_payment';

export default function MembersScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const { formatCurrency, getCurrencySymbol } = useCurrency();

  const [members, setMembers] = useState<MemberWithSubscription[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [filtersLocked, setFiltersLocked] = useState(false);
  const [availablePackages, setAvailablePackages] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(['cash', 'card', 'bank_transfer', 'digital_wallet', 'other']);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithSubscription | null>(null);
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');
  const [showContactDetails, setShowContactDetails] = useState(false);
  
  // Discount state
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountAmount, setDiscountAmount] = useState('');
  
  // Package/payment state
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Payment modal state
  const [selectedPackageIdForPayment, setSelectedPackageIdForPayment] = useState<number | null>(null);
  const [paymentMethodForModal, setPaymentMethodForModal] = useState<PaymentMethod | null>(null);
  const [paymentStatusForModal, setPaymentStatusForModal] = useState<PaymentStatus | null>(null);
  const [discountTypeForPayment, setDiscountTypeForPayment] = useState<DiscountType | null>(null);
  const [discountAmountForPayment, setDiscountAmountForPayment] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const loadSettings = async () => {
    try {
      // Load payment methods from database
      const appSettings = await databaseService.getAppSettings();
      if (appSettings) {
        const methods = JSON.parse(appSettings.enabled_payment_methods);
        setPaymentMethods(methods as PaymentMethod[]);
      }
    } catch (error) {
      console.error('Error loading payment methods:', error);
    }
  };

  // Load members when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
      loadMembers();
    }, [])
  );

  // Search members when search query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchMembers();
    } else {
      loadMembers();
    }
  }, [searchQuery]);

  // Reset filters when unlocking (only if not locked)
  useEffect(() => {
    if (!filtersLocked) {
      setStatusFilter('all');
      setPackageFilter('all');
    }
  }, [filtersLocked]);

  // Apply filters whenever members or filters change
  useEffect(() => {
    applyFilters();
  }, [members, statusFilter, packageFilter]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      // Load all members - we'll filter client-side
      const data = await databaseService.getMembersWithSubscriptions();
      setMembers(data);
      
      // Extract unique package names
      const packages = Array.from(new Set(
        data
          .filter(m => m.package_name)
          .map(m => m.package_name as string)
      )).sort();
      setAvailablePackages(packages);
    } catch (error) {
      console.error('Error loading members:', error);
      Alert.alert('Error', 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const searchMembers = async () => {
    try {
      const data = await databaseService.searchMembers(searchQuery);
      setMembers(data);
      
      // Extract unique package names from search results
      const packages = Array.from(new Set(
        data
          .filter(m => m.package_name)
          .map(m => m.package_name as string)
      )).sort();
      setAvailablePackages(packages);
    } catch (error) {
      console.error('Error searching members:', error);
    }
  };

  const applyFilters = () => {
    let result = [...members];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(member => {
        const daysRemaining = getDaysRemaining(member.subscription_end_date);
        
        switch (statusFilter) {
          case 'active':
            return member.subscription_status === 'active';
          case 'expired':
            return member.subscription_status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);
          case 'expires_soon':
            return daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 3;
          case 'pending_payment':
            // For now, we'll show members with pending payment status if available
            // This would need backend support to properly detect pending payments
            return member.subscription_status === 'active'; // Placeholder
          default:
            return true;
        }
      });
    }

    // Apply package filter
    if (packageFilter !== 'all') {
      result = result.filter(member => member.package_name === packageFilter);
    }

    setFilteredMembers(result);
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
    // Dismiss keyboard if open
    Keyboard.dismiss();
    
    // Reset form
    setFullName('');
    setPhone('');
    setEmail('');
    setInstagram('');
    setShowContactDetails(false);
    setDiscountType(null);
    setDiscountAmount('');
    setSelectedPackageId(null);
    setPaymentMethod(null);
    setPaymentStatus(null);
    
    // Load packages and show modal
    loadPackages();
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    // Validation
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Name is required');
      return;
    }

    // Parse name into first and last
    const parts = fullName.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

    // Validate discount amount if provided
    const parsedDiscountAmount = discountAmount.trim() ? parseFloat(discountAmount.trim()) : undefined;
    if (parsedDiscountAmount !== undefined) {
      if (isNaN(parsedDiscountAmount) || parsedDiscountAmount < 0) {
        Alert.alert('Validation Error', 'Discount amount must be a positive number');
        return;
      }
      if (!discountType) {
        Alert.alert('Validation Error', 'Please select a discount type ($ or %)');
        return;
      }
      if (discountType === '%' && parsedDiscountAmount > 100) {
        Alert.alert('Validation Error', 'Percentage discount cannot exceed 100%');
        return;
      }
    }

    // Validate payment details if package is selected
    if (selectedPackageId) {
      if (!paymentMethod) {
        Alert.alert('Validation Error', 'Please select a payment method for the package');
        return;
      }
      if (!paymentStatus) {
        Alert.alert('Validation Error', 'Please select a payment status for the package');
        return;
      }
    }

    try {
      setSaving(true);

      // 1. Create member
      const member = await databaseService.createMember({
        first_name: firstName,
        last_name: lastName, // Empty string if single name
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        instagram: instagram.trim() || undefined,
        discount_type: parsedDiscountAmount !== undefined && discountType ? discountType : undefined,
        discount_amount: parsedDiscountAmount,
      });

      // 2. Create subscription if package selected
      if (selectedPackageId) {
        const selectedPackage = packages.find(p => p.id === selectedPackageId);
        if (selectedPackage) {
          const startDate = new Date().toISOString();
          // Calculate end date: duration_days - 1 (since start day counts), then set to end of day
          const endDateObj = new Date();
          endDateObj.setDate(endDateObj.getDate() + selectedPackage.duration_days - 1);
          endDateObj.setHours(23, 59, 59, 999);
          const endDate = endDateObj.toISOString();

          const subscription = await databaseService.createSubscription({
            member_id: member.id,
            package_id: selectedPackageId,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            sessions_remaining: selectedPackage.sessions_included || undefined,
            auto_renew: false,
          });

          // 3. Create payment record with discount (only if payment details provided)
          if (paymentMethod && paymentStatus) {
            let finalAmount = selectedPackage.price;
            let appliedDiscountAmount: number | undefined = undefined;
            
            if (parsedDiscountAmount !== undefined && parsedDiscountAmount > 0) {
              if (discountType === '$') {
                finalAmount = Math.max(0, selectedPackage.price - parsedDiscountAmount);
                appliedDiscountAmount = parsedDiscountAmount;
              } else {
                // Percentage discount
                const discountValue = (selectedPackage.price * parsedDiscountAmount) / 100;
                finalAmount = Math.max(0, selectedPackage.price - discountValue);
                appliedDiscountAmount = parsedDiscountAmount;
              }
            }

            await databaseService.createPayment({
              member_id: member.id,
              subscription_id: subscription.id,
              amount: finalAmount,
              payment_date: new Date().toISOString(),
              payment_method: paymentMethod as PaymentMethod,
              status: paymentStatus as PaymentStatus,
              discount_type: appliedDiscountAmount !== undefined && discountType ? discountType : undefined,
              discount_amount: appliedDiscountAmount,
            });
          }
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
    Keyboard.dismiss();
    setSelectedMember(member);
    setSelectedPackageIdForPayment(null);
    setPaymentMethodForModal(null);
    setPaymentStatusForModal(null);
    setDiscountTypeForPayment(null);
    setDiscountAmountForPayment('');
    loadPackages();
    setIsPaymentModalVisible(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalVisible(false);
    setSelectedMember(null);
    setSelectedPackageIdForPayment(null);
    setPaymentMethodForModal(null);
    setPaymentStatusForModal(null);
    setDiscountTypeForPayment(null);
    setDiscountAmountForPayment('');
  };

  const handleSavePayment = async () => {
    if (!selectedMember || !selectedPackageIdForPayment || !paymentMethodForModal || !paymentStatusForModal) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    try {
      setSavingPayment(true);
      
      // Get package price
      const selectedPackage = packages.find(pkg => pkg.id === selectedPackageIdForPayment);
      if (!selectedPackage) {
        Alert.alert('Error', 'Selected package not found.');
        return;
      }
      
      let finalAmount = selectedPackage.price;
      
      // Apply discount if specified
      if (discountTypeForPayment && discountAmountForPayment) {
        const discount = parseFloat(discountAmountForPayment);
        if (discountTypeForPayment === '$') {
          finalAmount = finalAmount - discount;
        } else {
          finalAmount = finalAmount * (1 - discount / 100);
        }
      }

      // Get member's existing subscriptions to determine start date
      const existingSubscriptions = await databaseService.getSubscriptionsByMember(selectedMember.id);
      
      // Find the latest end date among unexpired subscriptions
      const now = new Date();
      const futureSubscriptions = existingSubscriptions.filter(sub => {
        const endDate = new Date(sub.end_date);
        return endDate > now;
      });
      
      let startDate: Date;
      if (futureSubscriptions.length === 0) {
        // No active/future subscriptions, start immediately
        startDate = now;
      } else {
        // Start after the latest end date
        const latestEndDate = futureSubscriptions.reduce((latest, sub) => {
          const subEndDate = new Date(sub.end_date);
          return subEndDate > latest ? subEndDate : latest;
        }, new Date(futureSubscriptions[0].end_date));
        
        // Add one day to start the next day after the current subscription ends
        startDate = new Date(latestEndDate);
        startDate.setDate(startDate.getDate() + 1);
      }
      
      // Calculate end date based on package duration
      // duration_days - 1 (since start day counts), then set to end of day
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + selectedPackage.duration_days - 1);
      endDate.setHours(23, 59, 59, 999);

      // Create the payment
      await databaseService.createPayment({
        member_id: selectedMember.id,
        amount: finalAmount,
        payment_method: paymentMethodForModal,
        payment_date: new Date().toISOString(),
        status: paymentStatusForModal,
        discount_type: discountTypeForPayment ? discountTypeForPayment : undefined,
        discount_amount: discountAmountForPayment ? parseFloat(discountAmountForPayment) : undefined,
      });

      // Create the subscription
      await databaseService.createSubscription({
        member_id: selectedMember.id,
        package_id: selectedPackageIdForPayment,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        sessions_remaining: selectedPackage.sessions_included || undefined,
        auto_renew: false,
      });

      Alert.alert('Success', 'Payment added and subscription created successfully!');
      handleClosePaymentModal();
      loadMembers(); // Reload to show updated data
    } catch (error) {
      console.error('Error creating payment:', error);
      Alert.alert('Error', 'Failed to add payment. Please try again.');
    } finally {
      setSavingPayment(false);
    }
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

  const getDaysRemaining = (endDate: string | null): number | null => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDaysRemainingColor = (days: number | null): string => {
    if (days === null) return '#6b7280';
    if (days <= 0) return '#ef4444'; // Red - expired
    if (days >= 2 && days <= 3) return '#f59e0b'; // Orange - 2-3 days
    return '#10b981'; // Green - 1 day or 4+ days
  };

  const getDaysRemainingText = (days: number | null): string => {
    if (days === null) return 'No subscription';
    if (days <= 0) return 'Expired';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  };

  const renderMemberItem = ({ item }: { item: MemberWithSubscription }) => {
    const daysRemaining = getDaysRemaining(item.subscription_end_date);
    const daysColor = getDaysRemainingColor(daysRemaining);
    const isActive = item.subscription_status === 'active';

    return (
      <TouchableOpacity 
        style={[styles.memberCard, isTablet && styles.tabletMemberCard]}
        onPress={() => {
          Keyboard.dismiss();
          router.push(`/member-detail?id=${item.id}`);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.memberCardContent}>
          {/* Left side: Name, package, days */}
          <View style={styles.memberInfo}>
            {/* Name with active dot */}
            <View style={styles.memberNameRow}>
              {isActive && <View style={styles.activeDot} />}
              <Text style={[styles.memberName, isTablet && styles.tabletMemberName]}>
                {item.first_name} {item.last_name}
              </Text>
            </View>

            {/* Package badge and days remaining */}
            <View style={styles.memberMetaRow}>
              {item.package_name && (
                <View style={[styles.packageBadge, isTablet && styles.tabletPackageBadge]}>
                  <Ionicons name="cube" size={isTablet ? 14 : 12} color="#6b7280" />
                  <Text style={[styles.packageBadgeText, isTablet && styles.tabletPackageBadgeText]}>
                    {item.package_name}
                  </Text>
                </View>
              )}
              <View style={[styles.daysRemaining, { borderColor: daysColor }]}>
                <Text style={[styles.daysRemainingText, isTablet && styles.tabletDaysRemainingText, { color: daysColor }]}>
                  {getDaysRemainingText(daysRemaining)}
                </Text>
              </View>
            </View>
          </View>

          {/* Right side: Payment button */}
          <TouchableOpacity
            style={[styles.paymentIconButton, isTablet && styles.tabletPaymentIconButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleAddPayment(item);
            }}
          >
            <Ionicons name="card" size={isTablet ? 28 : 24} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
      <View style={styles.container}>
        <StatusBar style="auto" />

      {/* Filters */}
      <FilterBar filters={(() => {
        const statusFilterOptions: FilterOption[] = [
          { value: 'all', label: 'All Statuses' },
          { value: 'active', label: 'Active', icon: 'checkmark-circle', color: '#10b981' },
          { value: 'expired', label: 'Expired', icon: 'close-circle', color: '#ef4444' },
          { value: 'expires_soon', label: 'Expires Soon', icon: 'alert-circle', color: '#f59e0b' },
        ];

        const packageFilterOptions: FilterOption[] = [
          { value: 'all', label: 'All Packages' },
          ...availablePackages.map(pkg => ({
            value: pkg,
            label: pkg,
            icon: 'cube' as keyof typeof Ionicons.glyphMap,
          })),
        ];

        const filterGroups: FilterGroup[] = [
          {
            id: 'status',
            label: 'Member Status',
            options: statusFilterOptions,
            activeValue: statusFilter,
            onChange: (value) => {
              setStatusFilter(value as StatusFilterType);
              Keyboard.dismiss();
            },
          },
        ];

        if (availablePackages.length > 0) {
          filterGroups.push({
            id: 'package',
            label: 'Package',
            options: packageFilterOptions,
            activeValue: packageFilter,
            onChange: (value) => {
              setPackageFilter(value);
              Keyboard.dismiss();
            },
          });
        }

        return filterGroups;
      })()} 
        isLocked={filtersLocked}
        onToggleLock={() => setFiltersLocked(!filtersLocked)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search members..."
      />

      {/* Total Display */}
      {filteredMembers.length > 0 && (
        <View style={[styles.totalContainer, isTablet && styles.tabletTotalContainer]}>
          <Text style={[styles.totalLabel, isTablet && styles.tabletTotalLabel]}>Total:</Text>
          <Text style={[styles.totalCount, isTablet && styles.tabletTotalCount]}>
            {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
      )}

      {/* Members List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.listContent,
            isTablet && styles.tabletListContent
          ]}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
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

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                  Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  placeholder="Full name"
                  placeholderTextColor="#9ca3af"
                  value={fullName}
                  onChangeText={setFullName}
                  autoFocus
                />
              </View>

              {/* Contact Fields - Collapsible */}
              {!showContactDetails ? (
                <TouchableOpacity
                  style={styles.addContactButton}
                  onPress={() => setShowContactDetails(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                  <Text style={styles.addContactText}>Add contact details (optional)</Text>
                </TouchableOpacity>
              ) : (
                <>
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
                </>
              )}

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
                          {getCurrencySymbol()}{pkg.price.toLocaleString()}
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

              {/* Discount Section */}
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Discount</Text>
                <View style={styles.discountRow}>
                  <View style={styles.discountTypeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.discountTypeButtonCompact,
                        isTablet && styles.tabletDiscountTypeButtonCompact,
                        discountType === '$' && styles.discountTypeButtonCompactActive,
                      ]}
                      onPress={() => setDiscountType(discountType === '$' ? null : '$')}
                    >
                      <Text
                        style={[
                          styles.discountTypeTextCompact,
                          isTablet && styles.tabletDiscountTypeTextCompact,
                          discountType === '$' && styles.discountTypeTextCompactActive,
                        ]}
                      >
                        $
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.discountTypeButtonCompact,
                        isTablet && styles.tabletDiscountTypeButtonCompact,
                        discountType === '%' && styles.discountTypeButtonCompactActive,
                      ]}
                      onPress={() => setDiscountType(discountType === '%' ? null : '%')}
                    >
                      <Text
                        style={[
                          styles.discountTypeTextCompact,
                          isTablet && styles.tabletDiscountTypeTextCompact,
                          discountType === '%' && styles.discountTypeTextCompactActive,
                        ]}
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.discountInput, isTablet && styles.tabletDiscountInput]}
                    placeholder={discountType === '%' ? 'e.g., 10' : discountType === '$' ? 'e.g., 50' : 'Enter amount'}
                    placeholderTextColor="#9ca3af"
                    value={discountAmount}
                    onChangeText={setDiscountAmount}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Payment Details */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                Payment Details
              </Text>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Payment Method</Text>
                <View style={styles.paymentMethodGrid}>
                  {paymentMethods.map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodButton,
                        isTablet && styles.tabletPaymentMethodButton,
                        paymentMethod === method && styles.paymentMethodButtonActive,
                      ]}
                      onPress={() => setPaymentMethod(paymentMethod === method ? null : method)}
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
                      onPress={() => setPaymentStatus(paymentStatus === status ? null : status)}
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

      {/* Payment Modal */}
      <Modal
        visible={isPaymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleClosePaymentModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.paymentModalOverlay}
        >
          <TouchableOpacity 
            style={styles.paymentModalBackdrop} 
            activeOpacity={1}
            onPress={handleClosePaymentModal}
          />
          <View style={[styles.paymentModalCard, isTablet && styles.tabletPaymentModalCard]}>
            {/* Header */}
            <View style={styles.paymentModalHeader}>
              <TouchableOpacity onPress={handleClosePaymentModal} style={styles.backButton}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
              <Text style={[styles.paymentModalTitle, isTablet && styles.tabletPaymentModalTitle]}>
                Add Payment
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Content */}
            <ScrollView 
              style={styles.paymentModalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Member Info */}
              {selectedMember && (
                <View style={styles.formSection}>
                  <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>
                    Member
                  </Text>
                  <View style={[styles.memberInfoCard, isTablet && styles.tabletMemberInfoCard]}>
                    <Text style={[styles.memberInfoName, isTablet && styles.tabletMemberInfoName]}>
                      {selectedMember.first_name} {selectedMember.last_name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Package Selection */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                Package <Text style={styles.required}>*</Text>
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
                        selectedPackageIdForPayment === pkg.id && styles.packageCardSelected,
                      ]}
                      onPress={() => setSelectedPackageIdForPayment(selectedPackageIdForPayment === pkg.id ? null : pkg.id)}
                    >
                      <View style={styles.packageHeader}>
                        <Text style={[styles.packageName, isTablet && styles.tabletPackageName]}>
                          {pkg.name}
                        </Text>
                        <Text style={[styles.packagePrice, isTablet && styles.tabletPackagePrice]}>
                          {getCurrencySymbol()}{pkg.price.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={[styles.packageDetails, isTablet && styles.tabletPackageDetails]}>
                        {pkg.duration_days} days{pkg.sessions_included ? ` • ${pkg.sessions_included} sessions` : ''}
                      </Text>
                      {selectedPackageIdForPayment === pkg.id && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#2563eb" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Discount */}
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Discount</Text>
                <View style={styles.discountRow}>
                  <View style={styles.discountTypeSelector}>
                    <TouchableOpacity 
                      style={[
                        styles.discountTypeButtonCompact,
                        isTablet && styles.tabletDiscountTypeButtonCompact,
                        discountTypeForPayment === '$' && styles.discountTypeButtonCompactActive,
                      ]}
                      onPress={() => {
                        if (discountTypeForPayment === '$') {
                          setDiscountTypeForPayment(null);
                          setDiscountAmountForPayment('');
                        } else {
                          setDiscountTypeForPayment('$');
                        }
                      }}
                    >
                      <Text 
                        style={[
                          styles.discountTypeTextCompact,
                          isTablet && styles.tabletDiscountTypeTextCompact,
                          discountTypeForPayment === '$' && styles.discountTypeTextCompactActive,
                        ]}
                      >
                        $
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.discountTypeButtonCompact,
                        isTablet && styles.tabletDiscountTypeButtonCompact,
                        discountTypeForPayment === '%' && styles.discountTypeButtonCompactActive,
                      ]}
                      onPress={() => {
                        if (discountTypeForPayment === '%') {
                          setDiscountTypeForPayment(null);
                          setDiscountAmountForPayment('');
                        } else {
                          setDiscountTypeForPayment('%');
                        }
                      }}
                    >
                      <Text 
                        style={[
                          styles.discountTypeTextCompact,
                          isTablet && styles.tabletDiscountTypeTextCompact,
                          discountTypeForPayment === '%' && styles.discountTypeTextCompactActive,
                        ]}
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.discountInput, isTablet && styles.tabletDiscountInput]}
                    placeholder="Amount"
                    value={discountAmountForPayment}
                    onChangeText={setDiscountAmountForPayment}
                    keyboardType="decimal-pad"
                    editable={discountTypeForPayment !== null}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Payment Method */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                Payment Method <Text style={styles.required}>*</Text>
              </Text>
              
              <View style={styles.formSection}>
                <View style={styles.paymentMethodGrid}>
                  {paymentMethods.map((method) => (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.paymentMethodButton,
                        isTablet && styles.tabletPaymentMethodButton,
                        paymentMethodForModal === method && styles.paymentMethodButtonActive,
                      ]}
                      onPress={() => setPaymentMethodForModal(paymentMethodForModal === method ? null : method)}
                    >
                      <Ionicons 
                        name={
                          method === 'cash' ? 'cash-outline' :
                          method === 'card' ? 'card-outline' :
                          method === 'bank_transfer' ? 'business-outline' :
                          method === 'digital_wallet' ? 'phone-portrait-outline' :
                          'ellipsis-horizontal'
                        } 
                        size={isTablet ? 20 : 18} 
                        color={paymentMethodForModal === method ? '#2563eb' : '#6b7280'} 
                      />
                      <Text style={[
                        styles.paymentMethodText,
                        isTablet && styles.tabletPaymentMethodText,
                        paymentMethodForModal === method && styles.paymentMethodTextActive,
                      ]}>
                        {method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Status */}
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle, { marginTop: 24 }]}>
                Payment Status <Text style={styles.required}>*</Text>
              </Text>
              
              <View style={styles.formSection}>
                <View style={styles.paymentStatusRow}>
                  {['pending', 'completed'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        isTablet && styles.tabletStatusButton,
                        paymentStatusForModal === status && styles.statusButtonActive,
                      ]}
                      onPress={() => setPaymentStatusForModal(paymentStatusForModal === status ? null : status as PaymentStatus)}
                    >
                      <Text style={[
                        styles.statusButtonText,
                        isTablet && styles.tabletStatusButtonText,
                        paymentStatusForModal === status && styles.statusButtonTextActive,
                      ]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isTablet && styles.tabletSaveButton,
                  (!selectedPackageIdForPayment || !paymentMethodForModal || !paymentStatusForModal || savingPayment) && styles.saveButtonDisabled,
                ]}
                onPress={handleSavePayment}
                disabled={!selectedPackageIdForPayment || !paymentMethodForModal || !paymentStatusForModal || savingPayment}
              >
                {savingPayment ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                      Save Payment
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  // Total Display
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
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletTotalLabel: {
    fontSize: 16,
  },
  totalCount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabletTotalCount: {
    fontSize: 20,
  },
  
  // List
  listContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tabletListContent: {
    paddingTop: 16,
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
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberInfo: {
    flex: 1,
    gap: 12,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletMemberName: {
    fontSize: 22,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  packageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  tabletPackageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  packageBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletPackageBadgeText: {
    fontSize: 14,
  },
  daysRemaining: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  daysRemainingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabletDaysRemainingText: {
    fontSize: 15,
  },
  paymentIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  tabletPaymentIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  
  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    padding: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600',
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
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addContactText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
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

  // Discount Controls (Compact Inline)
  discountRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  discountTypeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  discountTypeButtonCompact: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tabletDiscountTypeButtonCompact: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  discountTypeButtonCompactActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  discountTypeTextCompact: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabletDiscountTypeTextCompact: {
    fontSize: 18,
  },
  discountTypeTextCompactActive: {
    color: '#2563eb',
  },
  discountInput: {
    width: 120,
    height: 44,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletDiscountInput: {
    width: 140,
    height: 52,
    fontSize: 18,
    borderRadius: 14,
  },

  // Discount Type Selection (Old - can be removed)
  discountTypeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  discountTypeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
  },
  tabletDiscountTypeButton: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  discountTypeButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#2563eb',
  },
  discountTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletDiscountTypeText: {
    fontSize: 16,
  },
  discountTypeTextActive: {
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

  // Payment Modal
  paymentModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  paymentModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  paymentModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  tabletPaymentModalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  paymentModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletPaymentModalTitle: {
    fontSize: 24,
  },
  paymentModalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  memberInfoCard: {
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletMemberInfoCard: {
    padding: 20,
    borderRadius: 14,
  },
  memberInfoName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletMemberInfoName: {
    fontSize: 20,
  },
  memberInfoPackage: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletMemberInfoPackage: {
    fontSize: 16,
  },
});

