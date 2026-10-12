import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../constants/theme';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const PRESETS = ['09:00', '09:30', '13:00', '14:00', '17:30', '18:00', '19:00'];

export const TimePickerModal = ({
  visible,
  value = '09:30',
  onSelect,
  onClose,
  title = 'Select Time',
}) => {
  // Parse initial 24h time string (HH:mm)
  const parseTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) {
      return { hour12: 9, minute: '30', period: 'AM' };
    }
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10) || 0;
    const m = (parseInt(mStr, 10) || 0).toString().padStart(2, '0');
    const period = h >= 12 ? 'PM' : 'AM';
    let hour12 = h % 12;
    if (hour12 === 0) hour12 = 12;
    return { hour12, minute: m, period };
  };

  const initial = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(initial.hour12);
  const [selectedMinute, setSelectedMinute] = useState(initial.minute);
  const [selectedPeriod, setSelectedPeriod] = useState(initial.period);

  useEffect(() => {
    if (visible) {
      const parsed = parseTime(value);
      setSelectedHour(parsed.hour12);
      setSelectedMinute(parsed.minute);
      setSelectedPeriod(parsed.period);
    }
  }, [visible, value]);

  const handleConfirm = () => {
    let h24 = selectedHour % 12;
    if (selectedPeriod === 'PM') h24 += 12;
    const formatted = `${String(h24).padStart(2, '0')}:${selectedMinute}`;
    onSelect(formatted);
    onClose();
  };

  const handleApplyPreset = (presetTime) => {
    onSelect(presetTime);
    onClose();
  };

  const handleApplyNow = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    onSelect(`${h}:${m}`);
    onClose();
  };

  // Preview formatted
  let previewH24 = selectedHour % 12;
  if (selectedPeriod === 'PM') previewH24 += 12;
  const previewTime = `${String(previewH24).padStart(2, '0')}:${selectedMinute}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.previewText}>
                {String(selectedHour).padStart(2, '0')}:{selectedMinute} {selectedPeriod} ({previewTime})
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          {/* AM / PM Toggle */}
          <View style={styles.periodToggleRow}>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                selectedPeriod === 'AM' && styles.periodBtnActive,
              ]}
              onPress={() => setSelectedPeriod('AM')}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === 'AM' && styles.periodTextActive,
                ]}
              >
                AM
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.periodBtn,
                selectedPeriod === 'PM' && styles.periodBtnActive,
              ]}
              onPress={() => setSelectedPeriod('PM')}
            >
              <Text
                style={[
                  styles.periodText,
                  selectedPeriod === 'PM' && styles.periodTextActive,
                ]}
              >
                PM
              </Text>
            </TouchableOpacity>
          </View>

          {/* Hour & Minute Pickers */}
          <View style={styles.columnsContainer}>
            {/* Hours Column */}
            <View style={styles.columnWrap}>
              <Text style={styles.columnLabel}>Hour</Text>
              <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                <View style={styles.chipsGrid}>
                  {HOURS.map((h) => {
                    const isSelected = selectedHour === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[styles.timeChip, isSelected && styles.timeChipActive]}
                        onPress={() => setSelectedHour(h)}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            isSelected && styles.timeChipTextActive,
                          ]}
                        >
                          {String(h).padStart(2, '0')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Minutes Column */}
            <View style={styles.columnWrap}>
              <Text style={styles.columnLabel}>Minute</Text>
              <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
                <View style={styles.chipsGrid}>
                  {MINUTES.map((m) => {
                    const isSelected = selectedMinute === m;
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.timeChip, isSelected && styles.timeChipActive]}
                        onPress={() => setSelectedMinute(m)}
                      >
                        <Text
                          style={[
                            styles.timeChipText,
                            isSelected && styles.timeChipTextActive,
                          ]}
                        >
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Quick Presets Strip */}
          <Text style={styles.presetsLabel}>Quick Select</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.presetsScroll}
            contentContainerStyle={styles.presetsRow}
          >
            <TouchableOpacity style={styles.nowChip} onPress={handleApplyNow}>
              <Ionicons name="time" size={13} color={COLORS.primary} />
              <Text style={styles.nowChipText}>Now</Text>
            </TouchableOpacity>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.presetChip}
                onPress={() => handleApplyPreset(p)}
              >
                <Text style={styles.presetChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Actions */}
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Set Time</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
  periodToggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.md,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  periodBtnActive: {
    backgroundColor: COLORS.primary,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  periodTextActive: {
    color: COLORS.textLight,
  },
  columnsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    height: 160,
  },
  columnWrap: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  scrollList: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 4,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
  },
  timeChip: {
    width: 40,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  timeChipTextActive: {
    color: COLORS.textLight,
    fontWeight: '700',
  },
  presetsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  presetsScroll: {
    marginBottom: SPACING.md,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  nowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.primarySubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  nowChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  presetChip: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
  },
});

export default TimePickerModal;
