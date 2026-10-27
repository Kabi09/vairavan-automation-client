import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
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

  // Admin direct grant leave state (Assign leave without employee request)
  const [grantModalVisible, setGrantModalVisible] = useState(false);
  const [grantEmployeeId, setGrantEmployeeId] = useState('');
  const [showGrantEmployeeSelector, setShowGrantEmployeeSelector] = useState(false);
  const [grantEmployeeSearch, setGrantEmployeeSearch] = useState('');
  const [grantLeaveType, setGrantLeaveType] = useState('casual_leave'); // 'casual_leave' | 'comp_off'
  const [grantStartDate, setGrantStartDate] = useState(today);
  const [grantEndDate, setGrantEndDate] = useState(today);
  const [grantDatePickerActive, setGrantDatePickerActive] = useState(null); // 'start' | 'end' | null
  const [grantReason, setGrantReason] = useState('Management Assigned Leave');
  const [grantAdminRemarks, setGrantAdminRemarks] = useState('Sanctioned directly by Admin');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantEmployeeBalances, setGrantEmployeeBalances] = useState(null);
  const [loadingGrantBalances, setLoadingGrantBalances] = useState(false);

  // Filtered employees for inline staff selector inside grant modal
  const filteredGrantEmployees = useMemo(() => {
    if (!employees || employees.length === 0) return [];
    if (!grantEmployeeSearch.trim()) return employees;
    const q = grantEmployeeSearch.toLowerCase().trim();
    return employees.filter(
      (e) =>
        (e.employeeName && e.employeeName.toLowerCase().includes(q)) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
        (e.designation && e.designation.toLowerCase().includes(q))
    );
  }, [employees, grantEmployeeSearch]);


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

  const handleOpenGrantModal = (preselectedEmpId = null) => {
    const targetId = preselectedEmpId || selectedEmployeeId || (employees[0]?._id ?? '');
    setGrantEmployeeId(targetId);
    setGrantLeaveType('casual_leave');
    setGrantStartDate(today);
    setGrantEndDate(today);
    setGrantReason('Management Assigned Leave');
    setGrantAdminRemarks('Sanctioned directly by Admin');
    setShowGrantEmployeeSelector(false);
    setGrantEmployeeSearch('');
    setGrantDatePickerActive(null);
    setGrantModalVisible(true);
    if (targetId) {
      fetchGrantEmployeeBalances(targetId);
    }
  };

  const fetchGrantEmployeeBalances = async (empId) => {
    if (!empId) return;
    try {
      setLoadingGrantBalances(true);
      const res = await leaveApi.getLeaveBalances({ employeeId: empId });
      if (res.data) {
        setGrantEmployeeBalances(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch grant employee balances:', err);
    } finally {
      setLoadingGrantBalances(false);
    }
  };

  const calculateWorkingDaysCount = (sStr, eStr) => {
    if (!sStr || !eStr) return 0;
    const s = new Date(sStr);
    const e = new Date(eStr);
    if (e < s) return 0;
    let count = 0;
    let curr = new Date(s);
    while (curr <= e) {
      if (curr.getDay() !== 0) count++;
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  };

  const handleConfirmGrantLeave = async () => {
    if (!grantEmployeeId) {
      Alert.alert('Required', 'Please select an employee.');
      return;
    }
    if (!grantStartDate || !grantEndDate) {
      Alert.alert('Required', 'Please select start and end dates.');
      return;
    }

    const workingDays = calculateWorkingDaysCount(grantStartDate, grantEndDate);
    if (workingDays <= 0) {
      Alert.alert(
        'Invalid Date Range',
        'Selected date range contains no scheduled working days. Sundays are weekly holidays and excluded.'
      );
      return;
    }

    if (grantEmployeeBalances) {
      if (grantLeaveType === 'casual_leave') {
        const avail = grantEmployeeBalances.casualLeave?.available ?? 0;
        if (workingDays > avail) {
          Alert.alert(
            'Insufficient Balance',
            `Selected employee has only ${avail} available Casual Leave day(s), but this grant requires ${workingDays} working day(s).`
          );
          return;
        }
      } else if (grantLeaveType === 'comp_off') {
        const avail = grantEmployeeBalances.compOff?.available ?? 0;
        if (workingDays > avail) {
          Alert.alert(
            'Insufficient Comp-Off',
            `Selected employee has only ${avail} available Comp-Off credit(s), but this grant requires ${workingDays} working day(s).`
          );
          return;
        }
      }
    }

    setGrantSubmitting(true);
    try {
      await leaveApi.adminGrantLeave({
        employeeId: grantEmployeeId,
        leaveType: grantLeaveType,
        startDate: grantStartDate,
        endDate: grantEndDate,
        reason: grantReason.trim() || 'Assigned by Administrator',
        adminRemarks: grantAdminRemarks.trim() || 'Granted directly by Admin',
      });

      const selectedEmp = employees.find((e) => e._id === grantEmployeeId);
      Alert.alert(
        'Leave Granted & Approved',
        `${grantLeaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} of ${workingDays} working day(s) has been successfully granted and approved for ${selectedEmp?.employeeName || 'employee'}.`
      );
      setGrantModalVisible(false);
      fetchLeaves();
      fetchBalancesAndConfig();
    } catch (err) {
      Alert.alert('Grant Failed', extractErrorMessage(err, 'Failed to grant employee leave'));
    } finally {
      setGrantSubmitting(false);
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
        {/* Quick Admin Grant Leave Action Banner */}
        <TouchableOpacity
          style={styles.grantLeaveBanner}
          onPress={() => handleOpenGrantModal()}
          activeOpacity={0.85}
        >
          <View style={styles.grantLeaveIconWrap}>
            <Ionicons name="person-add" size={17} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.grantLeaveBannerTitle}>Assign Leave to Staff</Text>
            <Text style={styles.grantLeaveBannerSub}>Directly sanction CL or Comp-Off without request</Text>
          </View>
          <View style={styles.grantLeaveAddChip}>
            <Ionicons name="add" size={14} color={COLORS.primary} />
            <Text style={styles.grantLeaveAddChipText}>Add Leave</Text>
          </View>
        </TouchableOpacity>

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={styles.empCardAssignBtn}
                        onPress={() => handleOpenGrantModal(item.employee?._id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="add-circle" size={13} color="#059669" />
                        <Text style={styles.empCardAssignBtnText}>Assign Leave</Text>
                      </TouchableOpacity>
                      <View style={styles.editAllowanceBadge}>
                        <Ionicons name="pencil" size={12} color={COLORS.primary} />
                        <Text style={styles.editAllowanceBadgeText}>Edit CL</Text>
                      </View>
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
        onSelect={(val, item) => setSelectedEmployeeId(typeof val === 'string' ? val : (item?.value ?? ''))}
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
        onSelect={(val, item) => setCalendarEmployeeId(typeof val === 'string' ? val : (item?.value ?? ''))}
      />

      {/* Admin Direct Grant Leave Modal */}
      <Modal
        visible={grantModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setGrantModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.grantModalContainer}>
            {/* Header */}
            <View style={styles.grantModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View style={styles.grantModalIconWrap}>
                  <Ionicons name="person-add" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.grantModalTitle}>Assign Leave to Staff</Text>
                  <Text style={styles.grantModalSubtitle}>
                    Sanction approved leave directly without employee request
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setGrantModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.grantModalBody} showsVerticalScrollIndicator={false}>
              {/* Employee Selection (Inline Searchable Selector - No Nested Modal) */}
              <View style={{ marginBottom: SPACING.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={styles.inputFieldLabel}>Select Staff Member</Text>
                  {showGrantEmployeeSelector ? (
                    <TouchableOpacity
                      onPress={() => setShowGrantEmployeeSelector(false)}
                      style={styles.collapseSelectorBtn}
                    >
                      <Ionicons name="checkmark-done" size={14} color={COLORS.primary} />
                      <Text style={styles.collapseSelectorBtnText}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Selected Employee Card / Expand Trigger */}
                <TouchableOpacity
                  style={[
                    styles.grantEmpPickerTrigger,
                    showGrantEmployeeSelector && styles.grantEmpPickerTriggerActive,
                  ]}
                  onPress={() => setShowGrantEmployeeSelector(!showGrantEmployeeSelector)}
                  activeOpacity={0.8}
                >
                  <View style={styles.empAvatarCircle}>
                    <Text style={styles.empAvatarText}>
                      {(employees.find((e) => e._id === grantEmployeeId)?.employeeName || 'EM')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.grantEmpPickerName}>
                      {employees.find((e) => e._id === grantEmployeeId)?.employeeName || 'Tap to choose staff member'}
                    </Text>
                    {grantEmployeeId ? (
                      <Text style={styles.grantEmpPickerSub}>
                        ID: {employees.find((e) => e._id === grantEmployeeId)?.employeeId} • {employees.find((e) => e._id === grantEmployeeId)?.designation || 'Staff'}
                      </Text>
                    ) : (
                      <Text style={styles.grantEmpPickerSub}>Select an employee to assign leave</Text>
                    )}
                  </View>
                  <View style={styles.changeEmpPill}>
                    <Text style={styles.changeEmpPillText}>
                      {showGrantEmployeeSelector ? 'Close' : 'Change'}
                    </Text>
                    <Ionicons
                      name={showGrantEmployeeSelector ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={COLORS.primary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expandable Staff Member List with Instant Search */}
                {showGrantEmployeeSelector && (
                  <View style={styles.inlineEmpListContainer}>
                    <View style={styles.inlineEmpSearchBar}>
                      <Ionicons name="search" size={16} color={COLORS.textSecondary} />
                      <TextInput
                        style={styles.inlineEmpSearchInput}
                        placeholder="Search staff by name, ID, or designation..."
                        value={grantEmployeeSearch}
                        onChangeText={setGrantEmployeeSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {grantEmployeeSearch.length > 0 && (
                        <TouchableOpacity onPress={() => setGrantEmployeeSearch('')}>
                          <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
                        </TouchableOpacity>
                      )}
                    </View>

                    <ScrollView
                      style={styles.inlineEmpScroll}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={true}
                    >
                      {filteredGrantEmployees.length === 0 ? (
                        <View style={styles.inlineEmpEmpty}>
                          <Text style={styles.inlineEmpEmptyText}>
                            No staff found matching "{grantEmployeeSearch}"
                          </Text>
                        </View>
                      ) : (
                        filteredGrantEmployees.map((emp) => {
                          const isSelected = emp._id === grantEmployeeId;
                          return (
                            <TouchableOpacity
                              key={emp._id}
                              style={[
                                styles.inlineEmpItem,
                                isSelected && styles.inlineEmpItemSelected,
                              ]}
                              onPress={() => {
                                setGrantEmployeeId(emp._id);
                                fetchGrantEmployeeBalances(emp._id);
                                setShowGrantEmployeeSelector(false);
                                setGrantEmployeeSearch('');
                              }}
                              activeOpacity={0.7}
                            >
                              <View style={[styles.inlineEmpItemAvatar, isSelected && { backgroundColor: COLORS.primary }]}>
                                <Text style={[styles.inlineEmpItemAvatarText, isSelected && { color: '#FFFFFF' }]}>
                                  {(emp.employeeName || 'EM')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={[styles.inlineEmpItemName, isSelected && { color: COLORS.primary, fontWeight: '800' }]}>
                                  {emp.employeeName}
                                </Text>
                                <Text style={styles.inlineEmpItemSub}>
                                  ID: {emp.employeeId} • {emp.designation || 'Staff'}
                                </Text>
                              </View>
                              {isSelected ? (
                                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                              ) : (
                                <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                              )}
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Real-time Balances Preview for Selected Employee */}
              {grantEmployeeId ? (
                <View style={styles.grantBalanceCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={styles.grantBalanceTitle}>Available Staff Balance</Text>
                    {loadingGrantBalances ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : null}
                  </View>
                  <View style={styles.grantBalanceRow}>
                    <View style={[styles.grantBalancePill, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                      <Text style={[styles.grantBalancePillLabel, { color: '#DC2626' }]}>Casual Leave (CL)</Text>
                      <Text style={[styles.grantBalancePillVal, { color: '#DC2626' }]}>
                        {grantEmployeeBalances?.casualLeave?.available ?? '--'} days left
                      </Text>
                    </View>
                    <View style={[styles.grantBalancePill, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                      <Text style={[styles.grantBalancePillLabel, { color: '#2563EB' }]}>Comp-Off</Text>
                      <Text style={[styles.grantBalancePillVal, { color: '#2563EB' }]}>
                        {grantEmployeeBalances?.compOff?.available ?? '--'} credits
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Leave Type Switcher */}
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={styles.inputFieldLabel}>Leave Type</Text>
                <View style={styles.grantTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.grantTypeBtn,
                      grantLeaveType === 'casual_leave' && styles.grantTypeBtnCLActive,
                    ]}
                    onPress={() => setGrantLeaveType('casual_leave')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="time"
                      size={18}
                      color={grantLeaveType === 'casual_leave' ? '#DC2626' : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.grantTypeBtnText,
                        grantLeaveType === 'casual_leave' && { color: '#DC2626', fontWeight: '800' },
                      ]}
                    >
                      Casual Leave (CL)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.grantTypeBtn,
                      grantLeaveType === 'comp_off' && styles.grantTypeBtnCompOffActive,
                    ]}
                    onPress={() => setGrantLeaveType('comp_off')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="gift"
                      size={18}
                      color={grantLeaveType === 'comp_off' ? '#2563EB' : COLORS.textSecondary}
                    />
                    <Text
                      style={[
                        styles.grantTypeBtnText,
                        grantLeaveType === 'comp_off' && { color: '#2563EB', fontWeight: '800' },
                      ]}
                    >
                      Comp-Off
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start Date & End Date Selection with Calendar Component */}
              <View style={{ marginBottom: SPACING.md }}>
                <View style={styles.grantDateRow}>
                  {/* Start Date Trigger */}
                  <View style={{ flex: 1, marginRight: SPACING.xs }}>
                    <Text style={styles.inputFieldLabel}>Start Date *</Text>
                    <TouchableOpacity
                      style={[
                        styles.grantDateTrigger,
                        grantDatePickerActive === 'start' && styles.grantDateTriggerActive,
                      ]}
                      onPress={() =>
                        setGrantDatePickerActive((prev) => (prev === 'start' ? null : 'start'))
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.grantDateTriggerText}>{grantStartDate || 'Select'}</Text>
                      <Ionicons
                        name={grantDatePickerActive === 'start' ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={COLORS.textSecondary}
                        style={{ marginLeft: 'auto' }}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* End Date Trigger */}
                  <View style={{ flex: 1, marginLeft: SPACING.xs }}>
                    <Text style={styles.inputFieldLabel}>End Date *</Text>
                    <TouchableOpacity
                      style={[
                        styles.grantDateTrigger,
                        grantDatePickerActive === 'end' && styles.grantDateTriggerActive,
                      ]}
                      onPress={() =>
                        setGrantDatePickerActive((prev) => (prev === 'end' ? null : 'end'))
                      }
                      activeOpacity={0.8}
                    >
                      <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.grantDateTriggerText}>{grantEndDate || 'Select'}</Text>
                      <Ionicons
                        name={grantDatePickerActive === 'end' ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={COLORS.textSecondary}
                        style={{ marginLeft: 'auto' }}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Inline Calendar Component for Start Date */}
                {grantDatePickerActive === 'start' && (
                  <View style={styles.calendarInlineWrapper}>
                    <DatePickerModal
                      inline={true}
                      title="Select Start Date"
                      selectedDate={grantStartDate}
                      onSelectDate={(date) => {
                        setGrantStartDate(date);
                        if (grantEndDate < date) {
                          setGrantEndDate(date);
                        }
                        setGrantDatePickerActive(null);
                      }}
                      onClose={() => setGrantDatePickerActive(null)}
                    />
                  </View>
                )}

                {/* Inline Calendar Component for End Date */}
                {grantDatePickerActive === 'end' && (
                  <View style={styles.calendarInlineWrapper}>
                    <DatePickerModal
                      inline={true}
                      title="Select End Date"
                      selectedDate={grantEndDate}
                      minDate={grantStartDate}
                      onSelectDate={(date) => {
                        setGrantEndDate(date);
                        setGrantDatePickerActive(null);
                      }}
                      onClose={() => setGrantDatePickerActive(null)}
                    />
                  </View>
                )}

                {/* Duration Hint */}
                <View style={styles.durationNoticeBox}>
                  <Ionicons name="information-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.durationNoticeText}>
                    Duration: {calculateWorkingDaysCount(grantStartDate, grantEndDate)} working day(s) • Sundays excluded
                  </Text>
                </View>
              </View>

              {/* Reason & Quick Presets */}
              <View style={{ marginBottom: SPACING.md }}>
                <Text style={styles.inputFieldLabel}>Reason / Purpose</Text>
                <View style={styles.presetChipsWrap}>
                  {['Management Granted', 'Medical Emergency', 'Official Permission', 'Compensatory Off', 'Personal Leave'].map(
                    (preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetChip,
                          grantReason === preset && styles.presetChipActive,
                        ]}
                        onPress={() => setGrantReason(preset)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            grantReason === preset && styles.presetChipTextActive,
                          ]}
                        >
                          {preset}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>

                <TextInput
                  style={[styles.modalInput, { minHeight: 60 }]}
                  placeholder="Enter reason for assigning leave..."
                  value={grantReason}
                  onChangeText={setGrantReason}
                  multiline
                  numberOfLines={2}
                />
              </View>

              {/* Admin Remarks / Notes */}
              <View style={{ marginBottom: SPACING.lg }}>
                <Text style={styles.inputFieldLabel}>Admin Remarks (Optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Sanctioned by Management..."
                  value={grantAdminRemarks}
                  onChangeText={setGrantAdminRemarks}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setGrantModalVisible(false)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title="Grant & Approve Leave"
                onPress={handleConfirmGrantLeave}
                loading={grantSubmitting}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

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
  // Grant Leave Banner
  grantLeaveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  grantLeaveIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantLeaveBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  grantLeaveBannerSub: {
    fontSize: 10,
    fontWeight: '500',
    color: '#E0E7FF',
    marginTop: 1,
  },
  grantLeaveAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  grantLeaveAddChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
  },
  empCardAssignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  empCardAssignBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  // Grant Modal Container & Elements
  grantModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    maxHeight: '88%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  grantModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  grantModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grantModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  grantModalSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  grantModalBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  grantEmpPickerTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  grantEmpPickerTriggerActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  empAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  empAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  grantEmpPickerName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  grantEmpPickerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeEmpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  changeEmpPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  collapseSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  collapseSelectorBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  inlineEmpListContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    marginTop: 6,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  inlineEmpSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineEmpSearchInput: {
    flex: 1,
    fontSize: 12,
    color: COLORS.text,
    paddingVertical: 4,
  },
  inlineEmpScroll: {
    maxHeight: 180,
  },
  inlineEmpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  inlineEmpItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  inlineEmpItemAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineEmpItemAvatarText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  inlineEmpItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  inlineEmpItemSub: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  inlineEmpEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  inlineEmpEmptyText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  grantBalanceCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  grantBalanceTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grantBalanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  grantBalancePill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 8,
    alignItems: 'center',
  },
  grantBalancePillLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  grantBalancePillVal: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  grantTypeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  grantTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  grantTypeBtnCLActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#DC2626',
  },
  grantTypeBtnCompOffActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  grantTypeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  grantDateRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  grantDateTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  grantDateTriggerActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  grantDateTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  calendarInlineWrapper: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  durationNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    padding: 8,
    borderRadius: RADIUS.sm,
    marginTop: 4,
  },
  durationNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
  presetChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: COLORS.primary,
  },
  presetChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  presetChipTextActive: {
    color: COLORS.primary,
  },

});

export default LeaveRequestsScreen;
