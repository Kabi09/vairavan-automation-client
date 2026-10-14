import React, { useState, useMemo, useEffect } from 'react';
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
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export const MultiSelectEmployeeModal = ({
  visible,
  title = 'Assign Employees',
  employees = [],
  selectedIds = [],
  onConfirm,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [draftSelected, setDraftSelected] = useState(selectedIds);

  useEffect(() => {
    if (visible) {
      setDraftSelected(selectedIds || []);
      setSearch('');
    }
  }, [visible, selectedIds]);

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((emp) => {
      const name = (emp.employeeName || '').toLowerCase();
      const empId = (emp.employeeId || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      return name.includes(q) || empId.includes(q) || desig.includes(q);
    });
  }, [employees, search]);

  const toggleSelect = (id) => {
    setDraftSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = employees.map((e) => e._id);
    setDraftSelected(allIds);
  };

  const handleClearAll = () => {
    setDraftSelected([]);
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(draftSelected);
    }
    if (onClose) {
      onClose();
    }
  };

  const renderItem = ({ item }) => {
    const isSelected = draftSelected.includes(item._id);

    return (
      <TouchableOpacity
        style={[styles.itemCard, isSelected && styles.itemCardSelected]}
        onPress={() => toggleSelect(item._id)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>

        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(item.employeeName || 'E').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={styles.employeeName}>{item.employeeName}</Text>
          <Text style={styles.employeeMeta}>
            ID: {item.employeeId || 'N/A'} • {item.designation || 'Staff'}
          </Text>
        </View>
      </TouchableOpacity>
    );
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
            <View style={styles.headerTitleRow}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
              <Text style={styles.title}>{title}</Text>
              {draftSelected.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{draftSelected.length} Selected</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity style={styles.quickActionBtn} onPress={handleSelectAll} activeOpacity={0.7}>
              <Ionicons name="checkmark-done-circle-outline" size={14} color={COLORS.primary} />
              <Text style={styles.quickActionText}>Select All ({employees.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionBtn} onPress={handleClearAll} activeOpacity={0.7}>
              <Ionicons name="close-circle-outline" size={14} color={COLORS.danger} />
              <Text style={[styles.quickActionText, { color: COLORS.danger }]}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInputField
            placeholder="Search by name, ID, or designation..."
            value={search}
            onChangeText={setSearch}
            leftIcon="search-outline"
            style={styles.searchBar}
          />

          {/* List */}
          <FlatList
            data={filteredEmployees}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="person-remove-outline" size={36} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>No employees found</Text>
              </View>
            }
          />

          {/* Footer Actions */}
          <View style={styles.footer}>
            <SecondaryButton title="Cancel" onPress={onClose} style={styles.footerBtn} />
            <PrimaryButton
              title={`Confirm (${draftSelected.length})`}
              onPress={handleConfirm}
              style={styles.footerBtn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '80%',
    display: 'flex',
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  countBadge: {
    backgroundColor: COLORS.primaryLight || '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  searchBar: {
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingVertical: SPACING.xs,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.xs,
  },
  itemCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight || '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoCol: {
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  employeeMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerBtn: {
    flex: 1,
  },
});

export default MultiSelectEmployeeModal;
