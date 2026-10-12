import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import holidayApi from '../../api/holidayApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import DatePickerModal from '../../components/DatePickerModal';
import { formatDate, formatISODateOnly, isDateRangeValid } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const HolidayManagementScreen = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Modal form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayName, setHolidayName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [notify, setNotify] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Date picker visibility states
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchHolidays = useCallback(async () => {
    try {
      setError('');
      const res = await holidayApi.getHolidays();
      if (res.data?.holidays) {
        setHolidays(res.data.holidays);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load holidays'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHolidays();
  };

  const handleOpenCreate = () => {
    setEditingHoliday(null);
    setHolidayName('');
    const today = formatISODateOnly();
    setStartDate(today);
    setEndDate(today);
    setDescription('');
    setNotify(false);
    setFormError('');
    setFormVisible(true);
  };

  const handleOpenEdit = (item) => {
    setEditingHoliday(item);
    setHolidayName(item.holidayName);
    setStartDate(formatISODateOnly(item.startDate));
    setEndDate(formatISODateOnly(item.endDate));
    setDescription(item.description || '');
    setNotify(false);
    setFormError('');
    setFormVisible(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayName.trim()) {
      setFormError('Holiday name is required');
      return;
    }
    if (!startDate || !endDate) {
      setFormError('Start date and end date are required (YYYY-MM-DD)');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setFormError('End date cannot be earlier than start date');
      return;
    }

    setFormLoading(true);
    setFormError('');

    const payload = {
      holidayName: holidayName.trim(),
      startDate,
      endDate,
      description: description.trim(),
      notify,
    };

    try {
      if (editingHoliday) {
        await holidayApi.updateHoliday(editingHoliday._id, payload);
      } else {
        await holidayApi.createHoliday(payload);
      }
      setFormVisible(false);
      fetchHolidays();
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Failed to save holiday'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);

    try {
      await holidayApi.deleteHoliday(deleteTarget._id);
      setDeleteTarget(null);
      fetchHolidays();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to delete holiday'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderHolidayItem = ({ item }) => (
    <Card style={styles.holidayCard}>
      <View style={styles.cardHeader}>
        <View style={styles.headerInfo}>
          <Text style={styles.holidayName}>{item.holidayName}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
            <Text style={styles.dateText}>
              {formatDate(item.startDate)} {item.startDate !== item.endDate && `- ${formatDate(item.endDate)}`}
            </Text>
          </View>
        </View>
        <StatusBadge status={item.status} />
      </View>

      {item.description ? (
        <Text style={styles.descriptionText}>{item.description}</Text>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.actionIcon}
          onPress={() => handleOpenEdit(item)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionIcon}
          onPress={() => setDeleteTarget(item)}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Company Holidays"
        subtitle="Manage official calendar and closures"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenCreate}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color={COLORS.textLight} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        <ErrorMessage message={error} onRetry={fetchHolidays} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading holidays..." />
        ) : (
          <FlatList
            data={holidays}
            keyExtractor={(item) => item._id}
            renderItem={renderHolidayItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="calendar-outline"
                title="No Holidays Scheduled"
                description="Tap 'Add' to announce company holidays and festival closures."
                actionTitle="Add Holiday"
                onAction={handleOpenCreate}
              />
            }
          />
        )}
      </View>

      {/* Create / Edit Modal */}
      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingHoliday ? 'Edit Holiday' : 'Create Company Holiday'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <ErrorMessage message={formError} />

              <TextInputField
                label="Holiday Name"
                placeholder="e.g. Pongal Harvest Festival"
                value={holidayName}
                onChangeText={setHolidayName}
                required
              />

              {/* Start Date Picker */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Start Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => {
                    setStartDatePickerVisible((v) => !v);
                    setEndDatePickerVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.pickerBtnText}>{startDate || 'Select Start Date'}</Text>
                  <Ionicons
                    name={startDatePickerVisible ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={COLORS.textSecondary}
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>

                {startDatePickerVisible && (
                  <DatePickerModal
                    inline
                    selectedDate={startDate}
                    onSelectDate={(date) => {
                      setStartDate(date);
                      setStartDatePickerVisible(false);
                    }}
                    onClose={() => setStartDatePickerVisible(false)}
                    title="Select Holiday Start Date"
                  />
                )}
              </View>

              {/* End Date Picker */}
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>End Date *</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => {
                    setEndDatePickerVisible((v) => !v);
                    setStartDatePickerVisible(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.pickerBtnText}>{endDate || 'Select End Date'}</Text>
                  <Ionicons
                    name={endDatePickerVisible ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={COLORS.textSecondary}
                    style={{ marginLeft: 'auto' }}
                  />
                </TouchableOpacity>

                {endDatePickerVisible && (
                  <DatePickerModal
                    inline
                    selectedDate={endDate}
                    onSelectDate={(date) => {
                      setEndDate(date);
                      setEndDatePickerVisible(false);
                    }}
                    onClose={() => setEndDatePickerVisible(false)}
                    title="Select Holiday End Date"
                  />
                )}
              </View>

              <TextInputField
                label="Description (Optional)"
                placeholder="e.g. Factory will remain closed for all operations."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
              />

              {!editingHoliday && (
                <View style={styles.switchRow}>
                  <View>
                    <Text style={styles.switchLabel}>Send Push Notification</Text>
                    <Text style={styles.switchSub}>Notify all staff members via FCM</Text>
                  </View>
                  <Switch
                    value={notify}
                    onValueChange={setNotify}
                    trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                    thumbColor={notify ? COLORS.primary : '#F4F3F4'}
                  />
                </View>
              )}

              <View style={styles.modalActions}>
                <SecondaryButton
                  title="Cancel"
                  onPress={() => setFormVisible(false)}
                  disabled={formLoading}
                  style={styles.modalBtn}
                />
                <PrimaryButton
                  title={editingHoliday ? 'Save Changes' : 'Announce Holiday'}
                  onPress={handleSaveHoliday}
                  loading={formLoading}
                  style={styles.modalBtn}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        visible={Boolean(deleteTarget)}
        title="Archive Holiday"
        message={`Are you sure you want to remove "${deleteTarget?.holidayName}" from the company holiday calendar?`}
        confirmText="Remove"
        confirmVariant="danger"
        loading={deleteLoading}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteHoliday}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  addButtonText: {
    color: COLORS.textLight,
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  holidayCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  holidayName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dateText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
  },
  descriptionText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 18,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  actionIcon: {
    padding: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  switchSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  modalBtn: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  pickerBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});

export default HolidayManagementScreen;
