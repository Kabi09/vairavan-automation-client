import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import leaveApi from '../../api/leaveApi';
import ScreenHeader from '../../components/ScreenHeader';
import Card from '../../components/Card';
import TextInputField from '../../components/TextInputField';
import PrimaryButton from '../../components/PrimaryButton';
import ErrorMessage from '../../components/ErrorMessage';
import DatePickerModal from '../../components/DatePickerModal';
import { formatISODateOnly, isDateRangeValid } from '../../utils/dateUtils';
import { extractErrorMessage } from '../../utils/errorUtils';
import { COLORS, SPACING, RADIUS } from '../../constants/theme';

export const LeaveRequestScreen = ({ navigation }) => {
  const today = formatISODateOnly();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Date picker modals
  const [startDatePickerVisible, setStartDatePickerVisible] = useState(false);
  const [endDatePickerVisible, setEndDatePickerVisible] = useState(false);

  const validate = () => {
    const errors = {};
    if (!startDate) errors.startDate = 'Start date is required';
    if (!endDate) errors.endDate = 'End date is required';
    if (startDate && endDate && !isDateRangeValid(startDate, endDate)) {
      errors.endDate = 'End date cannot be earlier than start date';
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
        startDate,
        endDate,
        reason: reason.trim(),
      });

      Alert.alert(
        'Leave Request Submitted',
        'Your application has been forwarded to administration for sanction.',
        [
          {
            text: 'OK',
            onPress: () => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                try {
                  navigation.navigate('MyLeaves');
                } catch {
                  // Fallback
                }
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScreenHeader
        title="Apply for Leave"
        subtitle="Submit a formal time-off request"
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

            <Text style={[styles.sectionTitle, { marginTop: SPACING.md }]}>
              Reason for Absence
            </Text>

            <TextInputField
              label="Reason Details"
              placeholder="e.g. Attending family function in native village / Medical checkup..."
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
            title="Submit Leave Request"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
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
  formCard: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  submitBtn: {
    marginBottom: SPACING.xxl,
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
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginTop: 4,
    fontWeight: '500',
  },
});

export default LeaveRequestScreen;
