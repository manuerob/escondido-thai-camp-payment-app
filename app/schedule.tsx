import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Calendar } from 'react-native-big-calendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { databaseService } from '../services/database.service';
import type { ScheduleBlock, RepeatType, CustomRepeatFrequency } from '../types/database';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  color?: string;
  id: number;
}

export default function ScheduleScreen() {
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduleBlock | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());

  // Form state
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [title, setTitle] = useState('');
  const [repeatType, setRepeatType] = useState<RepeatType | null>(null);
  const [customFrequency, setCustomFrequency] = useState<CustomRepeatFrequency>('weekly');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [color, setColor] = useState(COLORS[0]);

  useFocusEffect(
    React.useCallback(() => {
      loadBlocks();
    }, [])
  );

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getScheduleBlocks();
      setBlocks(data);
      
      // Convert blocks to calendar events
      const calendarEvents = convertBlocksToEvents(data);
      setEvents(calendarEvents);
    } catch (error) {
      console.error('Error loading schedule blocks:', error);
      Alert.alert('Error', 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const convertBlocksToEvents = (blocks: ScheduleBlock[]): CalendarEvent[] => {
    const now = new Date();
    const events: CalendarEvent[] = [];
    
    // Generate events for ±8 weeks from current date to handle calendar swiping
    const weeksToGenerate = 8;
    
    blocks.forEach(block => {
      if (block.specific_date) {
        // One-time block: only show on the specific date
        const specificDate = new Date(block.specific_date);
        const [startHour, startMinute] = block.start_time.split(':').map(Number);
        const [endHour, endMinute] = block.end_time.split(':').map(Number);
        
        const startDate = new Date(specificDate);
        startDate.setHours(startHour, startMinute, 0, 0);
        
        const endDate = new Date(specificDate);
        endDate.setHours(endHour, endMinute, 0, 0);
        
        events.push({
          id: block.id,
          title: block.title,
          start: startDate,
          end: endDate,
          color: block.color || COLORS[0],
        });
      } else {
        // Recurring block: generate for multiple weeks
        for (let weekOffset = -weeksToGenerate; weekOffset <= weeksToGenerate; weekOffset++) {
          const weekStart = new Date(now);
          // Get Monday of current week (1 = Monday, 0 = Sunday)
          const dayOfWeek = now.getDay();
          const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          weekStart.setDate(now.getDate() - daysFromMonday + (weekOffset * 7));
          
          // Convert day_of_week (0=Sunday) to Monday-based week (0=Monday, 6=Sunday)
          const dayOffset = block.day_of_week === 0 ? 6 : block.day_of_week - 1;
          
          const eventDate = new Date(weekStart);
          eventDate.setDate(weekStart.getDate() + dayOffset);
          
          const [startHour, startMinute] = block.start_time.split(':').map(Number);
          const [endHour, endMinute] = block.end_time.split(':').map(Number);
          
          const startDate = new Date(eventDate);
          startDate.setHours(startHour, startMinute, 0, 0);
          
          const endDate = new Date(eventDate);
          endDate.setHours(endHour, endMinute, 0, 0);
          
          events.push({
            id: block.id,
            title: block.title,
            start: startDate,
            end: endDate,
            color: block.color || COLORS[0],
          });
        }
      }
    });
    
    return events;
  };

  const handleAddBlock = (date?: Date) => {
    setEditingBlock(null);
    const selectedDay = date || new Date();
    setSelectedDate(selectedDay);
    setStartTime('09:00');
    setEndTime('10:00');
    setTitle('');
    setRepeatType(null);
    setCustomFrequency('weekly');
    setCustomStartDate(dayjs(selectedDay).format('YYYY-MM-DD'));
    setCustomEndDate(dayjs(selectedDay).add(7, 'day').format('YYYY-MM-DD'));
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndTimePicker(false);
    setColor(COLORS[0]);
    setIsModalVisible(true);
  };

  const handleEventPress = (event: CalendarEvent) => {
    Alert.alert(
      event.title,
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => handleEditBlock(event) },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteBlock(event) },
      ]
    );
  };

  const handleEditBlock = (event: CalendarEvent) => {
    const block = blocks.find(b => b.id === event.id);
    if (!block) return;
    
    setEditingBlock(block);
    setSelectedDate(event.start);
    setStartTime(block.start_time);
    setEndTime(block.end_time);
    setTitle(block.title);
    setRepeatType(null);
    setColor(block.color || COLORS[0]);
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingBlock(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Title is required');
      return;
    }

    if (startTime >= endTime) {
      Alert.alert('Validation Error', 'End time must be after start time');
      return;
    }

    if (!selectedDate) {
      Alert.alert('Validation Error', 'Date is required');
      return;
    }

    if (!editingBlock && !repeatType) {
      Alert.alert('Validation Error', 'Please select a repeat option');
      return;
    }

    if (repeatType === 'custom') {
      if (!customStartDate || !customEndDate) {
        Alert.alert('Validation Error', 'Please select start and end dates for custom repeat');
        return;
      }
      if (customStartDate > customEndDate) {
        Alert.alert('Validation Error', 'End date must be after start date');
        return;
      }
    }

    try {
      setSaving(true);

      const dayOfWeek = selectedDate.getDay();

      if (editingBlock) {
        await databaseService.updateScheduleBlock(editingBlock.id, {
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          title: title.trim(),
          color,
        });
      } else {
        if (repeatType === 'weekly') {
          // Create one block for selected day (repeats weekly forever)
          await databaseService.createScheduleBlock({
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            title: title.trim(),
            color,
          });
        } else if (repeatType === 'daily') {
          // Create blocks for all 7 days (repeats daily forever)
          for (let day = 0; day < 7; day++) {
            await databaseService.createScheduleBlock({
              day_of_week: day,
              start_time: startTime,
              end_time: endTime,
              title: title.trim(),
              color,
            });
          }
        } else if (repeatType === 'custom') {
          // Custom repeat with date range
          const startDate = dayjs(customStartDate);
          const endDate = dayjs(customEndDate);

          if (customFrequency === 'daily') {
            // Create a block for each day in the range
            let currentDate = startDate;
            while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
              await databaseService.createScheduleBlock({
                day_of_week: currentDate.day(),
                specific_date: currentDate.format('YYYY-MM-DD'),
                start_time: startTime,
                end_time: endTime,
                title: title.trim(),
                color,
              });
              currentDate = currentDate.add(1, 'day');
            }
          } else {
            // Weekly: create a block for each occurrence of the selected day in the range
            let currentDate = startDate;
            while (currentDate.isBefore(endDate) || currentDate.isSame(endDate, 'day')) {
              if (currentDate.day() === dayOfWeek) {
                await databaseService.createScheduleBlock({
                  day_of_week: dayOfWeek,
                  specific_date: currentDate.format('YYYY-MM-DD'),
                  start_time: startTime,
                  end_time: endTime,
                  title: title.trim(),
                  color,
                });
              }
              currentDate = currentDate.add(1, 'day');
            }
          }
        }
      }

      setIsModalVisible(false);
      setEditingBlock(null);
      await loadBlocks();
    } catch (error) {
      console.error('Error saving schedule block:', error);
      Alert.alert('Error', 'Failed to save schedule block');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBlock = async (event: CalendarEvent) => {
    try {
      // Find the actual block
      const block = blocks.find(b => b.id === event.id);
      if (!block) return;

      // Check if this block is part of a series
      const seriesBlocks = await databaseService.findSeriesBlocks(block.id);
      const isPartOfSeries = seriesBlocks.length > 1;

      if (isPartOfSeries) {
        // Show options for single or series delete
        Alert.alert(
          'Delete Block',
          `"${event.title}" is part of a series with ${seriesBlocks.length} blocks.\n\nWhat would you like to delete?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'This Block Only', 
              onPress: () => confirmDelete(event.id, false) 
            },
            { 
              text: `All ${seriesBlocks.length} Blocks`, 
              style: 'destructive',
              onPress: () => confirmDelete(event.id, true) 
            },
          ]
        );
      } else {
        // Single block - standard delete confirmation
        Alert.alert(
          'Delete Block',
          `Are you sure you want to delete "${event.title}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(event.id, false) },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking series:', error);
      Alert.alert('Error', 'Failed to check block series');
    }
  };

  const confirmDelete = async (id: number, deleteSeries: boolean) => {
    try {
      if (deleteSeries) {
        await databaseService.deleteScheduleBlockSeries(id);
      } else {
        await databaseService.deleteScheduleBlock(id);
      }
      await loadBlocks();
    } catch (error) {
      console.error('Error deleting schedule block:', error);
      Alert.alert('Error', 'Failed to delete schedule block');
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate) {
      setCustomStartDate(dayjs(selectedDate).format('YYYY-MM-DD'));
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate) {
      setCustomEndDate(dayjs(selectedDate).format('YYYY-MM-DD'));
    }
  };

  const handleStartTimeChange = (event: any, selectedTime?: Date) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setStartTime(`${hours}:${minutes}`);
    }
  };

  const handleEndTimeChange = (event: any, selectedTime?: Date) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      const hours = selectedTime.getHours().toString().padStart(2, '0');
      const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const getDayName = (date: Date): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  };

  const getDayNameFromNumber = (dayNum: number): string => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNum];
  };

  const getMonthYearDisplay = (): string => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[currentViewDate.getMonth()]} ${currentViewDate.getFullYear()}`;
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Weekly Schedule</Text>
          <Text style={styles.headerSubtitle}>
            {blocks.length} block{blocks.length !== 1 ? 's' : ''} scheduled
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddBlock()}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
      ) : (
        <>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthYearText}>{getMonthYearDisplay()}</Text>
          </View>
          <Calendar
            events={events}
            height={600}
            mode="week"
            weekStartsOn={1}
            date={currentViewDate}
            onSwipeEnd={(date) => setCurrentViewDate(date)}
            onPressEvent={(event) => handleEventPress(event)}
            onPressCell={(date) => handleAddBlock(date)}
            eventCellStyle={(event) => ({
              backgroundColor: event.color || COLORS[0],
            })}
            swipeEnabled={true}
            scrollOffsetMinutes={480} // Start at 8 AM
            showTime
          />
        </>
      )}

      {/* Add/Edit Block Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingBlock ? 'Edit Block' : 'New Block'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formContainer}>
              {/* Day Display */}
              <Text style={styles.label}>Day</Text>
              <View style={styles.dayDisplay}>
                <Text style={styles.dayDisplayText}>
                  {selectedDate ? getDayName(selectedDate) : 'Not selected'}
                </Text>
              </View>

              {/* Time Selectors */}
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.label}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#6b7280" />
                    <Text style={styles.dateText}>
                      {startTime}
                    </Text>
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={(() => {
                        const [hours, minutes] = startTime.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, 0, 0);
                        return date;
                      })()}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleStartTimeChange}
                    />
                  )}
                </View>

                <View style={styles.timeField}>
                  <Text style={styles.label}>End Time</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Ionicons name="time-outline" size={20} color="#6b7280" />
                    <Text style={styles.dateText}>
                      {endTime}
                    </Text>
                  </TouchableOpacity>
                  {showEndTimePicker && (
                    <DateTimePicker
                      value={(() => {
                        const [hours, minutes] = endTime.split(':').map(Number);
                        const date = new Date();
                        date.setHours(hours, minutes, 0, 0);
                        return date;
                      })()}
                      mode="time"
                      is24Hour={true}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={handleEndTimeChange}
                    />
                  )}
                </View>
              </View>

              {/* Title */}
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g., Morning Class"
              />

              {/* Repeat Option */}
              {!editingBlock && (
                <>
              <Text style={styles.label}>Repeat *</Text>
              
              <TouchableOpacity
                style={[styles.repeatOption, repeatType === 'daily' && styles.repeatOptionActive]}
                onPress={() => setRepeatType('daily')}
              >
                <View style={styles.radioOuter}>
                  {repeatType === 'daily' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.repeatTextContainer}>
                  <Text style={styles.repeatOptionTitle}>Daily</Text>
                  <Text style={styles.repeatHint}>
                    Same time every day, forever
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.repeatOption, repeatType === 'weekly' && styles.repeatOptionActive]}
                onPress={() => setRepeatType('weekly')}
              >
                <View style={styles.radioOuter}>
                  {repeatType === 'weekly' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.repeatTextContainer}>
                  <Text style={styles.repeatOptionTitle}>Weekly</Text>
                  <Text style={styles.repeatHint}>
                    Same time every {selectedDate ? getDayName(selectedDate) : 'week'}, forever
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.repeatOption, repeatType === 'custom' && styles.repeatOptionActive]}
                onPress={() => setRepeatType('custom')}
              >
                <View style={styles.radioOuter}>
                  {repeatType === 'custom' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.repeatTextContainer}>
                  <Text style={styles.repeatOptionTitle}>Custom</Text>
                  <Text style={styles.repeatHint}>
                    Choose frequency and date range
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Custom Repeat Options */}
              {repeatType === 'custom' && (
                <View style={styles.customRepeatContainer}>
                  <Text style={styles.label}>Frequency</Text>
                  <View style={styles.frequencyRow}>
                    <TouchableOpacity
                      style={[styles.frequencyButton, customFrequency === 'daily' && styles.frequencyButtonActive]}
                      onPress={() => setCustomFrequency('daily')}
                    >
                      <Text style={[styles.frequencyButtonText, customFrequency === 'daily' && styles.frequencyButtonTextActive]}>
                        Daily
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.frequencyButton, customFrequency === 'weekly' && styles.frequencyButtonActive]}
                      onPress={() => setCustomFrequency('weekly')}
                    >
                      <Text style={[styles.frequencyButtonText, customFrequency === 'weekly' && styles.frequencyButtonTextActive]}>
                        Weekly
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.label}>Date Range</Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.labelSmall}>From</Text>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowStartDatePicker(true)}
                      >
                        <Text style={styles.dateText}>
                          {customStartDate || 'Select date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                      </TouchableOpacity>
                      {showStartDatePicker && (
                        <DateTimePicker
                          value={customStartDate ? new Date(customStartDate) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={handleStartDateChange}
                        />
                      )}
                    </View>
                    <View style={styles.timeField}>
                      <Text style={styles.labelSmall}>To</Text>
                      <TouchableOpacity
                        style={styles.datePickerButton}
                        onPress={() => setShowEndDatePicker(true)}
                      >
                        <Text style={styles.dateText}>
                          {customEndDate || 'Select date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color="#6b7280" />
                      </TouchableOpacity>
                      {showEndDatePicker && (
                        <DateTimePicker
                          value={customEndDate ? new Date(customEndDate) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          onChange={handleEndDateChange}
                        />
                      )}
                    </View>
                  </View>
                </View>
              )}
              </>
              )}

              {/* Color Picker */}
              <View>
                <Text style={styles.label}>Color</Text>
                <View style={styles.colorPicker}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.colorOption,
                        { backgroundColor: c },
                        color === c && styles.colorOptionActive,
                      ]}
                      onPress={() => setColor(c)}
                    >
                      {color === c && (
                        <Ionicons name="checkmark" size={20} color="#fff" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingBlock ? 'Update' : 'Add'} Block
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 40,
  },
  calendarHeader: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
  },
  monthYearText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  formContainer: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  dayDisplay: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
  },
  dayDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeField: {
    flex: 1,
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  repeatOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  repeatOptionActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  repeatTextContainer: {
    flex: 1,
  },
  repeatOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  repeatHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  customRepeatContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  frequencyButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  frequencyButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  frequencyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  frequencyButtonTextActive: {
    color: '#fff',
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#1f2937',
  },
});
