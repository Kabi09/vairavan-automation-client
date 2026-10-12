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
import dutyApi from '../../api/dutyApi';
import leaveApi from '../../api/leaveApi';
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
import { formatDate, formatISODateOnly } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import {
  exportDutiesToPDF,
  exportDutiesToExcel,
  exportLeavesToPDF,
  exportLeavesToExcel,
} from '../../utils/exportUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export const EmployeeDetailsScreen = ({ route, navigation }) => {
  const { employee } = route.params || {};
  const today = formatISODateOnly();

  // Active view: 'leave' or 'work'
  const [activeTab, setActiveTab] = useState('work');

  // Work state
  const [duties, setDuties] = useState([]);
  const [loadingWork, setLoadingWork] = useState(true);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Leave state
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);

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

  useEffect(() => {
    if (activeTab === 'work') {
      fetchWorkDuties();
    } else {
      fetchLeaves();
    }
  }, [activeTab, fetchWorkDuties, fetchLeaves]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'work') {
      fetchWorkDuties();
    } else {
      fetchLeaves();
    }
  };

  // Work exports
  const handleExportPDF = () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Submissions';

    exportDutiesToPDF({
      title: `${employee.employeeName} (${employee.employeeId})`,
      subtitle: `Employee Work History • ${employee.designation || 'Staff'}`,
      duties,
      filterInfo,
    });
  };

  const handleExportExcel = () => {
    const safeName = (employee?.employeeName || 'Employee').replace(/\s+/g, '_');
    exportDutiesToExcel({
      filename: `${safeName}_Work_History`,
      duties,
    });
  };

  // Leave exports
  const handleExportLeavePDF = () => {
    const filterInfo =
      startDate || endDate
        ? `From ${startDate || 'Start'} to ${endDate || 'Present'}`
        : 'All Leave History';

    exportLeavesToPDF({
      title: `${employee.employeeName} (${employee.employeeId})`,
      subtitle: `Staff Leave History • ${employee.designation || 'Staff'}`,
      leaves,
      filterInfo,
    });
  };

  const handleExportLeaveExcel = () => {
    const safeName = (employee?.employeeName || 'Employee').replace(/\s+/g, '_');
    exportLeavesToExcel({
      filename: `${safeName}_Leave_Records`,
      leaves,
    });
  };

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

      {/* Main Mode Toggle: [ Leave ] and [ Work ] */}
      <View style={styles.tabToggleContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leave' && styles.tabButtonActive]}
          onPress={() => setActiveTab('leave')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={activeTab === 'leave' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'leave' && styles.tabButtonTextActive]}
          >
            Leave ({leaves.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'work' && styles.tabButtonActive]}
          onPress={() => setActiveTab('work')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="briefcase"
            size={18}
            color={activeTab === 'work' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text
            style={[styles.tabButtonText, activeTab === 'work' && styles.tabButtonTextActive]}
          >
            Work ({duties.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Filters & Export Action Toolbar (Supports both Work & Leave records) */}
      <Card style={styles.toolbarCard}>
        <View style={styles.toolbarTitleRow}>
          <Text style={styles.toolbarTitle}>
            {activeTab === 'work' ? 'Filter & Export Work Records' : 'Filter & Export Leave Records'}
          </Text>
          {(startDate || endDate) && (
            <TouchableOpacity
              onPress={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              <Text style={styles.clearDateLink}>Clear Filter</Text>
            </TouchableOpacity>
          )}
        </View>

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
            onPress={activeTab === 'work' ? handleExportPDF : handleExportLeavePDF}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, styles.excelBtn]}
            onPress={activeTab === 'work' ? handleExportExcel : handleExportLeaveExcel}
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

    return (
      <Card style={styles.itemCard}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.workCompanyName}>
              {item.company?.companyName || 'Client Site'}
            </Text>
            <Text style={styles.workSub}>
              Machine: {item.machineName} ({item.workType})
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
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Customer Contact:</Text>
            <Text style={styles.detailValue}>
              {item.customerName} ({item.customerPhoneNumber})
            </Text>
          </View>
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
              <Image source={{ uri: signatureUrl }} style={styles.signatureThumb} resizeMode="contain" />
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
      </Card>
    );
  };

  const isLoading = activeTab === 'work' ? loadingWork : loadingLeaves;
  const currentData = activeTab === 'work' ? duties : leaves;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title={employee?.employeeName || 'Employee Management'}
        subtitle="Staff Profile, Work Log & Leaves"
        onBack={() => navigation.goBack()}
      />

      <View style={styles.container}>
        <ErrorMessage
          message={error}
          onRetry={activeTab === 'work' ? fetchWorkDuties : fetchLeaves}
        />

        {isLoading && !refreshing ? (
          <LoadingIndicator
            message={
              activeTab === 'work' ? 'Loading work details...' : 'Loading leave applications...'
            }
          />
        ) : (
          <FlatList
            data={currentData}
            keyExtractor={(item) => item._id}
            renderItem={activeTab === 'work' ? renderWorkItem : renderLeaveItem}
            ListHeaderComponent={renderHeader}
            ListEmptyComponent={
              <EmptyState
                icon={activeTab === 'work' ? 'briefcase-outline' : 'calendar-outline'}
                title={activeTab === 'work' ? 'No Work Records' : 'No Leave Requests'}
                description={
                  activeTab === 'work'
                    ? 'No duty visits submitted by this employee for the selected period.'
                    : 'No leave requests submitted by this employee.'
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
});

export default EmployeeDetailsScreen;
