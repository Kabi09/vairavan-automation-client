import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
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
import { formatDate } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const AdminDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { unreadCount, refreshNotifications } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      setError('');
      const dashRes = await dashboardApi.getAdminDashboard();
      if (dashRes.data) {
        setData(dashRes.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load admin dashboard'));
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

  const metrics = data?.metrics || {};
  const upcomingHolidays = data?.upcomingHolidays || [];
  const recentDuties = data?.recentDuties || [];

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
            <Text style={styles.greeting}>Administrator Portal</Text>
            <Text style={styles.userName}>{user?.employeeName || 'Admin'}</Text>
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
              style={styles.profileBadge}
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.7}
            >
              <Ionicons name="person-circle-outline" size={36} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ErrorMessage message={error} onRetry={fetchDashboard} />

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading dashboard analytics..." />
        ) : (
          <>
            {/* Metric Grid */}
            <Text style={styles.sectionTitle}>Overview Metrics</Text>
            <View style={styles.metricsGrid}>
              <Card
                style={styles.metricCard}
                onPress={() => navigation.navigate('EmployeesTab')}
              >
                <View style={[styles.metricIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="people" size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.metricValue}>
                  {metrics.totalActiveEmployees ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Active Employees</Text>
              </Card>

              <Card
                style={styles.metricCard}
                onPress={() => navigation.navigate('CompaniesTab')}
              >
                <View style={[styles.metricIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="business" size={22} color={COLORS.success} />
                </View>
                <Text style={styles.metricValue}>
                  {metrics.totalActiveCompanies ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Active Companies</Text>
              </Card>

              <Card
                style={styles.metricCard}
                onPress={() => navigation.navigate('DutiesTab', { filterToday: true })}
              >
                <View style={[styles.metricIcon, { backgroundColor: '#FFFBEB' }]}>
                  <Ionicons name="clipboard" size={22} color={COLORS.warning} />
                </View>
                <Text style={styles.metricValue}>
                  {metrics.todaySubmittedDuties ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Today's Duties</Text>
              </Card>

              <Card
                style={styles.metricCard}
                onPress={() => navigation.navigate('DutiesTab')}
              >
                <View style={[styles.metricIcon, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="hourglass" size={22} color={COLORS.danger} />
                </View>
                <Text style={styles.metricValue}>
                  {metrics.pendingDutyReviews ?? 0}
                </Text>
                <Text style={styles.metricLabel}>Pending Reviews</Text>
              </Card>
            </View>

            {/* Leave Summaries Banner */}
            <Card
              style={styles.leaveBannerCard}
              onPress={() => navigation.navigate('LeavesTab')}
            >
              <View style={styles.leaveBannerHeader}>
                <Text style={styles.bannerTitle}>Leave Request Status</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.leaveStatsRow}>
                <View style={styles.leaveStatItem}>
                  <Text style={[styles.leaveStatNumber, { color: COLORS.warning }]}>
                    {metrics.leaves?.pending ?? 0}
                  </Text>
                  <Text style={styles.leaveStatLabel}>Pending</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.leaveStatItem}>
                  <Text style={[styles.leaveStatNumber, { color: COLORS.success }]}>
                    {metrics.leaves?.approved ?? 0}
                  </Text>
                  <Text style={styles.leaveStatLabel}>Approved</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.leaveStatItem}>
                  <Text style={[styles.leaveStatNumber, { color: COLORS.danger }]}>
                    {metrics.leaves?.rejected ?? 0}
                  </Text>
                  <Text style={styles.leaveStatLabel}>Rejected</Text>
                </View>
              </View>
            </Card>

            {/* Recent Duty Submissions */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Duty Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DutiesTab')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentDuties.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No recent duties submitted</Text>
              </Card>
            ) : (
              recentDuties.map((duty) => (
                <Card
                  key={duty._id}
                  style={styles.dutyItemCard}
                  onPress={() => navigation.navigate('DutyDetails', { dutyId: duty._id })}
                >
                  <View style={styles.dutyItemHeader}>
                    <Text style={styles.dutyCustomer}>{duty.customerName}</Text>
                    <StatusBadge status={duty.status} />
                  </View>
                  <Text style={styles.dutyMachine}>
                    {duty.machineName} • {duty.workType}
                  </Text>
                  <View style={styles.dutyItemFooter}>
                    <Text style={styles.dutyEmployee}>
                      {duty.employee?.employeeName || 'Employee'}
                    </Text>
                    <Text style={styles.dutyDate}>{formatDate(duty.dutyDate)}</Text>
                  </View>
                </Card>
              ))
            )}

            {/* Upcoming Holidays */}
            <View style={[styles.sectionHeaderRow, { marginTop: SPACING.md }]}>
              <Text style={styles.sectionTitle}>Upcoming Holidays</Text>
              <TouchableOpacity onPress={() => navigation.navigate('HolidayManagement')}>
                <Text style={styles.viewAllText}>Manage</Text>
              </TouchableOpacity>
            </View>

            {upcomingHolidays.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No upcoming holidays scheduled</Text>
              </Card>
            ) : (
              upcomingHolidays.map((holiday) => (
                <Card key={holiday._id} style={styles.holidayCard}>
                  <View style={styles.holidayRow}>
                    <View style={styles.holidayIcon}>
                      <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.holidayInfo}>
                      <Text style={styles.holidayName}>{holiday.holidayName}</Text>
                      <Text style={styles.holidayDate}>
                        {formatDate(holiday.startDate)} - {formatDate(holiday.endDate)}
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
  profileBadge: {
    padding: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  metricCard: {
    width: '47.5%',
    marginBottom: SPACING.xs,
    padding: SPACING.md,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  metricLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  leaveBannerCard: {
    backgroundColor: '#F8FAFC',
    marginVertical: SPACING.sm,
  },
  leaveBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  leaveStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  leaveStatItem: {
    alignItems: 'center',
  },
  leaveStatNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  leaveStatLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: COLORS.border,
  },
  dutyItemCard: {
    marginBottom: SPACING.sm,
  },
  dutyItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dutyCustomer: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  dutyMachine: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  dutyItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  dutyEmployee: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  dutyDate: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SPACING.md,
    fontSize: 13,
  },
  holidayCard: {
    marginBottom: SPACING.sm,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  holidayIcon: {
    width: 36,
    height: 36,
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
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  holidayDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});

export default AdminDashboardScreen;
