import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { databaseService } from '../services/database.service';
import { useFocusEffect } from 'expo-router';
import type { ScheduleBlock } from '../types/database';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  
  const isTablet = width >= 768;
  const [stats, setStats] = useState({
    activeMembersCount: 0,
    expiringSoonCount: 0,
    pendingSyncCount: 0,
  });
  const [todaysBlocks, setTodaysBlocks] = useState<ScheduleBlock[]>([]);
  const [participantCounts, setParticipantCounts] = useState<{ [blockId: number]: string }>({});
  const [loading, setLoading] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Load stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadStats();
      loadTodaysSchedule();
    }, [])
  );

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

  const loadTodaysSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const blocks = await databaseService.getTodaysScheduleBlocks();
      setTodaysBlocks(blocks);
      
      // Load existing participations for today
      const today = new Date().toISOString().split('T')[0];
      const counts: { [blockId: number]: string } = {};
      
      for (const block of blocks) {
        const participation = await databaseService.getParticipation(block.id, today);
        if (participation) {
          counts[block.id] = participation.participants_count.toString();
        }
      }
      
      setParticipantCounts(counts);
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  const getBlockStatus = (block: ScheduleBlock): 'past' | 'current' | 'upcoming' => {
    const currentTime = getCurrentTime();
    if (block.end_time <= currentTime) return 'past';
    if (block.start_time <= currentTime && block.end_time > currentTime) return 'current';
    return 'upcoming';
  };

  const getTodayDateString = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const now = new Date();
    return `${days[now.getDay()]} ${now.getDate()}`;
  };

  const handleParticipantChange = (blockId: number, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setParticipantCounts(prev => ({ ...prev, [blockId]: numericValue }));
  };

  const handleSaveParticipation = async (blockId: number) => {
    const count = participantCounts[blockId];
    if (!count || count === '0') return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      await databaseService.saveParticipation({
        schedule_block_id: blockId,
        participation_date: today,
        participants_count: parseInt(count, 10),
      });
      console.log(`Saved ${count} participants for block ${blockId}`);
    } catch (error) {
      console.error('Error saving participation:', error);
    }
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

          {/* Today's Schedule */}
          <View style={[
            styles.scheduleSection,
            isTablet && styles.tabletScheduleSection
          ]}>
            <View style={styles.scheduleSectionHeader}>
              <Text style={[
                styles.sectionTitle,
                isTablet && styles.tabletSectionTitle
              ]}>
                Today's Schedule
              </Text>
              <Text style={[
                styles.dateText,
                isTablet && styles.tabletDateText
              ]}>
                {getTodayDateString()}
              </Text>
            </View>
            
            {loadingSchedule ? (
              <View style={styles.scheduleCard}>
                <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 20 }} />
              </View>
            ) : todaysBlocks.length === 0 ? (
              <View style={styles.scheduleCard}>
                <View style={styles.emptySchedule}>
                  <Ionicons name="calendar-outline" size={isTablet ? 40 : 32} color="#9ca3af" />
                  <Text style={[
                    styles.emptyScheduleText,
                    isTablet && styles.tabletEmptyScheduleText
                  ]}>
                    No blocks scheduled today
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.scheduleCard}>
                <View style={styles.scheduleBlocks}>
                  {todaysBlocks.map((block, index) => {
                    const status = getBlockStatus(block);
                    const isLast = index === todaysBlocks.length - 1;
                    
                    return (
                      <View key={block.id}>
                        <View 
                          style={[
                            styles.scheduleBlock,
                            isTablet && styles.tabletScheduleBlock,
                            status === 'past' && styles.scheduleBlockPast,
                            status === 'current' && styles.scheduleBlockCurrent,
                            { borderLeftColor: block.color || '#2563eb' }
                          ]}
                        >
                          <View style={styles.scheduleBlockHeader}>
                            <View style={styles.scheduleBlockTime}>
                              <Ionicons 
                                name={status === 'past' ? 'checkmark-circle' : status === 'current' ? 'radio-button-on' : 'time-outline'} 
                                size={isTablet ? 18 : 16} 
                                color={status === 'past' ? '#10b981' : status === 'current' ? '#f59e0b' : '#6b7280'} 
                              />
                              <Text style={[
                                styles.timeText,
                                isTablet && styles.tabletTimeText,
                                status === 'past' && styles.timeTextPast,
                                status === 'current' && styles.timeTextCurrent,
                              ]}>
                                {block.start_time}
                              </Text>
                              {status === 'current' && (
                                <View style={styles.currentBadge}>
                                  <Text style={styles.currentBadgeText}>Now</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[
                              styles.scheduleBlockTitle,
                              isTablet && styles.tabletScheduleBlockTitle,
                              status === 'past' && styles.scheduleBlockTitlePast,
                              status === 'current' && styles.scheduleBlockTitleCurrent,
                            ]}>
                              {block.title}
                            </Text>
                          </View>
                          
                          {/* Participants Input */}
                          <View style={styles.participantsRow}>
                            <Ionicons name="people-outline" size={16} color="#6b7280" />
                            <TextInput
                              style={[
                                styles.participantsInput,
                                isTablet && styles.tabletParticipantsInput
                              ]}
                              value={participantCounts[block.id] || ''}
                              onChangeText={(value) => handleParticipantChange(block.id, value)}
                              onBlur={() => handleSaveParticipation(block.id)}
                              placeholder="0"
                              keyboardType="numeric"
                              maxLength={3}
                            />
                            <Text style={styles.participantsLabel}>participants</Text>
                          </View>
                        </View>
                        {!isLast && <View style={styles.scheduleBlockDivider} />}
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

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
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 24,
  },
  tabletTitle: {
    fontSize: 36,
    marginBottom: 32,
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
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  tabletStatCard: {
    padding: 28,
    borderRadius: 20,
  },
  statCardWarning: {
    borderWidth: 2,
    borderColor: '#fdba74',
    backgroundColor: '#fffbeb',
  },
  statIconContainer: {
    marginBottom: 12,
  },
  statValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0f172a',
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
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
  },
  tabletStatLabel: {
    fontSize: 16,
  },
  
  // Schedule Section
  scheduleSection: {
    marginTop: 24,
    marginBottom: 20,
  },
  tabletScheduleSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  scheduleSectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  tabletSectionTitle: {
    fontSize: 24,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabletDateText: {
    fontSize: 16,
  },
  scheduleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  emptySchedule: {
    padding: 40,
    alignItems: 'center',
  },
  emptyScheduleText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  tabletEmptyScheduleText: {
    fontSize: 16,
  },
  scheduleBlocks: {
    paddingVertical: 4,
  },
  scheduleBlock: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 4,
    backgroundColor: '#fff',
  },
  scheduleBlockPast: {
    opacity: 0.5,
  },
  scheduleBlockCurrent: {
    backgroundColor: '#fffbeb',
  },
  tabletScheduleBlock: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  scheduleBlockHeader: {
    gap: 6,
  },
  scheduleBlockTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  timeTextPast: {
    color: '#10b981',
  },
  timeTextCurrent: {
    color: '#f59e0b',
  },
  tabletTimeText: {
    fontSize: 15,
  },
  currentBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  scheduleBlockTitlePast: {
    color: '#64748b',
  },
  scheduleBlockTitleCurrent: {
    color: '#0f172a',
  },
  tabletScheduleBlockTitle: {
    fontSize: 18,
  },
  scheduleBlockDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 16,
  },
  
  // Participants Input
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  participantsInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    minWidth: 50,
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  },
  tabletParticipantsInput: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 60,
  },
  participantsLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  
  // Sync Status
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabletSyncStatus: {
    paddingVertical: 18,
  },
  syncText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  tabletSyncText: {
    fontSize: 16,
  },
});
