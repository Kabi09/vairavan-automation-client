import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
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

  // Highlights modal state
  const [highlightsModalVisible, setHighlightsModalVisible] = useState(false);

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
  const thisMonthHolidays = data?.thisMonthHolidays || [];
  const todayBirthdays = data?.todayBirthdays || [];
  const thisMonthBirthdays = data?.thisMonthBirthdays || [];
  const isMyBirthday = Boolean(data?.isMyBirthday);

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

        {/* Birthday Celebration Highlights */}
        {isMyBirthday ? (
          <Card style={styles.personalBirthdayCard}>
            <View style={styles.birthdayRow}>
              <View style={styles.birthdayAvatarWrapper}>
                {user?.avatar ? (
                  <Image
                    source={{
                      uri: typeof user.avatar === 'string' ? user.avatar : user.avatar.url,
                    }}
                    style={styles.birthdayAvatarImg}
                  />
                ) : (
                  <View style={styles.birthdayAvatarLettersWrap}>
                    <Text style={styles.birthdayAvatarLetters}>
                      {(user?.employeeName || 'U').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.birthdayBadgeMini}>
                  <Text style={{ fontSize: 9 }}>🎉</Text>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.personalBirthdayTitle}>Happy Birthday, {user?.employeeName}! 🎂</Text>
                <Text style={styles.personalBirthdaySub}>
                  Wishing you a joyful celebration and another great year of success!
                </Text>
              </View>
            </View>
          </Card>
        ) : todayBirthdays.length > 0 ? (
          <Card style={styles.teamBirthdayCard}>
            <View style={styles.birthdayRow}>
              {todayBirthdays.length === 1 ? (
                <View style={styles.birthdayAvatarWrapper}>
                  {todayBirthdays[0].avatar ? (
                    <Image
                      source={{
                        uri:
                          typeof todayBirthdays[0].avatar === 'string'
                            ? todayBirthdays[0].avatar
                            : todayBirthdays[0].avatar.url,
                      }}
                      style={styles.birthdayAvatarImg}
                    />
                  ) : (
                    <View style={styles.birthdayAvatarLettersWrap}>
                      <Text style={styles.birthdayAvatarLetters}>
                        {(todayBirthdays[0].employeeName || 'U').substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.birthdayBadgeMini}>
                    <Text style={{ fontSize: 9 }}>🎂</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.multiAvatarRow}>
                  {todayBirthdays.slice(0, 3).map((b, idx) => {
                    const avUrl = typeof b.avatar === 'string' ? b.avatar : b.avatar?.url;
                    return (
                      <View
                        key={b._id || idx}
                        style={[styles.stackedAvatar, { marginLeft: idx > 0 ? -12 : 0 }]}
                      >
                        {avUrl ? (
                          <Image source={{ uri: avUrl }} style={styles.stackedAvatarImg} />
                        ) : (
                          <View style={styles.stackedAvatarLettersWrap}>
                            <Text style={styles.stackedAvatarLetters}>
                              {(b.employeeName || 'U').substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.birthdayBadgeMini}>
                    <Text style={{ fontSize: 9 }}>🎂</Text>
                  </View>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: SPACING.md }}>
                <Text style={styles.teamBirthdayTitle}>Today's Team Birthday! 🎂</Text>
                <Text style={styles.teamBirthdaySub}>
                  {todayBirthdays.map((b) => `${b.employeeName} (${b.designation || 'Staff'})`).join(', ')}
                </Text>
              </View>
            </View>
          </Card>
        ) : null}

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
                style={[styles.quickActionBtn, styles.highlightsAction]}
                onPress={() => setHighlightsModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="sparkles" size={24} color="#D97706" />
                </View>
                <Text style={styles.quickActionTitle}>Highlights</Text>
                <Text style={styles.quickActionSub}>This month</Text>
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
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => navigation.navigate('MyDutiesTab')}
                activeOpacity={0.7}
              >
                <Text style={styles.linkText}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
              </TouchableOpacity>
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
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.customerText}>{duty.customerName}</Text>
                      <Text style={styles.dutyIdBadgeText}>
                        {duty.dutyId || `DUTY-${duty._id.slice(-6).toUpperCase()}`}
                      </Text>
                    </View>
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
      {/* Monthly Highlights Modal */}
      <Modal
        visible={highlightsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setHighlightsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.highlightsModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>This Month's Highlights ✨</Text>
                <Text style={styles.modalSubtitle}>Monthly factory holidays & team celebrations</Text>
              </View>
              <TouchableOpacity
                onPress={() => setHighlightsModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollBody} showsVerticalScrollIndicator={false}>
              {/* SECTION 1: FIRST SHOW ONLY THIS MONTH'S HOLIDAYS */}
              <View style={styles.highlightSectionHeader}>
                <Ionicons name="calendar" size={16} color={COLORS.primary} />
                <Text style={styles.highlightSectionTitle}>Only This Month's Holidays</Text>
                <View style={styles.monthPillBadge}>
                  <Text style={styles.monthPillText}>{thisMonthHolidays.length} Holidays</Text>
                </View>
              </View>

              {thisMonthHolidays.length === 0 ? (
                <View style={styles.emptyHighlightBox}>
                  <Ionicons name="sunny-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyHighlightTitle}>No Holidays This Month</Text>
                  <Text style={styles.emptyHighlightSub}>
                    Regular operational schedule applies for the current month.
                  </Text>
                </View>
              ) : (
                thisMonthHolidays.map((h) => (
                  <Card key={h._id} style={styles.highlightHolidayCard}>
                    <View style={styles.highlightHolidayRow}>
                      <View style={styles.highlightHolidayIcon}>
                        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.highlightHolidayName}>{h.holidayName}</Text>
                        <Text style={styles.highlightHolidayDates}>
                          {formatDate(h.startDate)} {h.startDate !== h.endDate && `to ${formatDate(h.endDate)}`}
                        </Text>
                        {h.description ? (
                          <Text style={styles.highlightHolidayDesc}>{h.description}</Text>
                        ) : null}
                      </View>
                    </View>
                  </Card>
                ))
              )}

              {/* SECTION 2: THIS MONTH'S BIRTHDAYS */}
              <View style={[styles.highlightSectionHeader, { marginTop: SPACING.lg }]}>
                <Ionicons name="gift" size={16} color="#D97706" />
                <Text style={styles.highlightSectionTitle}>Birthdays This Month 🎂</Text>
                <View style={[styles.monthPillBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.monthPillText, { color: '#B45309' }]}>
                    {thisMonthBirthdays.length} Celeb
                  </Text>
                </View>
              </View>

              {thisMonthBirthdays.length === 0 ? (
                <View style={styles.emptyHighlightBox}>
                  <Ionicons name="balloon-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyHighlightTitle}>No Birthdays This Month</Text>
                  <Text style={styles.emptyHighlightSub}>
                    No registered colleague birthdays in the current month.
                  </Text>
                </View>
              ) : (
                thisMonthBirthdays.map((b) => {
                  const avUrl = typeof b.avatar === 'string' ? b.avatar : b.avatar?.url;
                  return (
                    <Card key={b._id} style={styles.birthdayMemberCard}>
                      <View style={styles.birthdayMemberRow}>
                        <View style={styles.birthdayMemberAvatar}>
                          {avUrl ? (
                            <Image
                              source={{ uri: avUrl }}
                              style={styles.birthdayMemberAvatarImg}
                            />
                          ) : (
                            <Text style={styles.birthdayMemberLetters}>
                              {(b.employeeName || 'U').substring(0, 2).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                          <Text style={styles.birthdayMemberName}>{b.employeeName}</Text>
                        <Text style={styles.birthdayMemberMeta}>
                          {b.designation || 'Colleague'} • ID: {b.employeeId}
                        </Text>
                      </View>
                      <View style={styles.birthdayDayPill}>
                        <Ionicons name="sparkles" size={12} color="#D97706" style={{ marginRight: 4 }} />
                        <Text style={styles.birthdayDayText}>
                          {new Date(b.dateOfBirth).getDate()}{' '}
                          {new Date(b.dateOfBirth).toLocaleString('default', { month: 'short' })}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })
              )}

              <TouchableOpacity
                style={styles.viewFullHolidaysBtn}
                onPress={() => {
                  setHighlightsModalVisible(false);
                  navigation.navigate('HolidayList');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.viewFullHolidaysText}>View Full Year Calendar</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </ScrollView>
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
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  dutyIdBadgeText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 1,
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
  personalBirthdayCard: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  teamBirthdayCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  birthdayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  birthdayAvatarWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  birthdayAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  birthdayAvatarLettersWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayAvatarLetters: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  birthdayBadgeMini: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
    elevation: 2,
  },
  multiAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingRight: 6,
  },
  stackedAvatar: {
    position: 'relative',
    elevation: 2,
  },
  stackedAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stackedAvatarLettersWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedAvatarLetters: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  personalBirthdayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#854D0E',
  },
  personalBirthdaySub: {
    fontSize: 12,
    color: '#A16207',
    marginTop: 2,
    fontWeight: '500',
  },
  teamBirthdayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  teamBirthdaySub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    fontWeight: '500',
  },
  highlightsAction: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  highlightsModalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalScrollBody: {
    maxHeight: 460,
  },
  highlightSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: 6,
  },
  highlightSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  monthPillBadge: {
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  monthPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyHighlightBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  emptyHighlightTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.xs,
  },
  emptyHighlightSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: SPACING.md,
  },
  highlightHolidayCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  highlightHolidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightHolidayIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  highlightHolidayName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  highlightHolidayDates: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  highlightHolidayDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  birthdayMemberCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  birthdayMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  birthdayMemberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  birthdayMemberAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  birthdayMemberLetters: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D97706',
  },
  birthdayMemberName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  birthdayMemberMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  birthdayDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  birthdayDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  viewFullHolidaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 4,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  viewFullHolidaysText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default EmployeeDashboardScreen;
