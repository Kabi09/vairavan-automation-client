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
import dutyApi from '../../api/dutyApi';
import notificationApi from '../../api/notificationApi';
import calendarApi from '../../api/calendarApi';
import Card from '../../components/Card';
import LoadingIndicator from '../../components/LoadingIndicator';
import ErrorMessage from '../../components/ErrorMessage';
import EmployeeMessagesModal from '../../components/EmployeeMessagesModal';
import BrandingFooter from '../../components/BrandingFooter';
import { formatDate, formatTime, getGreeting, getTodayDateString } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { formatWorkType } from '../../utils/dutyUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_WIDTH = SCREEN_WIDTH - SPACING.lg * 2;

export const EmployeeDashboardScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { unreadCount, unreadDocumentCount, unreadMessageCount, refreshNotifications } = useNotifications();
  const [data, setData] = useState(null);
  const [monthSummary, setMonthSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Highlights modal state
  const [highlightsModalVisible, setHighlightsModalVisible] = useState(false);
  // Messages modal state
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);

  // Active duty session state for Zoho People Check-in/Check-out widget
  const [activeDuty, setActiveDuty] = useState(null);
  const [timerDigits, setTimerDigits] = useState({ hours: '00', minutes: '00', seconds: '00' });

  const todayDuties = data?.todayDuties?.reports || [];
  const lastCompletedDuty = useMemo(() => {
    if (!todayDuties || todayDuties.length === 0) return null;
    const completed = todayDuties.filter(
      (d) =>
        d.status !== 'checked_in' &&
        (Boolean(d.checkOutTime) || Boolean(d.outTime) || d.status === 'submitted' || d.status === 'approved')
    );
    return completed.length > 0 ? completed[completed.length - 1] : null;
  }, [todayDuties]);

  // Helper to extract a valid start Date for active duty
  const getActiveDutyStartTime = (duty) => {
    if (!duty) return new Date();
    if (duty.checkInTime) {
      const d = new Date(duty.checkInTime);
      if (!isNaN(d.getTime())) return d;
    }
    if (duty.createdAt) {
      const d = new Date(duty.createdAt);
      if (!isNaN(d.getTime())) return d;
    }
    if (duty.inTime && typeof duty.inTime === 'string') {
      const parts = duty.inTime.split(':').map(Number);
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        const d = new Date();
        d.setHours(parts[0], parts[1], 0, 0);
        return d;
      }
    }
    return new Date();
  };

  // Running timer when checked in, stopped total duration when checked out, or 00:00:00 when not checked in
  useEffect(() => {
    if (activeDuty) {
      const updateRunningTimer = () => {
        const checkInDate = getActiveDutyStartTime(activeDuty);
        const diffMs = Math.max(0, Date.now() - checkInDate.getTime());
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSecs % 60).padStart(2, '0');
        setTimerDigits({ hours, minutes, seconds });
      };

      updateRunningTimer();
      const interval = setInterval(updateRunningTimer, 1000);
      return () => clearInterval(interval);
    } else if (lastCompletedDuty) {
      // Stopped timer displaying total worked time of completed duty (never wall clock time)
      let totalSecs = 0;
      if (lastCompletedDuty.checkInTime && lastCompletedDuty.checkOutTime) {
        const inT = new Date(lastCompletedDuty.checkInTime).getTime();
        const outT = new Date(lastCompletedDuty.checkOutTime).getTime();
        totalSecs = Math.max(0, Math.floor((outT - inT) / 1000));
      } else if (lastCompletedDuty.totalHours) {
        totalSecs = Math.round(Number(lastCompletedDuty.totalHours) * 3600);
      } else if (lastCompletedDuty.inTime && lastCompletedDuty.outTime) {
        const [inH, inM] = String(lastCompletedDuty.inTime).split(':').map(Number);
        const [outH, outM] = String(lastCompletedDuty.outTime).split(':').map(Number);
        if (!isNaN(inH) && !isNaN(outH)) {
          totalSecs = Math.max(0, ((outH * 60 + outM) - (inH * 60 + inM)) * 60);
        }
      }
      const hours = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
      const seconds = String(totalSecs % 60).padStart(2, '0');
      setTimerDigits({ hours, minutes, seconds });
    } else {
      // Not checked in and no duty completed today: strictly 00 : 00 : 00
      setTimerDigits({ hours: '00', minutes: '00', seconds: '00' });
    }
  }, [activeDuty, lastCompletedDuty]);

  const fetchDashboard = useCallback(async () => {
    try {
      setError('');
      const [dashRes, activeRes, calRes] = await Promise.all([
        dashboardApi.getEmployeeDashboard().catch(() => null),
        dutyApi.getActiveCheckIn().catch(() => null),
        calendarApi.getMonthlyCalendar().catch(() => null),
      ]);
      if (dashRes?.data) {
        setData(dashRes.data);
      }
      if (calRes?.data?.summary) {
        setMonthSummary(calRes.data.summary);
      }
      const activeObj = activeRes?.data?.activeDuty || activeRes?.activeDuty;
      if (activeObj) {
        setActiveDuty(activeObj);
      } else {
        // Fallback: check if dashRes.data.todayDuties reports contain an active checked_in duty
        const activeFromDash = dashRes?.data?.todayDuties?.reports?.find(
          (d) => d.status === 'checked_in' && !d.checkOutTime && !d.outTime
        );
        setActiveDuty(activeFromDash || null);
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

  const recentDuties = data?.recentDuties || [];
  const leaves = data?.leaves || {};
  const holidays = data?.upcomingHolidays || [];
  const thisMonthHolidays = data?.thisMonthHolidays || [];
  const todayBirthdays = data?.todayBirthdays || [];
  const thisMonthBirthdays = data?.thisMonthBirthdays || [];
  const isMyBirthday = Boolean(data?.isMyBirthday);
  const todaysLeaves = data?.todaysLeaves || [];

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

  // Sunday detection in IST
  const isSundayToday = useMemo(() => {
    try {
      const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'long',
      }).format(new Date());
      return dayName.toLowerCase() === 'sunday';
    } catch {
      return new Date().getDay() === 0;
    }
  }, []);

  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const carouselRef = useRef(null);
  const activeHighlightIndexRef = useRef(0);

  useEffect(() => {
    activeHighlightIndexRef.current = activeHighlightIndex;
  }, [activeHighlightIndex]);

  const highlightSlides = useMemo(() => {
    const slides = [];

    // 1. Unified Today's Status: Sunday / Festival Holiday / Combined (Zero Conflict!)
    if (isSundayToday && todaysHolidays.length > 0) {
      // Coinciding: Today is BOTH Sunday and a Festival Holiday (e.g. Diwali on Sunday)
      const holidayNames = todaysHolidays.map((h) => h.holidayName).join(' & ');
      const desc = todaysHolidays[0]?.description;
      slides.push({
        id: 'holiday-sunday-combined',
        node: (
          <Card
            style={[styles.holidaySundayCombinedCard, { marginBottom: 0 }]}
            onPress={() => setHighlightsModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.birthdayRow}>
              <View style={styles.holidaySundayAvatarWrapper}>
                <Ionicons name="sparkles" size={22} color="#B45309" />
                <View style={styles.holidayBadgeMini}>
                  <Text style={{ fontSize: 9 }}>🪔</Text>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <View style={styles.highlightHeaderRow}>
                  <Text style={styles.holidaySundayTitle} numberOfLines={1}>
                    Today: {holidayNames} (Sunday Holiday)! 🪔🏖️
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color="#B45309" />
                </View>
                <Text style={styles.holidaySundaySub} numberOfLines={2}>
                  {desc ? `${desc} • ` : ''}Double celebration! Festival holiday & Sunday weekly off. (Field duties today earn 1 Comp-Off credit)
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    } else if (isSundayToday) {
      // Sunday Weekly Holiday ONLY (No festival holiday today)
      slides.push({
        id: 'sunday-weekly-holiday',
        node: (
          <Card
            style={[styles.sundayHighlightCard, { marginBottom: 0 }]}
            onPress={() => navigation.navigate('EmployeeCalendar')}
            activeOpacity={0.8}
          >
            <View style={styles.birthdayRow}>
              <View style={styles.sundayAvatarWrapper}>
                <Ionicons name="sunny" size={24} color="#D97706" />
                <View style={styles.sundayBadgeMini}>
                  <Text style={{ fontSize: 9 }}>🏖️</Text>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <View style={styles.highlightHeaderRow}>
                  <Text style={styles.sundayHighlightTitle}>Today is Sunday (Weekly Holiday)! 🏖️</Text>
                  <Ionicons name="chevron-forward" size={14} color="#D97706" />
                </View>
                <Text style={styles.sundayHighlightSub} numberOfLines={2}>
                  Weekly off for all staff. Regular working days: Mon-Sat. (Field duties on Sunday earn 1 Comp-Off credit)
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    } else if (todaysHolidays.length > 0) {
      // Company Festival Holiday on regular weekday (Mon - Sat)
      slides.push({
        id: 'holiday-today',
        node: (
          <Card
            style={[styles.holidayHighlightCard, { marginBottom: 0 }]}
            onPress={() => setHighlightsModalVisible(true)}
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

    if (isMyBirthday) {
      slides.push({
        id: 'birthday-me',
        node: (
          <Card style={[styles.personalBirthdayCard, { marginBottom: 0 }]}>
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
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <Text style={styles.personalBirthdayTitle}>Happy Birthday, {user?.employeeName}! 🎂</Text>
                <Text style={styles.personalBirthdaySub} numberOfLines={2}>
                  Wishing you a joyful celebration and another great year of success!
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    } else if (todayBirthdays.length > 0) {
      slides.push({
        id: 'birthday-team',
        node: (
          <Card style={[styles.teamBirthdayCard, { marginBottom: 0 }]}>
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
                <Text style={styles.teamBirthdayTitle}>Today's Team Birthday! 🎂</Text>
                <Text style={styles.teamBirthdaySub} numberOfLines={2}>
                  {todayBirthdays.map((b) => `${b.employeeName} (${b.designation || 'Employee'})`).join(', ')}
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
            onPress={() => navigation.navigate('LeavesTab')}
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
                      return `${emp.employeeName || 'Employee'} (${emp.designation || 'Employee'})`;
                    })
                    .join(', ')}
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    }

    // 4. This Month's Holidays in Highlights Carousel
    const todayStr = getTodayDateString();
    const remainingThisMonthHolidays = (thisMonthHolidays || []).filter((h) => {
      const endStr = h.endDate ? h.endDate.split('T')[0] : (h.startDate ? h.startDate.split('T')[0] : '');
      const startStr = h.startDate ? h.startDate.split('T')[0] : '';
      // If it is active today, we already displayed the today's holiday card above
      if (startStr <= todayStr && endStr >= todayStr) return false;
      return endStr >= todayStr;
    });

    if (remainingThisMonthHolidays.length > 0) {
      remainingThisMonthHolidays.slice(0, 2).forEach((mh) => {
        const isSunCoincide = mh.startDate ? new Date(mh.startDate).getDay() === 0 : false;
        slides.push({
          id: `this-month-holiday-${mh._id}`,
          node: (
            <Card
              style={[styles.thisMonthHolidayHighlightCard, { marginBottom: 0 }]}
              onPress={() => setHighlightsModalVisible(true)}
              activeOpacity={0.8}
            >
              <View style={styles.birthdayRow}>
                <View style={styles.thisMonthHolidayIconWrap}>
                  <Ionicons name={isSunCoincide ? 'sunny' : 'calendar'} size={20} color="#047857" />
                  <View style={styles.holidayBadgeMini}>
                    <Text style={{ fontSize: 9 }}>{isSunCoincide ? '🏖️' : '🎉'}</Text>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                  <View style={styles.highlightHeaderRow}>
                    <Text style={styles.thisMonthHolidayHighlightTitle} numberOfLines={1}>
                      Holiday This Month: {mh.holidayName} 🎉
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color="#047857" />
                  </View>
                  <Text style={styles.thisMonthHolidayHighlightText} numberOfLines={2}>
                    {formatDate(mh.startDate)}{mh.startDate !== mh.endDate ? ` - ${formatDate(mh.endDate)}` : ''} • {isSunCoincide ? 'Falls on Sunday (Weekly Off & Holiday)' : (mh.description || 'Official Company Holiday')}
                  </Text>
                </View>
              </View>
            </Card>
          ),
        });
      });
    } else if (todaysHolidays.length === 0 && holidays.length > 0) {
      const nextH = holidays[0];
      const isSunNext = nextH.startDate ? new Date(nextH.startDate).getDay() === 0 : false;
      slides.push({
        id: 'holiday-upcoming',
        node: (
          <Card
            style={[styles.holidayHighlightCard, { marginBottom: 0 }]}
            onPress={() => setHighlightsModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.birthdayRow}>
              <View style={styles.holidayIconWrap}>
                <Ionicons name="calendar" size={20} color="#15803D" />
                <View style={styles.holidayBadgeMini}>
                  <Text style={{ fontSize: 9 }}>📅</Text>
                </View>
              </View>
              <View style={{ flex: 1, marginLeft: SPACING.md, justifyContent: 'center' }}>
                <View style={styles.highlightHeaderRow}>
                  <Text style={styles.holidayHighlightTitle}>Upcoming Holiday 🎉</Text>
                  <Ionicons name="chevron-forward" size={14} color="#15803D" />
                </View>
                <Text style={styles.holidayHighlightText} numberOfLines={2}>
                  {nextH.holidayName} • {formatDate(nextH.startDate)}
                  {isSunNext ? ' (Falls on Sunday)' : ''}
                  {nextH.description ? ` (${nextH.description})` : ''}
                </Text>
              </View>
            </View>
          </Card>
        ),
      });
    }

    return slides;
  }, [isMyBirthday, todayBirthdays, todaysLeaves, todaysHolidays, thisMonthHolidays, holidays, user, isSundayToday]);

  // Smooth animated auto-scroll for highlight slides (Birthday, Holiday, Leaves)
  useEffect(() => {
    if (highlightSlides.length <= 1) return;

    const interval = setInterval(() => {
      const currentIdx = activeHighlightIndexRef.current;
      const nextIdx = (currentIdx + 1) % highlightSlides.length;
      activeHighlightIndexRef.current = nextIdx;
      setActiveHighlightIndex(nextIdx);
      carouselRef.current?.scrollTo({
        x: nextIdx * SLIDE_WIDTH,
        animated: true,
      });
    }, 3000);

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
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.employeeName || 'Technician'}</Text>
            <Text style={styles.designationText}>
              ID: {user?.employeeId} • {user?.designation || 'Service Engineer'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.uploadBadgeBtn}
              onPress={() => navigation.navigate('SharedDocuments')}
              activeOpacity={0.7}
              accessibilityLabel="Shared Documents & Upload"
            >
              <Ionicons name="cloud-upload-outline" size={24} color={COLORS.text} />
              {Boolean(unreadDocumentCount > 0) ? (
                <View style={styles.unreadDocBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadDocumentCount > 9 ? '9+' : unreadDocumentCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.messageBadgeBtn}
              onPress={() => setMessagesModalVisible(true)}
              activeOpacity={0.7}
              accessibilityLabel="View messages from management"
            >
              <Ionicons name="chatbubbles-outline" size={24} color={COLORS.text} />
              {Boolean(unreadMessageCount > 0) ? (
                <View style={styles.unreadMsgBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.notificationBadgeBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={26} color={COLORS.text} />
              {Boolean(unreadCount > 0) ? (
                <View style={styles.unreadDotBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
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

        {/* Zoho People Style Check-In / Check-Out Widget */}
        <View style={styles.zohoWidgetCard}>
          <View style={styles.zohoWidgetTopRow}>
            {/* 3 Digital Clock Digit Boxes: [ HH ] : [ MM ] : [ SS ] */}
            <View style={styles.zohoDigitsRow}>
              <View
                style={[
                  styles.zohoDigitBox,
                  activeDuty ? styles.zohoDigitBoxActive : styles.zohoDigitBoxInactive,
                ]}
              >
                <Text
                  style={[
                    styles.zohoDigitText,
                    activeDuty ? styles.zohoDigitTextActive : styles.zohoDigitTextInactive,
                  ]}
                >
                  {timerDigits.hours}
                </Text>
              </View>
              <Text style={styles.zohoColon}>:</Text>
              <View
                style={[
                  styles.zohoDigitBox,
                  activeDuty ? styles.zohoDigitBoxActive : styles.zohoDigitBoxInactive,
                ]}
              >
                <Text
                  style={[
                    styles.zohoDigitText,
                    activeDuty ? styles.zohoDigitTextActive : styles.zohoDigitTextInactive,
                  ]}
                >
                  {timerDigits.minutes}
                </Text>
              </View>
              <Text style={styles.zohoColon}>:</Text>
              <View
                style={[
                  styles.zohoDigitBox,
                  activeDuty ? styles.zohoDigitBoxActive : styles.zohoDigitBoxInactive,
                ]}
              >
                <Text
                  style={[
                    styles.zohoDigitText,
                    activeDuty ? styles.zohoDigitTextActive : styles.zohoDigitTextInactive,
                  ]}
                >
                  {timerDigits.seconds}
                </Text>
              </View>
            </View>

            {/* Action Button: Check-out (Red) if active duty, Check-in (Green) if not */}
            <TouchableOpacity
              style={[
                styles.zohoActionBtn,
                activeDuty ? styles.zohoCheckoutBtn : styles.zohoCheckinBtn,
              ]}
              onPress={() => navigation.navigate('DutyForm')}
              activeOpacity={0.85}
              accessibilityLabel={activeDuty ? 'Check-out of duty' : 'Check-in to duty'}
            >
              <Text style={styles.zohoActionBtnText}>
                {activeDuty ? 'Check-out' : 'Check-in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Subtitle Row */}
          <View style={styles.zohoStatusRow}>
            <Text
              style={[
                styles.zohoStatusLabel,
                { color: activeDuty ? '#059669' : lastCompletedDuty ? '#0284C7' : '#64748B' },
              ]}
            >
              {activeDuty ? 'In' : 'Out'}
            </Text>
            <Text style={styles.zohoStatusDetail} numberOfLines={1}>
              {activeDuty
                ? `at ${formatTime(activeDuty.checkInTime || activeDuty.inTime)} • ${
                    activeDuty.dutyType === 'office'
                      ? 'Office Duty'
                      : activeDuty.company?.companyName || 'Client Site'
                  }`
                : lastCompletedDuty
                ? `Checked Out (${timerDigits.hours}h ${timerDigits.minutes}m total) • Tap Check-in for next duty`
                : '• Tap Check-in to start today’s duty'}
            </Text>
          </View>
        </View>

        {/* Sliding Highlight Banners (Birthday, On-Leave, Holiday) */}
        {Boolean(highlightSlides.length === 1) ? (
          <View style={{ marginBottom: SPACING.md, paddingHorizontal: 4 }}>
            {highlightSlides[0].node}
          </View>
        ) : null}

        {Boolean(highlightSlides.length > 1) ? (
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
              onMomentumScrollEnd={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const idx = Math.round(offsetX / SLIDE_WIDTH);
                if (idx >= 0 && idx < highlightSlides.length) {
                  activeHighlightIndexRef.current = idx;
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
        ) : null}

        {loading && !refreshing ? (
          <LoadingIndicator message="Loading your dashboard..." />
        ) : (
          <>
            {/* Quick Actions */}
            <View style={styles.quickActionsRow}>
              {/* 1. Highlights (First) */}
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

              {/* 2. Messages (Second, Right) */}
              <TouchableOpacity
                style={[styles.quickActionBtn, styles.messageQuickAction]}
                onPress={() => setMessagesModalVisible(true)}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="chatbubble-ellipses" size={24} color="#0284C7" />
                  {Boolean(unreadMessageCount > 0) ? (
                    <View style={styles.quickActionBadge}>
                      <Text style={styles.quickActionBadgeText}>
                        {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.quickActionTitle}>Messages</Text>
                <Text
                  style={[
                    styles.quickActionSub,
                    Boolean(unreadMessageCount > 0) && { color: '#0284C7', fontWeight: '700' },
                  ]}
                >
                  {unreadMessageCount > 0
                    ? `${unreadMessageCount} new`
                    : 'From Admin'}
                </Text>
              </TouchableOpacity>

              {/* 3. Expenses (Third, replacing Highlights slot) */}
              <TouchableOpacity
                style={[styles.quickActionBtn, styles.expenseQuickAction]}
                onPress={() => navigation.navigate('MyExpenses')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#EEF2FF' }]}>
                  <Ionicons name="wallet" size={24} color="#4F46E5" />
                </View>
                <Text style={styles.quickActionTitle}>Expenses</Text>
                <Text style={styles.quickActionSub}>Claims & travel</Text>
              </TouchableOpacity>

              {/* 4. Leave (Fourth, Right) */}
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

            {/* Shared Documents & Upload Banner */}
            <TouchableOpacity
              style={styles.sharedDocsBanner}
              onPress={() => navigation.navigate('SharedDocuments')}
              activeOpacity={0.8}
            >
              <View style={styles.sharedDocsLeft}>
                <View style={styles.sharedDocsIconWrap}>
                  <Ionicons name="folder-open" size={22} color="#FFFFFF" />
                  {Boolean(unreadDocumentCount > 0) && (
                    <View style={styles.bannerBadgeDot}>
                      <Text style={styles.bannerBadgeText}>{unreadDocumentCount}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.sharedDocsTextWrap}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.sharedDocsTitle}>Shared Documents & Upload</Text>
                    {Boolean(unreadDocumentCount > 0) && (
                      <View style={styles.newFilesChip}>
                        <Text style={styles.newFilesChipText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sharedDocsSub}>
                    Access manuals, blueprints & team files
                  </Text>
                </View>
              </View>
              <View style={styles.sharedDocsBtnPill}>
                <Ionicons name="cloud-upload" size={13} color="#FFFFFF" />
                <Text style={styles.sharedDocsBtnText}>Upload</Text>
              </View>
            </TouchableOpacity>

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

              {/* CURRENT MONTH SUMMARY SECTION */}
              <View style={styles.monthSummarySection}>
                <View style={styles.monthSummaryDivider} />
                <View style={styles.monthSummaryHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="stats-chart" size={14} color={COLORS.primary} />
                    <Text style={styles.monthSummaryTitle}>
                      {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })} Summary
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.7}
                    style={styles.fullCalActionBtn}
                  >
                    <Text style={styles.fullCalActionText}>Full Calendar</Text>
                    <Ionicons name="chevron-forward" size={11} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* KPI Metrics Grid: 6 Compact Summary Boxes */}
                <View style={styles.monthSummaryGrid}>
                  {/* 1. Days Worked */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#15803D' }]}>
                      {monthSummary?.daysWorked ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Days Worked</Text>
                  </TouchableOpacity>

                  {/* 2. Scheduled Working Days */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#334155' }]}>
                      {monthSummary?.totalScheduledWorkingDays ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Scheduled</Text>
                  </TouchableOpacity>

                  {/* 3. Casual Leave (CL) Taken */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#DC2626' }]}>
                      {monthSummary?.casualLeaveTaken ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>CL Taken</Text>
                  </TouchableOpacity>

                  {/* 4. Comp-Off Taken */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#2563EB' }]}>
                      {monthSummary?.compOffLeaveTaken ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Comp-Off</Text>
                  </TouchableOpacity>

                  {/* 5. Sunday Work */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#EA580C' }]}>
                      {monthSummary?.sundayWorkDays ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Sunday Work</Text>
                  </TouchableOpacity>

                  {/* 6. Holidays */}
                  <TouchableOpacity
                    style={[styles.kpiBox, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}
                    onPress={() => navigation.navigate('EmployeeCalendar')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.kpiValue, { color: '#CA8A04' }]}>
                      {monthSummary?.totalHolidays ?? 0}
                    </Text>
                    <Text style={styles.kpiLabel}>Holidays</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.calendarPromptRow}
                onPress={() => navigation.navigate('EmployeeCalendar')}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                <Text style={styles.calendarPromptText}>
                  Open Full Monthly Attendance Calendar & Comp-Off Details
                </Text>
                <Ionicons name="arrow-forward" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            </Card>


            {/* Today's Work Visits */}
            <View style={[styles.sectionHeaderRow, { marginTop: SPACING.md }]}>
              <Text style={styles.sectionHeaderTitle}>Today's Work Visits</Text>
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
                <Text style={styles.emptyCardTitle}>No works logged today</Text>
                <Text style={styles.emptyCardSub}>
                  Completed a visit? Tap 'Submit Work' above to log your work.
                </Text>
              </Card>
            ) : (
              todayDuties.map((duty) => {
                const companyLocation = duty.company?.location || duty.location?.address;
                return (
                  <Card
                    key={duty._id}
                    style={styles.dutyCard}
                    onPress={() => navigation.navigate('DutyDetails', { dutyId: duty._id })}
                  >
                    <View style={styles.dutyTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerText}>{duty.customerName}</Text>
                        <Text style={styles.dutyIdBadgeText}>
                          {duty.dutyId || `WORK-${duty._id.slice(-4).toUpperCase()}`}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.machineText}>
                      {duty.company?.companyName}
                      {companyLocation ? ` (${companyLocation})` : ''} • {duty.machineName}
                    </Text>
                    <Text style={styles.timeText}>
                      <Ionicons name="time-outline" size={13} color={COLORS.textMuted} />{' '}
                      {formatTime(duty.inTime)} - {formatTime(duty.outTime)} ({formatWorkType(duty)})
                    </Text>
                  </Card>
                );
              })
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
            {/* Branding Footer */}
            <BrandingFooter style={styles.brandingFooter} />
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
              {/* SECTION 1: THIS MONTH'S BIRTHDAYS (FIRST) */}
              <View style={styles.highlightSectionHeader}>
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

              {/* SECTION 2: THIS MONTH'S HOLIDAYS (BOTTOM) */}
              <View style={[styles.highlightSectionHeader, { marginTop: SPACING.lg }]}>
                <Ionicons name="calendar" size={16} color={COLORS.primary} />
                <Text style={styles.highlightSectionTitle}>This Month's Holidays</Text>
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
                thisMonthHolidays.map((h) => {
                  const isSunHoliday = h.startDate ? new Date(h.startDate).getDay() === 0 : false;
                  return (
                    <Card
                      key={h._id}
                      style={[
                        styles.highlightHolidayCard,
                        isSunHoliday && styles.highlightSundayHolidayCard,
                      ]}
                    >
                      <View style={styles.highlightHolidayRow}>
                        <View
                          style={[
                            styles.highlightHolidayIcon,
                            isSunHoliday && { backgroundColor: '#FEF3C7' },
                          ]}
                        >
                          <Ionicons
                            name={isSunHoliday ? 'sunny' : 'calendar-outline'}
                            size={20}
                            color={isSunHoliday ? '#D97706' : COLORS.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 4,
                            }}
                          >
                            <Text style={styles.highlightHolidayName}>{h.holidayName}</Text>
                            {isSunHoliday && (
                              <View style={styles.sundayHolidayPill}>
                                <Text style={styles.sundayHolidayPillText}>Sunday Holiday 🏖️</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.highlightHolidayDates}>
                            {formatDate(h.startDate)}{' '}
                            {h.startDate !== h.endDate && `to ${formatDate(h.endDate)}`}
                            {isSunHoliday ? ' • (Falls on Sunday - Weekly Off & Holiday)' : ''}
                          </Text>
                          {h.description ? (
                            <Text style={styles.highlightHolidayDesc}>{h.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  );
                })
              )}

              {/* SECTION 3: SUNDAYS - WEEKLY HOLIDAYS */}
              <View style={[styles.highlightSectionHeader, { marginTop: SPACING.lg }]}>
                <Ionicons name="sunny" size={16} color="#D97706" />
                <Text style={styles.highlightSectionTitle}>Weekly Holidays (Sundays) 🏖️</Text>
                <View style={[styles.monthPillBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.monthPillText, { color: '#B45309' }]}>Weekly Off</Text>
                </View>
              </View>

              <Card style={[styles.highlightHolidayCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <View style={styles.highlightHolidayRow}>
                  <View style={[styles.highlightHolidayIcon, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="sunny-outline" size={20} color="#D97706" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.highlightHolidayName, { color: '#92400E' }]}>
                      Sunday Weekly Holidays
                    </Text>
                    <Text style={[styles.highlightHolidayDates, { color: '#B45309' }]}>
                      Every Sunday is a paid weekly holiday for all technicians. If you work on Sunday, 1 Comp-Off credit will automatically be credited to your balance upon checkout!
                    </Text>
                  </View>
                </View>
              </Card>

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

      {/* Employee Messages Modal */}
      <EmployeeMessagesModal
        visible={messagesModalVisible}
        onClose={() => {
          setMessagesModalVisible(false);
          refreshNotifications();
        }}
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
  messageBadgeBtn: {
    position: 'relative',
    padding: SPACING.xs,
    marginRight: 2,
  },
  unreadMsgBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#0284C7',
    borderRadius: RADIUS.full,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.background,
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
  zohoWidgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  zohoWidgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  zohoDigitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zohoDigitBox: {
    minWidth: 46,
    height: 50,
    paddingHorizontal: 8,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zohoDigitBoxActive: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
  },
  zohoDigitBoxInactive: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zohoDigitText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  zohoDigitTextActive: {
    color: '#0F172A',
  },
  zohoDigitTextInactive: {
    color: '#334155',
  },
  zohoColon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#94A3B8',
    marginHorizontal: 3,
  },
  zohoActionBtn: {
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  zohoCheckoutBtn: {
    backgroundColor: '#E11D48',
  },
  zohoCheckinBtn: {
    backgroundColor: '#059669',
  },
  zohoActionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  zohoStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  zohoStatusLabel: {
    fontSize: 15,
    fontWeight: '800',
    marginRight: 6,
  },
  zohoStatusDetail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
    fontWeight: '500',
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  quickActionBtn: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dutyQuickAction: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  expenseQuickAction: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  messageQuickAction: {
    borderLeftWidth: 4,
    borderLeftColor: '#0284C7',
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
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0284C7',
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  quickActionBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
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
  calendarPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
    paddingTop: 8,
  },
  calendarPromptText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  monthSummarySection: {
    marginTop: 8,
  },
  monthSummaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  monthSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthSummaryTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  fullCalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  fullCalActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  monthSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  kpiBox: {
    flexBasis: '31.5%',
    flexGrow: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
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
  personalBirthdayCard: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FACC15',
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
  },
  teamBirthdayCard: {
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
  leaveAvatarLetters: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
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
  sundayHighlightCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  sundayAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sundayBadgeMini: {
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
  sundayHighlightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#92400E',
  },
  sundayHighlightSub: {
    fontSize: 12.5,
    color: '#B45309',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 16,
  },
  holidaySundayCombinedCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  holidaySundayAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  holidaySundayTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#92400E',
  },
  holidaySundaySub: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 16,
  },
  thisMonthHolidayHighlightCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1.5,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    minHeight: 94,
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  thisMonthHolidayIconWrap: {
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
  thisMonthHolidayHighlightTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#15803D',
  },
  thisMonthHolidayHighlightText: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 16,
  },
  highlightSundayHolidayCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  sundayHolidayPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  sundayHolidayPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
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
  carouselContainer: {
    marginBottom: SPACING.md,
  },
  carouselDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  carouselDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#CBD5E1',
  },
  carouselDotActive: {
    width: 20,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primary,
  },
  uploadBadgeBtn: {
    padding: SPACING.xs,
    position: 'relative',
    marginRight: 2,
  },
  unreadDocBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#059669',
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.card,
  },
  sharedDocsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sharedDocsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  sharedDocsIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    position: 'relative',
  },
  bannerBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#059669',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  bannerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sharedDocsTextWrap: {
    flex: 1,
  },
  sharedDocsTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newFilesChip: {
    backgroundColor: '#059669',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  newFilesChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  sharedDocsSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  sharedDocsBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    gap: 4,
  },
  sharedDocsBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  brandingFooter: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
});

export default EmployeeDashboardScreen;
