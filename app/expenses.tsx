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
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import { useCurrency } from '../hooks';
import type { Expense, PaymentMethod } from '../types/database';

export default function ExpensesScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const router = useRouter();
  const { formatCurrency, getCurrencySymbol } = useCurrency();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>(['Equipment', 'Utilities', 'Rent', 'Supplies', 'Maintenance', 'Marketing', 'Staff', 'Other']);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>(['cash', 'card', 'bank_transfer', 'digital_wallet']);
  
  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load expenses when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadExpenses();
      loadSettings();
    }, [])
  );

  const loadSettings = async () => {
    try {
      const savedCategories = await AsyncStorage.getItem('expense_categories');
      if (savedCategories) {
        const cats = JSON.parse(savedCategories);
        // Filter out any invalid values
        const validCategories = cats.filter((c: any) => typeof c === 'string' && c.trim().length > 0);
        if (validCategories.length > 0) {
          setCategories(validCategories);
        }
      }

      const savedPaymentMethods = await AsyncStorage.getItem('payment_methods');
      if (savedPaymentMethods) {
        const methods = JSON.parse(savedPaymentMethods);
        // Handle migration from objects to strings
        const validMethods = methods
          .map((m: any) => {
            if (typeof m === 'string') return m;
            if (typeof m === 'object' && m.id) return m.id;
            return null;
          })
          .filter((m: any) => m && typeof m === 'string' && m.trim().length > 0);
        if (validMethods.length > 0) {
          setPaymentMethods(validMethods as PaymentMethod[]);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      console.log('Loading expenses...');
      const data = await databaseService.getExpensesByDateRange({});
      console.log('Expenses loaded:', data.length, 'items');
      setExpenses(data);
      filterExpenses(data, categoryFilter);
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const filterExpenses = (data: Expense[], filter: string) => {
    if (filter === 'all') {
      setFilteredExpenses(data);
    } else {
      setFilteredExpenses(data.filter(e => e.category === filter));
    }
  };

  // Update filter
  useEffect(() => {
    filterExpenses(expenses, categoryFilter);
  }, [categoryFilter]);

  const getTotalAmount = (): number => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadExpenses();
    setRefreshing(false);
  };

  const handleAddExpense = () => {
    setIsModalVisible(true);
    // Reset form
    setTitle('');
    setCategory('');
    setAmount('');
    setPaymentMethod('cash');
    setNotes('');
    setShowNotes(false);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    // Validation
    if (!category) {
      Alert.alert('Validation Error', 'Please select a category');
      return;
    }
    if (!amount.trim() || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid amount');
      return;
    }

    try {
      setSaving(true);

      // Auto-generate description from category if title is empty
      const finalTitle = title.trim() || `${category.charAt(0).toUpperCase() + category.slice(1)} expense`;
      const description = notes.trim() 
        ? `${finalTitle}\n\n${notes.trim()}`
        : finalTitle;

      await databaseService.createExpense({
        category,
        amount: Number(amount),
        expense_date: new Date().toISOString(),
        description,
        payment_method: paymentMethod,
      });

      setIsModalVisible(false);
      await loadExpenses(); // Refresh the list
      
      Alert.alert('Success', 'Expense added successfully');
    } catch (error) {
      console.error('Error creating expense:', error);
      Alert.alert('Error', 'Failed to create expense');
    } finally {
      setSaving(false);
    }
  };

  const formatPaymentMethod = (method: PaymentMethod): string => {
    if (!method || typeof method !== 'string') return '';
    return method.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
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

      {/* Category Filters */}
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
              categoryFilter === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setCategoryFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                isTablet && styles.tabletFilterChipText,
                categoryFilter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.filter(c => c).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                isTablet && styles.tabletFilterChip,
                categoryFilter === cat && styles.filterChipActive,
                categoryFilter === cat && { backgroundColor: getCategoryColor(cat), borderColor: getCategoryColor(cat) },
              ]}
              onPress={() => setCategoryFilter(cat)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isTablet && styles.tabletFilterChipText,
                  categoryFilter === cat && styles.filterChipTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Total Display */}
      {filteredExpenses.length > 0 && (
        <View style={[styles.totalContainer, isTablet && styles.tabletTotalContainer]}>
          <Text style={[styles.totalLabel, isTablet && styles.tabletTotalLabel]}>Total:</Text>
          <Text style={[styles.totalAmount, isTablet && styles.tabletTotalAmount]}>
            {formatCurrency(getTotalAmount())}
          </Text>
          <Text style={[styles.totalCount, isTablet && styles.tabletTotalCount]}>
            ({filteredExpenses.length} {filteredExpenses.length === 1 ? 'expense' : 'expenses'})
          </Text>
        </View>
      )}

      <FlatList
        data={filteredExpenses}
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

      {/* Add Expense Modal */}
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
                Add Expense
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Title Input (Optional) */}
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                  Title <Text style={styles.optional}>(optional - auto-generated if blank)</Text>
                </Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  placeholder="Auto-filled from category"
                  placeholderTextColor="#9ca3af"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Category Selection */}
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                  Category <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.categoryGrid}>
                  {categories.filter(c => c).map((cat) => (
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
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                  Amount <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.amountContainer}>
                  <Text style={[styles.currencySymbol, isTablet && styles.tabletCurrencySymbol]}>
                    {getCurrencySymbol()}
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
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                  Payment Method
                </Text>
                <View style={styles.paymentMethodGrid}>
                  {paymentMethods.filter(m => m).map((method) => (
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

              {/* Notes Input (Collapsible) */}
              {!showNotes ? (
                <TouchableOpacity
                  style={styles.addNotesButton}
                  onPress={() => setShowNotes(true)}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
                  <Text style={styles.addNotesText}>Add notes (optional)</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.formSection}>
                  <View style={styles.notesHeader}>
                    <Text style={[styles.label, isTablet && styles.tabletLabel]}>
                      Notes
                    </Text>
                    <TouchableOpacity onPress={() => { setShowNotes(false); setNotes(''); }}>
                      <Ionicons name="close-circle" size={20} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.input, styles.notesInput, isTablet && styles.tabletInput, isTablet && styles.tabletNotesInput]}
                    placeholder="Additional details..."
                    placeholderTextColor="#9ca3af"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    autoFocus
                  />
                </View>
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
                      Save Expense
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filters
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
  },
  tabletFilterContainer: {
    paddingVertical: 16,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  tabletFilterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: '#2563eb',
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
    color: '#fff',
    fontWeight: '600',
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
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  tabletTotalAmount: {
    fontSize: 20,
  },
  totalCount: {
    fontSize: 12,
    color: '#6b7280',
  },
  tabletTotalCount: {
    fontSize: 14,
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
  formSection: {
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
    color: '#dc2626',
  },
  optional: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '400',
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
  notesInput: {
    minHeight: 100,
    paddingTop: 14,
  },
  tabletNotesInput: {
    minHeight: 120,
    paddingTop: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  addNotesText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },

  // Amount Input
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingLeft: 16,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginRight: 8,
  },
  tabletCurrencySymbol: {
    fontSize: 20,
  },
  amountInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingLeft: 0,
  },

  // Category Selection
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tabletCategoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabletCategoryButtonText: {
    fontSize: 16,
  },
  categoryButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
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
