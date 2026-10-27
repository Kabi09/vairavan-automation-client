import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import leaveApi from '../../api/leaveApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmptyState from '../../components/EmptyState';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import MonthlyCalendarView from '../../components/MonthlyCalendarView';
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

const STATUS_TABS = [
  { key: 'all', label: 'All', icon: 'list-outline' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle-outline' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle-outline' },
  { key: 'cancelled', label: 'Cancelled', icon: 'ban-outline' },
];

export const MyLeavesScreen = ({ navigation }) => {
  const [viewMode, setViewMode] = useState('requests'); // 'requests' | 'calendar'
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Cancel leave state
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const counts = useMemo(
    () => ({
      all: leaves.length,
      pending: leaves.filter((l) => l.status === 'pending').length,
      approved: leaves.filter((l) => l.status === 'approved').length,
      rejected: leaves.filter((l) => l.status === 'rejected').length,
      cancelled: leaves.filter((l) => l.status === 'cancelled').length,
    }),
    [leaves]
  );

  const filteredLeaves = useMemo(() => {
    if (statusFilter === 'all') return leaves;
    return leaves.filter((l) => l.status === statusFilter);
  }, [leaves, statusFilter]);

  const fetchMyLeavesData = useCallback(async () => {
    try {
      setError('');
      const [leavesRes, balancesRes] = await Promise.all([
        leaveApi.getMyLeaves({ limit: 100 }),
        leaveApi.getLeaveBalances().catch(() => null),
      ]);

      if (leavesRes?.data?.leaves) {
        setLeaves(leavesRes.data.leaves);
      }
      if (balancesRes?.data) {
        setBalances(balancesRes.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load your leave requests'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMyLeavesData();
    }, [fetchMyLeavesData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMyLeavesData();
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);

    try {
      await leaveApi.cancelLeave(cancelTarget._id);
      Alert.alert('Leave Cancelled', 'Your pending leave request has been cancelled.');
      setCancelTarget(null);
      fetchMyLeavesData();
    } catch (err) {
      Alert.alert('Error', extractErrorMessage(err, 'Failed to cancel leave request'));
    } finally {
      setCancelLoading(false);
    }
  };

  const cl = balances?.casualLeave;
  const compOff = balances?.compOff;

  const renderLeaveItem = ({ item }) => {
    const isCompOff = item.leaveType === 'comp_off';
    const days = item.daysCount || 1;

    return (
      <Card style={styles.leaveCard}>
        <View style={styles.cardHeader}>
          <View style={styles.dateBanner}>
            <Ionicons name="calendar" size={16} color={COLORS.primary} />
            <Text style={styles.dateRangeText}>
              {formatDate(item.startDate)} - {formatDate(item.endDate)}
            </Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        {/* Leave Type and Days Count Row */}
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
              {item.status === 'rejected' ? 'Rejection Reason:' : 'Manager Remarks:'}
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

        <View style={styles.cardFooter}>
          <Text style={styles.requestedAtText}>
            Applied on {formatDate(item.requestedAt || item.createdAt)}
          </Text>

          {item.status === 'pending' && (
            <TouchableOpacity
              style={styles.cancelLink}
              onPress={() => setCancelTarget(item)}
            >
              <Text style={styles.cancelLinkText}>Cancel Request</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Leave & Calendar"
        subtitle="Manage leave balances, applications & attendance"
        rightAction={
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('LeaveRequest')}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Apply</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.container}>
        {/* Mode Switcher: My Leaves vs Monthly Calendar */}
        <View style={styles.modeSwitcherContainer}>
          <TouchableOpacity
            style={[styles.modeTab, viewMode === 'requests' && styles.modeTabActive]}
            onPress={() => setViewMode('requests')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={16}
              color={viewMode === 'requests' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'requests' && styles.modeTabTextActive,
              ]}
            >
              My Leaves ({leaves.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTab, viewMode === 'calendar' && styles.modeTabActive]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar-outline"
              size={16}
              color={viewMode === 'calendar' ? '#FFFFFF' : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.modeTabText,
                viewMode === 'calendar' && styles.modeTabTextActive,
              ]}
            >
              Monthly Calendar
            </Text>
          </TouchableOpacity>
        </View>

        {/* Top Leave Balances Card */}
        {balances && (
          <Card style={styles.balancesCard}>
            <View style={styles.balancesRow}>
              {/* Casual Leave Balance Box */}
              <View style={[styles.balanceCardCol, styles.clCol]}>
                <View style={styles.balanceColHeader}>
                  <Ionicons name="calendar" size={14} color="#DC2626" />
                  <Text style={styles.balanceColTitle}>Casual Leave (CL)</Text>
                </View>
                <View style={styles.balanceValuesWrap}>
                  <View style={styles.balanceValItem}>
                    <Text style={styles.valSubLabel}>Allowance</Text>
                    <Text style={styles.valSubValue}>{cl?.allowance ?? 12}d</Text>
                  </View>
                  <View style={styles.balanceValDivider} />
                  <View style={styles.balanceValItem}>
                    <Text style={styles.valSubLabel}>Used</Text>
                    <Text style={styles.valSubValue}>{cl?.used ?? 0}d</Text>
                  </View>
                  <View style={styles.balanceValDivider} />
                  <View style={styles.balanceValItem}>
                    <Text style={[styles.valSubLabel, { color: '#059669' }]}>Available</Text>
                    <Text style={[styles.valSubValue, { color: '#059669', fontWeight: '800' }]}>
                      {cl?.available ?? 12}d
                    </Text>
                  </View>
                </View>
              </View>

              {/* Comp-Off Balance Box */}
              <View style={[styles.balanceCardCol, styles.compOffCol]}>
                <View style={styles.balanceColHeader}>
                  <Ionicons name="gift" size={14} color="#2563EB" />
                  <Text style={styles.balanceColTitle}>Comp-Off Credits</Text>
                </View>
                <View style={styles.balanceValuesWrap}>
                  <View style={styles.balanceValItem}>
                    <Text style={styles.valSubLabel}>Earned</Text>
                    <Text style={styles.valSubValue}>{compOff?.earned ?? 0}</Text>
                  </View>
                  <View style={styles.balanceValDivider} />
                  <View style={styles.balanceValItem}>
                    <Text style={styles.valSubLabel}>Used</Text>
                    <Text style={styles.valSubValue}>{compOff?.used ?? 0}</Text>
                  </View>
                  <View style={styles.balanceValDivider} />
                  <View style={styles.balanceValItem}>
                    <Text style={[styles.valSubLabel, { color: '#2563EB' }]}>Available</Text>
                    <Text style={[styles.valSubValue, { color: '#2563EB', fontWeight: '800' }]}>
                      {compOff?.available ?? 0}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Card>
        )}

        {viewMode === 'calendar' ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: SPACING.xxl }}
          >
            <MonthlyCalendarView isAdminView={false} />
          </ScrollView>
        ) : (
          <>
            {/* Status Filter Tabs */}
            <View style={styles.tabsContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsScrollContent}
              >
                {STATUS_TABS.map((tab) => {
                  const isSelected = statusFilter === tab.key;
                  const count = counts[tab.key] || 0;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[styles.statusTabChip, isSelected && styles.statusTabChipActive]}
                      onPress={() => setStatusFilter(tab.key)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={tab.icon}
                        size={14}
                        color={isSelected ? COLORS.textLight : COLORS.textSecondary}
                      />
                      <Text
                        style={[styles.statusTabText, isSelected && styles.statusTabTextActive]}
                      >
                        {tab.label}
                      </Text>
                      <View
                        style={[
                          styles.statusCountBadge,
                          isSelected && styles.statusCountBadgeActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusCountText,
                            isSelected && styles.statusCountTextActive,
                          ]}
                        >
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ErrorMessage message={error} onRetry={fetchMyLeavesData} />

            {loading && !refreshing ? (
              <LoadingIndicator message="Loading leave records..." />
            ) : (
              <FlatList
                data={filteredLeaves}
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
                    title={
                      statusFilter === 'all'
                        ? 'No Leave Applications'
                        : `No ${statusFilter} Requests`
                    }
                    description={
                      statusFilter === 'all'
                        ? 'You have not submitted any leave applications yet. Tap Apply to request Casual Leave or Comp-Off.'
                        : `No leave applications currently in ${statusFilter} state.`
                    }
                    buttonTitle="Apply for Leave"
                    onButtonPress={() => navigation.navigate('LeaveRequest')}
                  />
                }
              />
            )}
          </>
        )}
      </View>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        visible={Boolean(cancelTarget)}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this pending leave request? This action cannot be undone."
        confirmText="Cancel Request"
        cancelText="Keep"
        confirmVariant="danger"
        loading={cancelLoading}
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelTarget(null)}
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modeSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.sm,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  modeTabActive: {
    backgroundColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  balancesCard: {
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  balancesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  balanceCardCol: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
  },
  clCol: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  compOffCol: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  balanceColHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  balanceColTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  balanceValuesWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceValItem: {
    alignItems: 'center',
    flex: 1,
  },
  valSubLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  valSubValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
  balanceValDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#CBD5E1',
  },
  tabsContainer: {
    marginBottom: SPACING.sm,
  },
  tabsScrollContent: {
    gap: 6,
    paddingVertical: 2,
  },
  statusTabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusTabChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusTabTextActive: {
    color: '#FFFFFF',
  },
  statusCountBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  statusCountBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  statusCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusCountTextActive: {
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
    marginBottom: 8,
  },
  dateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateRangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  reasonText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
    marginBottom: 8,
  },
  remarksBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: 8,
  },
  rejectionRemarksBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  remarksLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  remarksText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
  },
  requestedAtText: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  cancelLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  cancelLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
});

export default MyLeavesScreen;
