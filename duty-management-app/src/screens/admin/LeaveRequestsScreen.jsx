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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import leaveApi from '../../api/leaveApi';
import employeeApi from '../../api/employeeApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportLeavesToPDF, exportLeavesToExcel } from '../../utils/exportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
];

export const LeaveRequestsScreen = () => {
  const today = formatISODateOnly();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [error, setError] = useState('');

  // Date filters (Default: Today)
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Employee filter (Default: All)
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [remarks, setRemarks] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Load employee list for dropdown filter
  const loadEmployees = useCallback(async () => {
    try {
      const res = await employeeApi.getEmployees({ limit: 200 });
      if (res.data?.employees) {
        setEmployees(
          res.data.employees.filter((e) => e.role !== 'admin' && e.email?.toLowerCase() !== 'admin@gmail.com')
        );
      }
    } catch (err) {
      console.warn('Failed to load employee list:', err);
    }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 200 };
      if (activeTab) params.status = activeTab;
      if (selectedEmployeeId) params.employeeId = selectedEmployeeId;
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await leaveApi.getAllLeaves(params);
      if (res.data?.leaves) {
        setLeaves(res.data.leaves);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load leave requests'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, selectedEmployeeId, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaves();
      loadEmployees();
    }, [fetchLeaves, loadEmployees])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  const handleExportPDF = () => {
    const selectedEmp = employees.find((e) => e._id === selectedEmployeeId);
    const filterParts = [];
    if (selectedEmp) filterParts.push(`Employee: ${selectedEmp.employeeName}`);
    if (activeTab) filterParts.push(`Status: ${activeTab.toUpperCase()}`);
    if (startDate || endDate) filterParts.push(`Date: ${startDate || 'Start'} to ${endDate || 'Present'}`);
    const filterInfo = filterParts.length > 0 ? filterParts.join(' • ') : 'All Leave Requests';

    exportLeavesToPDF({
      title: 'Company Employee Leave Records',
      subtitle: 'Official Leave Applications & Sanction Reports',
      leaves,
      filterInfo,
    });
  };

  const handleExportExcel = () => {
    exportLeavesToExcel({
      filename: 'Employee_Leave_Records',
      leaves,
    });
  };

  const handleOpenReview = (leave) => {
    setReviewTarget(leave);
    setDecision('approved');
    setRemarks('');
  };

  const handleConfirmDecision = async () => {
    if (!reviewTarget) return;
    setReviewLoading(true);

    try {
      await leaveApi.reviewLeave(reviewTarget._id, {
        status: decision,
        adminRemarks: remarks.trim(),
      });
      Alert.alert('Decision Saved', `Leave has been ${decision}`);
      setReviewTarget(null);
      fetchLeaves();
    } catch (err) {
      Alert.alert('Review Failed', extractErrorMessage(err));
    } finally {
      setReviewLoading(false);
    }
  };

  const renderLeaveItem = ({ item }) => (
    <Card style={styles.leaveCard}>
      <View style={styles.cardHeader}>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>
            {item.employee?.employeeName || 'Employee'}
          </Text>
          <Text style={styles.employeeId}>
            ID: {item.employee?.employeeId} • {item.employee?.designation}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.dateBanner}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
        <Text style={styles.dateRangeText}>
          {formatDate(item.startDate)} - {formatDate(item.endDate)}
        </Text>
      </View>

      <Text style={styles.reasonText}>"{item.reason}"</Text>

      {item.adminRemarks ? (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Admin Remarks:</Text>
          <Text style={styles.remarksText}>{item.adminRemarks}</Text>
        </View>
      ) : null}

      {item.status === 'pending' ? (
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => {
              setReviewTarget(item);
              setDecision('approved');
            }}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => {
              setReviewTarget(item);
              setDecision('rejected');
            }}
          >
            <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Leave Management"
        subtitle="Review and process employee leave requests"
      />

      <View style={styles.container}>
        {/* Filter & Export Action Toolbar */}
        <Card style={styles.toolbarCard}>
          <View style={styles.toolbarTitleRow}>
            <Text style={styles.toolbarTitle}>Filter & Export Records</Text>
            {(startDate || endDate || selectedEmployeeId) && (
              <TouchableOpacity
                onPress={() => {
                  setStartDate('');
                  setEndDate('');
                  setSelectedEmployeeId('');
                }}
              >
                <Text style={styles.clearDateLink}>Clear Filter</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Date Picker Triggers */}
          <View style={styles.dateFilterRow}>
            <View style={{ flex: 1, marginRight: SPACING.xs }}>
              <Text style={styles.filterFieldLabel}>From Date</Text>
              <TouchableOpacity
                style={styles.datePickerTrigger}
                onPress={() => setStartDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
                <Text style={styles.datePickerTriggerText}>{startDate || 'Start Date'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, marginLeft: SPACING.xs }}>
              <Text style={styles.filterFieldLabel}>To Date</Text>
              <TouchableOpacity
                style={styles.datePickerTrigger}
                onPress={() => setEndDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={15} color={COLORS.primary} />
                <Text style={styles.datePickerTriggerText}>{endDate || 'To Date'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Employee Dropdown Trigger */}
          <Text style={[styles.filterFieldLabel, { marginTop: SPACING.xs }]}>Employee</Text>
          <TouchableOpacity
            style={styles.dropdownTrigger}
            onPress={() => setEmployeeDropdownVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-outline" size={16} color={COLORS.primary} />
            <Text style={styles.dropdownTriggerText}>
              {selectedEmployeeId
                ? employees.find((e) => e._id === selectedEmployeeId)?.employeeName || 'Employee Selected'
                : 'All Employees (Default)'}
            </Text>
            <Ionicons name="chevron-down" size={15} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {/* Export Action Buttons */}
          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[styles.exportBtn, styles.pdfBtn]}
              onPress={handleExportPDF}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text" size={17} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>Export PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportBtn, styles.excelBtn]}
              onPress={handleExportExcel}
              activeOpacity={0.8}
            >
              <Ionicons name="grid" size={17} color="#FFFFFF" />
              <Text style={styles.exportBtnText}>Export Excel</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Status Filter Tabs */}
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isSelected && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, isSelected && styles.tabTextActive]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ErrorMessage message={error} onRetry={fetchLeaves} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading leave requests..." />
        ) : (
          <FlatList
            data={leaves}
            keyExtractor={(item) => item._id}
            renderItem={renderLeaveItem}
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
                title="No Leave Requests"
                description={`No ${activeTab || ''} leave applications to display.`}
              />
            }
          />
        )}
      </View>

      {/* Decision Modal */}
      <Modal
        visible={Boolean(reviewTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {decision === 'approved' ? 'Sanction Leave Request' : 'Reject Leave Request'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Employee: {reviewTarget?.employee?.employeeName} ({formatDate(reviewTarget?.startDate)} to {formatDate(reviewTarget?.endDate)})
            </Text>

            <TextInputField
              label="Admin Remarks"
              placeholder={
                decision === 'approved'
                  ? 'e.g. Approved as requested.'
                  : 'e.g. Urgent machine installations scheduled on these dates.'
              }
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setReviewTarget(null)}
                disabled={reviewLoading}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title={decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleConfirmDecision}
                loading={reviewLoading}
                style={[
                  styles.modalBtn,
                  decision === 'rejected' && { backgroundColor: COLORS.danger },
                ]}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      <DatePickerModal
        visible={startDatePickerVisible}
        onClose={() => setStartDatePickerVisible(false)}
        selectedDate={startDate}
        onSelectDate={(date) => setStartDate(date)}
        title="Select From Date"
      />

      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={endDate}
        onSelectDate={(date) => setEndDate(date)}
        title="Select To Date"
      />

      {/* Employee Dropdown */}
      <DropdownPickerModal
        visible={employeeDropdownVisible}
        onClose={() => setEmployeeDropdownVisible(false)}
        title="Filter by Staff Member"
        selectedValue={selectedEmployeeId}
        onSelect={(val) => setSelectedEmployeeId(val)}
        allOptionLabel="All Staff"
        items={employees.map((e) => ({
          label: `${e.employeeName} (${e.employeeId || 'Staff'})`,
          value: e._id,
          id: e._id,
          subtitle: `${e.designation || 'Staff'} • ${e.phoneNumber || 'No phone'}`,
        }))}
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 3,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.textLight,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  leaveCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  employeeInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  employeeId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  remarksBox: {
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  remarksText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  approveBtn: {
    backgroundColor: COLORS.success,
  },
  rejectBtn: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
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
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalBtn: {
    flex: 1,
  },
  toolbarCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  toolbarTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  toolbarTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  clearDateLink: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterFieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  datePickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
  },
  datePickerTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  dateFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
  },
  dropdownTriggerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 2,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    gap: 6,
    ...SHADOWS.sm,
  },
  pdfBtn: {
    backgroundColor: '#DC2626',
  },
  excelBtn: {
    backgroundColor: '#059669',
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});

export default LeaveRequestsScreen;
