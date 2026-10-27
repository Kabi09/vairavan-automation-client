import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import calendarApi from '../api/calendarApi';
import Card from './Card';
import StatusBadge from './StatusBadge';
import LoadingIndicator from './LoadingIndicator';
import ErrorMessage from './ErrorMessage';
import { formatDate } from '../utils/dateUtils';
import { extractErrorMessage } from '../utils/errorUtils';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

const LEGEND_ITEMS = [
  { color: CALENDAR_COLORS.present, label: 'Present / Worked' },
  { color: CALENDAR_COLORS.sundayWork, label: 'Sunday Work / Comp-Off Earned' },
  { color: CALENDAR_COLORS.approvedCL, label: 'Approved Leave (CL)' },
  { color: CALENDAR_COLORS.compOffLeave, label: 'Comp-Off Leave' },
  { color: CALENDAR_COLORS.pendingLeave, label: 'Pending Leave' },
  { color: CALENDAR_COLORS.holiday, label: 'Sunday / Holiday' },
  { color: CALENDAR_COLORS.futureNoRecord, label: 'Future / No Record' },
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
            <Ionicons name="chevron-back" size={22} color={COLORS.primary} />
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
            <Ionicons name="chevron-forward" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.todayQuickBtn}
          onPress={handleGoToToday}
          activeOpacity={0.7}
        >
          <Ionicons name="today-outline" size={14} color={COLORS.primary} />
          <Text style={styles.todayQuickBtnText}>Current Month</Text>
        </TouchableOpacity>
      </Card>

      <ErrorMessage message={error} onRetry={fetchCalendar} />

      {loading ? (
        <View style={{ paddingVertical: SPACING.xl }}>
          <LoadingIndicator message="Calculating monthly calendar & attendance..." />
        </View>
      ) : (
        <>
          {/* Monthly Summary Cards (7 required KPI metrics) */}
          {summary ? (
            <View style={styles.summarySection}>
              <Text style={styles.sectionHeading}>
                {MONTH_NAMES[selectedMonth - 1]} Summary
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.summaryScroll}
              >
                {/* 1. Scheduled Working Days */}
                <View style={[styles.kpiCard, { borderColor: '#CBD5E1' }]}>
                  <Ionicons name="calendar-outline" size={18} color="#475569" />
                  <Text style={styles.kpiNumber}>{summary.totalScheduledWorkingDays}</Text>
                  <Text style={styles.kpiLabel}>Working Days</Text>
                </View>

                {/* 2. Days Worked */}
                <View style={[styles.kpiCard, { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text style={[styles.kpiNumber, { color: '#059669' }]}>{summary.daysWorked}</Text>
                  <Text style={styles.kpiLabel}>Days Worked</Text>
                </View>

                {/* 3. Total Holidays */}
                <View style={[styles.kpiCard, { borderColor: '#FDE047', backgroundColor: '#FEFCE8' }]}>
                  <Ionicons name="sunny" size={18} color="#CA8A04" />
                  <Text style={[styles.kpiNumber, { color: '#CA8A04' }]}>{summary.totalHolidays}</Text>
                  <Text style={styles.kpiLabel}>Holidays</Text>
                </View>

                {/* 4. Casual Leave Taken */}
                <View style={[styles.kpiCard, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="time" size={18} color="#DC2626" />
                  <Text style={[styles.kpiNumber, { color: '#DC2626' }]}>{summary.casualLeaveTaken}</Text>
                  <Text style={styles.kpiLabel}>Casual Leave</Text>
                </View>

                {/* 5. Comp-Off Leave Taken */}
                <View style={[styles.kpiCard, { borderColor: '#93C5FD', backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="gift-outline" size={18} color="#2563EB" />
                  <Text style={[styles.kpiNumber, { color: '#2563EB' }]}>{summary.compOffLeaveTaken}</Text>
                  <Text style={styles.kpiLabel}>Comp-Off Used</Text>
                </View>

                {/* 6. Sunday Work Days */}
                <View style={[styles.kpiCard, { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' }]}>
                  <Ionicons name="briefcase" size={18} color="#EA580C" />
                  <Text style={[styles.kpiNumber, { color: '#EA580C' }]}>{summary.sundayWorkDays}</Text>
                  <Text style={styles.kpiLabel}>Sunday Works</Text>
                </View>

                {/* 7. Comp-Off Credits Earned */}
                <View style={[styles.kpiCard, { borderColor: '#DDD6FE', backgroundColor: '#F5F3FF' }]}>
                  <Ionicons name="star" size={18} color="#7C3AED" />
                  <Text style={[styles.kpiNumber, { color: '#7C3AED' }]}>{summary.compOffCreditsEarned}</Text>
                  <Text style={styles.kpiLabel}>Comp-Off Earned</Text>
                </View>
              </ScrollView>
            </View>
          ) : null}

          {/* Calendar Grid Card */}
          <Card style={styles.calendarCard}>
            {/* Weekday Header Row */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((dayName, idx) => (
                <View key={dayName} style={styles.weekdayCell}>
                  <Text
                    style={[
                      styles.weekdayText,
                      idx === 0 && { color: '#DC2626', fontWeight: '800' }, // Sunday in Red/Highlight
                    ]}
                  >
                    {dayName}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.gridContainer}>
              {/* Empty leading slots for first week offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCellEmpty} />
              ))}

              {/* Real calendar days */}
              {days.map((dayItem) => {
                const isSelected = selectedDayDetail?.date === dayItem.date;
                const hasDuty = Boolean(dayItem.hasWorked);
                const hasLeave = Boolean(dayItem.leave);
                const isSunday = Boolean(dayItem.isSunday);

                return (
                  <TouchableOpacity
                    key={dayItem.date}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                    ]}
                    onPress={() => {
                      setSelectedDayDetail(dayItem);
                      setDetailModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Date Number */}
                    <Text
                      style={[
                        styles.dayNumberText,
                        isSunday && styles.dayNumberSunday,
                        dayItem.isFuture && styles.dayNumberFuture,
                      ]}
                    >
                      {dayItem.dayOfMonth}
                    </Text>

                    {/* Primary Color Badge Indicator */}
                    <View
                      style={[
                        styles.dayIndicatorPill,
                        { backgroundColor: dayItem.statusColor || CALENDAR_COLORS.futureNoRecord },
                      ]}
                    />

                    {/* Secondary indicator dot for dual event (e.g. Sunday work + Comp-Off credit) */}
                    {dayItem.isSundayWork ? (
                      <View style={styles.secondaryDot} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Visible Calendar Color Legend */}
          <Card style={styles.legendCard}>
            <Text style={styles.legendHeaderTitle}>Color Legend</Text>
            <View style={styles.legendWrap}>
              {LEGEND_ITEMS.map((item) => (
                <View key={item.label} style={styles.legendItem}>
                  <View style={[styles.legendColorBox, { backgroundColor: item.color }]} />
                  <Text style={styles.legendLabelText}>{item.label}</Text>
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
    </View>
  );
};

const { width: screenWidth } = Dimensions.get('window');
const cellWidth = Math.floor((screenWidth - 48) / 7);

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  navCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: 'center',
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
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  employeeSwitcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
  },
  todayQuickBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  summarySection: {
    marginBottom: SPACING.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
    paddingHorizontal: 2,
  },
  summaryScroll: {
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  kpiCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 86,
    ...SHADOWS.sm,
  },
  kpiNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  calendarCard: {
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: `${100 / 7}%`,
    height: 48,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: '#E0E7FF',
    borderRadius: RADIUS.sm,
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  dayNumberSunday: {
    color: '#DC2626',
  },
  dayNumberFuture: {
    color: '#94A3B8',
  },
  dayIndicatorPill: {
    width: 14,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
  secondaryDot: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#EA580C',
  },
  legendCard: {
    padding: SPACING.md,
    marginBottom: SPACING.xl,
  },
  legendHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '46%',
  },
  legendColorBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalDateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  modalDaySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '500',
  },
  modalBody: {
    padding: SPACING.md,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  modalStatusColorTag: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  modalStatusTagText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  compOffNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  compOffNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A3412',
  },
  compOffNoticeSub: {
    fontSize: 11,
    color: '#C2410C',
    marginTop: 2,
    lineHeight: 15,
  },
  detailSectionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
    marginBottom: 6,
  },
  detailSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
  },
  detailFieldsWrap: {
    gap: 4,
  },
  detailFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailFieldLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailFieldValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  detailDescriptionText: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 16,
    marginTop: 2,
    fontStyle: 'italic',
  },
  noDataText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  leaveTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  leaveTypeCLTag: {
    backgroundColor: '#FEF2F2',
  },
  leaveTypeCompOffTag: {
    backgroundColor: '#EFF6FF',
  },
  leaveTypeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCloseBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default MonthlyCalendarView;
