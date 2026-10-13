import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { getTodayDateString } from '../utils/dateUtils';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// Generate years from 1950 to 2050 (101 years)
const YEARS = Array.from({ length: 101 }, (_, i) => 1950 + i);

export const DatePickerModal = ({
  visible = true,
  inline = false,
  value,
  selectedDate,
  onSelect,
  onSelectDate,
  onClose,
  title = 'Select Date',
  minDate,
  maxDate,
}) => {
  const activeDateValue = value || selectedDate || '';
  const parseValidDate = (val) => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const initial = parseValidDate(activeDateValue);
  const [currentYear, setCurrentYear] = useState(initial.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initial.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState(
    activeDateValue || getTodayDateString()
  );
  // viewMode: 'days' | 'months' | 'years'
  const [viewMode, setViewMode] = useState('days');

  useEffect(() => {
    const active = value || selectedDate || '';
    if (visible || inline) {
      const d = parseValidDate(active);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
      setSelectedDateStr(active || getTodayDateString());
      setViewMode('days');
    }
  }, [visible, inline, value, selectedDate]);

  const handlePrev = () => {
    if (viewMode === 'days') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else if (viewMode === 'months') {
      setCurrentYear((y) => y - 1);
    } else if (viewMode === 'years') {
      setCurrentYear((y) => y - 12);
    }
  };

  const handleNext = () => {
    if (viewMode === 'days') {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else if (viewMode === 'months') {
      setCurrentYear((y) => y + 1);
    } else if (viewMode === 'years') {
      setCurrentYear((y) => y + 12);
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const dispatchSelection = (dateStr) => {
    setSelectedDateStr(dateStr);
    if (typeof onSelect === 'function') {
      onSelect(dateStr);
    }
    if (typeof onSelectDate === 'function') {
      onSelectDate(dateStr);
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleDayPress = (day) => {
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${currentYear}-${m}-${d}`;
    dispatchSelection(dateStr);
  };

  const handleSelectToday = () => {
    const today = getTodayDateString();
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setViewMode('days');
    dispatchSelection(today);
  };

  // Build calendar matrix
  const matrix = [];
  let row = [];
  for (let i = 0; i < firstDay; i++) {
    row.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) {
      matrix.push(row);
      row = [];
    }
  }
  if (row.length > 0) {
    while (row.length < 7) {
      row.push(null);
    }
    matrix.push(row);
  }

  const todayStr = getTodayDateString();

  const renderContent = () => (
    <View style={[styles.container, inline && styles.inlineContainer]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Month / Year Navigator Row with Interactive Selector Pills */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={handlePrev} style={styles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={styles.selectorPillsRow}>
          {/* Month Selector Pill */}
          <TouchableOpacity
            style={[
              styles.selectorPill,
              viewMode === 'months' && styles.selectorPillActive,
            ]}
            onPress={() => setViewMode(viewMode === 'months' ? 'days' : 'months')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.selectorPillText,
                viewMode === 'months' && styles.selectorPillTextActive,
              ]}
            >
              {MONTHS[currentMonth]}
            </Text>
            <Ionicons
              name={viewMode === 'months' ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={viewMode === 'months' ? '#FFFFFF' : COLORS.primary}
            />
          </TouchableOpacity>

          {/* Year Selector Pill */}
          <TouchableOpacity
            style={[
              styles.selectorPill,
              viewMode === 'years' && styles.selectorPillActive,
            ]}
            onPress={() => setViewMode(viewMode === 'years' ? 'days' : 'years')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.selectorPillText,
                viewMode === 'years' && styles.selectorPillTextActive,
              ]}
            >
              {currentYear}
            </Text>
            <Ionicons
              name={viewMode === 'years' ? 'chevron-up' : 'chevron-down'}
              size={13}
              color={viewMode === 'years' ? '#FFFFFF' : COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleNext} style={styles.navBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* VIEW MODE 1: MONTHS SELECTOR GRID */}
      {viewMode === 'months' ? (
        <View style={styles.modeContainer}>
          <Text style={styles.modeSubtitle}>
            Select Month for {currentYear}
          </Text>
          <View style={styles.monthsGrid}>
            {MONTHS.map((mName, mIdx) => {
              const isSelected = currentMonth === mIdx;
              return (
                <TouchableOpacity
                  key={mIdx}
                  style={[
                    styles.monthGridItem,
                    isSelected && styles.monthGridItemActive,
                  ]}
                  onPress={() => {
                    setCurrentMonth(mIdx);
                    setViewMode('days');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.monthGridItemShort,
                      isSelected && styles.monthGridItemShortActive,
                    ]}
                  >
                    {MONTHS_SHORT[mIdx]}
                  </Text>
                  <Text
                    style={[
                      styles.monthGridItemFull,
                      isSelected && styles.monthGridItemFullActive,
                    ]}
                    numberOfLines={1}
                  >
                    {mName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* VIEW MODE 2: YEARS SELECTOR GRID (SCROLLABLE) */}
      {viewMode === 'years' ? (
        <View style={styles.modeContainer}>
          <Text style={styles.modeSubtitle}>
            Scroll and select year (1950 - 2050)
          </Text>
          <ScrollView
            style={styles.yearsScrollView}
            contentContainerStyle={styles.yearsGridContent}
            showsVerticalScrollIndicator={true}
          >
            {YEARS.map((yr) => {
              const isSelected = currentYear === yr;
              const isCurrentActualYear = new Date().getFullYear() === yr;
              return (
                <TouchableOpacity
                  key={yr}
                  style={[
                    styles.yearGridItem,
                    isCurrentActualYear && styles.currentYearBorder,
                    isSelected && styles.yearGridItemActive,
                  ]}
                  onPress={() => {
                    setCurrentYear(yr);
                    setViewMode('days');
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.yearGridItemText,
                      isSelected && styles.yearGridItemTextActive,
                    ]}
                  >
                    {yr}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* VIEW MODE 3: STANDARD DAYS GRID */}
      {viewMode === 'days' ? (
        <View style={styles.modeContainer}>
          {/* Days of Week Row */}
          <View style={styles.weekRow}>
            {DAYS.map((day, idx) => (
              <Text key={idx} style={styles.weekDayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {matrix.map((week, wIdx) => (
              <View key={wIdx} style={styles.weekLine}>
                {week.map((day, dIdx) => {
                  if (day === null) {
                    return <View key={dIdx} style={styles.daySlot} />;
                  }

                  const m = String(currentMonth + 1).padStart(2, '0');
                  const d = String(day).padStart(2, '0');
                  const thisDateStr = `${currentYear}-${m}-${d}`;

                  const isSelected = selectedDateStr === thisDateStr;
                  const isToday = todayStr === thisDateStr;

                  return (
                    <TouchableOpacity
                      key={dIdx}
                      style={[
                        styles.daySlot,
                        isToday && styles.todaySlot,
                        isSelected && styles.selectedSlot,
                      ]}
                      onPress={() => handleDayPress(day)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isToday && styles.todayText,
                          isSelected && styles.selectedText,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Footer Actions */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          style={styles.todayButton}
          onPress={handleSelectToday}
          activeOpacity={0.8}
        >
          <Ionicons name="today-outline" size={16} color={COLORS.primary} />
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>

        {viewMode !== 'days' ? (
          <TouchableOpacity
            style={styles.switchModeBtn}
            onPress={() => setViewMode('days')}
            activeOpacity={0.8}
          >
            <Ionicons name="calendar-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.switchModeBtnText}>Back to Calendar</Text>
          </TouchableOpacity>
        ) : null}

        {onClose && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (inline) {
    return renderContent();
  }

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={onClose || (() => {})}
    >
      <View style={styles.overlay}>
        {renderContent()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  container: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.lg,
  },
  inlineContainer: {
    maxWidth: '100%',
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.primarySubtle,
    backgroundColor: '#FAFCFF',
    ...SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  navBtn: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  selectorPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySubtle,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectorPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectorPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  selectorPillTextActive: {
    color: '#FFFFFF',
  },
  modeContainer: {
    minHeight: 250,
  },
  modeSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 2,
  },
  // Months View Styles
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
  },
  monthGridItem: {
    width: '31%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  monthGridItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  monthGridItemShort: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  monthGridItemShortActive: {
    color: '#FFFFFF',
  },
  monthGridItemFull: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  monthGridItemFullActive: {
    color: '#E0E7FF',
  },
  // Years View Styles
  yearsScrollView: {
    maxHeight: 240,
  },
  yearsGridContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  yearGridItem: {
    width: '23%',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  currentYearBorder: {
    borderColor: COLORS.primary,
  },
  yearGridItemActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  yearGridItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  yearGridItemTextActive: {
    color: '#FFFFFF',
  },
  // Days View Styles
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 6,
  },
  weekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  daysGrid: {
    gap: 4,
  },
  weekLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  daySlot: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
  },
  todaySlot: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  selectedSlot: {
    backgroundColor: COLORS.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  todayText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  selectedText: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySubtle,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  switchModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  switchModeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textLight,
  },
});

export default DatePickerModal;
