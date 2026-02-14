import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  useWindowDimensions,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { databaseService } from '../services/database.service';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  
  const isTablet = width >= 768;
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    activeMembersCount: 0,
    expiringSoonCount: 0,
    pendingSyncCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const dashboardStats = await databaseService.getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push('/members');
      // TODO: Pass search query to members screen
    }
  };

  const handleQuickRenew = () => {
    router.push('/members');
    // TODO: Navigate to renew flow
  };

  const handleQuickPayment = () => {
    router.push('/payments');
    // TODO: Navigate to payment entry
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[
          styles.content,
          isTablet && styles.tabletContent
        ]}>
          {/* App Title */}
          <Text style={[
            styles.title,
            isTablet && styles.tabletTitle
          ]}>
            Escondido Thai Camp
          </Text>

          {/* Search Bar */}
          <View style={[
            styles.searchContainer,
            isTablet && styles.tabletSearchContainer
          ]}>
            <Ionicons name="search" size={isTablet ? 24 : 20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={[
                styles.searchInput,
                isTablet && styles.tabletSearchInput
              ]}
              placeholder="Search members..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={isTablet ? 24 : 20} color="#999" />
              </TouchableOpacity>
            )}
          </View>

          {/* Stats Cards */}
          {loading ? (
            <ActivityIndicator size="large" color="#2563eb" style={{ marginVertical: 40 }} />
          ) : (
            <View style={[
              styles.statsContainer,
              isTablet && styles.tabletStatsContainer
            ]}>
              {/* Active Members Card */}
              <View style={[
                styles.statCard,
                isTablet && styles.tabletStatCard
              ]}>
                <View style={styles.statIconContainer}>
                  <Ionicons name="people" size={isTablet ? 32 : 24} color="#2563eb" />
                </View>
                <Text style={[
                  styles.statValue,
                  isTablet && styles.tabletStatValue
                ]}>
                  {stats.activeMembersCount}
                </Text>
                <Text style={[
                  styles.statLabel,
                  isTablet && styles.tabletStatLabel
                ]}>
                  Active Members
                </Text>
              </View>

              {/* Expiring Soon Card */}
              <View style={[
                styles.statCard,
                isTablet && styles.tabletStatCard,
                stats.expiringSoonCount > 0 && styles.statCardWarning
              ]}>
                <View style={styles.statIconContainer}>
                  <Ionicons 
                    name="alert-circle" 
                    size={isTablet ? 32 : 24} 
                    color={stats.expiringSoonCount > 0 ? "#ea580c" : "#666"} 
                  />
                </View>
                <Text style={[
                  styles.statValue,
                  isTablet && styles.tabletStatValue,
                  stats.expiringSoonCount > 0 && styles.statValueWarning
                ]}>
                  {stats.expiringSoonCount}
                </Text>
                <Text style={[
                  styles.statLabel,
                  isTablet && styles.tabletStatLabel
                ]}>
                  Expiring Soon
                </Text>
              </View>
            </View>
          )}

          {/* Sync Status */}
          <View style={[
            styles.syncStatus,
            isTablet && styles.tabletSyncStatus
          ]}>
            <Ionicons 
              name={stats.pendingSyncCount > 0 ? "cloud-upload-outline" : "cloud-done"} 
              size={isTablet ? 20 : 16} 
              color={stats.pendingSyncCount > 0 ? "#ea580c" : "#10b981"} 
            />
            <Text style={[
              styles.syncText,
              isTablet && styles.tabletSyncText
            ]}>
              {stats.pendingSyncCount > 0 
                ? `${stats.pendingSyncCount} pending sync` 
                : 'All synced'}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={[
            styles.actionsContainer,
            isTablet && styles.tabletActionsContainer
          ]}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.primaryButton,
                isTablet && styles.tabletActionButton
              ]}
              onPress={handleQuickRenew}
            >
              <Ionicons name="refresh" size={isTablet ? 28 : 24} color="#fff" />
              <Text style={[
                styles.buttonText,
                isTablet && styles.tabletButtonText
              ]}>
                Quick Renew
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.secondaryButton,
                isTablet && styles.tabletActionButton
              ]}
              onPress={handleQuickPayment}
            >
              <Ionicons name="card" size={isTablet ? 28 : 24} color="#fff" />
              <Text style={[
                styles.buttonText,
                isTablet && styles.tabletButtonText
              ]}>
                Quick Add Payment
              </Text>
            </TouchableOpacity>
          </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  tabletContent: {
    paddingHorizontal: 40,
    paddingVertical: 32,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  
  // Title
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  tabletTitle: {
    fontSize: 36,
    marginBottom: 32,
  },
  
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tabletSearchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 32,
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
  
  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  tabletStatsContainer: {
    gap: 24,
    marginBottom: 24,
  },
  
  // Stat Card
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  tabletStatCard: {
    padding: 28,
    borderRadius: 20,
  },
  statCardWarning: {
    borderWidth: 2,
    borderColor: '#fed7aa',
  },
  statIconContainer: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletStatValue: {
    fontSize: 48,
    marginBottom: 8,
  },
  statValueWarning: {
    color: '#ea580c',
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  tabletStatLabel: {
    fontSize: 16,
  },
  
  // Sync Status
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 24,
  },
  tabletSyncStatus: {
    paddingVertical: 16,
    marginBottom: 32,
  },
  syncText: {
    fontSize: 14,
    color: '#6b7280',
  },
  tabletSyncText: {
    fontSize: 16,
  },
  
  // Action Buttons
  actionsContainer: {
    gap: 16,
  },
  tabletActionsContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tabletActionButton: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  tabletButtonText: {
    fontSize: 20,
  },
});
