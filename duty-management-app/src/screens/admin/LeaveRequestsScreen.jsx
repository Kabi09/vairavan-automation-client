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
  ScrollView,
  TextInput,
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
import BrandingFooter from '../../components/BrandingFooter';
import DatePickerModal from '../../components/DatePickerModal';
import DropdownPickerModal from '../../components/DropdownPickerModal';
import MonthlyCalendarView from '../../components/MonthlyCalendarView';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { exportLeavesToPDF, exportLeavesToExcel } from '../../utils/exportUtils';
import { isDeveloperAdmin } from '../../utils/validators';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const STATUS_FILTER_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
];

export const LeaveRequestsScreen = () => {
  const { user: currentUser } = useAuth();
  const today = formatISODateOnly();

  // Top Section Mode: 'requests' | 'calendar' | 'balances'
  const [adminMode, setAdminMode] = useState('requests');

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStatusTab, setActiveStatusTab] = useState('pending');
  const [error, setError] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Employee filter & selection
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [calendarEmployeeId, setCalendarEmployeeId] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);
  const [employeeDropdownVisible, setEmployeeDropdownVisible] = useState(false);
  const [calendarEmployeePickerVisible, setCalendarEmployeePickerVisible] = useState(false);

  // Review modal
  const [reviewTarget, setReviewTarget] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Leave Balances & Rules state
  const [leaveConfig, setLeaveConfig] = useState(null);
  const [employeeBalancesList, setEmployeeBalancesList] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configAllowanceInput, setConfigAllowanceInput] = useState('12');
  const [configYearInput, setConfigYearInput] = useState(String(new Date().getFullYear()));
  const [savingConfig, setSavingConfig] = useState(false);

  // Individual employee allowance edit modal
  const [allowanceEditTarget, setAllowanceEditTarget] = useState(null);
  const [individualAllowanceInput, setIndividualAllowanceInput] = useState('12');
  const [savingIndividualAllowance, setSavingIndividualAllowance] = useState(false);

  // Load employee list for dropdown filter
  const loadEmployees = useCallback(async () => {
    try {
      const res = await employeeApi.getEmployees({ limit: 200 });
      if (res.data?.employees) {
        const isCurrentDev = isDeveloperAdmin(currentUser);
        const filtered = res.data.employees.filter(
          (e) => e.role !== 'admin' && (isCurrentDev || !isDeveloperAdmin(e))
        );
        setEmployees(filtered);
        if (filtered.length > 0 && !calendarEmployeeId) {
          setCalendarEmployeeId(filtered[0]._id);
        }
      }
    } catch (err) {
      console.warn('Failed to load employee list:', err);
    }
  }, [currentUser, calendarEmployeeId]);

  const fetchLeaves = useCallback(async () => {
    try {
      setError('');
      const params = { limit: 200 };
      if (activeStatusTab) params.status = activeStatusTab;
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
  }, [activeStatusTab, selectedEmployeeId, startDate, endDate]);

  const fetchBalancesAndConfig = useCallback(async () => {
    if (!employees || employees.length === 0) return;
    try {
      setLoadingBalances(true);
      const configRes = await leaveApi.getLeaveConfig().catch(() => null);
      if (configRes?.data?.config) {
        setLeaveConfig(configRes.data.config);
        setConfigAllowanceInput(String(configRes.data.config.defaultCasualLeaveAllowance || 12));
        setConfigYearInput(String(configRes.data.config.leaveYear || new Date().getFullYear()));
      }

      // Fetch balances for each employee
      const balancePromises = employees.map(async (emp) => {
        try {
          const res = await leaveApi.getLeaveBalances({ employeeId: emp._id });
          return res.data;
        } catch {
          return {
            employee: { _id: emp._id, name: emp.employeeName, employeeId: emp.employeeId },
            casualLeave: { allowance: emp.casualLeaveAllowance || 12, used: 0, available: 12 },
            compOff: { earned: 0, used: 0, available: 0 },
          };
        }
      });

      const allBalances = await Promise.all(balancePromises);
      setEmployeeBalancesList(allBalances.filter(Boolean));
    } catch (err) {
      console.warn('Failed to load employee balances & config:', err);
    } finally {
      setLoadingBalances(false);
    }
  }, [employees]);

  useFocusEffect(
    useCallback(() => {
      fetchLeaves();
      loadEmployees();
    }, [fetchLeaves, loadEmployees])
  );

  useEffect(() => {
    if (adminMode === 'balances') {
      fetchBalancesAndConfig();
    }
  }, [adminMode, fetchBalancesAndConfig]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
    if (adminMode === 'balances') {
      fetchBalancesAndConfig();
    }
  };

  const handleExportPDF = () => {
    const selectedEmp = employees.find((e) => e._id === selectedEmployeeId);
    const filterParts = [];
    if (selectedEmp) filterParts.push(`Employee: ${selectedEmp.employeeName}`);
    if (activeStatusTab) filterParts.push(`Status: ${activeStatusTab.toUpperCase()}`);
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

  const handleOpenReview = (leave, action = 'approved') => {
    setReviewTarget(leave);
    setDecision(action);
    setRemarks('');
    setRejectionReason('');
  };

  const handleConfirmDecision = async () => {
    if (!reviewTarget) return;
    setReviewLoading(true);

    try {
      await leaveApi.reviewLeave(reviewTarget._id, {
        status: decision,
        adminRemarks: remarks.trim(),
        rejectionReason: rejectionReason.trim(),
      });
      Alert.alert('Decision Saved', `Leave request has been ${decision} successfully.`);
      setReviewTarget(null);
      fetchLeaves();
    } catch (err) {
      Alert.alert('Review Failed', extractErrorMessage(err));
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await leaveApi.updateLeaveConfig({
        defaultCasualLeaveAllowance: Number(configAllowanceInput),
        leaveYear: Number(configYearInput),
      });
      Alert.alert('Rules Updated', 'Company leave rules configuration saved successfully.');
      setConfigModalVisible(false);
      fetchBalancesAndConfig();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to update leave configuration'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveIndividualAllowance = async () => {
    if (!allowanceEditTarget) return;
    setSavingIndividualAllowance(true);
    try {
      await leaveApi.updateEmployeeAllowance(allowanceEditTarget._id, {
        casualLeaveAllowance: Number(individualAllowanceInput),
      });
      Alert.alert('Updated', `CL Allowance updated for ${allowanceEditTarget.name}.`);
      setAllowanceEditTarget(null);
      fetchBalancesAndConfig();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to update employee allowance'));
    } finally {
      setSavingIndividualAllowance(false);
    }
  };

  const renderLeaveItem = ({ item }) => {
    const isCompOff = item.leaveType === 'comp_off';
    const days = item.daysCount || 1;

    return (
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

        {/* Leave Type & Days Count Row */}
        <View style={styles.leaveTypeRow}>
          <View
            style={[
              styles.leaveTypePill,
              isCompOff ? styles.compOffPill : styles.clPill,
            ]}
          >
            <Ionicons
              name={isCompOff ? 'gift' : 'calendar'}
              size={13}
              color={isCompOff ? '#2563EB' : '#DC2626'}
            />
            <Text
              style={[
                styles.leaveTypePillText,
                isCompOff ? { color: '#2563EB' } : { color: '#DC2626' },
              ]}
            >
              {isCompOff ? 'Comp-Off Leave' : 'Casual Leave (CL)'}
            </Text>
          </View>

          <View style={styles.daysCountBadge}>
            <Text style={styles.daysCountText}>
              {days} {days === 1 ? 'Working Day' : 'Working Days'}
            </Text>
          </View>
        </View>

        <View style={styles.dateBanner}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={styles.dateRangeText}>
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
        </View>

        <Text style={styles.reasonText}>"{item.reason}"</Text>

        {item.adminRemarks || item.rejectionReason ? (
          <View
            style={[
              styles.remarksBox,
              item.status === 'rejected' && styles.rejectionRemarksBox,
            ]}
          >
            <Text
              style={[
                styles.remarksLabel,
                item.status === 'rejected' && { color: '#B91C1C' },
              ]}
            >
              {item.status === 'rejected' ? 'Rejection Reason:' : 'Admin Remarks:'}
            </Text>
            <Text
              style={[
                styles.remarksText,
                item.status === 'rejected' && { color: '#991B1B' },
              ]}
            >
              {item.rejectionReason || item.adminRemarks}
            </Text>
          </View>
        ) : null}

        {item.status === 'pending' ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleOpenReview(item, 'approved')}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleOpenReview(item, 'rejected')}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
              <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </Card>
    );
  };

  const selectedCalendarEmpObj = employees.find((e) => e._id === calendarEmployeeId) || employees[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Leave & Calendar"
        subtitle="Manage employee leaves, attendances & balances"
      />

      <View style={styles.container}>
        {/* Top 3-Section Navigation Bar */}
        <View style={styles.topSegmentBar}>
          <TouchableOpacity
            style={[styles.segmentBtn, adminMode === 'requests' && styles.segmentBtnActive]}
            onPress={() => setAdminMode('requests')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text"
              size={15}
              color={adminMode === 'requests' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentBtnText,
                adminMode === 'requests' && styles.segmentBtnTextActive,
              ]}
            >
              Applications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, adminMode === 'calendar' && styles.segmentBtnActive]}
            onPress={() => setAdminMode('calendar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={adminMode === 'calendar' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentBtnText,
                adminMode === 'calendar' && styles.segmentBtnTextActive,
              ]}
            >
              Calendar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentBtn, adminMode === 'balances' && styles.segmentBtnActive]}
            onPress={() => setAdminMode('balances')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="pie-chart"
              size={15}
              color={adminMode === 'balances' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentBtnText,
                adminMode === 'balances' && styles.segmentBtnTextActive,
              ]}
            >
              Balances & Rules
            </Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================ */}
        {/* MODE 1: APPLICATIONS LIST                                     */}
        {/* ============================================================ */}
        {adminMode === 'requests' && (
          <>
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
                <Text style={styles.dropdownTriggerText} numberOfLines={1}>
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

            {/* Status Filter Chips */}
            <View style={styles.filterTabsRow}>
              {STATUS_FILTER_TABS.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterTab,
                    activeStatusTab === tab.key && styles.filterTabActive,
                  ]}
                  onPress={() => setActiveStatusTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      activeStatusTab === tab.key && styles.filterTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ErrorMessage message={error} onRetry={fetchLeaves} />

            {loading && !refreshing ? (
              <LoadingIndicator message="Loading leave applications..." />
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
                    tintColor={COLORS.primary}
                  />
                }
                ListEmptyComponent={
                  <EmptyState
                    icon="calendar-outline"
                    title="No Leave Requests Found"
                    description="No leave applications match the selected status or date filters."
                  />
                }
              />
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* MODE 2: EMPLOYEE CALENDAR                                    */}
        {/* ============================================================ */}
        {adminMode === 'calendar' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          >
            {/* Employee Selector Bar */}
            <Card style={styles.employeeSelectCard}>
              <View style={styles.empSelectRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empSelectLabel}>Selected Staff Member</Text>
                  <Text style={styles.empSelectName}>
                    {selectedCalendarEmpObj?.employeeName || 'Select Staff'}
                  </Text>
                  <Text style={styles.empSelectSub}>
                    ID: {selectedCalendarEmpObj?.employeeId || 'N/A'} • {selectedCalendarEmpObj?.designation || 'Employee'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.changeEmpBtn}
                  onPress={() => setCalendarEmployeePickerVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                  <Text style={styles.changeEmpBtnText}>Switch Staff</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {calendarEmployeeId ? (
              <MonthlyCalendarView
                employeeId={calendarEmployeeId}
                employeeName={selectedCalendarEmpObj?.employeeName}
                isAdminView={true}
                onChangeEmployee={() => setCalendarEmployeePickerVisible(true)}
              />
            ) : (
              <LoadingIndicator message="Select an employee to view calendar..." />
            )}
          </ScrollView>
        )}

        {/* ============================================================ */}
        {/* MODE 3: BALANCES & RULES CONFIGURATION                       */}
        {/* ============================================================ */}
        {adminMode === 'balances' && (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          >
            {/* Policy & Configuration Card */}
            <Card style={styles.configCard}>
              <View style={styles.configHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.configCardTitle}>Annual Leave Policy & Rules</Text>
                  <Text style={styles.configCardSub}>Company-wide default rules</Text>
                </View>
                <TouchableOpacity
                  style={styles.configEditBtn}
                  onPress={() => setConfigModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="settings-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.configEditBtnText}>Configure</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.rulesGrid}>
                <View style={styles.ruleBox}>
                  <Text style={styles.ruleLabel}>Default Annual CL</Text>
                  <Text style={styles.ruleVal}>
                    {leaveConfig?.defaultCasualLeaveAllowance ?? 12} Days / Year
                  </Text>
                </View>
                <View style={styles.ruleBox}>
                  <Text style={styles.ruleLabel}>Current Leave Year</Text>
                  <Text style={styles.ruleVal}>
                    {leaveConfig?.leaveYear ?? new Date().getFullYear()}
                  </Text>
                </View>
                <View style={styles.ruleBox}>
                  <Text style={styles.ruleLabel}>Working Days</Text>
                  <Text style={styles.ruleVal}>Monday to Saturday</Text>
                </View>
                <View style={styles.ruleBox}>
                  <Text style={styles.ruleLabel}>Weekly Holiday</Text>
                  <Text style={styles.ruleVal}>Sunday (1 Comp-Off / Attendance)</Text>
                </View>
              </View>
            </Card>

            {/* Employee Balance Table */}
            <View style={styles.balanceListHeader}>
              <Text style={styles.balanceListTitle}>Staff Leave & Comp-Off Balances</Text>
              <Text style={styles.balanceListSub}>
                Tap any staff member to customize individual CL allowance
              </Text>
            </View>

            {loadingBalances ? (
              <LoadingIndicator message="Loading staff balances..." />
            ) : (
              employeeBalancesList.map((item) => (
                <TouchableOpacity
                  key={item.employee?._id}
                  style={styles.staffBalanceCard}
                  onPress={() => {
                    setAllowanceEditTarget(item.employee);
                    setIndividualAllowanceInput(String(item.casualLeave?.allowance || 12));
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.staffHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffNameText}>{item.employee?.name}</Text>
                      <Text style={styles.staffIdText}>ID: {item.employee?.employeeId}</Text>
                    </View>
                    <View style={styles.editAllowanceBadge}>
                      <Ionicons name="pencil" size={12} color={COLORS.primary} />
                      <Text style={styles.editAllowanceBadgeText}>Edit CL</Text>
                    </View>
                  </View>

                  <View style={styles.balanceColsRow}>
                    {/* Casual Leave summary */}
                    <View style={[styles.balanceColBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <Text style={[styles.colBoxTitle, { color: '#DC2626' }]}>Casual Leave</Text>
                      <View style={styles.colMetricsRow}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.metricTinyLabel}>Allowance</Text>
                          <Text style={styles.metricValBold}>{item.casualLeave?.allowance}d</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.metricTinyLabel}>Used</Text>
                          <Text style={styles.metricValBold}>{item.casualLeave?.used}d</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.metricTinyLabel, { color: '#059669' }]}>Available</Text>
                          <Text style={[styles.metricValBold, { color: '#059669' }]}>
                            {item.casualLeave?.available}d
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Comp-Off summary */}
                    <View style={[styles.balanceColBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.colBoxTitle, { color: '#2563EB' }]}>Comp-Off</Text>
                      <View style={styles.colMetricsRow}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.metricTinyLabel}>Earned</Text>
                          <Text style={styles.metricValBold}>{item.compOff?.earned}</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.metricTinyLabel}>Used</Text>
                          <Text style={styles.metricValBold}>{item.compOff?.used}</Text>
                        </View>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={[styles.metricTinyLabel, { color: '#2563EB' }]}>Available</Text>
                          <Text style={[styles.metricValBold, { color: '#2563EB' }]}>
                            {item.compOff?.available}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        )}
      </View>

      {/* Review Modal with Rejection Reason */}
      <Modal
        visible={Boolean(reviewTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setReviewTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {decision === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {reviewTarget?.employee?.employeeName} • {reviewTarget?.leaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} ({reviewTarget?.daysCount || 1} working day(s))
            </Text>

            {decision === 'approved' ? (
              <View style={styles.approvalDeductNotice}>
                <Ionicons name="information-circle" size={18} color="#059669" />
                <Text style={styles.approvalDeductText}>
                  Approving this request will deduct {reviewTarget?.daysCount || 1} day(s) from the employee's {reviewTarget?.leaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} balance.
                </Text>
              </View>
            ) : null}

            {decision === 'rejected' ? (
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={styles.inputFieldLabel}>Rejection Reason (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Critical deployment scheduled / Insufficient coverage..."
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  multiline
                  numberOfLines={3}
                />
              </View>
            ) : null}

            <Text style={styles.inputFieldLabel}>Admin Remarks (Optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Sanctioned by Management / Have a good break..."
              value={remarks}
              onChangeText={setRemarks}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setReviewTarget(null)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title={decision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleConfirmDecision}
                loading={reviewLoading}
                variant={decision === 'approved' ? 'primary' : 'danger'}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Config Modal */}
      <Modal
        visible={configModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configure Leave Policy</Text>
            <Text style={styles.modalSubtitle}>Update global allowance & calendar settings</Text>

            <TextInputField
              label="Default Annual Casual Leave (Days)"
              value={configAllowanceInput}
              onChangeText={setConfigAllowanceInput}
              keyboardType="numeric"
              placeholder="12"
              required
            />

            <TextInputField
              label="Active Leave Year"
              value={configYearInput}
              onChangeText={setConfigYearInput}
              keyboardType="numeric"
              placeholder="2026"
              required
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setConfigModalVisible(false)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Save Policy"
                onPress={handleSaveConfig}
                loading={savingConfig}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Individual Employee CL Allowance Edit Modal */}
      <Modal
        visible={Boolean(allowanceEditTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setAllowanceEditTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Employee CL</Text>
            <Text style={styles.modalSubtitle}>
              {allowanceEditTarget?.name} (ID: {allowanceEditTarget?.employeeId})
            </Text>

            <TextInputField
              label="Annual Casual Leave Allowance (Days)"
              value={individualAllowanceInput}
              onChangeText={setIndividualAllowanceInput}
              keyboardType="numeric"
              placeholder="12"
              required
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setAllowanceEditTarget(null)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Update Allowance"
                onPress={handleSaveIndividualAllowance}
                loading={savingIndividualAllowance}
                style={styles.modalBtn}
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
        onSelectDate={setStartDate}
        title="Filter: From Date"
      />

      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={endDate}
        onSelectDate={setEndDate}
        title="Filter: To Date"
      />

      {/* Employee Dropdowns */}
      <DropdownPickerModal
        visible={employeeDropdownVisible}
        onClose={() => setEmployeeDropdownVisible(false)}
        title="Filter by Employee"
        searchPlaceholder="Search staff by name or ID..."
        items={[
          { label: 'All Employees (Default)', value: '' },
          ...employees.map((e) => ({
            label: `${e.employeeName} (${e.employeeId})`,
            value: e._id,
          })),
        ]}
        selectedValue={selectedEmployeeId}
        onSelect={(item) => setSelectedEmployeeId(item.value)}
      />

      <DropdownPickerModal
        visible={calendarEmployeePickerVisible}
        onClose={() => setCalendarEmployeePickerVisible(false)}
        title="Select Employee for Calendar"
        searchPlaceholder="Search staff by name or ID..."
        items={employees.map((e) => ({
          label: `${e.employeeName} (${e.employeeId}) - ${e.designation || 'Staff'}`,
          value: e._id,
        }))}
        selectedValue={calendarEmployeeId}
        onSelect={(item) => setCalendarEmployeeId(item.value)}
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  topSegmentBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.sm,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  filterTabsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  leaveCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  employeeId: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  leaveTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  clPill: {
    backgroundColor: '#FEE2E2',
  },
  compOffPill: {
    backgroundColor: '#DBEAFE',
  },
  leaveTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  daysCountBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  daysCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primaryDark,
  },
  reasonText: {
    fontSize: 13,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: 8,
    lineHeight: 18,
  },
  remarksBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginTop: 8,
  },
  rejectionRemarksBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  remarksLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  remarksText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbarCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  toolbarTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  toolbarTitle: {
    fontSize: 13,
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
    paddingVertical: 8,
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
    paddingVertical: 9,
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
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    gap: 6,
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
    fontSize: 12,
  },
  employeeSelectCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  empSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  empSelectLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  empSelectName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  empSelectSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  changeEmpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
  },
  changeEmpBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  configCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  configHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  configCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  configCardSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  configEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  configEditBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rulesGrid: {
    gap: 8,
  },
  ruleBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ruleLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  ruleVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  balanceListHeader: {
    marginBottom: SPACING.sm,
  },
  balanceListTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceListSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  staffBalanceCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  staffHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  staffNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  staffIdText: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  editAllowanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  editAllowanceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  balanceColsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  balanceColBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 8,
  },
  colBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  colMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricTinyLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  metricValBold: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  approvalDeductNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: RADIUS.md,
    padding: 8,
    marginBottom: SPACING.md,
  },
  approvalDeductText: {
    flex: 1,
    fontSize: 11,
    color: '#166534',
    lineHeight: 15,
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: 13,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  modalBtn: {
    flex: 1,
  },
});

export default LeaveRequestsScreen;
