import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TextInputField from './TextInputField';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const DropdownPickerModal = ({
  visible,
  title = 'Select Option',
  items,
  options,
  selectedValue,
  onSelect,
  onClose,
  allOptionLabel = 'All',
  showAllOption = true,
  searchPlaceholder = 'Search...',
}) => {
  const [search, setSearch] = useState('');

  const dataList = useMemo(() => {
    if (Array.isArray(items) && items.length > 0) return items;
    if (Array.isArray(options) && options.length > 0) return options;
    return items || options || [];
  }, [items, options]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return dataList;
    const q = search.toLowerCase();
    return dataList.filter((item) => {
      const label = (item.label || item.companyName || item.employeeName || item.name || '').toLowerCase();
      const sub = (item.subtitle || item.location || item.designation || (item.employeeId ? `ID: ${item.employeeId}` : '') || '').toLowerCase();
      return label.includes(q) || sub.includes(q);
    });
  }, [dataList, search]);

  const handleSelect = (val, itemObj) => {
    if (onSelect) {
      onSelect(val, itemObj);
    }
    setSearch('');
    if (onClose) onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <TextInputField
            placeholder={searchPlaceholder}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          {/* Options List */}
          <FlatList
            data={filteredItems}
            keyExtractor={(item, index) =>
              String(item.value || item._id || item.id || item.label || index)
            }
            showsVerticalScrollIndicator={false}
            style={styles.list}
            ListHeaderComponent={
              showAllOption && !search.trim() ? (
                <TouchableOpacity
                  style={[
                    styles.itemRow,
                    !selectedValue && styles.itemRowSelected,
                  ]}
                  onPress={() => handleSelect('', null)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemTextWrap}>
                    <Text
                      style={[
                        styles.itemLabel,
                        !selectedValue && styles.itemLabelSelected,
                      ]}
                    >
                      {allOptionLabel}
                    </Text>
                    <Text style={styles.itemSubtitle}>View all records</Text>
                  </View>
                  {!selectedValue && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const val =
                item.value !== undefined
                  ? item.value
                  : item._id !== undefined
                  ? item._id
                  : item.id !== undefined
                  ? item.id
                  : item;
              const isSelected =
                selectedValue !== undefined &&
                selectedValue !== null &&
                selectedValue !== '' &&
                (selectedValue === val || selectedValue === item._id || selectedValue === item.id || selectedValue?.id === val);
              const label =
                item.label || item.companyName || item.employeeName || item.name || '';
              const sub =
                item.subtitle ||
                item.location ||
                item.designation ||
                (item.employeeId ? `ID: ${item.employeeId}` : '') ||
                '';

              return (
                <TouchableOpacity
                  style={[styles.itemRow, isSelected && styles.itemRowSelected]}
                  onPress={() => handleSelect(val, item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemTextWrap}>
                    <Text
                      style={[
                        styles.itemLabel,
                        isSelected && styles.itemLabelSelected,
                      ]}
                    >
                      {label}
                    </Text>
                    {sub ? <Text style={styles.itemSubtitle}>{sub}</Text> : null}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No matching options found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '80%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  searchInput: {
    marginBottom: SPACING.xs,
  },
  list: {
    marginTop: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemRowSelected: {
    backgroundColor: COLORS.primarySubtle,
  },
  itemTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemLabelSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyWrap: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
});

export default DropdownPickerModal;
