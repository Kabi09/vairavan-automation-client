import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
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

  useEffect(() => {
    const active = value || selectedDate || '';
    if (visible || inline) {
      const d = parseValidDate(active);
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
      setSelectedDateStr(active || getTodayDateString());
    }
  }, [visible, inline, value, selectedDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
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

      {/* Month / Year Navigator */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <Text style={styles.monthYearText}>
          {MONTHS[currentMonth]} {currentYear}
        </Text>

        <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

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
    marginBottom: SPACING.sm,
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
  monthYearText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
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
