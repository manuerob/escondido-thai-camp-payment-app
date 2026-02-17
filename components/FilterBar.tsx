import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, useWindowDimensions, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FilterOption {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
}

export interface FilterGroup {
  id: string;
  label?: string; // Optional label for the filter group (e.g., "Category", "Status")
  options: FilterOption[];
  activeValue: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  filters: FilterGroup[];
  isLocked?: boolean;
  onToggleLock?: () => void;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  searchPlaceholder?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  isLocked, 
  onToggleLock,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search..." 
}) => {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFilterGroup, setActiveFilterGroup] = useState<FilterGroup | null>(null);

  const handleFilterPress = (filterGroup: FilterGroup) => {
    setActiveFilterGroup(filterGroup);
    setModalVisible(true);
  };

  const handleOptionSelect = (value: string) => {
    if (activeFilterGroup) {
      activeFilterGroup.onChange(value);
    }
    setModalVisible(false);
    setActiveFilterGroup(null);
  };

  const getActiveOption = (filterGroup: FilterGroup): FilterOption => {
    return filterGroup.options.find(opt => opt.value === filterGroup.activeValue) || filterGroup.options[0];
  };

  const hasSearch = searchQuery !== undefined && onSearchChange;

  return (
    <>
      <View style={[styles.container, isTablet && styles.tabletContainer]}>
        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={[styles.scrollViewContainer, isTablet && styles.tabletScrollViewContainer]}
        >
          {filters.map((filterGroup, groupIndex) => {
            const activeOption = getActiveOption(filterGroup);
            const hasCustomColor = activeOption.color && filterGroup.activeValue !== 'all';

            return (
              <React.Fragment key={filterGroup.id}>
                {/* Render separator between groups */}
                {groupIndex > 0 && (
                  <View style={styles.separator}>
                    <View style={styles.separatorLine} />
                  </View>
                )}

                {/* Render active filter as clickable button */}
                <TouchableOpacity
                  style={[
                    styles.filterButton,
                    isTablet && styles.tabletFilterButton,
                    hasCustomColor && { 
                      backgroundColor: activeOption.color,
                      borderColor: activeOption.color,
                    },
                  ]}
                  onPress={() => handleFilterPress(filterGroup)}
                >
                  {activeOption.icon && (
                    <Ionicons
                      name={activeOption.icon}
                      size={isTablet ? 18 : 16}
                      color={hasCustomColor ? '#fff' : '#2563eb'}
                      style={styles.icon}
                    />
                  )}
                  <Text
                    style={[
                      styles.filterButtonText,
                      isTablet && styles.tabletFilterButtonText,
                      hasCustomColor && styles.filterButtonTextActive,
                    ]}
                  >
                    {activeOption.label}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={isTablet ? 18 : 16}
                    color={hasCustomColor ? '#fff' : '#2563eb'}
                  />
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </ScrollView>

        {/* Search Input */}
        {hasSearch && (
          <View style={[styles.searchContainer, isTablet && styles.tabletSearchContainer]}>
            <Ionicons name="search" size={isTablet ? 20 : 18} color="#9ca3af" />
            <TextInput
              style={[styles.searchInput, isTablet && styles.tabletSearchInput]}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={onSearchChange}
              returnKeyType="search"
            />
            {searchQuery && searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange?.('')}>
                <Ionicons name="close-circle" size={isTablet ? 20 : 18} color="#9ca3af" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Lock button for entire filter bar */}
        {onToggleLock && (
          <TouchableOpacity
            style={[styles.lockButton, isTablet && styles.tabletLockButton]}
            onPress={onToggleLock}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isLocked ? 'lock-closed' : 'lock-open-outline'}
              size={isTablet ? 22 : 20}
              color={isLocked ? '#2563eb' : '#9ca3af'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={[styles.modalContent, isTablet && styles.tabletModalContent]}>
            {activeFilterGroup && (
              <>
                {activeFilterGroup.label && (
                  <Text style={[styles.modalTitle, isTablet && styles.tabletModalTitle]}>
                    {activeFilterGroup.label}
                  </Text>
                )}
                {activeFilterGroup.options.map((option) => {
                  const isActive = activeFilterGroup.activeValue === option.value;

                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.modalOption,
                        isTablet && styles.tabletModalOption,
                        isActive && styles.modalOptionActive,
                      ]}
                      onPress={() => handleOptionSelect(option.value)}
                    >
                      {option.icon && (
                        <Ionicons
                          name={option.icon}
                          size={isTablet ? 22 : 20}
                          color={option.color || (isActive ? '#2563eb' : '#6b7280')}
                          style={styles.modalOptionIcon}
                        />
                      )}
                      <Text
                        style={[
                          styles.modalOptionText,
                          isTablet && styles.tabletModalOptionText,
                          isActive && styles.modalOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      {isActive && (
                        <Ionicons
                          name="checkmark"
                          size={isTablet ? 22 : 20}
                          color="#2563eb"
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 8,
  },
  tabletContainer: {
    paddingVertical: 14,
    flexWrap: 'nowrap',
  },
  scrollViewContainer: {
    flexGrow: 0,
    flexShrink: 1,
  },
  tabletScrollViewContainer: {
    flexGrow: 1,
    flexShrink: 0,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 12,
    marginRight: 4,
    gap: 8,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
    maxWidth: 280,
    flexBasis: 'auto',
  },
  tabletSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 280,
    maxWidth: 450,
    marginRight: 12,
    flexGrow: 0,
    flexBasis: 'auto',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
    margin: 0,
  },
  tabletSearchInput: {
    fontSize: 16,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
    alignItems: 'center',
  },
  separator: {
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  separatorLine: {
    width: 1,
    height: 24,
    backgroundColor: '#d1d5db',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#2563eb',
    gap: 6,
  },
  tabletFilterButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  icon: {
    marginRight: 2,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  tabletFilterButtonText: {
    fontSize: 16,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  lockButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabletLockButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    minWidth: 250,
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tabletModalContent: {
    minWidth: 300,
    maxWidth: 400,
    padding: 12,
    borderRadius: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabletModalTitle: {
    fontSize: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  tabletModalOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  modalOptionActive: {
    backgroundColor: '#f3f4f6',
  },
  modalOptionIcon: {
    width: 24,
  },
  modalOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  tabletModalOptionText: {
    fontSize: 17,
  },
  modalOptionTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
