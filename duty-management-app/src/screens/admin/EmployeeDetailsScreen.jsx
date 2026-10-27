import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import dutyApi from '../../api/dutyApi';
import leaveApi from '../../api/leaveApi';
import expenseApi from '../../api/expenseApi';
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
import SignatureImage from '../../components/SignatureImage';
import ImageViewerModal from '../../components/ImageViewerModal';
import ExportLoadingModal from '../../components/ExportLoadingModal';
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import {
  exportDutiesToPDF,
  exportDutiesToExcel,
  exportLeavesToPDF,
  exportLeavesToExcel,
  exportExpensesToPDF,
  exportExpensesToExcel,
} from '../../utils/exportUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const EmployeeDetailsScreen = ({ route, navigation }) => {
  const { employee } = route.params || {};
  const today = formatISODateOnly();

  // Active view: 'work' | 'leave' | 'expense'
  const [activeTab, setActiveTab] = useState('work');

  // Work state
  const [duties, setDuties] = useState([]);
  const [loadingWork, setLoadingWork] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [exportingType, setExportingType] = useState(null); // 'PDF' | 'Excel' | null

  // Leave state
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

  // Expense state
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(true);

  // Lightbox preview modal state
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewSubtitle, setPreviewSubtitle] = useState('');

  // Pickers visibility
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  // Leave review modal state
  const [leaveToReview, setLeaveToReview] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('approved');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch Work (duties)
  const fetchWorkDuties = useCallback(async () => {
    if (!employee?._id) return;
    try {
      setError('');
      const params = {
        employeeId: employee._id,
        limit: 500,
      };
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await dutyApi.getAllDuties(params);
      if (res.data?.duties) {
        setDuties(res.data.duties);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employee work records'));
    } finally {
      setLoadingWork(false);
      setRefreshing(false);
    }
  }, [employee?._id, startDate, endDate]);

  // Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    if (!employee?._id) return;
    try {
      setError('');
      const params = {
        employeeId: employee._id,
        limit: 200,
      };
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await leaveApi.getAllLeaves(params);
      if (res.data?.leaves) {
        setLeaves(res.data.leaves);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employee leave requests'));
    } finally {
      setLoadingLeaves(false);
      setRefreshing(false);
    }
  }, [employee?._id, startDate, endDate]);

  // Fetch Expenses
  const fetchExpenses = useCallback(async () => {
    if (!employee?._id) return;
    try {
      setError('');
      const params = {
        employeeId: employee._id,
        limit: 500,
      };
      if (startDate.trim()) params.startDate = startDate.trim();
      if (endDate.trim()) params.endDate = endDate.trim();

      const res = await expenseApi.getAllExpenses(params);
      if (res.data?.expenses) {
        setExpenses(res.data.expenses);
      } else if (res.expenses) {
        setExpenses(res.expenses);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load employee expenses'));
    } finally {
      setLoadingExpenses(false);
      setRefreshing(false);
    }
  }, [employee?._id, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'work') {
        fetchWorkDuties();
      } else if (activeTab === 'leave') {
        fetchLeaves();
      } else if (activeTab === 'expense') {
        fetchExpenses();
      }
    }, [activeTab, fetchWorkDuties, fetchLeaves, fetchExpenses])
  );

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'work') {
      fetchWorkDuties();
    } else if (activeTab === 'leave') {
      fetchLeaves();
    } else if (activeTab === 'expense') {
      fetchExpenses();
    }
  };

  // Work exports
  const handleExportPDF = async () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Submissions';

    try {
      setExportingType('PDF');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToPDF({
        title: `${employee.employeeName} (${employee.employeeId})`,
        subtitle: `Employee Work History • ${employee.designation || 'Staff'}`,
        duties,
        filterInfo,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExcel = async () => {
    const safeName = (employee?.employeeName || 'Employee').replace(/\s+/g, '_');
    try {
      setExportingType('Excel');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportDutiesToExcel({
        filename: `${safeName}_Work_History`,
        duties,
      });
    } finally {
      setExportingType(null);
    }
  };

  // Leave exports
  const handleExportLeavePDF = async () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Leave History';

    try {
      setExportingType('PDF');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportLeavesToPDF({
        title: `${employee.employeeName} (${employee.employeeId})`,
        subtitle: `Staff Leave History • ${employee.designation || 'Staff'}`,
        leaves,
        filterInfo,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportLeaveExcel = async () => {
    const safeName = (employee?.employeeName || 'Employee').replace(/\s+/g, '_');
    try {
      setExportingType('Excel');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportLeavesToExcel({
        filename: `${safeName}_Leave_Records`,
        leaves,
      });
    } finally {
      setExportingType(null);
    }
  };

  // Expense exports
  const handleExportExpensePDF = async () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Expense History';

    try {
      setExportingType('PDF');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportExpensesToPDF({
        title: `${employee.employeeName} (${employee.employeeId})`,
        subtitle: `Staff Expense Claims • ${employee.designation || 'Staff'}`,
        expenses,
        filterInfo,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExportExpenseExcel = async () => {
    const safeName = (employee?.employeeName || 'Employee').replace(/\s+/g, '_');
    try {
      setExportingType('Excel');
      await new Promise((resolve) => setTimeout(resolve, 80));
      await exportExpensesToExcel({
        filename: `${safeName}_Expense_Claims`,
        expenses,
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleOpenPhotoPreview = (url, title = 'Proof Photo', subtitle = '') => {
    setPreviewImageUri(url);
    setPreviewTitle(title);
    setPreviewSubtitle(subtitle);
    setPreviewModalVisible(true);
  };

  const totalExpenseAmount = expenses.reduce(
    (sum, e) => sum + Number(e.grandTotal ?? e.totalAmount ?? e.amount ?? 0),
    0
  );

  // Leave approval / rejection
  const handleOpenLeaveReview = (leave, decision) => {
    setLeaveToReview(leave);
    setReviewDecision(decision);
    setReviewRemarks('');
  };

  const handleConfirmLeaveDecision = async () => {
    if (!leaveToReview) return;
    setReviewSubmitting(true);
    try {
      await leaveApi.reviewLeave(leaveToReview._id, {
        status: reviewDecision,
        adminRemarks: reviewRemarks.trim(),
      });
      Alert.alert(
        'Success',
        `Leave request has been ${reviewDecision === 'approved' ? 'approved' : 'rejected'}.`
      );
      setLeaveToReview(null);
      fetchLeaves();
    } catch (err) {
      Alert.alert('Review Failed', extractErrorMessage(err));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const renderHeader = () => (
    <View>
      {/* Employee Profile Header Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(employee?.employeeName || 'E').substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.employeeName}>{employee?.employeeName}</Text>
            <Text style={styles.employeeSub}>
              ID: {employee?.employeeId} • {employee?.designation || 'Employee'}
            </Text>
            <Text style={styles.employeeEmail}>{employee?.email}</Text>
          </View>
          <StatusBadge status={employee?.accountStatus} />
        </View>

        <View style={styles.profileDetailsRow}>
          <Text style={styles.phoneText}>
            <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />{' '}
            {employee?.phoneNumber || 'No phone'}
          </Text>
          <Text style={styles.joinedText}>
            Joined: {formatDate(employee?.joiningDate || employee?.createdAt)}
          </Text>
        </View>
      </Card>

      {/* Main Mode Toggle: [ Work ], [ Leave ] and [ Expenses ] */}
      <View style={styles.tabToggleContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'work' && styles.tabButtonActive]}
          onPress={() => setActiveTab('work')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="briefcase"
            size={16}
            color={activeTab === 'work' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'work' && styles.tabButtonTextActive]}
          >
            Work ({duties.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leave' && styles.tabButtonActive]}
          onPress={() => setActiveTab('leave')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar"
            size={16}
            color={activeTab === 'leave' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'leave' && styles.tabButtonTextActive]}
          >
            Leave ({leaves.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'expense' && styles.tabButtonActive]}
          onPress={() => setActiveTab('expense')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="receipt"
            size={16}
            color={activeTab === 'expense' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'expense' && styles.tabButtonTextActive]}
          >
            Expenses ({expenses.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Filters & Export Action Toolbar */}
      <Card style={styles.toolbarCard}>
        <View style={styles.toolbarTitleRow}>
          <Text style={styles.toolbarTitle}>
            {activeTab === 'work'
              ? 'Work Records'
              : activeTab === 'leave'
              ? 'Leave Records'
              : 'Expense Claims'}
          </Text>
          <View style={styles.quickFilterGroup}>
            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                startDate === today && endDate === today && styles.quickFilterChipActive,
              ]}
              onPress={() => {
                setStartDate(today);
                setEndDate(today);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="today"
                size={12}
                color={startDate === today && endDate === today ? '#FFFFFF' : COLORS.primary}
              />
              <Text
                style={[
                  styles.quickFilterChipText,
                  startDate === today && endDate === today && styles.quickFilterChipTextActive,
                ]}
              >
                Today
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickFilterChip,
                !startDate && !endDate && styles.quickFilterChipActive,
              ]}
              onPress={() => {
                setStartDate('');
                setEndDate('');
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name="filter-outline"
                size={12}
                color={!startDate && !endDate ? '#FFFFFF' : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.quickFilterChipText,
                  !startDate && !endDate && styles.quickFilterChipTextActive,
                ]}
              >
                Clear Filter
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Expense KPI summary banner */}
        {activeTab === 'expense' && (
          <View style={styles.expenseSummaryBanner}>
            <View style={styles.expenseSummaryItem}>
              <Text style={styles.expenseSummaryLabel}>Claims</Text>
              <Text style={styles.expenseSummaryVal}>{expenses.length}</Text>
            </View>
            <View style={styles.expenseSummaryDivider} />
            <View style={styles.expenseSummaryItem}>
              <Text style={styles.expenseSummaryLabel}>Total Amount</Text>
              <Text style={styles.expenseSummaryValGreen}>
                ₹{totalExpenseAmount.toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.dateFilterRow}>
          <View style={{ flex: 1, marginRight: SPACING.xs }}>
            <Text style={styles.filterFieldLabel}>From Date</Text>
            <TouchableOpacity
              style={styles.datePickerTrigger}
              onPress={() => setStartDatePickerVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
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
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.datePickerTriggerText}>{endDate || 'To Date'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.exportButtonsRow}>
          <TouchableOpacity
            style={[styles.exportBtn, styles.pdfBtn]}
            onPress={
              activeTab === 'work'
                ? handleExportPDF
                : activeTab === 'leave'
                ? handleExportLeavePDF
                : handleExportExpensePDF
            }
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.excelBtn]}
            onPress={
              activeTab === 'work'
                ? handleExportExcel
                : activeTab === 'leave'
                ? handleExportLeaveExcel
                : handleExportExpenseExcel
            }
            activeOpacity={0.8}
          >
            <Ionicons name="grid" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export Excel</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  // Render Leave Record Item
  const renderLeaveItem = ({ item }) => (
    <Card style={styles.itemCard}>
      <View style={styles.cardHeader}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
          <Text style={styles.dateBadgeText}>
            {formatDate(item.startDate)} - {formatDate(item.endDate)}
          </Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <Text style={styles.reasonText}>"{item.reason}"</Text>

      {item.adminRemarks ? (
        <View style={styles.remarksBox}>
          <Text style={styles.remarksLabel}>Admin Remarks:</Text>
          <Text style={styles.remarksText}>{item.adminRemarks}</Text>
        </View>
      ) : null}

      {/* Only leave requests have Approve & Reject buttons */}
      {item.status === 'pending' ? (
        <View style={styles.leaveActionsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.approveBtn]}
            onPress={() => handleOpenLeaveReview(item, 'approved')}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.actionBtnText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={() => handleOpenLeaveReview(item, 'rejected')}
            activeOpacity={0.8}
          >
            <Ionicons name="close-circle-outline" size={16} color={COLORS.danger} />
            <Text style={[styles.actionBtnText, { color: COLORS.danger }]}>Reject</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );

  // Render Work (Duty) Item - Pure Viewing, NO Approve/Reject buttons
  const renderWorkItem = ({ item }) => {
    const proofPhotos = Array.isArray(item.customerProofPhotos) ? item.customerProofPhotos : [];
    const signatureUrl = item.customerSignature?.url;
    const companyLocation = item.company?.location || item.location?.address;

    const isItemOffice =
      item.company?.companyType === 'office' ||
      (typeof item.company?.companyName === 'string' &&
        item.company.companyName.toLowerCase().includes('office'));

    return (
      <Card style={styles.itemCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workCompanyName}>
              {item.company?.companyName || (isItemOffice ? 'Office' : 'Company')}
              {companyLocation ? ` • ${companyLocation}` : ''}
            </Text>
            <Text style={styles.workSub}>
              Machine: {item.machineName} ({formatWorkType(item)})
            </Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={13} color={COLORS.primary} />
            <Text style={styles.dateBadgeText}>{formatDate(item.dutyDate)}</Text>
          </View>
        </View>

        <View style={styles.dutyDetailsGrid}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Working Hours:</Text>
            <Text style={styles.detailValue}>
              {item.inTime} - {item.outTime}
            </Text>
          </View>
          {!isItemOffice && item.customerName ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Customer Contact:</Text>
              <Text style={styles.detailValue}>
                {item.customerName} ({item.customerPhoneNumber || 'N/A'})
              </Text>
            </View>
          ) : null}
          {item.location?.latitude ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>GPS Coordinates:</Text>
              <View style={styles.gpsRow}>
                <Text style={styles.detailValue}>
                  {item.location.latitude.toFixed(4)}, {item.location.longitude.toFixed(4)}
                </Text>
                <TouchableOpacity
                  style={styles.openMapChip}
                  onPress={() => {
                    const lat = item.location.latitude;
                    const lng = item.location.longitude;
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(() => {
                      Alert.alert('Map Error', 'Unable to open maps application');
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={13} color={COLORS.primary} />
                  <Text style={styles.openMapChipText}>View Map</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.descBox}>
          <Text style={styles.descTitle}>Work Carried Out:</Text>
          <Text style={styles.descText}>{item.workDescription}</Text>
        </View>

        {/* Media Attachments */}
        <View style={styles.mediaRow}>
          {signatureUrl ? (
            <View style={styles.mediaThumbBlock}>
              <Text style={styles.mediaLabel}>Signature</Text>
              <SignatureImage uri={signatureUrl} height={70} width={70} />
            </View>
          ) : null}

          {proofPhotos.length > 0 ? (
            <View style={styles.mediaThumbBlock}>
              <Text style={styles.mediaLabel}>Photos ({proofPhotos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {proofPhotos.map((p, idx) => (
                  <Image
                    key={idx}
                    source={{ uri: p.url }}
                    style={styles.photoThumb}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}
        </View>
        {/* Linked Expenses Badge */}
        {item.totalExpenseAmount > 0 ? (
          <View style={styles.workExpenseBadge}>
            <Ionicons name="receipt" size={13} color="#047857" />
            <Text style={styles.workExpenseBadgeText}>
              Claimed Expenses: ₹{Number(item.totalExpenseAmount).toLocaleString('en-IN')}
              {item.expenses?.length ? ` (${item.expenses.length} claims)` : ''}
            </Text>
          </View>
        ) : null}
      </Card>
    );
  };

  // Render Expense Claim Item
  const renderExpenseItem = ({ item, index }) => {
    const claimCode = item.expenseId || `EXP-${index + 1}`;
    const claimDate = item.expenseDate ? formatDate(item.expenseDate) : '';
    const rawItems = item.items && item.items.length > 0 ? item.items : [
      {
        categoryName: item.category,
        customTitle: item.customCategory,
        amount: item.amount || item.totalAmount || 0,
        description: item.description || '',
        billProof: item.billProof || null,
      }
    ];
    const totalAmount = Number(item.grandTotal ?? item.totalAmount ?? item.amount ?? 0);
    const relatedDutyText = item.duty?.dutyId || item.relatedDuty;
    const machine = item.duty?.machineName;

    return (
      <Card style={styles.itemCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.workCompanyName}>{claimCode}</Text>
              {item.status ? <StatusBadge status={item.status} /> : null}
            </View>
            {relatedDutyText ? (
              <View style={styles.expenseDutyBadgeWrap}>
                <Ionicons name="briefcase-outline" size={12} color="#0369A1" />
                <Text style={styles.expenseDutyBadgeText}>
                  Work: {relatedDutyText}{machine ? ` • ${machine}` : ''}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={styles.expenseClaimAmountText}>₹{totalAmount.toLocaleString('en-IN')}</Text>
            {claimDate ? (
              <View style={styles.dateBadge}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                <Text style={styles.dateBadgeText}>{claimDate}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Company & Client if present */}
        {(item.company?.companyName || item.client?.name || item.customerName) && (
          <View style={styles.expenseEntityRow}>
            <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.expenseEntityText}>
              {item.company?.companyName || ''}
              {item.client?.name || item.customerName ? ` • Client: ${item.client?.name || item.customerName}` : ''}
            </Text>
          </View>
        )}

        {/* Itemized Breakdown */}
        <View style={styles.expenseItemsBox}>
          <Text style={styles.expenseItemsBoxTitle}>Itemized Breakdown ({rawItems.length}):</Text>
          {rawItems.map((it, itIdx) => {
            const isOthers = it.categoryName === 'Others' || it.category === 'other';
            const customTitle = it.customTitle || it.customCategoryName || it.customCategory || '';
            const rawCat = it.categoryName || it.category || `Item #${itIdx + 1}`;
            const itCat = isOthers && customTitle ? `Others: ${customTitle}` : (customTitle ? `${rawCat} (${customTitle})` : rawCat);

            const calc = (it.calculationMode === 'automatic' || (it.distanceKm && it.ratePerKm))
              ? `${it.distanceKm || it.totalDistance || 0} km × ₹${it.ratePerKm || it.ratePerUnit || 0}/km`
              : null;
            const pImg = it.billProof?.url || (typeof it.billProof === 'string' ? it.billProof : null);

            return (
              <View key={`it-${itIdx}`} style={styles.expenseSubItemRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.expenseSubItemCat}>{itCat}</Text>
                  {calc ? <Text style={styles.expenseSubItemCalc}>{calc}</Text> : null}
                  {it.description ? <Text style={styles.expenseSubItemDesc}>{it.description}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.expenseSubItemAmt}>₹{(Number(it.amount) || 0).toLocaleString('en-IN')}</Text>
                  {pImg && (
                    <TouchableOpacity
                      onPress={() => handleOpenPhotoPreview(pImg, `Proof: ${itCat}`, claimCode)}
                      style={styles.expenseThumbBtn}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: pImg }} style={styles.expenseThumbImg} />
                      <View style={styles.expenseThumbBadge}>
                        <Ionicons name="eye" size={9} color="#FFFFFF" />
                        <Text style={styles.expenseThumbBadgeText}>Proof</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Global attachments / proofs */}
        {Array.isArray(item.proofs) && item.proofs.length > 0 && (
          <View style={styles.expenseGlobalProofsWrap}>
            <Text style={styles.expenseGlobalProofsTitle}>Attachments ({item.proofs.length}):</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 4 }}>
              {item.proofs.map((proof, pIdx) => {
                const pUrl = proof.url || (typeof proof === 'string' ? proof : null);
                if (!pUrl) return null;
                return (
                  <TouchableOpacity
                    key={`p-${pIdx}`}
                    onPress={() => handleOpenPhotoPreview(pUrl, `Attachment #${pIdx + 1}`, claimCode)}
                    activeOpacity={0.8}
                    style={styles.expenseThumbBtn}
                  >
                    <Image source={{ uri: pUrl }} style={styles.expenseThumbImg} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {item.generalDescription ? (
          <View style={styles.remarksBox}>
            <Text style={styles.remarksLabel}>Notes / Remarks:</Text>
            <Text style={styles.remarksText}>{item.generalDescription}</Text>
          </View>
        ) : null}
      </Card>
    );
  };

  const isLoading =
    activeTab === 'work'
      ? loadingWork
      : activeTab === 'leave'
      ? loadingLeaves
      : loadingExpenses;

  const currentData =
    activeTab === 'work' ? duties : activeTab === 'leave' ? leaves : expenses;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={employee?.employeeName || 'Employee Management'}
        subtitle="Staff Profile, Work Log, Leaves & Expenses"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <ErrorMessage
          message={error}
          onRetry={
            activeTab === 'work'
              ? fetchWorkDuties
              : activeTab === 'leave'
              ? fetchLeaves
              : fetchExpenses
          }
        />

        {isLoading && !refreshing ? (
          <LoadingIndicator
            message={
              activeTab === 'work'
                ? 'Loading work details...'
                : activeTab === 'leave'
                ? 'Loading leave applications...'
                : 'Loading expense claims...'
            }
          />
        ) : (
          <FlatList
            data={currentData}
            keyExtractor={(item) => item._id}
            renderItem={
              activeTab === 'work'
                ? renderWorkItem
                : activeTab === 'leave'
                ? renderLeaveItem
                : renderExpenseItem
            }
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <EmptyState
                icon={
                  activeTab === 'work'
                    ? 'briefcase-outline'
                    : activeTab === 'leave'
                    ? 'calendar-outline'
                    : 'receipt-outline'
                }
                title={
                  activeTab === 'work'
                    ? 'No Work Records'
                    : activeTab === 'leave'
                    ? 'No Leave Requests'
                    : 'No Expense Claims'
                }
                description={
                  activeTab === 'work'
                    ? 'No duty visits submitted by this employee for the selected period.'
                    : activeTab === 'leave'
                    ? 'No leave requests submitted by this employee.'
                    : 'No expense claims submitted by this employee for the selected period.'
                }
              />
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[COLORS.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>

      {/* Leave Approval / Rejection Modal */}
      <Modal
        visible={Boolean(leaveToReview)}
        transparent
        animationType="fade"
        onRequestClose={() => setLeaveToReview(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {reviewDecision === 'approved' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </Text>
            <Text style={styles.modalSubtitle}>
              Employee: {employee?.employeeName} ({formatDate(leaveToReview?.startDate)} to{' '}
              {formatDate(leaveToReview?.endDate)})
            </Text>

            <TextInputField
              label="Admin Remarks"
              placeholder={
                reviewDecision === 'approved'
                  ? 'e.g. Approved as per company policy.'
                  : 'e.g. Critical customer service schedule on these dates.'
              }
              value={reviewRemarks}
              onChangeText={setReviewRemarks}
              multiline
              numberOfLines={2}
            />

            <View style={styles.modalActions}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setLeaveToReview(null)}
                disabled={reviewSubmitting}
                style={styles.modalBtn}
              />
              <PrimaryButton
                title={reviewDecision === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
                onPress={handleConfirmLeaveDecision}
                loading={reviewSubmitting}
                style={[
                  styles.modalBtn,
                  reviewDecision === 'rejected' && { backgroundColor: COLORS.danger },
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

      <ExportLoadingModal
        visible={Boolean(exportingType)}
        type={exportingType}
      />

      <ImageViewerModal
        visible={previewModalVisible}
        imageUri={previewImageUri}
        title={previewTitle}
        subtitle={previewSubtitle}
        onClose={() => setPreviewModalVisible(false)}
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
  },
  listContent: {
    padding: SPACING.md,
  },
  profileCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  },
  profileInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  employeeSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  employeeEmail: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  profileDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  },
  phoneText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  joinedText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  tabToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.md - 2,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
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
  quickFilterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  quickFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  quickFilterChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  quickFilterChipTextActive: {
    color: '#FFFFFF',
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
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  openMapChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  openMapChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
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
  itemCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  reasonText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 20,
  },
  remarksBox: {
    backgroundColor: '#F8FAFC',
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.xs,
  },
  remarksLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  remarksText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  leaveActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
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
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  workCompanyName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  workSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  dutyDetailsGrid: {
    gap: 4,
    marginVertical: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 110,
  },
  detailValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  descBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    marginTop: 6,
    marginBottom: 6,
  },
  descTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  descText: {
    fontSize: 12,
    color: COLORS.text,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  mediaThumbBlock: {
    gap: 4,
  },
  mediaLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  signatureThumb: {
    width: 100,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 4,
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  expenseSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.sm,
  },
  expenseSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  expenseSummaryLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  expenseSummaryVal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  expenseSummaryValGreen: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
    marginTop: 2,
  },
  expenseSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#CBD5E1',
  },
  workExpenseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  workExpenseBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  expenseDutyBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  expenseDutyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  expenseClaimAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#047857',
  },
  expenseEntityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  expenseEntityText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  expenseItemsBox: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expenseItemsBoxTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  expenseSubItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expenseSubItemCat: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'capitalize',
  },
  expenseSubItemCalc: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    marginTop: 1,
  },
  expenseSubItemDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  expenseSubItemAmt: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  expenseThumbBtn: {
    position: 'relative',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginTop: 2,
  },
  expenseThumbImg: {
    width: 38,
    height: 38,
    borderRadius: 3,
  },
  expenseThumbBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 1,
    gap: 2,
  },
  expenseThumbBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  expenseGlobalProofsWrap: {
    marginTop: 8,
  },
  expenseGlobalProofsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default EmployeeDetailsScreen;
