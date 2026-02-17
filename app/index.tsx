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
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { databaseService } from '../services/database.service';
import { useFocusEffect, useRouter } from 'expo-router';
import type { ScheduleBlock, MemberWithSubscription } from '../types/database';

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [expiringModalVisible, setExpiringModalVisible] = useState(false);
  const [expiringMembers, setExpiringMembers] = useState<MemberWithSubscription[]>([]);
  const [loadingExpiringMembers, setLoadingExpiringMembers] = useState(false);

  // Load stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadStats();
      loadTodaysSchedule();
    }, [selectedDate])
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

  const loadExpiringMembers = async () => {
    try {
      setLoadingExpiringMembers(true);
      const allMembers = await databaseService.getMembersWithSubscriptions();
      
      // Filter for expiring soon and expired members
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filtered = allMembers.filter(member => {
        if (!member.subscription_end_date) return false;
        
        const endDate = new Date(member.subscription_end_date);
        endDate.setHours(0, 0, 0, 0);
        
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Include if expired or expires within 3 days
        return diffDays <= 3;
      });
      
      // Sort by end date (earliest first)
      filtered.sort((a, b) => {
        const dateA = new Date(a.subscription_end_date!);
        const dateB = new Date(b.subscription_end_date!);
        return dateA.getTime() - dateB.getTime();
      });
      
      setExpiringMembers(filtered);
    } catch (error) {
      console.error('Error loading expiring members:', error);
      Alert.alert('Error', 'Failed to load expiring members');
    } finally {
      setLoadingExpiringMembers(false);
    }
  };

  const handleExpiringTilePress = () => {
    loadExpiringMembers();
    setExpiringModalVisible(true);
  };

  const getDaysRemaining = (endDate: string | null): number | null => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    end.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const loadTodaysSchedule = async () => {
    try {
      setLoadingSchedule(true);
      const blocks = await databaseService.getScheduleBlocksForDate(selectedDate);
      setTodaysBlocks(blocks);
      
      // Load existing participations for selected date
      const dateString = selectedDate.toISOString().split('T')[0];
      const counts: { [blockId: number]: string } = {};
      
      for (const block of blocks) {
        const participation = await databaseService.getParticipation(block.id, dateString);
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
    const isToday = isSelectedDateToday();
    
    // Only use time-based status for today
    if (!isToday) return 'past';
    
    if (block.end_time <= currentTime) return 'past';
    if (block.start_time <= currentTime && block.end_time > currentTime) return 'current';
    return 'upcoming';
  };

  const isSelectedDateToday = (): boolean => {
    const today = new Date();
    return selectedDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  };

  const getDateString = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${days[selectedDate.getDay()]}, ${months[selectedDate.getMonth()]} ${selectedDate.getDate()}`;
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const canNavigateForward = (): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  };

  const handleParticipantChange = (blockId: number, value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    setParticipantCounts(prev => ({ ...prev, [blockId]: numericValue }));
  };

  const handleIncrementParticipants = async (blockId: number) => {
    const currentCount = parseInt(participantCounts[blockId] || '0', 10);
    const newCount = currentCount + 1;
    setParticipantCounts(prev => ({ ...prev, [blockId]: newCount.toString() }));
    await handleSaveParticipation(blockId, newCount);
  };

  const handleDecrementParticipants = async (blockId: number) => {
    const currentCount = parseInt(participantCounts[blockId] || '0', 10);
    if (currentCount > 0) {
      const newCount = currentCount - 1;
      setParticipantCounts(prev => ({ ...prev, [blockId]: newCount.toString() }));
      await handleSaveParticipation(blockId, newCount);
    }
  };

  const handleSaveParticipation = async (blockId: number, count?: number) => {
    const participantCount = count !== undefined ? count : parseInt(participantCounts[blockId] || '0', 10);
    if (participantCount === 0) return;
    
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      await databaseService.saveParticipation({
        schedule_block_id: blockId,
        participation_date: dateString,
        participants_count: participantCount,
      });
      console.log(`Saved ${participantCount} participants for block ${blockId} on ${dateString}`);
    } catch (error) {
      console.error('Error saving participation:', error);
      // If the block was deleted, show alert and reload schedule
      if (error instanceof Error && error.message.includes('deleted or non-existent')) {
        Alert.alert(
          'Block Unavailable',
          'This schedule block has been deleted. The schedule will be refreshed.',
          [{ text: 'OK', onPress: () => loadTodaysSchedule() }]
        );
      } else {
        Alert.alert('Error', 'Failed to save participant count. Please try again.');
      }
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
              <TouchableOpacity
                style={[
                  styles.statCard,
                  isTablet && styles.tabletStatCard,
                  stats.expiringSoonCount > 0 && styles.statCardWarning
                ]}
                onPress={handleExpiringTilePress}
                activeOpacity={0.7}
              >
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
              </TouchableOpacity>
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
                {isSelectedDateToday() ? "Today's Schedule" : "Schedule"}
              </Text>
              <View style={styles.dateNavigation}>
                <TouchableOpacity
                  style={[
                    styles.dateNavButton,
                    isTablet && styles.tabletDateNavButton
                  ]}
                  onPress={() => navigateDate('prev')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={isTablet ? 24 : 20} color="#2563eb" />
                </TouchableOpacity>
                <Text style={[
                  styles.dateText,
                  isTablet && styles.tabletDateText
                ]}>
                  {getDateString()}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.dateNavButton,
                    isTablet && styles.tabletDateNavButton,
                    !canNavigateForward() && styles.dateNavButtonDisabled
                  ]}
                  onPress={() => navigateDate('next')}
                  activeOpacity={0.7}
                  disabled={!canNavigateForward()}
                >
                  <Ionicons 
                    name="chevron-forward" 
                    size={isTablet ? 24 : 20} 
                    color={canNavigateForward() ? "#2563eb" : "#d1d5db"} 
                  />
                </TouchableOpacity>
              </View>
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
                          <View style={[
                            styles.scheduleBlockHeader,
                            status === 'past' && styles.scheduleBlockHeaderPast
                          ]}>
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
                            <View style={styles.participantsControls}>
                              <TouchableOpacity
                                style={[
                                  styles.participantButton,
                                  isTablet && styles.tabletParticipantButton
                                ]}
                                onPress={() => handleDecrementParticipants(block.id)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="remove" size={isTablet ? 20 : 16} color="#64748b" />
                              </TouchableOpacity>
                              <View style={[
                                styles.participantsInput,
                                isTablet && styles.tabletParticipantsInput
                              ]}>
                                <Text style={[
                                  styles.participantsValue,
                                  isTablet && styles.tabletParticipantsValue
                                ]}>
                                  {participantCounts[block.id] || '0'}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[
                                  styles.participantButton,
                                  isTablet && styles.tabletParticipantButton
                                ]}
                                onPress={() => handleIncrementParticipants(block.id)}
                                activeOpacity={0.7}
                              >
                                <Ionicons name="add" size={isTablet ? 20 : 16} color="#64748b" />
                              </TouchableOpacity>
                            </View>
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

      {/* Expiring Members Modal */}
      <Modal
        visible={expiringModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setExpiringModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTablet && styles.tabletModalContent]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Ionicons name="alert-circle" size={isTablet ? 28 : 24} color="#ea580c" />
                <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                  Expiring & Expired Members
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setExpiringModalVisible(false)}
                style={styles.modalCloseButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={isTablet ? 28 : 24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {loadingExpiringMembers ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color="#2563eb" />
              </View>
            ) : expiringMembers.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="checkmark-circle" size={isTablet ? 56 : 48} color="#10b981" />
                <Text style={[styles.modalEmptyText, isTablet && styles.tabletModalEmptyText]}>
                  No members expiring soon
                </Text>
              </View>
            ) : (
              <FlatList
                data={expiringMembers}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => {
                  const daysRemaining = getDaysRemaining(item.subscription_end_date);
                  const isExpired = daysRemaining !== null && daysRemaining < 0;
                  const isExpiresToday = daysRemaining === 0;
                  
                  return (
                    <TouchableOpacity
                      style={[styles.memberItem, isTablet && styles.tabletMemberItem]}
                      onPress={() => {
                        setExpiringModalVisible(false);
                        router.push(`/member-detail?id=${item.id}&returnTo=home`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.memberItemContent}>
                        <View style={styles.memberItemInfo}>
                          <Text style={[styles.memberItemName, isTablet && styles.tabletMemberItemName]}>
                            {item.first_name} {item.last_name}
                          </Text>
                          {item.package_name && (
                            <Text style={[styles.memberItemPackage, isTablet && styles.tabletMemberItemPackage]}>
                              {item.package_name}
                            </Text>
                          )}
                          {item.subscription_end_date && (
                            <Text style={[styles.memberItemDate, isTablet && styles.tabletMemberItemDate]}>
                              End: {formatDate(item.subscription_end_date)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.memberItemStatus}>
                          {isExpired ? (
                            <View style={[styles.statusBadgeExpired, isTablet && styles.tabletStatusBadge]}>
                              <Ionicons name="close-circle" size={isTablet ? 18 : 16} color="#fff" />
                              <Text style={[styles.statusBadgeText, isTablet && styles.tabletStatusBadgeText]}>
                                Expired
                              </Text>
                            </View>
                          ) : isExpiresToday ? (
                            <View style={[styles.statusBadgeToday, isTablet && styles.tabletStatusBadge]}>
                              <Ionicons name="alert-circle" size={isTablet ? 18 : 16} color="#fff" />
                              <Text style={[styles.statusBadgeText, isTablet && styles.tabletStatusBadgeText]}>
                                Today
                              </Text>
                            </View>
                          ) : (
                            <View style={[styles.statusBadgeExpiring, isTablet && styles.tabletStatusBadge]}>
                              <Ionicons name="time" size={isTablet ? 18 : 16} color="#fff" />
                              <Text style={[styles.statusBadgeText, isTablet && styles.tabletStatusBadgeText]}>
                                {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={isTablet ? 22 : 20} color="#9ca3af" />
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
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
  dateNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  dateNavButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletDateNavButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  dateNavButtonDisabled: {
    opacity: 0.4,
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
    // Opacity removed - applied to header only
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
  scheduleBlockHeaderPast: {
    opacity: 0.5,
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
  participantsControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  participantButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletParticipantButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  participantsInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  tabletParticipantsInput: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 60,
  },
  participantsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  tabletParticipantsValue: {
    fontSize: 16,
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  tabletModalContent: {
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  tabletModalTitle: {
    fontSize: 24,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalLoading: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmpty: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 16,
  },
  tabletModalEmptyText: {
    fontSize: 18,
  },
  modalList: {
    padding: 16,
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  tabletMemberItem: {
    padding: 18,
    borderRadius: 16,
  },
  memberItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  memberItemInfo: {
    flex: 1,
  },
  memberItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  tabletMemberItemName: {
    fontSize: 18,
  },
  memberItemPackage: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  tabletMemberItemPackage: {
    fontSize: 15,
  },
  memberItemDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  tabletMemberItemDate: {
    fontSize: 14,
  },
  memberItemStatus: {
    alignItems: 'flex-end',
  },
  statusBadgeExpired: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeExpiring: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusBadgeToday: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ea580c',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabletStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  tabletStatusBadgeText: {
    fontSize: 14,
  },
});
