import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { PaymentMethod } from '../types/database';

const CATEGORIES = [
  'Equipment',
  'Utilities',
  'Rent',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Staff',
  'Other',
];

const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'bank_transfer', 'digital_wallet'];

export default function AddExpenseScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }
    if (!date) {
      Alert.alert('Validation Error', 'Date is required');
      return;
    }

    try {
      setLoading(true);

      // Combine title and notes into description
      const description = notes.trim() 
        ? `${title.trim()}\n\n${notes.trim()}`
        : title.trim();

      const expense = await databaseService.createExpense({
        category,
        amount: Number(amount),
        expense_date: date,
        description,
        payment_method: paymentMethod,
      });

      console.log('Expense created successfully:', expense);

      Alert.alert('Success', 'Expense added successfully', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error creating expense:', error);
      Alert.alert('Error', 'Failed to create expense');
    } finally {
      setLoading(false);
    }
  };

  const formatPaymentMethod = (method: PaymentMethod): string => {
    return method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getCategoryColor = (cat: string): string => {
    const colors: { [key: string]: string } = {
      'Equipment': '#3b82f6',
      'Utilities': '#f59e0b',
      'Rent': '#8b5cf6',
      'Supplies': '#10b981',
      'Maintenance': '#ef4444',
      'Marketing': '#ec4899',
      'Staff': '#06b6d4',
      'Other': '#6b7280',
    };
    return colors[cat] || '#6b7280';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      {/* Header */}
      <View style={[styles.header, isTablet && styles.tabletHeader]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isTablet && styles.tabletHeaderTitle]}>
          Add Expense
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.tabletScrollContent,
        ]}
      >
        {/* Title Input */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Title <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.tabletInput]}
            placeholder="e.g., New equipment purchase"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* Category Selection */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Category <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryButton,
                  isTablet && styles.tabletCategoryButton,
                  category === cat && {
                    backgroundColor: getCategoryColor(cat),
                    borderColor: getCategoryColor(cat),
                  },
                ]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    isTablet && styles.tabletCategoryButtonText,
                    category === cat && styles.categoryButtonTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Amount <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.amountContainer}>
            <Text style={[styles.currencySymbol, isTablet && styles.tabletCurrencySymbol]}>
              ฿
            </Text>
            <TextInput
              style={[styles.amountInput, isTablet && styles.tabletInput]}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        {/* Payment Method Selection */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Payment Method
          </Text>
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
                    method === 'cash'
                      ? 'cash-outline'
                      : method === 'card'
                      ? 'card-outline'
                      : method === 'bank_transfer'
                      ? 'business-outline'
                      : 'phone-portrait-outline'
                  }
                  size={isTablet ? 24 : 20}
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

        {/* Date Input */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Date <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, isTablet && styles.tabletInput]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            value={date}
            onChangeText={setDate}
          />
          <Text style={[styles.hint, isTablet && styles.tabletHint]}>
            Format: YYYY-MM-DD (e.g., 2026-02-14)
          </Text>
        </View>

        {/* Notes Input */}
        <View style={styles.section}>
          <Text style={[styles.label, isTablet && styles.tabletLabel]}>
            Notes (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.notesInput,
              isTablet && styles.tabletInput,
              isTablet && styles.tabletNotesInput,
            ]}
            placeholder="Additional details about this expense..."
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            isTablet && styles.tabletSaveButton,
            loading && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
              Saving...
            </Text>
          ) : (
            <>
              <Ionicons name="checkmark" size={isTablet ? 24 : 20} color="#fff" />
              <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                Save Expense
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },

  // Section
  section: {
    marginBottom: 24,
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
    color: '#ef4444',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  tabletHint: {
    fontSize: 14,
  },

  // Input
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
  },
  tabletInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    borderRadius: 10,
  },
  notesInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  tabletNotesInput: {
    minHeight: 120,
  },

  // Category
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tabletCategoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletCategoryButtonText: {
    fontSize: 15,
  },
  categoryButtonTextActive: {
    color: '#fff',
  },

  // Amount
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingLeft: 14,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginRight: 8,
  },
  tabletCurrencySymbol: {
    fontSize: 20,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
    borderWidth: 0,
  },

  // Payment Method
  paymentMethodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentMethodButton: {
    flex: 1,
    minWidth: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  tabletPaymentMethodButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  paymentMethodButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  paymentMethodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletPaymentMethodText: {
    fontSize: 15,
  },
  paymentMethodTextActive: {
    color: '#2563eb',
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 16,
  },
  tabletSaveButton: {
    paddingVertical: 18,
    borderRadius: 12,
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
