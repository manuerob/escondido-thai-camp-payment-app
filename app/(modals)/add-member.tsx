import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { databaseService } from '../../services/database.service';
import type { Package, PaymentMethod, PaymentStatus } from '../../types/database';

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'digital_wallet'];
const PAYMENT_STATUSES: PaymentStatus[] = ['completed', 'pending'];

export default function AddMemberScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [instagram, setInstagram] = useState('');

  // Optional package/payment state
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('completed');

  const [loading, setLoading] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(true);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const data = await databaseService.getActivePackages();
      setPackages(data);
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSave = async () => {
    // Minimal validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Validation Error', 'First name and last name are required');
      return;
    }

    try {
      setLoading(true);

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

      Alert.alert('Success', 'Member added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error saving member:', error);
      Alert.alert('Error', 'Failed to save member');
    } finally {
      setLoading(false);
    }
  };

  const selectedPackage = packages.find(p => p.id === selectedPackageId);

  return (
    <View style={styles.modalOverlay}>
      <StatusBar style="light" />
      <View style={[styles.modalCard, isTablet && styles.tabletModalCard]}>
        <ScrollView 
          contentContainerStyle={[
            styles.scrollContent,
            isTablet && styles.tabletScrollContent
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color="#1f2937" />
          </TouchableOpacity>
          <Text style={[styles.title, isTablet && styles.tabletTitle]}>Add Member</Text>
        </View>

        {/* Member Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>
            Member Information
          </Text>

          <View style={styles.row}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.tabletInput]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                Last Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, isTablet && styles.tabletInput]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, isTablet && styles.tabletLabel]}>Phone</Text>
            <TextInput
              style={[styles.input, isTablet && styles.tabletInput]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, isTablet && styles.tabletLabel]}>Email</Text>
            <TextInput
              style={[styles.input, isTablet && styles.tabletInput]}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter email address"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, isTablet && styles.tabletLabel]}>Instagram</Text>
            <TextInput
              style={[styles.input, isTablet && styles.tabletInput]}
              value={instagram}
              onChangeText={setInstagram}
              placeholder="@username"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Package Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>
            Initial Package (Optional)
          </Text>

          {loadingPackages ? (
            <ActivityIndicator color="#2563eb" />
          ) : (
            <>
              <View style={styles.packageGrid}>
                {packages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.id}
                    style={[
                      styles.packageCard,
                      isTablet && styles.tabletPackageCard,
                      selectedPackageId === pkg.id && styles.packageCardSelected
                    ]}
                    onPress={() => setSelectedPackageId(pkg.id === selectedPackageId ? null : pkg.id)}
                  >
                    <Text style={[styles.packageName, isTablet && styles.tabletPackageName]}>
                      {pkg.name}
                    </Text>
                    <Text style={[styles.packagePrice, isTablet && styles.tabletPackagePrice]}>
                      ฿{pkg.price}
                    </Text>
                    <Text style={[styles.packageDuration, isTablet && styles.tabletPackageDuration]}>
                      {pkg.duration_days} days
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Payment details - only show if package selected */}
              {selectedPackageId && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, isTablet && styles.tabletLabel]}>Payment Method</Text>
                    <View style={styles.optionsRow}>
                      {PAYMENT_METHODS.map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.optionButton,
                            isTablet && styles.tabletOptionButton,
                            paymentMethod === method && styles.optionButtonSelected
                          ]}
                          onPress={() => setPaymentMethod(method)}
                        >
                          <Text style={[
                            styles.optionText,
                            isTablet && styles.tabletOptionText,
                            paymentMethod === method && styles.optionTextSelected
                          ]}>
                            {method.replace('_', ' ')}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={[styles.label, isTablet && styles.tabletLabel]}>Payment Status</Text>
                    <View style={styles.optionsRow}>
                      {PAYMENT_STATUSES.map((status) => (
                        <TouchableOpacity
                          key={status}
                          style={[
                            styles.optionButton,
                            isTablet && styles.tabletOptionButton,
                            paymentStatus === status && styles.optionButtonSelected
                          ]}
                          onPress={() => setPaymentStatus(status)}
                        >
                          <Text style={[
                            styles.optionText,
                            isTablet && styles.tabletOptionText,
                            paymentStatus === status && styles.optionTextSelected
                          ]}>
                            {status}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {selectedPackage && (
                    <View style={styles.summaryCard}>
                      <Text style={[styles.summaryTitle, isTablet && styles.tabletSummaryTitle]}>
                        Summary
                      </Text>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, isTablet && styles.tabletSummaryLabel]}>
                          Package:
                        </Text>
                        <Text style={[styles.summaryValue, isTablet && styles.tabletSummaryValue]}>
                          {selectedPackage.name}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, isTablet && styles.tabletSummaryLabel]}>
                          Amount:
                        </Text>
                        <Text style={[styles.summaryValue, isTablet && styles.tabletSummaryValue]}>
                          ฿{selectedPackage.price}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={[styles.summaryLabel, isTablet && styles.tabletSummaryLabel]}>
                          Duration:
                        </Text>
                        <Text style={[styles.summaryValue, isTablet && styles.tabletSummaryValue]}>
                          {selectedPackage.duration_days} days
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            isTablet && styles.tabletSaveButton,
            loading && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
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
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 8,
  },
  tabletModalCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  tabletScrollContent: {
    padding: 24,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  tabletTitle: {
    fontSize: 32,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  tabletSectionTitle: {
    fontSize: 22,
  },

  // Input
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  tabletLabel: {
    fontSize: 16,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletInput: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 18,
  },

  // Package Grid
  packageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  packageCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    minWidth: 100,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  tabletPackageCard: {
    padding: 20,
    minWidth: 140,
  },
  packageCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletPackageName: {
    fontSize: 18,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    marginBottom: 2,
  },
  tabletPackagePrice: {
    fontSize: 24,
  },
  packageDuration: {
    fontSize: 12,
    color: '#6b7280',
  },
  tabletPackageDuration: {
    fontSize: 14,
  },

  // Options
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tabletOptionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  optionButtonSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  optionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  tabletOptionText: {
    fontSize: 16,
  },
  optionTextSelected: {
    color: '#fff',
  },

  // Summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  tabletSummaryTitle: {
    fontSize: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletSummaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletSummaryValue: {
    fontSize: 16,
  },

  // Save Button
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tabletSaveButton: {
    paddingVertical: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tabletSaveButtonText: {
    fontSize: 18,
  },
});
