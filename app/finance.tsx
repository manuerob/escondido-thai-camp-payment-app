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
        {/* Today Revenue */}
        <View style={[styles.statCard, styles.todayCard, isTablet && styles.tabletStatCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="today-outline" size={isTablet ? 28 : 24} color="#3b82f6" />
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Today's Revenue
            </Text>
          </View>
          <Text style={[styles.statValue, isTablet && styles.tabletStatValue]}>
            {formatCurrency(stats.todayRevenue)}
          </Text>
        </View>

        {/* Monthly Revenue */}
        <View style={[styles.statCard, styles.revenueCard, isTablet && styles.tabletStatCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="trending-up" size={isTablet ? 28 : 24} color="#10b981" />
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Monthly Revenue
            </Text>
          </View>
          <Text style={[styles.statValue, isTablet && styles.tabletStatValue]}>
            {formatCurrency(stats.monthlyRevenue)}
          </Text>
        </View>

        {/* Monthly Expenses */}
        <View style={[styles.statCard, styles.expensesCard, isTablet && styles.tabletStatCard]}>
          <View style={styles.statHeader}>
            <Ionicons name="trending-down" size={isTablet ? 28 : 24} color="#ef4444" />
            <Text style={[styles.statLabel, isTablet && styles.tabletStatLabel]}>
              Monthly Expenses
            </Text>
          </View>
          <Text style={[styles.statValue, isTablet && styles.tabletStatValue]}>
            {formatCurrency(stats.monthlyExpenses)}
          </Text>
        </View>

        {/* Net Profit */}
        <View
          style={[
            styles.statCard,
            styles.profitCard,
            isTablet && styles.tabletStatCard,
            stats.netProfit < 0 && styles.lossCard,
          ]}
        >
          <View style={styles.statHeader}>
            <Ionicons
              name={stats.netProfit >= 0 ? 'cash' : 'alert-circle'}
              size={isTablet ? 28 : 24}
              color="#fff"
            />
            <Text style={[styles.statLabel, styles.profitLabel, isTablet && styles.tabletStatLabel]}>
              Net {stats.netProfit >= 0 ? 'Profit' : 'Loss'}
            </Text>
          </View>
          <Text style={[styles.statValue, styles.profitValue, isTablet && styles.tabletStatValue]}>
            {formatCurrency(Math.abs(stats.netProfit))}
          </Text>
        </View>

        {/* Info Text */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
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
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
  },
  tabletHeaderTitle: {
    fontSize: 24,
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
    padding: 16,
    paddingBottom: 32,
  },
  tabletContent: {
    padding: 24,
    maxWidth: 1000,
    alignSelf: 'center',
    width: '100%',
  },

  // Stat Cards
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  tabletStatCard: {
    padding: 28,
    borderRadius: 20,
    marginBottom: 20,
  },
  todayCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  revenueCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  expensesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  profitCard: {
    backgroundColor: '#10b981',
    borderLeftWidth: 0,
  },
  lossCard: {
    backgroundColor: '#ef4444',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabletStatLabel: {
    fontSize: 16,
  },
  profitLabel: {
    color: '#fff',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletStatValue: {
    fontSize: 40,
  },
  profitValue: {
    color: '#fff',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  tabletInfoText: {
    fontSize: 15,
  },
});
