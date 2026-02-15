import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import { useCurrency } from '../hooks';

const FINANCE_PIN = '1234'; // In production, this should be stored securely

export default function FinanceScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { formatCurrency } = useCurrency();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0,
    netProfit: 0,
  });

  // Load finance stats when screen comes into focus (if authenticated)
  useFocusEffect(
    React.useCallback(() => {
      if (isAuthenticated) {
        loadFinanceStats();
      }
    }, [isAuthenticated])
  );

  const loadFinanceStats = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getFinanceStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading finance stats:', error);
      Alert.alert('Error', 'Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const handlePinPress = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === FINANCE_PIN) {
          setIsAuthenticated(true);
          setPin('');
        } else {
          Alert.alert('Access Denied', 'Incorrect PIN', [
            { text: 'OK', onPress: () => setPin('') }
          ]);
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setPin('');
  };



  // PIN Entry Screen
  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.pinContainer}>
          <Ionicons name="lock-closed" size={64} color="#2563eb" />
          <Text style={[styles.pinTitle, isTablet && styles.tabletPinTitle]}>
            Enter PIN
          </Text>
          <Text style={[styles.pinSubtitle, isTablet && styles.tabletPinSubtitle]}>
            Financial data is protected
          </Text>

          {/* PIN Dots */}
          <View style={styles.pinDotsContainer}>
            {[0, 1, 2, 3].map((index) => (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  isTablet && styles.tabletPinDot,
                  index < pin.length && styles.pinDotFilled,
                ]}
              />
            ))}
          </View>

          {/* Numpad */}
          <View style={styles.numpad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['', '0', 'back'],
            ].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.numpadRow}>
                {row.map((digit) => {
                  if (digit === '') {
                    return <View key="empty" style={styles.numpadButton} />;
                  }
                  if (digit === 'back') {
                    return (
                      <TouchableOpacity
                        key="back"
                        style={[styles.numpadButton, isTablet && styles.tabletNumpadButton]}
                        onPress={handleBackspace}
                      >
                        <Ionicons
                          name="backspace-outline"
                          size={isTablet ? 32 : 28}
                          color="#374151"
                        />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={digit}
                      style={[styles.numpadButton, isTablet && styles.tabletNumpadButton]}
                      onPress={() => handlePinPress(digit)}
                    >
                      <Text style={[styles.numpadText, isTablet && styles.tabletNumpadText]}>
                        {digit}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // Finance Screen
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

      {/* Header with Lock Button */}
      <View style={[styles.header, isTablet && styles.tabletHeader]}>
        <Text style={[styles.headerTitle, isTablet && styles.tabletHeaderTitle]}>
          Financial Overview
        </Text>
        <TouchableOpacity onPress={handleLock} style={styles.lockButton}>
          <Ionicons name="lock-open" size={isTablet ? 24 : 20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.content, isTablet && styles.tabletContent]}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards Grid */}
        <View style={styles.statsGrid}>
          {/* Today Revenue Card */}
          <View style={[styles.statCard, isTablet && styles.tabletStatCard]}>
            <View style={[styles.iconBadge, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="today" size={isTablet ? 24 : 20} color="#2563eb" />
            </View>
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Today's Revenue
            </Text>
            <Text style={[styles.statValue, isTablet && styles.tabletStatValue]}>
              {formatCurrency(stats.todayRevenue)}
            </Text>
          </View>

          {/* Monthly Revenue Card */}
          <View style={[styles.statCard, isTablet && styles.tabletStatCard]}>
            <View style={[styles.iconBadge, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="trending-up" size={isTablet ? 24 : 20} color="#10b981" />
            </View>
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Monthly Revenue
            </Text>
            <Text style={[styles.statValue, isTablet && styles.tabletStatValue, { color: '#10b981' }]}>
              {formatCurrency(stats.monthlyRevenue)}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          {/* Monthly Expenses Card */}
          <View style={[styles.statCard, isTablet && styles.tabletStatCard]}>
            <View style={[styles.iconBadge, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="trending-down" size={isTablet ? 24 : 20} color="#ef4444" />
            </View>
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Monthly Expenses
            </Text>
            <Text style={[styles.statValue, isTablet && styles.tabletStatValue, { color: '#ef4444' }]}>
              {formatCurrency(stats.monthlyExpenses)}
            </Text>
          </View>

          {/* Net Profit/Loss Card */}
          <View style={[styles.statCard, isTablet && styles.tabletStatCard]}>
            <View style={[
              styles.iconBadge,
              { backgroundColor: stats.netProfit >= 0 ? '#d1fae5' : '#fee2e2' }
            ]}>
              <Ionicons
                name={stats.netProfit >= 0 ? 'cash' : 'alert-circle'}
                size={isTablet ? 24 : 20}
                color={stats.netProfit >= 0 ? '#10b981' : '#ef4444'}
              />
            </View>
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Net {stats.netProfit >= 0 ? 'Profit' : 'Loss'}
            </Text>
            <Text style={[
              styles.statValue,
              isTablet && styles.tabletStatValue,
              { color: stats.netProfit >= 0 ? '#10b981' : '#ef4444' }
            ]}>
              {formatCurrency(Math.abs(stats.netProfit))}
            </Text>
          </View>
        </View>

        {/* Info Box */}
        <View style={[styles.infoBox, isTablet && styles.tabletInfoBox]}>
          <Ionicons name="information-circle" size={20} color="#2563eb" />
          <Text style={[styles.infoText, isTablet && styles.tabletInfoText]}>
            Financial data is calculated from completed payments and recorded expenses for the current month.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  tabletHeader: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  tabletHeaderTitle: {
    fontSize: 26,
  },
  lockButton: {
    padding: 8,
  },

  // PIN Entry
  pinContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 24,
  },
  tabletPinTitle: {
    fontSize: 28,
  },
  pinSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  tabletPinSubtitle: {
    fontSize: 16,
  },
  pinDotsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 40,
    marginBottom: 40,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  tabletPinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pinDotFilled: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },

  // Numpad
  numpad: {
    gap: 16,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 16,
  },
  numpadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabletNumpadButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  numpadText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletNumpadText: {
    fontSize: 32,
  },

  // Content
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  tabletContent: {
    padding: 32,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },

  // Stat Cards
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabletStatCard: {
    padding: 24,
    borderRadius: 20,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  tabletStatLabel: {
    fontSize: 14,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  tabletStatValue: {
    fontSize: 28,
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#eff6ff',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563eb',
  },
  tabletInfoBox: {
    padding: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  tabletInfoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
