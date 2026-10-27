import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import leaveApi from '../../api/leaveApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import BrandingFooter from '../../components/BrandingFooter';
import DatePickerModal from '../../components/DatePickerModal';
import { formatISODateOnly, isDateRangeValid } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const LeaveRequestScreen = ({ navigation }) => {
  const today = formatISODateOnly();
  const [leaveType, setLeaveType] = useState('casual_leave'); // 'casual_leave' or 'comp_off'
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [balances, setBalances] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Date picker modals
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  // Fetch balances on mount
  useEffect(() => {
    let isMounted = true;
    const fetchBalances = async () => {
      try {
        setLoadingBalances(true);
        const res = await leaveApi.getLeaveBalances();
        if (isMounted && res.data) {
          setBalances(res.data);
        }
      } catch (err) {
        console.warn('Failed to load leave balances:', err);
      } finally {
        if (isMounted) setLoadingBalances(false);
      }
    };

    fetchBalances();
    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate estimated working days (Monday-Saturday, excluding Sundays)
  const workingDaysEstimate = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;

    let count = 0;
    const curr = new Date(start);
    while (curr <= end) {
      if (curr.getDay() !== 0) { // 0 is Sunday
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  }, [startDate, endDate]);

  const validate = () => {
    const errors = {};
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && !isDateRangeValid(startDate, endDate)) {
      errors.endDate = 'End date cannot be earlier than start date';
    }

    if (workingDaysEstimate <= 0) {
      errors.startDate = 'Selected date range contains only Sundays (non-working days)';
    }

    // Balance check
    if (balances) {
      if (leaveType === 'casual_leave') {
        const available = balances.casualLeave?.available ?? 0;
        if (workingDaysEstimate > available) {
          errors.startDate = `Insufficient Casual Leave balance (${available} available, ${workingDaysEstimate} requested)`;
        }
      } else if (leaveType === 'comp_off') {
        const available = balances.compOff?.available ?? 0;
        if (workingDaysEstimate > available) {
          errors.startDate = `Insufficient Comp-Off credits (${available} available, ${workingDaysEstimate} requested)`;
        }
      }
    }

    if (!reason.trim()) {
      errors.reason = 'Reason for leave is required';
    } else if (reason.trim().length < 5) {
      errors.reason = 'Please provide a detailed reason';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      await leaveApi.createLeave({
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
      });

      Alert.alert(
        'Leave Request Submitted',
        `Your ${leaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} request for ${workingDaysEstimate} working day(s) has been forwarded to administration.`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MyLeaves');
              }
            },
          },
        ]
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit leave request'));
    } finally {
      setLoading(false);
    }
  };

  const clBalance = balances?.casualLeave;
  const compOffBalance = balances?.compOff;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Apply for Leave"
        subtitle="Casual Leave & Sunday Comp-Off Claims"
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorMessage message={error} />

          {/* Leave Type Selector */}
          <Card style={styles.typeCard}>
            <Text style={styles.sectionTitle}>Select Leave Type</Text>
            <View style={styles.typeSelectorRow}>
              {/* Casual Leave Option */}
              <TouchableOpacity
                style={[
                  styles.typePill,
                  leaveType === 'casual_leave' && styles.typePillActiveCL,
                ]}
                onPress={() => {
                  setLeaveType('casual_leave');
                  setFieldErrors({});
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="calendar"
                  size={18}
                  color={leaveType === 'casual_leave' ? '#FFFFFF' : '#DC2626'}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.typePillTitle,
                      leaveType === 'casual_leave' && styles.typePillTitleActive,
                    ]}
                  >
                    Casual Leave (CL)
                  </Text>
                  <Text
                    style={[
                      styles.typePillSub,
                      leaveType === 'casual_leave' && styles.typePillSubActive,
                    ]}
                  >
                    {loadingBalances
                      ? 'Checking balance...'
                      : `${clBalance?.available ?? 12} days available`}
                  </Text>
                </View>
                {leaveType === 'casual_leave' && (
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              {/* Comp-Off Option */}
              <TouchableOpacity
                style={[
                  styles.typePill,
                  leaveType === 'comp_off' && styles.typePillActiveCompOff,
                ]}
                onPress={() => {
                  setLeaveType('comp_off');
                  setFieldErrors({});
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="gift"
                  size={18}
                  color={leaveType === 'comp_off' ? '#FFFFFF' : '#2563EB'}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.typePillTitle,
                      leaveType === 'comp_off' && styles.typePillTitleActive,
                    ]}
                  >
                    Comp-Off Credit
                  </Text>
                  <Text
                    style={[
                      styles.typePillSub,
                      leaveType === 'comp_off' && styles.typePillSubActive,
                    ]}
                  >
                    {loadingBalances
                      ? 'Checking balance...'
                      : `${compOffBalance?.available ?? 0} credits available`}
                  </Text>
                </View>
                {leaveType === 'comp_off' && (
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {/* Balance Overview Card */}
            {balances && (
              <View
                style={[
                  styles.balanceInfoBox,
                  leaveType === 'comp_off'
                    ? styles.compOffBalanceInfoBox
                    : styles.clBalanceInfoBox,
                ]}
              >
                {leaveType === 'casual_leave' ? (
                  <>
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Annual Allowance</Text>
                      <Text style={styles.metricVal}>{clBalance?.allowance ?? 12} Days</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Used</Text>
                      <Text style={styles.metricVal}>{clBalance?.used ?? 0} Days</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Available</Text>
                      <Text style={[styles.metricVal, { color: '#059669', fontWeight: '800' }]}>
                        {clBalance?.available ?? 12} Days
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Earned (Sunday Work)</Text>
                      <Text style={styles.metricVal}>{compOffBalance?.earned ?? 0} Credits</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Used</Text>
                      <Text style={styles.metricVal}>{compOffBalance?.used ?? 0} Credits</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.balanceMetric}>
                      <Text style={styles.metricLabel}>Available</Text>
                      <Text style={[styles.metricVal, { color: '#0284C7', fontWeight: '800' }]}>
                        {compOffBalance?.available ?? 0} Credits
                      </Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </Card>

          <Card style={styles.formCard}>
            <Text style={styles.sectionTitle}>Leave Period</Text>

            {/* Start Date Picker */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Start Date *</Text>
              <TouchableOpacity
                style={[styles.datePickerBtn, fieldErrors.startDate && styles.pickerBtnError]}
                onPress={() => setStartDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>{startDate || 'Select Start Date'}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {fieldErrors.startDate ? (
                <Text style={styles.errorText}>{fieldErrors.startDate}</Text>
              ) : null}
            </View>

            {/* End Date Picker */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>End Date *</Text>
              <TouchableOpacity
                style={[styles.datePickerBtn, fieldErrors.endDate && styles.pickerBtnError]}
                onPress={() => setEndDatePickerVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.pickerBtnText}>{endDate || 'Select End Date'}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              {fieldErrors.endDate ? (
                <Text style={styles.errorText}>{fieldErrors.endDate}</Text>
              ) : null}
            </View>

            {/* Duration calculation preview */}
            <View style={styles.durationNoteBox}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.durationNoteTitle}>
                  Estimated Deductible: {workingDaysEstimate} Working Day(s)
                </Text>
                <Text style={styles.durationNoteSub}>
                  Working days are Monday to Saturday. Sundays are weekly holidays and not deducted.
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
              Reason for Absence
            </Text>

            <TextInputField
              label="Reason Details"
              placeholder="e.g. Attending personal/family work in native town..."
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (fieldErrors.reason) setFieldErrors((p) => ({ ...p, reason: null }));
              }}
              multiline
              numberOfLines={4}
              error={fieldErrors.reason}
              required
            />
          </Card>

          <PrimaryButton
            title={`Submit ${leaveType === 'comp_off' ? 'Comp-Off' : 'Casual Leave'} Request`}
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />

          <BrandingFooter style={styles.brandingFooter} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Pickers */}
      <DatePickerModal
        visible={startDatePickerVisible}
        onClose={() => setStartDatePickerVisible(false)}
        selectedDate={startDate}
        onSelectDate={(date) => {
          setStartDate(date);
          if (fieldErrors.startDate) setFieldErrors((p) => ({ ...p, startDate: null }));
        }}
        title="Select Start Date"
      />

      <DatePickerModal
        visible={endDatePickerVisible}
        onClose={() => setEndDatePickerVisible(false)}
        selectedDate={endDate}
        onSelectDate={(date) => {
          setEndDate(date);
          if (fieldErrors.endDate) setFieldErrors((p) => ({ ...p, endDate: null }));
        }}
        title="Select End Date"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  typeCard: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  typeSelectorRow: {
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  typePillActiveCL: {
    backgroundColor: '#DC2626',
    borderColor: '#B91C1C',
  },
  typePillActiveCompOff: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  typePillTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  typePillTitleActive: {
    color: '#FFFFFF',
  },
  typePillSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  typePillSubActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  balanceInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginTop: 6,
  },
  clBalanceInfoBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  compOffBalanceInfoBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  balanceMetric: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  formCard: {
    marginBottom: SPACING.xl,
  },
  fieldContainer: {
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  pickerBtnError: {
    borderColor: COLORS.danger,
    backgroundColor: '#FEF2F2',
  },
  pickerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  durationNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  durationNoteTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  durationNoteSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 15,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '500',
  },
  submitBtn: {
    marginBottom: SPACING.lg,
  },
  brandingFooter: {
    marginBottom: SPACING.xl,
  },
});

export default LeaveRequestScreen;
