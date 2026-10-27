import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import calendarApi from '../api/calendarApi';
import Card from './Card';
import StatusBadge from './StatusBadge';
import LoadingIndicator from './LoadingIndicator';
import ErrorMessage from './ErrorMessage';
import { formatDate, formatISODateOnly } from '../utils/dateUtils';
import { extractErrorMessage } from '../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// User-specified exact color coding palette
export const CALENDAR_COLORS = {
  present: '#059669',       // Green: Present / Worked
  sundayWork: '#EA580C',    // Orange: Sunday Work / Comp-Off Earned
  approvedCL: '#DC2626',    // Red: Approved Casual Leave
  compOffLeave: '#2563EB',  // Blue: Comp-Off Leave
  pendingLeave: '#9333EA',  // Purple: Pending Leave Request
  holiday: '#EAB308',       // Yellow: Sunday / Weekly Holiday
  futureNoRecord: '#94A3B8',// Grey: Future Date or No Attendance Record
};

// Modern pastel soft tints matching each calendar status for premium mobile look
const STATUS_STYLES = {
  present: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    accent: '#059669',
    badgeText: 'Present',
    icon: 'checkmark-circle',
  },
  sundayWork: {
    bg: '#FFF7ED',
    border: '#FED7AA',
    accent: '#EA580C',
    badgeText: 'Sunday Work',
    icon: 'star',
  },
  approvedCL: {
    bg: '#FEF2F2',
    border: '#FECACA',
    accent: '#DC2626',
    badgeText: 'Casual Leave',
    icon: 'time',
  },
  compOffLeave: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    accent: '#2563EB',
    badgeText: 'Comp-Off',
    icon: 'gift',
  },
  pendingLeave: {
    bg: '#FAF5FF',
    border: '#E9D5FF',
    accent: '#9333EA',
    badgeText: 'Pending',
    icon: 'hourglass',
  },
  holiday: {
    bg: '#FEFCE8',
    border: '#FEF08A',
    accent: '#CA8A04',
    badgeText: 'Holiday',
    icon: 'sunny',
  },
  future: {
    bg: '#F8FAFC',
    border: '#F1F5F9',
    accent: '#94A3B8',
    badgeText: 'Upcoming',
    icon: 'calendar-outline',
  },
  default: {
    bg: '#FFFFFF',
    border: '#E2E8F0',
    accent: '#94A3B8',
    badgeText: 'No Record',
    icon: 'ellipse-outline',
  },
};

const LEGEND_ITEMS = [
  { color: CALENDAR_COLORS.present, bg: '#ECFDF5', label: 'Present / Worked', icon: 'checkmark-circle' },
  { color: CALENDAR_COLORS.sundayWork, bg: '#FFF7ED', label: 'Sunday Work / Comp-Off', icon: 'star' },
  { color: CALENDAR_COLORS.approvedCL, bg: '#FEF2F2', label: 'Approved Leave (CL)', icon: 'time' },
  { color: CALENDAR_COLORS.compOffLeave, bg: '#EFF6FF', label: 'Comp-Off Leave', icon: 'gift' },
  { color: CALENDAR_COLORS.pendingLeave, bg: '#FAF5FF', label: 'Pending Leave Request', icon: 'hourglass' },
  { color: CALENDAR_COLORS.holiday, bg: '#FEFCE8', label: 'Sunday / Holiday', icon: 'sunny' },
  { color: CALENDAR_COLORS.futureNoRecord, bg: '#F8FAFC', label: 'Future / No Record', icon: 'calendar-outline' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MonthlyCalendarView = ({
  employeeId,
  employeeName,
  isAdminView = false,
  onChangeEmployee,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected date details modal
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Summary box interactive date list modal
  const [activeSummaryCat, setActiveSummaryCat] = useState(null);
  const [summaryListModalVisible, setSummaryListModalVisible] = useState(false);

  const todayStr = useMemo(() => formatISODateOnly(), []);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const params = {
        year: selectedYear,
        month: selectedMonth,
      };
      if (employeeId) {
        params.employeeId = employeeId;
      }

      const res = await calendarApi.getMonthlyCalendar(params);
      if (res.data) {
        setCalendarData(res.data);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load calendar data'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const today = new Date();
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  // Determine starting weekday of the month (0 = Sun, 1 = Mon...)
  const firstDayOfWeek = useMemo(() => {
    const firstDate = new Date(selectedYear, selectedMonth - 1, 1);
    return firstDate.getDay();
  }, [selectedYear, selectedMonth]);

  const summary = calendarData?.summary;
  const days = calendarData?.days || [];
  const currentTargetName = calendarData?.employee?.employeeName || employeeName || 'Employee';

  // Helper to open the interactive date list modal for a clicked summary KPI card
  const handleOpenSummaryCategory = (categoryKey, title, icon, color, count) => {
    let matchedDays = [];

    switch (categoryKey) {
      case 'workingDays':
        matchedDays = days.filter((d) => d.isScheduledWorkingDay);
        break;
      case 'daysWorked':
        matchedDays = days.filter((d) => d.hasWorked);
        break;
      case 'holidays':
        matchedDays = days.filter((d) => d.isSunday || d.isHoliday);
        break;
      case 'casualLeave':
        matchedDays = days.filter(
          (d) => d.leave?.status === 'approved' && d.leave?.leaveType !== 'comp_off'
        );
        break;
      case 'compOffUsed':
        matchedDays = days.filter(
          (d) => d.leave?.status === 'approved' && d.leave?.leaveType === 'comp_off'
        );
        break;
      case 'sundayWorks':
        matchedDays = days.filter((d) => d.isSundayWork);
        break;
      case 'compOffEarned':
        matchedDays = days.filter((d) => d.compOffEarned || d.isSundayWork);
        break;
      default:
        matchedDays = [];
    }

    setActiveSummaryCat({
      key: categoryKey,
      title,
      icon,
      color,
      count: count ?? matchedDays.length,
      days: matchedDays,
    });
    setSummaryListModalVisible(true);
  };

  // Helper resolving modern day styling
  const getDayTheme = (dayItem) => {
    if (dayItem.isSundayWork) return STATUS_STYLES.sundayWork;
    if (dayItem.hasWorked) return STATUS_STYLES.present;
    if (dayItem.leave?.status === 'approved') {
      return dayItem.leave?.leaveType === 'comp_off'
        ? STATUS_STYLES.compOffLeave
        : STATUS_STYLES.approvedCL;
    }
    if (dayItem.leave?.status === 'pending') return STATUS_STYLES.pendingLeave;
    if (dayItem.isSunday || dayItem.isHoliday) return STATUS_STYLES.holiday;
    if (dayItem.isFuture) return STATUS_STYLES.future;
    return STATUS_STYLES.default;
  };

  return (
    <View style={styles.container}>
      {/* Month & Year Navigation Header */}
      <Card style={styles.navCard}>
        <View style={styles.navHeaderRow}>
          <TouchableOpacity
            style={styles.navArrowBtn}
            onPress={handlePrevMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={styles.navTitleWrap}>
            <Text style={styles.navMonthYearText}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Text>
            {isAdminView ? (
              <TouchableOpacity
                onPress={onChangeEmployee}
                style={styles.employeeSwitcherBadge}
                activeOpacity={0.8}
              >
                <Ionicons name="person" size={12} color={COLORS.primary} />
                <Text style={styles.employeeSwitcherText} numberOfLines={1}>
                  {currentTargetName}
                </Text>
                <Ionicons name="swap-horizontal" size={12} color={COLORS.primary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.navArrowBtn}
            onPress={handleNextMonth}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.todayQuickBtn}
          onPress={handleGoToToday}
          activeOpacity={0.7}
        >
          <Ionicons name="today" size={13} color={COLORS.primary} />
          <Text style={styles.todayQuickBtnText}>Jump to Current Month</Text>
        </TouchableOpacity>
      </Card>

      <ErrorMessage message={error} onRetry={fetchCalendar} />

      {loading ? (
        <View style={{ paddingVertical: SPACING.xl }}>
          <LoadingIndicator message="Calculating monthly calendar & attendance..." />
        </View>
      ) : (
        <>
          {/* Monthly Summary Cards (7 required KPI metrics - Interactive tap to list dates) */}
          {summary ? (
            <View style={styles.summarySection}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.sectionHeading}>
                  {MONTH_NAMES[selectedMonth - 1]} Summary
                </Text>
                <Text style={styles.summaryTapHint}>Tap any card to view dates</Text>
              </View>

              <View style={styles.summaryGrid}>
                {/* Row 1: Core Attendance (3 items: Working Days, Days Worked, Holidays) */}
                <View style={styles.summaryRow}>
                  {/* 1. Scheduled Working Days */}
                  <TouchableOpacity
                    style={[styles.kpiCardThird, { borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'workingDays',
                        'Scheduled Working Days',
                        'calendar-outline',
                        '#475569',
                        summary.totalScheduledWorkingDays
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <Ionicons name="calendar-outline" size={16} color="#475569" />
                      <View style={styles.tapPill}>
                        <Ionicons name="list" size={9} color="#475569" />
                      </View>
                    </View>
                    <Text style={styles.kpiNumberThird}>{summary.totalScheduledWorkingDays}</Text>
                    <Text style={styles.kpiLabelThird} numberOfLines={1}>Working Days</Text>
                    <Text style={styles.kpiViewTextThird}>Tap dates ›</Text>
                  </TouchableOpacity>

                  {/* 2. Days Worked */}
                  <TouchableOpacity
                    style={[styles.kpiCardThird, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'daysWorked',
                        'Days Worked / Present',
                        'checkmark-circle',
                        '#059669',
                        summary.daysWorked
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      <View style={[styles.tapPill, { backgroundColor: '#DCFCE7' }]}>
                        <Ionicons name="list" size={9} color="#059669" />
                      </View>
                    </View>
                    <Text style={[styles.kpiNumberThird, { color: '#059669' }]}>{summary.daysWorked}</Text>
                    <Text style={styles.kpiLabelThird} numberOfLines={1}>Days Worked</Text>
                    <Text style={[styles.kpiViewTextThird, { color: '#059669' }]}>Tap dates ›</Text>
                  </TouchableOpacity>

                  {/* 3. Total Holidays */}
                  <TouchableOpacity
                    style={[styles.kpiCardThird, { borderColor: '#FDE047', backgroundColor: '#FEFCE8' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'holidays',
                        'Holidays (Sundays & Public)',
                        'sunny',
                        '#CA8A04',
                        summary.totalHolidays
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <Ionicons name="sunny" size={16} color="#CA8A04" />
                      <View style={[styles.tapPill, { backgroundColor: '#FEF9C3' }]}>
                        <Ionicons name="list" size={9} color="#CA8A04" />
                      </View>
                    </View>
                    <Text style={[styles.kpiNumberThird, { color: '#CA8A04' }]}>{summary.totalHolidays}</Text>
                    <Text style={styles.kpiLabelThird} numberOfLines={1}>Holidays</Text>
                    <Text style={[styles.kpiViewTextThird, { color: '#CA8A04' }]}>Tap dates ›</Text>
                  </TouchableOpacity>
                </View>

                {/* Row 2: Leaves (2 items: Casual Leave Taken, Comp-Off Used) */}
                <View style={styles.summaryRow}>
                  {/* 4. Casual Leave Taken */}
                  <TouchableOpacity
                    style={[styles.kpiCardHalf, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'casualLeave',
                        'Casual Leave Taken',
                        'time',
                        '#DC2626',
                        summary.casualLeaveTaken
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="time" size={15} color="#DC2626" />
                        <Text style={[styles.kpiLabelHalf, { color: '#991B1B' }]} numberOfLines={1}>Casual Leave</Text>
                      </View>
                      <View style={[styles.tapPill, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="list" size={9} color="#DC2626" />
                      </View>
                    </View>
                    <View style={styles.kpiHalfBottomRow}>
                      <Text style={[styles.kpiNumberHalf, { color: '#DC2626' }]}>{summary.casualLeaveTaken}</Text>
                      <Text style={[styles.kpiViewTextHalf, { color: '#DC2626' }]}>Tap dates ›</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 5. Comp-Off Leave Taken */}
                  <TouchableOpacity
                    style={[styles.kpiCardHalf, { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'compOffUsed',
                        'Comp-Off Leave Taken',
                        'gift',
                        '#2563EB',
                        summary.compOffLeaveTaken
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="gift" size={15} color="#2563EB" />
                        <Text style={[styles.kpiLabelHalf, { color: '#1E40AF' }]} numberOfLines={1}>Comp-Off Used</Text>
                      </View>
                      <View style={[styles.tapPill, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="list" size={9} color="#2563EB" />
                      </View>
                    </View>
                    <View style={styles.kpiHalfBottomRow}>
                      <Text style={[styles.kpiNumberHalf, { color: '#2563EB' }]}>{summary.compOffLeaveTaken}</Text>
                      <Text style={[styles.kpiViewTextHalf, { color: '#2563EB' }]}>Tap dates ›</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Row 3: Sunday Work & Credits (2 items: Sunday Works, Comp-Off Earned) */}
                <View style={styles.summaryRow}>
                  {/* 6. Sunday Work Days */}
                  <TouchableOpacity
                    style={[styles.kpiCardHalf, { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'sundayWorks',
                        'Sunday Work Days',
                        'briefcase',
                        '#EA580C',
                        summary.sundayWorkDays
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="briefcase" size={15} color="#EA580C" />
                        <Text style={[styles.kpiLabelHalf, { color: '#9A3412' }]} numberOfLines={1}>Sunday Works</Text>
                      </View>
                      <View style={[styles.tapPill, { backgroundColor: '#FFEDD5' }]}>
                        <Ionicons name="list" size={9} color="#EA580C" />
                      </View>
                    </View>
                    <View style={styles.kpiHalfBottomRow}>
                      <Text style={[styles.kpiNumberHalf, { color: '#EA580C' }]}>{summary.sundayWorkDays}</Text>
                      <Text style={[styles.kpiViewTextHalf, { color: '#EA580C' }]}>Tap dates ›</Text>
                    </View>
                  </TouchableOpacity>

                  {/* 7. Comp-Off Credits Earned */}
                  <TouchableOpacity
                    style={[styles.kpiCardHalf, { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}
                    onPress={() =>
                      handleOpenSummaryCategory(
                        'compOffEarned',
                        'Comp-Off Credits Earned',
                        'star',
                        '#7C3AED',
                        summary.compOffCreditsEarned
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.kpiTopRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Ionicons name="star" size={15} color="#7C3AED" />
                        <Text style={[styles.kpiLabelHalf, { color: '#5B21B6' }]} numberOfLines={1}>Credits Earned</Text>
                      </View>
                      <View style={[styles.tapPill, { backgroundColor: '#EDE9FE' }]}>
                        <Ionicons name="list" size={9} color="#7C3AED" />
                      </View>
                    </View>
                    <View style={styles.kpiHalfBottomRow}>
                      <Text style={[styles.kpiNumberHalf, { color: '#7C3AED' }]}>{summary.compOffCreditsEarned}</Text>
                      <Text style={[styles.kpiViewTextHalf, { color: '#7C3AED' }]}>Tap dates ›</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {/* Modern Polished Calendar Grid Card */}
          <Card style={styles.calendarCard}>
            {/* Weekday Header Row */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((dayName, idx) => {
                const isSun = idx === 0;
                return (
                  <View key={dayName} style={styles.weekdayCell}>
                    <Text
                      style={[
                        styles.weekdayText,
                        isSun && styles.weekdayTextSunday,
                      ]}
                    >
                      {dayName}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Days Grid */}
            <View style={styles.gridContainer}>
              {/* Empty leading slots for first week offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {/* Real calendar days with modern cards */}
              {days.map((dayItem) => {
                const isSelected = selectedDayDetail?.date === dayItem.date;
                const isToday = dayItem.date === todayStr;
                const isSunday = Boolean(dayItem.isSunday);
                const theme = getDayTheme(dayItem);

                return (
                  <View key={dayItem.date} style={styles.dayCellWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.dayCard,
                        {
                          backgroundColor: theme.bg,
                          borderColor: isSelected ? COLORS.primary : theme.border,
                        },
                        isSelected && styles.dayCardSelected,
                        isToday && styles.dayCardToday,
                      ]}
                      onPress={() => {
                        setSelectedDayDetail(dayItem);
                        setDetailModalVisible(true);
                      }}
                      activeOpacity={0.75}
                    >
                      {/* Top Day Number / Today Ring */}
                      <View style={styles.dayNumberContainer}>
                        {isToday ? (
                          <View style={styles.todayPill}>
                            <Text style={styles.todayPillText}>{dayItem.dayOfMonth}</Text>
                          </View>
                        ) : (
                          <Text
                            style={[
                              styles.dayNumberText,
                              isSunday && styles.dayNumberSunday,
                              dayItem.isFuture && styles.dayNumberFuture,
                            ]}
                          >
                            {dayItem.dayOfMonth}
                          </Text>
                        )}
                      </View>

                      {/* Status Accent Pill / Dots */}
                      <View style={styles.dayStatusPillWrap}>
                        <View
                          style={[
                            styles.dayStatusPill,
                            { backgroundColor: dayItem.statusColor || theme.accent },
                          ]}
                        />
                        {/* Secondary indicator for Sunday Work comp-off credit */}
                        {dayItem.isSundayWork ? (
                          <Ionicons name="star" size={8} color="#EA580C" style={{ marginLeft: 2 }} />
                        ) : null}
                      </View>

                      {/* Small subtle label for high-information density */}
                      {dayItem.hasWorked && !dayItem.isSundayWork ? (
                        <Text style={styles.dayMiniLabel} numberOfLines={1}>
                          Present
                        </Text>
                      ) : dayItem.leave?.status === 'approved' ? (
                        <Text
                          style={[
                            styles.dayMiniLabel,
                            { color: dayItem.leave.leaveType === 'comp_off' ? '#2563EB' : '#DC2626' },
                          ]}
                          numberOfLines={1}
                        >
                          {dayItem.leave.leaveType === 'comp_off' ? 'Comp' : 'Leave'}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Visible Modern Calendar Color Legend */}
          <Card style={styles.legendCard}>
            <View style={styles.legendHeaderRow}>
              <Ionicons name="color-palette-outline" size={16} color={COLORS.primary} />
              <Text style={styles.legendHeaderTitle}>Color Legend</Text>
            </View>
            <View style={styles.legendWrap}>
              {LEGEND_ITEMS.map((item) => (
                <View
                  key={item.label}
                  style={[styles.legendChip, { backgroundColor: item.bg, borderColor: `${item.color}40` }]}
                >
                  <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendLabelText, { color: COLORS.text }]}>
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      )}

      {/* Date Details Modal on Tap */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalDateTitle}>
                  {selectedDayDetail ? formatDate(selectedDayDetail.date) : 'Day Details'}
                </Text>
                <Text style={styles.modalDaySubtitle}>
                  {selectedDayDetail?.dayOfWeek} •{' '}
                  {selectedDayDetail?.isSunday
                    ? 'Weekly Holiday (Sunday)'
                    : selectedDayDetail?.isHoliday
                    ? selectedDayDetail?.holidayName || 'Official Holiday'
                    : 'Scheduled Working Day'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Scroll Content */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Status Badge Row */}
              <View style={styles.modalStatusRow}>
                <View
                  style={[
                    styles.modalStatusColorTag,
                    { backgroundColor: selectedDayDetail?.statusColor || '#94A3B8' },
                  ]}
                />
                <Text style={styles.modalStatusTagText}>
                  {selectedDayDetail?.statusLabel || 'No Record'}
                </Text>
              </View>

              {/* Sunday Work & Comp-Off Notice */}
              {selectedDayDetail?.isSundayWork || selectedDayDetail?.compOffEarned ? (
                <View style={styles.compOffNoticeBox}>
                  <Ionicons name="star" size={20} color="#EA580C" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compOffNoticeTitle}>
                      Sunday Attendance & Comp-Off Credit
                    </Text>
                    <Text style={styles.compOffNoticeSub}>
                      1 Comp-Off credit earned for completing valid check-in and checkout on Sunday.
                    </Text>
                  </View>
                </View>
              ) : null}

              {/* Attendance Details Card */}
              <View style={styles.detailSectionCard}>
                <View style={styles.detailSectionHeader}>
                  <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.detailSectionTitle}>Attendance & Work Record</Text>
                </View>

                {selectedDayDetail?.attendance ? (
                  <View style={styles.detailFieldsWrap}>
                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>Status:</Text>
                      <StatusBadge status={selectedDayDetail.attendance.status} />
                    </View>

                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>In / Check-in:</Text>
                      <Text style={styles.detailFieldValue}>
                        {selectedDayDetail.attendance.inTime || 'N/A'}
                      </Text>
                    </View>

                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>Out / Check-out:</Text>
                      <Text style={styles.detailFieldValue}>
                        {selectedDayDetail.attendance.outTime || 'N/A'}
                      </Text>
                    </View>

                    {selectedDayDetail.attendance.durationMinutes > 0 && (
                      <View style={styles.detailFieldRow}>
                        <Text style={styles.detailFieldLabel}>Recorded Duration:</Text>
                        <Text style={styles.detailFieldValue}>
                          {Math.floor(selectedDayDetail.attendance.durationMinutes / 60)}h{' '}
                          {selectedDayDetail.attendance.durationMinutes % 60}m
                        </Text>
                      </View>
                    )}

                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>Company / Site:</Text>
                      <Text style={styles.detailFieldValue} numberOfLines={1}>
                        {selectedDayDetail.attendance.companyName}
                      </Text>
                    </View>

                    {selectedDayDetail.attendance.clientName ? (
                      <View style={styles.detailFieldRow}>
                        <Text style={styles.detailFieldLabel}>Client Contact:</Text>
                        <Text style={styles.detailFieldValue} numberOfLines={1}>
                          {selectedDayDetail.attendance.clientName}
                        </Text>
                      </View>
                    ) : null}

                    {selectedDayDetail.attendance.machineName ? (
                      <View style={styles.detailFieldRow}>
                        <Text style={styles.detailFieldLabel}>Machine / System:</Text>
                        <Text style={styles.detailFieldValue}>
                          {selectedDayDetail.attendance.machineName}
                        </Text>
                      </View>
                    ) : null}

                    {selectedDayDetail.attendance.workDescription ? (
                      <View style={{ marginTop: 6 }}>
                        <Text style={styles.detailFieldLabel}>Work Description:</Text>
                        <Text style={styles.detailDescriptionText}>
                          {selectedDayDetail.attendance.workDescription}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text style={styles.noDataText}>
                    {selectedDayDetail?.isFuture
                      ? 'Future date — No attendance logged yet.'
                      : selectedDayDetail?.isSunday || selectedDayDetail?.isHoliday
                      ? 'Holiday — No duty recorded.'
                      : 'No duty or check-in recorded on this date.'}
                  </Text>
                )}
              </View>

              {/* Leave Details Card (if applicable) */}
              {selectedDayDetail?.leave ? (
                <View style={[styles.detailSectionCard, { marginTop: SPACING.md }]}>
                  <View style={styles.detailSectionHeader}>
                    <Ionicons name="calendar-outline" size={18} color="#DC2626" />
                    <Text style={[styles.detailSectionTitle, { color: '#DC2626' }]}>
                      Leave Information
                    </Text>
                  </View>

                  <View style={styles.detailFieldsWrap}>
                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>Leave Type:</Text>
                      <View
                        style={[
                          styles.leaveTypeTag,
                          selectedDayDetail.leave.leaveType === 'comp_off'
                            ? styles.leaveTypeCompOffTag
                            : styles.leaveTypeCLTag,
                        ]}
                      >
                        <Text
                          style={[
                            styles.leaveTypeTagText,
                            selectedDayDetail.leave.leaveType === 'comp_off'
                              ? { color: '#2563EB' }
                              : { color: '#DC2626' },
                          ]}
                        >
                          {selectedDayDetail.leave.leaveType === 'comp_off'
                            ? 'Comp-Off Leave'
                            : 'Casual Leave (CL)'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailFieldRow}>
                      <Text style={styles.detailFieldLabel}>Status:</Text>
                      <StatusBadge status={selectedDayDetail.leave.status} />
                    </View>

                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.detailFieldLabel}>Reason:</Text>
                      <Text style={styles.detailDescriptionText}>
                        "{selectedDayDetail.leave.reason}"
                      </Text>
                    </View>

                    {selectedDayDetail.leave.adminRemarks ? (
                      <View style={{ marginTop: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6 }}>
                        <Text style={[styles.detailFieldLabel, { color: '#991B1B' }]}>
                          Manager Remarks:
                        </Text>
                        <Text style={[styles.detailDescriptionText, { color: '#7F1D1D' }]}>
                          {selectedDayDetail.leave.adminRemarks}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDetailModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Summary Box Click-to-List Dates Modal */}
      <Modal
        visible={summaryListModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSummaryListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.summaryListModalContainer}>
            {/* Header */}
            <View style={styles.summaryListHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <View
                  style={[
                    styles.summaryListIconWrap,
                    { backgroundColor: `${activeSummaryCat?.color || COLORS.primary}18` },
                  ]}
                >
                  <Ionicons
                    name={activeSummaryCat?.icon || 'calendar'}
                    size={20}
                    color={activeSummaryCat?.color || COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryListTitle} numberOfLines={1}>
                    {activeSummaryCat?.title}
                  </Text>
                  <Text style={styles.summaryListSubtitle}>
                    {MONTH_NAMES[selectedMonth - 1]} {selectedYear} • {activeSummaryCat?.count || 0} Date(s)
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setSummaryListModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={26} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Sub-header instruction */}
            <View style={styles.summaryListHintRow}>
              <Ionicons name="finger-print-outline" size={13} color={COLORS.primary} />
              <Text style={styles.summaryListHintText}>
                Tap any date below to inspect full attendance & leave details
              </Text>
            </View>

            {/* List of matching dates */}
            <ScrollView style={styles.summaryListScroll} showsVerticalScrollIndicator={false}>
              {!activeSummaryCat?.days || activeSummaryCat.days.length === 0 ? (
                <View style={styles.summaryEmptyState}>
                  <Ionicons name="calendar-outline" size={44} color="#CBD5E1" />
                  <Text style={styles.summaryEmptyTitle}>No dates recorded</Text>
                  <Text style={styles.summaryEmptySub}>
                    There are no dates in {MONTH_NAMES[selectedMonth - 1]} {selectedYear} for this category.
                  </Text>
                </View>
              ) : (
                activeSummaryCat.days.map((dayItem) => {
                  const theme = getDayTheme(dayItem);
                  return (
                    <TouchableOpacity
                      key={dayItem.date}
                      style={[
                        styles.summaryDateItemCard,
                        { borderLeftColor: dayItem.statusColor || theme.accent },
                      ]}
                      onPress={() => {
                        setSummaryListModalVisible(false);
                        setSelectedDayDetail(dayItem);
                        setTimeout(() => setDetailModalVisible(true), 250);
                      }}
                      activeOpacity={0.7}
                    >
                      {/* Left Date Block */}
                      <View style={styles.summaryDateBadge}>
                        <Text style={styles.summaryDateDayText}>
                          {String(dayItem.dayOfMonth).padStart(2, '0')}
                        </Text>
                        <Text
                          style={[
                            styles.summaryDateWeekdayText,
                            dayItem.isSunday && { color: '#DC2626' },
                          ]}
                        >
                          {dayItem.dayOfWeek ? dayItem.dayOfWeek.slice(0, 3).toUpperCase() : ''}
                        </Text>
                      </View>

                      {/* Middle Details */}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <View
                            style={[
                              styles.summaryItemDot,
                              { backgroundColor: dayItem.statusColor || theme.accent },
                            ]}
                          />
                          <Text style={styles.summaryItemStatusTitle} numberOfLines={1}>
                            {dayItem.statusLabel || 'Scheduled Day'}
                          </Text>
                        </View>

                        {/* Extra Context snippets */}
                        {dayItem.hasWorked && dayItem.attendance ? (
                          <Text style={styles.summaryItemDetailSub} numberOfLines={1}>
                            In: {dayItem.attendance.inTime || 'N/A'} • Out: {dayItem.attendance.outTime || 'N/A'}{' '}
                            {dayItem.attendance.companyName ? `(${dayItem.attendance.companyName})` : ''}
                          </Text>
                        ) : dayItem.leave ? (
                          <Text style={styles.summaryItemDetailSub} numberOfLines={1}>
                            {dayItem.leave.leaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} •{' '}
                            {dayItem.leave.status?.toUpperCase()}: {dayItem.leave.reason || 'Leave taken'}
                          </Text>
                        ) : dayItem.isSunday ? (
                          <Text style={styles.summaryItemDetailSub}>
                            Weekly Off Day (Sunday)
                          </Text>
                        ) : dayItem.isHoliday ? (
                          <Text style={styles.summaryItemDetailSub}>
                            {dayItem.holidayName || 'Public Holiday'}
                          </Text>
                        ) : (
                          <Text style={styles.summaryItemDetailSub}>
                            Scheduled regular working day
                          </Text>
                        )}
                      </View>

                      {/* Right Chevron */}
                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSummaryListModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCloseBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  navCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitleWrap: {
    alignItems: 'center',
    flex: 1,
  },
  navMonthYearText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  employeeSwitcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    marginTop: 4,
  },
  employeeSwitcherText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    maxWidth: 160,
  },
  todayQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
  },
  todayQuickBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  summarySection: {
    marginBottom: SPACING.md,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryTapHint: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summaryGrid: {
    gap: 8,
    paddingVertical: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCardThird: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 8,
    ...SHADOWS.sm,
  },
  kpiNumberThird: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  kpiLabelThird: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  kpiViewTextThird: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  kpiCardHalf: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...SHADOWS.sm,
  },
  kpiLabelHalf: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiHalfBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  kpiNumberHalf: {
    fontSize: 18,
    fontWeight: '800',
  },
  kpiViewTextHalf: {
    fontSize: 10,
    fontWeight: '700',
  },
  kpiCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 105,
    ...SHADOWS.sm,
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  tapPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  kpiViewText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  calendarCard: {
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  weekdayTextSunday: {
    color: '#DC2626',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellWrapper: {
    width: `${100 / 7}%`,
    padding: 2,
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 52,
  },
  dayCard: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  dayCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#EEF2FF',
  },
  dayCardToday: {
    borderColor: '#3B82F6',
  },
  dayNumberContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPill: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  dayNumberSunday: {
    color: '#DC2626',
    fontWeight: '800',
  },
  dayNumberFuture: {
    color: '#94A3B8',
  },
  dayStatusPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStatusPill: {
    width: 18,
    height: 5,
    borderRadius: 2.5,
  },
  dayMiniLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#059669',
    marginTop: -2,
  },
  legendCard: {
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
  },
  legendHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  legendHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  legendColorDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  legendLabelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    maxHeight: '85%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalDateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalDaySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalBody: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalStatusColorTag: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  modalStatusTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  compOffNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 10,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  compOffNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#EA580C',
  },
  compOffNoticeSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9A3412',
    marginTop: 2,
  },
  detailSectionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
    marginBottom: 8,
  },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailFieldsWrap: {
    gap: 6,
  },
  detailFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailFieldValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  detailDescriptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
    lineHeight: 16,
  },
  noDataText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  leaveTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  leaveTypeCLTag: {
    backgroundColor: '#FEE2E2',
  },
  leaveTypeCompOffTag: {
    backgroundColor: '#DBEAFE',
  },
  leaveTypeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  // Summary List Modal Styles
  summaryListModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    maxHeight: '80%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  summaryListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryListIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryListTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryListSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryListHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
  },
  summaryListHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    flex: 1,
  },
  summaryListScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  summaryDateItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  summaryDateBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDateDayText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  summaryDateWeekdayText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  summaryItemDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  summaryItemStatusTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  summaryItemDetailSub: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  summaryEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  summaryEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 10,
  },
  summaryEmptySub: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default MonthlyCalendarView;
