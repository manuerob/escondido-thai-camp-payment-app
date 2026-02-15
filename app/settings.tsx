import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Alert,
  Modal,
  ActivityIndicator,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { Package, CreatePackageInput, UpdatePackageInput } from '../types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'MXN', symbol: '$', name: 'Mexican Peso' },
];

const DEFAULT_CATEGORIES = [
  'Equipment',
  'Utilities',
  'Rent',
  'Supplies',
  'Maintenance',
  'Marketing',
  'Staff',
  'Other',
];

const DEFAULT_PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: 'cash-outline' },
  { id: 'card', label: 'Card', icon: 'card-outline' },
  { id: 'bank_transfer', label: 'Bank Transfer', icon: 'business-outline' },
  { id: 'digital_wallet', label: 'Digital Wallet', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // State
  const [packages, setPackages] = useState<Package[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  // Package modal state
  const [packageModalVisible, setPackageModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [packagePrice, setPackagePrice] = useState('');
  const [packageDuration, setPackageDuration] = useState('');
  const [packageSessions, setPackageSessions] = useState('');
  const [saving, setSaving] = useState(false);

  // Category modal state
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Payment method modal state
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<any>(null);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentMethodLabel, setPaymentMethodLabel] = useState('');
  const [paymentMethodIcon, setPaymentMethodIcon] = useState('');

  // Currency modal state
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);

  // Load data on focus
  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load packages
      const pkgs = await databaseService.getAllPackages();
      setPackages(pkgs);

      // Load categories from AsyncStorage
      const savedCategories = await AsyncStorage.getItem('expense_categories');
      if (savedCategories) {
        setCategories(JSON.parse(savedCategories));
      } else {
        // Initialize with defaults on first load
        await AsyncStorage.setItem('expense_categories', JSON.stringify(DEFAULT_CATEGORIES));
      }

      // Load payment methods from AsyncStorage
      const savedPaymentMethods = await AsyncStorage.getItem('payment_methods');
      if (savedPaymentMethods) {
        const methodIds = JSON.parse(savedPaymentMethods);
        // Handle migration from objects to strings and filter invalid values
        const validIds = methodIds
          .map((m: any) => {
            if (typeof m === 'string') return m;
            if (typeof m === 'object' && m && m.id) return m.id;
            return null;
          })
          .filter((id: any) => id && typeof id === 'string' && id.trim().length > 0);
        
        // Convert IDs back to full objects for UI
        const fullMethods = validIds.map((id: string) => {
          const defaultMethod = DEFAULT_PAYMENT_METHODS.find(m => m.id === id);
          return defaultMethod || { id, label: id.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()), icon: 'card-outline' };
        });
        
        if (fullMethods.length > 0) {
          setPaymentMethods(fullMethods);
        }
        
        // Save back the cleaned IDs
        if (validIds.length > 0) {
          await AsyncStorage.setItem('payment_methods', JSON.stringify(validIds));
        } else {
          // If no valid methods, reset to defaults
          const defaultIds = DEFAULT_PAYMENT_METHODS.map(m => m.id);
          await AsyncStorage.setItem('payment_methods', JSON.stringify(defaultIds));
          setPaymentMethods(DEFAULT_PAYMENT_METHODS);
        }
      } else {
        // Initialize with defaults on first load
        const defaultIds = DEFAULT_PAYMENT_METHODS.map(m => m.id);
        await AsyncStorage.setItem('payment_methods', JSON.stringify(defaultIds));
      }

      // Load currency from AsyncStorage
      const savedCurrency = await AsyncStorage.getItem('app_currency');
      if (savedCurrency) {
        setCurrency(savedCurrency);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Package Management
  const handleAddPackage = () => {
    setEditingPackage(null);
    setPackageName('');
    setPackageDescription('');
    setPackagePrice('');
    setPackageDuration('');
    setPackageSessions('');
    setPackageModalVisible(true);
  };

  const handleEditPackage = (pkg: Package) => {
    setEditingPackage(pkg);
    setPackageName(pkg.name);
    setPackageDescription(pkg.description || '');
    setPackagePrice(pkg.price.toString());
    setPackageDuration(pkg.duration_days.toString());
    setPackageSessions(pkg.sessions_included?.toString() || '');
    setPackageModalVisible(true);
  };

  const handleSavePackage = async () => {
    if (!packageName.trim() || !packagePrice.trim() || !packageDuration.trim()) {
      Alert.alert('Validation Error', 'Name, price, and duration are required');
      return;
    }

    try {
      setSaving(true);

      if (editingPackage) {
        const input: UpdatePackageInput = {
          name: packageName.trim(),
          description: packageDescription.trim() || undefined,
          price: parseFloat(packagePrice),
          duration_days: parseInt(packageDuration),
          sessions_included: packageSessions ? parseInt(packageSessions) : undefined,
        };
        await databaseService.updatePackage(editingPackage.id, input);
      } else {
        const input: CreatePackageInput = {
          name: packageName.trim(),
          description: packageDescription.trim() || undefined,
          price: parseFloat(packagePrice),
          duration_days: parseInt(packageDuration),
          sessions_included: packageSessions ? parseInt(packageSessions) : undefined,
          is_active: true,
        };
        await databaseService.createPackage(input);
      }

      Alert.alert('Success', editingPackage ? 'Package updated' : 'Package created');
      setPackageModalVisible(false);
      loadData();
    } catch (error) {
      console.error('Error saving package:', error);
      Alert.alert('Error', 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePackage = (pkg: Package) => {
    Alert.alert(
      'Delete Package',
      `Are you sure you want to delete "${pkg.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.deletePackage(pkg.id);
              Alert.alert('Success', 'Package deleted');
              loadData();
            } catch (error) {
              console.error('Error deleting package:', error);
              Alert.alert('Error', 'Failed to delete package');
            }
          },
        },
      ]
    );
  };

  // Category Management
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryModalVisible(true);
  };

  const handleEditCategory = (category: string) => {
    setEditingCategory(category);
    setCategoryName(category);
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Validation Error', 'Category name is required');
      return;
    }

    let updatedCategories: string[];
    if (editingCategory) {
      updatedCategories = categories.map(c => c === editingCategory ? categoryName.trim() : c);
    } else {
      if (categories.includes(categoryName.trim())) {
        Alert.alert('Error', 'Category already exists');
        return;
      }
      updatedCategories = [...categories, categoryName.trim()];
    }

    try {
      await AsyncStorage.setItem('expense_categories', JSON.stringify(updatedCategories));
      setCategories(updatedCategories);
      setCategoryModalVisible(false);
      Alert.alert('Success', editingCategory ? 'Category updated' : 'Category added');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'Failed to save category');
    }
  };

  const handleDeleteCategory = (category: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedCategories = categories.filter(c => c !== category);
              await AsyncStorage.setItem('expense_categories', JSON.stringify(updatedCategories));
              setCategories(updatedCategories);
              Alert.alert('Success', 'Category deleted');
            } catch (error) {
              console.error('Error deleting category:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  // Payment Method Management
  const handleAddPaymentMethod = () => {
    setEditingPaymentMethod(null);
    setPaymentMethodId('');
    setPaymentMethodLabel('');
    setPaymentMethodIcon('card-outline');
    setPaymentModalVisible(true);
  };

  const handleEditPaymentMethod = (method: any) => {
    setEditingPaymentMethod(method);
    setPaymentMethodId(method.id);
    setPaymentMethodLabel(method.label);
    setPaymentMethodIcon(method.icon);
    setPaymentModalVisible(true);
  };

  const handleSavePaymentMethod = async () => {
    if (!paymentMethodId.trim() || !paymentMethodLabel.trim()) {
      Alert.alert('Validation Error', 'ID and label are required');
      return;
    }

    let updatedMethods;
    if (editingPaymentMethod) {
      updatedMethods = paymentMethods.map(m => 
        m.id === editingPaymentMethod.id 
          ? { id: paymentMethodId.trim(), label: paymentMethodLabel.trim(), icon: paymentMethodIcon }
          : m
      );
    } else {
      if (paymentMethods.some(m => m.id === paymentMethodId.trim())) {
        Alert.alert('Error', 'Payment method ID already exists');
        return;
      }
      updatedMethods = [...paymentMethods, { 
        id: paymentMethodId.trim(), 
        label: paymentMethodLabel.trim(), 
        icon: paymentMethodIcon 
      }];
    }

    try {
      // Save only the IDs (strings) to match PaymentMethod type
      const methodIds = updatedMethods.map(m => m.id);
      await AsyncStorage.setItem('payment_methods', JSON.stringify(methodIds));
      setPaymentMethods(updatedMethods);
      setPaymentModalVisible(false);
      Alert.alert('Success', editingPaymentMethod ? 'Payment method updated' : 'Payment method added');
    } catch (error) {
      console.error('Error saving payment method:', error);
      Alert.alert('Error', 'Failed to save payment method');
    }
  };

  const handleDeletePaymentMethod = (method: any) => {
    Alert.alert(
      'Delete Payment Method',
      `Are you sure you want to delete "${method.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedMethods = paymentMethods.filter(m => m.id !== method.id);
              // Save only the IDs (strings)
              const methodIds = updatedMethods.map(m => m.id);
              await AsyncStorage.setItem('payment_methods', JSON.stringify(methodIds));
              setPaymentMethods(updatedMethods);
              Alert.alert('Success', 'Payment method deleted');
            } catch (error) {
              console.error('Error deleting payment method:', error);
              Alert.alert('Error', 'Failed to delete payment method');
            }
          },
        },
      ]
    );
  };

  // Currency Management
  const handleChangeCurrency = async (currencyCode: string) => {
    try {
      await AsyncStorage.setItem('app_currency', currencyCode);
      setCurrency(currencyCode);
      setCurrencyModalVisible(false);
      Alert.alert('Success', 'Currency updated');
    } catch (error) {
      console.error('Error saving currency:', error);
      Alert.alert('Error', 'Failed to save currency');
    }
  };

  const getCurrencyDisplay = () => {
    const curr = CURRENCIES.find(c => c.code === currency);
    return curr ? `${curr.symbol} ${curr.code} - ${curr.name}` : 'USD';
  };

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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.title, isTablet && styles.tabletTitle]}>Settings</Text>
          <Text style={[styles.description, isTablet && styles.tabletDescription]}>
            Configure app preferences
          </Text>

          {/* Currency Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Currency</Text>
            </View>
            <TouchableOpacity
              style={[styles.settingItem, isTablet && styles.tabletSettingItem]}
              onPress={() => setCurrencyModalVisible(true)}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="cash" size={isTablet ? 24 : 20} color="#2563eb" />
                <Text style={[styles.settingItemText, isTablet && styles.tabletSettingItemText]}>
                  {getCurrencyDisplay()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={isTablet ? 24 : 20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Packages Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Packages</Text>
              <TouchableOpacity onPress={handleAddPackage} style={styles.addButton}>
                <Ionicons name="add-circle" size={isTablet ? 28 : 24} color="#2563eb" />
              </TouchableOpacity>
            </View>
            {packages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No packages yet</Text>
              </View>
            ) : (
              packages.map((pkg) => (
                <View key={pkg.id} style={[styles.settingItem, isTablet && styles.tabletSettingItem]}>
                  <View style={styles.settingItemLeft}>
                    <Ionicons name="cube" size={isTablet ? 24 : 20} color="#2563eb" />
                    <View style={styles.packageInfo}>
                      <Text style={[styles.settingItemText, isTablet && styles.tabletSettingItemText]}>
                        {pkg.name}
                      </Text>
                      <Text style={[styles.packageDetails, isTablet && styles.tabletPackageDetails]}>
                        ${pkg.price} • {pkg.duration_days} days
                      </Text>
                    </View>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity onPress={() => handleEditPackage(pkg)} style={styles.actionButton}>
                      <Ionicons name="create-outline" size={isTablet ? 22 : 18} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePackage(pkg)} style={styles.actionButton}>
                      <Ionicons name="trash-outline" size={isTablet ? 22 : 18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Categories Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Expense Categories</Text>
              <TouchableOpacity onPress={handleAddCategory} style={styles.addButton}>
                <Ionicons name="add-circle" size={isTablet ? 28 : 24} color="#2563eb" />
              </TouchableOpacity>
            </View>
            {categories.map((category, index) => (
              <View key={index} style={[styles.settingItem, isTablet && styles.tabletSettingItem]}>
                <View style={styles.settingItemLeft}>
                  <Ionicons name="pricetag" size={isTablet ? 24 : 20} color="#2563eb" />
                  <Text style={[styles.settingItemText, isTablet && styles.tabletSettingItemText]}>
                    {category}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => handleEditCategory(category)} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={isTablet ? 22 : 18} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteCategory(category)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={isTablet ? 22 : 18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>

          {/* Payment Methods Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isTablet && styles.tabletSectionTitle]}>Payment Methods</Text>
              <TouchableOpacity onPress={handleAddPaymentMethod} style={styles.addButton}>
                <Ionicons name="add-circle" size={isTablet ? 28 : 24} color="#2563eb" />
              </TouchableOpacity>
            </View>
            {paymentMethods.map((method, index) => (
              <View key={index} style={[styles.settingItem, isTablet && styles.tabletSettingItem]}>
                <View style={styles.settingItemLeft}>
                  <Ionicons name={method.icon as any} size={isTablet ? 24 : 20} color="#2563eb" />
                  <Text style={[styles.settingItemText, isTablet && styles.tabletSettingItemText]}>
                    {method.label}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity onPress={() => handleEditPaymentMethod(method)} style={styles.actionButton}>
                    <Ionicons name="create-outline" size={isTablet ? 22 : 18} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeletePaymentMethod(method)} style={styles.actionButton}>
                    <Ionicons name="trash-outline" size={isTablet ? 22 : 18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Package Modal */}
      <Modal
        visible={packageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPackageModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPackageModalVisible(false)}
          />
          <View style={[styles.modalCard, isTablet && styles.tabletModalCard]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPackageModalVisible(false)} style={styles.backButton}>
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                {editingPackage ? 'Edit Package' : 'Add Package'}
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Name *</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={packageName}
                  onChangeText={setPackageName}
                  placeholder="e.g., Monthly Membership"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, isTablet && styles.tabletInput]}
                  value={packageDescription}
                  onChangeText={setPackageDescription}
                  placeholder="Optional description"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Price *</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={packagePrice}
                  onChangeText={setPackagePrice}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Duration (days) *</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={packageDuration}
                  onChangeText={setPackageDuration}
                  placeholder="30"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Sessions Included</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={packageSessions}
                  onChangeText={setPackageSessions}
                  placeholder="Optional"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isTablet && styles.tabletSaveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSavePackage}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={isTablet ? 24 : 20} color="#fff" />
                    <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                      Save Package
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Modal */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setCategoryModalVisible(false)}
          />
          <View style={[styles.modalCard, styles.smallModalCard, isTablet && styles.tabletModalCard]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.backButton}>
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Category Name</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={categoryName}
                  onChangeText={setCategoryName}
                  placeholder="e.g., Equipment"
                  placeholderTextColor="#9ca3af"
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isTablet && styles.tabletSaveButton]}
                onPress={handleSaveCategory}
              >
                <Ionicons name="checkmark" size={isTablet ? 24 : 20} color="#fff" />
                <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                  Save Category
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment Method Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPaymentModalVisible(false)}
          />
          <View style={[styles.modalCard, isTablet && styles.tabletModalCard]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} style={styles.backButton}>
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                {editingPaymentMethod ? 'Edit Payment Method' : 'Add Payment Method'}
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>ID (lowercase, underscore)</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={paymentMethodId}
                  onChangeText={setPaymentMethodId}
                  placeholder="e.g., cash"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  editable={!editingPaymentMethod}
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Label</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={paymentMethodLabel}
                  onChangeText={setPaymentMethodLabel}
                  placeholder="e.g., Cash"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formSection}>
                <Text style={[styles.label, isTablet && styles.tabletLabel]}>Icon Name (Ionicons)</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.tabletInput]}
                  value={paymentMethodIcon}
                  onChangeText={setPaymentMethodIcon}
                  placeholder="e.g., cash-outline"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, isTablet && styles.tabletSaveButton]}
                onPress={handleSavePaymentMethod}
              >
                <Ionicons name="checkmark" size={isTablet ? 24 : 20} color="#fff" />
                <Text style={[styles.saveButtonText, isTablet && styles.tabletSaveButtonText]}>
                  Save Payment Method
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Currency Modal */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCurrencyModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setCurrencyModalVisible(false)}
          />
          <View style={[styles.modalCard, styles.smallModalCard, isTablet && styles.tabletModalCard]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCurrencyModalVisible(false)} style={styles.backButton}>
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                Select Currency
              </Text>
              <View style={{ width: isTablet ? 28 : 24 }} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {CURRENCIES.map((curr) => (
                <TouchableOpacity
                  key={curr.code}
                  style={[
                    styles.currencyItem,
                    isTablet && styles.tabletCurrencyItem,
                    currency === curr.code && styles.currencyItemActive
                  ]}
                  onPress={() => handleChangeCurrency(curr.code)}
                >
                  <View style={styles.currencyLeft}>
                    <Text style={[styles.currencySymbol, isTablet && styles.tabletCurrencySymbol]}>
                      {curr.symbol}
                    </Text>
                    <View>
                      <Text style={[styles.currencyCode, isTablet && styles.tabletCurrencyCode]}>
                        {curr.code}
                      </Text>
                      <Text style={[styles.currencyName, isTablet && styles.tabletCurrencyName]}>
                        {curr.name}
                      </Text>
                    </View>
                  </View>
                  {currency === curr.code && (
                    <Ionicons name="checkmark-circle" size={isTablet ? 28 : 24} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  tabletTitle: {
    fontSize: 32,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
  },
  tabletDescription: {
    fontSize: 18,
  },

  // Section
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletSectionTitle: {
    fontSize: 22,
  },
  addButton: {
    padding: 4,
  },

  // Setting Item
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabletSettingItem: {
    padding: 20,
    borderRadius: 16,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingItemText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  tabletSettingItemText: {
    fontSize: 18,
  },
  packageInfo: {
    flex: 1,
  },
  packageDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tabletPackageDetails: {
    fontSize: 16,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },

  // Empty State
  emptyState: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  smallModalCard: {
    maxHeight: '60%',
  },
  tabletModalCard: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletModalTitle: {
    fontSize: 22,
  },
  modalContent: {
    padding: 20,
  },

  // Form
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
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  tabletInput: {
    padding: 16,
    fontSize: 18,
    borderRadius: 12,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },

  // Save Button
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  tabletSaveButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
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

  // Currency Item
  currencyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  tabletCurrencyItem: {
    padding: 20,
    borderRadius: 16,
  },
  currencyItemActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  currencyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
    width: 32,
    textAlign: 'center',
  },
  tabletCurrencySymbol: {
    fontSize: 28,
    width: 40,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletCurrencyCode: {
    fontSize: 18,
  },
  currencyName: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletCurrencyName: {
    fontSize: 16,
  },
});
