import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import employeeApi from '../api/employeeApi';
import notificationApi from '../api/notificationApi';
import { extractErrorMessage } from '../utils/errorUtils';
import { isDeveloperAdmin } from '../utils/validators';
import { useAuth } from '../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

export const AdminSendMessageModal = ({ visible, onClose, onMessageSent }) => {
  const { user: currentUser } = useAuth();
  const [message, setMessage] = useState('');
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Fetch employees when modal opens
  const fetchEmployeesList = useCallback(async () => {
    try {
      setLoadingEmployees(true);
      setError('');
      const res = await employeeApi.getEmployees({ limit: 200 });
      if (res.data?.employees) {
        const isCurrentDev = isDeveloperAdmin(currentUser);
        // Exclude system admin / root developer accounts (unless developer is viewing)
        const staff = res.data.employees.filter(
          (e) =>
            (isCurrentDev || !isDeveloperAdmin(e)) &&
            e.role !== 'admin' &&
            e.accountStatus !== 'inactive'
        );
        setEmployees(staff);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employee directory'));
    } finally {
      setLoadingEmployees(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (visible) {
      setMessage('');
      setSendToAll(true);
      setSelectedIds([]);
      setSearchQuery('');
      setError('');
      fetchEmployeesList();
    }
  }, [visible, fetchEmployeesList]);

  // Filtered employees for multi-select
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (e) =>
        e.employeeName?.toLowerCase().includes(q) ||
        e.employeeId?.toLowerCase().includes(q) ||
        e.designation?.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  // Toggle single employee
  const toggleEmployee = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all / Clear all
  const handleSelectAll = () => {
    const allFilteredIds = filteredEmployees.map((e) => e._id);
    setSelectedIds((prev) => {
      const merged = new Set([...prev, ...allFilteredIds]);
      return Array.from(merged);
    });
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  // Submit Handler
  const handleSend = async () => {
    if (!message.trim()) {
      Alert.alert('Required', 'Please enter a message before sending.');
      return;
    }

    if (!sendToAll && selectedIds.length === 0) {
      Alert.alert(
        'Select Recipients',
        'Please select at least one employee or switch to "All Employees".'
      );
      return;
    }

    setSending(true);
    setError('');

    try {
      await notificationApi.sendMessage({
        message: message.trim(),
        sendToAll,
        recipientIds: sendToAll ? [] : selectedIds,
      });

      const recipientText = sendToAll
        ? 'all employees'
        : `${selectedIds.length} employee${selectedIds.length > 1 ? 's' : ''}`;

      Alert.alert(
        'Message Sent! 🚀',
        `Your message was successfully sent to ${recipientText}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onMessageSent) onMessageSent();
              onClose();
            },
          },
        ]
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to send message to employees'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="chatbubbles" size={22} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Send Message</Text>
                <Text style={styles.modalSubTitle}>Broadcast or targeted Employee notice</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={sending}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Field 1: Recipient Selection */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Recipients (Employees) *</Text>
              <View style={styles.recipientPillsRow}>
                <TouchableOpacity
                  style={[
                    styles.recipientPill,
                    sendToAll && styles.recipientPillActive,
                  ]}
                  onPress={() => setSendToAll(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={sendToAll ? 'checkmark-circle' : 'radio-button-off'}
                    size={16}
                    color={sendToAll ? '#FFFFFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.recipientPillText,
                      sendToAll && styles.recipientPillTextActive,
                    ]}
                  >
                    All Employees ({employees.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.recipientPill,
                    !sendToAll && styles.recipientPillActive,
                  ]}
                  onPress={() => setSendToAll(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={!sendToAll ? 'checkmark-circle' : 'radio-button-off'}
                    size={16}
                    color={!sendToAll ? '#FFFFFF' : COLORS.textSecondary}
                  />
                  <Text
                    style={[
                      styles.recipientPillText,
                      !sendToAll && styles.recipientPillTextActive,
                    ]}
                  >
                    Select Employees ({selectedIds.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {sendToAll ? (
                <View style={styles.broadcastInfoBox}>
                  <Ionicons name="megaphone" size={18} color="#059669" />
                  <Text style={styles.broadcastInfoText}>
                    Message will be sent to all {employees.length} active employees with an in-app notice & push notification.
                  </Text>
                </View>
              ) : (
                <View style={styles.employeePickerContainer}>
                  {/* Search and Quick action buttons */}
                  <View style={styles.searchRow}>
                    <View style={styles.searchInputWrap}>
                      <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                      <TextInput
                        style={styles.searchInput}
                        placeholder="Search employee..."
                        placeholderTextColor={COLORS.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                      />
                      {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                          <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.selectionActionsRow}>
                    <Text style={styles.selectedCountText}>
                      {selectedIds.length} employee{selectedIds.length === 1 ? '' : 's'} selected
                    </Text>
                    <View style={styles.quickSelectBtns}>
                      <TouchableOpacity onPress={handleSelectAll}>
                        <Text style={styles.quickSelectText}>Select All</Text>
                      </TouchableOpacity>
                      <Text style={styles.quickSelectDivider}>•</Text>
                      <TouchableOpacity onPress={handleClearAll}>
                        <Text style={styles.quickSelectText}>Clear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Employee list */}
                  {loadingEmployees ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 16 }} />
                  ) : filteredEmployees.length === 0 ? (
                    <Text style={styles.noEmployeesText}>No matching employees found</Text>
                  ) : (
                    <View style={styles.employeeListWrap}>
                      {filteredEmployees.map((emp) => {
                        const isSelected = selectedIds.includes(emp._id);
                        return (
                          <TouchableOpacity
                            key={emp._id}
                            style={[
                              styles.employeeItem,
                              isSelected && styles.employeeItemSelected,
                            ]}
                            onPress={() => toggleEmployee(emp._id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.empAvatar}>
                              <Text style={styles.empAvatarText}>
                                {(emp.employeeName || 'U').charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.empDetails}>
                              <Text style={styles.empName}>{emp.employeeName}</Text>
                              <Text style={styles.empSub}>
                                {emp.employeeId ? `ID: ${emp.employeeId} • ` : ''}
                                {emp.designation || 'Staff'}
                              </Text>
                            </View>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={22}
                              color={isSelected ? COLORS.primary : COLORS.borderFocus}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Field 2: Message Box */}
            <View style={styles.fieldSection}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Message Box *</Text>
                <Text style={styles.charCount}>{message.length} / 1000</Text>
              </View>
              <TextInput
                style={styles.messageInput}
                placeholder="Type your message or announcement to employees here..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={message}
                onChangeText={(t) => {
                  if (t.length <= 1000) setMessage(t);
                }}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerRow}>
            <View style={{ flex: 1, marginRight: SPACING.sm }}>
              <SecondaryButton
                title="Cancel"
                onPress={onClose}
                disabled={sending}
              />
            </View>
            <View style={{ flex: 1.5 }}>
              <PrimaryButton
                title={sending ? 'Sending...' : 'Send Message'}
                onPress={handleSend}
                loading={sending}
                icon="paper-plane"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    width: '100%',
    maxHeight: '88%',
    ...SHADOWS.lg,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primarySubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  scrollArea: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dangerLight,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    flex: 1,
  },
  fieldSection: {
    marginBottom: SPACING.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  charCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  recipientPillsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  recipientPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    gap: 6,
  },
  recipientPillActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  recipientPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  recipientPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  broadcastInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 8,
    marginTop: 4,
  },
  broadcastInfoText: {
    flex: 1,
    fontSize: 12.5,
    color: '#065F46',
    lineHeight: 18,
  },
  employeePickerContainer: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    backgroundColor: '#F8FAFC',
    marginTop: 4,
  },
  searchRow: {
    marginBottom: SPACING.xs,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    height: 38,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
    paddingVertical: 0,
  },
  selectionActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  selectedCountText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  quickSelectBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickSelectText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.primary,
  },
  quickSelectDivider: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  employeeListWrap: {
    maxHeight: 180,
  },
  noEmployeesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  employeeItemSelected: {
    backgroundColor: COLORS.primarySubtle,
    borderColor: COLORS.borderFocus,
  },
  empAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  empAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  empDetails: {
    flex: 1,
  },
  empName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  empSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    minHeight: 120,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

export default AdminSendMessageModal;
