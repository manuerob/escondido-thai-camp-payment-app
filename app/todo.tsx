import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { databaseService } from '../services/database.service';
import type { Todo } from '../types/database';

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Load todos when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadTodos();
    }, [showArchived])
  );

  const loadTodos = async () => {
    try {
      setLoading(true);
      const data = await databaseService.getTodos(showArchived);
      setTodos(data);
    } catch (error) {
      console.error('Error loading todos:', error);
      Alert.alert('Error', 'Failed to load todos');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTodos();
    setRefreshing(false);
  };

  const handleAddTodo = () => {
    setIsModalVisible(true);
    setNewTodoTitle('');
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
  };

  const handleSaveTodo = async () => {
    if (!newTodoTitle.trim()) {
      Alert.alert('Validation Error', 'Todo title is required');
      return;
    }

    try {
      setSaving(true);
      await databaseService.createTodo({
        title: newTodoTitle.trim(),
        is_checked: false,
        is_archived: false,
      });
      setIsModalVisible(false);
      setNewTodoTitle('');
      await loadTodos();
    } catch (error) {
      console.error('Error creating todo:', error);
      Alert.alert('Error', 'Failed to create todo');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCheck = async (todo: Todo) => {
    try {
      await databaseService.toggleTodoCheck(todo.id);
      await loadTodos();
    } catch (error) {
      console.error('Error toggling todo:', error);
      Alert.alert('Error', 'Failed to update todo');
    }
  };

  const handleArchiveTodo = async (id: number) => {
    try {
      await databaseService.archiveTodo(id);
      await loadTodos();
    } catch (error) {
      console.error('Error archiving todo:', error);
      Alert.alert('Error', 'Failed to archive todo');
    }
  };

  const handleDeleteTodo = (todo: Todo) => {
    Alert.alert(
      'Delete Todo',
      `Are you sure you want to delete "${todo.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => confirmDelete(todo.id) },
      ]
    );
  };

  const confirmDelete = async (id: number) => {
    try {
      await databaseService.deleteTodo(id);
      await loadTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
      Alert.alert('Error', 'Failed to delete todo');
    }
  };

  const renderTodoItem = ({ item }: { item: Todo }) => (
    <View style={styles.todoItem}>
      <TouchableOpacity
        style={styles.todoCheckbox}
        onPress={() => handleToggleCheck(item)}
      >
        <Ionicons
          name={item.is_checked ? 'checkbox' : 'square-outline'}
          size={28}
          color={item.is_checked ? '#10b981' : '#6b7280'}
        />
      </TouchableOpacity>
      
      <View style={styles.todoContent}>
        <Text
          style={[
            styles.todoTitle,
            item.is_checked && styles.todoTitleChecked,
          ]}
        >
          {item.title}
        </Text>
        {item.is_archived && (
          <Text style={styles.archivedBadge}>Archived</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteTodo(item)}
      >
        <Ionicons name="trash-outline" size={20} color="#ef4444" />
      </TouchableOpacity>
    </View>
  );

  const activeTodos = todos.filter(t => !t.is_checked && !t.is_archived);
  const completedTodos = todos.filter(t => t.is_checked && !t.is_archived);
  const archivedTodos = todos.filter(t => t.is_archived);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>To Do List</Text>
          <Text style={styles.headerSubtitle}>
            {activeTodos.length} active • {completedTodos.length} completed
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.archiveToggleButton}
          onPress={() => setShowArchived(!showArchived)}
        >
          <Ionicons
            name={showArchived ? 'eye-off-outline' : 'archive-outline'}
            size={24}
            color="#3b82f6"
          />
        </TouchableOpacity>
      </View>

      {/* Todo List */}
      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />
      ) : (
        <FlatList
          data={todos}
          renderItem={renderTodoItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyText}>No todos yet</Text>
              <Text style={styles.emptySubtext}>
                Tap the + button to add your first todo
              </Text>
            </View>
          }
        />
      )}

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddTodo}>
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      {/* Add Todo Modal */}
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
              <Text style={styles.modalTitle}>New Todo</Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="What do you need to do?"
              value={newTodoTitle}
              onChangeText={setNewTodoTitle}
              autoFocus
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTodo}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Add Todo</Text>
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
  archiveToggleButton: {
    padding: 8,
  },
  loader: {
    marginTop: 40,
  },
  listContent: {
    padding: 16,
  },
  todoItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  todoCheckbox: {
    marginRight: 12,
  },
  todoContent: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 22,
  },
  todoTitleChecked: {
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  archivedBadge: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
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
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
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
});
