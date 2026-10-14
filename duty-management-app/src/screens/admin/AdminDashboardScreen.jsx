import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import dashboardApi from '../../api/dashboardApi';
import notificationApi from '../../api/notificationApi';
import taskApi from '../../api/taskApi';
import Card from '../../components/Card';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import TaskCreateModal from '../../components/TaskCreateModal';
import TaskDetailsModal from '../../components/TaskDetailsModal';
import { formatDate, getTodayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

export const AdminDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { unreadCount, refreshNotifications } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Calendar & Attendance modal
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [calendarTab, setCalendarTab] = useState('leaves'); // 'leaves' | 'holidays'

  // Task assignment states
  const [tasks, setTasks] = useState([]);
  const [taskCreateModalVisible, setTaskCreateModalVisible] = useState(false);
  const [taskDetailsModalVisible, setTaskDetailsModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const loadTasks = useCallback(async () => {
    try {
      const res = await taskApi.getTasks({ limit: 10 });
      if (res.data?.tasks) {
        setTasks(res.data.tasks);
      }
    } catch (err) {
      console.warn('Failed to load tasks in admin dashboard:', err);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setError('');
      const dashRes = await dashboardApi.getAdminDashboard();
      if (dashRes.data) {
        setData(dashRes.data);
      }
      loadTasks();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load admin dashboard'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadTasks]);

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
  const todaysLeaves = data?.todaysLeaves || [];
  const todayBirthdays = data?.todayBirthdays || [];
  const thisMonthBirthdays = data?.thisMonthBirthdays || [];

  const todaysHolidays = useMemo(() => {
    if (data?.todaysHolidays && data.todaysHolidays.length > 0) {
      return data.todaysHolidays;
    }
    const todayStr = getTodayDateString();
    return (data?.upcomingHolidays || []).filter((h) => {
      const startStr = h.startDate ? h.startDate.split('T')[0] : '';
      const endStr = h.endDate ? h.endDate.split('T')[0] : '';
      return startStr <= todayStr && endStr >= todayStr;
    });
  }, [data]);

  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const carouselRef = useRef(null);
  const activeHighlightIndexRef = useRef(0);

  useEffect(() => {
    activeHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex]);

  const highlightSlides = useMemo(() => {
    const slides = [];

    if (todayBirthdays.length > 0) {
      slides.push({
        id: 'birthday',
        node: (
          <Card style={[styles.birthdayHighlightCard, { marginBottom: 0 }]}>
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
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <Text style={styles.birthdayTitle}>Today's Birthday Celebration! 🎂</Text>
                <Text style={styles.birthdayText} numberOfLines={2}>
                  {todayBirthdays
                    .map((b) => `${b.employeeName} (${b.employeeId || b.designation || 'Employee'})`)
                    .join(', ')}
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    }

    if (todaysLeaves.length > 0) {
      slides.push({
        id: 'leave',
        node: (
          <Card
            style={[styles.leaveHighlightCard, { marginBottom: 0 }]}
            onPress={() => {
              setCalendarTab('leaves');
              setCalendarModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.birthdayRow}>
              {todaysLeaves.length === 1 ? (
                (() => {
                  const emp = todaysLeaves[0].employee || {};
                  const avUrl = typeof emp.avatar === 'string' ? emp.avatar : emp.avatar?.url;
                  return (
                    <View style={styles.leaveAvatarWrapper}>
                      {avUrl ? (
                        <Image source={{ uri: avUrl }} style={styles.leaveHighlightAvatarImg} />
                      ) : (
                        <View style={styles.leaveAvatarLettersWrap}>
                          <Text style={styles.leaveAvatarLetters}>
                            {(emp.employeeName || 'U').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.leaveBadgeMini}>
                        <Text style={{ fontSize: 9 }}>🌴</Text>
                      </View>
                    </View>
                  );
                })()
              ) : (
                <View style={styles.multiAvatarRow}>
                  {todaysLeaves.slice(0, 3).map((l, idx) => {
                    const emp = l.employee || {};
                    const avUrl = typeof emp.avatar === 'string' ? emp.avatar : emp.avatar?.url;
                    return (
                      <View
                        key={l._id || idx}
                        style={[styles.stackedAvatar, { marginLeft: idx > 0 ? -12 : 0 }]}
                      >
                        {avUrl ? (
                          <Image source={{ uri: avUrl }} style={styles.leaveStackedAvatarImg} />
                        ) : (
                          <View style={styles.leaveStackedAvatarLettersWrap}>
                            <Text style={styles.leaveStackedAvatarLetters}>
                              {(emp.employeeName || 'U').substring(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  <View style={styles.leaveBadgeMini}>
                    <Text style={{ fontSize: 9 }}>🌴</Text>
                  </View>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <View style={styles.highlightHeaderRow}>
                  <Text style={styles.leaveHighlightTitle}>Employees On Leave Today 🌴</Text>
                  <Ionicons name="chevron-forward" size={14} color="#2563EB" />
                </View>
                <Text style={styles.leaveHighlightText} numberOfLines={2}>
                  {todaysLeaves
                    .map((l) => {
                      const emp = l.employee || {};
                      return `${emp.employeeName || 'Employee'} (${emp.employeeId || emp.designation || 'Employee'})`;
                    })
                    .join(', ')}
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    }

    if (todaysHolidays.length > 0) {
      slides.push({
        id: 'holiday',
        node: (
          <Card
            style={[styles.holidayHighlightCard, { marginBottom: 0 }]}
            onPress={() => {
              setCalendarTab('holidays');
              setCalendarModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.birthdayRow}>
              <View style={styles.holidayIconWrap}>
                <Ionicons name="sparkles" size={20} color="#15803D" />
                <View style={styles.holidayBadgeMini}>
                  <Text style={{ fontSize: 9 }}>🎉</Text>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <View style={styles.highlightHeaderRow}>
                  <Text style={styles.holidayHighlightTitle}>Today is a Company Holiday! 🎉</Text>
                  <Ionicons name="chevron-forward" size={14} color="#15803D" />
                </View>
                <Text style={styles.holidayHighlightText} numberOfLines={2}>
                  {todaysHolidays.map((h) => h.holidayName).join(' • ')}
                  {todaysHolidays[0]?.description ? ` (${todaysHolidays[0].description})` : ''}
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    }

    return slides;
  }, [todayBirthdays, todaysLeaves, todaysHolidays]);

  // Smooth animated auto-scroll for highlight slides (Birthday, Holiday, Leaves)
  useEffect(() => {
    if (highlightSlides.length <= 1) return;

    const interval = setInterval(() => {
      const nextIdx = (activeHighlightIndexRef.current + 1) % highlightSlides.length;
      carouselRef.current?.scrollTo({
        x: nextIdx * SLIDE_WIDTH,
        animated: true,
      });
      setActiveHighlightIndex(nextIdx);
    }, 3500);

    return () => clearInterval(interval);
  }, [highlightSlides.length]);

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
            {/* Sliding Highlight Banners (Birthday, On-Leave, Holiday) */}
            {highlightSlides.length === 1 && (
              <View style={{ marginBottom: SPACING.md, paddingHorizontal: 4 }}>
                {highlightSlides[0].node}
              </View>
            )}

            {highlightSlides.length > 1 && (
              <View style={styles.carouselContainer}>
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  snapToInterval={SLIDE_WIDTH}
                  snapToAlignment="center"
                  decelerationRate="fast"
                  bounces={false}
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(offsetX / SLIDE_WIDTH);
                    if (idx !== activeHighlightIndex && idx >= 0 && idx < highlightSlides.length) {
                      setActiveHighlightIndex(idx);
                    }
                  }}
                  onMomentumScrollEnd={(e) => {
                    const offsetX = e.nativeEvent.contentOffset.x;
                    const idx = Math.round(offsetX / SLIDE_WIDTH);
                    if (idx >= 0 && idx < highlightSlides.length) {
                      setActiveHighlightIndex(idx);
                    }
                  }}
                  scrollEventThrottle={16}
                >
                  {highlightSlides.map((slide) => (
                    <View key={slide.id} style={{ width: SLIDE_WIDTH, paddingHorizontal: 4, justifyContent: 'center' }}>
                      {slide.node}
                    </View>
                  ))}
                </ScrollView>

                {/* Carousel Pagination Dots */}
                <View style={styles.carouselDotsRow}>
                  {highlightSlides.map((s, dotIdx) => (
                    <View
                      key={s.id}
                      style={[
                        styles.carouselDot,
                        activeHighlightIndex === dotIdx && styles.carouselDotActive,
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

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
                <Text style={styles.metricLabel}>Today's Works</Text>
              </Card>

              <Card
                style={styles.metricCard}
                onPress={() => setCalendarModalVisible(true)}
              >
                <View style={[styles.metricIcon, { backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="calendar" size={22} color="#7C3AED" />
                </View>
                <Text style={styles.metricValue}>
                  {todaysLeaves.length}
                </Text>
                <Text style={styles.metricLabel}>Calendar & Off</Text>
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

            {/* Assigned Tasks Section */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.sectionTitle}>Assigned Tasks</Text>
                {tasks.length > 0 && (
                  <View style={styles.taskCountBadge}>
                    <Text style={styles.taskCountText}>{tasks.length}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.assignTaskBtn}
                onPress={() => setTaskCreateModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={styles.assignTaskBtnText}>Assign Task</Text>
              </TouchableOpacity>
            </View>

            {tasks.length === 0 ? (
              <Card style={{ marginBottom: SPACING.md }}>
                <Text style={styles.emptyText}>
                  No tasks assigned yet. Tap "+ Assign Task" to assign work to employees.
                </Text>
              </Card>
            ) : (
              tasks.slice(0, 4).map((t) => {
                const isDone = t.status === 'completed';
                const isInProg = t.status === 'in_progress';
                return (
                  <Card
                    key={t._id}
                    style={styles.taskCardItem}
                    onPress={() => {
                      setSelectedTask(t);
                      setTaskDetailsModalVisible(true);
                    }}
                  >
                    <View style={styles.taskCardHeader}>
                      <Text style={styles.taskCardTitle} numberOfLines={1}>
                        {t.taskName}
                      </Text>
                      <View
                        style={[
                          styles.taskStatusPill,
                          isDone
                            ? styles.statusPillDone
                            : isInProg
                            ? styles.statusPillProg
                            : styles.statusPillPend,
                        ]}
                      >
                        <Text
                          style={[
                            styles.taskStatusText,
                            isDone
                              ? styles.textDone
                              : isInProg
                              ? styles.textProg
                              : styles.textPend,
                          ]}
                        >
                          {t.status === 'in_progress'
                            ? 'In Progress'
                            : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.taskCompanyText} numberOfLines={1}>
                      <Ionicons name="business-outline" size={13} color={COLORS.primary} />{' '}
                      {t.company?.companyName || 'Client'}
                      {t.company?.location ? ` • ${t.company.location}` : ''}
                    </Text>

                    <View style={styles.taskCardFooter}>
                      <Text style={styles.taskStaffText} numberOfLines={1}>
                        <Ionicons name="people-outline" size={12} color={COLORS.textSecondary} />{' '}
                        {t.assignedEmployees?.map((e) => e.employeeName).join(', ') || 'Staff'}
                      </Text>
                      <Text style={styles.taskDateText}>{formatDate(t.createdAt)}</Text>
                    </View>
                  </Card>
                );
              })
            )}

            {/* Recent Work Submissions */}
            <View style={[styles.sectionHeaderRow, { marginTop: SPACING.md }]}>
              <Text style={styles.sectionTitle}>Recent Work Activity</Text>
              <TouchableOpacity onPress={() => navigation.navigate('DutiesTab')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentDuties.length === 0 ? (
              <Card>
                <Text style={styles.emptyText}>No recent works submitted</Text>
              </Card>
            ) : (
              recentDuties.map((duty) => {
                const companyLocation = duty.company?.location || duty.location?.address;
                return (
                  <Card
                    key={duty._id}
                    style={styles.dutyItemCard}
                    onPress={() => navigation.navigate('DutyDetails', { dutyId: duty._id })}
                  >
                    <View style={styles.dutyItemHeader}>
                      <Text style={styles.dutyCustomer}>{duty.customerName}</Text>
                      <Text style={styles.dutyDate}>{formatDate(duty.dutyDate)}</Text>
                    </View>
                    {duty.company?.companyName ? (
                      <Text style={styles.dutyCompanyText}>
                        <Ionicons name="business-outline" size={12} color={COLORS.textSecondary} />{' '}
                        {duty.company.companyName}
                        {companyLocation ? ` • ${companyLocation}` : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.dutyMachine}>
                      <Ionicons name="hardware-chip-outline" size={12} color={COLORS.textSecondary} />{' '}
                      {duty.machineName} • {formatWorkType(duty)}
                    </Text>
                    <View style={styles.dutyItemFooter}>
                      <Text style={styles.dutyEmployee}>
                        {duty.employee?.employeeName || 'Employee'}
                      </Text>
                    </View>
                  </Card>
                );
              })
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

      {/* Calendar & Attendance Modal */}
      <Modal
        visible={calendarModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCalendarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.calendarModalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Company Calendar & Leaves</Text>
                <Text style={styles.modalSubtitle}>Today's team off-duty logs and holiday schedule</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCalendarModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Segmented Tabs */}
            <View style={styles.modalTabsRow}>
              <TouchableOpacity
                style={[styles.modalTabBtn, calendarTab === 'leaves' && styles.modalTabBtnActive]}
                onPress={() => setCalendarTab('leaves')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="airplane-outline"
                  size={16}
                  color={calendarTab === 'leaves' ? COLORS.primary : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.modalTabText, calendarTab === 'leaves' && styles.modalTabTextActive]}
                >
                  On Leave Today ({todaysLeaves.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTabBtn, calendarTab === 'holidays' && styles.modalTabBtnActive]}
                onPress={() => setCalendarTab('holidays')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={calendarTab === 'holidays' ? COLORS.primary : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[styles.modalTabText, calendarTab === 'holidays' && styles.modalTabTextActive]}
                >
                  Holidays ({upcomingHolidays.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: On Leave Today */}
            {calendarTab === 'leaves' ? (
              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                {todaysLeaves.length === 0 ? (
                  <View style={styles.emptyAttendanceWrap}>
                    <View style={styles.emptyAttendanceIcon}>
                      <Ionicons name="checkmark-done-circle" size={48} color={COLORS.success} />
                    </View>
                    <Text style={styles.emptyAttendanceTitle}>Full Attendance Today!</Text>
                    <Text style={styles.emptyAttendanceSub}>
                      No employees are on leave today. All active field technicians are available.
                    </Text>
                  </View>
                ) : (
                  todaysLeaves.map((leave) => {
                    const emp = leave.employee || {};
                    const avatarUrl = typeof emp.avatar === 'string' ? emp.avatar : emp.avatar?.url;
                    return (
                      <Card key={leave._id} style={styles.leaveEmployeeCard}>
                        <View style={styles.leaveEmployeeHeader}>
                          <View style={styles.leaveEmployeeAvatar}>
                            {avatarUrl ? (
                              <Image
                                source={{ uri: avatarUrl }}
                                style={styles.leaveEmployeeAvatarImg}
                              />
                            ) : (
                              <Text style={styles.leaveAvatarLetters}>
                                {(emp.employeeName || 'U').substring(0, 2).toUpperCase()}
                              </Text>
                            )}
                          </View>
                          <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                            <Text style={styles.leaveEmployeeName}>{emp.employeeName || 'Employee'}</Text>
                            <Text style={styles.leaveEmployeeMeta}>
                              ID: {emp.employeeId} • {emp.designation || 'Staff'}
                            </Text>
                          </View>
                          <View style={styles.leaveTypeBadge}>
                            <Text style={styles.leaveTypeBadgeText}>
                              {(leave.leaveType || 'LEAVE').toUpperCase()}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.leaveDetailsBox}>
                          <View style={styles.leaveDateRow}>
                            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                            <Text style={styles.leaveDateText}>
                              {formatDate(leave.startDate)} {leave.startDate !== leave.endDate && `to ${formatDate(leave.endDate)}`}
                            </Text>
                          </View>
                          {leave.reason ? (
                            <Text style={styles.leaveReasonText} numberOfLines={2}>
                              "{leave.reason}"
                            </Text>
                          ) : null}
                        </View>

                        {emp.phoneNumber ? (
                          <TouchableOpacity
                            style={styles.callEmployeeBtn}
                            onPress={() => Linking.openURL(`tel:${emp.phoneNumber}`)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="call" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                            <Text style={styles.callEmployeeText}>Call: {emp.phoneNumber}</Text>
                          </TouchableOpacity>
                        ) : null}
                      </Card>
                    );
                  })
                )}
              </ScrollView>
            ) : (
              /* Tab 2: Holidays Add & List */
              <ScrollView style={styles.modalBodyScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.addHolidayActionBtn}
                  onPress={() => {
                    setCalendarModalVisible(false);
                    navigation.navigate('HolidayManagement');
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.addHolidayActionText}>+ Add New Company Holiday</Text>
                </TouchableOpacity>

                {upcomingHolidays.length === 0 ? (
                  <View style={styles.emptyAttendanceWrap}>
                    <Ionicons name="calendar-outline" size={42} color={COLORS.textMuted} />
                    <Text style={styles.emptyAttendanceTitle}>No Upcoming Holidays</Text>
                    <Text style={styles.emptyAttendanceSub}>
                      Tap the button above to add factory holidays or festival breaks.
                    </Text>
                  </View>
                ) : (
                  upcomingHolidays.map((holiday) => (
                    <Card key={holiday._id} style={styles.modalHolidayItem}>
                      <View style={styles.holidayRow}>
                        <View style={styles.holidayIcon}>
                          <Ionicons name="calendar" size={18} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.holidayName}>{holiday.holidayName}</Text>
                          <Text style={styles.holidayDate}>
                            {formatDate(holiday.startDate)} {holiday.startDate !== holiday.endDate && `to ${formatDate(holiday.endDate)}`}
                          </Text>
                          {holiday.description ? (
                            <Text style={styles.holidayDescText}>{holiday.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  ))
                )}

                <TouchableOpacity
                  style={styles.viewFullHolidaysBtn}
                  onPress={() => {
                    setCalendarModalVisible(false);
                    navigation.navigate('HolidayManagement');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewFullHolidaysText}>Open Full Holiday Manager</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Task Modal */}
      <TaskCreateModal
        visible={taskCreateModalVisible}
        onClose={() => setTaskCreateModalVisible(false)}
        onTaskCreated={() => {
          loadTasks();
        }}
      />

      {/* Task Details Modal */}
      <TaskDetailsModal
        visible={taskDetailsModalVisible}
        task={selectedTask}
        onClose={() => {
          setTaskDetailsModalVisible(false);
          setSelectedTask(null);
        }}
        onTaskUpdated={() => {
          loadTasks();
        }}
        currentUser={user}
      />
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
  dutyCompanyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  assignTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  assignTaskBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  taskCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  taskCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  taskCardItem: {
    marginBottom: SPACING.sm,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  taskCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  taskStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  taskStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillDone: {
    backgroundColor: '#DCFCE7',
  },
  statusPillProg: {
    backgroundColor: '#DBEAFE',
  },
  statusPillPend: {
    backgroundColor: '#FEF3C7',
  },
  textDone: {
    color: '#15803D',
  },
  textProg: {
    color: '#1E40AF',
  },
  textPend: {
    color: '#B45309',
  },
  taskCompanyText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  taskStaffText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 6,
  },
  taskDateText: {
    fontSize: 11,
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
  carouselContainer: {
    marginBottom: SPACING.md,
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  carouselDotActive: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  birthdayHighlightCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
  },
  birthdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  birthdayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
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
  birthdayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  birthdayText: {
    fontSize: 13,
    color: '#B45309',
    marginTop: 2,
    fontWeight: '500',
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveHighlightCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
  },
  leaveAvatarWrapper: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  leaveHighlightAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  leaveAvatarLettersWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBadgeMini: {
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
    borderColor: '#BFDBFE',
    elevation: 2,
  },
  leaveStackedAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  leaveStackedAvatarLettersWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveStackedAvatarLetters: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  leaveHighlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
  },
  leaveHighlightText: {
    fontSize: 13,
    color: '#2563EB',
    marginTop: 2,
    fontWeight: '500',
  },
  holidayHighlightCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
  },
  holidayIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  holidayBadgeMini: {
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
    borderColor: '#BBF7D0',
    elevation: 2,
  },
  holidayHighlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  holidayHighlightText: {
    fontSize: 13,
    color: '#15803D',
    marginTop: 2,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  calendarModalContent: {
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
  modalTabsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  modalTabBtnActive: {
    backgroundColor: COLORS.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  modalBodyScroll: {
    maxHeight: 400,
  },
  emptyAttendanceWrap: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyAttendanceIcon: {
    marginBottom: SPACING.sm,
  },
  emptyAttendanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyAttendanceSub: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.xl,
    lineHeight: 18,
  },
  leaveEmployeeCard: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  leaveEmployeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveEmployeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  leaveEmployeeAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  leaveAvatarLetters: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  leaveEmployeeName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  leaveEmployeeMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  leaveTypeBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  leaveTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  leaveDetailsBox: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  leaveDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaveDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  leaveReasonText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  callEmployeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primarySubtle,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    marginTop: SPACING.sm,
  },
  callEmployeeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  addHolidayActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
  },
  addHolidayActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalHolidayItem: {
    marginBottom: SPACING.sm,
    padding: SPACING.md,
  },
  holidayDescText: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  viewFullHolidaysBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 4,
  },
  viewFullHolidaysText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default AdminDashboardScreen;
