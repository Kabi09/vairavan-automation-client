import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import dashboardApi from '../../api/dashboardApi';
import notificationApi from '../../api/notificationApi';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import { formatDate, formatTime, getGreeting } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const EmployeeDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { unreadCount, refreshNotifications } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      setError('');
      const dashRes = await dashboardApi.getEmployeeDashboard();
      if (dashRes?.data) {
        setData(dashRes.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
      refreshNotifications();
    }, [fetchDashboard, refreshNotifications])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const todayDuties = data?.todayDuties?.reports || [];
  const recentDuties = data?.recentDuties || [];
  const leaves = data?.leaves || {};
  const holidays = data?.upcomingHolidays || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.employeeName || 'Technician'}</Text>
            <Text style={styles.designationText}>
              ID: {user?.employeeId} • {user?.designation || 'Service Engineer'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.notificationBadgeBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={26} color={COLORS.text} />
              {unreadCount > 0 && (
                <View style={styles.unreadDotBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={38} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ErrorMessage message={error} onRetry={fetchDashboard} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading your dashboard..." />
        ) : (
          <>
            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={[styles.quickActionBtn, styles.dutyQuickAction]}
                onPress={() => navigation.navigate('DutyForm')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="add-circle" size={24} color={COLORS.primary} />
                </View>
                <Text style={styles.quickActionTitle}>Submit Duty</Text>
                <Text style={styles.quickActionSub}>Log visit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, styles.dutyHistoryAction]}
                onPress={() => navigation.navigate('MyDutiesTab')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="clipboard" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.quickActionTitle}>My Duties</Text>
                <Text style={styles.quickActionSub}>History & logs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionBtn, styles.leaveQuickAction]}
                onPress={() => navigation.navigate('LeaveRequest')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="calendar" size={24} color={COLORS.warning} />
                </View>
                <Text style={styles.quickActionTitle}>Leave</Text>
                <Text style={styles.quickActionSub}>Apply off</Text>
              </TouchableOpacity>
            </View>

            {/* Leave Balances Status */}
            <Card style={styles.leaveStatusCard} onPress={() => navigation.navigate('MyLeaves')}>
              <View style={styles.leaveHeader}>
                <Text style={styles.sectionHeaderTitle}>Your Leave Status</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
              </View>
              <View style={styles.leavePillsRow}>
                <View style={styles.pillItem}>
                  <Text style={[styles.pillNum, { color: COLORS.warning }]}>
                    {leaves.pending ?? 0}
                  </Text>
                  <Text style={styles.pillLabel}>Pending</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.pillItem}>
                  <Text style={[styles.pillNum, { color: COLORS.success }]}>
                    {leaves.approved ?? 0}
                  </Text>
                  <Text style={styles.pillLabel}>Approved</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.pillItem}>
                  <Text style={[styles.pillNum, { color: COLORS.danger }]}>
                    {leaves.rejected ?? 0}
                  </Text>
                  <Text style={styles.pillLabel}>Rejected</Text>
                </View>
              </View>
            </Card>

            {/* Today's Duty Reports */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Today's Duty Visits</Text>
              <Text style={styles.countBadge}>{todayDuties.length} logged</Text>
            </View>

            {todayDuties.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="clipboard-outline" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyCardTitle}>No duties logged today</Text>
                <Text style={styles.emptyCardSub}>
                  Completed a visit? Tap 'Submit Duty' above to log your work.
                </Text>
              </Card>
            ) : (
              todayDuties.map((duty) => (
                <Card
                  key={duty._id}
                  style={styles.dutyCard}
                  onPress={() => navigation.navigate('DutyDetails', { dutyId: duty._id })}
                >
                  <View style={styles.dutyTop}>
                    <Text style={styles.customerText}>{duty.customerName}</Text>
                    <StatusBadge status={duty.status} />
                  </View>
                  <Text style={styles.machineText}>
                    {duty.company?.companyName} • {duty.machineName}
                  </Text>
                  <Text style={styles.timeText}>
                    <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />{' '}
                    {formatTime(duty.inTime)} - {formatTime(duty.outTime)} ({duty.workType})
                  </Text>
                </Card>
              ))
            )}

            {/* Recent Duty Submissions */}
            <View style={[styles.sectionHeaderRow, { marginTop: SPACING.md }]}>
              <Text style={styles.sectionHeaderTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MyDutiesTab')}>
                <Text style={styles.linkText}>View History</Text>
              </TouchableOpacity>
            </View>

            {recentDuties.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardSub}>No past duty reports on record.</Text>
              </Card>
            ) : (
              recentDuties.slice(0, 4).map((duty) => (
                <Card
                  key={duty._id}
                  style={styles.dutyCard}
                  onPress={() => navigation.navigate('DutyDetails', { dutyId: duty._id })}
                >
                  <View style={styles.dutyTop}>
                    <Text style={styles.customerText}>{duty.customerName}</Text>
                    <StatusBadge status={duty.status} />
                  </View>
                  <View style={styles.dutyBottom}>
                    <Text style={styles.workTypeText}>{duty.workType}</Text>
                    <Text style={styles.dateText}>{formatDate(duty.dutyDate)}</Text>
                  </View>
                </Card>
              ))
            )}

            {/* Upcoming Holidays */}
            <View style={[styles.sectionHeaderRow, { marginTop: SPACING.md }]}>
              <Text style={styles.sectionHeaderTitle}>Upcoming Holidays</Text>
              <TouchableOpacity onPress={() => navigation.navigate('HolidayList')}>
                <Text style={styles.linkText}>All Holidays</Text>
              </TouchableOpacity>
            </View>

            {holidays.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Text style={styles.emptyCardSub}>No company holidays scheduled in the next 30 days.</Text>
              </Card>
            ) : (
              holidays.map((h) => (
                <Card key={h._id} style={styles.holidayCard}>
                  <View style={styles.holidayRow}>
                    <View style={styles.holidayIcon}>
                      <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    </View>
                    <View style={styles.holidayInfo}>
                      <Text style={styles.holidayName}>{h.holidayName}</Text>
                      <Text style={styles.holidayDates}>
                        {formatDate(h.startDate)} {h.startDate !== h.endDate && `- ${formatDate(h.endDate)}`}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  designationText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  notificationBadgeBtn: {
    position: 'relative',
    padding: SPACING.xs,
    marginRight: 4,
  },
  unreadDotBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: COLORS.danger,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: COLORS.background,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  avatarButton: {
    padding: SPACING.xs,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  quickActionBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dutyQuickAction: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  leaveQuickAction: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
  },
  dutyHistoryAction: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  callBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  callBadgeText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  quickActionSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveStatusCard: {
    marginBottom: SPACING.lg,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  leavePillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  pillItem: {
    alignItems: 'center',
  },
  pillNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  pillLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  countBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  emptyCardSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  dutyCard: {
    marginBottom: SPACING.sm,
  },
  dutyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  machineText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  dutyBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  workTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  holidayCard: {
    marginBottom: SPACING.sm,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holidayIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  holidayInfo: {
    flex: 1,
  },
  holidayName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  holidayDates: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
});

export default EmployeeDashboardScreen;
